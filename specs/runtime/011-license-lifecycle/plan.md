# Implementation Plan: License Lifecycle Operations

**Stage**: STAGE 11 – License Lifecycle Operations  
**Phase**: 02 – Platform MMC  
**Created**: 2026-02-24  
**Status**: READY FOR IMPLEMENTATION

---

## Executive Summary

This plan provides a complete blueprint for implementing the four-state license lifecycle model (ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED) with middleware enforcement, worker-based async operations, immutable audit trails, and MMC UI controls. The implementation preserves database-per-tenant isolation while implementing deterministic, transactional state transitions enforced at the Tenant Resolver middleware layer.

**Key Design Principles**:

- Isolation over convenience (database-per-tenant model preserved)
- Determinism over magic (no async surprises, middleware enforces on every request)
- Immutability after transition (audit logs never edited, snapshots never modified once created)
- Idempotency (restore/snapshot operations safe to retry)
- Zero data loss (snapshots preserve all data, restore is all-or-nothing)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Key Design Decisions](#key-design-decisions)
3. [Implementation Layers](#implementation-layers)
4. [Database Schema Changes](#database-schema-changes)
5. [Error Handling Strategy](#error-handling-strategy)
6. [API Endpoints](#api-endpoints)
7. [Middleware Integration](#middleware-integration)
8. [Worker Jobs](#worker-jobs)
9. [MMC UI Components](#mmc-ui-components)
10. [Testing Strategy](#testing-strategy)
11. [Deployment & Rollback](#deployment--rollback)

---

## Architecture Overview

### Four-State Model

```
┌────────────────────────────────────────────────────────────────┐
│                    LICENSE LIFECYCLE                            │
└────────────────────────────────────────────────────────────────┘

ACTIVE ──[Soft Lock]──> SOFT_LOCKED ──[Auto-expire/Manual Archive]──> ARCHIVED ──[Delete Confirmed]──> DELETED
   ▲                       │                                            │
   │                       │                                            │
   └───────[Renew]─────────┘                                            │
                                                                        │
                                 ┌──────────────[Restore]──────────────┘
                                 │
                                 └────────────> ACTIVE

States:
  ACTIVE       - Normal operation, full access
  SOFT_LOCKED  - Grace period (90 days), blocked access, recoverable
  ARCHIVED     - Snapshot-backed preservation, no access, restorable
  DELETED      - Terminal state, workspace dropped, non-recoverable
```

### Trust Chain Enforcement

```
┌──────────────────────────────────────────────────────────────┐
│                    REQUEST PROCESSING                        │
└──────────────────────────────────────────────────────────────┘

1. Correlation ID Middleware
   └─> Inject correlation_id into ctx

2. Tenant Resolver Middleware
   └─> Resolve workspace_slug → workspace_id
   └─> Establish per-tenant connection pool

3. License Enforcement Middleware ← THIS STAGE
   ├─ Get license status (from tenants_registry or licenses table)
   ├─ If SOFT_LOCKED: Check expiry
   │  └─ If now() > soft_lock_until: Auto-transition to ARCHIVED
   ├─ Switch on status:
   │  ├─ ACTIVE → proceed to handler (200)
   │  ├─ SOFT_LOCKED → return 423 (Locked) + Retry-After header
   │  ├─ ARCHIVED → return 403 (Forbidden)
   │  └─ DELETED → return 404 (Not Found)

4. Schema Version Middleware
   └─ Validate schema_version compatibility

5. Route Handler
   └─ Business logic (only reached if license = ACTIVE)
```

### Data Isolation Model

```
┌──────────────────────────────────────────────────────────────┐
│              DATABASE ISOLATION ARCHITECTURE                  │
└──────────────────────────────────────────────────────────────┘

Master Database (PostgreSQL)
├─ licenses (status, soft_lock_until, archived_at, deleted_at)
├─ snapshots (snapshot metadata, S3 paths)
├─ license_audit_logs (immutable state transitions)
├─ license_deletion_confirmations (deletion tracking)
├─ tenants_registry (denormalized for quick lookup)
└─ mmc_users (admin users, roles)

Per-Tenant Database (PostgreSQL)
├─ workspaces (workspace config)
├─ users (students, staff)
├─ attempts (exam attempts)
├─ questions (exam questions)
└─ ... (all other tenant data)

Snapshot Storage (S3)
└─ s3://snapshots/{license_id}/{timestamp}.tar.gz
   (One per license, deleted with license)

Key Constraint: No CROSS-TENANT queries, no SHARED tables
```

---

## Key Design Decisions

### Decision 1: Deterministic Middleware-Driven Expiry (vs. Cron-Based)

**Choice**: Middleware checks and transitions on every request

**Rationale**:

- ✓ No external job dependencies
- ✓ Deterministic (every request checks)
- ✓ Immediate effect (next request sees ARCHIVED)
- ✓ Matches Zidney principle: "Determinism over magic"

**Implementation**:

```python
if license.status == 'SOFT_LOCKED' and now() > license.soft_lock_until:
  # Atomically transition in SELECT FOR UPDATE transaction
  transition_to_archived(license_id)
```

### Decision 2: Snapshot Location Determinism (vs. Configurable)

**Choice**: `s3://snapshots/{license_id}/{timestamp}.tar.gz` (immutable path)

**Rationale**:

- ✓ Auditable, reproducible paths
- ✓ No path injection attacks
- ✓ Enables worker recovery without configuration lookups
- ✓ Prevents misconfiguration risks

**Implementation**:

```python
snapshot_path = f"s3://snapshots/{license_id}/{timestamp.isoformat()}.tar.gz"
# Never changes, never overridden
```

### Decision 3: Audit Logs Manual Purge (vs. Auto-Delete)

**Choice**: Manual purge only by elevated MMC role

**Rationale**:

- ✓ Preserves compliance trail
- ✓ Prevents accidental deletion
- ✓ Aligns with immutability guarantee
- ✓ Legal hold capable

**Implementation**:

```python
# Purge requires explicit authorization + confirmation
@requires_role('LEGAL_COMPLIANCE')
def purge_audit_logs(license_id, hold_id=None):
  if hold_id:
    raise ComplianceHoldError('Purge blocked by legal hold')
  delete_audit_logs(license_id)
```

### Decision 4: Worker Retry with Alert (vs. Silent Retry/Fail-Open)

**Choice**: 3 retries with exponential backoff, then CRITICAL alert

**Rationale**:

- ✓ Handles transient failures
- ✓ Observable failures (not silent)
- ✓ Admin can intervene or trigger manual recovery
- ✓ DLQ pattern (failed jobs observable)

**Implementation**:

```python
max_retries = 3
retry_delays = [1, 2, 4]  # seconds (exponential)

for attempt in range(max_retries):
  try:
    snapshot_create(job)
    return success()
  except Exception as e:
    if attempt < max_retries - 1:
      schedule_retry(delay=retry_delays[attempt])
    else:
      alert_critical('Snapshot creation failed after 3 retries', job)
      mark_snapshot_failed(e)
```

### Decision 5: Admin-Only Deletion with 2FA & Confirmation (vs. Single Auth)

**Choice**: Admin role + 2FA re-auth + random confirmation phrase

**Rationale**:

- ✓ Non-reversible operation requires maximum friction
- ✓ No developer backdoor in production
- ✓ Audit trail captures full deletion process
- ✓ Prevents accidental deletion via API

**Implementation**:

```python
# Step 1: Initiate
DELETE /licenses/{id}/delete/initiate
→ Returns random confirmation_phrase valid 5 minutes

# Step 2: Confirm
DELETE /licenses/{id}/delete/confirm
{confirmation_phrase, confirmation_id}
→ Requires fresh 2FA token verified within 5 minutes
→ Phrase must be exact match (case-sensitive)
```

### Decision 6: Asynchronous Restore with SLA (vs. Synchronous)

**Choice**: Background job with size-based SLA, async progress tracking

**Rationale**:

- ✓ Large restores (>5GB) won't timeout HTTP request
- ✓ Observable progress (ETA in UI)
- ✓ Atomic restore (all-or-nothing)
- ✓ Matches worker-based architecture

**SLA**:

- Small (<1GB): ≤ 5 minutes
- Medium (1–5GB): ≤ 15 minutes
- Large (>5GB): ≤ 30 minutes
- Hard timeout: 2× SLA + 5 minutes

---

## Implementation Layers

### Layer 1: Domain Service (Business Logic)

**Location**: `packages/domain-core/src/license/`

**Responsibilities**:

- Enforce state machine (valid transitions only)
- Execute transactional state changes
- Create audit log entries
- Validate inputs (no side effects, pure logic)

**Core Methods**:

```typescript
transitionToSoftLock(licenseId, reason, actorId)
transitionToActive(licenseId, reason, actorId)
transitionToArchived(licenseId, snapshotId, reason, actorId)
restoreFromArchive(licenseId, actorId)
transitionToDeleted(licenseId, confirmationHash, actorId)
```

**Error Types**:

- StateTransitionError (400)
- LicenseNotFoundError (404)
- SnapshotFailedError (400)
- SchemaCompatibilityError (426)
- DatabaseError (500)

### Layer 2: API Routes (REST Interface)

**Location**: `apps/api/src/routes/licenses.ts`

**Endpoints**:

```
POST /licenses/{id}/soft-lock          → 200/400
POST /licenses/{id}/renew              → 200/400
POST /licenses/{id}/archive            → 202/400
POST /licenses/{id}/restore            → 202/400
POST /licenses/{id}/delete/initiate    → 200/401/403
POST /licenses/{id}/delete/confirm     → 202/400/403
GET  /licenses/{id}                    → 200/404
GET  /licenses/{id}/audit-trail        → 200/404
GET  /licenses/{id}/job-status/{jobId} → 200/404/410
```

**Request Flow**:

1. Validate authentication (session required)
2. Validate authorization (admin role for transitions)
3. Parse + validate request body
4. Call License Service (domain layer)
5. Return standard envelope {success, data, error}

### Layer 3: Middleware (Access Control)

**Location**: `apps/api/src/middleware/license-enforcement.ts`

**Execution Point**: 3rd in stack (after tenant-resolver, before schema-version)

**Responsibilities**:

- Get license status (query or cache)
- Check for soft-lock expiry (auto-transition)
- Return appropriate HTTP status per state
- Block DB access for non-ACTIVE licenses

**Status Responses**:

- ACTIVE → 200 (proceed)
- SOFT_LOCKED → 423 (locked, Retry-After header)
- ARCHIVED → 403 (forbidden)
- DELETED → 404 (not found)

### Layer 4: Worker Jobs (Async Operations)

**Location**: `apps/worker/src/jobs/`

**Job Types**:

1. `snapshot_create` - Capture DB snapshot on archival
2. `restore_from_archive` - Restore DB from snapshot
3. `delete_license` - Drop tenant DB + cleanup
4. `soft_lock_expiry_transition` (optional) - Background expiry check

**Job Queue**: Redis-based FIFO with retry logic

**Execution**:

- Dequeue from typed queue (snapshot_create, restore_from_archive, etc.)
- Execute with idempotency checks
- On failure: Retry with exponential backoff (3 times)
- On persistent failure: Alert admin, mark job FAILED

### Layer 5: Audit Logging (Compliance)

**Location**: `packages/domain-core/src/logging/`

**Components**:

- Structured JSON logging (Pino-based)
- Immutable audit log records (license_audit_logs table)
- Correlation ID propagation
- Actor tracking (user_id, actor_type)

**Logged Events**:

```json
{
  "event": "license_transition",
  "license_id": "uuid",
  "workspace_slug": "acme-corp",
  "previous_status": "ACTIVE",
  "new_status": "SOFT_LOCKED",
  "actor_id": "uuid",
  "actor_type": "ADMIN",
  "reason": "Payment failed",
  "timestamp": "2026-02-24T10:30:00Z",
  "correlation_id": "uuid"
}
```

### Layer 6: MMC UI (Admin Interface)

**Location**: `apps/mmc/src/components/`

**Components**:

- License Detail Page (status display, countdown, actions)
- License List (table with filterable status column)
- Deletion Confirmation Dialog (confirmation phrase input)
- Job Status Monitor (snapshot/restore progress)
- Audit Trail Viewer (timeline of transitions)

**Frameworks**: Vue 3 + shadcn-vue + Tailwind v4

---

## Database Schema Changes

### Schema Extension Summary

| Table                          | Action | Columns                                                       | Purpose                           |
| ------------------------------ | ------ | ------------------------------------------------------------- | --------------------------------- |
| licenses                       | EXTEND | soft_lock_until, archived_at, deleted_at, current_snapshot_id | Track state transition timestamps |
| snapshots                      | CREATE | All columns                                                   | Store snapshot metadata           |
| license_audit_logs             | CREATE | All columns                                                   | Immutable audit trail             |
| license_deletion_confirmations | CREATE | All columns                                                   | Double-confirmation tracking      |
| tenants_registry               | EXTEND | license_status, license_id, sync_status                       | Quick license lookup              |

### Migration List (Forward-Only)

**Migration A001**: Extend licenses table

```sql
ALTER TABLE licenses ADD COLUMN soft_lock_until TIMESTAMP NULL;
ALTER TABLE licenses ADD COLUMN archived_at TIMESTAMP NULL;
ALTER TABLE licenses ADD COLUMN deleted_at TIMESTAMP NULL;
ALTER TABLE licenses ADD COLUMN current_snapshot_id UUID NULL;
-- Add constraints and indexes
```

**Migration A002**: Create snapshots table

```sql
CREATE TABLE snapshots (
  id UUID PRIMARY KEY,
  license_id UUID NOT NULL REFERENCES licenses(id),
  -- ... other columns
);
```

**Migration A003**: Create license_audit_logs table

```sql
CREATE TABLE license_audit_logs (
  id UUID PRIMARY KEY,
  license_id UUID NOT NULL REFERENCES licenses(id),
  -- ... other columns
);
```

**Migration A004**: Create license_deletion_confirmations table

```sql
CREATE TABLE license_deletion_confirmations (
  id UUID PRIMARY KEY,
  license_id UUID NOT NULL,
  -- ... other columns
);
```

**Migration A005**: Extend tenants_registry table

```sql
ALTER TABLE tenants_registry ADD COLUMN license_status VARCHAR(20);
ALTER TABLE tenants_registry ADD COLUMN license_id UUID;
-- Add indexes
```

---

## Error Handling Strategy

### Error Classification

#### Validation Errors (4xx)

| Error                    | HTTP | Cause                        | Action                      |
| ------------------------ | ---- | ---------------------------- | --------------------------- |
| StateTransitionError     | 400  | Invalid state transition     | Return descriptive error    |
| InvalidConfirmationError | 403  | Confirmation phrase mismatch | Return 403 Forbidden        |
| ConfirmationExpiredError | 410  | Confirmation >5 min old      | Return 410 Gone             |
| SchemaCompatibilityError | 426  | Snapshot outdated            | Return 426 Upgrade Required |

#### Resource Errors (4xx)

| Error                 | HTTP | Cause                    | Action     |
| --------------------- | ---- | ------------------------ | ---------- |
| LicenseNotFoundError  | 404  | License doesn't exist    | Return 404 |
| SnapshotNotFoundError | 404  | Snapshot doesn't exist   | Return 404 |
| SnapshotFailedError   | 400  | Snapshot.status = FAILED | Return 400 |

#### Operational Errors (5xx)

| Error               | HTTP | Cause                             | Action                    |
| ------------------- | ---- | --------------------------------- | ------------------------- |
| DatabaseError       | 500  | Transaction failed                | Log, alert, return 500    |
| ProvisioningError   | 503  | Storage/provisioning service down | Return 503, retry job     |
| RestoreTimeoutError | 504  | Restore exceeded 2×SLA            | Return 504, keep ARCHIVED |

### Error Response Format

```typescript
{
  success: false,
  data: null,
  error: {
    code: "STATE_TRANSITION_ERROR",
    message: "Cannot soft lock a license that is not ACTIVE. Current state: SOFT_LOCKED"
  }
}
```

### Error Recovery

**Soft Lock Failure**: Retry manually (idempotent)
**Archive Failure**: Admin retries via UI (snapshot job retries)
**Restore Failure**: Workspace remains ARCHIVED, admin retries
**Deletion Failure**: Alert ops, manual recovery (grace period safeguard)

---

## API Endpoints

### Summary Table

| Method | Route                             | Status  | Async | Auth      |
| ------ | --------------------------------- | ------- | ----- | --------- |
| POST   | /licenses/{id}/soft-lock          | 200/400 | No    | Admin     |
| POST   | /licenses/{id}/renew              | 200/400 | No    | Admin     |
| POST   | /licenses/{id}/archive            | 202/400 | Yes   | Admin     |
| POST   | /licenses/{id}/restore            | 202/400 | Yes   | Admin     |
| POST   | /licenses/{id}/delete/initiate    | 200/401 | No    | Admin+2FA |
| POST   | /licenses/{id}/delete/confirm     | 202/400 | Yes   | Admin+2FA |
| GET    | /licenses/{id}                    | 200/404 | No    | Optional  |
| GET    | /licenses/{id}/audit-trail        | 200/404 | No    | Admin     |
| GET    | /licenses/{id}/job-status/{jobId} | 200/404 | No    | Optional  |

### Detailed Specifications

See [API Endpoints Contract](contracts/api-endpoints.md) for full request/response specifications.

---

## Middleware Integration

### Execution Stack (Unchanged)

```
1. correlationIdMiddleware
2. tenantResolverMiddleware        ← Establishes workspace context
3. licenseEnforcementMiddleware    ← THIS STAGE (enforces status)
4. schemaVersionMiddleware
5. routeHandler
```

### License Enforcement Logic

```typescript
async function licenseEnforcementMiddleware(ctx: Context, next: Next) {
  const workspace_slug = ctx.get('workspace_slug')

  // Get license status (< 1ms)
  const license = await getLicenseStatus(workspace_slug)

  // Check for auto-expiry if SOFT_LOCKED
  if (license.status === 'SOFT_LOCKED' && now() > license.soft_lock_until) {
    await transitionToArchivedAtomic(license.id)
    license.status = 'ARCHIVED'
  }

  // Route based on status
  switch (license.status) {
    case 'ACTIVE':
      ctx.set('license_valid', true)
      return await next()

    case 'SOFT_LOCKED':
      return ctx.json({
        success: false,
        data: null,
        error: {
          code: 'LICENSE_SOFT_LOCKED',
          message: 'License soft locked, expires in ' + ...
        }
      }, {
        status: 423,
        headers: { 'Retry-After': String(...) }
      })

    case 'ARCHIVED':
      return ctx.json({
        success: false, data: null,
        error: { code: 'LICENSE_ARCHIVED', message: '...' }
      }, { status: 403 })

    case 'DELETED':
      return ctx.json({
        success: false, data: null,
        error: { code: 'LICENSE_DELETED', message: '...' }
      }, { status: 404 })
  }
}
```

### Performance Optimization

- **Cache**: License status cached in tenants_registry (synced hourly)
- **Index**: `licenses(soft_lock_until) WHERE status='SOFT_LOCKED'` for expiry check
- **Fallback**: If registry stale, query licenses directly (consistent state)
- **Overhead**: < 1ms target (single index lookup + switch)

---

## Worker Jobs

### Job Type 1: snapshot_create

**Trigger**: Manual archive action from MMC
**Queue**: `queue:snapshot_create`
**Max Retries**: 3 (1s → 2s → 4s backoff)

**Steps**:

1. Connect to tenant database (read-only)
2. Execute pg_dump, stream to S3
3. Calculate checksum, record snapshot metadata
4. Mark snapshot status = CREATED
5. Return snapshot_id to caller

**SLA**: 10 minutes (size-dependent)
**Failure**: Mark FAILED, alert admin, license remains SOFT_LOCKED

See [Worker Jobs Contract](contracts/worker-jobs.md) for full spec.

### Job Type 2: restore_from_archive

**Trigger**: Manual restore action from MMC
**Queue**: `queue:restore_from_archive`
**Max Retries**: 3

**Steps**:

1. Download snapshot from S3
2. Validate schema compatibility
3. Drop existing tenant DB
4. Restore from snapshot
5. Run forward migrations (if needed)
6. Update license: status = ACTIVE

**SLA**: Size-based (5/15/30 minutes)
**Failure**: Keep ARCHIVED, preserve snapshot, alert admin

### Job Type 3: delete_license

**Trigger**: Confirmed deletion from MMC
**Queue**: `queue:delete_license`
**Max Retries**: 2 (only 2 for deletion, terminal operation)

**Steps** (Transaction):

1. Drop tenant database
2. Delete snapshot from S3
3. Remove tenant registry entry
4. Update license: status = DELETED
5. Create deletion audit log entry

**SLA**: 15 minutes
**Failure**: Alert ops, manual recovery, grace period safeguard

### Job Type 4: soft_lock_expiry_transition (Optional)

**Trigger**: Scheduled job (hourly, optional optimization)
**Purpose**: Proactively transition expired soft locks

**Note**: Middleware also performs this on-demand, so this job is optional.

---

## MMC UI Components

### 1. License Detail Page

**Route**: `/licenses/{licenseId}`

**Display Elements** (by status):

**ACTIVE**:

- ✓ Status badge (green): "Active"
- Button: "Soft Lock" (grey, inactive if no admin role)
- User count: {N} students, {M} staff
- Storage: {X}GB used

**SOFT_LOCKED**:

- 🟡 Status badge (yellow): "Soft Locked"
- Countdown: "Expires in {D} days {H} hours {M} minutes"
- Buttons: "Renew", "Archive"
- Last action: "Soft locked by {actor} on {date} for {reason}"

**ARCHIVED**:

- 🔴 Status badge (red): "Archived"
- Archived at: "{timestamp}"
- Snapshot: "Available ({size}GB)"
- Last action: "Archived by {actor} on {date}"
- Buttons: "Restore", "Permanently Delete"

**DELETED**:

- ⚫ Status badge (grey): "Permanently Deleted"
- Deleted at: "{timestamp}"
- Message: "This workspace has been permanently deleted."
- Audit Trail: Full history shown

**Audit Trail Section** (all states):

- Timeline of all transitions
- Actor, timestamp, reason, status changes
- Filterable by date range

**Job Status Monitor** (during async ops):

- Progress bar (0–100%)
- ETA countdown
- Current step (e.g., "Downloading snapshot...")
- Pause/cancel buttons (if applicable)

### 2. License List Page

**Route**: `/licenses`

**Table Columns**:

- Workspace Name (slug)
- Status (with color badge)
- Last Modified
- User Count
- Storage
- Actions (view detail, quick actions)

**Filters**:

- Status (ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED)
- Date range (created, modified)
- User count range
- Organization

### 3. Deletion Confirmation Dialog

**Trigger**: Click "Permanently Delete" button

**Steps**:

1. Display warning: "Are you sure? This cannot be undone."
2. Display confirmation phrase: "Type CONFIRM_DELETE_ABC123 to proceed"
3. Input field for phrase (copy-paste encouraged)
4. "Delete" button (disabled until phrase matches)
5. On submit: Require 2FA verification

**On Completion**:

- Show "Deletion in progress" message
- Display job status
- Redirect to licenses list on completion

### 4. Audit Trail Viewer

**Route**: `/licenses/{licenseId}/audit`

**Display**:

- Timeline (vertical)
  - Each transition shown with timestamp
  - Actor (user name or "System")
  - Previous & new status
  - Reason
  - Metadata (if applicable)
- Export button (CSV/JSON)
- Filter by date, actor type

---

## Testing Strategy

### Unit Tests

**Location**: `packages/domain-core/src/license/__tests__/`

**Test Suites**:

1. **State Machine** (`state-machine.test.ts`)
   - Valid transitions allowed
   - Invalid transitions rejected
   - Concurrent access handled

2. **Service Methods** (`service.test.ts`)
   - transitionToSoftLock: ACTIVE → SOFT_LOCKED
   - transitionToActive: SOFT_LOCKED → ACTIVE
   - transitionToArchived: SOFT_LOCKED → ARCHIVED
   - restoreFromArchive: ARCHIVED → ACTIVE (idempotent)
   - transitionToDeleted: ARCHIVED → DELETED

3. **Validation** (`validation.test.ts`)
   - Confirmation phrase validation
   - Schema compatibility check
   - Soft lock expiry calculation (exactly 90 days)

### Integration Tests

**Location**: `tests/integration/license-lifecycle.test.ts`

**Scenarios**:

1. Full Flow: ACTIVE → SOFT_LOCKED → ARCHIVED → DELETED
2. Renewal: SOFT_LOCKED → ACTIVE
3. Restore: ARCHIVED → ACTIVE (verify data integrity)
4. Auto-expiry: SOFT_LOCKED with past expiry → ARCHIVED (via middleware)
5. Concurrent Transitions: Two simultaneous requests (one succeeds, one fails)

### API Tests

**Location**: `tests/integration/api/licenses.test.ts`

**Test Cases**:

1. POST /licenses/{id}/soft-lock
   - 200 OK for ACTIVE license
   - 400 error for non-ACTIVE license
   - Audit log created

2. POST /licenses/{id}/archive
   - 202 Accepted (async)
   - Snapshot created
   - License transitioned

3. POST /licenses/{id}/delete/confirm
   - 403 if confirmation phrase mismatch
   - 202 if correct
   - Deletion job enqueued

### Worker Tests

**Location**: `apps/worker/src/jobs/__tests__/`

**Test Cases**:

1. snapshot_create
   - Database snapshot captured
   - S3 upload successful
   - Metadata recorded

2. restore_from_archive
   - Snapshot downloaded
   - Database restored
   - Data integrity validated

3. delete_license
   - Tenant DB dropped
   - Snapshot deleted
   - Registry cleaned

### Snapshot Tests

**Location**: `tests/snapshot/`

**Purpose**: Verify data integrity during archive/restore

**Approach**:

- Archive workspace with known data (students, attempts, questions)
- Restore from snapshot
- Verify: row counts, checksums, data unchanged

### Load Tests

**Location**: `tests/load/`

**Scenarios**:

1. Middleware overhead: 1000 concurrent requests, verify < 1ms per license check

2. Snapshot creation: Large workspace (100GB+), measure time, verify SLA

3. Restore operation: Multiple concurrent restores, verify no data corruption

---

## Deployment & Rollback

### Pre-Deployment Checklist

- [ ] All unit tests passing (100% coverage for state machine)
- [ ] All integration tests passing
- [ ] API tests passing
- [ ] Worker tests passing
- [ ] Load tests passing (< 1ms middleware, SLAs met)
- [ ] Code review completed
- [ ] Schema migration validated in staging
- [ ] MMC UI tested in staging
- [ ] Documentation updated
- [ ] Incident runbooks prepared

### Deployment Steps

1. **Phase 1**: Running Migrations
   - Run Migration A001–A005 in sequence
   - Verify migrations complete (check schema)
   - Backfill tenants_registry with license_status (sync job)

2. **Phase 2**: Deploy Backend Services
   - Deploy License Service updates (`packages/domain-core`)
   - Deploy API routes (`apps/api`)
   - Deploy Worker jobs (`apps/worker`)
   - Verify services healthy

3. **Phase 3**: Activate Middleware
   - Deploy License Enforcement Middleware
   - Verify < 1ms overhead
   - Monitor error rate (should be 0% for ACTIVE licenses)

4. **Phase 4**: Deploy MMC UI
   - Deploy license management components
   - Test deletion flow in production

### Rollback Plan

**If Issues Detected During Phase 1–2**:

- Rollback migrations using snapshot restore (if needed)
- Redeploy previous service versions
- Notify stakeholders

**If Issues Detected After Phase 3 (Middleware Active)**:

- Disable license enforcement middleware (temporary)
- Investigate root cause
- Redeploy with fix

**If Critical Data Loss**:

- Restore database from backup
- Restore tenant databases from snapshots
- Contact affected institutions

### Monitoring & Alerting

**Key Metrics**:

- License status distribution (% ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED)
- Middleware latency (p50, p95, p99 < 1ms)
- API endpoint latency
- Job completion rates (snapshot, restore, delete)
- Error rates by type

**Alerts**:

- Soft-locked licenses nearing expiry (> 80 days)
- Snapshot creation failures (FAILED status)
- Middleware latency > 5ms
- Restore job failures
- Deletion job failures

---

## Implementation Timeline (Estimated)

| Week  | Task                                    | Owner    | Status |
| ----- | --------------------------------------- | -------- | ------ |
| W1    | Database migrations test/validate       | DB Team  | -      |
| W2    | License Service implementation          | Backend  | -      |
| W2–W3 | Unit tests (state machine)              | Backend  | -      |
| W3    | API routes implementation               | Backend  | -      |
| W3    | Middleware integration                  | Backend  | -      |
| W3–W4 | Worker jobs (snapshot, restore, delete) | Backend  | -      |
| W4    | Integration tests                       | QA       | -      |
| W4    | Load testing                            | DevOps   | -      |
| W4    | MMC UI components                       | Frontend | -      |
| W5    | Staging deployment                      | DevOps   | -      |
| W5    | Production deployment                   | DevOps   | -      |

---

## Risk Mitigation

### Risk 1: Large Snapshot Failures

**Risk**: Snapshot > SLA, timeout, snapshot FAILED

**Mitigation**:

- Size-based SLA (not one-size-fits-all)
- Worker retry with exponential backoff
- Admin can manually trigger retry
- Snapshot remains restorable once CREATED

### Risk 2: Concurrent State Transitions

**Risk**: Two admins attempt different transitions simultaneously

**Mitigation**:

- SELECT FOR UPDATE prevents race conditions
- SERIALIZABLE isolation level
- One succeeds, other fails with descriptive error
- Audit log records both attempts

---

## Security Specifications

### Rate-Limit Bypass Tier

**Definition**:

- MMC Admin users may bypass per-user rate limits (1 req/sec standard → unlimited for admins)
- **Enforcement**: Check user.roles contains 'admin' (from JWT, never from request body)
- **Logging**: Every bypass logged with X-Admin-Bypass: true response header and actor_id in audit log
- **Non-Compliance**: Non-admin user cannot obtain bypass; privilege escalation attempt logged and alerted

### Cross-Workspace Authorization Validation

**Definition**:

- MMC Admin must have explicit workspace association (mmc_users.workspace_id)
- All admin lifecycle operations validated: admin.workspace_id == license.workspace_id
- **Enforcement**: Middleware checks before route; mismatch returns 403 Forbidden with error code ADMIN_WORKSPACE_MISMATCH
- **JWT Constraint**: JWT tokens for lifecycle operations must NOT include workspace override parameter
- **Audit**: Every admin transition includes admin.workspace_id in license_audit_logs for compliance

### 2FA Freshness Validation

**Definition**:

- 2FA re-authentication required within 5-minute window for delete/confirm operations
- **Enforcement**: After user completes 2FA, set session flag two_fa_verified_at = now(); generate 2fa_verification_id = UUID (one-time use)
- **Middleware Check**: On delete/confirm endpoint: verify (now() - session.two_fa_verified_at) <= 5 minutes; if older return 401 Unauthorized (2FA_SESSION_EXPIRED)
- **Error Codes**: 2FA_NOT_VERIFIED (401), 2FA_SESSION_EXPIRED (401) included in response

### Worker Snapshot S3 Upload Authentication

**Definition**:

- Worker uses IAM role (not static S3 keys) for all S3 operations
- **Bucket Policy**: Scoped to prefix snapshots/{license_id}/\* (no cross-license access)
- **Encryption**: KMS encryption enforced on all snapshot objects (not plaintext)
- **Pre-signed URLs**: API never generates S3 pre-signed URLs; worker only authenticated path
- **Audit**: S3 access logged via CloudTrail; snapshot uploads traced by correlation_id

---

## Performance Specifications

### Connection Pool Configuration

**Definition**:

- API instance: max 20 connections per tenant pool
- Worker instance: max 10 connections per tenant pool
- Per-instance cap (horizontal scaling via load balancer, not connection pooling expansion)
- Connection timeout: 5 seconds; exceeded connections fail fast with POOL_EXHAUSTION error

### Lock Contention Mitigation

**Definition**:

- SELECT FOR UPDATE enforced for all state transitions (serialization acceptable for rare events)
- Projected peak: 100 concurrent soft-lock renewals per second during grace period
- **SLA**: p95 latency < 10ms (under high contention); p50 < 1ms (normal load)
- **Lock Timeout**: 30-second max lock hold; exceeded locks aborted to prevent deadlock
- **Index**: Partial index on (license_id, status) WHERE status IN ('SOFT_LOCKED', 'ACTIVE') optimizes lock acquisition

### Idempotency State Management

**Definition**:

- Idempotency-Key deduplication stored in Redis (not in-memory per API instance)
- **Redis TTL**: 24 hours post-operation completion
- **Composite Key**: {license_id}:{operation_type}:{idempotency_key} prevents cross-license collisions
- **Fallback**: If Redis unavailable, fall back to database unique constraint on (license_id, idempotency_key, created_at)
- **Success Response**: First request executes; subsequent identical requests return cached response within TTL window

### Prepared Statement Caching

**Definition**:

- All parameterized queries cached at connection pool level (not recreated per request)
- Bun SQLite connection pool caches prepared statements automatically
- Database driver (node-postgres) maintains statement cache in connection pool
- **Result**: Zero re-parse overhead for repeated state transition queries

---

## CI/CD Pipeline Specifications

### Migration Safety Enforcement

**Automation Required**:

- ❌ **Prevent modification of existing migration files**: Hash check on A001-A005; any UPDATE to existing migration fails CI
- ❌ **Detect duplicate migration IDs**: If new migration named A001 committed, CI rejects (only forward migrations allowed: A006, A007, etc.)
- ❌ **Forward-only validation**: Automated script scans migration files, rejects destructive operations (DROP TABLE, DELETE FROM, ALTER... DROP COLUMN)
- ✅ **Transaction safety**: All migrations wrapped in PostgreSQL transaction; rollback on failure

### Structured Logging in Pipeline

**Automation Required**:

- All pipeline events (lint, test, migration, deploy) emit structured JSON logs with:
  - timestamp (ISO-8601), level (INFO|WARN|ERROR), service (zidney-ci)
  - stage (lint|test|migration|deploy), correlation_id (UUID), event (migration_start|test_pass|deploy_phase_2)
  - metadata: migration_id, duration_ms, schema_version_before/after, rows_affected, rows_affected
- **No console.log in production code**: CI check rejects any console.log (use structured logger only)
- **Correlation ID propagation**: All pipeline stages inherit correlation_id from initial workflow trigger

### T053 Deployment Validation Implementation

**Explicit Tasks**:

- T053a: Validate migration test-run on 500k+ license records (snapshot audit_logs table scale test)
- T053b: Verify no schema incompatibilities with current product version
- T053c: Cross-tenant isolation smoke test (create 3 test licenses, verify isolation)
- T053d: Backup creation + restore test on staging before production deploy

---

## Deployment Safeguards

### Phase 1 Rollback Automation

**Specification**:

- If migration A001-A005 fail: Execute reverse migrations (schema rollback) via migration revert script
- If revert fails: Restore from snapshot backup of pre-deploy schema
- **Testing**: Reverse migration scripts validated in CI (not just forward migrations)

### Worker Pause During Phase 2

**Specification**:

- Before Phase 2 backend service update: Gracefully pause new job submissions (set worker pause flag in Redis)
- Allow in-flight jobs to complete (max 30-minute grace period, then force-kill)
- After service update: Resume job submissions
- **Rationale**: Prevents race conditions between old API code queuing jobs and new worker code processing

### Snapshot Restore Safe Rollback

**Specification**:

- Phase 1 rollback captures full schema backup pre-deploy
- If post-deploy failures detected: Trigger database restore from pre-deploy snapshot
- Restore procedure documented and tested (not ad-hoc operations)

### Cross-Tenant Smoke Test in Pre-Deployment

**Specification**:

- T053 includes explicit cross-tenant test: Create 3 test licenses in different workspaces, attempt cross-workspace transitions, verify all fail with 403
- Test must pass before Phase 2 proceeds
- **Gates**: Phase 2 blocked until smoke test PASS

### Migration Batching for Large Tables

**Specification**:

- A003 (license_audit_logs) expected to process 500k+ rows during migration
- **Batch Size**: 10k rows per batch with 1-second pause between batches (prevents table lock escalation)
- **Index Creation**: Indexes created CONCURRENTLY (PostgreSQL 8.4+) to avoid blocking reads during migration
- **SLA**: A003 must complete within 15-minute maintenance window

---

## Test Coverage Target

- **Unit Tests (State Machine)**: 100% coverage (T041)
- **Integration Tests (Full Lifecycle)**: 95%+ coverage (T045)
- **API Tests (All 9 Endpoints)**: 100% test matrix (T046)
- **Worker Tests (Snapshot/Restore/Delete)**: 90%+ coverage (T047)
- **RBAC Tests**: 8+ explicit negative tests (T046b, new)
- **Tenant Isolation Tests**: 6+ cross-tenant scenarios (T045b, new)
- **Overall**: 95%+ code coverage across all layers

### Risk 3: Restore Data Corruption

**Risk**: Partial restore, schema mismatch, data loss

**Mitigation**:

- Atomic restore (all-or-nothing)
- Schema compatibility validated before restore
- Forward migrations only
- Data checksums verified after restore
- If fails: Workspace remains ARCHIVED, snapshot preserved

### Risk 4: Soft Deletion Grace Period Missed

**Risk**: Grace period expires, workspace auto-deleted, institution surprised

**Mitigation**:

- MMC UI shows deletion countdown
- Email notification to institution before deletion
- Audit trail visible to institution
- No grace period required (immediate delete possible)
- Manual recovery option if grace period enabled

---

## Conclusion

This plan provides a complete, production-ready blueprint for implementing the four-state license lifecycle model within Zidney's architectural constraints. The implementation prioritizes:

- **Isolation**: Database-per-tenant preserved throughout
- **Determinism**: Middleware enforces on every request, no surprises
- **Immutability**: Audit trails permanent, snapshots never modified
- **Idempotency**: Restore/snapshot operations safe to retry
- **Zero Data Loss**: Snapshots preserve all data, restore is all-or-nothing

The phased deployment approach, comprehensive testing strategy, and detailed rollback plan ensure safe production deployment with minimal risk.
