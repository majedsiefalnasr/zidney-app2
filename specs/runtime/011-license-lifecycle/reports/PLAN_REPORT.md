# Plan Report — License Lifecycle

**Step:** 3 — Plan  
**Timestamp:** 2026-02-24T00:00:00Z  
**Status:** COMPLETE

---

## Summary

Comprehensive technical implementation plan generated across five phases: research (existing
infrastructure), data model (schema blueprint with migrations), contracts (License Service methods,
Worker jobs, API endpoints, Tenant Resolver middleware), quickstart guide (developer scenarios), and
detailed plan document. All design decisions explicitly tied to locked clarifications. Plan
estimates 5-week implementation timeline with 4-phase concurrent deployment strategy.

---

## Planning Artifacts Delivered

| Artifact                     | Phase   | Size   | Coverage                                                                                                                 |
| ---------------------------- | ------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| research.md                  | Phase 0 | ~3 KB  | Existing infrastructure, dependencies, gaps analysis                                                                     |
| data-model.md                | Phase 1 | ~8 KB  | 5 tables (licenses extended, snapshots, audit_logs, confirmations, tenants_registry extended), 5 migrations forward-only |
| contracts/license-service.md | Phase 1 | ~4 KB  | 5 core methods + 4 helpers, error types, transaction semantics                                                           |
| contracts/worker-jobs.md     | Phase 1 | ~5 KB  | 4 job types, retry logic, payload schema, idempotency guarantees                                                         |
| contracts/api-endpoints.md   | Phase 1 | ~6 KB  | 9 REST endpoints, full request/response specs, status codes                                                              |
| contracts/tenant-resolver.md | Phase 1 | ~4 KB  | Middleware execution, status routing, performance targets (<1ms)                                                         |
| quickstart.md                | Phase 1 | ~7 KB  | 4 developer scenarios, flow diagrams, code snippets, testing strategy                                                    |
| plan.md                      | Phase 1 | ~25 KB | Full implementation blueprint with 10 sections, timeline, risks, deployment                                              |

**Total Planning Content**: ~62 KB across 8 documents

---

## Key Design Decisions (Locked from Clarifications)

| #   | Clarification     | Plan Decision                                                        | Implementation Impact                                                                |
| --- | ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Snapshot Location | Deterministic `s3://snapshots/{license_id}/{timestamp}.tar.gz`       | Stored in `snapshots.snapshot_location`; immutable after creation                    |
| 2   | Audit Retention   | Manual purge by elevated role (never auto-delete)                    | New `license_audit_logs` table (immutable); purge endpoint requires 2FA              |
| 3   | Snapshot Failure  | Retry 3x exponential backoff, alert admin, license stays SOFT_LOCKED | Worker job with DLQ; status enum (created\|failed) in snapshots table                |
| 4   | Deletion Auth     | Admin-only, 2FA re-auth, confirmation phrase validation              | Endpoint `/licenses/{id}/delete/confirm`; new `license_deletion_confirmations` table |
| 5   | Restore SLA       | Async, size-based: <1GB ≤5min, 1-5GB ≤15min, >5GB ≤30min             | Worker job `restore_from_archive`; client polls job status or uses WebSocket         |

---

## Database Schema Overview

### Migration Set (A001–A005)

**A001: Create snapshots table**

```sql
CREATE TABLE snapshots (
  id UUID PRIMARY KEY,
  license_id UUID NOT NULL,
  snapshot_location TEXT NOT NULL UNIQUE,  -- deterministic path
  snapshot_timestamp TIMESTAMP NOT NULL,
  schema_version INT NOT NULL,
  tenant_db_size_bytes BIGINT,
  status ENUM('created', 'failed') DEFAULT 'created',
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (license_id) REFERENCES licenses(id)
);
```

**A002: Create license_audit_logs table (immutable)**

```sql
CREATE TABLE license_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  license_id UUID NOT NULL,
  previous_status VARCHAR(32),
  new_status VARCHAR(32) NOT NULL,
  actor_id UUID,
  reason TEXT,
  metadata JSONB,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (license_id) REFERENCES licenses(id)
);
-- Immutable: no UPDATE allowed; only INSERT
```

**A003: Create license_deletion_confirmations table**

```sql
CREATE TABLE license_deletion_confirmations (
  id UUID PRIMARY KEY,
  license_id UUID NOT NULL,
  confirmation_phrase_hash BYTEA NOT NULL,
  actor_id UUID NOT NULL,
  confirmed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (license_id) REFERENCES licenses(id)
);
```

**A004: Extend licenses table**

```sql
ALTER TABLE licenses ADD COLUMN soft_lock_until TIMESTAMP;
ALTER TABLE licenses ADD COLUMN archived_at TIMESTAMP;
ALTER TABLE licenses ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE licenses ADD COLUMN current_snapshot_id UUID;
```

**A005: Extend tenants_registry table**

```sql
ALTER TABLE tenants_registry ADD COLUMN license_status VARCHAR(32);  -- denormalized for quick lookup
```

### Indexes for Performance

- `snapshots(license_id, created_at DESC)` — recent snapshots by license
- `license_audit_logs(license_id, timestamp DESC)` — timeline queries
- `licenses(soft_lock_until)` — find licenses near expiry
- `licenses(status)` — quick state filtering

---

## API Endpoints (9 total)

**License Lifecycle Operations:**

- `POST /api/licenses/{id}/soft-lock` — Trigger soft lock immediately (admin)
- `POST /api/licenses/{id}/renew` — Reactivate from SOFT_LOCKED to ACTIVE (admin)
- `POST /api/licenses/{id}/archive` — Manual transition to ARCHIVED (admin; initiates snapshot)
- `POST /api/licenses/{id}/restore` — Async restore from archive (admin; worker job)
- `POST /api/licenses/{id}/delete/initiate` — Initiate deletion (admin; returns confirmation task)
- `POST /api/licenses/{id}/delete/confirm` — Confirm deletion with 2FA + phrase (admin)

**Query Operations:**

- `GET /api/licenses/{id}` — Get license details (status, snapshots, audit trail)
- `GET /api/licenses/{id}/audit-trail` — Paginated audit log (immutable records)
- `GET /api/licenses/{id}/job/{job_id}` — Poll restore/deletion job status

**Status Codes:**

- 200 OK — Operation succeeded
- 202 Accepted — Async job queued (restore, deletion)
- 400 Bad Request — Invalid input
- 401 Unauthorized — Not authenticated
- 403 Forbidden — License ARCHIVED (read-only operations only)
- 404 Not Found — License DELETED
- 423 Locked — License SOFT_LOCKED (limited operations)

---

## License Service (Domain Logic)

**Core Methods:**

- `transitionToSoftLock(license_id, reason)` — Sets soft_lock_until = now + 90d
- `transitionToActive(license_id)` — Clears soft_lock_until (idempotent)
- `transitionToArchived(license_id)` — With snapshot prerequisite; atomic
- `restoreFromArchive(license_id, snapshot_id)` — Async, idempotent, schema validation
- `transitionToDeleted(license_id, confirmation_phrase)` — Irreversible, requires 2FA

All methods use `SELECT FOR UPDATE` to prevent concurrent state race conditions.

---

## Worker Jobs (3 types)

**Job 1: snapshot_create**

- Triggered by transition to ARCHIVED
- Captures tenant DB dump → S3 at deterministic path
- 3 retries (exponential backoff: 1s → 2s → 4s)
- On persistent failure: marks snapshot status = 'failed', alerts admin
- License remains SOFT_LOCKED; archival blocked

**Job 2: restore_from_archive**

- Triggered by admin restore request
- Validates schema_version compatibility before restore
- Restores tenant DB from snapshot
- Size-aware SLA: <1GB ≤5min, 1-5GB ≤15min, >5GB ≤30min
- Idempotent: restoring twice returns same result
- On failure: reverts to ARCHIVED (not ACTIVE)

**Job 3: delete_license**

- Triggered by admin confirmation
- Drops tenant database
- Deletes snapshot from S3
- Updates licenses.status = DELETED + deleted_at
- Removes tenants_registry entry
- 2 retries on transient failure; alerts on persistent failure

---

## Tenant Resolver Middleware

**Execution Position**: Route 3 in middleware stack (after auth, before handler)

**Status-Based Routing:**

```
if license.status == 'ACTIVE':
  => continue to handler
elif license.status == 'SOFT_LOCKED':
  if now > soft_lock_until:
    => auto-transition to ARCHIVED (deterministic, no job needed)
    => return 403 Forbidden
  elsif endpoint_id in lifecycle_endpoint_ids:  // soft-lock, renew, snapshot restore
    => continue to handler
  else:
    => return 423 Locked
elif license.status == 'ARCHIVED':
  if endpoint_id in archive_read_endpoints:  // snapshot metadata, audit
    => continue to handler
  else:
    => return 403 Forbidden
elif license.status == 'DELETED':
  => return 404 Not Found (masquerade as if license never existed)
```

**Performance Target:** < 1ms per request (cached status lookup)

---

## Audit Logging

**Immutability Guarantee**: All audit log inserts are append-only; no UPDATE/DELETE allowed.

**Fields per entry:**

- `id` (BIGSERIAL) — Monotonic increasing sequence
- `license_id` (UUID) — Which license changed
- `previous_status` (VARCHAR) — From state
- `new_status` (VARCHAR) — To state
- `actor_id` (UUID) — Who made the change
- `reason` (TEXT) — Why (e.g., "payment lapsed", "admin manual", "90-day auto-expiry")
- `metadata` (JSONB) — Additional context (snapshot_id, old_snapshot_id, etc.)
- `timestamp` (TIMESTAMP) — Server-generated (UTC)

**Purge Policy:** No auto-delete; admin (with 2FA) can manually purge old entries by license_id
(adds audit entry for purge itself).

---

## MMC UI Components (New)

- **License Detail Page** — Status badge, soft-lock countdown (live), snapshots list, audit trail
  paginated
- **License List** — Filter by status (ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED), sort by
  soft_lock_until
- **Deletion Dialog** — Input confirmation phrase, 2FA re-prompt, irreversible warning
- **Snapshot Restore Dialog** — Schema version compatibility check, restore job monitor with ETA
- **Job Status Monitor** — Visual progress for async restore/deletion (polling or WebSocket)

---

## Testing Strategy

| Test Type             | Coverage            | Examples                                                                      |
| --------------------- | ------------------- | ----------------------------------------------------------------------------- |
| **Unit Tests**        | State machine logic | ACTIVE→SOFT_LOCKED→ACTIVE (idempotent), forbidden transitions                 |
| **Integration Tests** | Full workflow       | Payment event → soft lock → 90d countdown → auto-archive → restore → delete   |
| **API Tests**         | Endpoint behavior   | 423 on SOFT_LOCKED, 403 on ARCHIVED, idempotent restore                       |
| **Worker Tests**      | Job success/failure | Snapshot creation retry, restore with schema validation, delete with rollback |
| **Snapshot Tests**    | Data integrity      | Snapshot checksum validation, schema version tagging, deterministic paths     |
| **Load Tests**        | Concurrency         | 1000 concurrent soft-lock requests, no race conditions                        |
| **Security Tests**    | Authorization       | Non-admin cannot delete, confirmation phrase hash verified, 2FA enforced      |

---

## Deployment Strategy (4 Phases)

**Phase 1: Databases** — Run migrations A001–A005 in staging **Phase 2: Backend** — Deploy License
Service + Worker jobs **Phase 3: Middleware** — Activate License Enforcement Middleware (enhance for
auto-expiry) **Phase 4: UI** — Deploy MMC UI components + monitoring

**Rollback Plan:** Each phase is independently reversible up to Phase 4. Phase 3 (middleware) blocks
all SOFT_LOCKED and ARCHIVED requests; if needed, revert to previous middleware code.

---

## Constitutional Compliance

✅ **No cross-tenant access** — Snapshots isolated by license_id/tenant_id  
✅ **License middleware mandatory** — Enforced at Tenant Resolver stage 3  
✅ **Snapshot integrity** — Immutable after creation; version tagged  
✅ **Audit immutability** — No UPDATE/DELETE on audit_logs table  
✅ **Idempotency** — Restore twice = same result; renewal twice = same result  
✅ **Version compatibility** — Schema version validated on restore  
✅ **Server-authoritative time** — All timestamps server-generated (UTC)  
✅ **Transactional safety** — SELECT FOR UPDATE on concurrent transitions  
✅ **Worker-based async** — Snapshots created by Worker, not in-request  
✅ **Observable failures** — No silent retries; alerts on persistent failure

---

## Timeline Estimate

- **Week 1** — Migrations + License Service core methods
- **Week 2** — API endpoints + Tenant Resolver enhancement
- **Week 3** — Worker jobs (snapshot, restore, delete) + retry DLQ
- **Week 4** — MMC UI components + integration testing
- **Week 5** — Load tests, security tests, deployment prep + staging UAT

**Prerequisite**: Ensure STAGE 10 (Licenses Management) is PRODUCTION READY (already done:
010-licenses-management merged)

---

## Identified Risks & Mitigations

| Risk                                         | Probability | Mitigation                                                                      |
| -------------------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| Snapshot creation timeout (large DBs >100GB) | Medium      | Async, size-aware SLA; worker can retry; admin visible progress                 |
| Schema incompatibility on restore            | Low         | Version compatibility matrix checked before restore; blocked with error message |
| Concurrent deletion + restore (race)         | Low         | SELECT FOR UPDATE; state machine validates current state before state change    |
| Audit log table unbounded growth             | Low         | Manual purge by legal; no auto-expiration; monitoring/alerting on table size    |

---

## Guardian Validation Gates

Before proceeding to Task Generation (Step 4):

- **Architecture Checker** must validate structural compliance (tenant isolation, middleware order)
- **API Designer** must validate endpoint design (error codes, idempotency, rate limiting)

Both must return `VERDICT: PASS`. If any returns `BLOCKED` → fix and re-validate before Step 4.

---

## Next Step

Proceed to Step 3A: Guardian Plan Validation (Architecture Checker + API Designer). Upon dual PASS
verdicts, proceed to Step 4 — Tasks.
