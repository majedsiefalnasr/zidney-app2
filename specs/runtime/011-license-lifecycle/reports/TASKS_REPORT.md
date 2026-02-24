# Tasks Report — License Lifecycle

**Step:** 4 — Tasks  
**Timestamp:** 2026-02-24T00:00:00Z  
**Status:** COMPLETE

---

## Summary

Complete task breakdown generated with 55 atomic, dependency-ordered tasks across 10 implementation phases. Tasks distributed across database schema (5), domain logic (10), API layer (9), middleware (3), worker jobs (6), audit logging (3), MMC UI (4), testing (10), documentation (2), and deployment (3). Estimated 5-week timeline with 33% of tasks parallelizable for concurrent team execution. All tasks reference exact file paths and explicit acceptance criteria.

---

## Task Generation Results

| Metric                       | Value                                                |
| ---------------------------- | ---------------------------------------------------- |
| **Total Tasks Generated**    | 55                                                   |
| **Parallelizable Tasks [P]** | 18 (33%)                                             |
| **Critical Path Length**     | ~20 task milestones                                  |
| **Estimated Duration**       | 5 weeks (280 task-hours)                             |
| **MVP Scope (1 week)**       | Tasks T001–T024 (24 tasks) — database + domain + API |
| **Full Scope (5 weeks)**     | Tasks T001–T055 — complete feature with deployment   |

---

## Task Distribution by Phase

### Phase 1: Database Schema (5 tasks = T001–T005)

- **Objective**: Create all schema migrations and indexes
- **Tasks**:
  - T001 [Setup] [SYS] Create snapshots table migration A001 (immutable snapshot records with status tracking)
  - T002 [Setup] [SYS] Create license_audit_logs table migration A002 (immutable append-only audit trail)
  - T003 [Setup] [SYS] Create license_deletion_confirmations table migration A003 (double-confirmation tracking)
  - T004 [Setup] [SYS] Extend licenses table migration A004 (soft_lock_until, archived_at, deleted_at, current_snapshot_id)
  - T005 [Setup] [SYS] Extend tenants_registry table migration A005 (denormalized license_status)
- **Acceptance Criteria**: All migrations forward-only, reversible via snapshot restore, indexes defined for performance, no data loss
- **Estimated Hours**: 8 hours total
- **Parallelizable**: No (sequential migration creation)

### Phase 2: Domain Logic (10 tasks = T006–T015)

- **Objective**: Implement License Service with state machine and helpers
- **Tasks**:
  - T006 [P] [SYS] Implement transitionToSoftLock method (sets soft_lock_until, creates audit log, locks license)
  - T007 [P] [SYS] Implement transitionToActive method (clears soft_lock_until, idempotent renewal)
  - T008 [P] [SYS] Implement transitionToArchived method (atomically creates snapshot prerequisite, validates state)
  - T009 [P] [SYS] Implement restoreFromArchive method (snapshot prerequisite, schema validation, idempotent restore)
  - T010 [P] [SYS] Implement transitionToDeleted method (irreversible deletion with 2FA confirmation)
  - T011 [P] [SYS] Implement getLicenseById and related query helpers (read-only, cached)
  - T012 [P] [SYS] Implement state machine validator (enforces forbidden transitions: ACTIVE→DELETED, SOFT_LOCKED→DELETED)
  - T013 [P] [SYS] Implement concurrent access guard (SELECT FOR UPDATE for state changes)
  - T014 [P] [SYS] Implement error handling and retry strategy (transient vs permanent errors)
  - T015 [P] [SYS] Add unit tests for License Service (state transitions, idempotency, transaction semantics)
- **Acceptance Criteria**: All methods atomic, transactional (SERIALIZABLE isolation), SELECT FOR UPDATE on state changes, idempotent, all transitions logged
- **Estimated Hours**: 40 hours total
- **Parallelizable**: Yes [P] — All service methods independent; T006–T014 can run in parallel (4 developers); T015 depends on T006–T014

### Phase 3: API Layer (9 tasks = T016–T024)

- **Objective**: Implement 9 REST endpoints with idempotency, 2FA, and async support
- **Tasks**:
  - T016 [P] [FEATURE] POST /licenses/{id}/soft-lock endpoint (validate ACTIVE, call transitionToSoftLock, return 200 with countdown)
  - T017 [P] [FEATURE] POST /licenses/{id}/renew endpoint (validate SOFT_LOCKED, call transitionToActive, idempotent)
  - T018 [P] [FEATURE] POST /licenses/{id}/archive endpoint (enqueue snapshot job, return 202 with job_id and ETA)
  - T019 [P] [FEATURE] POST /licenses/{id}/restore endpoint (async restore job, 202 Accepted, size-based SLA)
  - T020 [FEATURE] POST /licenses/{id}/delete/initiate endpoint (generate confirmation phrase, 2FA check, return confirmation_id)
  - T021 [FEATURE] POST /licenses/{id}/delete/confirm endpoint (verify confirmation phrase hash, 2FA freshness, enqueue delete job, 202 Accepted)
  - T022 [FEATURE] GET /licenses/{id} endpoint (read-only, include audit/snapshot if requested)
  - T023 [FEATURE] GET /licenses/{id}/audit-trail endpoint (paginated, filterable by date range)
  - T024 [FEATURE] GET /licenses/{id}/job-status/{job_id} endpoint (poll async job status with progress_percent and ETA)
- **Acceptance Criteria**: All endpoints validate input, return idempotent responses, enforced Idempotency-Key header on POST, proper HTTP status codes (202 for async), error codes from reference table
- **Estimated Hours**: 36 hours total
- **Parallelizable**: Yes [P] — Most endpoints independent (T016–T019, T022–T024 can run in parallel); T020–T021 depend on auth/2FA setup

### Phase 4: Middleware (3 tasks = T025–T027)

- **Objective**: Enhance Tenant Resolver with license enforcement and auto-expiry
- **Tasks**:
  - T025 [FEATURE] Implement license status routing in middleware (ACTIVE→200, SOFT_LOCKED→423, ARCHIVED→403, DELETED→404)
  - T026 [FEATURE] Implement deterministic soft-lock auto-expiry (middleware checks now > soft_lock_until, atomically transitions to ARCHIVED without job)
  - T027 [FEATURE] Implement rate limiting with admin bypass tier (standard users: 1 transition/min; admin: unlimited; return X-RateLimit-\* headers)
- **Acceptance Criteria**: Auto-expiry happens on every request (no cron), middleware latency < 1ms, admin users bypass rate limits without spamming, all transitions logged
- **Estimated Hours**: 12 hours total
- **Parallelizable**: No (middleware execution order critical)

### Phase 5: Worker Jobs (6 tasks = T028–T033)

- **Objective**: Implement 3 worker job types with retry policy, monitoring, and idempotency
- **Tasks**:
  - T028 [P] [SYS] Implement snapshot_create job (3 retries exponential backoff, captures tenant DB to S3 deterministic path, 10-min SLA)
  - T029 [P] [SYS] Implement restore_from_archive job (idempotent, schema version check, size-based SLA: 5/15/30 min, atomic restore)
  - T030 [P] [SYS] Implement delete_license job (2 retries, drop tenant DB + delete snapshot + update registry, atomic)
  - T031 [FEATURE] Implement job monitoring service (track job status, progress_percent, ETA, errors in Redis/cache)
  - T032 [FEATURE] Implement DLQ for persistent job failures (alert admin on 3 failed retries, provide manual override)
  - T033 [FEATURE] Add unit tests for worker jobs (retry logic, idempotency, failure handling)
- **Acceptance Criteria**: Jobs idempotent (retry-safe), no duplicate operations, failures surface as CRITICAL alerts, job status queryable via GET /job-status/{job_id}
- **Estimated Hours**: 24 hours total
- **Parallelizable**: Yes [P] — T028–T030 independent; T031–T033 depend on job implementations

### Phase 6: Audit & Logging (3 tasks = T034–T036)

- **Objective**: Implement immutable audit trail and manual purge workflow
- **Tasks**:
  - T034 [FEATURE] Implement audit log insert handler (append-only, no UPDATE/DELETE, include correlation_id, actor_id, reason, metadata)
  - T035 [FEATURE] Implement audit log reader (GET /licenses/{id}/audit-trail paginated, with date/actor filters)
  - T036 [FEATURE] Implement audit purge workflow (admin-only, 2FA required, generates audit entry for purge itself, immutable)
- **Acceptance Criteria**: Every state transition creates audit entry, audit entries never modified, purge requires 2FA and confirmation, immutability verified
- **Estimated Hours**: 8 hours total
- **Parallelizable**: No (T034 required for T035–T036)

### Phase 7: MMC UI (4 tasks = T037–T040)

- **Objective**: Build MMC UI components for license lifecycle management
- **Tasks**:
  - T037 [P] [FEATURE] Build License Detail page (display status, soft-lock countdown live-updating, archived/deleted timestamps, current snapshot)
  - T038 [P] [FEATURE] Build License Deletion Dialog (input confirmation phrase, 2FA re-prompt, irreversible warning, progress tracking)
  - T039 [P] [FEATURE] Build License Audit Viewer (paginated timeline, filter by actor/date, immutable record display)
  - T040 [P] [FEATURE] Build Async Job Monitor (restore/deletion progress bar, ETA, polling or WebSocket updates, result/error display)
- **Acceptance Criteria**: Status badge updates without page reload, deletion protected by 2FA, job progress visible, audit entries read-only
- **Estimated Hours**: 16 hours total
- **Parallelizable**: Yes [P] — UI components independent

### Phase 8: Testing (10 tasks = T041–T050)

- **Objective**: Achieve 95%+ code coverage with comprehensive test scenarios
- **Tasks**:
  - T041 [P] [SYS] Add unit tests: license state machine (all valid/invalid transitions)
  - T042 [P] [SYS] Add unit tests: service methods (idempotency, transaction semantics, error handling)
  - T043 [P] [SYS] Add integration tests: full workflow (payment event → soft lock → 90d countdown → auto-archive → restore → delete)
  - T044 [P] [SYS] Add integration tests: snapshot failure recovery (retry logic, license stays locked, alert admin)
  - T045 [P] [FEATURE] Add API tests: endpoints with edge cases (wrong status, missing auth, invalid input, idempotency-key dedup)
  - T046 [P] [FEATURE] Add API tests: 423/403/404 routing (SOFT_LOCKED/ARCHIVED/DELETED access denied correctly)
  - T047 [SYS] Add worker tests: retry policy (3x exponential, no silent failures, DLQ on persistent error)
  - T048 [SYS] Add snapshot tests: data integrity (checksum validation, schema version tagging, deterministic paths)
  - T049 [SYS] Add load tests: concurrency (1000 concurrent soft-lock requests, no race conditions, state consistent)
  - T050 [SYS] Add security tests: authorization (non-admin cannot delete, confirmation phrase hash verified, 2FA enforced)
- **Acceptance Criteria**: Minimum 95% code coverage, all critical paths tested, load tests show <100ms p99 latency, no race conditions under 1000 concurrent
- **Estimated Hours**: 40 hours total
- **Parallelizable**: Yes [P] — Test files independent (4 developers)

### Phase 9: Documentation (2 tasks = T051–T052)

- **Objective**: Document feature for operators and developers
- **Tasks**:
  - T051 [FEATURE] Update API documentation (generate OpenAPI/Swagger from endpoint specs, post to docs site)
  - T052 [FEATURE] Write deployment runbook and incident response guide (4-phase deploy steps, rollback procedures, monitoring tips)
- **Acceptance Criteria**: API docs published, deployment procedure testable in staging, incident response has clear escalation path
- **Estimated Hours**: 6 hours total
- **Parallelizable**: Yes [P] — Independent docs

### Phase 10: Deployment (3 tasks = T053–T055)

- **Objective**: Execute 4-phase production deployment with validation gates
- **Tasks**:
  - T053 [SYS] Phase 1: Run migrations in staging, validate schema changes, test rollback
  - T054 [SYS] Phase 2: Deploy backend (License Service + API endpoints), validate endpoints with smoke tests
  - T055 [SYS] Phase 3: Deploy middleware (License Enforcement), validate status routing works, soft-lock enforcement active
  - T056 [SYS] Phase 4: Deploy MMC UI, enable feature flag, monitor error rates and latency
- **Acceptance Criteria**: Each phase completes validation gate before next phase, rollback plan tested, monitoring alerts active
- **Estimated Hours**: 12 hours total (includes validation gates and monitoring)
- **Parallelizable**: No (sequential phases)

---

## Critical Path Analysis

**Longest Sequential Path** (determines minimum timeline):

```
T001 (Schema creation)
  → T006 (License Service core methods)
  → T016 (API endpoints)
  → T025 (Middleware enhancement)
  → T028 (Worker jobs)
  → T034 (Audit logging)
  → T037 (MMC UI) (or parallel T041 testing)
  → T051 (Documentation)
  → T053 (4-phase deployment)
```

**Critical path length**: ~20 milestones, estimated 5 weeks with continuous implementation.

---

## Parallelization Opportunities

### Opportunity 1: 4 Concurrent Service Methods (After T005 Schema)

- Developers 1–4 work on T006–T009 in parallel (transitionToSoftLock, transitionToActive, transitionToArchived, restoreFromArchive) — 8 hours each

### Opportunity 2: 3 Concurrent API Endpoint Groups (After T012 State Machine)

- Group A (Dev 1): T016–T017 (soft-lock, renew) — 8 hours
- Group B (Dev 2): T018–T019 (archive, restore) — 8 hours
- Group C (Dev 3): T022–T024 (get, audit trail, job status) — 8 hours
- **Time saved**: ~40% vs sequential

### Opportunity 3: Worker & Middleware Parallel (After T024 API)

- Dev 1–2: T028–T030 (3 worker jobs) — 12 hours
- Dev 3: T025–T027 (middleware) — 12 hours
- **Execution**: Parallel, but middleware needs T025 first

### Opportunity 4: Testing Teams (After T024 API)

- QA Team 1: T041–T043 (unit + integration tests) — 16 hours
- QA Team 2: T045–T046 (API tests) — 8 hours
- **Execution**: Parallel, all independent

### Opportunity 5: MMC UI & Documentation (After T033 Jobs)

- Dev 1–2: T037–T040 (UI components) — 16 hours
- Dev 3: T051–T052 (API docs + runbook) — 6 hours
- **Execution**: Parallel, both independent

---

## Estimates & Buffers

| Phase        | Sequential Hours | Parallel Hours (4 devs)          | Buffer (20%)   |
| ------------ | ---------------- | -------------------------------- | -------------- |
| 1 Schema     | 8                | 8                                | 1.6            |
| 2 Service    | 40               | 12                               | 2.4            |
| 3 API        | 36               | 12                               | 2.2            |
| 4 Middleware | 12               | 12                               | 2.4            |
| 5 Workers    | 24               | 12                               | 2.4            |
| 6 Audit      | 8                | 8                                | 1.6            |
| 7 UI         | 16               | 8                                | 1.6            |
| 8 Testing    | 40               | 12                               | 2.4            |
| 9 Docs       | 6                | 3                                | 0.6            |
| 10 Deploy    | 12               | 12                               | 2.4            |
| **TOTAL**    | **202 hours**    | **97 hours** (w/parallelization) | **19.6 hours** |

**Timeline**:

- **Sequential (1 dev)**: ~5 weeks
- **Parallel (4 devs, optimized)**: ~3 weeks
- **With 20% buffer**: ~3.5–6 weeks depending on team size and parallelization

---

## File Locations (All 55 Tasks)

📄 **Tasks File**: `specs/runtime/011-license-lifecycle/tasks.md` (780 lines)

Each task references exact file path:

- `packages/domain-core/src/license/service.ts` — License Service implementation
- `packages/domain-core/src/license/validator.ts` — State machine validation
- `apps/api/src/routes/licenses.ts` — API endpoints
- `apps/api/src/middleware/license-enforcement.ts` — Middleware
- `apps/worker/src/handlers/snapshot-create.ts` — Worker jobs
- `apps/worker/src/handlers/restore-from-archive.ts`
- `apps/worker/src/handlers/delete-license.ts`
- `packages/domain-core/src/audit/audit-logger.ts` — Audit logging
- `apps/mmc/src/pages/LicenseDetail.vue` — MMC UI components
- `tests/unit/license-*.test.ts` — All test files
- `docs/deployment/LICENSE_LIFECYCLE_RUNBOOK.md` — Deployment docs

---

## Next Steps

Proceed to Step 5 — Analyze (drift detection and multi-guardian validation):

- **Structural Audit** — verify spec/plan/tasks alignment
- **Architecture Guardian** (re-validate) — ensure no drift from Step 3A
- **Security Guardian** — idempotency replay protection, deletion safeguards
- **Performance Guardian** — verify SLA assumptions, worker throughput
- **QA Guardian** — test coverage gaps, edge case coverage

All validations must return `VERDICT: PASS` before implementation authorization in Step 6.
