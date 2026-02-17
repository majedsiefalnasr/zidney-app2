# TASKS – Migration & Versioning Model (STAGE_02C)

**Phase:** 01 – Platform Foundation  
**Stage:** STAGE_02C_MIGRATION_AND_VERSIONING_MODEL  
**Related Plan:** plan.md  
**Related Spec:** spec.md  
**Related ADR:** ADR-0008 (Semantic Versioning Policy)  
**Total Tasks:** 47  
**Execution Model:** Dependency-ordered, sequential where required; parallel where independent

---

## Executive Summary

This task list implements the complete migration and versioning engine for Zidney. Tasks are strictly ordered by dependency, with clear transactional and idempotency requirements per Zidney Constitution.

**Key Execution Stages:**

1. **Infrastructure (Tasks 1–8):** Schema objects, version types, validation library
2. **Domain Core (Tasks 9–14):** Version logic, migration runners, tenant resolver integration
3. **API Layer (Tasks 15–22):** Routes, middleware, validation, error handling
4. **Worker Layer (Tasks 23–30):** Job processing, snapshots, transactional execution
5. **Frontend (Tasks 31–34):** API consumption, UI components, status display
6. **Observability (Tasks 35–39):** Logging, metrics, audit trail
7. **Testing (Tasks 40–47):** Unit, integration, isolation, idempotency, concurrency

---

---

## INFRASTRUCTURE TASKS (1–8)

### Task 1: Create Master DB Schema Migration File (platform_settings)

**Scope:** Master database bootstrap  
**File:** `apps/api/src/db/master/migrations/001_platform_foundation.sql`  
**Layer:** Infrastructure  
**Transactional:** N/A (DDL only)  
**Idempotent:** Yes (CREATE TABLE IF NOT EXISTS pattern)  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Create master_db bootstrap migration file that initializes:

- `platform_settings` (singleton table, tracks current_schema_version, minimum_supported_schema_version)
- Insert initial record: current_schema_version = "1.0.0", minimum_supported = "1.0.0"

**Acceptance Criteria:**

- ✓ File created at exact path
- ✓ Uses `CREATE TABLE IF NOT EXISTS` (idempotent)
- ✓ Includes migration header: `-- Migration: 1.0.0`
- ✓ Includes required columns: id (UUID, PK), current_schema_version (VARCHAR 20), minimum_supported_schema_version (VARCHAR 20), updated_at (TIMESTAMPTZ), updated_by (UUID, NULLABLE)
- ✓ Singleton enforcement comment included
- ✓ SQL is valid and parsable
- ✓ Checksum can be computed (SHA-256)

---

### Task 2: Create Master DB Schema Migration File (migration_registry)

**Scope:** Master database bootstrap  
**File:** `apps/api/src/db/master/migrations/002_migration_registry.sql`  
**Layer:** Infrastructure  
**Transactional:** N/A (DDL only)  
**Idempotent:** Yes (CREATE TABLE IF NOT EXISTS pattern)  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Create master_db migration file that initializes:

- `migration_registry` (immutable audit log, tracks all applied migrations per workspace)
- UNIQUE constraint: (workspace_id, migration_file)
- Indexes: workspace_id + applied_at DESC, status + applied_at DESC, workspace_id + target_schema_version

**Acceptance Criteria:**

- ✓ File created at exact path
- ✓ Uses `CREATE TABLE IF NOT EXISTS`
- ✓ Includes migration header: `-- Migration: 1.0.0`
- ✓ Columns: id (UUID, PK), workspace_id (UUID, FK), migration_file (VARCHAR 255), target_schema_version (VARCHAR 20), checksum (VARCHAR 64), applied_at (TIMESTAMPTZ), execution_time_ms (INT), status (VARCHAR 20 CHECK), error_message (TEXT NULLABLE), operator_id (UUID NULLABLE), snapshot_id (UUID NULLABLE)
- ✓ UNIQUE(workspace_id, migration_file) constraint enforced
- ✓ All 3 indexes created with IF NOT EXISTS
- ✓ SQL is valid and parsable

---

### Task 3: Create Master DB Schema Migration File (upgrade_snapshots)

**Scope:** Master database bootstrap  
**File:** `apps/api/src/db/master/migrations/003_upgrade_snapshots.sql`  
**Layer:** Infrastructure  
**Transactional:** N/A (DDL only)  
**Idempotent:** Yes (CREATE TABLE IF NOT EXISTS pattern)  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Create master_db migration file that initializes:

- `upgrade_snapshots` (metadata for pre-upgrade backups, enables rollback)
- UNIQUE constraint: snapshot_location (no duplicate storage locations)
- Indexes: workspace_id + created_at DESC, expires_at (for retention job)

**Acceptance Criteria:**

- ✓ File created at exact path
- ✓ Uses `CREATE TABLE IF NOT EXISTS`
- ✓ Includes migration header: `-- Migration: 1.0.0`
- ✓ Columns: id (UUID, PK), workspace_id (UUID, FK), previous_schema_version (VARCHAR 20), target_schema_version (VARCHAR 20), snapshot_location (VARCHAR 512 UNIQUE), snapshot_size_bytes (BIGINT), created_at (TIMESTAMPTZ), expires_at (TIMESTAMPTZ), retention_policy (VARCHAR 50 CHECK), restored_at (TIMESTAMPTZ NULLABLE)
- ✓ CHECK constraint on retention_policy: IN ('MANUAL', 'AUTO_DELETE_30D')
- ✓ Both indexes created with IF NOT EXISTS
- ✓ SQL is valid and parsable

---

### Task 4: Create Tenant DB Schema Migration File (schema_version)

**Scope:** Tenant database bootstrap  
**File:** `apps/api/src/db/tenant/migrations/001_schema_version.sql`  
**Layer:** Infrastructure  
**Transactional:** N/A (DDL only)  
**Idempotent:** Yes (CREATE TABLE IF NOT EXISTS pattern)  
**Version Enforcement:** N/A (bootstrap)  
**License Middleware:** N/A

**Description:**

Create tenant_db migration file that initializes:

- `schema_version` (singleton table per workspace, source of truth for tenant schema version)
- Insert initial record: version = "1.0.0", applied_at = now()

**Acceptance Criteria:**

- ✓ File created at exact path
- ✓ Uses `CREATE TABLE IF NOT EXISTS`
- ✓ Includes migration header: `-- Target Schema Version: 1.0.0`
- ✓ Columns: id (UUID, PK), version (VARCHAR 20, NOT NULL), applied_at (TIMESTAMPTZ, DEFAULT now())
- ✓ Singleton enforcement comment included
- ✓ INSERT statement uses `IF NOT EXISTS` pattern to prevent duplicates on replay
- ✓ SQL is valid and parsable

---

### Task 5: Modify Master DB tenants_registry (Add schema_version Column)

**Scope:** Master database schema evolution  
**File:** `apps/api/src/db/master/migrations/004_tenants_registry_add_schema_version.sql`  
**Layer:** Infrastructure  
**Transactional:** N/A (DDL only)  
**Idempotent:** Yes (ALTER TABLE IF NOT EXISTS pattern + index IF NOT EXISTS)  
**Version Enforcement:** YES (schema_version change)  
**License Middleware:** N/A

**Description:**

Create master_db migration file that modifies existing `tenants_registry` table:

- ADD COLUMN schema_version (VARCHAR 20, DEFAULT '1.0.0', NOT NULL)
- Rationale: Cache tenant schema version for fast compatibility checks (source of truth remains tenant_db)
- Create index: (schema_version) for batch version discovery

**Acceptance Criteria:**

- ✓ File created at exact path
- ✓ Includes migration header: `-- Target Schema Version: 1.0.0.1 (patch bump for STAGE_02C)`
- ✓ Uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS schema_version ...`
- ✓ Default value: '1.0.0'
- ✓ Create index: `CREATE INDEX IF NOT EXISTS idx_tenants_registry_schema_version ON tenants_registry(schema_version)`
- ✓ SQL is valid and parsable
- ✓ Comment explains cache pattern

---

### Task 6: Create Version Types Package

**Scope:** Type definitions for version handling  
**File:** `packages/types/src/migration.ts`  
**Layer:** Domain Core (types)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Define TypeScript types for migration and versioning:

- `SemVer` interface: `{major: number, minor: number, patch: number}`
- `MigrationStatus` enum: SUCCESS | FAILED
- `RetentionPolicy` enum: MANUAL | AUTO_DELETE_30D
- `MigrationFile` interface: filename, checksum, target_schema_version, target_product_version
- `UpgradeJob` interface: workspace_id, target_schema_version, migrations_to_apply, etc.
- `SchemaVersionRecord` interface: id, version, applied_at

**Acceptance Criteria:**

- ✓ File created at exact path
- ✓ All types exported with clear documentation
- ✓ Types use strict validation (no optional fields that should be required)
- ✓ Enums use SCREAMING_SNAKE_CASE for values
- ✓ Types conform to TypeScript best practices
- ✓ Can be imported and compiled without errors

---

### Task 7: Create Version Validation Library

**Scope:** SemVer parsing and comparison logic  
**File:** `packages/validation/src/schema-version-validator.ts`  
**Layer:** Domain Core (validation)  
**Transactional:** N/A  
**Idempotent:** N/A (pure functions)  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Implement SemVer validation functions (pure, no side effects):

- `parseVersion(versionString: string) → SemVer | throws Error`
  - Validates format: "X.Y.Z" only (no pre-releases, no normalization)
  - Returns parsed numbers
  - Throws on malformed input
- `isCompatible(tenantVersion: string, minimumRequired: string) → boolean`
  - Returns true if tenant_version ≥ minimum_required
  - Handles SemVer precedence rules
- `isMajorBump(oldVersion: string, newVersion: string) → boolean`
- `isMinorBump(oldVersion: string, newVersion: string) → boolean`
- `isPatchBump(oldVersion: string, newVersion: string) → boolean`
- `compareVersions(v1: string, v2: string) → -1 | 0 | 1`

**Acceptance Criteria:**

- ✓ File created at exact path
- ✓ All functions exported and documented
- ✓ Unit tests provided (see Task 40)
- ✓ Edge cases handled: invalid format, prerelease, empty strings
- ✓ No external dependencies (pure functions only)
- ✓ TypeScript strict mode compliant

---

### Task 8: Create Migration File Validator

**Scope:** Migration file content validation  
**File:** `packages/validation/src/migration-file-validator.ts`  
**Layer:** Domain Core (validation)  
**Transactional:** N/A  
**Idempotent:** N/A (pure functions)  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Implement migration file validation functions:

- `extractMigrationHeader(sqlContent: string) → {targetVersion, requiredProductVersion, isBreaking}`
  - Parses SQL comments at top of file
  - Extracts: `-- Migration: X.Y.Z`, `-- Required Minimum Product Version: X.Y.Z`, `-- Breaking: true/false`
  - Throws on missing required headers
- `calculateChecksum(fileContent: string) → string`
  - SHA-256 of file content (hex string)
  - Used for tampering detection
- `validateChecksum(fileContent: string, expectedChecksum: string) → boolean`
  - Compares calculated vs expected
- `detectDestructiveOperations(sqlContent: string) → string[]`
  - Scans for DROP COLUMN, ALTER TABLE ... DROP, etc.
  - Returns list of destructive operations found
  - Used to enforce MAJOR version requirement
- `detectMigrationGap(fileList: string[]) → Error | null`
  - Validates sequence: 001.sql, 002.sql, 003.sql (no gaps)
  - Returns error if 001, 002, 004 (missing 003)

**Acceptance Criteria:**

- ✓ File created at exact path
- ✓ All functions exported and documented
- ✓ Header parsing handles variations in comment format
- ✓ Checksum function is deterministic (same input = same output)
- ✓ Destructive operation detection catches common patterns
- ✓ Unit tests provided (see Task 41)
- ✓ No SQL execution (pure parsing only)
- ✓ TypeScript strict mode compliant

---

---

## DOMAIN CORE TASKS (9–14)

### Task 9: Implement Master Migration Runner

**Scope:** Platform bootstrap (executed once at app startup)  
**File:** `packages/domain-core/src/migration/master-migration-runner.ts`  
**Layer:** Domain Core (migration execution)  
**Transactional:** YES (single transaction beginning-to-end)  
**Idempotent:** YES (IF NOT EXISTS patterns in SQL)  
**Version Enforcement:** YES (updates platform_settings.current_schema_version)  
**License Middleware:** N/A

**Description:**

Implement function: `runMasterMigrations(masterDbConnection) → Promise<MigrationResult>`

Workflow:

1. Load all migration files from `apps/api/src/db/master/migrations/` in alphabetical order
2. BEGIN transaction
3. For each migration file:
   a. Checksum validation (compare with known good value or file integrity check)
   b. Execute SQL against master_db
   c. Record execution in app-level registry (not DB during boot, at least initially)
   d. On error: ROLLBACK, throw error (app refuses to boot)
4. After all succeed: UPDATE platform_settings.current_schema_version = latest_version
5. COMMIT
6. Log completion with correlation_id

Error handling:

- Syntax error → ROLLBACK, throw with error detail (sanitized)
- Sequence gap → ROLLBACK, throw "Migration sequence broken"
- DB unavailable → ROLLBACK, throw "Cannot connect to database"

**Acceptance Criteria:**

- ✓ Function signature correct (connection, returns Promise<MigrationResult>)
- ✓ Loads migration files sequentially
- ✓ Validates SQLsyntax before execution
- ✓ Updates platform_settings atomically
- ✓ All-or-nothing transaction semantics
- ✓ Detailed error messages (but sanitized, no raw stack traces)
- ✓ Logs structured JSON with correlation_id
- ✓ Unit tests cover: success path, syntax error, DB unavailable, sequence gap scenarios

---

### Task 10: Implement Tenant Migration Runner

**Scope:** Per-workspace schema upgrades (executed by Worker)  
**File:** `packages/domain-core/src/migration/tenant-migration-runner.ts`  
**Layer:** Domain Core (migration execution)  
**Transactional:** YES (single transaction for migrations + version updates)  
**Idempotent:** YES (migration_registry UNIQUE constraint + idempotent SQL)  
**Version Enforcement:** YES (validates product_version compatibility pre-execution)  
**License Middleware:** YES (validated pre-job in Worker, re-checked in runner)

**Description:**

Implement function: `runTenantMigrations(tenantContext, upgradeJob) → Promise<UpgradeResult>`

Preconditions:

- Tenant context provided (workspace_id, connection pool)
- Write lock already acquired (by Worker before calling)
- License already validated (by Worker before calling)
- Snapshot already created (by Worker before calling)

Workflow:

1. Extract target_schema_version from upgradeJob
2. BEGIN transaction
3. Validate license status (re-check in case of status change)
   - If SOFT_LOCKED: Skip migration (logged as SUCCESS, no error)
   - If ARCHIVED: ROLLBACK, throw error
4. Load migration files from `apps/api/src/db/tenant/migrations/` (not tenant-specific, global list)
5. For each migration up to target_schema_version:
   a. Check migration_registry (UNIQUE(workspace_id, migration_file))
   - If already SUCCESS: Skip (idempotent)
   - If already FAILED: Re-execute (allow retry)
     b. Validate checksum
     c. Validate product_version compatibility (from migration header)
     d. Execute SQL against tenant_db (within transaction)
     e. INSERT migration_registry record {workspace_id, migration_file, status: SUCCESS}
     f. On error: ROLLBACK entire transaction, record status: FAILED
6. After all migrations:
   a. UPDATE tenant_db.schema_version SET version = target_version
   b. UPDATE master_db.tenants_registry SET schema_version = target_version
   c. (Optional) UPDATE master_db.licenses SET product_version = ? (if required)
7. COMMIT
8. Log completion with structured JSON

Error handling:

- Product version incompatible → ROLLBACK, throw before transaction
- Syntax error → ROLLBACK entire transaction
- Checksum mismatch → ROLLBACK, throw MIGRATION_TAMPERING_DETECTED
- License became SOFT_LOCKED → Skip migrations, return SUCCESS (graceful degradation)
- Sequence gap → ROLLBACK, throw error

**Acceptance Criteria:**

- ✓ Function signature correct
- ✓ Preconditions documented and enforced
- ✓ License re-check implemented (graceful skip on SOFT_LOCKED)
- ✓ Migration deduplication: UNIQUE(workspace_id, migration_file)
- ✓ Product version validation pre-execution
- ✓ Transaction starts after pre-validation
- ✓ Both schema_version tables updated atomically
- ✓ Idempotency enforced: replay-safe operations
- ✓ Structured logging with correlation_id, workspace_slug, workspace_id
- ✓ Integration tests cover: success, license change, syntax error, product version incompatible, rollback scenarios

---

### Task 11: Create Snapshot Manager (Pre-Upgrade)

**Scope:** Create backup before tenant upgrade  
**File:** `packages/domain-core/src/migration/snapshot-manager.ts`  
**Layer:** Domain Core (snapshot orchestration)  
**Transactional:** N/A (called before transaction)  
**Idempotent:** YES (keyed by workspace_id + migration_file_checksum, prevents duplicates)  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Implement function: `createSnapshot(tenantContext, upgradeJob) → Promise<SnapshotRecord>`

Workflow:

1. Generate snapshot ID (UUID)
2. Check for existing snapshot (key: workspace_id + migration file hash)
   - If exists (same checksum): Return existing snapshot (reuse, don't duplicate)
   - If not exists: Proceed
3. Generate snapshot location: `s3://backups/workspace-{workspace_id}/snapshot-{snapshot_id}.sql.gz`
4. Call storage system to create backup
   - Note: Storage layer implementation is separate (DevOps responsibility)
   - This function orchestrates the call
5. Record metadata in master_db.upgrade_snapshots:
   - {id, workspace_id, previous_schema_version, target_schema_version, snapshot_location, snapshot_size_bytes, created_at, expires_at, retention_policy}
   - expires_at = now() + 30 days (for AUTO_DELETE_30D)
6. Return snapshot record (with snapshot_id for job reference)

Error handling:

- Storage unavailable → Throw 503 SNAPSHOT_STORAGE_UNAVAILABLE
- Storage full → Throw 507 SNAPSHOT_STORAGE_FULL
- DB write failed → Throw error

**Acceptance Criteria:**

- ✓ Function signature correct
- ✓ Idempotency via snapshot lookup (prevents duplicate backups)
- ✓ Snapshot metadata recorded atomically
- ✓ Snapshot location is unique
- ✓ Expiration calculated correctly (30 days + now())
- ✓ Returns SnapshotRecord with all details
- ✓ Error handling covers storage failures
- ✓ Logs structured JSON: snapshot_id, size, location, retention_policy
- ✓ Unit tests cover: success, duplicate detection, storage full scenarios

---

### Task 12: Integrate Version Check into Tenant Resolver

**Scope:** Runtime blocking of incompatible requests  
**File:** `packages/domain-core/src/tenant-resolver/version-check.ts` (new file added to existing resolver)  
**Layer:** Domain Core (tenant resolver)  
**Transactional:** NO (read-only check)  
**Idempotent:** YES (no state change)  
**Version Enforcement:** YES (enforces minimum_supported_schema_version)  
**License Middleware:** YES (license already validated by middleware before resolver runs)

**Description:**

Implement function: `validateSchemaCompatibility(tenantContext, request) → void | throws Error`

Called by tenant resolver on every request (within resolver middleware, after license validation).

Workflow:

1. Extract workspace_id from tenant context
2. Read platform_settings.minimum_supported_schema_version (from cache if available, with 60s TTL)
3. Read tenant_db.schema_version (or cache from master_db.tenants_registry.schema_version)
4. Compare: tenant_version ≥ minimum_supported?
   - YES: Continue (no error)
   - NO: Throw error with code: SCHEMA_VERSION_MISMATCH
5. If DB unavailable: Throw 503 DATABASE_UNAVAILABLE

Cache invalidation:

- In-memory cache of platform_settings with 60-second TTL
- Pubsub signal: PLATFORM_SETTINGS_UPDATED → Flush cache immediately
- On next request after cache expiry: Reload fresh

Error response (426):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SCHEMA_VERSION_MISMATCH",
    "message": "Workspace schema version 1.0.0 below minimum supported 2.0.0. Upgrade required."
  }
}
```

**Acceptance Criteria:**

- ✓ Function called within resolver (before business logic)
- ✓ Minimum_supported_schema_version fetched correctly
- ✓ Tenant schema_version compared accurately
- ✓ Cache implemented with 60s TTL
- ✓ Pubsub invalidation signal listened
- ✓ Returns void on success (no side effects)
- ✓ Throws proper error on mismatch (error code, message, status)
- ✓ DB unavailable handled gracefully (503)
- ✓ Structured logging: workspace_id, tenant_version, minimum_version, result
- ✓ Integration tests cover: compatible, incompatible, cache expiry, pubsub invalidation scenarios

---

### Task 13: Create Migration Lookup Service

**Scope:** Query migration history and status  
**File:** `packages/domain-core/src/migration/migration-lookup.ts`  
**Layer:** Domain Core (query service)  
**Transactional:** NO (read-only)  
**Idempotent:** YES (no state change)  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Implement functions:

- `getMigrationHistory(workspace_id, masterDb) → Promise<MigrationRecord[]>`
  - Query master_db.migration_registry WHERE workspace_id = ?
  - Return sorted by applied_at DESC
- `getLatestMigration(workspace_id, masterDb) → Promise<MigrationRecord | null>`
  - Query master_db.migration_registry WHERE workspace_id = ? ORDER BY applied_at DESC LIMIT 1
- `isMigrationApplied(workspace_id, migrationFile, masterDb) → Promise<boolean>`
  - Query UNIQUE(workspace_id, migration_file) in migration_registry
  - Returns true if found with status = SUCCESS
- `getUpgradeStatus(upgradeId, masterDb) → Promise<UpgradeStatus>`
  - Query upgrade status from underlying job queue or cache
  - Returns: status (QUEUED|IN_PROGRESS|SUCCESS|FAILED), progress_percent, error (if failed)

**Acceptance Criteria:**

- ✓ All functions exported and documented
- ✓ Queries use indexes (workspace_id + applied_at DESC)
- ✓ No N+1 queries (single query per function)
- ✓ Handles edge cases: workspace not found, no migrations, timeout
- ✓ Structured logging: query type, result count, duration
- ✓ Unit tests provided with mock data scenarios

---

### Task 14: Create Product Version Validator

**Scope:** Validate product_version compatibility  
**File:** `packages/domain-core/src/migration/product-version-validator.ts`  
**Layer:** Domain Core (validation)  
**Transactional:** N/A  
**Idempotent:** YES (pure function)  
**Version Enforcement:** YES (used by tenant-migration-runner pre-execution)  
**License Middleware:** N/A

**Description:**

Implement function: `validateProductVersionCompatibility(migrationFile, license) → void | throws Error`

Workflow:

1. Extract product_version from migration file header: `-- Required Minimum Product Version: X.Y.Z`
2. Query master_db.licenses.product_version for workspace
3. Parse both versions using schema-version-validator
4. Compare: license_product_version ≥ required_minimum?
   - YES: Return void (compatible)
   - NO: Throw error with code: PRODUCT_VERSION_INCOMPATIBLE

Error response (400):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PRODUCT_VERSION_INCOMPATIBLE",
    "message": "Migration requires product version ≥ 1.5.0. Current: 1.2.0"
  }
}
```

**Acceptance Criteria:**

- ✓ Function signature correct
- ✓ Extracts product version from migration header
- ✓ Compares versions using SemVer rules
- ✓ Returns void on compatible
- ✓ Throws proper error on incompatible
- ✓ Unit tests cover various version combinations

---

---

## API LAYER TASKS (15–22)

### Task 15: Create POST /api/admin/workspace/{workspace_id}/upgrade Route

**Scope:** Accept upgrade request and queue job  
**File:** `apps/api/src/routes/admin/upgrade.ts`  
**Layer:** API (router)  
**Transactional:** N/A (enqueue only, transaction in Worker)  
**Idempotent:** YES (via UNIQUE constraint at Worker level)  
**Version Enforcement:** YES (validates target_schema_version SemVer format)  
**License Middleware:** YES (required before route handler)

**Description:**

Implement POST route:

```
POST /api/admin/workspace/{workspace_id}/upgrade
Content-Type: application/json

Request body:
{
  "target_schema_version": "1.1.0",
  "dry_run": false (optional)
}

Response (202 Accepted):
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
```

Handler logic:

1. Extract workspace_id from URL path (validated by router)
2. License middleware validates (ACTIVE, not SOFT_LOCKED, not ARCHIVED)
3. Parse request body: target_schema_version
4. Validate SemVer format:
   - If invalid: Return 400 INVALID_VERSION_FORMAT
5. Validate target ≥ minimum_supported:
   - If target < minimum_supported: Return 400 UPGRADE_TO_OBSOLETE_VERSION
6. Validate target > current_tenant_version:
   - If target ≤ current: Return 400 CANNOT_DOWNGRADE
7. Validate no migration gaps:
   - Scan migration files, detect gaps
   - If gap: Return 500 MIGRATION_SEQUENCE_GAP
8. Enqueue Worker job: workspace-schema-migrations
   - Job: {workspace_id, target_schema_version, migrations_to_apply, correlation_id}
9. Return 202 with upgrade_id

Error handling:

- Invalid version format: 400
- Target below minimum: 400
- Cannot downgrade: 400
- License invalid: 423 (middleware)
- Sequence gap: 500
- Queue unavailable: 503

**Acceptance Criteria:**

- ✓ Route registered at exact path
- ✓ License middleware enforced (before handler)
- ✓ All input validation implemented
- ✓ Worker job enqueued with correct schema
- ✓ Response 202 with correct structure
- ✓ Error responses follow error standard
- ✓ Structured logging: workspace_id, target_version, operator (if provided)
- ✓ Rate limiting: 5 attempts/hour per workspace (enforced)
- ✓ Unit tests: happy path, all error scenarios, license validation, version validation

---

### Task 16: Create GET /api/admin/workspace/{workspace_id}/upgrade/{upgrade_id} Route

**Scope:** Poll upgrade status  
**File:** `apps/api/src/routes/admin/upgrade.ts` (same file, additional handler)  
**Layer:** API (router)  
**Transactional:** NO (read-only)  
**Idempotent:** YES (no state change)  
**Version Enforcement:** N/A  
**License Middleware:** YES (authorization check)

**Description:**

Implement GET route:

```
GET /api/admin/workspace/{workspace_id}/upgrade/{upgrade_id}

Response (200 OK):
{
  "success": true,
  "data": {
    "upgrade_id": "uuid",
    "workspace_id": "uuid",
    "status": "QUEUED|IN_PROGRESS|SUCCESS|FAILED",
    "progress_percent": 0-100,
    "current_migration": "002_license_engine.sql (if IN_PROGRESS)",
    "execution_time_ms": 1245,
    "snapshot_id": "uuid (if created)",
    "created_at": "timestamp",
    "completed_at": "timestamp (if terminal state)"
  },
  "error": null
}

Response if FAILED (200 OK, error in data.error):
{
  "success": false,
  "data": null,
  "error": {
    "code": "MIGRATION_SYNTAX_ERROR",
    "message": "Syntax error in migration file",
    "failed_at_migration": "filename"
  }
}
```

Handler logic:

1. Extract workspace_id, upgrade_id from URL
2. License middleware validates (authorization)
3. Query job queue for upgrade_id
4. Return current status
   - QUEUED: progress_percent = 0
   - IN_PROGRESS: progress_percent = X% (based on current migration / total migrations)
   - SUCCESS: progress_percent = 100, completed_at = now()
   - FAILED: progress_percent = X% (at failure point), error details included

**Acceptance Criteria:**

- ✓ Route registered at exact path
- ✓ Reads from job queue (not database, for real-time status)
- ✓ Returns 200 OK for all states (including failures)
- ✓ Error details if FAILED
- ✓ Progress calculation accurate
- ✓ Timestamps match job metadata
- ✓ License middleware enforced (authorization)
- ✓ Structured logging: upgrade_id, status, workspace_id
- ✓ Unit tests: all status states, progress calculation, error scenarios

---

### Task 17: Create POST /api/admin/workspace/{workspace_id}/upgrade/{upgrade_id}/rollback Route

**Scope:** Initiate rollback from snapshot  
**File:** `apps/api/src/routes/admin/upgrade-rollback.ts`  
**Layer:** API (router)  
**Transactional:** N/A (enqueue Worker job)  
**Idempotent:** YES (via job queue idempotency)  
**Version Enforcement:** NO  
**License Middleware:** YES (authorization)

**Description:**

Implement POST route:

```
POST /api/admin/workspace/{workspace_id}/upgrade/{upgrade_id}/rollback
Content-Type: application/json

Request body:
{
  "snapshot_id": "uuid",
  "confirmation_code": "CONFIRM_ROLLBACK_TO_PREVIOUS"
}

Response (202 Accepted):
{
  "success": true,
  "data": {
    "rollback_id": "uuid",
    "workspace_id": "uuid",
    "snapshot_id": "uuid",
    "target_schema_version": "1.0.0",
    "status": "QUEUED"
  },
  "error": null
}
```

Handler logic:

1. Extract workspace_id, upgrade_id from URL
2. Parse request body: snapshot_id, confirmation_code
3. Validate confirmation_code = "CONFIRM_ROLLBACK_TO_PREVIOUS"
   - If not exact match: Return 400 INVALID_CONFIRMATION
4. Query master_db.upgrade_snapshots WHERE id = snapshot_id AND workspace_id = workspace_id
   - If not found: Return 404 SNAPSHOT_NOT_FOUND
5. Validate workspace_id match (cross-tenant safeguard)
   - If mismatch: Return 400 INVALID_SNAPSHOT_FOR_WORKSPACE (security)
6. Enqueue Worker job: workspace-schema-rollback
   - Job: {workspace_id, snapshot_id, rollback_id, correlation_id}
7. Return 202 with rollback_id

Error handling:

- Invalid confirmation: 400
- Snapshot not found: 404
- Workspace mismatch: 400 (security)
- License invalid: 423 (middleware)
- Queue unavailable: 503

**Acceptance Criteria:**

- ✓ Route registered at exact path
- ✓ Confirmation code exact match (prevents accidental rollback)
- ✓ Snapshot ownership verified (workspace_id match, critical)
- ✓ Worker job enqueued with rollback parameters
- ✓ Response 202 with correct structure
- ✓ Error responses follow error standard
- ✓ Security: Cross-tenant snapshot access prevented
- ✓ Structured logging: workspace_id, snapshot_id, operator (if tracked)
- ✓ Unit tests: happy path, confirmation mismatch, snapshot not found, workspace mismatch

---

### Task 18: Create License Middleware (Pre-Upgrade Validation)

**Scope:** Enforce license status before upgrade  
**File:** `apps/api/src/middleware/license-validator.ts`  
**Layer:** API (middleware)  
**Transactional:** N/A (validation only)  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** YES (this is the middleware itself)

**Description:**

Middleware applied to: POST /api/admin/workspace/{workspace_id}/upgrade\*

Logic:

1. Extract workspace_id from URL path
2. Query master_db.licenses WHERE workspace_id
3. Validations:
   - License exists: If not → 403 NOT_FOUND
   - Status = ACTIVE: If SOFT_LOCKED → 423 UNAVAILABLE; If ARCHIVED → 403 FORBIDDEN
   - Limits not exceeded: Check transactional limits (if applicable)
4. Attach license_context to request
5. Proceed to route handler
6. If fail: Short-circuit, return error response, never reach handler

Errors:

- License not found: 403
- SOFT_LOCKED: 423
- ARCHIVED: 403
- DB error: 503

**Acceptance Criteria:**

- ✓ Middleware registered on correct routes
- ✓ All validations implemented
- ✓ Correct HTTP status codes
- ✓ Proceeds only on ACTIVE license
- ✓ Attaches license_context to request
- ✓ Structured logging: workspace_id, license_status, result
- ✓ Short-circuits before route handler reaches
- ✓ Unit tests: ACTIVE, SOFT_LOCKED, ARCHIVED, not found scenarios

---

### Task 19: Create Input Validation Schema for Upgrade Request

**Scope:** Validate request body format  
**File:** `packages/validation/src/upgrade-request-validator.ts`  
**Layer:** API (validation)  
**Transactional:** N/A  
**Idempotent:** N/A (pure function)  
**Version Enforcement:** NO (SemVer format only)  
**License Middleware:** N/A

**Description:**

Create validation schema for upgrade requests using existing validation package:

Schema:

```
{
  target_schema_version: {
    type: string,
    required: true,
    pattern: /^\d+\.\d+\.\d+$/, // X.Y.Z only
    validate: validateSemVer
  },
  dry_run: {
    type: boolean,
    required: false,
    default: false
  }
}
```

Functions:

- `validateUpgradeRequest(body) → {isValid: boolean, errors: string[]}`
- `validateRollbackRequest(body) → {isValid: boolean, errors: string[]}`

**Acceptance Criteria:**

- ✓ Validates SemVer format (no pre-releases, no normalization)
- ✓ Rejects malformed versions early
- ✓ Uses existing validation package patterns
- ✓ Returns detailed error messages
- ✓ Unit tests: valid, invalid, malformed, edge cases

---

### Task 20: Create Error Response Handler

**Scope:** Standardize error responses per error standard  
**File:** `apps/api/src/middleware/error-handler.ts` (updated to include migration errors)  
**Layer:** API (middleware)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Update error handler to map migration-specific errors to standard response format:

Error mappings:

```
MIGRATION_SYNTAX_ERROR → 400 Bad Request
MIGRATION_TAMPERING_DETECTED → 500 Internal Server Error
MIGRATION_SEQUENCE_GAP → 500 Internal Server Error
SCHEMA_VERSION_MISMATCH → 426 Upgrade Required
PRODUCT_VERSION_INCOMPATIBLE → 400 Bad Request
SNAPSHOT_STORAGE_FULL → 507 Insufficient Storage
WORKSPACE_UPGRADE_IN_PROGRESS → 409 Conflict
MIGRATION_LOCK_TIMEOUT → 504 Gateway Timeout
DATABASE_UNAVAILABLE → 503 Service Unavailable
LICENSE_INACTIVE → 423 Locked
INVALID_VERSION_FORMAT → 400 Bad Request
CANNOT_DOWNGRADE → 400 Bad Request
UPGRADE_TO_OBSOLETE_VERSION → 400 Bad Request
```

Response format:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message (sanitized)"
  }
}
```

**Acceptance Criteria:**

- ✓ All migration error codes mapped
- ✓ Correct HTTP status codes
- ✓ Error messages human-readable but sanitized (no raw stack traces)
- ✓ Structured JSON format adhered
- ✓ Logs errors with correlation_id for tracing
- ✓ Unit tests: all error codes, sanitization, response format

---

### Task 21: Create Rate Limiter for Upgrade Endpoints

**Scope:** Prevent abuse (5 attempts/hour per workspace)  
**File:** `apps/api/src/middleware/rate-limiter-upgrade.ts`  
**Layer:** API (middleware)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Create rate limiting middleware applied to: POST /api/admin/workspace/{workspace_id}/upgrade\*

Logic:

1. Extract workspace_id from URL
2. Query master_db.migration_registry WHERE workspace_id = ? AND applied_at > now() - 1 hour
3. Count rows
4. If count ≥ 5: Return 429 Too Many Requests
5. Proceed to next middleware

Rejection response (429):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Maximum 5 upgrade attempts per hour. Try again later."
  }
}
```

**Acceptance Criteria:**

- ✓ Middleware registered on correct routes
- ✓ Queries migration_registry for count (O(1) with index)
- ✓ Rate limit: 5 attempts/hour per workspace_id
- ✓ Returns 429 on exceed
- ✓ Proceeds on allow
- ✓ Structured logging: workspace_id, attempt_count, result
- ✓ Unit tests: under limit, at limit, over limit scenarios

---

### Task 22: Create Idempotency Key Validation (API Layer)

**Scope:** Prevent duplicate upgrade submissions  
**File:** `apps/api/src/middleware/idempotency-key.ts` (updated for upgrade endpoints)  
**Layer:** API (middleware)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Middleware applied to: POST /api/admin/workspace/{workspace_id}/upgrade\*

Logic:

1. Extract workspace_id, target_schema_version from request
2. Generate idempotency key: `upgrade-{workspace_id}-{target_schema_version}`
3. Check if duplicate submission in flight:
   - Query migration_registry: UNIQUE(workspace_id, migration_file)
   - If already in progress or completed: Return cached response / status
4. Proceed to handler

Note: Worker layer enforces actual deduplication via DB constraint.
API layer provides early exit for duplicate submissions.

**Acceptance Criteria:**

- ✓ Middleware applied to POST upgrade endpoints
- ✓ Idempotency key generated correctly
- ✓ Detects in-flight duplicate submissions
- ✓ Returns existing state immediately
- ✓ Unit tests: duplicate detection, cache hits

---

---

## WORKER LAYER TASKS (23–30)

### Task 23: Define Worker Job Schema (Upgrade Job)

**Scope:** Message format for schema-migrations queue  
**File:** `apps/worker/src/jobs/schema-migration-job.ts`  
**Layer:** Worker (job definition)  
**Transactional:** N/A  
**Idempotent:** N/A (type definition)  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Define TypeScript interface for upgrade job messages:

```typescript
interface SchemaMigrationJob {
  job_type: 'SCHEMA_MIGRATION',
  workspace_id: UUID,
  workspace_slug: string,
  target_schema_version: string, // SemVer X.Y.Z
  correlation_id: string (UUID),
  snapshot_metadata: {
    location: string, // s3://... or blob storage URL
    snapshot_id: UUID,
    size_bytes: number,
    created_at: ISO8601 timestamp
  },
  migrations_to_apply: [
    {
      filename: string,
      checksum: string (SHA-256 hex),
      target_version: string,
      required_product_version: string
    }
  ],
  operator_id: UUID (optional),
  attempt: number (internal, 0 initially)
}
```

**Acceptance Criteria:**

- ✓ Interface defined and exported
- ✓ All required fields specified
- ✓ Types are strict (no loose optionals)
- ✓ Matches API enqueue schema
- ✓ Can be serialized/deserialized to JSON

---

### Task 24: Create Workspace Write Lock Acquisition

**Scope:** Serialize upgrades per workspace  
**File:** `apps/worker/src/jobs/lock-manager.ts`  
**Layer:** Worker (concurrency control)  
**Transactional:** N/A (lock management)  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Implement function: `acquireWorkspaceLock(workspace_id, masterDb) → Promise<LockHandle | throws Error>`

Logic:

1. Execute: `SELECT * FROM tenants_registry WHERE workspace_id = ? FOR UPDATE`
   - Timeout: 60 seconds (configurable)
2. If lock acquired: Return LockHandle
3. If timeout: Throw error with code: MIGRATION_LOCK_TIMEOUT
4. If workspace not found: Throw error

Lock release (called in finally block):

```typescript
function releaseWorkspaceLock(lockHandle): void
// Lock auto-released on transaction commit/rollback
// Explicit release not needed (database handles)
```

**Acceptance Criteria:**

- ✓ Uses SELECT ... FOR UPDATE (Postgres pattern)
- ✓ Timeout: 60 seconds (configurable)
- ✓ Throws MIGRATION_LOCK_TIMEOUT on timeout
- ✓ Returns LockHandle (for reference, optional)
- ✓ Lock released on transaction end
- ✓ Structured logging: workspace_id, lock_acquired, wait_time_ms
- ✓ Unit tests (with mock Postgres): success, timeout scenarios

---

### Task 25: Create Snapshot Creation Job Phase

**Scope:** Execute snapshot before migration  
**File:** `apps/worker/src/jobs/schema-migration-executor.ts` (first phase)  
**Layer:** Worker (job execution)  
**Transactional:** N/A (snapshot creation is pre-transaction)  
**Idempotent:** YES (reuses existing snapshot if checksum matches)  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Implement within SchemaMigrationJob executor:

Phase 1: SNAPSHOT_CREATION

```typescript
async function snapshotPhase(job, masterDb, tenantDb): Promise<SnapshotRecord>
  1. Acquire workspace write lock (60s timeout)
  2. Re-validate license status (in case changed)
     - If SOFT_LOCKED: Log WARNING, return SUCCESS (skip migration, no error)
     - If ARCHIVED: Throw error
  3. Call createSnapshot(tenantDb, job)
     - Returns SnapshotRecord or throws error
  4. Log: event = "snapshot_created", snapshot_id, size, location
  5. Return SnapshotRecord

On error:
  - Release lock (if acquired)
  - Throw error (retryable or fatal depending on error type)
```

Error handling:

- Lock timeout: Throw MIGRATION_LOCK_TIMEOUT (retryable)
- Storage full: Throw SNAPSHOT_STORAGE_FULL (retryable)
- License SOFT_LOCKED: Return SUCCESS (no error, graceful skip)
- License ARCHIVED: Throw error (fatal)

**Acceptance Criteria:**

- ✓ Lock acquired before snapshot
- ✓ License re-checked (graceful skip on SOFT_LOCKED)
- ✓ Snapshot created via snapshot-manager
- ✓ Snapshots idempotent (no duplicates)
- ✓ Proper error handling and logging
- ✓ Lock released on all error paths
- ✓ Integration tests: success, license change, storage full scenarios

---

### Task 26: Create Migration Execution Job Phase

**Scope:** Execute migrations in transaction  
**File:** `apps/worker/src/jobs/schema-migration-executor.ts` (second phase)  
**Layer:** Worker (job execution)  
**Transactional:** YES (single transaction for all migrations + version updates)  
**Idempotent:** YES (idempotent SQL + UNIQUE constraint in migration_registry)  
**Version Enforcement:** YES (product_version validation pre-execution)  
**License Middleware:** N/A

**Description:**

Implement within SchemaMigrationJob executor:

Phase 2: MIGRATION_EXECUTION

```typescript
async function migrationPhase(job, masterDb, tenantDb, lockAcquired): Promise<UpgradeResult>
  1. Precondition: Lock already held from snapshot phase
  2. Call runTenantMigrations(tenantDb_context, job)
     - Function defined in Task 10
     - Returns UpgradeResult or throws error
  3. Log: event = "migration_completed", execution_time_ms, status
  4. Return UpgradeResult

On error:
  - ROLLBACK entire transaction
  - Release lock automatically
  - Throw error (retryable or fatal depending on error type)
```

Transaction wrapper (single transaction for entire migration set + version updates):

```
BEGIN TRANSACTION
  ├─ Validate license (re-check)
  ├─ For each migration: execute SQL + record migration_registry
  ├─ Update tenant_db.schema_version
  ├─ Update master_db.tenants_registry.schema_version
  ├─ (Optional) Update master_db.licenses.product_version
  └─ COMMIT or ROLLBACK
```

**Acceptance Criteria:**

- ✓ Calls runTenantMigrations (delegates to domain core)
- ✓ Single transaction for all migrations + version updates
- ✓ Lock held throughout
- ✓ All-or-nothing semantics (no partial state)
- ✓ Proper rollback on any failure
- ✓ Idempotency enforced: UNIQUE(workspace_id, migration_file)
- ✓ Structured logging: migration_file, execution_time_ms, status, error (if failed)
- ✓ Integration tests: success, syntax error, checksum mismatch, product version incompatible, rollback scenarios

---

### Task 27: Create Worker Job Error Handling & Retry Strategy

**Scope:** Retry logic and DLQ placement  
**File:** `apps/worker/src/jobs/schema-migration-executor.ts` (error handling)  
**Layer:** Worker (job execution)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Implement within SchemaMigrationJob executor:

Retry strategy:

```
Attempt 1: Immediate
Attempt 2: 1 second delay (exponential backoff)
Attempt 3: 2 second delay
Attempt 4: 4 second delay (max 3 retries total = 4 attempts)
Attempt 5+: Place in DLQ (manual operator intervention)
```

Retryable errors:

- DATABASE_UNAVAILABLE (503)
- MIGRATION_LOCK_TIMEOUT (504)
- SNAPSHOT_STORAGE_FULL (507)
- Transient network errors

Non-retryable errors (fail immediately, no retry):

- MIGRATION_SYNTAX_ERROR (400)
- MIGRATION_TAMPERING_DETECTED (500)
- SCHEMA_VERSION_MISMATCH (426)
- PRODUCT_VERSION_INCOMPATIBLE (400)
- MIGRATION_SEQUENCE_GAP (500)
- LICENSE_ARCHIVED (403)

DLQ handling:

```
On max retries exhausted:
  ├─ Job moved to DLQ (workspace-schema-migrations-dlq)
  ├─ Alert: CRITICAL log with operator notification
  ├─ operator_id (if available) notified
  ├─ Snapshot retained (for manual inspection)
  └─ Manual recovery required
```

**Acceptance Criteria:**

- ✓ Exponential backoff implemented (1s, 2s, 4s)
- ✓ Max 3 retries (4 total attempts)
- ✓ Retryable vs non-retryable errors categorized correctly
- ✓ DLQ job moved after max retries
- ✓ CRITICAL logs emitted properly
- ✓ Operator can manually retry from DLQ
- ✓ Unit tests: retry logic, backoff timing, DLQ placement

---

### Task 28: Create Structured Logging for Migration Jobs

**Scope:** Emit detailed logs for operational monitoring  
**File:** `apps/worker/src/jobs/schema-migration-executor.ts` (logging)  
**Layer:** Worker (observability)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Implement structured logging throughout job execution:

Events to log:

1. Job dequeued: level=INFO, event="migration_started"
2. Lock acquired: level=DEBUG, event="lock_acquired", wait_time_ms
3. License validated: level=DEBUG, event="license_validated", status
4. Snapshot created: level=INFO, event="snapshot_created", snapshot_id, size_bytes
5. Migration started: level=DEBUG, event="migration_phase_started", migration_file
6. Migration completed: level=INFO, event="migration_completed", execution_time_ms, status
7. Job completed: level=INFO, event="migration_job_completed", total_time_ms, status
8. Job failed: level=ERROR, event="migration_job_failed", error_code, error_message
9. Job retrying: level=WARN, event="migration_job_retry", attempt, backoff_ms
10. Job in DLQ: level=CRITICAL, event="migration_job_dlq", reason

Required fields in all logs:

- timestamp (ISO8601)
- level (INFO, DEBUG, WARN, ERROR, CRITICAL)
- service: "migration-engine"
- correlation_id (UUID, propagated from job)
- workspace_slug
- workspace_id
- event (event name)

Optional fields (event-specific):

- migration_file
- snapshot_id
- execution_time_ms
- error_code
- error_message (sanitized, no raw stack traces)
- attempt (retry attempt number)

**Acceptance Criteria:**

- ✓ All events logged at correct level
- ✓ Required fields always present
- ✓ Correlation_id propagated
- ✓ Error messages sanitized
- ✓ JSON structured format
- ✓ No console.log() used
- ✓ Logs sent to centralized aggregation
- ✓ Unit tests: log format validation, field presence

---

### Task 29: Create Metrics Emission for Migration Jobs

**Scope:** Proactive monitoring  
**File:** `apps/worker/src/jobs/schema-migration-executor.ts` (metrics)  
**Layer:** Worker (observability)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Emit Prometheus metrics on job completion:

Metrics:

```
schema_migration_duration_ms [Histogram]
  ├─ Labels: workspace_id, workspace_slug, status (SUCCESS|FAILED)
  ├─ Value: execution_time_ms from migration phase
  └─ Emitted on: job completion

schema_migration_success_total [Counter]
  ├─ Labels: workspace_id, migration_file, target_version
  ├─ Increment: +1 on SUCCESS
  └─ Emitted on: successful migration completion

schema_migration_failure_total [Counter]
  ├─ Labels: workspace_id, error_code
  ├─ Increment: +1 on FAILED
  └─ Emitted on: failed migration (before retry or DLQ)

workspace_schema_version [Gauge]
  ├─ Labels: workspace_id
  ├─ Value: current_schema_version (parsed to numeric, e.g., 1.1.0 → 110)
  └─ Updated on: successful migration completion

migration_registry_entries_total [Gauge]
  ├─ Emitted periodically (e.g., every 5 minutes)
  ├─ Labels: status (SUCCESS|FAILED)
  └─ Value: COUNT(*) FROM migration_registry WHERE status = ?
```

**Acceptance Criteria:**

- ✓ All metrics registered with Prometheus client
- ✓ Labels consistently applied
- ✓ Histogram buckets appropriate (e.g., 100ms, 500ms, 1s, 5s, 30s)
- ✓ Counters increment atomically
- ✓ Gauge values updated atomically
- ✓ Unit tests: metric emission, label correctness, value accuracy

---

### Task 30: Create Snapshot Restoration Job (Worker)

**Scope:** Implement rollback via snapshot  
**File:** `apps/worker/src/jobs/snapshot-rollback-executor.ts`  
**Layer:** Worker (job execution)  
**Transactional:** YES (restore operation + version reset)  
**Idempotent:** YES (target version idempotent)  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Implement Worker job handler for rollback:

Input:

```json
{
  "job_type": "SCHEMA_ROLLBACK",
  "workspace_id": "uuid",
  "snapshot_id": "uuid",
  "rollback_id": "uuid",
  "correlation_id": "uuid"
}
```

Workflow:

1. Acquire workspace write lock (60s timeout)
2. Query master_db.upgrade_snapshots WHERE id = snapshot_id AND workspace_id = workspace_id
   - If not found: Throw error (cross-tenant safeguard)
3. Extract: previous_schema_version, snapshot_location
4. Restore database from snapshot
   - Call storage system (DevOps layer) to retrieve and restore
   - Execute: `pg_restore -d tenant_db snapshot_location`
5. BEGIN transaction
   a. UPDATE tenant_db.schema_version SET version = previous_schema_version
   b. UPDATE master_db.tenants_registry SET schema_version = previous_schema_version
   c. UPDATE master_db.upgrade_snapshots SET restored_at = now() WHERE id = snapshot_id
6. COMMIT
7. Release lock
8. Log: event = "snapshot_restored", schema_version (previous)

Error handling:

- Snapshot not found: 404 (fatal)
- Lock timeout: MIGRATION_LOCK_TIMEOUT (retryable)
- Restore failed: 500 (retryable)
- Cross-tenant mismatch: 400 (fatal)

**Acceptance Criteria:**

- ✓ Workspace lock acquired and held
- ✓ Snapshot ownership verified (workspace_id match)
- ✓ Restore operation called correctly
- ✓ Version reset in transaction
- ✓ Transaction atomic (all or nothing)
- ✓ Snapshot metadata updated (restored_at timestamp)
- ✓ Lock released properly
- ✓ Structured logging: snapshot_id, previous_version, status
- ✓ Integration tests: success, snapshot not found, cross-tenant prevention, restore failure scenarios

---

---

## FRONTEND TASKS (31–34)

### Task 31: Create Upgrade Status Vue Component

**Scope:** Display upgrade progress and status  
**File:** `apps/frontoffice/src/components/admin/UpgradeStatus.vue`  
**Layer:** Frontend (UI component)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A (display only, no logic)  
**License Middleware:** N/A

**Description:**

Create shadcn-vue component for displaying upgrade status:

Props:

- `upgrade_id` (string, UUID)
- `workspace_id` (string, UUID)
- `on_complete` (callback function)

State:

- `status` (QUEUED|IN_PROGRESS|SUCCESS|FAILED)
- `progress_percent` (0–100)
- `current_migration` (string or null)
- `execution_time_ms` (number)
- `error` (Error | null)
- `polling_interval` (1 second during execution, 5 seconds on complete)

Features:

1. Polls GET /api/admin/workspace/{id}/upgrade/{id} every 1s
2. Updates progress bar (visual only)
3. Displays current migration file (if IN_PROGRESS)
4. Shows completion status (SUCCESS or FAILED)
5. Shows error message (if FAILED, user-friendly only)
6. Calls on_complete callback when terminal state reached
7. Auto-stops polling on SUCCESS or FAILED

UI Elements:

- Progress bar (shadcn-ui Progress component + Tailwind v4)
- Status badge (status indicator: QUEUED=gray, IN_PROGRESS=blue, SUCCESS=green, FAILED=red)
- Current operation text
- Execution time display
- Error message (if failed)

No business logic:

- ✗ No version comparison
- ✗ No retry logic (backend handles)
- ✗ No calculations
- ✗ Only display and polling

**Acceptance Criteria:**

- ✓ Component renders correctly
- ✓ Polls correct endpoint
- ✓ Updates UI every 1s during IN_PROGRESS
- ✓ Stops polling on terminal state
- ✓ Progress bar visual accuracy
- ✓ Status badge colors correct
- ✓ Error message displayed (sanitized)
- ✓ API errors handled gracefully (retry polling)
- ✓ Unit tests: rendering, polling, state updates, completion callback

---

### Task 32: Create Upgrade Request Form Vue Component

**Scope:** Accept upgrade request from user  
**File:** `apps/frontoffice/src/components/admin/UpgradeForm.vue`  
**Layer:** Frontend (UI component)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A (API validates)  
**License Middleware:** N/A

**Description:**

Create shadcn-vue form component for upgrade submission:

Props:

- `workspace_id` (string, UUID)
- `current_version` (string, SemVer)
- `available_versions` (string[], SemVer list)
- `on_submit` (callback function)

State:

- `selected_version` (string)
- `is_submitting` (boolean)
- `error` (Error | null)
- `dry_run` (boolean, optional)

Features:

1. Dropdown to select target_schema_version
2. Confirmation dialog (prevent accidental upgrades)
3. Checkbox: Dry run (optional)
4. Submit button (disabled during submission)
5. Display current version (read-only)
6. Show available versions only (no downgrade)

Form validation (client-side):

- ✓ Target version selected (required)
- ✓ Target version ≠ current version
- ✓ Target version is from available list

Errors displayed:

- User-friendly messages (from API error responses)
- No raw error codes (translate to messages)

Submission:

- POST /api/admin/workspace/{id}/upgrade {target_schema_version, dry_run}
- On success: Call on_submit(upgrade_id)
- On error: Display error message, allow retry

No business logic:

- ✗ No version comparison logic
- ✗ No SemVer validation (API handles)
- ✗ No retry logic (user can submit again)

**Acceptance Criteria:**

- ✓ Component renders correctly
- ✓ Dropdown shows available versions
- ✓ Confirmation dialog prevents accidental submission
- ✓ Submit button disabled during submission
- ✓ Error messages displayed
- ✓ On success: Calls on_submit callback with upgrade_id
- ✓ API errors handled gracefully
- ✓ Unit tests: rendering, form submission, error handling

---

### Task 33: Create Upgrade History Vue Component

**Scope:** Display migration history  
**File:** `apps/frontoffice/src/components/admin/UpgradeHistory.vue`  
**Layer:** Frontend (UI component)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A (display only)  
**License Middleware:** N/A

**Description:**

Create shadcn-vue table component for displaying upgrade history:

Props:

- `workspace_id` (string, UUID)

Features:

1. Fetch migration_registry for workspace (via API endpoint, if exists)
2. Display table: Date | Migration File | Version | Status | Duration
3. Status indicators: SUCCESS (green) | FAILED (red)
4. Sort by date (newest first)
5. Pagination (20 items per page)
6. Refresh button (re-fetch latest)
7. No direct DB queries (API only)

Columns:

- Applied At (ISO timestamp, formatted as locale date/time)
- Migration File (filename only, e.g., "002_license_engine.sql")
- Target Schema Version (e.g., "1.1.0")
- Status (SUCCESS|FAILED badge)
- Execution Time (milliseconds, formatted as "1.2s")
- Details (link to show error message if FAILED)

No business logic:

- ✗ No version calculations
- ✗ No filtering (API returns pre-filtered)

**Acceptance Criteria:**

- ✓ Table renders correctly
- ✓ Fetches migration_registry via API
- ✓ Status badges colored correctly
- ✓ Timestamp formatted correctly
- ✓ Pagination working
- ✓ Refresh button updates data
- ✓ Error messages (if FAILED) display properly
- ✓ Unit tests: rendering, data fetching, pagination

---

### Task 34: Create Upgrade Page Vue Component (Container)

**Scope:** Compose all upgrade components into a page  
**File:** `apps/frontoffice/src/pages/admin/upgrade.vue`  
**Layer:** Frontend (page container)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Create main page component:

Layout:

```
Header: "Schema Upgrade"
Section 1: Upgrade Form (UpgradeForm.vue)
Section 2: Upgrade Status (UpgradeStatus.vue) - shown if upgrade_id in state
Section 3: Upgrade History (UpgradeHistory.vue)
```

State management:

- `current_upgrade_id` (string | null)
- `current_version` (string, SemVer, fetched from API)
- `available_versions` (string[], fetched from API)

Lifecycle:

1. On mount: Fetch current_version and available_versions
2. On form submit: Set current_upgrade_id, show status component
3. On status complete: Refresh history, clear upgrade_id
4. On history refresh: Refresh current_version

Page flow:

1. User sees upgrade form
2. User selects version and submits
3. Form hidden, status component shown (polling)
4. On completion, status hidden, history shown
5. User can initiate another upgrade from form

No business logic:

- ✗ No version logic
- ✗ No retry logic
- ✗ Only orchestration and state

**Acceptance Criteria:**

- ✓ Page renders correctly
- ✓ Form displayed initially
- ✓ Status component shown on submission
- ✓ History displayed always
- ✓ State management correct
- ✓ Components communicate properly
- ✓ Page integrates with router correctly
- ✓ UI responsive (mobile, tablet, desktop)
- ✓ Integration tests: page navigation, component interactions

---

---

## OBSERVABILITY TASKS (35–39)

### Task 35: Create Correlation ID Propagation

**Scope:** Link all logs across services  
**File:** `packages/domain-core/src/observability/correlation-id.ts` (new middleware)  
**Layer:** Observability (cross-layer)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Implement correlation ID propagation:

1. API middleware: Extract correlation_id from request headers (X-Correlation-ID)
   - If not present: Generate new UUID
   - Attach to request context
2. Attach to all service calls: Worker, domain core, DB queries
3. Include in all structured logs
4. Pass to Worker jobs (in job message)
5. Worker attaches to all logs

Implementation:

- `generateCorrelationId() → string (UUID)`
- `getCorrelationId(request) → string`
- `setCorrelationId(context, id) → void`
- `attachCorrelationIdToJob(job, id) → Job`

**Acceptance Criteria:**

- ✓ Middleware extracts/generates correlation_id correctly
- ✓ All logs include correlation_id field
- ✓ Worker jobs receive correlation_id
- ✓ Worker logs propagate correlation_id
- ✓ Can trace single request across all services
- ✓ Unit tests: ID generation, propagation, log inclusion

---

### Task 36: Create Audit Log for Migration Operations

**Scope:** Immutable audit trail  
**File:** `packages/domain-core/src/observability/migration-audit.ts`  
**Layer:** Observability (audit)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Implement audit logging for all migration operations:

Events to audit:

1. Upgrade requested: workspace_id, operator_id, target_version, timestamp
2. Snapshot created: workspace_id, snapshot_id, size, location, timestamp
3. Migration executed: workspace_id, migration_file, status, execution_time, timestamp
4. Version updated: workspace_id, previous_version, new_version, timestamp
5. Rollback initiated: workspace_id, snapshot_id, target_version, timestamp
6. License validation: workspace_id, status (ACTIVE|BLOCKED), reason, timestamp

Audit log storage:

- Structured logs to centralized service (ELK, Datadog)
- Cannot be modified retroactively
- Includes: correlation_id, workspace_id, workspace_slug, operator_id, timestamp, event, details

**Acceptance Criteria:**

- ✓ All migration operations audited
- ✓ Audit logs immutable (append-only)
- ✓ operator_id included (if applicable)
- ✓ All required fields present
- ✓ Timestamps accurate (server authoritative)
- ✓ Unit tests: audit log generation, field correctness

---

### Task 37: Create Migration Metrics Dashboard Queries

**Scope:** Operational monitoring  
**File:** `docs/operations/migration-dashboard-queries.md`  
**Layer:** Observability (dashboarding)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Document queries for Prometheus/Grafana dashboard:

Queries:

1. Upgrade success rate (24h): `rate(schema_migration_success_total[24h]) / rate(schema_migration_attempts_total[24h])`
2. Average upgrade duration: `avg(schema_migration_duration_ms)`
3. Failed upgrades (24h): `increase(schema_migration_failure_total[24h])`
4. Workspaces by schema version: `count by (workspace_id) (workspace_schema_version)`
5. Lock timeouts (24h): `increase(migration_lock_timeout_total[24h])`
6. Snapshot storage used: `sum(upgrade_snapshots_size_bytes)`

Dashboard panels:

- Success rate (gauge, alert if < 95%)
- Avg duration (graph)
- Failed count (counter)
- Version distribution (pie chart)
- Lock timeouts (counter)
- Storage usage (gauge, alert if > 80%)

**Acceptance Criteria:**

- ✓ All queries documented
- ✓ Queries tested against Prometheus
- ✓ Dashboard PanelJSON generated (or manually created)
- ✓ Alert thresholds defined
- ✓ Runbook links included

---

### Task 38: Create Error Mapping Documentation

**Scope:** Error respons standardization  
**File:** `docs/api/migration-error-codes.md`  
**Layer:** Observability (documentation)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Document all migration error codes:

For each error:

- Error code (e.g., MIGRATION_SYNTAX_ERROR)
- HTTP status (400, 500, 503, etc.)
- User-friendly message
- Troubleshooting steps
- Retry-ability (retryable or fatal)

Example entry:

```
### MIGRATION_SYNTAX_ERROR (400)

User Message: "Invalid SQL in migration file"

Troubleshooting:
  1. Review migration file SQL syntax
  2. Test migration locally
  3. Fix syntax error in migration file
  4. Recontact deployment
  5. Retry upgrade

Retryable: No (fatal, requires fix)

Operator response: Contact development team to fix migration file
```

**Acceptance Criteria:**

- ✓ All error codes documented
- ✓ Troubleshooting steps clear
- ✓ Retry-ability stated
- ✓ User messages friendly
- ✓ Operator runbooks included

---

### Task 39: Create Migration Observability Configuration

**Scope:** Centralize logging setup  
**File:** `apps/worker/src/config/logging.ts` (updated for migration logging)  
**Layer:** Observability (infrastructure)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Configure logging for migration operations:

Configuration:

- Log level: DEBUG (for local), INFO (for prod)
- Log format: JSON (structured)
- Log destination: Stdout to Docker logs (collected by centralized service)
- Log retention: 30 days (handled by log aggregation service)
- Log sampling: No sampling (all logs captured)

Fields added:

- `correlation_id` (mandatory on all logs)
- `workspace_slug` (mandatory on workspace-bound operations)
- `workspace_id` (mandatory on workspace-bound operations)
- `migration_file` (on migration operations)
- `snapshot_id` (on snapshot operations)
- `execution_time_ms` (on completion operations)

**Acceptance Criteria:**

- ✓ Configuration loaded correctly
- ✓ JSON format validated
- ✓ All required fields present in logs
- ✓ No console.log() in production code
- ✓ Logs captured by Docker logging driver
- ✓ Integration tests: log format, field presence

---

---

## TESTING TASKS (40–47)

### Task 40: Create Unit Tests for Version Validation

**Scope:** Test SemVer parsing and comparison  
**File:** `packages/validation/tests/unit/schema-version-validator.test.ts`  
**Layer:** Testing (unit)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Test suite for schema-version-validator (Task 7):

Test cases:

1. `parseVersion("1.2.3")` → {major: 1, minor: 2, patch: 3}
2. `parseVersion("1.2")` → Error (malformed)
3. `parseVersion("1.2.3-rc1")` → Error (prerelease not allowed)
4. `parseVersion("")` → Error (empty)
5. `isCompatible("1.2.3", "1.0.0")` → true
6. `isCompatible("1.0.0", "1.2.3")` → false
7. `isCompatible("2.0.0", "1.9.9")` → true
8. `isMajorBump("1.0.0", "2.0.0")` → true
9. `isMajorBump("1.0.0", "1.1.0")` → false
10. `isMinorBump("1.0.0", "1.1.0")` → true
11. `isPatchBump("1.0.1", "1.0.2")` → true
12. `compareVersions("1.0.0", "1.0.1")` → -1
13. `compareVersions("1.0.1", "1.0.0")` → 1
14. `compareVersions("1.0.0", "1.0.0")` → 0

**Acceptance Criteria:**

- ✓ All test cases pass
- ✓ Code coverage ≥ 95%
- ✓ Edge cases tested
- ✓ Error messages validated

---

### Task 41: Create Unit Tests for Migration File Validation

**Scope:** Test migration file parsing and validation  
**File:** `packages/validation/tests/unit/migration-file-validator.test.ts`  
**Layer:** Testing (unit)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Test suite for migration-file-validator (Task 8):

Test cases:

1. Extract header: `-- Migration: 1.1.0` → "1.1.0"
2. Extract product version: `-- Required Minimum Product Version: 1.5.0` → "1.5.0"
3. Extract breaking flag: `-- Breaking: true` → true
4. Missing header → Error
5. Checksum consistent: Same content → Same hash
6. Checksum differs: Different content → Different hash
7. Detect DROP COLUMN → Found
8. Detect ALTER TABLE DROP → Found
9. Detect ADD COLUMN → Not found (safe)
10. Detect migration gap: [001, 002, 004] → Error (003 missing)
11. No gap: [001, 002, 003] → No error

**Acceptance Criteria:**

- ✓ All test cases pass
- ✓ Code coverage ≥ 95%
- ✓ Pattern detection accurate
- ✓ Checksum deterministic

---

### Task 42: Integration Test: End-to-End Upgrade (v1.0.0 → v1.1.0)

**Scope:** Complete upgrade workflow  
**File:** `apps/api/tests/integration/migration/upgrade-e2e.test.ts`  
**Layer:** Testing (integration)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Test end-to-end upgrade workflow:

Setup:

1. Create test workspace with schema v1.0.0 (seeded database)
2. Create Hono test server
3. Create test migration file v1.1.0 (additive: ADD COLUMN)
4. Workspace license: ACTIVE, product_version: 1.0.0

Test steps:

1. POST /api/admin/workspace/{id}/upgrade {target: "1.1.0"}
   - Assert 202 ACCEPTED
   - Extract upgrade_id
2. GET /api/admin/workspace/{id}/upgrade/{upgrade_id}
   - Poll status (poll loop)
   - Assert status: QUEUED → IN_PROGRESS → SUCCESS
3. Verify database state:
   - Query tenant_db.schema_version → "1.1.0"
   - Query master_db.tenants_registry.schema_version → "1.1.0"
   - Query master_db.migration_registry → SUCCESS record
4. Send API request (any endpoint)
   - Assert 200 OK (no 426 error, version compatible)

**Acceptance Criteria:**

- ✓ Full workflow succeeds
- ✓ Status polling reflects real progress
- ✓ Database state correct
- ✓ Version enforcement works (no 426 after upgrade)

---

### Task 43: Integration Test: License Validation Blocks Upgrade

**Scope:** License enforcement in upgrade flow  
**File:** `apps/api/tests/integration/migration/upgrade-license-validation.test.ts`  
**Layer:** Testing (integration)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Test license validation in upgrade workflow:

Setup:

1. Create test workspace
2. License: SOFT_LOCKED

Test 1: Upgrade rejected (SOFT_LOCKED)

1. POST /api/admin/workspace/{id}/upgrade {target: "1.1.0"}
   - Assert 423 UNAVAILABLE (middleware rejects)

Transition:

1. Update license status to ACTIVE

Test 2: Upgrade succeeds (after license transition)

1. POST /api/admin/workspace/{id}/upgrade {target: "1.1.0"}
   - Assert 202 ACCEPTED, upgrade_id returned

**Acceptance Criteria:**

- ✓ SOFT_LOCKED license blocks upgrade (423)
- ✓ ACTIVE license allows upgrade (202)

---

### Task 44: Integration Test: Failed Migration Rollback

**Scope:** Transaction rollback on failure  
**File:** `apps/api/tests/integration/migration/upgrade-failure-rollback.test.ts`  
**Layer:** Testing (integration)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Test transaction rollback on migration failure:

Setup:

1. Create test workspace with schema v1.0.0
2. Create migration v1.1.0 WITH INTENTIONAL SYNTAX ERROR
3. Workspace license: ACTIVE

Test:

1. POST /api/admin/workspace/{id}/upgrade {target: "1.1.0"}
   - Assert 202 ACCEPTED
   - Extract upgrade_id
2. Poll GET /api/admin/workspace/{id}/upgrade/{upgrade_id}
   - Wait for FAILED status
3. Verify rollback:
   - Query tenant_db.schema_version → Still "1.0.0" (unchanged)
   - Query master_db.migration_registry → FAILED record
   - Verify snapshot retained (for audit)
4. Verify error details:
   - error_code: MIGRATION_SYNTAX_ERROR
   - error_message includes file/line detail

**Acceptance Criteria:**

- ✓ Migration fails as expected
- ✓ Schema_version unchanged (rollback successful)
- ✓ migration_registry records FAILED
- ✓ Snapshot retained for audit
- ✓ Error details accurate

---

### Task 45: Integration Test: Idempotency (Duplicate Submission)

**Scope:** Replay safety  
**File:** `apps/api/tests/integration/migration/upgrade-idempotency.test.ts`  
**Layer:** Testing (integration)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Test idempotency of duplicate upgrade submissions:

Setup:

1. Create test workspace with schema v1.0.0
2. Create valid migration v1.1.0
3. Workspace license: ACTIVE

Test 1: First submission succeeds

1. POST /api/admin/workspace/{id}/upgrade {target: "1.1.0"}
   - Assert 202 ACCEPTED, upgrade_id_1
2. Poll until SUCCESS
3. Verify state:
   - schema_version = v1.1.0
   - migration_registry has 1 SUCCESS record

Test 2: Second submission (retry same command) - idempotent

1. POST /api/admin/workspace/{id}/upgrade {target: "1.1.0"}
   - Assert 202 ACCEPTED, upgrade_id_2
2. Poll until SUCCESS
3. Verify state:
   - schema_version = v1.1.0 (unchanged)
   - migration_registry still has 1 record (no duplicate)
   - upgrade_id_1 ≠ upgrade_id_2 (different requests but same operation)

**Acceptance Criteria:**

- ✓ Duplicate submission detected
- ✓ No double execution
- ✓ Schema_version unchanged
- ✓ Single migration_registry record

---

### Task 46: Integration Test: Concurrent Upgrade Prevention

**Scope:** Write lock serialization  
**File:** `apps/api/tests/integration/migration/upgrade-concurrent-prevention.test.ts`  
**Layer:** Testing (integration)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Test concurrent upgrade prevention:

Setup:

1. Create test workspace with schema v1.0.0
2. Create two migrations:
   - v1.1.0 (modeled as slow, 5-second operation via mock)
   - v2.0.0 (instant)
3. Workspace license: ACTIVE

Test:

1. POST /api/admin/workspace/{id}/upgrade {target: "1.1.0"}
   - Assert 202 ACCEPTED, upgrade_id_1
   - Job dequeued (Worker now running, simulated to take 5s)

2. Immediately POST /api/admin/workspace/{id}/upgrade {target: "2.0.0"}
   - Assert 409 CONFLICT (upgrade in progress)

3. Wait for first upgrade to complete
   - Poll GET /api/admin/workspace/{id}/upgrade/{upgrade_id_1}
   - Assert status: SUCCESS

4. Verify state:
   - schema_version = v1.1.0 (not v2.0.0, second upgrade never ran)

**Acceptance Criteria:**

- ✓ Second upgrade rejected (409) while first in progress
- ✓ First upgrade completes successfully
- ✓ Final schema_version is v1.1.0 (second never executed)

---

### Task 47: Integration Test: Schema Version Blocking at Runtime (426)

**Scope:** Runtime version enforcement  
**File:** `apps/api/tests/integration/migration/version-mismatch-426.test.ts`  
**Layer:** Testing (integration)  
**Transactional:** N/A  
**Idempotent:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**

Test 426 Upgrade Required response:

Setup:

1. Create test workspace at schema v1.0.0
2. Set platform_settings.minimum_supported_schema_version = "2.0.0"

Test 1: Request blocked (incompatible version)

1. GET /api/exam/list (any workspace request)
   - Assert 426 UPGRADE REQUIRED
   - Error: {code: SCHEMA_VERSION_MISMATCH, message: "Workspace schema version 1.0.0 below minimum supported 2.0.0..."}

Test 2: Upgrade to v2.0.0

1. POST /api/admin/workspace/{id}/upgrade {target: "2.0.0"}
   - Assert 202 ACCEPTED
2. Poll until SUCCESS

Test 3: Request succeeds (version now compatible)

1. GET /api/exam/list
   - Assert 200 OK (no 426 error)
   - Request proceeds normally

**Acceptance Criteria:**

- ✓ Version check blocks incompatible requests (426)
- ✓ Upgrade succeeds
- ✓ Subsequent requests proceed (version now compatible)

---

---

## Task Dependency Graph

**Phase 1: Infrastructure (Serial 1–8)**

```
1 (platform_settings) → 2 (migration_registry) → 3 (upgrade_snapshots) → 4 (schema_version) → 5 (tenants_registry)
     ↓
6 (version types) → 7 (version validator) → 8 (migration file validator)
```

**Phase 2: Domain Core (Parallel 9–14 after Phase 1)**

```
9 (master migration runner), 10 (tenant migration runner), 11 (snapshot manager), 12 (resolver integration), 13 (lookup service), 14 (product version validator)
```

**Phase 3: API Layer (Parallel 15–22 after Phase 2)**

```
15 (POST upgrade route), 16 (GET status), 17 (POST rollback), 18 (license middleware), 19 (input validation), 20 (error handler), 21 (rate limiter), 22 (idempotency key)
```

**Phase 4: Worker Layer (Parallel 23–30 after Phase 2)**

```
23 (job schema), 24 (lock mgmt), 25 (snapshot phase), 26 (migration phase), 27 (error handling), 28 (logging), 29 (metrics), 30 (rollback job)
```

**Phase 5: Frontend (Parallel 31–34 after Phase 3)**

```
31 (status component), 32 (request form), 33 (history table), 34 (page container)
```

**Phase 6: Observability (Parallel 35–39)**

```
35 (correlation ID), 36 (audit log), 37 (metrics queries), 38 (error mapping), 39 (logging config)
```

**Phase 7: Testing (Parallel 40–47 after all implementation)**

```
40 (version tests), 41 (file tests), 42 (e2e), 43 (license), 44 (rollback), 45 (idempotency), 46 (concurrent), 47 (426 test)
```

---

## Execution Summary

- **Total Tasks:** 47
- **Estimated Duration:** 10–14 development days (with parallelization)
- **Critical Path:** Infrastructure → Domain Core → API + Worker → Testing
- **Risk Areas:** Transaction semantics, snapshot integration, Worker job reliability
- **Quality Gates:** All unit tests ≥ 95% coverage; all integration tests passing; zero architectural exceptions

---

END TASKS
