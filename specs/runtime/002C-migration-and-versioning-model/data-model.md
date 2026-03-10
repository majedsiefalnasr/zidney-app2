# Data Model: Migration & Versioning System

**Purpose:** Define all versioning entities, migration tracking tables, and state management for the
migration engine

**Version:** 1.0.0  
**Created:** 2026-02-16  
**Scope:** Master DB + Tenant DB schema objects

---

## Master Database Entities

### Entity: platform_settings

- **Type:** System entity (singleton)
- **Purpose:** Track platform-wide schema version state and compatibility thresholds
- **Storage:** master_db
- **Attributes:**
  - `id` (UUID, PK): Always single record
  - `current_schema_version` (VARCHAR 20, NOT NULL): Platform latest (e.g., "1.2.0")
  - `minimum_supported_schema_version` (VARCHAR 20, NOT NULL): Floor version (e.g., "1.0.0")
  - `updated_at` (TIMESTAMPTZ, DEFAULT now()): Last platform update
  - `updated_by` (UUID, NULLABLE): Platform operator
- **Constraints:**
  - At most 1 record (enforced by application logic)
  - `current_schema_version` ≥ `minimum_supported_schema_version` (application validation)
- **Version Format:** Semantic Versioning (MAJOR.MINOR.PATCH)
- **Relationships:**
  - Referenced by all tenant compatibility checks
  - Referenced by all runtime resolver validation
- **Validation:**
  - Both versions must be valid SemVer
  - Minimum version cannot advance past current
  - Version changes trigger audit log
- **State Transitions:**
  - Version increments only (never decrements)
  - E.g., 1.0.0 → 1.0.1 (patch) or 1.0.0 → 1.1.0 (minor) or 1.0.0 → 2.0.0 (major)

---

### Entity: migration_registry

- **Type:** System entity (immutable audit log)
- **Purpose:** Track all applied migrations across all workspaces for audit trail and idempotency
- **Storage:** master_db
- **Attributes:**
  - `id` (UUID, PK): Migration execution record ID
  - `workspace_id` (UUID, FK → workspaces.id, NOT NULL): Which workspace
  - `migration_file` (VARCHAR 255, NOT NULL): Filename (e.g., "002_license_engine.sql")
  - `target_schema_version` (VARCHAR 20, NOT NULL): Which version this migration targets
  - `checksum` (VARCHAR 64, NOT NULL): SHA-256 of migration file content
  - `applied_at` (TIMESTAMPTZ, DEFAULT now()): When migration executed
  - `execution_time_ms` (INT, NOT NULL): Duration of migration
  - `status` (ENUM: SUCCESS | FAILED, NOT NULL): Outcome
  - `error_message` (TEXT, NULLABLE): If FAILED, the error
  - `operator_id` (UUID, NULLABLE): Which admin operator triggered
  - `snapshot_id` (UUID, NULLABLE): Associated snapshot ID (if applicable)
- **Constraints:**
  - UNIQUE (workspace_id, migration_file): Prevent duplicate execution of same file
  - `applied_at` uses server clock (authoritative time)
  - `execution_time_ms` must be non-negative
- **Relationships:**
  - Belongs-to: workspace (via workspace_id)
  - References: upgrade_snapshots (via snapshot_id, optional)
- **Validation:**
  - checksum must be exactly 64 hex characters (SHA-256)
  - target_schema_version must be valid SemVer
  - status paired with error_message (if FAILED, error required)
  - operator_id must exist if provided
- **State Transitions:**
  - Created with status = PENDING (during execution)
  - Transitions to SUCCESS or FAILED (immutable thereafter)
  - Cannot be updated or deleted (append-only log)
- **Indexing:**
  - Index: (workspace_id, applied_at DESC) — recent migrations for workspace
  - Index: (status, applied_at DESC) — find failed migrations
  - Index: (workspace_id, target_schema_version) — version timeline

---

### Entity: tenants_registry (modified)

**Add to existing table:**

- `schema_version` (VARCHAR 20, DEFAULT '1.0.0', NOT NULL): Cached tenant schema version
- **Purpose:** Fast lookups during resolver compatibility checks (source of truth remains tenant_db)
- **Validation:**
  - Must match tenant_db.schema_version (synchronized on every upgrade)
  - Must be valid SemVer
- **Update Behavior:**
  - Updated only when tenant migration succeeds
  - Updated transactionally with tenant_db.schema_version
  - Dual-write pattern ensures fast access
- **Indexing:**
  - Index: (schema_version) — find all workspaces on specific version
  - Enables batch upgrade discovery

---

### Entity: upgrade_snapshots

- **Type:** System entity (snapshot metadata)
- **Purpose:** Track backup snapshots before tenant upgrades for rollback capability
- **Storage:** master_db (metadata only; actual backup in storage system)
- **Attributes:**
  - `id` (UUID, PK): Snapshot record ID
  - `workspace_id` (UUID, FK → workspaces.id, NOT NULL): Which workspace backed up
  - `previous_schema_version` (VARCHAR 20, NOT NULL): Schema version before upgrade
  - `target_schema_version` (VARCHAR 20, NOT NULL): Schema version upgrade targeted
  - `snapshot_location` (VARCHAR 512, NOT NULL): S3 path or blob URL (e.g.,
    "s3://backups/workspace-123/snapshot-uuid.sql.gz")
  - `snapshot_size_bytes` (BIGINT, NOT NULL): Uncompressed size for storage planning
  - `created_at` (TIMESTAMPTZ, DEFAULT now()): When snapshot taken
  - `expires_at` (TIMESTAMPTZ, NOT NULL): When snapshot can be deleted
  - `retention_policy` (ENUM: MANUAL | AUTO_DELETE_30D, NOT NULL): Lifecycle
- **Constraints:**
  - `snapshot_location` must be unique (different snapshots = different locations)
  - `expires_at` > `created_at` (always)
  - `target_schema_version` > `previous_schema_version` (upgrades only)
- **Relationships:**
  - Belongs-to: workspace (via workspace_id)
  - Referenced-by: migration_registry (optional, via snapshot_id)
- **Validation:**
  - snapshot_location must resolve to valid storage system
  - snapshot_size_bytes must be > 0
  - both versions must be valid SemVer
- **State Transitions:**
  - Created: When upgrade starts (before migration)
  - Expires: After retention period (AUTO_DELETE_30D) or manually
  - Deleted: Only after retention period expires or manual purge
- **Lifecycle:**
  - Retention policy MANUAL: Never auto-deleted
  - Retention policy AUTO_DELETE_30D: Eligible for deletion after 30 days, deleted by retention job
- **Indexing:**
  - Index: (workspace_id, created_at DESC) — snapshots for workspace
  - Index: (expires_at) — schedule deletion job

---

## Tenant Database Entities

### Entity: schema_version

- **Type:** System entity (singleton, per workspace)
- **Purpose:** Single source of truth for tenant's current schema version
- **Storage:** tenant_db
- **Attributes:**
  - `id` (UUID, PK): Row ID (always single record per workspace)
  - `version` (VARCHAR 20, NOT NULL): Current schema version (e.g., "1.2.0")
  - `applied_at` (TIMESTAMPTZ, DEFAULT now()): When last migration completed
- **Constraints:**
  - At most 1 record per tenant (enforced at application level)
  - `version` must be valid SemVer
  - `version` must be ≥ minimum_supported_schema_version (application validation)
- **Relationships:**
  - Mirrored in: master_db.tenants_registry.schema_version
  - Referenced by: Platform compatibility checks
- **Validation:**
  - version format: MAJOR.MINOR.PATCH (e.g., "1.2.3")
  - version never decrements (forward-only)
- **State Transitions:**
  - Version increments only (never decrements)
  - Each increment represents successful migration
  - E.g., 1.0.0 → 1.0.1 → 1.1.0 → 2.0.0
- **Synchronization:**
  - Updated transactionally with master_db.tenants_registry.schema_version
  - Both must succeed or both must fail

---

## Migration File Structure

### Migration Naming Convention

```
<NUMBER>_<DESCRIPTION>.sql

Examples:
  001_init.sql
  002_license_engine.sql
  003_attempt_snapshot_indexes.sql
```

**Rules:**

- Sequential numeric prefix (001, 002, 003, ...)
- No gaps allowed (processor refuses to skip)
- Snake_case description
- No version number in filename (version in file header)

### Migration File Header (Mandatory)

All migration files must begin with:

```sql
-- Migration: <target_schema_version>
-- Required Minimum Product Version: <version_or_none>
-- Breaking: <true|false>
-- Description: <one-liner>

-- Example:
-- Migration: 1.1.0
-- Required Minimum Product Version: 1.0.0
-- Breaking: false
-- Description: Add attempt snapshot scoring tables
```

**Fields:**

- `Migration`: Target schema version (must be parseable SemVer)
- `Required Minimum Product Version`: Earliest product version allowed to run this migration (or
  "none")
- `Breaking`: Set to `true` only if this migration requires MAJOR version bump
- `Description`: Purpose of migration

### Migration File Body Rules

**Allowed operations:**

- CREATE TABLE (new tables)
- ALTER TABLE ADD COLUMN (additive)
- CREATE INDEX
- CREATE VIEW
- INSERT INTO (bootstrap data)

**Forbidden operations:**

- DROP COLUMN (requires MAJOR version, explicit approval)
- ALTER TABLE DROP COLUMN
- ALTER TABLE MODIFY COLUMN (type narrowing)
- DELETE FROM (destructive)
- TRUNCATE TABLE

**Idempotency requirement:**

All DDL must be idempotent:

```sql
-- CORRECT: Idempotent
CREATE TABLE IF NOT EXISTS attempts (...)
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS status VARCHAR(50)

-- WRONG: Non-idempotent (fails on re-run)
CREATE TABLE attempts (...)
ALTER TABLE users ADD COLUMN status VARCHAR(50)
```

### Migration File Validation

**Before execution, processor must verify:**

1. ✓ File format compliance (correct naming)
2. ✓ Header parsing (migration version, breaking flag)
3. ✓ Checksum match (SHA-256 against registry)
4. ✓ No duplicate execution (check migration_registry)
5. ✓ No gaps (all prior migrations applied)
6. ✓ Version continuity (target > previous, or MAJOR bump if breaking)

**If any check fails:**

- Migration execution aborted
- Error logged with reason
- Workspace remains unlocked
- Operator intervention required

---

## Version Compatibility Matrix

### Semantic Versioning Rules

| Change Type      | Example             | Version Increment     | Notes                    |
| ---------------- | ------------------- | --------------------- | ------------------------ |
| Non-breaking fix | Add nullable column | PATCH (1.0.0 → 1.0.1) | Backward compatible      |
| Additive feature | Add new table       | MINOR (1.0.0 → 1.1.0) | Backward compatible      |
| Breaking change  | Remove column       | MAJOR (1.0.0 → 2.0.0) | Requires explicit opt-in |

### Runtime Compatibility Check

**Request arrives:**

1. Resolver queries `tenant.schema_version` (from tenant_db.schema_version)
2. Resolver queries `platform_settings.minimum_supported_schema_version` (from master_db)
3. Resolver validates: `tenant.schema_version ≥ minimum_supported_schema_version`
4. If valid: Request proceeds; If invalid: Return 426 Upgrade Required

**Example incompatibility:**

- Platform released v2.0.0, set minimum_supported_schema_version = 2.0.0
- Workspace still at v1.9.0
- Platform rejects all requests: "Upgrade required from 1.9.0 to ≥2.0.0"

---

## Migration Execution State Machine

### Master Migration Flow

```
[Startup]
  ↓
[Load all migration files]
  ↓
[For each migration in sequence]
  ├─ Check if applied (migration_registry lookup)
  ├─ If applied: Skip
  ├─ If not applied:
  │  ├─ Validate checksum
  │  ├─ Execute in transaction
  │  ├─ Record in migration_registry
  │  └─ Update platform_settings.current_schema_version
  ↓
[All migrations applied]
  ↓
[Platform boots] or [Fails and refuses boot]
```

### Tenant Migration Flow

```
[Upgrade triggered by admin]
  ↓
[Validate license: ACTIVE]
  ↓
[Create snapshot (pre-migration)]
  ↓
[Acquire workspace write lock]
  ↓
[For each migration in sequence]
  ├─ Validate checksum
  ├─ Execute in transition
  ├─ Record in migration_registry
  ├─ Update tenant_db.schema_version
  └─ Update master_db.tenants_registry.schema_version
  ↓
[Release workspace write lock]
  ↓
[COMMIT]
  ↓
[Success response to admin] or [Rollback + error response]
```

---

## Data Integrity Rules

### Immutability Constraints

- `migration_registry` records: Append-only, never updated
- `upgrade_snapshots` records: Append-only until expiration
- `schema_version` files: Overwritten (not appended)

### Dual-Write Synchronization

When tenant upgrade completes:

```
BEGIN
  ├─ tenant_db.schema_version = target_version  ← Write 1
  ├─ master_db.tenants_registry.schema_version = target_version  ← Write 2
  ├─ master_db.licenses.product_version = new_version (if required)  ← Write 3
  └─ COMMIT
```

**Atomicity:** Both writes must succeed or both must fail

**Truth hierarchy:**

1. tenant_db.schema_version (source of truth)
2. master_db.tenants_registry.schema_version (cache, must match)
3. API response (derived from cache for speed)

### Checksum Integrity

**Checksum calculation (SHA-256):**

```
sha256(file_content_as_bytes) → 64-character hex string

Stored in: migration_registry.checksum
Validated: Before every migration execution
Purpose: Detect file tampering or version drift
```

**If checksum mismatch detected:**

- Migration refused
- CRITICAL log emitted
- Operator must investigate

---

## Example Data Snapshots

### Platform Settings After Deployment

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "current_schema_version": "1.2.0",
  "minimum_supported_schema_version": "1.0.0",
  "updated_at": "2026-02-16T10:30:00Z",
  "updated_by": "admin-uuid"
}
```

### Migration Registry After Upgrade

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "workspace_id": "acme-university-workspace-uuid",
    "migration_file": "001_init.sql",
    "target_schema_version": "1.0.0",
    "checksum": "abc123def456...",
    "applied_at": "2026-02-16T09:00:00Z",
    "execution_time_ms": 450,
    "status": "SUCCESS",
    "error_message": null,
    "operator_id": null,
    "snapshot_id": null
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "workspace_id": "acme-university-workspace-uuid",
    "migration_file": "002_license_engine.sql",
    "target_schema_version": "1.1.0",
    "checksum": "xyz789abc123...",
    "applied_at": "2026-02-16T10:30:00Z",
    "execution_time_ms": 1250,
    "status": "SUCCESS",
    "error_message": null,
    "operator_id": "admin-operator-uuid",
    "snapshot_id": "snapshot-uuid-123"
  }
]
```

### Tenant Schema Version

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "version": "1.1.0",
  "applied_at": "2026-02-16T10:30:00Z"
}
```

---

## Storage & Performance Notes

### Database Indexing Strategy

**master_db.migration_registry:**

- (workspace_id, applied_at DESC): Fast recent migration lookup
- (status, applied_at DESC): Failure tracking
- UNIQUE (workspace_id, migration_file): Idempotency enforcement

**master_db.upgrade_snapshots:**

- (workspace_id, created_at DESC): Snapshot timeline per workspace
- (expires_at): Retention job scheduling

**master_db.tenants_registry:**

- Existing indexes preserved
- Add index on schema_version for batch lookups

**tenant_db.schema_version:**

- No index needed (single row, rarely queried)

### Estimated Storage

**per migration_registry record:** ~500 bytes (metadata only) **per upgrade_snapshots record:** ~200
bytes (metadata only, snapshot stored externally)

**Retention:**

- migration_registry: Keep forever (audit trail)
- upgrade_snapshots: 30 days default, manual purge supported

---

END DATA MODEL
