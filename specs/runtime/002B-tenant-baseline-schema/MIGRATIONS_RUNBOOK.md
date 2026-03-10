# Migration Runbook

**Version**: 1.0.0  
**Stage**: STAGE_02B_TENANT_BASELINE_SCHEMA  
**Date**: 2026-02-16

## Table of Contents

1. [Creating a New Migration](#creating-a-new-migration)
2. [Version Bumping Rules](#version-bumping-rules)
3. [Testing Migrations Locally](#testing-migrations-locally)
4. [Applying Migrations](#applying-migrations)
5. [Rollback Procedures](#rollback-procedures)
6. [Troubleshooting](#troubleshooting)

---

## Creating a New Migration

### Migration File Structure

All migrations follow this pattern:

```
apps/api/src/db/tenant/migrations/
├── v1.0.0/
│   ├── baseline-schema.sql
│   └── triggers.sql
├── v1.1.0/
│   └── migration.sql
├── v1.2.0/
│   └── migration.sql
└── v2.0.0/
    └── migration.sql
```

### Step 1: Determine Version Number

**Current Version**: Check `schema_version` table

```sql
SELECT version FROM schema_version LIMIT 1;
```

Example output: `1.0.0`

**Next Version**: Apply semantic versioning rules (see below)

### Step 2: Create Migration SQL

**Example: Adding a new column (PATCH version)**

Current: 1.0.0 → Next: 1.0.1

```sql
-- File: apps/api/src/db/tenant/migrations/v1.0.1/migration.sql

BEGIN TRANSACTION;

-- Add new column with default value
ALTER TABLE users ADD COLUMN middle_name VARCHAR(255);

-- Update schema_version (CRITICAL: Must use exact new version)
UPDATE schema_version
SET version = '1.0.1', applied_at = NOW()
WHERE version = '1.0.0';

COMMIT;
```

**Example: Adding new table (MINOR version)**

Current: 1.0.0 → Next: 1.1.0

```sql
-- File: apps/api/src/db/tenant/migrations/v1.1.0/migration.sql

BEGIN TRANSACTION;

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(100),
  record_id UUID,
  action VARCHAR(20),
  change_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);

-- Update schema_version
UPDATE schema_version
SET version = '1.1.0', applied_at = NOW()
WHERE version = '1.0.0';

COMMIT;
```

**Critical Rules**:

- ✅ Wrap all DDL in BEGIN/COMMIT (atomic)
- ✅ Always include schema_version UPDATE
- ✅ Use exact version string in UPDATE
- ✅ Use NOW() for timestamps (server-authoritative)
- ✅ Add indexes for new tables/columns
- ✅ Document FK constraints
- ❌ Never modify existing migrations
- ❌ Never DELETE from schema_version
- ❌ Never use client timestamps

### Step 3: Calculate Checksum

```bash
# Calculate SHA256 hash of migration file
shasum -a 256 apps/api/src/db/tenant/migrations/v1.0.1/migration.sql

# Output example:
# abc123def456...  migration.sql
```

Record this checksum - it will be passed to worker task.

### Step 4: Enqueue Migration Task

Use the API to trigger migration:

```bash
curl -X POST http://api.local:3000/api/workspaces/{workspace_id}/schema/migrate \
  -H "Content-Type: application/json" \
  -d '{
    "from_version": "1.0.0",
    "to_version": "1.0.1",
    "checksum": "abc123def456..."
  }'
```

Response (202 Accepted):

```json
{
  "success": true,
  "data": {
    "task_id": "migration-task-123",
    "status": "QUEUED",
    "from_version": "1.0.0",
    "to_version": "1.0.1"
  }
}
```

---

## Version Bumping Rules

### Semantic Versioning (ADR-0008)

Format: `MAJOR.MINOR.PATCH`

#### PATCH Version (1.0.0 → 1.0.1)

**When**: Backward-compatible bug fixes, data corrections **Changes**:

- Add index on existing column
- Add NOT NULL column with default
- Length increase on VARCHAR
- Data cleanup (DELETE orphaned records)

**Rollback**: Can restore from snapshot only

```
1.0.0 → 1.0.1 → 1.0.2  // All patches apply linearly
```

#### MINOR Version (1.0.0 → 1.1.0)

**When**: Backward-compatible new features **Changes**:

- Add new column with default
- Add new table
- Add non-enforced constraint
- Change CHECK constraint to broader rules

**Compatibility**: Old code continues working

```
1.0.0 → 1.1.0 → 1.1.1 → 1.2.0  // Linear progression
```

#### MAJOR Version (1.0.0 → 2.0.0)

**When**: Breaking changes to schema **Changes**:

- Remove column
- Drop table
- Rename column
- Enforce new constraint
- Change column data type

**Compatibility**: Old code breaks (requires code update) **Deployment Order**:

1. Deploy code changes first
2. Then apply migration
3. Never apply migration without code ready

```
1.0.0 → 2.0.0 (code + schema must deploy together)
```

### Decision Tree

```
Is change backward compatible?
├─ YES: Existing code still works
│   ├─ Data change only (add default, add index)?
│   │   └─ PATCH (1.0.0 → 1.0.1)
│   └─ New capability (add table, add column)?
│       └─ MINOR (1.0.0 → 1.1.0)
└─ NO: Existing code breaks
    └─ MAJOR (1.0.0 → 2.0.0)
```

---

## Testing Migrations Locally

### Prerequisites

```bash
# Ensure PostgreSQL running
psql -U postgres

# Create test database
CREATE DATABASE zidney_test_tenant;
```

### Test Flow

```bash
# 1. Run baseline schema
psql -U postgres -d zidney_test_tenant -f \
  apps/api/src/db/tenant/migrations/v1.0.0/baseline-schema.sql

# 2. Run triggers
psql -U postgres -d zidney_test_tenant -f \
  apps/api/src/db/tenant/migrations/v1.0.0/triggers.sql

#  3. Verify initial state
psql -U postgres -d zidney_test_tenant \
  -c "SELECT version, checksum FROM schema_version;"

# Expected output:
#  version | checksum
# ---------+----------
#  1.0.0   | <hash>

# 4. Run migration
psql -U postgres -d zidney_test_tenant -f \
  apps/api/src/db/tenant/migrations/v1.0.1/migration.sql

# 5. Verify post-migration
psql -U postgres -d zidney_test_tenant \
  -c "SELECT version, checksum FROM schema_version;"

# Expected output:
#  version | checksum
# ---------+----------
#  1.0.1   | <new_hash>

# 6. Run test suite
npm test -- tests/migrations.test.ts
```

### Validation Checklist

```
□ schema_version updated correctly
□ schema_version.checksum verified
□ New tables exist (verify with \dt)
□ New columns exist (verify with \d table_name)
□ Indexes created (verify with \di)
□ No orphaned records
□ All FKs still valid
□ Triggers still active
□ Test suite passes
```

---

## Applying Migrations

### Pre-Migration Checks

```bash
# 1. Verify current schema version
SELECT version, applied_at FROM schema_version;

# 2. Check tenant database size
SELECT pg_size_pretty(pg_database_size('database_name'));

# 3. Verify no long-running queries
SELECT nid, usename, query, query_start FROM pg_stat_activity
WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';

# 4. Set lock timeout (prevent hanging)
SET LOCAL lock_timeout = '5s';

# 5. Set statement timeout (prevent stuck migrations)
SET LOCAL statement_timeout = '30000ms';
```

### Migration Execution

**Via API** (Recommended):

```bash
curl -X POST http://api.local:3000/api/workspaces/{id}/schema/migrate \
  -H "Authorization: Bearer {token}" \
  -d '{
    "from_version": "1.0.0",
    "to_version": "1.0.1",
    "checksum": "abc..."
  }'
```

**Worker Task**: Enqueued automatically, executes in order, retries 3x on transient failures.

### Post-Migration Verification

```bash
# 1. Check schema_version updated
SELECT * FROM schema_version;

# 2. Verify schema integrity
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';

# 3. Check all tables accessible
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

# 4. Verify indexes
SELECT relname FROM pg_stat_user_indexes WHERE schemaname = 'public';

# 5. Run integration tests
npm test -- tests/migration-validation.test.ts
```

---

## Rollback Procedures

### Automated Rollback (On Failure)

Migration automatically rolls back if:

- Lock timeout exceeded (> 5s)
- Statement timeout exceeded (> 30s)
- SQL syntax error
- FK violation
- Checksum mismatch

**Result**: Returns to previous version, no manual intervention needed

### Manual Rollback (Last Resort)

⚠️ **WARNING**: Only use if migration corrupted data

**Option A: Snapshot Restore**

```bash
# 1. Stop all API instances
# 2. Restore database from pre-migration snapshot
# 3. Verify data integrity
# 4. Restart API instances

# Example (AWS RDS):
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier zidney-tenant-123 \
  --db-snapshot-identifier zidney-tenant-123-20260216-1000

# 5. Verify
psql -U postgres -d zidney_tenant_123 \
  -c "SELECT version FROM schema_version;"
```

**Option B: Reverse Migration (If Available)**

For simple additions:

```sql
-- Reverse migration: v1.0.1 → v1.0.0
BEGIN TRANSACTION;

-- Remove added column
ALTER TABLE users DROP COLUMN middle_name;

-- Revert schema_version
UPDATE schema_version
SET version = '1.0.0', applied_at = NOW()
WHERE version = '1.0.1';

COMMIT;
```

**Option C: Data Correction (If Possible)**

For data corruption without structural changes:

```sql
-- Manual data cleanup
UPDATE users SET email = TRIM(email) WHERE email LIKE ' %';
-- Verify corrections
SELECT COUNT(*) FROM users WHERE email LIKE ' %';
```

---

## Troubleshooting

### Issue: "Lock Timeout Exceeded"

**Cause**: Schema migration waiting for lock (table being modified)

**Solution**:

```bash
# 1. Check blocking queries
SELECT pid, usename, query FROM pg_stat_activity
WHERE state = 'active';

# 2. Terminate if safe
SELECT pg_terminate_backend(pid);

# 3. Retry migration
curl -X POST http://api.local:3000/api/workspaces/{id}/schema/migrate ...
```

### Issue: "Checksum Mismatch"

**Cause**: Migration file was modified after checksum calculated

**Solution**:

```bash
# 1. Recalculate checksum
shasum -a 256 apps/api/src/db/tenant/migrations/v1.0.1/migration.sql

# 2. Resubmit with correct checksum
curl -X POST ... -d '{"checksum": "correct_hash"}'

# 3. Never modify migration files after creation
```

### Issue: "Unique Constraint Violation"

**Cause**: New UNIQUE constraint conflicts with existing data

**Solution**:

```sql
-- 1. Identify duplicates
SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;

-- 2. Clean up duplicates (keep one)
DELETE FROM users WHERE id NOT IN (
  SELECT MIN(id) FROM users GROUP BY email
);

-- 3. Re-run migration
```

### Issue: "Foreign Key Violation"

**Cause**: New FK constraint conflicts with orphaned records

**Solution**:

```sql
-- 1. Find orphans
SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM attempts);

-- 2. Remove orphans or add parent records
DELETE FROM users WHERE id NOT IN (SELECT user_id FROM attempts);

-- 3. Re-run migration
```

---

## Reference

- **Schema Design**: See [SCHEMA_BASELINE.md](./SCHEMA_BASELINE.md)
- **Operations Guide**: See [OPERATIONS.md](./OPERATIONS.md)
- **Backup/Recovery**: See [BACKUP_RECOVERY.md](./BACKUP_RECOVERY.md)
- **Monitoring**: See [MONITORING.md](./MONITORING.md)
- **ADR-0008**: Semantic Versioning Policy
