# PLAN – Migration & Versioning Model (STAGE_02C)

**Phase:** 01 – Platform Foundation  
**Stage:** STAGE_02C_MIGRATION_AND_VERSIONING_MODEL  
**Status:** Implementation Planning  
**Specification:** spec.md (849 lines)  
**Binding Authority:** ADR-0008 (Semantic Versioning Policy)  
**Planning Date:** 2026-02-16

---

## Stage Alignment

### Specification Reference

- **Related Spec File:** `specs/runtime/002C-migration-and-versioning-model/spec.md`
- **Phase Dependency:** STAGE_02A (Master schema), STAGE_02B (Tenant baseline)
- **Related ADR:** ADR-0008 (Semantic Versioning Policy)
- **Scope Boundary:** Schema evolution governance, version tracking, upgrade orchestration

### Stage Charter

This stage builds the deterministic, auditable skeleton that enforces forward-only schema evolution
across the entire platform. It operationalizes ADR-0008 and prevents schema drift through strict
version enforcement at every layer:

- **Platform layer:** Tracks current version and minimum-supported threshold
- **Tenant layer:** Single source of truth per workspace
- **Runtime layer:** Blocks incompatible requests with 426 errors
- **Worker layer:** Sole executor of mutations with transactional guarantees
- **Audit layer:** Immutable registry of all migrations for compliance

All subsequent feature development depends on this stage.

---

## Architectural Scope Confirmation

**✓ CONFIRMED – Zero Architectural Exceptions**

Explicit confirmations:

- ✓ **No cross-tenant data access** — All migrations scoped to master (global) or single tenant
  (workspace_id)
- ✓ **No middleware bypass** — License middleware mandatory before any upgrade execution
- ✓ **No direct DB instantiation** — All connections via tenant resolver or master pool
- ✓ **No grading logic outside Worker** — Upgrade snapshots managed by Worker only
- ✓ **No weakening of snapshot integrity** — Snapshots atomic, transactional, immutable
- ✓ **No weakening of version enforcement** — Runtime refuses incompatible schemas (426 contract
  enforced)
- ✓ **No layer boundary violation** — UI/API/Domain/Worker separated per constitution
- ✓ **No roll-forward without version bump** — SemVer strictly enforced in all write operations
- ✓ **No manual schema edits** — All schema changes via immutable migration files only

**Governance Reference:** This plan implements ADR-0008 without exception.

---

---

## Implementation Layers

### 1. API Layer (Router & Middleware)

#### Routes Introduced

**Endpoint: POST /api/admin/workspace/{workspace_id}/upgrade**

```
Route: POST /api/admin/workspace/{workspace_id}/upgrade
Input:
  {
    "target_schema_version": "string (SemVer)",
    "dry_run": "boolean (optional)"
  }

Response on acceptance (202 Accepted):
  {
    "success": true,
    "data": {
      "upgrade_id": "uuid",
      "workspace_id": "uuid",
      "current_schema_version": "1.0.0",
      "target_schema_version": "1.1.0",
      "status": "QUEUED",
      "status_url": "/api/admin/workspace/{workspace_id}/upgrade/{upgrade_id}"
    },
    "error": null
  }

Response on error (400/423/426/500):
  {
    "success": false,
    "data": null,
    "error": {
      "code": "ERROR_CODE",
      "message": "Human-readable message"
    }
  }
```

**Endpoint: GET /api/admin/workspace/{workspace_id}/upgrade/{upgrade_id}**

```
Route: GET /api/admin/workspace/{workspace_id}/upgrade/{upgrade_id}
Response (200 OK or terminal state):
  {
    "success": true,
    "data": {
      "upgrade_id": "uuid",
      "workspace_id": "uuid",
      "status": "IN_PROGRESS|SUCCESS|FAILED",
      "progress_percent": 0-100,
      "current_migration": "migration_filename",
      "execution_time_ms": 0,
      "snapshot_id": "uuid (if created)"
    },
    "error": null
  }

Response if FAILED:
  {
    "success": false,
    "data": null,
    "error": {
      "code": "MIGRATION_SYNTAX_ERROR",
      "message": "...",
      "failed_at_migration": "filename"
    }
  }
```

**Endpoint: POST /api/admin/workspace/{workspace_id}/upgrade/{upgrade_id}/rollback**

```
Route: POST /api/admin/workspace/{workspace_id}/upgrade/{upgrade_id}/rollback
Input:
  {
    "snapshot_id": "uuid",
    "confirmation_code": "string"
  }

Response on acceptance (202 Accepted):
  {
    "success": true,
    "data": {
      "rollback_id": "uuid",
      "snapshot_id": "uuid",
      "target_schema_version": "1.0.0",
      "status": "QUEUED"
    },
    "error": null
  }
```

#### Middleware Stack

**License Middleware (Pre-Route)**

```
Middleware: LICENSE_VALIDATOR
Order: 1 (executes first)
Scope: All /api/admin/workspace/* routes

Logic:
  1. Extract workspace_id from URL path
  2. Query master_db.licenses for workspace_id
  3. Validations:
     - License exists: If not → 403 NOT_FOUND
     - Status = ACTIVE: If SOFT_LOCKED → 423 UNAVAILABLE; If ARCHIVED → 403 FORBIDDEN
     - Limit not exceeded: Check current usage vs product_version limits (transactional enforcement)
     - Product version compatible: Validate compatibility with runtime
  4. If all pass: Attach license_context to request
  5. If fail: Short-circuit response, never reach route handler

No direct DB access from middleware; defer to domain-core resolver.
```

**Tenant Resolver Registration (Pre-Route)**

```
Middleware: TENANT_RESOLVER
Order: 0 (before LICENSE_VALIDATOR)
Scope: All /api/admin/workspace/* routes

Logic:
  1. Extract workspace_id from URL path
  2. Query master_db.tenants_registry for workspace_id
  3. Validate: workspace_id exists AND is_active = true
  4. Allocate connection from workspace-scoped pool (or create if doesn't exist)
  5. Attach tenant_context {workspace_id, workspace_slug, connection_pool} to request
  6. If workspace_id invalid: 404 NOT_FOUND

No business logic; purely infrastructure setup.
```

**Validation Package Usage**

```
Import: packages/validation/schema-version-validator

Functions called:
  - validateSemVer(version_string) → true/false
  - validateMinimumSupported(tenant_version, platform_minimum) → true/false
  - validateProductVersionCompatibility(product_version, required_minimum) → true/false

Validation occurs at:
  1. HTTP input validation (before route handler)
  2. Worker pre-execution validation (before migration)
  3. Runtime resolver check (every request)
```

#### Transaction Boundaries

**API Layer Responsibilities:**

- ✗ Does NOT execute migrations
- ✗ Does NOT modify database schema
- ✓ Validates input (SemVer format, version logic)
- ✓ Checks license before queuing
- ✓ Enqueues Worker job
- ✓ Returns idempotent upgrade status

**Transaction Scope:** NONE at API layer

- HTTP request itself is not a transaction
- Transaction begins in Worker (see Worker section)

---

### 2. Worker Layer (Async Migration Executor)

#### Queue Architecture

**Queue Name:** `workspace-schema-migrations`  
**Concurrency:** 1 job per workspace (FIFO serialization by workspace_id)  
**Retry Strategy:** Exponential backoff (1s, 2s, 4s); max 3 retries; DLQ on failure  
**Idempotency:** (workspace_id, migration_file) unique key

#### Job Processing Workflow

**Input Job Schema:**

```json
{
  "job_type": "SCHEMA_MIGRATION",
  "workspace_id": "uuid",
  "workspace_slug": "acme-university",
  "target_schema_version": "1.1.0",
  "correlation_id": "uuid",
  "snapshot_metadata": {
    "location": "s3://backups/...",
    "snapshot_id": "uuid"
  },
  "migrations_to_apply": [
    {
      "filename": "002_license_engine.sql",
      "checksum": "sha256_hex",
      "target_version": "1.1.0"
    }
  ]
}
```

#### Execution Phase: SNAPSHOT CREATION (Pre-Migration)

```
Phase: SNAPSHOT_CREATION
Trigger: After job is dequeued, before any SQL execution

Steps:
  1. Acquire workspace write lock
     - Mechanism: SELECT ... FOR UPDATE on master_db.tenants_registry
     - Timeout: 60 seconds
     - If cannot acquire: Retry job (exponential backoff)

  2. Validate license (re-check)
     - Query: master_db.licenses WHERE workspace_id
     - Confirm: status = ACTIVE
     - If SOFT_LOCKED: Skip migration, log CRITICAL, release lock, exit SUCCESS
     - If ARCHIVED: Skip migration, log CRITICAL, release lock, exit FAILURE

  3. Create snapshot
     - Execute: pg_dump / backup command on tenant_db
     - Store: S3 or blob storage
     - Record: master_db.upgrade_snapshots {snapshot_id, workspace_id, location, size}
     - Idempotency: (workspace_id, target_schema_version, migration_file_hash) → skip if exists

  4. Log Structured Event
     - Level: INFO
     - Event: "snapshot_created"
     - Include: snapshot_id, size_bytes, location

  5. Proceed to MIGRATION_EXECUTION
```

**Failure Handling (Snapshot Phase):**

```
Failure Scenario: Snapshot storage full (507 SNAPSHOT_STORAGE_FULL)
  - Write lock: Released
  - Job status: FAILED
  - DLQ: Placed (manual operator intervention)
  - Log level: CRITICAL

Failure Scenario: License became SOFT_LOCKED
  - Write lock: Released
  - Job status: SUCCESS (no error; migration skipped gracefully)
  - Snapshot retained (for audit)
  - Log level: WARNING

Failure Scenario: Lock timeout
  - Job status: RETRYABLE
  - Backoff: Exponential retry (max 3)
  - After max retries: DLQ
```

#### Execution Phase: MIGRATION EXECUTION (Transactional)

```
Phase: MIGRATION_EXECUTION
Precondition: Write lock held, license validated, snapshot created

Transaction boundary: BEGIN ... COMMIT/ROLLBACK

Steps (all in single transaction):

  1. Pre-migration validation
     - For each migration file:
       ├─ Load file from disk
       ├─ Calculate SHA-256 checksum
       ├─ Compare with checksum in job
       ├─ If mismatch: ROLLBACK + Error MIGRATION_TAMPERING_DETECTED

  2. For each migration file (in order):
     ├─ Execute SQL against tenant_db
     │  └─ All DML/DDL in single transaction
     │  └─ Isolation level: SERIALIZABLE (strict)
     │
     ├─ Record in master_db.migration_registry INSIDE transaction
     │  ├─ INSERT {
     │  │    workspace_id,
     │  │    migration_file,
     │  │    target_schema_version,
     │  │    checksum,
     │  │    applied_at: now(),
     │  │    execution_time_ms,
     │  │    status: SUCCESS
     │  │  }
     │  ├─ UNIQUE constraint (workspace_id, migration_file) enforces no duplicate
     │  └─ If insert fails (duplicate): ROLLBACK + Skip (idempotent)
     │
     ├─ Validate migration result
     │  └─ Query schema to confirm expected tables exist
     │
     └─ On error:
        ├─ Catch exception
        ├─ Log error detail
        ├─ ROLLBACK entire transaction (all-or-nothing)
        ├─ Record in migration_registry status: FAILED
        ├─ Return error response

  3. Update version metadata (in same transaction)
     ├─ UPDATE tenant_db.schema_version SET version = target_schema_version
     ├─ UPDATE master_db.tenants_registry SET schema_version = target_schema_version
     ├─ Update master_db.licenses product_version (if required by migration header)

  4. Commit transaction
     └─ All or nothing: If any step fails, entire transaction rolls back

  5. Release workspace write lock
     └─ Lock auto-released on transaction commit
```

**Idempotency Enforcement:**

```
Behavior on Retry (same migration already executed):

  1. Check master_db.migration_registry
     - Query: WHERE workspace_id = ? AND migration_file = ?
     - If found with status = SUCCESS:
       └─ Log: "Migration already applied, skipping"
       └─ Skip SQL execution
       └─ Return: upgrade_status = SUCCESS

  2. If found with status = FAILED:
     - Log: "Previous execution failed, re-attempting"
     - Re-execute SQL (idempotent operations only)

  3. If not found:
     - Execute normally

Constraint: UNIQUE(workspace_id, migration_file) prevents duplicate inserts
```

#### Error Handling (Migration Phase)

```
Error: MIGRATION_SYNTAX_ERROR (400)
  - Transaction: ROLLBACK
  - Status: FAILED
  - Action: Log error detail, place in DLQ
  - Response: Include failed statement in error message (sanitized)

Error: MIGRATION_SEQUENCE_GAP (500)
  - Detected: If migration 003.sql exists but 002.sql missing
  - Transaction: ROLLBACK
  - Status: FAILED
  - Action: Refuse deployment (operator must restore consistency)

Error: DATABASE_UNAVAILABLE (503)
  - Transaction: ROLLBACK
  - Status: RETRYABLE
  - Action: Exponential backoff retry

Error: LOCK_TIMEOUT (504)
  - Transaction: ROLLBACK
  - Status: RETRYABLE
  - Action: Exponential backoff retry (max 3)

Error: PARTIAL_FAILURE (500)
  - Detected: One migration succeeds, next fails
  - Transaction: ROLLBACK (entire transaction)
  - Status: FAILED
  - Workspace state: Unchanged (before transaction started)
```

#### Completion Phase: LOG & METRICS

```
Phase: COMPLETION_LOGGING
Trigger: After transaction commit/rollback

Structured Log Entry (if SUCCESS):
  {
    "timestamp": "2026-02-16T10:30:45Z",
    "level": "INFO",
    "service": "migration-engine",
    "correlation_id": "uuid",
    "workspace_slug": "acme-university",
    "workspace_id": "uuid",
    "event": "migration_completed",
    "upgrade_id": "uuid",
    "migration_file": "002_license_engine.sql",
    "target_schema_version": "1.1.0",
    "previous_schema_version": "1.0.0",
    "execution_time_ms": 1245,
    "snapshot_id": "uuid",
    "status": "SUCCESS"
  }

Metrics Emitted:
  - schema_migration_duration_ms [gauge] = 1245
  - schema_migration_success_total [counter] += 1
  - workspace_schema_version [gauge, labeled by workspace_id] = 1.1.0

If FAILED:
  - schema_migration_failure_total [counter] += 1
  - error_code [logged] = MIGRATION_SYNTAX_ERROR
  - error_message [logged, sanitized]
```

---

### 3. Frontend Layer (Minimal)

#### UI Constraints

**Permitted:**

- Read-only schema version display (from API cache)
- Upgrade status polling (GET endpoint)
- Upgrade confirmation dialog (idempotent POST)
- Simple error message display

**Forbidden:**

- Schema introspection or validation logic
- Direct database connections
- Version comparison calculations
- Retry logic (backend handles)
- Human-readable error recovery (show error, direct to support)

#### API Consumption

```
Frontend calls:
  1. GET /api/admin/workspace/{id}/current-state → Display version + compatibility
  2. POST /api/admin/workspace/{id}/upgrade → Queue upgrade
  3. GET /api/admin/workspace/{id}/upgrade/{upgrade_id} → Poll status
  4. Display result or error message

No business logic in frontend.
All validation happens server-side.
```

---

### 4. MMC / Backoffice Scope

#### Commercial Authority

**Backoffice Allowed:**

- View migration history (read-only)
- View upgrade status (read-only)
- Approve manual operators to trigger upgrades (RBAC)
- Monitor per-workspace upgrade schedule

**Backoffice Forbidden:**

- Execute schema migrations directly
- Modify schema_version or product_version
- Approve exceptions to SemVer rules
- Trigger rollbacks (requires ADR approval)

#### Authorization Model

```
Roles:
  PLATFORM_OPERATOR
    ├─ Rights: POST /api/admin/workspace/{id}/upgrade
    ├─ Rights: POST /api/admin/workspace/{id}/upgrade/{id}/rollback
    ├─ Rights: View migration_registry (cross-tenant)
    └─ Audit logged: operator_id recorded in migration_registry

  WORKSPACE_ADMIN
    ├─ Rights: View own migration_registry (filtered by workspace_id)
    ├─ Rights: View own schema_version
    └─ Forbidden: Execute upgrades (must request platform operator)

  WORKSPACE_USER
    ├─ Rights: None (migration is platform-level operation)
    └─ Observation: Blocked with 426 if workspace incompatibly versioned
```

---

---

## Database Impact

### Master Database Changes

#### Tables Touched

**1. NEW: platform_settings**

```sql
CREATE TABLE platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  current_schema_version VARCHAR(20) NOT NULL,
  minimum_supported_schema_version VARCHAR(20) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);

-- Insert singleton record at platform init
INSERT INTO platform_settings (current_schema_version, minimum_supported_schema_version)
VALUES ('1.0.0', '1.0.0');
```

**Migration Required:** YES (STAGE_02C bootstrap)  
**Version Bump:** N/A (platform init; no version history for this table)

---

**2. NEW: migration_registry**

```sql
CREATE TABLE migration_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  migration_file VARCHAR(255) NOT NULL,
  target_schema_version VARCHAR(20) NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT now(),
  execution_time_ms INT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
  error_message TEXT,
  operator_id UUID,
  snapshot_id UUID,
  UNIQUE(workspace_id, migration_file)
);

CREATE INDEX idx_migration_registry_workspace_applied
  ON migration_registry(workspace_id, applied_at DESC);
CREATE INDEX idx_migration_registry_status_applied
  ON migration_registry(status, applied_at DESC);
CREATE INDEX idx_migration_registry_workspace_version
  ON migration_registry(workspace_id, target_schema_version);
```

**Migration Required:** YES (STAGE_02C bootstrap)  
**Version Bump:** N/A (audit table)

---

**3. NEW: upgrade_snapshots**

```sql
CREATE TABLE upgrade_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  previous_schema_version VARCHAR(20) NOT NULL,
  target_schema_version VARCHAR(20) NOT NULL,
  snapshot_location VARCHAR(512) NOT NULL UNIQUE,
  snapshot_size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  retention_policy VARCHAR(50) NOT NULL CHECK (retention_policy IN ('MANUAL', 'AUTO_DELETE_30D')),
  restored_at TIMESTAMPTZ
);

CREATE INDEX idx_upgrade_snapshots_workspace_created
  ON upgrade_snapshots(workspace_id, created_at DESC);
CREATE INDEX idx_upgrade_snapshots_expires
  ON upgrade_snapshots(expires_at) WHERE restored_at IS NULL;
```

**Migration Required:** YES (STAGE_02C bootstrap)  
**Version Bump:** N/A (metadata table)

---

**4. MODIFIED: tenants_registry**

```sql
ALTER TABLE tenants_registry
ADD COLUMN schema_version VARCHAR(20) DEFAULT '1.0.0' NOT NULL;

CREATE INDEX idx_tenants_registry_schema_version
  ON tenants_registry(schema_version);
```

**Migration Required:** YES (bootstrap adds column)  
**Version Bump:** YES (schema_version = "1.0.0.1" patch for STAGE_02C)

---

**5. ASSUMED EXISTING: licenses**

```
Assumed to contain:
  - product_version VARCHAR(20)
  - workspace_id UUID (unique)
  - status VARCHAR(50)

No changes in STAGE_02C (already defined in STAGE_02B)
```

---

#### Migration Sequencing

**Master migrations execution:**

```
Boot sequence (single transaction):
  1. Create platform_settings
  2. Create migration_registry
  3. Create upgrade_snapshots
  4. Add schema_version column to tenants_registry
  5. Populate tenants_registry.schema_version = '1.0.0'
  6. Commit

If any fails: App refuses to boot
```

---

### Tenant Database Changes

#### Tables Touched

**1. NEW: schema_version**

```sql
CREATE TABLE schema_version (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(20) NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT now()
);

-- Insert singleton record at tenant provisioning
INSERT INTO schema_version (version) VALUES ('1.0.0');
```

**Migration Required:** YES (for each tenant, applied during provisioning)  
**schema_version Change:** Tenant begins at "1.0.0"

---

#### Version Tracking

```
SCHEMA_VERSION table semantics:
  - Singleton: Always exactly 1 row per tenant_db
  - Update: SET version = ? WHERE id = ? (simple update)
  - Never: DELETE or INSERT additional rows
  - Read: SELECT version FROM schema_version (authoritative source of truth)
```

---

### Version Bump Strategy

**Tenant DB schema_version:**

- Initial: "1.0.0" (at provisioning time)
- Increments: Forward-only via migrations
- Example progression: 1.0.0 → 1.0.1 (patch) → 1.1.0 (minor) → 2.0.0 (major)

**Master DB tenants_registry.schema_version:**

- Synchronized with tenant_db at each successful upgrade
- Dual-write pattern: Both update in same transaction or not at all
- Purpose: Fast compatibility checks without querying all 1000s of tenant_dbs

**master_db.platform_settings.current_schema_version:**

- Represents "latest available version" after platform deployment
- Increments when new migrations are deployed
- Example: Platform ships upgrade to v1.1.0 → Sets current_schema_version = "1.1.0"

---

---

## Transaction Design

### Master Upgrade Transaction

**Trigger:** Platform deployment (app boot)

**Scope:** Single BEGIN...COMMIT/ROLLBACK block

```
BEGIN TRANSACTION
  ├─ FOR EACH migration file (in alphabetical order, sequential):
  │  ├─ Load migration SQL
  │  ├─ Validate checksum against known good
  │  ├─ Execute SQL (DDL/DML)
  │  ├─ Record execution in app-level registry (not DB table during boot)
  │  └─ On error: ROLLBACK, refuse app boot
  │
  ├─ After all migrations succeed:
  │  ├─ UPDATE platform_settings SET current_schema_version = latest
  │  └─ INSERT into platform_audit_log
  │
  └─ COMMIT

On COMMIT: All migrations atomically visible; app proceeds
On ROLLBACK: No migrations applied; app exits with error
```

**Isolation Level:** READ_UNCOMMITTED (acceptable; only master writes at boot)  
**Rollback Behavior:** App cannot start; operator must investigate and fix

---

### Tenant Upgrade Transaction (Worker)

**Trigger:** POST /api/admin/workspace/{id}/upgrade (accepted)

**Scope:** Single BEGIN...COMMIT/ROLLBACK block

```
BEGIN TRANSACTION
  │
  ├─ Phase 1: Pre-validation
  │  ├─ Checksum validation for all migration files
  │  ├─ Sequence gap detection (001 exists, 002 exists, 003 missing → reject)
  │  └─ License compatibility check
  │
  ├─ Phase 2: Schema mutations
  │  ├─ FOR EACH migration file:
  │  │  ├─ Execute SQL against tenant_db (within transaction)
  │  │  ├─ INSERT migration_registry record (within transaction)
  │  │  └─ Validate result
  │  │
  │  ├─ UPDATE tenant_db.schema_version
  │  │  └─ SET version = target_schema_version
  │  │
  │  ├─ UPDATE master_db.tenants_registry
  │  │  └─ SET schema_version = target_schema_version
  │  │
  │  └─ UPDATE master_db.licenses
  │     └─ SET product_version = ? (if required by migration header)
  │
  └─ COMMIT or ROLLBACK
     - COMMIT: All changes persist, write lock released
     - ROLLBACK: Zero changes, workspace schema unchanged
```

**Isolation Level:** SERIALIZABLE (strict; prevents concurrent tenant writes)

**Rollback Behavior:** Entire upgrade reverted; workspace remains on previous version; snapshot
retained

---

### Concurrency Protection

**Write Lock Mechanism:**

```
Acquire:
  SELECT * FROM tenants_registry
  WHERE workspace_id = ?
  FOR UPDATE

  -- If obtained: Lock held until transaction commit/rollback
  -- If not available: Wait (up to 60s timeout)

Hold:
  -- Write lock prevents concurrent:
  --   - Other upgrades to same workspace
  --   - Exam submissions (blocked with 423 UNAVAILABLE)
  --   - User attempts (blocked with 423 UNAVAILABLE)
  -- Reads (SELECT) still allowed

Release:
  COMMIT or ROLLBACK
  -- Lock auto-released on transaction end
```

**Double-Submit Prevention:**

```
Scenario: User clicks "Upgrade" button twice
  └─ First request acquires lock, starts migration
  └─ Second request tries to acquire lock
     └─ Waits (blocks HTTP request)
     └─ First migration completes, lock released
     └─ Second request acquires lock
     └─ Checks migration_registry: Already applied
     └─ Returns: Already completed (idempotent response)
```

---

---

## Idempotency Plan

### Migration File Idempotency

**Constraint:** All SQL statements in migration files must be idempotent (safe to replay multiple
times)

**Safe Patterns:**

```sql
-- SAFE: Creates object only if not exists
CREATE TABLE IF NOT EXISTS licenses (...)
CREATE INDEX IF NOT EXISTS idx_licenses_workspace ON licenses(workspace_id)
ALTER TABLE IF EXISTS license_events ADD COLUMN IF NOT EXISTS ...

-- SAFE: Upsert (idempotent data change)
INSERT INTO ... ON CONFLICT (unique_key) DO UPDATE SET ... = ...

-- SAFE: Idempotent version set
UPDATE schema_version SET version = '1.1.0' WHERE id = (SELECT id FROM schema_version LIMIT 1)
```

**Unsafe Patterns (FORBIDDEN):**

```sql
-- UNSAFE: Fails if table already exists
CREATE TABLE licenses (...)

-- UNSAFE: Fails if index already exists
CREATE INDEX idx_licenses_workspace ON licenses(workspace_id)

-- UNSAFE: Non-idempotent counter update
UPDATE license_counts SET count = count + 1

-- UNSAFE: Destructive (removes data)
INSERT INTO licenses VALUES (...);  -- No IF NOT EXISTS check
IF RETRY → Duplicate error
```

---

### Upgrade Idempotency

**Idempotency Key:** `(workspace_id, migration_file)`

**Duplicate Detection:**

```
Attempt 1 (successful):
  ├─ Check migration_registry
  │  └─ No record found
  ├─ Execute migration SQL
  ├─ INSERT migration_registry {status: SUCCESS}
  └─ Return: upgrade_status = SUCCESS

Attempt 2 (same upgrade, immediate retry):
  ├─ Check migration_registry
  │  └─ Record found with status = SUCCESS
  ├─ Skip SQL execution (log: already applied)
  └─ Return: upgrade_status = SUCCESS (idempotent response)

Attempt 3 (after 30 minute gap, same upgrade):
  ├─ Check migration_registry
  │  └─ Record found with status = SUCCESS
  ├─ Skip SQL execution
  └─ Return: upgrade_status = SUCCESS
```

**Unique Constraint Enforcement:**

```sql
UNIQUE(workspace_id, migration_file) in migration_registry
-- Prevents duplicate inserts at DB level
-- If retry attempts INSERT, constraint violation caught
-- Application skips already-executed migration
```

---

### Snapshot Idempotency

**Snapshot Idempotency Key:** `(workspace_id, migration_file_checksum)`

```
Attempt 1 (snapshot creation):
  ├─ Create backup
  ├─ INSERT upgrade_snapshots {snapshot_id, location}
  └─ migration_registry references snapshot_id

Retry (same upgrade):
  ├─ Check upgrade_snapshots
  │  └─ Record exists with same checksum
  ├─ Reuse existing snapshot (don't create duplicate)
  ├─ Proceed with migration
  └─ Result: Single snapshot, multiple potential refs
```

---

### Replay After Partial Failure

**Scenario:** Migration fails midway; worker retries

```
Execution 1 (partial failure):
  ├─ Migration 001 succeeds → Record: SUCCESS
  ├─ Migration 002 fails (syntax error) → Record: FAILED
  └─ ROLLBACK entire transaction (all-or-nothing)

Retry (exponential backoff: 1s, 2s, 4s):
  ├─ Check migration_registry
  │  ├─ 001: status = SUCCESS (skip? no, idempotent so safe to re-run)
  │  ├─ 002: status = FAILED (re-attempt)
  │  └─ BEGIN new transaction
  ├─ Execute 001 (idempotent, no-op)
  ├─ Execute 002 (retry, may succeed this time)
  └─ If 002 succeeds, commit, else rollback and retry
```

**Key:** Individual migration scripts must be idempotent; entire script re-runs on retry.

---

---

## Version Enforcement Strategy

### Schema Version Validation Points

**1. Runtime Resolver (Every Request)**

```
On every workspace-bound request:
  ├─ Extract workspace_id from request context
  ├─ Validate license via LICENSE_MIDDLEWARE (first)
  ├─ Read platform_settings.minimum_supported_schema_version
  ├─ Read tenant_db.schema_version (or cache from master_db)
  ├─ Compare: tenant_version ≥ minimum_supported?
  │  ├─ YES: Proceed to business logic
  │  └─ NO: Return 426 Upgrade Required
  │
  └─ If schema_version fetch fails (DB error): Return 503 DATABASE_UNAVAILABLE
```

**Response on Incompatibility (426):**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SCHEMA_VERSION_MISMATCH",
    "message": "Workspace schema version 1.0.0 below minimum supported 2.0.0. Please upgrade."
  }
}
```

---

**2. Migration Pre-Execution (Worker)**

```
Before running migration:
  ├─ Read migration file header: "Required Minimum Product Version: X.Y.Z"
  ├─ Query master_db.licenses.product_version for workspace
  ├─ Compare: product_version ≥ required_minimum?
  │  ├─ YES: Proceed to migration
  │  └─ NO: Return 400 PRODUCT_VERSION_INCOMPATIBLE
  │
  └─ Do not proceed if incompatible
```

---

**3. Upgrade Request Validation (API)**

```
POST /api/admin/workspace/{id}/upgrade

Input validation:
  ├─ Validate target_schema_version format (SemVer)
  │  └─ If invalid: 400 INVALID_VERSION_FORMAT
  │
  ├─ Query master_db.platform_settings.minimum_supported_schema_version
  ├─ Compare: target_version ≥ minimum_supported?
  │  ├─ YES: Proceed
  │  └─ NO: Return 400 UPGRADE_TO_OBSOLETE_VERSION
  │
  ├─ Compare: target_version > current_tenant_version?
  │  ├─ YES: Proceed (forward upgrade)
  │  └─ NO: Return 400 CANNOT_DOWNGRADE (downgrades not allowed)
  │
  └─ Check: No migration gap between current and target
     └─ If gap detected: Return 500 MIGRATION_SEQUENCE_GAP
```

---

### Backward Compatibility Strategy

**Principle:** Tenants may lag platform version; forward-only upgrades only.

```
Timeline:
  T=0: Platform ships v1.0.0
       All tenants: 1.0.0

  T=1: Platform ships v1.1.0 (MINOR, additive)
       Backlog check: Must support v1.0.0 runtime
       - New columns marked nullable? YES
       - Old code sees new columns as NULL? YES
       - Old tables still work? YES
       Tenants opt-in to upgrade (some stay at 1.0.0)

  T=2: Platform ships v2.0.0 (MAJOR, breaking)
       minimum_supported_schema_version = "2.0.0"
       - All tenants now see 426 errors until upgraded
       - Forced upgrade (opt-in window, then cutoff)

  T=3: Tenant upgrades to 2.0.0
       - Runtime resolves schema_version = 2.0.0
       - Requests now proceed

Key constraint: Old code running v1.0.0 logic cannot see breaking changes introduced in v2.0.0
But: v1.0.0 code CAN see additive changes (new nullable columns) safely
```

---

### Version Bump Requirements

**PATCH (1.0.0 → 1.0.1):**

```
Allowed:
  ├─ Bug fixes to SQL logic
  ├─ Logging improvements
  ├─ Index optimization
  ├─ Non-structural validation changes

Forbidden:
  ├─ Schema changes
  ├─ API contract changes

PATCH migrations: No migration_registry entry needed (no schema change)
```

**MINOR (1.0.0 → 1.1.0):**

```
Allowed:
  ├─ ADD TABLE
  ├─ ADD COLUMN (nullable or with default)
  ├─ ADD INDEX
  ├─ New API fields (non-breaking)
  ├─ New feature flags

Constraints:
  ├─ Cannot remove or rename columns
  ├─ Cannot change data shape
  ├─ Must not break existing clients

MINOR migrations: Recorded in migration_registry; update schema_version
```

**MAJOR (1.0.0 → 2.0.0):**

```
Allowed:
  ├─ DROP TABLE
  ├─ DROP COLUMN
  ├─ RENAME COLUMN
  ├─ ALTER COLUMN type (breaking)
  ├─ Permission model changes
  ├─ Behavior contract changes

Constraints:
  ├─ Requires explicit operator approval
  ├─ Requires migration window (opt-in period, then cutoff)
  ├─ Requires rollback strategy (snapshot restoration)

MAJOR migrations: Requires ADR or architecture approval before deployment
```

---

---

## Authoritative Time Handling

### Server-Authoritative Time

**Source of Truth:** Database server clock (`CURRENT_TIMESTAMP`)

**Usage Points:**

```
1. Migration execution timestamps
   └─ applied_at := CURRENT_TIMESTAMP
   └─ Timestamp stored in migration_registry
   └─ Server time is authority (not client time)

2. Snapshot creation time
   └─ created_at := CURRENT_TIMESTAMP
   └─ Timeout calculation: expires_at = created_at + 30 days
   └─ Rotation job uses server time to determine expiry

3. Version update completion
   └─ schema_version.applied_at := CURRENT_TIMESTAMP
   └─ Audit entry timestamp for version change

4. Lock acquisition timestamp
   └─ For monitoring purposes (when lock held)
```

---

### No Client Time Trust

**Forbidden:**

- Client-reported "start time" for upgrade duration
- Client-reported "deadline" for migration completion
- Client-reported "snapshot creation time"

**Interception:**

```
If client sends timestamp in HTTP request body:
  ├─ Ignore it
  ├─ Overwrite with CURRENT_TIMESTAMP server-side
  └─ Log warning if client time ≠ server time (drift detection)
```

---

### Timeout Validation (Server Clock)

```
Scenario: Upgrade takes (supposedly) 10 minutes

Implementation:
  ├─ Job starts: NOW_START = CURRENT_TIMESTAMP
  ├─ Job running...
  ├─ Job finishes: NOW_END = CURRENT_TIMESTAMP
  ├─ Duration_actual = NOW_END - NOW_START
  └─ execution_time_ms stored in migration_registry

Timeout enforcement:
  ├─ IF (NOW_END - NOW_START) > MAX_MIGRATION_TIMEOUT (30 min default)
  │  └─ Kill query (connection timeout)
  │  └─ Abort upgrade, return 504 MIGRATION_LOCK_TIMEOUT
  └─ Else: proceed normally
```

---

---

## Observability & Logging

### Structured Logging Format

**All migration operations must emit structured logs to:**

- Centralized logging service (ELK, Datadog, etc.)
- Correlation ID propagated across all services
- Structured JSON format (not human text logs)

### Required Fields (Every Log Entry)

```json
{
  "timestamp": "2026-02-16T10:30:45.123Z",
  "level": "INFO|WARNING|ERROR|CRITICAL",
  "service": "migration-engine",
  "correlation_id": "uuid",
  "workspace_slug": "acme-university",
  "workspace_id": "uuid",
  "event": "migration_started|migration_completed|migration_failed|snapshot_created|license_validated",
  "user_id": "uuid (if available)",
  "operator_id": "uuid (if manual operation)"
}
```

### Event-Specific Fields

**Event: migration_started**

```json
{
  "upgrade_id": "uuid",
  "migration_file": "filename.sql",
  "target_schema_version": "1.1.0",
  "snapshot_id": "uuid"
}
```

**Event: migration_completed**

```json
{
  "upgrade_id": "uuid",
  "migration_file": "filename.sql",
  "target_schema_version": "1.1.0",
  "execution_time_ms": 1245,
  "status": "SUCCESS",
  "previous_schema_version": "1.0.0"
}
```

**Event: migration_failed**

```json
{
  "upgrade_id": "uuid",
  "migration_file": "filename.sql",
  "target_schema_version": "1.1.0",
  "execution_time_ms": 523,
  "status": "FAILED",
  "error_code": "MIGRATION_SYNTAX_ERROR",
  "error_message": "Syntax error in SQL statement (sanitized, no raw trace)"
}
```

**Event: snapshot_created**

```json
{
  "snapshot_id": "uuid",
  "workspace_id": "uuid",
  "snapshot_location": "s3://backups/...",
  "snapshot_size_bytes": 1048576,
  "retention_policy": "AUTO_DELETE_30D"
}
```

**Event: license_validated**

```json
{
  "workspace_id": "uuid",
  "license_status": "ACTIVE|SOFT_LOCKED|ARCHIVED",
  "product_version": "1.5.0",
  "validation_result": "ALLOWED|FORBIDDEN"
}
```

---

### Metrics Emission

**Prometheus metrics emitted at migration completion:**

```
metric: schema_migration_duration_ms [gauge]
  └─ labels: workspace_id, workspace_slug, status
  └─ value: execution_time_ms

metric: schema_migration_success_total [counter]
  └─ labels: workspace_id, migration_file, target_version
  └─ increment: +1 on SUCCESS

metric: schema_migration_failure_total [counter]
  └─ labels: workspace_id, error_code
  └─ increment: +1 on FAILED

metric: workspace_schema_version [gauge]
  └─ labels: workspace_id
  └─ value: current_schema_version (numeric, e.g., 1.1.0 → 110)

metric: migration_registry_entries_total [gauge]
  └─ labels: status (SUCCESS|FAILED)
  └─ value: COUNT(*) FROM migration_registry WHERE status = ?
```

---

### No Console Logs

**Forbidden:**

- `console.log()`
- `console.error()`
- `console.debug()`
- Any print-to-stdout in production code

**Required:**

- Structured logging via logger service
- All logs sent to centralized aggregation
- Logs correlated by correlation_id

---

---

## Rate Limiting

### Upgrade Endpoint Classification

**Endpoint:** POST /api/admin/workspace/{id}/upgrade  
**Classification:** Admin-only, workspace-scoped, mutating

### Rate Limit Policy

```
Limit 1: Concurrent upgrades per workspace
  ├─ Max: 1 active upgrade per workspace
  ├─ Enforcement: Write lock (FIFO queue in Worker)
  ├─ Second request: Blocked with 409 Conflict ("Upgrade in progress")

Limit 2: Upgrade attempts per hour per workspace
  ├─ Max: 5 attempts per hour per workspace
  ├─ Enforcement: Query migration_registry, count last 60 minutes
  ├─ Exceed: 429 Too Many Requests

Limit 3: Concurrent snapshot creations
  ├─ Max: No per-workspace limit (but global disk quota)
  ├─ Enforcement: Storage system limits (e.g., S3 rate limiting)
  ├─ Exceed: 507 Snapshot Storage Full

Limit 4: Worker queue depth
  ├─ Max: 100,000 jobs in queue (platform limit)
  ├─ Exceed: Queue backlog (jobs delayed, not rejected)
  ├─ Monitoring: Alert if queue depth > 50,000
```

---

### Abuse Mitigation

```
Scenario: Attacker spam-submits upgrade requests
  └─ Request 1: Accepted, queued
  └─ Request 2: Within 60s, rejected 409 Conflict
  └─ Request 3: Rejected 429 Too Many Requests (5 attempts/hour exceeded)
  └─ After 60 minutes: Rate limit resets

Scenario: Attacker attempts massive snapshotting
  └─ Storage disk fills up
  └─ Snapshot creation fails: 507 Snapshot Storage Full
  └─ Upgrade aborted, lock released
  └─ Operator alerted, manual intervention required
```

---

### Worker Queue Protection

```
Queue characteristics:
  ├─ Name: workspace-schema-migrations
  ├─ Concurrency: 1 per workspace (FIFO by workspace_id)
  ├─ Deduplication: (workspace_id, target_version) unique
  │  └─ If duplicate submitted, second waits for first completion
  ├─ Retry: Exponential backoff (1s, 2s, 4s)
  ├─ Max retries: 3
  ├─ DLQ: After max retries
  └─ No rate limiting at queue level (enforcement at HTTP layer)
```

---

---

## Failure Modes & Recovery

### Failure Matrix & Recovery Strategies

#### F1. Migration Syntax Error (400)

```
Detection:
  └─ SQL parser fails during migration execution

Behavior:
  ├─ Transaction: ROLLBACK (all-or-nothing)
  ├─ Workspace schema: Unchanged (before-transaction state)
  ├─ migration_registry: Record status = FAILED
  ├─ Snapshot: Retained (not consumed)
  ├─ Job status: Placed in DLQ (manual operator intervention)

Recovery:
  ├─ Operator reviews error message
  ├─ Operator fixes migration file
  ├─ Operator resubmits upgrade (new job)
  └─ Retry from clean state (idempotent, safe)

Response:
  {
    "success": false,
    "data": null,
    "error": {
      "code": "MIGRATION_SYNTAX_ERROR",
      "message": "Syntax error in SQL statement (line 15)"
    }
  }
```

---

#### F2. Snapshot Creation Failure (507)

```
Detection:
  └─ Backup storage full or unreachable

Behavior:
  ├─ Write lock: Released (no migration attempted)
  ├─ migration_registry: No entry
  ├─ Job status: RETRYABLE (exponential backoff)
  ├─ User impact: Upgrade blocked, can retry

Recovery:
  ├─ Operator investigates storage
  ├─ Operator frees space or allocates new storage
  ├─ Automatic retry (exponential backoff)
  ├─ Or manual retry by operator
  └─ Upgrade proceeds once storage available

Response:
  {
    "success": false,
    "data": null,
    "error": {
      "code": "SNAPSHOT_STORAGE_FULL",
      "message": "Cannot create snapshot: storage full"
    }
  }
```

---

#### F3. License Became SOFT_LOCKED (423)

```
Detection:
  └─ License status changed after HTTP acceptance, before migration

Behavior:
  ├─ Write lock: Acquired
  ├─ License re-check: Fails (status = SOFT_LOCKED)
  ├─ Migration execution: SKIPPED (graceful degradation)
  ├─ Snapshot: Created (for audit trail)
  ├─ Job status: SUCCESS (no error condition)
  ├─ Log level: WARNING
  ├─ migration_registry: Record created, status = SUCCESS (operation was "skip")

Recovery:
  ├─ License operator transitions license back to ACTIVE
  ├─ Workspace admin retries upgrade
  ├─ Upgrade proceeds normally
  └─ Snapshot from previous attempt can be referenced

Response (to GET status endpoint):
  {
    "success": true,
    "data": {
      "status": "SUCCESS",
      "notes": "Migration skipped: license was SOFT_LOCKED"
    },
    "error": null
  }
```

---

#### F4. Workspace Upgrade In Progress (409)

```
Detection:
  └─ User attempts upgrade while previous upgrade still running

Behavior:
  ├─ Second HTTP request: Rejected immediately (409 Conflict)
  ├─ No queuing at HTTP layer
  ├─ Worker queue: Handles internal serialization

Recovery:
  ├─ User waits for first upgrade to complete
  ├─ User polls GET /api/admin/workspace/{id}/upgrade/{id}
  ├─ User retries upgrade after completion

Response:
  {
    "success": false,
    "data": null,
    "error": {
      "code": "WORKSPACE_UPGRADE_IN_PROGRESS",
      "message": "Upgrade already in progress. Try again after completion."
    }
  }
```

---

#### F5. Checksum Mismatch (500)

```
Detection:
  └─ Migration file checksum ≠ expected value (file tampering or corruption)

Behavior:
  ├─ Transaction: ROLLBACK (before any SQL execution)
  ├─ migration_registry: Record status = FAILED
  ├─ Error code: MIGRATION_TAMPERING_DETECTED
  ├─ Log level: CRITICAL (security alert)
  ├─ Audit trail: operator_id logged

Recovery:
  ├─ Operator reviews file integrity
  ├─ Operator verifies source (Git, artifact storage)
  ├─ Operator either:
  │  ├─ Restores correct file and retries
  │  └─ Approves override (with ADR exception if needed)
  └─ Manual remediation only (no auto-retry)

Response:
  {
    "success": false,
    "data": null,
    "error": {
      "code": "MIGRATION_TAMPERING_DETECTED",
      "message": "Checksum mismatch. File integrity compromised."
    }
  }
```

---

#### F6. Migration Sequence Gap (500)

```
Detection:
  └─ Migration files: 001.sql, 002.sql missing, 003.sql exists

Behavior:
  ├─ Transaction: ROLLBACK (before any SQL execution)
  ├─ migration_registry: No entry
  ├─ Error code: MIGRATION_SEQUENCE_GAP
  ├─ Log level: CRITICAL (deployment error)

Recovery:
  ├─ Operator reviews deployment artifact
  ├─ Operator identifies missing migration file
  ├─ Operator restores file from artifact storage
  ├─ Operator retries deployment
  └─ Migration proceeds once gap filled

Response:
  {
    "success": false,
    "data": null,
    "error": {
      "code": "MIGRATION_SEQUENCE_GAP",
      "message": "Migration sequence broken: 002.sql missing"
    }
  }
```

---

#### F7. Database Connection Failure (503)

```
Detection:
  └─ Cannot connect to tenant_db during migration

Behavior:
  ├─ Transaction: ROLLBACK (connection unavailable)
  ├─ Job status: RETRYABLE (exponential backoff)
  ├─ migration_registry: No entry (transaction failed)

Recovery:
  ├─ DB connection restored (auto)
  ├─ Automatic retry (exponential backoff: 1s, 2s, 4s)
  ├─ Max retries: 3
  ├─ After max retries: DLQ (manual operator intervention)
  └─ Operator may retry or investigate persistent DB issue

Response (on first attempt):
  {
    "success": false,
    "data": null,
    "error": {
      "code": "DATABASE_UNAVAILABLE",
      "message": "Cannot connect to database. Retrying..."
    }
  }
```

---

#### F8. Lock Timeout (504)

```
Detection:
  └─ Write lock cannot be acquired within 60 seconds

Behavior:
  ├─ Transaction: ROLLBACK (no lock acquired)
  ├─ Job status: RETRYABLE (exponential backoff)
  ├─ migration_registry: No entry
  ├─ Logs: Includes lock wait time, other upgrading workspace (if known)

Recovery:
  ├─ Blocking upgrade completes
  ├─ Lock released
  ├─ Automatic retry (exponential backoff)
  ├─ Max retries: 3
  └─ After max retries: DLQ

Response (on first timeout):
  {
    "success": false,
    "data": null,
    "error": {
      "code": "MIGRATION_LOCK_TIMEOUT",
      "message": "Upgrade lock timeout. Another upgrade may be in progress."
    }
  }
```

---

#### F9. Schema Mismatch at Runtime (426)

```
Detection:
  └─ Tenant schema_version < platform minimum_supported_schema_version

Behavior:
  ├─ Resolver check: Fails
  ├─ Request: Blocked before business logic
  ├─ Response: 426 Upgrade Required
  ├─ User impact: All feature requests return 426

Recovery:
  ├─ Workspace admin visits upgrade page
  ├─ Workspace admin reviews available versions
  ├─ Workspace admin initiates upgrade
  ├─ After upgrade completes: Requests proceed (no more 426)

Response:
  {
    "success": false,
    "data": null,
    "error": {
      "code": "SCHEMA_VERSION_MISMATCH",
      "message": "Workspace schema version 1.0.0 below minimum supported 2.0.0. Upgrade required."
    }
  }
```

---

#### F10. Product Version Incompatible (400)

```
Detection:
  └─ Migration requires product_version ≥ 1.5.0, but workspace at 1.2.0

Behavior:
  ├─ Migration execution: Blocked (pre-check)
  ├─ Transaction: Not attempted
  ├─ migration_registry: No entry
  ├─ Log level: WARNING

Recovery:
  ├─ Workspace product_version must be upgraded first (via license operator)
  ├─ Operator updates license.product_version
  ├─ Workspace admin retries upgrade
  ├─ Upgrade proceeds once product_version compatible

Response:
  {
    "success": false,
    "data": null,
    "error": {
      "code": "PRODUCT_VERSION_INCOMPATIBLE",
      "message": "Migration requires product version ≥ 1.5.0. Current: 1.2.0"
    }
  }
```

---

### Partial Success Handling

**Scenario:** First migration succeeds, second fails in same transaction

```
Behavior:
  ├─ Migration 001: SUCCESS (recorded in registry within transaction)
  ├─ Migration 002: FAILED (transaction rolls back)
  ├─ COMMIT/ROLLBACK: ROLLBACK (entire transaction undone)
  ├─ Final state: Schema_version unchanged (before transaction)
  ├─ migration_registry: Both entries created before rollback
  │  └─ 001: status = SUCCESS
  │  └─ 002: status = FAILED
  │
  └─ Next retry:
     ├─ Check migration_registry
     ├─ 001: Already SUCCESS, skip (idempotent)
     ├─ 002: Previously FAILED, re-attempt
     └─ If 002 succeeds: Commit (atomic with 001 idempotent skip)
```

---

### Cross-Tenant Isolation in Failure

```
Scenario: Workspace A upgrade fails

Impact:
  ├─ Workspace A: Upgrade failed, remains on previous version
  ├─ Workspace B: Unaffected (independent upgrade job)
  ├─ Master DB: No impact (workspace A failure scoped to tenant DB)
  ├─ Other tenants: Zero impact

Guarantee:
  └─ Failure isolation: One workspace cannot break another
```

---

---

## Rate Limiting & Abuse Protection

### Endpoint Classification

| Endpoint                                             | Classification  | Rate Limit              | Enforcement              |
| ---------------------------------------------------- | --------------- | ----------------------- | ------------------------ |
| POST /api/admin/workspace/{id}/upgrade               | Admin, mutating | 5/hour per workspace    | Query migration_registry |
| GET /api/admin/workspace/{id}/upgrade/{id}           | Admin, read     | 30/minute per workspace | In-memory counter        |
| POST /api/admin/workspace/{id}/upgrade/{id}/rollback | Admin, mutating | 2/hour per workspace    | Query migration_registry |

---

### Concurrency Protection

**Per-Workspace Serialization:**

```
Queue: workspace-schema-migrations
  └─ Concurrency: 1 job per workspace_id (FIFO)
  └─ Effect: Only 1 upgrade runs per workspace at any time
  └─ Limit across all workspaces: No hard limit (but monitor)
```

**Cross-Workspace Concurrency:**

```
Parallel upgrades:
  └─ Workspace A upgrade: Running → No impact
  └─ Workspace B upgrade: Can run simultaneously (independent pools)
  └─ Master upgrade: Blocks app boot → Prioritized
```

---

---

## Security Review

### RBAC Enforcement (Server-Side)

**Authorization checks (all server-side, never in frontend):**

```
PLATFORM_OPERATOR role:
  ├─ Required endpoint: POST /api/admin/workspace/{id}/upgrade
  ├─ Validation: Extract role from JWT token (trusted)
  ├─ On deny: 403 Forbidden
  ├─ Audit: Log operator_id in migration_registry

WORKSPACE_ADMIN role:
  ├─ Right: View own migration history
  ├─ Right: Request manual operator to upgrade
  ├─ Forbidden: Directly trigger upgrade (must request operator)
```

### Migration File Content Validation

**Three layers of validation:**

```
Layer 1: SQL Parser
  ├─ Before migration execution
  ├─ Rejects: DROP COLUMN, ALTER TABLE DROP without MAJOR approval
  ├─ Allows: CREATE TABLE IF NOT EXISTS, ADD COLUMN
  └─ Blocks destructive operations unless explicitly approved

Layer 2: SHA-256 Checksum
  ├─ Checksum stored in migration_registry
  ├─ Checksum recalculated at execution time
  ├─ Mismatch indicates tampering
  └─ Error code: MIGRATION_TAMPERING_DETECTED

Layer 3: Authorization
  ├─ Override of forbidden operations requires ADR
  ├─ Operator name logged
  ├─ Audit trail immutable
```

### Secrets Management

**Forbidden in migration files:**

- Database credentials
- API keys
- JWT secrets
- Passwords
- PII

**Implementation:**

```
- All secrets injected via environment variables (Docker secrets)
- Migration files use placeholders or defaults
- Pre-migration validator scans for common secret patterns
- Logs sanitized (error messages never include sensitive data)
```

---

---

## Layer Separation Confirmation

### ✓ Frontend (Frontoffice)

- **No business logic:** UI only displays status, no version comparison
- **No direct DB access:** All data via REST API only
- **No retry logic:** Backend handles retries; frontend shows status
- **No assumptions about schema:** No schema introspection in frontend code
- **File:** `apps/frontoffice/src/pages/admin/upgrade.vue` (or similar)

### ✓ API Layer (Router)

- **Routes provided:** POST upgrade, GET status, POST rollback
- **No migration execution:** Routes only enqueue Worker jobs
- **License middleware:** Mandatory before any route handler runs
- **Validation:** Input validation (SemVer format check)
- **File:** `apps/api/src/routes/admin/upgrade.ts`

### ✓ Domain Packages

- **Migration runner:** Pure functions for version comparison, SemVer parsing
- **No HTTP logic:** No Express/Hono code in domain packages
- **No direct Driver instantiation:** All DB access via resolver context
- **File:** `packages/domain-core/src/migration/`

### ✓ Worker

- **Sole executor:** Only Worker runs migrations
- **Transactional semantics:** Handles BEGIN/COMMIT/ROLLBACK
- **Snapshot logic:** Creates backups, manages lifecycle
- **Version metadata updates:** Atomically updates schema_version
- **File:** `apps/worker/src/jobs/schema-migration.ts`

### ✓ MMC / Backoffice

- **Read-only migration history:** Queries migration_registry (no mutations)
- **No schema modification:** No direct authority over DB changes
- **License coordination:** MMC approves product_version bumps (if needed)
- **File:** `apps/mmc/src/pages/operations/migrations.ts` (or similar)

---

---

## Testing Requirements

### Unit Tests

**Location:** `apps/api/tests/unit/migration/` + `packages/domain-core/tests/unit/migration/`

**Test Suite 1: Version Parsing & Comparison**

```
✓ parseVersion("1.2.3") → [1, 2, 3]
✓ parseVersion("1.2") → Error (must be X.Y.Z)
✓ isCompatible("1.2.3", "1.0.0") → true (1.2.3 ≥ 1.0.0)
✓ isCompatible("1.0.0", "1.2.3") → false (1.0.0 ≱ 1.2.3)
✓ isMajorBump("1.0.0", "2.0.0") → true
✓ isMinorBump("1.0.0", "1.1.0") → true
✓ isPatchBump("1.0.0", "1.0.1") → true
✓ invalidVersionFormat("1.0.0-rc1") → Error (prerelease not allowed in prod)
```

**Test Suite 2: Migration File Validation**

```
✓ validateChecksum("fileA.sql", expectedChecksum) → true
✓ validateChecksum("fileA.sql", wrongChecksum) → false
✓ extractTargetVersion("-- Migration: 1.1.0") → "1.1.0"
✓ extractTargetVersion("-- Missing header") → Error
✓ detectDestructiveOps("DROP COLUMN") → true
✓ detectDestructiveOps("ADD COLUMN IF NOT EXISTS") → false
✓ detectMigrationGap([001, 002, 004]) → Error (003 missing)
```

**Test Suite 3: Snapshot Idempotency**

```
✓ snapshotKey(workspace_id, migration_file) → unique key
✓ isSnapshotExists(key) → true/false
✓ reuseSnapshot(key) → returns existing snapshot (no duplicate created)
```

### Integration Tests

**Location:** `apps/api/tests/integration/migration/` + `apps/worker/tests/integration/migration/`

**Test Suite 4: End-to-End Upgrade (v1.0.0 → v1.1.0)**

```
Setup:
  ├─ Create test workspace with schema v1.0.0
  ├─ Create migration file v1.1.0 (additive schema change)
  ├─ Workspace license: ACTIVE, product_version compatible

Execute:
  ├─ POST /api/admin/workspace/{id}/upgrade {target: "1.1.0"}
  ├─ Assert response 202 ACCEPTED, upgrade_id returned
  ├─ Poll GET /api/admin/workspace/{id}/upgrade/{upgrade_id}
  ├─ Assert status progresses: QUEUED → IN_PROGRESS → SUCCESS

Verify:
  ├─ Query tenant_db.schema_version → "1.1.0"
  ├─ Query master_db.tenants_registry.schema_version → "1.1.0"
  ├─ Query master_db.migration_registry → SUCCESS record created
  ├─ All subsequent requests proceed (no 426 errors)
  ├─ Assert execution_time_ms recorded
  ├─ Assert snapshot_id recorded
```

**Test Suite 5: License Validation Blocks Upgrade**

```
Setup:
  ├─ Create test workspace
  ├─ Workspace license: SOFT_LOCKED

Execute:
  ├─ POST /api/admin/workspace/{id}/upgrade {target: "1.1.0"}
  ├─ Assert response 423 UNAVAILABLE (middleware rejects)

Transition:
  ├─ Update license status to ACTIVE

Retry:
  ├─ POST /api/admin/workspace/{id}/upgrade {target: "1.1.0"}
  ├─ Assert response 202 ACCEPTED, upgrade proceeds
```

**Test Suite 6: Failed Migration Rolls Back**

```
Setup:
  ├─ Create test workspace with schema v1.0.0
  ├─ Create migration v1.1.0 WITH INTENTIONAL SYNTAX ERROR
  ├─ Workspace license: ACTIVE

Execute:
  ├─ POST /api/admin/workspace/{id}/upgrade {target: "1.1.0"}
  ├─ Poll until completion (status: FAILED)
  ├─ Assert error_code: MIGRATION_SYNTAX_ERROR

Verify:
  ├─ Query tenant_db.schema_version → Still "1.0.0" (unchanged)
  ├─ Query master_db.migration_registry → Record status: FAILED
  ├─ Assert snapshot retained (for audit trail)
```

**Test Suite 7: Idempotency (Duplicate Submission)**

```
Setup:
  ├─ Create test workspace with schema v1.0.0
  ├─ Create valid migration v1.1.0

Execute First:
  ├─ POST /api/admin/workspace/{id}/upgrade {target: "1.1.0"}
  ├─ Poll until completion (status: SUCCESS)
  ├─ Assert migration_registry shows 1 SUCCESS record

Execute Second (Retry Same Command):
  ├─ POST /api/admin/workspace/{id}/upgrade {target: "1.1.0"}
  ├─ Poll until completion (status: SUCCESS)
  ├─ Assert migration_registry still shows 1 record (no duplicate)
  ├─ Assert schema_version still "1.1.0"
```

**Test Suite 8: Concurrent Upgrade Prevention**

```
Setup:
  ├─ Create test workspace with schema v1.0.0
  ├─ Create two migrations: v1.1.0 (slow, 5s) and v2.0.0 (instant)

Execute First:
  ├─ POST /api/admin/workspace/{id}/upgrade {target: "1.1.0"}
  ├─ Job dequeued (now running, will take 5s)

Execute Second (Immediate):
  ├─ POST /api/admin/workspace/{id}/upgrade {target: "2.0.0"}
  ├─ Assert response 409 CONFLICT (upgrade in progress)

Wait:
  ├─ First upgrade completes (schema_version: 1.1.0)

Verify:
  ├─ Workspace is at v1.1.0 (not skipped to 2.0.0)
  ├─ Second upgrade never executed
```

**Test Suite 9: Schema Version Blocks Runtime (426)**

```
Setup:
  ├─ Create test workspace at schema v1.0.0
  ├─ Set platform minimum_supported_schema_version = "2.0.0"

Execute:
  ├─ GET /api/exam/list (any workspace request)
  ├─ Assert response 426 UPGRADE REQUIRED

Upgrade:
  ├─ POST /api/admin/workspace/{id}/upgrade {target: "2.0.0"}
  ├─ Wait for completion

Retry:
  ├─ GET /api/exam/list
  ├─ Assert response 200 OK (request proceeds, no 426)
```

**Test Suite 10: Product Version Compatibility Check**

```
Setup:
  ├─ Create test workspace with license.product_version = "1.2.0"
  ├─ Create migration file header: "Required Minimum Product Version: 1.5.0"

Execute:
  ├─ POST /api/admin/workspace/{id}/upgrade {target: "1.1.0"}
  ├─ Assert response 400 PRODUCT_VERSION_INCOMPATIBLE

Compatibility Update:
  ├─ Update license.product_version to "1.5.0"

Retry:
  ├─ POST /api/admin/workspace/{id}/upgrade {target: "1.1.0"}
  ├─ Assert response 202 ACCEPTED, upgrade proceeds
```

---

---

## Next Steps (Task Generation)

This plan establishes the architectural foundation for implementation. The implementation will be
broken into smaller, dependency-ordered tasks by the task generation agent.

**Key implementation dependencies:**

1. ✓ Schema objects created (platform_settings, migration_registry, snapshot_registry,
   schema_version table)
2. ✓ Version validation library (SemVer parsing, compatibility checks)
3. ✓ Tenant resolver integration (schema_version checks at request time)
4. ✓ Migration runner (master and tenant execution engines)
5. ✓ Worker integration (async job processing, snapshot creation)
6. ✓ API routes (upgrade endpoint, status polling, rollback)
7. ✓ Observability (structured logging, metrics)
8. ✓ Tests (unit + integration validation)

All implementation must follow this plan without exception.

---

---

## Constitutional Compliance Statement

**Status: FULLY COMPLIANT – No Architectural Exceptions**

This plan implements STAGE_02C without violating any Zidney Constitutional rule:

✓ **Multi-Tenancy Model:** Database-per-tenant preserved; no shared tenant tables  
✓ **Isolation:** Tenant resolution mandatory; workspace_id governs all access  
✓ **License Enforcement:** Middleware mandatory before upgrade execution  
✓ **Transaction Integrity:** All-or-nothing migrations; no partial state  
✓ **Versioning Enforcement:** Runtime refuses incompatible schemas (426 contract)  
✓ **Immutability:** Migration files locked after production deployment  
✓ **Audit Trail:** All operations logged with correlation_id, workspace_slug, operator_id  
✓ **Error Handling:** Compliant with error standard; structured error responses  
✓ **Secrets:** No secrets embedded in migration files  
✓ **Testing:** Unit + integration tests mandatory before merge  
✓ **Layer Separation:** UI/API/Domain/Worker properly isolated  
✓ **No Grading Outside Worker:** Worker only executor of migrations  
✓ **Server Authoritative Time:** CURRENT_TIMESTAMP only; no client time trusted

**Binding Authority:** ADR-0008 (Semantic Versioning Policy)

---

END PLAN
