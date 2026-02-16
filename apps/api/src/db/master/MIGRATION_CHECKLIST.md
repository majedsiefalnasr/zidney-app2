/\*\*

- Master Database Implementation Checklist
-
- File: apps/api/src/db/master/MIGRATION_CHECKLIST.md
- Task: T037
- Phase: 6 - Polish and Deployment Readiness
-
- Pre-deployment verification, deployment steps, and rollback plan
  \*/

# Master Database Implementation Checklist

Last Updated: 2025-02-16

## Pre-Deployment Checklist

### Database Setup

- [ ] Master PostgreSQL instance running (version 14+)
- [ ] Database `zidney_master` created and accessible
- [ ] Superuser credentials available for initial setup
- [ ] Network connectivity verified (DB accessible from API servers)
- [ ] Backup strategy configured (automated snapshots)

### Source Code Validation

- [ ] All migration files committed to repository
- [ ] TypeScript strict mode validation passes
- [ ] ESLint passes on all migration code
- [ ] Type definitions exported from @zidney/types
- [ ] All imports resolved (no missing dependencies)

### Environment Configuration

- [ ] Master DB connection string configured in `.env`
- [ ] Connection pool settings tuned for expected load
- [ ] Logging configured for structured JSON output
- [ ] Error monitoring/alerting configured

### Backup & Recovery

- [ ] Full database backup created (pre-deployment snapshot)
- [ ] Backup verified restorable
- [ ] Restore procedure documented
- [ ] Backup retention policy documented

## Deployment Steps

### Step 1: Pre-Deployment Validation (T1)

**Estimated time: 10 minutes**

```bash
# Check database connectivity
psql -h $DB_HOST -U $DB_USER -d zidney_master -c "SELECT version();"

# Verify migration files present
ls -la apps/api/src/db/master/migrations/

# Run TypeScript check
npm run type-check

# Run ESLint
npm run lint -- apps/api/src/db/master/
```

**Success criteria**: All commands complete without errors

---

### Step 2: Create Master Database (T2)

**Estimated time: 5 minutes**

```bash
# Create database (if not exists)
createdb -h $DB_HOST -U postgres zidney_master

# Verify created
psql -h $DB_HOST -U postgres -d zidney_master -c "\l | grep zidney_master"
```

**Success criteria**: Database listed in `\l`

---

### Step 3: Run Migrations (T3)

**Estimated time: 2 minutes**

```bash
# Start API server with migration runner
npm run start:api

# Server will:
# 1. Create _schema_migrations tracking table
# 2. Discover migration files in migrations/
# 3. Execute pending migrations in order
# 4. Log completion
```

**Success criteria**: Logs show "All migrations applied successfully"

---

### Step 4: Verify Schema Created (T4)

**Estimated time: 5 minutes**

```bash
# Connect to master database
psql -h $DB_HOST -U $DB_USER -d zidney_master

# Verify all tables exist
\dt

# Expected tables:
# - _schema_migrations
# - products
# - licenses
# - tenants_registry
# - mmc_users
# - platform_schema_version
```

**Success criteria**: All 6 tables visible

---

### Step 5: Verify Constraints & Indexes (T5)

**Estimated time: 5 minutes**

```sql
-- Check product table constraints
\d products

-- Verify unique index on slug
SELECT * FROM pg_indexes WHERE tablename = 'products' AND indexname LIKE '%slug%';

-- Check licenses constraints
\d licenses

-- Verify foreign key to products
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'licenses' AND constraint_type = 'FOREIGN KEY';
```

**Success criteria**: All constraints and indexes present

---

### Step 6: Verify Initial Data (T6)

**Estimated time: 2 minutes**

```sql
-- Check platform schema version initialized
SELECT * FROM platform_schema_version;

-- Expected: id=1, current_version='1.0.0', minimum_supported_version='1.0.0'

-- Check migration tracking
SELECT * FROM _schema_migrations;

-- Expected: One record for version '20250102001'
```

**Success criteria**: Initial data present and correct

---

### Step 7: Run Deployment Tests (T7)

**Estimated time: 10 minutes**

```bash
# Run integration tests
npm run test:db:master

# Tests should cover:
# - Schema constraints
# - Migration idempotency
# - Data integrity
# - Isolation properties
```

**Success criteria**: Tests pass

---

### Step 8: Monitor and Validate (T8)

**Estimated time: Ongoing**

```bash
# Monitor logs
tail -f logs/master-db-migration.log

# Check for any errors or warnings
grep -i "error\|warning" logs/master-db-migration.log
```

**Success criteria**: No ERROR level logs

---

## Post-Deployment Validation

### Database Accessibility

- [ ] API server can connect to master database
- [ ] Connection pool initialized
- [ ] Query execution succeeds

### Data Integrity

- [ ] All constraints validated
- [ ] All indexes created
- [ ] Foreign key relationships working

### Monitoring

- [ ] Structured logs flowing to log aggregation
- [ ] Error alerting configured and tested
- [ ] Performance metrics captured

---

## Rollback Procedure

**If deployment fails:**

### Option 1: Restore from Snapshot (Recommended)

**Time: 5-15 minutes depending on DB size**

```bash
# Stop API server
npm run stop:api

# Create pre-restore backup (in case we need to debug)
pg_dump $DB_CONNECTION > zidney_master_failed.sql

# Restore from snapshot
# (depends on your backup solution - AWS RDS, Kubernetes, etc.)
# Example for file-based backup:
psql -h $DB_HOST -U postgres -d zidney_master < zidney_master_backup_$(date +%Y%m%d).sql

# Verify restore
psql -h $DB_HOST -U postgres -d zidney_master -c "SELECT count(*) FROM _schema_migrations;"

# Restart API server
npm run start:api
```

### Option 2: Manual Rollback (If Snapshot Restore Failed)

**Time: 30-60 minutes**

```bash
# Delete tables (in reverse order of creation)
psql -h $DB_HOST -U $DB_USER -d zidney_master << EOF
DROP TABLE IF EXISTS _schema_migrations CASCADE;
DROP TABLE IF EXISTS tenants_registry CASCADE;
DROP TABLE IF EXISTS mmc_users CASCADE;
DROP TABLE IF EXISTS licenses CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS platform_schema_version CASCADE;
EOF

# Verify all tables deleted
psql -h $DB_HOST -U $DB_USER -d zidney_master -c "\dt"

# Expected: No tables listed (empty output)

# Restart API server (will re-run migrations from scratch)
npm run start:api
```

---

## Troubleshooting

### Migration Fails with "Cannot DROP table"

**Cause**: Foreign key constraints preventing table deletion

**Solution**:

```sql
-- Drop tables in correct order (FK dependencies)
DROP TABLE tenants_registry CASCADE;  -- Has FK to licenses
DROP TABLE licenses CASCADE;           -- Has FK to products
DROP TABLE products CASCADE;
DROP TABLE mmc_users CASCADE;
DROP TABLE platform_schema_version CASCADE;
```

### Migration Hangs

**Cause**: Database lock or connection timeout

**Solution**:

```bash
# Check active connections
psql -U postgres -d zidney_master -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Kill blocking connection (if safe)
psql -U postgres -d zidney_master -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND datname = 'zidney_master';"

# Try migration again
npm run start:api
```

### "Unique violation" on \_schema_migrations

**Cause**: Migration already applied but incomplete logging

**Solution**:

```sql
-- Check if migration recorded
SELECT * FROM _schema_migrations WHERE version = '20250102001';

-- If present but incomplete:
DELETE FROM _schema_migrations WHERE version = '20250102001';

-- Re-run migration
npm run start:api
```

---

## Performance Considerations

- Index creation is automatic during migration (single transaction)
- Additional tables/indexes can be added in future migrations
- For large databases, migrate during low-activity windows

---

## Support

For issues:

1. Check logs in `logs/master-db-migration.log`
2. Verify database connectivity: `psql -h $DB_HOST -U $DB_USER -d zidney_master -c "\dt"`
3. Review migration file: `apps/api/src/db/master/migrations/20250102_001_create_master_schema.ts`
4. Check that all dependencies are installed: `npm install`
