# STAGE_02C Quickstart

**Stage:** STAGE_02C_MIGRATION_AND_VERSIONING_MODEL  
**Phase:** 01 – Platform Foundation  
**Quick Reference for Implementers**

---

## What You're Building

A deterministic, audit-friendly migration engine that:

- Tracks schema versions across master + all tenants
- Prevents schema drift with SemVer versioning
- Enables controlled, opt-in tenant upgrades
- Guarantees rollback capability via snapshots
- Blocks incompatible runtime requests (426 errors)

**Key principle:** Forward-only, immutable, versioned schema evolution.

---

## Core Concepts (60-Second Version)

| Concept                 | Meaning                                                     |
| ----------------------- | ----------------------------------------------------------- |
| **Schema Version**      | SemVer (e.g., 1.2.0) stored in tenant_db and master_db      |
| **Migration File**      | SQL file (001_init.sql) applying schema change              |
| **Forward-Only**        | Versions only increase; no rollback of SQL                  |
| **Opt-In Upgrade**      | Workspaces choose when to upgrade                           |
| **Snapshot**            | Pre-upgrade DB backup for manual rollback only              |
| **Compatibility Check** | Runtime validates tenant.schema_version ≥ minimum_supported |

---

## Critical Rules (Must Know)

1. **No schema change without version bump**
   - Add column → MINOR (1.0.0 → 1.1.0)
   - Remove column → MAJOR (1.0.0 → 2.0.0, requires approval)
   - Non-structural fix → PATCH (1.0.0 → 1.0.1)

2. **No per-tenant schema differences**
   - All tenants on same migration path
   - Cannot customize schema per tenant
   - If exception needed: ADR required

3. **Migration files immutable after merge**
   - Edit before merge: OK
   - Edit after production deploy: NEVER
   - New change → New migration file

4. **License validation before upgrade**
   - Only ACTIVE workspaces can upgrade
   - SOFT_LOCKED → 423 Forbidden
   - ARCHIVED → 403 Forbidden

5. **Snapshot mandatory before tenant upgrade**
   - Full DB backup before migration
   - Snapshot keyed by migration ID
   - Snapshot persisted for 30 days (default)

6. **Transactional migrations**
   - All or nothing (no partial state)
   - Single transaction: Migrations + version update
   - Failure → Full rollback

---

## Core Files & Locations

| Artifact          | Location                              |
| ----------------- | ------------------------------------- |
| Master migrations | apps/api/src/db/master/migrations/    |
| Tenant migrations | apps/api/src/db/tenant/migrations/    |
| Migration runner  | packages/domain-core/migration/       |
| Version models    | packages/types/migration-types.ts     |
| Resolver check    | packages/domain-core/tenant-resolver/ |

---

## Implementation Checklist

- [ ] Master migration runner
  - [ ] Load migration files sequentially
  - [ ] Validate no gaps (001, 002, 003, ...)
  - [ ] Checksum validation
  - [ ] Transactional execution
  - [ ] Update platform_settings.current_schema_version
  - [ ] Record in migration_registry
  - [ ] Refuse boot on failure

- [ ] Tenant migration runner
  - [ ] Acquire workspace write lock
  - [ ] Validate license ACTIVE
  - [ ] Create snapshot (async)
  - [ ] Execute migrations transactionally
  - [ ] Update tenant_db.schema_version
  - [ ] Update master_db.tenants_registry.schema_version
  - [ ] Release lock
  - [ ] Log completion

- [ ] Resolver compatibility check
  - [ ] Read platform_settings.minimum_supported_schema_version
  - [ ] Read tenant_db.schema_version (or cache from master_db)
  - [ ] Validate: tenant_version ≥ minimum_supported
  - [ ] If incompatible: Return 426 Upgrade Required

- [ ] Schema objects
  - [ ] master_db.platform_settings (table + singleton record)
  - [ ] master_db.migration_registry (audit log)
  - [ ] master_db.upgrade_snapshots (snapshot metadata)
  - [ ] master_db.tenants_registry.schema_version (add column)
  - [ ] tenant_db.schema_version (single-row table)

- [ ] Observability
  - [ ] Structured logging: migration start/complete/fail
  - [ ] Include: correlation_id, workspace_slug, operation, status
  - [ ] Include: execution_time_ms, snapshot_id

- [ ] Error handling
  - [ ] Migration syntax error → Log + Rollback
  - [ ] License validation failure → 400 Bad Request (pre-migration)
  - [ ] Schema incompatibility → 426 Upgrade Required (runtime)
  - [ ] Snapshot failure → 500 (pre-migration)

- [ ] Tests
  - [ ] Unit: Version comparison, SemVer parsing
  - [ ] Integration: End-to-end upgrade flow
  - [ ] Integration: License validation blocks upgrade
  - [ ] Integration: Incompatible schema blocks request (426)
  - [ ] Integration: Failed migration rolls back
  - [ ] Integration: Idempotency (retry same migration = no-op)

---

## Example Migration File

**File:** `apps/api/src/db/tenant/migrations/002_license_engine.sql`

```sql
-- Migration: 1.1.0
-- Required Minimum Product Version: 1.0.0
-- Breaking: false
-- Description: Add license and subscription tracking tables

-- Licenses table
CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id),
  status VARCHAR(50) NOT NULL CHECK (status IN ('ACTIVE', 'SOFT_LOCKED', 'ARCHIVED')),
  product_version VARCHAR(20) NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- License events (immutable audit log)
CREATE TABLE IF NOT EXISTS license_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES licenses(id),
  event_type VARCHAR(50) NOT NULL,
  previous_state JSON,
  new_state JSON,
  operator_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_licenses_workspace ON licenses(workspace_id);
CREATE INDEX IF NOT EXISTS idx_license_events_license ON license_events(license_id, created_at DESC);
```

**Key patterns:**

- Uses `CREATE TABLE IF NOT EXISTS` (idempotent)
- Uses `CREATE INDEX IF NOT EXISTS` (idempotent)
- Includes header metadata
- Includes comment describing purpose

---

## Version Compatibility Example

**Scenario:** Platform releases v2.0.0 with breaking changes

```
1. Release deployment:
   ├─ New master migration: 003_breaking_schema_change.sql (target: 2.0.0)
   ├─ Platform runs master migration → platform_settings.current_schema_version = "2.0.0"
   ├─ Platform sets minimum_supported = "2.0.0"
   └─ Old tenant code still works locally

2. Workspace still at v1.0.0 requests /api/exam/list:
   ├─ Resolver check: 1.0.0 ≥ 2.0.0? → NO
   ├─ Response: 426 Upgrade Required
   └─ Tenant admin sees message to upgrade

3. Workspace admin visits upgrade page:
   ├─ Views available upgrade: 1.0.0 → 2.0.0
   ├─ Clicks "Upgrade"
   └─ Worker executes migration asynchronously

4. After upgrade completes:
   ├─ tenant_db.schema_version = "2.0.0"
   ├─ master_db.tenants_registry.schema_version = "2.0.0"
   └─ Same /api/exam/list request now succeeds
```

---

## Debugging Failed Upgrade

**Problem:** Workspace upgrade failed, now stuck on v1.5.0

**Steps:**

1. **Check migration_registry:**

   ```sql
   SELECT * FROM migration_registry
   WHERE workspace_id = 'acme-123'
   ORDER BY applied_at DESC LIMIT 5;
   ```

2. **Find failed migration:**

   ```sql
   SELECT * FROM migration_registry
   WHERE workspace_id = 'acme-123' AND status = 'FAILED';
   ```

3. **Check error message:**

   ```
   error_message: "Column 'exam_id' referenced in foreign key does not exist"
   ```

4. **Review migration file:**

   ```
   cat apps/api/src/db/tenant/migrations/004_attempt_foreign_keys.sql
   ```

5. **Fix and retry:**
   - Operator fixes migration file (new version: 005)
   - Or operator fixes prerequisite (ensure exam_id column created first)
   - Operator triggers upgrade again

6. **Check snapshot:**

   ```sql
   SELECT * FROM upgrade_snapshots
   WHERE workspace_id = 'acme-123'
   ORDER BY created_at DESC LIMIT 1;
   ```

7. **Manual rollback (if needed):**
   - Restore from snapshot
   - Reset tenant_db.schema_version to previous version
   - Reset master_db.tenants_registry.schema_version
   - Log CRITICAL rollback event

---

## Key Endpoints (Backoffice API)

**List available upgrades:**

```
GET /api/mmc/workspace/{workspace_id}/available-upgrades

Response:
{
  "current_schema_version": "1.5.0",
  "available_upgrades": [
    {
      "target_version": "1.6.0",
      "migration_count": 1,
      "estimated_downtime_ms": 250,
      "breaking": false
    }
  ]
}
```

**Trigger upgrade:**

```
POST /api/mmc/workspace/{workspace_id}/upgrade

Body:
{
  "target_schema_version": "1.6.0"
}

Response (async):
{
  "success": true,
  "data": {
    "upgrade_job_id": "job-uuid",
    "status": "QUEUED",
    "polling_url": "/api/mmc/upgrade-job/{job_id}"
  }
}
```

**Check upgrade status:**

```
GET /api/mmc/upgrade-job/{job_id}

Response:
{
  "success": true,
  "data": {
    "status": "SUCCESS",
    "workspace_schema_version": "1.6.0",
    "completed_at": "2026-02-16T10:30:45Z"
  }
}
```

---

## Observability Queries

**All migrations for workspace:**

```sql
SELECT migration_file, target_schema_version, status, execution_time_ms, error_message
FROM migration_registry
WHERE workspace_id = 'xyz'
ORDER BY applied_at DESC;
```

**Failed migrations (all workspaces):**

```sql
SELECT workspace_id, migration_file, error_message, applied_at
FROM migration_registry
WHERE status = 'FAILED'
ORDER BY applied_at DESC
LIMIT 50;
```

**Workspaces on old schema:**

```sql
SELECT workspace_id, schema_version
FROM tenants_registry
WHERE schema_version < (SELECT current_schema_version FROM platform_settings LIMIT 1)
ORDER BY schema_version ASC;
```

**Upgrade snapshots (retention audit):**

```sql
SELECT id, workspace_id, created_at, expires_at, snapshot_size_bytes
FROM upgrade_snapshots
WHERE expires_at < now()
ORDER BY expires_at ASC;
```

---

## Common Gotchas

| Gotcha                                     | How to Avoid                                                          |
| ------------------------------------------ | --------------------------------------------------------------------- |
| Migration files edited after deploy        | Treat migration files as immutable once committed                     |
| Version skips (001, 002, 004)              | Script validates no gaps; refuse execution if gap                     |
| Checksum mismatch (file corrupted)         | Always validate checksum before execution                             |
| Partial migration (OS crash mid-migration) | Use single transaction; crash during transaction = automatic rollback |
| Multiple concurrent upgrades               | Write lock ensures serialization; second request waits or fails       |
| Tenant schema divergence                   | All migrations apply to all tenants in order; no per-tenant branches  |
| Rollback attempted via migration           | Forbidden; rollback only via snapshot restoration                     |

---

## Resources

- **Data Model:** `specs/runtime/002C-migration-and-versioning-model/data-model.md`
- **Full Spec:** `specs/runtime/002C-migration-and-versioning-model/spec.md`
- **Governing ADR:** `docs/architecture/ADR-0008-formalize-semantic-versioning-policy.md`
- **Constitution:** `AGENTS.md` (section: Migration Discipline)

---

END QUICKSTART
