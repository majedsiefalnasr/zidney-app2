# SPEC – Migration & Versioning Model (STAGE_02C)

**Phase:** 1 – Platform Foundation  
**Stage:** STAGE_02C_MIGRATION_AND_VERSIONING_MODEL  
**Status:** Specification  
**Priority:** Critical  
**Feature Area:** Schema evolution governance, version control

---

## Feature Overview

### What Is Being Built

A deterministic, auditable migration and versioning system that:

- Enforces forward-only schema evolution across master and tenant databases
- Prevents schema drift through strict version tracking
- Enables controlled, opt-in tenant upgrades
- Guarantees schema consistency across all tenants
- Operationalizes ADR-0008 (Semantic Versioning Policy)
- Provides safe rollback via snapshot restoration only
- Enforces runtime compatibility checks

### Phase & Stage Mapping

- **Phase:** 1 – Platform Foundation
- **Stage:** STAGE_02C_MIGRATION_AND_VERSIONING_MODEL
- **Provides foundation for:** All subsequent schema changes across platform
- **Depends on:** ADR-0008, STAGE_02A (Master schema), STAGE_02B (Tenant baseline)

### Affected Architectural Layers

- **Isolation:** Enforced per tenant
- **License Enforcement:** Mandatory before upgrade execution
- **Attempt Engine:** Snapshot integrity rules apply
- **Worker:** Only async runner allowed to execute migrations
- **Runtime:** Compatibility checks mandatory at resolver level
- **Frontoffice:** Blocked if schema incompatible (426 error)

---

## Constitutional Compliance Declaration

**Mandatory Compliance Confirmations:**

✓ **No cross-tenant access** — All migrations scoped to master or single tenant  
✓ **No middleware bypass** — License validation required before upgrade execution  
✓ **No grading outside worker** — Grading snapshots managed by attempt engine  
✓ **No direct DB instantiation** — All connections via resolver context  
✓ **No snapshot integrity weakening** — Upgrade snapshots transactional  
✓ **No transaction boundary weakening** — Migrations atomic, all-or-nothing  
✓ **No version enforcement weakening** — Runtime refuses incompatible schemas

**Governance Reference:** ADR-0008 (Semantic Versioning Policy)

**Status:** COMPLIANT — No architectural exceptions required.

---

## Isolation Impact Analysis

### Database Layer Access

| Layer             | Database              | Tenant Scope  | Resolution          | Connection Pool    |
| ----------------- | --------------------- | ------------- | ------------------- | ------------------ |
| Master migrations | master_db             | N/A (shared)  | N/A                 | Global pool        |
| Tenant migrations | tenant_db             | Per workspace | Via tenant resolver | Tenant-scoped pool |
| Version checks    | master_db + tenant_db | Both          | License middleware  | Both pools         |

### Tenant Resolution

- **Master migrations:** No tenant context (platform deployment)
- **Tenant migrations:**
  - Resolved via `workspace_slug`
  - Verified against `master_db.tenants_registry`
  - Executed in tenant-scoped connection pool
  - Locked during upgrade to prevent concurrent writes

### Connection Pool Management

- Global pool for master DB operations (initialization)
- Per-tenant pool maintained in memory map (keyed by workspace_slug)
- Connection pools obtained only after tenant resolver validates license
- Pools destroyed only at unprovisioning

### Isolation Guarantees

✓ No shared tenant migration state  
✓ No cross-tenant version conflicts  
✓ No implicit schema compatibility  
✓ Each tenant's schema_version independently tracked  
✓ Upgrade failure confined to single tenant

---

## License & Version Enforcement

### License Middleware Integration

**Required before upgrade execution:**

- License status validation → ACTIVE required
- License not SOFT_LOCKED (returns 423)
- License not ARCHIVED (returns 403)
- Limit enforcement validated (transactional)

### Version Compatibility Checks

**On every workspace-bound request:**

- Resolver validates: `tenant.schema_version ≥ platform.minimum_supported_schema_version`
- Resolver validates: `license.product_version compatible with runtime` (per ADR-0008)
- If incompatible: Response 426 Upgrade Required
- If incompatible: Request blocked before business logic execution

### Version Dimensions

| Dimension           | Storage                                                      | Owner    | Purpose                                |
| ------------------- | ------------------------------------------------------------ | -------- | -------------------------------------- |
| **Schema version**  | tenant_db.schema_version                                     | Tenant   | Migration tracking (MAJOR.MINOR.PATCH) |
| **Schema version**  | master_db.tenants_registry.schema_version                    | MMC      | Fast compatibility checks              |
| **Product version** | master_db.licenses.product_version                           | License  | Feature/module availability            |
| **Min supported**   | master_db.platform_settings.minimum_supported_schema_version | Platform | Forced upgrade threshold               |

### Version Incompatibility Response

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

HTTP Status: **426 Upgrade Required**

---

## Data Model Changes

### New Schema Objects

#### master_db.platform_settings

```sql
CREATE TABLE platform_settings (
  id UUID PRIMARY KEY,
  current_schema_version VARCHAR(20) NOT NULL,
  minimum_supported_schema_version VARCHAR(20) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  updated_by UUID NOT NULL
);
```

**Purpose:** Platform-level schema version tracking

#### master_db.migration_registry

```sql
CREATE TABLE migration_registry (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  migration_file VARCHAR(255) NOT NULL,
  target_schema_version VARCHAR(20) NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  applied_at TIMESTAMP NOT NULL,
  execution_time_ms INT NOT NULL,
  status ENUM('SUCCESS', 'FAILED') NOT NULL,
  error_message TEXT,
  operator_id UUID,
  snapshot_id UUID,
  UNIQUE(workspace_id, migration_file)
);
```

**Purpose:** Audit trail for all applied migrations

#### tenant_db.schema_version

```sql
CREATE TABLE schema_version (
  id UUID PRIMARY KEY,
  version VARCHAR(20) NOT NULL,
  applied_at TIMESTAMP NOT NULL
);
```

**Purpose:** Single-row table tracking tenant's current schema version

#### master_db.upgrade_snapshots

```sql
CREATE TABLE upgrade_snapshots (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  previous_schema_version VARCHAR(20) NOT NULL,
  target_schema_version VARCHAR(20) NOT NULL,
  snapshot_location VARCHAR(512) NOT NULL,
  snapshot_size_bytes BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  retention_policy ENUM('MANUAL', 'AUTO_DELETE_30D') NOT NULL
);
```

**Purpose:** Snapshot metadata for upgrade rollback capability

### Modified Schema Objects

#### master_db.tenants_registry

**Add column:**

```sql
ALTER TABLE tenants_registry
ADD COLUMN schema_version VARCHAR(20) DEFAULT '1.0.0' NOT NULL;
```

**Purpose:** Cached for fast compatibility checks (source of truth remains tenant_db)

#### master_db.licenses

**Schema already includes:**

- `product_version` VARCHAR(20)
- Purpose: Feature availability control per ADR-0008

---

## Transaction Boundaries

### Master Migration Execution

**Transaction model:** Single transaction per deployment

```
BEGIN
  ├─ Load migration files sequentially
  ├─ Validate: No gaps (e.g., 003 exists if executing 004)
  ├─ For each migration:
  │  ├─ Checksum validation
  │  ├─ Execute SQL
  │  ├─ Record in migration_registry
  │  └─ Validate success
  ├─ Update platform_settings.current_schema_version
  └─ COMMIT or ROLLBACK
```

**Failure behavior:**

- All migrations in single transaction
- Failure blocks platform boot
- Operator must review, fix, and re-run

### Tenant Migration Execution

**Transaction model:** Single transaction per workspace upgrade

```
BEGIN
  ├─ Acquire workspace write lock
  ├─ Validate license: ACTIVE
  ├─ Create snapshot (before transaction)
  ├─ For each migration file:
  │  ├─ Validate checksum
  │  ├─ Execute in tenant context
  │  └─ Record in migration_registry
  ├─ Update tenant_db.schema_version
  ├─ Update master_db.tenants_registry.schema_version
  ├─ Update master_db.licenses.product_version (if required)
  ├─ Release workspace write lock
  └─ COMMIT or ROLLBACK
```

**Failure behavior:**

- Full rollback on any migration failure
- Workspace remains on previous schema version
- Snapshot retained for manual rollback
- CRITICAL log emitted
- Lock released
- Manual operator intervention required

### What Must Be Idempotent

**Script-level idempotency (Q2.1):** Entire migration script replayable with same outcome (strict requirement)

- Worker may retry full migration script (exponential backoff, max 3 retries, then DLQ)
- Non-idempotent DML forbidden (e.g., `counter = counter + 1` not allowed)

**Duplicate Prevention (Q2.2 + Q2.4):**

- Synchronous: API validates (workspace_id, target_version) uniqueness before accepting request
- Worker also enforces: Max 1 active upgrade per workspace (internal serialization)
- UNIQUE(workspace_id, target_version) in migration_registry prevents duplicates
- Idempotent SET version = value ensures replay safety

**Snapshot Idempotency (Q2.5):**

- Snapshots keyed by (workspace_id, target_schema_version, migration_file_hash)
- Prevents duplicate snapshots if retry occurs
- Snapshot reused on retry
- Snapshots immutable once created

### Replay After Partial Failure (Q2.3)

**Retry policy:**

- Exponential backoff (1s, 2s, 4s retries)
- Max 3 retries
- After failure: Placed in DLQ
- No per-statement tracking; entire script re-runs
- Idempotency ensures safe re-execution of already-done statements

### What Must Never Be Idempotent

- Destructive operations (DROP, ALTER removal) — marked MAJOR, require explicit approval
- Data deletion — never auto-repeated

---

## Authoritative Time Usage

### Server-Authoritative Time

- **Clock source:** Database server clock (CURRENT_TIMESTAMP)
- **Usage points:**
  - Migration execution timestamps
  - Snapshot creation time
  - Upgrade completion time
  - Rollback audit timestamps

### No Client Time Trust

- Client time never used for migration decisions
- Upgrade deadlines validated server-side
- Timeout validation uses server clock
- Drift detection: Compare server_timestamp vs client_reported_time

---

## Idempotency Strategy

### Migration File Idempotency

**Constraint:** Migration files must encode idempotent operations

**Example safe pattern:**

```sql
-- SAFE: Idempotent
CREATE TABLE IF NOT EXISTS schema_version (...)
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS status VARCHAR(50)
CREATE INDEX IF NOT EXISTS ON attempts(user_id)
```

**Example unsafe pattern:**

```sql
-- UNSAFE: Non-idempotent (run twice = error)
ALTER TABLE attempts DROP COLUMN status
DELETE FROM attempts WHERE id > 100
```

### Upgrade Idempotency

**Idempotency key:** (workspace_id, migration_file) → Unique constraint in migration_registry

**Replay protection:**

- Check migration_registry before execution
- If record exists with SUCCESS: Skip file, log warning
- If record exists with FAILED: Re-run (allow retry)

**Duplicate submission protection:**

- Workspace write lock prevents concurrent upgrades
- Lock held for entire migration execution
- Double-click upgrade button → First acquires lock, second waits then sees completion

---

## Observability Requirements

### Structured Logging

**All migration operations must log:**

```json
{
  "timestamp": "2026-02-16T10:30:45Z",
  "level": "INFO",
  "service": "migration-engine",
  "correlation_id": "uuid",
  "workspace_slug": "acme-university",
  "workspace_id": "uuid",
  "event": "migration_started|migration_completed|migration_failed",
  "migration_file": "002_license_engine.sql",
  "target_schema_version": "1.1.0",
  "previous_schema_version": "1.0.0",
  "execution_time_ms": 1250,
  "snapshot_id": "uuid",
  "operator_id": "uuid",
  "status": "SUCCESS|FAILED",
  "error_code": "MIGRATION_SYNTAX_ERROR",
  "error_message": "..."
}
```

### Required Fields

- `correlation_id` — Request tracing
- `workspace_slug` — Tenant context
- `workspace_id` — Unique workspace reference
- `migration_file` — Which migration running
- `status` — SUCCESS/FAILED
- `execution_time_ms` — Performance monitoring
- `snapshot_id` — Snapshot tracking
- `operator_id` — Audit trail

### Metrics (if critical path)

- `schema_migration_duration_ms` — Histogram
- `schema_migration_success_total` — Counter
- `schema_migration_failure_total` — Counter
- `workspace_schema_version_gauge` — Per-tenant schema version

---

## Rate Limiting & Abuse Protection

### Upgrade Endpoint Classification

- **Classification:** Admin-only, workspace-scoped
- **Rate limit policy:**
  - 1 concurrent upgrade per workspace (enforced by write lock)
  - Max 5 upgrade attempts per hour per workspace (soft limit)
  - Exceed → 429 Too Many Requests

### Replay Attack Mitigation

- Idempotency key: (workspace_id, migration_file)
- Duplicate submissions detected via migration_registry unique constraint
- Second request returns status of first execution

### Async Job Protection

- Worker queue: One migration job per workspace (FIFO)
- Duplicate job submission: Detected at queue level, rejected
- Failed job: Placed in DLQ, manual retry by operator

---

## Concurrency & Lock Management

### Write Lock Scope (Q3.1)

**Write lock blocks:** Database writes only; reads allowed; backgroundjobs suspended

- User data writes (exam submissions, attempt grading): Blocked with HTTP 423 Unavailable
- Background jobs (scoring, notifications, DLQ processing): Suspended
- Reads (workspace configuration, archive queries): Allowed
- Write lock timeout: Per deployment configuration (default: 60 seconds)

### Lock Acquisition Failure (Q3.2)

**If lock cannot be acquired:**

- Response: 409 Conflict "Upgrade in progress, try again later"
- No queuing at HTTP layer (immediate rejection)
- Worker queue serializes internally (FIFO by workspace_id)

### Concurrent Snapshots (Q3.3)

- Snapshot creation: Inside write lock (serialized per workspace)
- Parallel across different workspaces: Allowed
- Snapshot storage: No rate limiting (but monitored for disk exhaustion)

### Master Migrations During Deployment (Q3.4)

**App startup:**

- Master migrations block app startup entirely
- No requests processed until master complete
- If master fails: App refuses to boot

### Cache Divergence (Q3.5)

- **Pattern:** Eventual consistency acceptable; cache may lag up to 60 seconds
- **TTL:** In-memory cache of platform_settings with 60-second TTL
- **Resolver behavior:** If mismatch detected, resolver uses tenant_db as truth during upgrade window
- **Invalidation signal:** Pubsub event `PLATFORM_SETTINGS_UPDATED` for immediate propagation

---

## Version Enforcement

### SemVer Strictness (Q4.1)

**Enforcement:** SemVer strictly enforced; malformed versions rejected at write time

- No implicit normalization of "1.2" to "1.2.0"
- No prerelease versions in production (e.g., "2.0.0-rc1" forbidden)
- Malformed version strings rejected before persistence

### Upgrade Target Validation (Q4.2)

**Rule:** Upgrade target must be ≥ minimum_supported; otherwise reject upgrade request

- If target_version < platform_settings.minimum_supported_schema_version: Reject with 400 Bad Request
- Minimum_supported is enforcement floor for runtime
- Cannot bypass forced upgrade thresholds

### Product Version Compatibility (Q4.3)

**Validation timing (Q5.1):** Migration runner validates product_version before executing migration

**Rules:**

- Migration file header includes: `Required Minimum Product Version: X.Y.Z`
- If workspace license.product_version < required minimum: Block migration before execution
- Product version NOT auto-bumped; explicit operator action required
- Product version and schema_version independent but cross-validated

---

## Middleware Enforcement (Q5)

### License Validation Timing (Q5.1)

**Two-layer validation (belt-and-suspenders):**

1. **HTTP Middleware:** License validated before route handler
   - License status: ACTIVE required
   - SOFT_LOCKED → 423 Forbidden
   - ARCHIVED → 403 Forbidden

2. **Worker (pre-migration):** License re-validated before migration execution
   - If license transitions to SOFT_LOCKED after HTTP acceptance: Migration skipped
   - Snapshot retained for audit trail
   - CRITICAL log emitted

### Cache Invalidation for Platform Settings (Q5.2)

**Model:** In-memory cache with pubsub invalidation signal

- **TTL:** 60-second fallback
- **Invalidation event:** `PLATFORM_SETTINGS_UPDATED` (pubsub)
- **Behavior:** Event triggers cache flush in all services
- **No update:** Resolver loads fresh from master_db on next request after expiry

---

## Security Validation

### Migration File Content Validation (Q6.1)

**Three-layer validation (defense-in-depth):**

1. **SQL Parser:** Rejects forbidden statements before execution
   - DROP COLUMN, ALTER TABLE DROP COLUMN forbidden (unless MAJOR bump approved)
   - Parser runs before migration_registry check

2. **SHA256 Checksum:** File integrity verified
   - Checksum stored in master_db.migration_registry
   - Detects file tampering/corruption
   - Mismatch → 500 MIGRATION_TAMPERING_DETECTED

3. **Authorization:** No override without architecture approval
   - Destructive operations require explicit ADR exception
   - Operator audit log captures who approves overrides

---

## Layer Separation Confirmation

✓ **Frontend (Frontoffice):**

- No business logic in upgrade UI
- No direct schema introspection
- Shows cached schema_version from API only
- No retry logic (backend handles)

✓ **API (Router):**

- Routes upgrade requests to Worker
- No direct migration execution
- Returns idempotent status responses
- Enforces license middleware before accepting upgrade request

✓ **Domain Packages:**

- Migration runner business logic isolated
- Pure functions for version comparison
- No HTTP logic embedded

✓ **Worker:**

- Sole executor of migration code
- Handles transactional semantics
- Manages snapshot creation/restoration
- Performs version metadata updates

✓ **MMC:**

- Does not execute tenant DB migrations
- Only views migration history
- No direct schema modification authority

---

---

## Failure Modes & Recovery

### Error Contract (Q7.1-Q7.3)

All errors follow standard error contract:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

**Error Code Reference:**

| Failure                  | HTTP | Code                          | Message                                 |
| ------------------------ | ---- | ----------------------------- | --------------------------------------- |
| Migration syntax error   | 400  | MIGRATION_SYNTAX_ERROR        | "Invalid SQL in migration: [statement]" |
| Snapshot storage full    | 507  | SNAPSHOT_STORAGE_FULL         | "Cannot snapshot: storage full"         |
| License inactive         | 423  | LICENSE_INACTIVE              | "License [status]. Contact admin."      |
| Upgrade in progress      | 409  | WORKSPACE_UPGRADE_IN_PROGRESS | "Upgrade in progress"                   |
| Checksum mismatch        | 500  | MIGRATION_TAMPERING_DETECTED  | "Checksum mismatch"                     |
| Migration gap            | 500  | MIGRATION_SEQUENCE_GAP        | "Migration 003 missing"                 |
| DB connection failure    | 503  | DATABASE_UNAVAILABLE          | "Cannot connect to database"            |
| Lock timeout             | 504  | MIGRATION_LOCK_TIMEOUT        | "Lock timeout"                          |
| Validation failure       | 500  | MIGRATION_VALIDATION_FAILED   | "Validation failed"                     |
| Snapshot restore failure | 500  | SNAPSHOT_RESTORE_FAILED       | "Restore failed"                        |
| Schema mismatch          | 426  | SCHEMA_VERSION_MISMATCH       | "Upgrade required: 1.0.0 < 2.0.0"       |
| Product incompatible     | 400  | PRODUCT_VERSION_INCOMPATIBLE  | "Requires product ≥ 1.5.0"              |

**Async errors returned via polling endpoint** (identical format to sync errors)

**Partial success included in error response** (operations attempted, operation succeeded, failed operation with detail)

### Failure Scenarios

#### Migration Syntax Error (Q7.1)

- Execution: 400 MIGRATION_SYNTAX_ERROR
- Transaction rolls back
- migration_registry records FAILED
- Error message sanitized (no raw stack trace)

#### Snapshot Creation Failure (Q7.1)

- Before migration: 507 SNAPSHOT_STORAGE_FULL
- Upgrade aborted, lock not acquired
- No transaction attempted

#### License Validation Failure (Q5.1)

- Middleware check: 423 LICENSE_INACTIVE
- Worker check (retry): Migration skipped
- Snapshot retained for audit

#### Workspace Upgrade In Progress (Q3.2)

- HTTP layer: 409 CONFLICT
- No queuing, immediate rejection
- Worker internally FIFO

#### Timeout (Q3.4/Q7.1)

- Default: 30 minutes per migration
- Configurable per deployment
- Result: 504 MIGRATION_LOCK_TIMEOUT / 500 on rollback

---

## Isolation Boundaries

### Registry Access (Q8.1)

**Migration registry:** Operator-only

- MMC operators: Full cross-tenant visibility
- Workspace admins: Only own history
- Query `master_db.migration_registry`: Requires MMC role

### Cross-Tenant Snapshot Restore (Q8.2)

**Safeguard:** workspace_id validation

- Load snapshot → Compare workspace_id
- Mismatch → Error 400 INVALID_SNAPSHOT_FOR_WORKSPACE
- Impossible to restore across tenants
- All attempts logged

---

## Test Strategy

### Unit Tests Required

**Migration version comparison:**

- Version parsing (e.g., "1.2.3" → [1, 2, 3])
- Compatibility validation (e.g., 1.2.3 ≥ 1.0.0 → true)
- Invalid version format rejection

**Migration file validation:**

- Checksum calculation consistency
- Target version extraction from migration header
- Backward compatibility markers detection

**Version bump validation:**

- MAJOR bump required for destructive changes
- MINOR bump allowed for additive changes
- PATCH bump allowed for non-structural fixes

### Integration Tests Required

**End-to-end upgrade workflow:**

1. Setup: Create test workspace with schema v1.0.0
2. Prepare: v1.1.0 migration file ready
3. Execute: Trigger upgrade
4. Validate: schema_version updated in tenant_db AND master_db.tenants_registry
5. Verify: All requests after upgrade proceed (no 426 errors)

**License validation during upgrade:**

1. Setup: Workspace with SOFT_LOCKED license
2. Execute: Attempt upgrade
3. Verify: Rejected before migration execution
4. Transition: License to ACTIVE
5. Execute: Retry upgrade
6. Verify: Upgrade succeeds

**Transaction rollback on failure:**

1. Setup: Workspace with v1.0.0
2. Prepare: v1.1.0 migration with syntax error
3. Execute: Trigger upgrade
4. Verify: Migration fails, transaction rolls back
5. Validate: Workspace still at v1.0.0
6. Verify: Snapshot retained

**Idempotency test:**

1. Setup: Workspace at v1.0.0
2. Execute: Upgrade to v1.1.0 (succeeds)
3. Validate: migration_registry shows SUCCESS
4. Execute: Retry same upgrade command
5. Verify: Second request returns status (no double execution)
6. Validate: No duplicate version changes

**Concurrent upgrade prevention:**

1. Setup: Workspace at v1.0.0
2. Execute: Upgrade to v1.1.0 (slow, 10s operation)
3. Immediately: Attempt second upgrade to v2.0.0
4. Verify: Second request queued or rejected
5. Verify: Only first upgrade executes
6. Verify: Workspace reaches v1.1.0 (not skip to v2.0.0)

**Version compatibility enforcement at runtime:**

1. Setup: Workspace at v1.0.0, minimum_supported_schema_version = 2.0.0
2. Execute: API request
3. Verify: Resolver blocks, returns 426
4. Execute: Upgrade workspace to v2.0.0
5. Execute: Same API request
6. Verify: Request proceeds (no 426)

---

## Explicit Non-Goals

**This stage does NOT:**

- Implement automatic schema detection or inference
- Handle zero-downtime schema migrations (operator coordination required)
- Support blue-green deployment of schema versions
- Provide instant rollback (rollback requires manual operator action via snapshot)
- Replace database backup/recovery systems
- Handle data transformation during migrations
- Support cross-database schema synchronization
- Provide real-time migration progress streaming

**Handled by other stages:**

- Snapshot infrastructure (DevOps)
- Backup/restore automation (DevOps)
- Monitoring dashboard (Observability)
- Workspace-level configuration (License engine)

---

## Validation Criteria (Stage Complete)

✓ Master migration runner implemented  
✓ Tenant migration runner implemented  
✓ Snapshot-before-upgrade enforced (async job)  
✓ Version mismatch blocks runtime (resolver)  
✓ Product version compatibility enforced (resolver)  
✓ Duplicate migration execution prevented (unique constraints)  
✓ Failed migration fully rolls back (transactional)  
✓ Upgrade log persisted (migration_registry)  
✓ Resolver enforces minimum schema version (on every request)  
✓ Enforcement aligned with ADR-0008 (semantic versioning)  
✓ All tests passing (unit + integration)  
✓ Migration folder structure conformant  
✓ Error responses comply with error standard

---

## Constitutional Compliance Statement

**Compliant with Zidney Constitution v1.2.0 — No violations detected.**

- ✓ Multi-tenancy model: Database-per-tenant preserved
- ✓ Import boundaries: No cross-app violations
- ✓ Layering model: UI/API/Domain/Worker separated
- ✓ License enforcement: Middleware mandatory before execution
- ✓ Attempt engine: Snapshot integrity preserved
- ✓ Error handling: Error standard compliant
- ✓ Logging: Structured logging required
- ✓ Migration rules: Forward-only, versioned, immutable
- ✓ Testing: Unit + integration mandatory
- ✓ Secrets: No secrets in migration files

---

END SPECIFICATION
