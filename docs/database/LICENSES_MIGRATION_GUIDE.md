# Database Migration Guide - Licenses Management

## Overview

This guide documents the database schema changes introduced by STAGE_10_LICENSES (Licenses Management).

**Total Migrations:** 6 forward-only migrations  
**Estimated Runtime:** 2-5 seconds (no downtime required)  
**Rollback:** Not available (snapshot restore only)

---

## Migration Summary

| Order | Migration File                                               | Change                   | Impact                                      | Duration |
| ----- | ------------------------------------------------------------ | ------------------------ | ------------------------------------------- | -------- |
| 1     | `20260217_004_enhance_licenses_and_add_archive_snapshots.ts` | Create licenses table    | 🟡 Medium: New table, no impact on existing | 1s       |
| 2     | `20260218_003_create_audit_log.sql`                          | Create audit_log table   | 🟢 Low: New table                           | 0.5s     |
| 3     | `2026-02-18-001-add-provisioning-fields-to-licenses.sql`     | Add provisioning columns | 🟡 Medium: ALTER TABLE (fast on new table)  | 0.5s     |
| 4     | `...add_status_enum_values.ts`                               | Extend status enum       | 🟠 High: Enum mutation (blocking)           | 1s       |
| 5     | `...add_updated_at_trigger.ts`                               | Add timestamp function   | 🟢 Low: Trigger only                        | 0.5s     |
| 6     | `...update_tenants_registry_for_licenses.ts`                 | Foreign key add          | 🟡 Medium: ALTER TABLE                      | 1s       |

---

## Pre-Migration Checklist

- [ ] Database backup executed: `pg_dump zidney_master > backup.sql`
- [ ] Redis backup: `redis-cli BGSAVE`
- [ ] No active provisioning jobs: `redis-cli LLEN bull:provisioning:license` returns 0
- [ ] API service briefly stopped to prevent concurrent operations
- [ ] Team notified of maintenance window (< 10 seconds expected)
- [ ] Rollback plan confirmed (database restore understood)

---

## Migration 1: Create Licenses Table

**File:** `apps/api/src/db/master/migrations/20260217_004_enhance_licenses_and_add_archive_snapshots.ts`

**SQL:**

```sql
-- Create status enum
CREATE TYPE license_status AS ENUM (
  'PENDING_PROVISION',
  'ACTIVE',
  'SOFT_LOCKED',
  'ARCHIVED',
  'DELETED'
);

-- Create licenses table
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  workspace_id UUID NOT NULL,
  workspace_slug VARCHAR(64) NOT NULL UNIQUE,
  student_limit INTEGER,
  staff_limit INTEGER,
  status license_status NOT NULL DEFAULT 'PENDING_PROVISION',
  soft_lock_until TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  expected_schema_version VARCHAR(20) NOT NULL,
  expected_product_version VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_created_at ON licenses(created_at DESC);
CREATE INDEX idx_licenses_product_id ON licenses(product_id);
CREATE INDEX idx_licenses_workspace_id ON licenses(workspace_id);

-- Create archive_snapshots table
CREATE TABLE archive_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL UNIQUE REFERENCES licenses(id) ON DELETE CASCADE,
  snapshot_location VARCHAR(255) NOT NULL,
  snapshot_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

**Impact:**

- New table, no conflicts
- Indexes created for query performance

---

## Migration 2: Create Audit Log Table

**File:** `apps/api/src/db/master/migrations/20260218_003_create_audit_log.ts`

**SQL:**

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  old_status license_status,
  new_status license_status,
  reason TEXT,
  correlation_id VARCHAR(36),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_license_id ON audit_log(license_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
```

**Impact:**

- New table for compliance & debugging
- Minimal performance impact

---

## Migration 3: Add Provisioning Fields

**File:** `apps/api/src/db/master/migrations/002_add_provisioning_fields.ts`

**SQL:**

```sql
ALTER TABLE licenses
ADD COLUMN provisioning_error TEXT,
ADD COLUMN provisioning_retries INTEGER DEFAULT 0,
ADD COLUMN provisioning_last_attempt_at TIMESTAMP WITH TIME ZONE;
```

**Impact:**

- Fast on empty/new table
- If table is large (existing licenses), consider concurrent index creation

---

## Migration 4: Extend Status Enum

**File:** `apps/api/src/db/master/migrations/003_add_status_enum_values.ts`

**SQL:**

```sql
-- Note: Cannot directly add to enum in PostgreSQL
-- Must create new enum and reassign

ALTER TYPE license_status ADD VALUE 'PROVISION_FAILED' BEFORE 'DELETED';
```

**Impact:**

- ⚠️ Blocking operation if any query uses this type
- Only runs if value doesn't exist (safe to re-run)

---

## Migration 5: Add Timestamp Trigger

**File:** `apps/api/src/db/master/migrations/004_add_updated_at_trigger.ts`

**SQL:**

```sql
CREATE OR REPLACE FUNCTION update_licenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_licenses_updated_at
BEFORE UPDATE ON licenses
FOR EACH ROW
EXECUTE FUNCTION update_licenses_updated_at();
```

**Impact:**

- Functions/triggers don't lock tables
- Safe to execute anytime

---

## Migration 6: Foreign Key for Tenants Registry

**File:** `apps/api/src/db/master/migrations/006_update_tenants_registry_for_licenses.ts`

**SQL:**

```sql
-- Add license_id column if not exists
ALTER TABLE tenants_registry
ADD COLUMN IF NOT EXISTS license_id UUID UNIQUE REFERENCES licenses(id) ON DELETE RESTRICT;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_tenants_registry_license_id ON tenants_registry(license_id);
```

**Impact:**

- Links license record to provisioned tenant
- Can add to existing table (safe ALTER)

---

## Migration Execution

### Via Bun Command (Recommended)

```bash
# Check migration status
bun run migrate:status
# Output: Listing pending migrations...

# Run all pending migrations
bun run migrate:up
# Output: Applied migration 20260217_004...
#         Applied migration 20260218_003...
#         ... (all 6)
#         Total time: 3.2 seconds

# Verify
bun run migrate:status
# Output: All migrations applied. Schema version: 1.0.0
```

### Manual Execution (If Needed)

```bash
# Connect to database
psql -h $DB_HOST -U postgres -d zidney_master

# Run each SQL file in order
\i apps/api/src/db/master/migrations/20260217_004_enhance_licenses_and_add_archive_snapshots.sql
\i apps/api/src/db/master/migrations/20260218_003_create_audit_log.sql
\i apps/api/src/db/master/migrations/002_add_provisioning_fields.sql
# ... etc
```

---

## Post-Migration Verification

### 1. Table Structure Verification

```sql
-- Verify all tables exist
\dt licenses audit_log archive_snapshots

-- Verify columns
\d licenses
-- Should show all 21 fields with correct types

-- Verify indexes
SELECT * FROM pg_indexes WHERE tablename='licenses';
```

### 2. Data Integrity Check

```sql
-- Should return 0 (empty on first run)
SELECT COUNT(*) FROM licenses;

-- Verify enum values
SELECT enum_range(NULL::license_status);
-- Should return: (PENDING_PROVISION,ACTIVE,SOFT_LOCKED,ARCHIVED,DELETED,PROVISION_FAILED)

-- Verify constraints
\d licenses
-- Should show UNIQUE on workspace_slug
-- Should show FOREIGN KEY on product_id
```

### 3. Performance Baseline

```sql
-- Test query performance
EXPLAIN ANALYZE SELECT * FROM licenses WHERE status = 'ACTIVE';
-- Should use idx_licenses_status index

EXPLAIN ANALYZE SELECT * FROM licenses WHERE created_at > NOW() - INTERVAL '1 day';
-- Should use idx_licenses_created_at index
```

---

## Rollback Procedure

⚠️ **Cannot rollback migrations directly. Restore from backup:**

```bash
# 1. Stop all services
docker stop zidney-api zidney-worker

# 2. Restore database
psql -h $DB_HOST -U postgres -d zidney_master < backup.sql

# 3. Verify restoration
psql -c "SELECT COUNT(*) FROM licenses;"
# Should return 0 (or pre-migration count)

# 4. Restart services with previous version
git checkout <PREVIOUS_TAG>
docker build -t zidney-api:previous .
docker run zidney-api:previous
```

---

## Schema Version Tracking

Migrations are tracked in `schema_versions` table:

```sql
SELECT * FROM schema_versions;
-- Output:
-- name           | version | applied_at
-- licenses       | 1.0.0   | 2026-02-22 10:00:00
-- audit_log      | 1.0.0   | 2026-02-22 10:00:01
```

---

## FAQ

**Q: Can I run migrations in parallel?**  
A: No. Migrations are run sequentially (one-at-a-time) to ensure data consistency.

**Q: What if a migration fails halfway?**  
A: Transaction fails atomically; either all-or-nothing. Rollback by restoring database.

**Q: Do I need downtime?**  
A: No. Licenses table is new (no impact on existing data). Total runtime ~5 seconds.

**Q: Can I add my own migrations?**  
A: Yes. Create `apps/api/src/db/master/migrations/NNN_description.ts` following the pattern.

**Q: How do I test migrations locally?**  
A: Use Docker PostgreSQL: `docker run postgres:15 -e POSTGRES_DB=zidney_master`

---

## Monitoring Post-Migration

```bash
# Watch for slow queries
psql << EOF
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%licenses%'
ORDER BY mean_exec_time DESC;
EOF

# Monitor table growth
SELECT
  schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('licenses', 'audit_log', 'archive_snapshots')
ORDER BY size DESC;
```

---

**Migration Owner:** Platform Team  
**Last Updated:** 2026-02-22  
**Status:** ✅ Ready for Production
