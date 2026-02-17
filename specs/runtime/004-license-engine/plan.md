# Implementation Plan: License Engine Core

**Stage**: STAGE_04_LICENSE_ENGINE  
**Phase**: 01 – Platform Foundation  
**Branch**: `004-license-engine`  
**Created**: February 17, 2026  
**Status**: Ready for Task Generation

**Related**:

- Spec: [spec.md](spec.md)
- Clarifications: [clarify.md](clarify.md)
- Template: `specs/templates/plan-template.md`
- ADRs: ADR-0001 (multi-tenancy), ADR-0006 (time), ADR-0008 (versioning)

---

## Stage Alignment

**Phase**: 01 – Platform Foundation  
**Stage**: STAGE_04_LICENSE_ENGINE  
**Status**: IN PROGRESS (specification complete, implementation ready)

**Related Spec File**: [spec.md](spec.md)  
**Related ADRs**:

- ADR-0001: Database-per-tenant (enforced)
- ADR-0006: Runtime-authoritative time (enforced)
- ADR-0008: Semantic versioning (enforced)

**Stage Scope**: Implement license lifecycle, limit enforcement, middleware validation, archive snapshots

**Plan Scope Boundary**: This plan includes ONLY STAGE_04 (License Engine). STAGE_05 (Tenant Provisioning) and STAGE_06 (Attempt Engine) handled separately.

---

## Architectural Scope Confirmation

✅ **No cross-tenant data access**: License table is master-only; tenant counts only via domain-core resolver  
✅ **No middleware bypass**: License middleware mandatory on ALL workspace routes  
✅ **No direct DB instantiation**: All queries via domain-core license resolver  
✅ **No grading outside Worker**: Grading not applicable (handled STAGE_06); this stage handles snapshots only  
✅ **No snapshot integrity weakening**: Archive transitions validated; snapshot state immutable  
✅ **No version enforcement weakening**: Version fields stored in license; validated on every request  
✅ **No layer boundary violation**: Frontend consumes API; no license logic in UI; worker handles snapshots

---

## Implementation Layers

### API Layer

**Responsibility**: License lifecycle management, middleware, state transitions, limit enforcement

**Routes to Implement**:

```
POST   /api/mmc/licenses
       → Create license (MMC admin only)
       → Input: product_id, workspace_id, workspace_slug
       → Output: license_id, status, created_at
       → Idempotency: workspace_slug unique constraint (409 on duplicate)

GET    /api/mmc/licenses/{license_id}
       → Retrieve license (MMC admin only)
       → Output: full license object

PATCH  /api/mmc/licenses/{license_id}/state
       → Transition license state (admin only)
       → Input: target_state (ACTIVE|SOFT_LOCKED|ARCHIVED|DELETED), reason
       → Output: updated license object, new status
       → Idempotent: Redis key {license_id}_{target_state}, 24hr TTL

GET    /api/admin/workspace/{workspace_id}/license
       → Get workspace license (backoffice admin)
       → Output: license object (student_limit, staff_limit, status, expected_schema_version)
       → Authorization: Workspace admin or MMC admin

(All workspace-bound routes have middleware protection)
```

**Middleware Stack** (execution order):

```
Middleware Chain:
1. Correlation ID middleware
2. Tenant resolver middleware
3. License enforcement middleware ← THIS STAGE
4. Schema version enforcement middleware
5. Route handler

License Enforcement Middleware:
  - Resolve workspace_id from path or tenant context
  - Query master_db.licenses WHERE workspace_id = $1
  - Validate status (ACTIVE/SOFT_LOCKED/ARCHIVED/DELETED)
    - ACTIVE → proceed (200)
    - SOFT_LOCKED → check soft_lock_until; if expired → auto-transition to ARCHIVED + 403
    - ARCHIVED → return 403 (Forbidden)
    - DELETED → return 404 (Not Found)
  - Validate version compatibility
    - If tenant.schema_version < license.expected_schema_version → return 426 (Upgrade Required)
    - If license.expected_product_version incompatible with runtime → return 426
  - Attach to request context: license_id, student_limit, staff_limit, status
  - Log: action=middleware_check, result=pass|fail, status=*
  - Proceed to next middleware or route handler
```

**Validation Package Usage** (domain-core):

```
Import: @zidney/domain-core/license

Functions/Modules:
  - LicenseResolver: Query master_db.licenses; cache with 5min TTL
  - VersionValidator: Validate tenant vs expected versions
  - LimitEnforcer: Transactional count + constraint check
  - StateTransitionValidator: Validate allowed transitions
```

**Transaction Boundaries** (API layer):

| Operation              | Transaction Required | Isolation Level | Lock Strategy                      |
| ---------------------- | -------------------- | --------------- | ---------------------------------- |
| Create License         | YES                  | SERIALIZABLE    | UNIQUE(workspace_slug)             |
| Retrieve License       | NO                   | READ COMMITTED  | None                               |
| State Transition       | YES                  | SERIALIZABLE    | SELECT FOR UPDATE on license row   |
| Soft-Lock Expiry Check | YES                  | READ COMMITTED  | SELECT FOR UPDATE if transitioning |

---

### Worker Layer

**Responsibility**: Archive snapshot execution, async state transitions

**Queue Name**: `zidney-archive-jobs` (Redis-backed)

**Jobs**:

```
Job 1: ARCHIVE_SNAPSHOT
  - Trigger: License transitions from SOFT_LOCKED → ARCHIVED
  - Enqueued by: API handler during PATCH /licenses/{id}/state
  - Payload: { license_id, workspace_id, snapshot_timestamp }
  - Idempotency Key: {license_id}_{snapshot_timestamp}
  - Idempotency Storage: DB query (check archive_snapshots table within 1 hour)
  - Execution:
    1. Verify license.status = ARCHIVED (if not, retry)
    2. Query tenant DB connection details from tenants_registry
    3. Execute: pg_dump > snapshot.sql
    4. Upload snapshot to S3/NAS (path: s3://archive-snapshots/{license_id}/{timestamp}.sql)
    5. INSERT INTO archive_snapshots (license_id, snapshot_location, created_at)
    6. UPDATE licenses SET snapshot_id = ... WHERE license_id = $1
    7. Log: action=archive_snapshot, license_id, snapshot_location, result=success|failure
  - Retry Policy: 3 attempts, exponential backoff (1s, 5s, 30s)
  - DLQ: On final failure, send to dead-letter queue; alert ops
  - Transactional: YES (INSERT + UPDATE atomic)
```

**Worker Isolation**:

- No direct tenant DB write access (read-only for snapshot)
- No cross-workspace snapshot access
- Uses domain-core resolver for DB connections

---

### MMC / Backoffice Scope

**Responsibility**: Commercial authority; license creation and state transitions

**Commercial Authority** (MMC):

- Can create licenses
- Can trigger SOFT_LOCK (payment failure)
- Can trigger ARCHIVED (manual, data preservation)
- Can trigger DELETED (manual, with snapshot confirmation)

**Institutional Authority** (Backoffice):

- Can view license status (read-only)
- Can view student/staff limits
- Cannot modify license state (admin action only)

---

## Database Impact

### Master Database (master_db)

#### New Table: `licenses`

```sql
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  workspace_id UUID NOT NULL UNIQUE,
  workspace_slug VARCHAR(255) NOT NULL UNIQUE,

  -- Limits (from product)
  student_limit INTEGER DEFAULT NULL,
  staff_limit INTEGER DEFAULT NULL,

  -- Lifecycle State
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SOFT_LOCKED', 'ARCHIVED', 'DELETED')),
  soft_lock_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,

  -- Versioning Contract
  expected_schema_version VARCHAR(20) NOT NULL,
  expected_product_version VARCHAR(20) NOT NULL,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Snapshot Reference (nullable until archived)
  snapshot_id UUID DEFAULT NULL,

  -- Constraints
  CONSTRAINT valid_state_transitions CHECK (
    (status = 'ACTIVE' AND soft_lock_until IS NULL AND archived_at IS NULL AND deleted_at IS NULL) OR
    (status = 'SOFT_LOCKED' AND soft_lock_until IS NOT NULL AND archived_at IS NULL AND deleted_at IS NULL) OR
    (status = 'ARCHIVED' AND archived_at IS NOT NULL AND deleted_at IS NULL) OR
    (status = 'DELETED' AND deleted_at IS NOT NULL)
  ),
  CONSTRAINT immutable_workspace_slug CHECK (
    -- Enforced in application; DB constraint on creation is sufficient
    workspace_slug IS NOT NULL AND workspace_slug != ''
  )
);

-- Indexes
CREATE INDEX idx_licenses_workspace_id ON licenses(workspace_id);
CREATE INDEX idx_licenses_workspace_slug ON licenses(workspace_slug);
CREATE INDEX idx_licenses_product_id ON licenses(product_id);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_soft_lock_until ON licenses(soft_lock_until)
  WHERE status = 'SOFT_LOCKED';
CREATE INDEX idx_licenses_created_at ON licenses(created_at);
```

#### New Table: `archive_snapshots`

```sql
CREATE TABLE archive_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES licenses(id),
  snapshot_location VARCHAR(2048) NOT NULL,  -- S3 path or file path
  snapshot_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Deduplication: unique per license + timestamp (1 hour precision)
  UNIQUE(license_id, EXTRACT(EPOCH FROM snapshot_timestamp)::BIGINT / 3600)
);

CREATE INDEX idx_archive_snapshots_license_id ON archive_snapshots(license_id);
CREATE INDEX idx_archive_snapshots_created_at ON archive_snapshots(created_at);
```

#### Modified Table: `tenants_registry`

No structural changes. Foreign key implicitly references `licenses(workspace_id)` for validation.

```sql
-- No changes; existing:
-- workspace_id references licenses(workspace_id)
```

#### Migration Impact

**Version Bump Required**: YES → Product version incremented (SemVer MINOR)

- Previous: 1.0.0
- New: 1.1.0 (adding license capability)

**Backward Compatibility**: Forward-compatible (additive schema)

**Migration File**: `apps/api/src/db/master/migrations/[timestamp]_create_licenses_table.ts`

```typescript
export async function up(db: Database) {
  // Create licenses table
  await db.query(`CREATE TABLE licenses (...)`)

  // Create archive_snapshots table
  await db.query(`CREATE TABLE archive_snapshots (...)`)

  // Update schema_version in master_db control table
  await db.query(`
    UPDATE schema_control SET 
      version = '1.1.0', 
      schema_version = 2,
      updated_at = NOW()
    WHERE schema_name = 'master'
  `)
}

export async function down(db: Database) {
  await db.query(`DROP TABLE IF EXISTS archive_snapshots`)
  await db.query(`DROP TABLE IF EXISTS licenses`)
  await db.query(`
    UPDATE schema_control SET 
      version = '1.0.0', 
      schema_version = 1,
      updated_at = NOW()
    WHERE schema_name = 'master'
  `)
}
```

### Tenant Database (tenant_db)

**No schema changes**. Limit enforcement reads from existing `users` table only.

**Queries**:

```sql
-- Student count (transactional + FOR UPDATE)
SELECT COUNT(*) FROM users
  WHERE status = 'ENABLED' AND role = 'STUDENT'
  FOR UPDATE
LIMIT 1;

-- Staff count (same)
SELECT COUNT(*) FROM users
  WHERE status = 'ENABLED' AND role = 'STAFF'
  FOR UPDATE
LIMIT 1;
```

---

## Transaction Design

### T1: Create License

**Scope**: Master DB  
**Required**: YES  
**Isolation**: SERIALIZABLE  
**Lock Strategy**: UNIQUE(workspace_slug) prevents duplicates

```
BEGIN TRANSACTION (SERIALIZABLE)
  1. Validate product_id exists
  2. Validate workspace_id not already licensed
  3. INSERT INTO licenses (product_id, workspace_id, workspace_slug, student_limit, staff_limit, expected_schema_version, expected_product_version, status, created_at)
     VALUES (...)
  4. Return license_id
COMMIT
```

**Failure Handling**:

- Duplicate workspace_slug → 409 (Conflict)
- Product not found → 400 (Bad Request)
- DB error → 500 (Internal Server Error); caller retries

**Idempotency**: Unique constraint on workspace_slug enforces idempotency (second insert fails with 409)

---

### T2: Enforce Student/Staff Limit (Transactional Count + Insert)

**Scope**: Both master_db (license) + tenant_db (users)  
**Required**: YES  
**Isolation**: SERIALIZABLE  
**Lock Strategy**: SELECT FOR UPDATE (row-level lock on first user row)

```
BEGIN TRANSACTION (SERIALIZABLE)
  -- Within tenant connection pool
  1. SELECT COUNT(*) FROM users
       WHERE status = 'ENABLED' AND role = 'STUDENT'
       FOR UPDATE
       LIMIT 1;
  2. If count >= license.student_limit → ROLLBACK, return 402 (Payment Required)
  3. INSERT INTO users (workspace_id, name, email, role, status, ...)
     VALUES (..., 'STUDENT', 'ENABLED', ...)
COMMIT
```

**Failure Handling**:

- Limit exceeded → 402 (Payment Required); no user created
- Lock timeout → ROLLBACK; return 503 (Service Unavailable)
- Constraint violation → ROLLBACK; return 409 (Conflict)

**Idempotency**: Caller must handle idempotency (deduplication via email + workspace_id); endpoint not idempotent

**Race Condition Prevention**: SELECT FOR UPDATE ensures only one request counts simultaneously; others wait and recount

---

### T3: State Transition (ACTIVE → SOFT_LOCKED)

**Scope**: Master DB  
**Required**: YES  
**Isolation**: SERIALIZABLE  
**Lock Strategy**: SELECT FOR UPDATE on license row

```
BEGIN TRANSACTION (SERIALIZABLE)
  1. SELECT * FROM licenses WHERE license_id = $1 FOR UPDATE
  2. Verify current status = ACTIVE
  3. UPDATE licenses SET
       status = 'SOFT_LOCKED',
       soft_lock_until = NOW() + INTERVAL '90 days',
       updated_at = NOW()
     WHERE license_id = $1
  4. Log: action=state_transition, from=ACTIVE, to=SOFT_LOCKED, reason=$reason
COMMIT
```

**Idempotency**: If already SOFT_LOCKED, return 200 (via Redis idempotency key storage)

---

### T4: State Transition + Archive Enqueue (SOFT_LOCKED → ARCHIVED)

**Scope**: Master DB + Query (not transaction) to check expiry  
**Required**: YES  
**Isolation**: SERIALIZABLE  
**Lock Strategy**: SELECT FOR UPDATE on license row

```
BEGIN TRANSACTION (SERIALIZABLE)
  1. SELECT * FROM licenses WHERE license_id = $1 FOR UPDATE
  2. If NOW() > soft_lock_until:
       - UPDATE licenses SET status = 'ARCHIVED', archived_at = NOW()
       - ENQUEUE worker_job('ARCHIVE_SNAPSHOT', license_id)
       - COMMIT
       - Return 403 (Forbidden) or 200 depending on context
COMMIT
```

**Enqueue Safety**: If COMMIT fails, worker job not enqueued; safe to retry

---

### T5: Archive Snapshot (Worker Job)

**Scope**: Master DB + Tenant DB (read-only) + External (S3 upload)  
**Required**: YES  
**Isolation**: SERIALIZABLE

```
BEGIN TRANSACTION (SERIALIZABLE)
  1. Verify license.status = ARCHIVED
  2. Execute pg_dump (external; ISO 8601 snapshot_timestamp CAPTURED HERE, not NOW())
  3. Upload snapshot to S3/NAS
  4. INSERT INTO archive_snapshots (license_id, snapshot_location, snapshot_timestamp)
  5. UPDATE licenses SET snapshot_id = $snapshot_id, updated_at = NOW()
COMMIT
```

**Idempotency**: Before step 2, check for recent snapshot within 1 hour; if found, skip dump

---

## Idempotency Plan

### State Transitions (Idempotent Endpoints)

**Endpoints**:

- PATCH /api/mmc/licenses/{id}/state (transition)
- PATCH /api/mmc/licenses/{id}/renew (SOFT_LOCKED → ACTIVE)

**Idempotency Key Header**: `Idempotency-Key` (caller-provided UUID)  
**Storage**: Redis cache
**TTL**: 24 hours

**Implementation Flow**:

```
1. Extract Idempotency-Key from request header
2. Query Redis: GET idempotency:{license_id}:{target_state}:{key_hash}
3. If exists → return cached response (200 + cached payload)
4. If not exists:
   - Execute transition
   - Store result in Redis with 24hr TTL
   - Return result (200 + new payload)
5. If Redis unavailable → proceed without caching (best-effort)
```

**Collision Handling**:

- If two requests with same idempotency key but different payload → first payload wins; second gets cached response
- Caller responsible for using consistent payloads with idempotency keys

### Worker Jobs (Deduplication)

**Archive Snapshot Job**:

**Idempotency Check**:

```sql
SELECT snapshot_id FROM archive_snapshots
  WHERE license_id = $1
  AND created_at > NOW() - INTERVAL '1 hour'
LIMIT 1;
```

**Behavior**:

- If recent snapshot exists (timestamp within 1 hour) → skip dump, update license.snapshot_id, return success
- If no recent snapshot → execute dump, upload, store, update license

---

## Concurrency Guard Strategy

### Student/Staff Limit Enforcement

**Guard**: SELECT FOR UPDATE row-level lock

```sql
SELECT COUNT(*) FROM users
  WHERE status = 'ENABLED' AND role = 'STUDENT'
  FOR UPDATE
LIMIT 1;
```

**Effect**:

- First concurrent request acquires lock; counts students; blocks second request
- Second request: Waits for lock release; recounts; sees limit+1; fails with 402
- Result: No race condition; exactly one of two competing requests succeeds

**Timeout**: If lock held > 30 seconds → ROLLBACK; return 503 (Service Unavailable)

### Soft-Lock Expiry Auto-Transition

**Guard**: SELECT FOR UPDATE on license row

```sql
SELECT * FROM licenses
  WHERE license_id = $1 AND status = 'SOFT_LOCKED'
  FOR UPDATE;

IF NOW() > soft_lock_until THEN
  UPDATE licenses SET status = 'ARCHIVED', archived_at = NOW()
  WHERE license_id = $1;
END IF;
```

**Effect**:

- First concurrent request acquires lock; checks expiry; updates status
- Second concurrent request: Waits for lock release; checks status; sees ARCHIVED; both return 403
- Result: No duplicate status transitions; safe for multiple simultaneous requests

---

## Version Enforcement Strategy

### Schema Version Validation

**Location**: License middleware (before route handler)

**Logic**:

```
1. Fetch license.expected_schema_version
2. Fetch tenant.current_schema_version (from tenant registry)
3. IF tenant.current_schema_version >= license.expected_schema_version:
     THEN proceed (200)
   ELSE:
     RETURN 426 (Upgrade Required)
```

**Direction**: Forward-compatible (tenant > license allowed; tenant < license blocked)

**Logging**:

```json
{
  "action": "version_check",
  "expected_schema": "1.0.0",
  "current_schema": "1.1.0",
  "result": "pass|fail"
}
```

### Product Version Validation

**Location**: License middleware (after schema check)

**Logic** (per ADR-0008):

```
1. Fetch license.expected_product_version
2. Fetch runtime.product_version
3. IF major_version_match(expected, runtime):
     AND minor_version_match(expected, runtime):
     THEN proceed (200)
   ELSE:
     RETURN 426 (Upgrade Required)
```

**Backward Compatibility**:

- Old licenses (expected_product_version = 1.0.0) work with runtime 1.x (MAJOR match)
- New licenses (expected_product_version = 2.0.0) do NOT work with runtime 1.x (MAJOR mismatch)

---

## Authoritative Time Handling

### Server Clock Authority (ADR-0006)

**All timestamps use PostgreSQL NOW()**:

- License creation: `created_at = NOW()`
- Soft-lock window: `soft_lock_until = NOW() + INTERVAL '90 days'`
- Archive timestamp: `archived_at = NOW()`
- Snapshot timestamp: When pg_dump completes (captured as ISO 8601 string)

**Client Time REJECTED**:

- Requests with client-provided timestamps in license operations → ignored
- soft_lock_until computed server-side only

### Soft-Lock Expiry Validation

**Timing**: Every API request (middleware)

**Logic**:

```
middleware: license_enforcement
  1. Fetch license
  2. IF license.status = 'SOFT_LOCKED' AND NOW() > license.soft_lock_until:
       BEGIN TRANSACTION
         UPDATE licenses SET status = 'ARCHIVED', archived_at = NOW()
         ENQUEUE worker_job('ARCHIVE_SNAPSHOT', license_id)
       COMMIT
       RETURN 403 (Forbidden)  -- or 200 if internal transition
```

**No Cron Reliance**: Middleware check is primary; cron is optional optimization

**Drift Prevention**: Every request re-validates; no stale cache state

---

## Error Code Mapping

**All license operations return standard error contract**:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "LICENSE_* | LIMIT_EXCEEDED | SCHEMA_VERSION_MISMATCH",
    "message": "human-readable"
  }
}
```

### Error Code Registry (from Clarification Q5)

| Scenario                     | HTTP Status | Error Code               | Message Example                                                |
| ---------------------------- | ----------- | ------------------------ | -------------------------------------------------------------- |
| License SOFT_LOCKED          | 423         | LICENSE_SOFT_LOCKED      | "Workspace temporarily locked. Renew subscription to restore." |
| License ARCHIVED             | 403         | LICENSE_ARCHIVED         | "Workspace archived. Contact support to restore."              |
| License DELETED              | 404         | LICENSE_DELETED          | "Workspace no longer exists."                                  |
| License not found            | 404         | LICENSE_NOT_FOUND        | "No active license for this workspace."                        |
| Student limit exceeded       | 402         | LIMIT_EXCEEDED           | "Student enrollment limit reached. Upgrade plan."              |
| Staff limit exceeded         | 402         | LIMIT_EXCEEDED           | "Staff limit reached. Upgrade plan."                           |
| Schema version too old       | 426         | SCHEMA_VERSION_MISMATCH  | "Workspace requires schema upgrade."                           |
| Product version incompatible | 426         | UPGRADE_REQUIRED         | "Workspace requires product upgrade."                          |
| Invalid state transition     | 409         | INVALID_STATE_TRANSITION | "Cannot transition from ACTIVE to ACTIVE."                     |
| Duplicate workspace_slug     | 409         | WORKSPACE_ALREADY_EXISTS | "Workspace slug already in use."                               |
| Idempotency key mismatch     | 409         | IDEMPOTENCY_CONFLICT     | "Retried request with different parameters."                   |

---

## Logging Requirements

### Structured Logging Format

**All license operations emit JSON**:

```json
{
  "timestamp": "2026-02-17T10:30:45.123Z",
  "level": "info",
  "service": "license-engine",
  "correlation_id": "uuid-here",
  "workspace_slug": "acme.edu",
  "workspace_id": "workspace-uuid",
  "user_id": "user-uuid (if available)",
  "action": "create|state_transition|limit_enforce|middleware_check|archive_snapshot|soft_lock_expiry",
  "status": "success|failure",
  "result": "pass|fail",
  "error_code": "ERROR_CODE (if failure)",
  "details": {
    "endpoint": "/api/mmc/licenses",
    "method": "POST",
    "http_status": 200,
    "duration_ms": 45,
    "attempt_count": 1
  }
}
```

### Structured Logging Locations

| Operation                | Fields                                                         |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------- | ----------------- |
| License create           | workspace_slug, product_id, status, student_limit, staff_limit |
| License state transition | from_status, to_status, soft_lock_until, reason                |
| Limit enforcement        | role (STUDENT                                                  | STAFF), count, limit, result (success | fail), error_code |
| Middleware check         | status, version_match, error_code (if fail)                    |
| Archive snapshot         | license_id, snapshot_location, duration_ms, pg_dump_size_mb    |
| Soft-lock expiry         | old_status, new_status, expired_at                             |

### Log Destinations

- **Info/Warn**: Pino structured logger → CloudWatch / ELK
- **Error**: As above + alert ops team (if snapshot failure)

---

## Worker Interaction

### Archive Snapshot Job

**Trigger**: License transitions from SOFT_LOCKED → ARCHIVED

**Enqueue**:

```typescript
// In license middleware or state transition handler
await enqueueJob('archive-jobs', {
  type: 'ARCHIVE_SNAPSHOT',
  license_id: license.id,
  workspace_id: license.workspace_id,
  snapshot_timestamp: new Date().toISOString(),
})
```

**Worker Processing**:

1. Dequeue job from `zidney-archive-jobs` queue
2. Check idempotency (recent snapshot exists?)
3. If not: Execute pg_dump → Upload to S3 → Store → update license
4. If yes: Skip dump, update license, return success
5. On failure: Retry 3x with backoff (1s, 5s, 30s)
6. DLQ on final failure

**DLQ Handling**:

- Ops team alerted (Slack/PagerDuty)
- Manual intervention required to retry or mark as resolved
- License remains in ARCHIVED state (safe)

---

## Rate Limiting

### Endpoint Classification

| Endpoint                              | Classification | Limit           | Window      |
| ------------------------------------- | -------------- | --------------- | ----------- |
| POST /api/mmc/licenses                | Admin          | 100             | Hour        |
| PATCH /api/mmc/licenses/{id}/state    | Admin          | 50              | Hour        |
| GET /api/mmc/licenses                 | Admin          | 1000            | Hour        |
| (All workspace routes via middleware) | Public/Auth    | Depends on plan | Per license |

**License Enforcement Middleware**: No rate limit (prerequisite check)

---

## Failure Modes & Recovery

### DB Failures

| Failure                     | Detection                        | Recovery                                  |
| --------------------------- | -------------------------------- | ----------------------------------------- |
| Master DB unavailable       | Connection timeout (5 sec)       | Return 503; caller retries                |
| Tenant DB unavailable       | Connection timeout (5 sec)       | Return 503; caller retries; user notified |
| License table query timeout | Query > 30 sec                   | CANCEL query; return 503                  |
| Limit count timeout         | FOR UPDATE lock timeout > 30 sec | ROLLBACK; return 503                      |

### Version Mismatch

| Failure                              | Detection             | Recovery                       |
| ------------------------------------ | --------------------- | ------------------------------ |
| tenant.schema_version < expected     | Middleware validation | Return 426; UI prompts upgrade |
| license.product_version incompatible | Middleware validation | Return 426; UI prompts upgrade |

### License Enforcement

| Failure             | Detection                 | Recovery                          |
| ------------------- | ------------------------- | --------------------------------- |
| License SOFT_LOCKED | Middleware check          | Return 423; show renewal prompt   |
| License ARCHIVED    | Middleware check          | Return 403; show recovery contact |
| License DELETED     | Middleware check          | Return 404; show not found page   |
| Limit exceeded      | Transactional count check | Return 402; show upgrade prompt   |

### Worker Failures

| Failure         | Detection            | Recovery                             |
| --------------- | -------------------- | ------------------------------------ |
| pg_dump fails   | Process exit code    | Retry up to 3x; DLQ on final failure |
| S3 upload fails | HTTP error           | Retry up to 3x; DLQ                  |
| DB UPDATE fails | Constraint violation | Retry; check if lock contention      |

### Partial Transaction Failures

**Example**: LICENSE → UPDATE succeeds; snapshot job enqueue fails

**Recovery**:

- License.status = ARCHIVED (correct state)
- Snapshot job not queued (but will retry via worker background scan)
- User sees 403; data persisted correctly
- Worker eventually processes delayed snapshot

---

## Security Review

✅ **RBAC Enforcement**: License state transitions require MMC role (server-side check)  
✅ **No Role Checks in Frontend**: UI consumes HTTP status codes; server enforces authorization  
✅ **No Secrets Exposed**: License data does not include payment tokens or keys  
✅ **JWT Scope**: License validation tied to workspace_id from JWT; cross-workspace access impossible  
✅ **Sensitive Data Not Logged**: Passwords, API keys, PII not in structured logs

---

## Test Strategy

### Unit Tests

**Test Files**:

- `apps/api/tests/unit/license-engine/license-validator.test.ts`
- `apps/api/tests/unit/license-engine/state-transitions.test.ts`
- `apps/api/tests/unit/license-engine/limit-enforcement.test.ts`

**Test Cases**:

| Test                           | Scenario                                    | Expected                            |
| ------------------------------ | ------------------------------------------- | ----------------------------------- |
| Create License Valid           | product_id exists, workspace_slug unique    | License created; status=ACTIVE      |
| Create License Duplicate       | workspace_slug already exists               | 409 Conflict                        |
| Create License Invalid Product | product_id not found                        | 400 Bad Request                     |
| State Transition Valid         | ACTIVE → SOFT_LOCKED                        | Status updated; soft_lock_until set |
| State Transition Invalid       | ACTIVE → ACTIVE                             | 409 Invalid Transition              |
| Student Limit Check At Limit   | 300/300 students, limit=300                 | User created successfully           |
| Student Limit Check Over Limit | 300/300 students, limit=300, try to add 301 | 402 Payment Required                |
| Soft-Delete Exclusion          | 300 enabled, 50 soft-deleted, limit=300     | Limit check counts 300 (not 350)    |
| Version Match                  | tenant.schema=1.0, expected=1.0             | Allowed                             |
| Version Mismatch               | tenant.schema=0.9, expected=1.0             | 426 Upgrade Required                |
| Version Forward Compatible     | tenant.schema=1.1, expected=1.0             | Allowed                             |

### Integration Tests

**Test Files**:

- `apps/api/tests/integration/license-lifecycle.test.ts`
- `apps/api/tests/integration/limit-enforcement-concurrency.test.ts`

**Test Scenarios**:

| Test                         | Flow                                      | Assertions                            |
| ---------------------------- | ----------------------------------------- | ------------------------------------- |
| End-to-End Lifecycle         | Create → Login → User Creation            | All succeed; license enforced         |
| State Transition Flow        | ACTIVE → SOFT_LOCKED → ARCHIVED           | Status transitions; snapshot enqueued |
| Concurrent Limit Enforcement | 2 requests compete for limit              | One succeeds; one gets 402            |
| Soft-Lock Expiry             | Set soft_lock_until to past; next request | Auto-transition to ARCHIVED; 403      |
| Archive Recovery             | Restore from snapshot                     | Data restored; status=ACTIVE          |
| Version Enforcement          | Request with old tenant version           | 426 returned                          |
| Cross-Tenant Isolation       | License A doesn't affect License B        | Requests isolated                     |

### Idempotency Tests

| Test                        | Scenario                                         | Expected                                   |
| --------------------------- | ------------------------------------------------ | ------------------------------------------ |
| Idempotent State Transition | Submit SOFT_LOCK twice with same idempotency key | First: 200; Second: 200 (cached)           |
| Snapshot Dedup              | Enqueue snapshot twice within 1 hour             | First: dump executed; Second: dump skipped |
| Duplicate License           | Create license, retry with same workspace_slug   | First: 200; Second: 409                    |

### Concurrency Tests

| Test                       | Setup                            | Expected                                   |
| -------------------------- | -------------------------------- | ------------------------------------------ |
| Simultaneous Limit Checks  | 10 requests, limit=3             | Exactly 3 succeed; 7 get 402               |
| Simultaneous Expiry Checks | 5 requests after soft_lock_until | All see ARCHIVED; no duplicate transitions |
| Lock Timeout               | Hold lock > 30 sec               | Waiting request returns 503                |

### Transaction Rollback Tests

| Test                   | Scenario                            | Expected                  |
| ---------------------- | ----------------------------------- | ------------------------- |
| Rollback on Limit      | Count succeeds; insert fails        | Rollback; no user created |
| Rollback on Permission | User lacks staff role; insert fails | Rollback; no user created |

---

## Rollback Strategy

### Feature Rollback

**If license engine must be disabled**:

1. **API Layer**: Remove license middleware from router composition
   - Routes become unprotected (NOT RECOMMENDED; use feature flag instead)

2. **Database**: Retain `licenses` table; mark as "legacy"
   - Do NOT drop table (irreversible; data loss)

3. **Feature Flag**: Add `FEATURE_FLAGS.license_engine_enabled` (recommended)
   - If disabled: Skip license middleware; proceed to next middleware
   - If enabled: Execute license middleware

4. **Worker**: Pause archive snapshot jobs
   - Existing jobs in DLQ; postpone retry

### Migration Rollback

**If migration must be undone**:

1. Ensure all workspaces still functional on previous schema
2. Run down() migration (reverts version to 1.0.0)
3. Update all in-flight requests (if any) to handle missing `licenses` table

**Not Recommended** except for critical data integrity issues.

---

## Non-Goals

❌ **Product Pricing Model**: Handled in STAGE_09_PRODUCTS  
❌ **Billing & Invoicing**: Handled in STAGE_44_BILLING  
❌ **Payment Integration**: Handled by integration layer (MMC receives "payment_success" events only)  
❌ **Grading Logic**: Handled by Worker, STAGE_06  
❌ **Attempt Engine**: Handled by STAGE_06  
❌ **Automated License Deletion**: Deletion requires manual admin confirmation  
❌ **UI Workflows**: Template provided; implementation in backoffice/frontoffice apps

---

## Implementation Layers Overview

### Directory Structure

```
apps/api/
├── src/
│   ├── middleware/
│   │   └── license-enforcement.ts
│   ├── handlers/
│   │   └── mmc/
│   │       └── licenses.ts
│   ├── db/
│   │   ├── master/
│   │   │   └── migrations/
│   │   │       └── [timestamp]_create_licenses_table.ts
│   │   └── queries/
│   │       └── license-queries.ts
│   ├── routes/
│   │   ├── mmc-routes.ts
│   │   └── admin-routes.ts
│   └── worker/
│       └── archive-jobs.ts
└── tests/
    ├── unit/
    │   └── license-engine/
    │       ├── license-validator.test.ts
    │       ├── state-transitions.test.ts
    │       └── limit-enforcement.test.ts
    └── integration/
        └── license-engine/
            ├── lifecycle.test.ts
            └── concurrency.test.ts

packages/domain-core/
├── src/
│   └── license/
│       ├── resolver.ts
│       ├── validator.ts
│       ├── state-machine.ts
│       └── limit-enforcer.ts
└── tests/
    └── license/
        └── *.test.ts
```

---

## Final Compliance Statement

### Architectural Validation

✅ **No cross-tenant data access**: License table master-only; counts via resolver  
✅ **No middleware bypass**: Mandatory middleware on all workspace routes  
✅ **No direct DB instantiation**: All queries via domain-core resolver  
✅ **No weakening of transactions**: All mutating ops atomic; vision enforced  
✅ **No weakening of idempotency**: State transitions idempotent; snapshots deduped  
✅ **No weakening of version enforcement**: Versions validated on every request  
✅ **No grading outside worker**: Snapshots handled by worker; no grading here  
✅ **Database-per-tenant preserved**: Master-only license; tenant DB untouched  
✅ **Server-authoritative time**: All timestamps from PostgreSQL NOW()  
✅ **Migration discipline**: Forward-only migration; version bump; no rollback

### Constitutional Alignment

✅ ADR-0001: Database-per-tenant (enforced)  
✅ ADR-0006: Runtime-authoritative time (enforced)  
✅ ADR-0008: Semantic versioning (enforced)

### All 5 Clarifications Integrated

✅ Q1: SELECT FOR UPDATE (row-level lock) for T2  
✅ Q2: Redis cache (24hr TTL) for state transitions; DB dedup for snapshots  
✅ Q3: Forward-compatible version logic (tenant ≥ license)  
✅ Q4: Expiry check every request (fail-fast middleware)  
✅ Q5: Granular error codes (LICENSE_SOFT_LOCKED, LICENSE_ARCHIVED, LIMIT_EXCEEDED, etc.)

---

**Implementation plan compliant with Zidney Constitution v1.2.0 — No violations detected.**
