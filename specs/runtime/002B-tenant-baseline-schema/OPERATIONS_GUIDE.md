# Operational Guide

**Version**: 1.0.0  
**Stage**: STAGE_02B_TENANT_BASELINE_SCHEMA  
**Date**: 2026-02-16

## Table of Contents

1. [Connecting to Tenant Database](#connecting-to-tenant-database)
2. [Querying Schema Version](#querying-schema-version)
3. [Investigating DLQ Events](#investigating-dlq-events)
4. [Workspace Reset](#workspace-reset)
5. [Performance Tuning](#performance-tuning)
6. [Alerting & Escalation](#alerting--escalation)

---

## Connecting to Tenant Database

### Prerequisites

```bash
# Install PostgreSQL client
brew install postgresql  # macOS
apt-get install postgresql-client  # Ubuntu

# Verify client version
psql --version
```

### Connection String

```bash
psql postgresql://username:password@host:5432/database_name
```

### Example: Connect to Production Tenant

```bash
# Get tenant database name from MMC master
SELECT database_name FROM tenants_registry WHERE workspace_slug = 'acme-university';

# Connect
psql postgresql://postgres:${DB_PASSWORD}@prod-db.internal:5432/zidney_acme_university

# Verify connection
\dt  # List tables
SELECT version FROM schema_version;  # Check schema version
```

### Safe Query Patterns

⚠️ **READ-ONLY QUERIES ONLY** (no INSERT/UPDATE/DELETE without ticket)

#### Query Attempt History

```sql
-- Find all attempts for a user
SELECT  id, exam_id, status, started_at, submitted_at
FROM attempts
WHERE user_id = '${user_uuid}'
ORDER BY started_at DESC
LIMIT 10;
```

#### Query Attempt Events (Audit Trail)

```sql
-- Get event timeline for specific attempt
SELECT event_type, occurred_at, event_payload
FROM attempt_events
WHERE attempt_id = '${attempt_uuid}'
ORDER BY occurred_at ASC;

-- Example output:
--  event_type | occurred_at | event_payload
-- -----------------+-----+----------
--  START | 2026-02-16 09:00:00 | {"ip": "..."}
--  ANSWER_SUBMIT | 2026-02-16 09:15:00 | {"questionId": "q1", "answer": "A"}
--  SUBMIT_REQUEST | 2026-02-16 09:50:00 | {"grace_period": false}
```

#### Count Users in Role

```sql
SELECT r.code as role, COUNT(ra.id) as count
FROM roles r
LEFT JOIN role_assignments ra ON r.id = ra.role_id AND ra.is_active
GROUP BY r.code
ORDER BY count DESC;
```

#### Find Soft-Deleted Records

```sql
-- Recently deleted users
SELECT email, updated_at FROM users
WHERE is_deleted = true
ORDER BY updated_at DESC
LIMIT 10;
```

### Emergency Read-Only Session

```bash
# Connect with read-only role (safe for auditing)
psql postgresql://readonly:${RO_PASSWORD}@prod-db.internal:5432/zidney_acme_university

# Verify permissions
SHOW transaction_read_only;  # Should show "on"
```

---

## Querying Schema Version

### Current Schema State

```sql
-- Get current version
SELECT version, applied_at, checksum
FROM schema_version
LIMIT 1;

-- Expected output:
--  version | applied_at | checksum
-- ---------+-----+----------
--  1.0.0 | 2026-02-16 08:00:00+00 | abc123def456...
```

### Check for Version Mismatches

```sql
-- If version doesn't match license product_version_compatibility:
-- Check master DB for expected version
SELECT workspace_id, product_version_compatibility
FROM licenses WHERE workspace_id = '${workspace_uuid}';

-- Compare with tenant
SELECT version FROM schema_version ;

-- If mismatch, migration will auto-enqueue
```

### Verify Schema Integrity After Migration

```sql
-- 1. Check all critical tables exist
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('users', 'attempts', 'attempt_events', 'roles', 'divisions');

-- Expected: 5 (if < 5, investigate)

-- 2. Check all indexes exist
SELECT COUNT(*) FROM pg_stat_user_indexes;

-- 3. Check triggers active
SELECT COUNT(*) FROM pg_trigger
WHERE tgname IN ('prevent_schema_version_update', 'prevent_attempt_events_update');

-- Expected: 2
```

---

## Investigating DLQ Events

### What is DLQ?

**Dead Letter Queue**: Where failed tasks go after 3 retry attempts

**Causes**:

- Checksum mismatch (tampering detection)
- Lock timeout (suspicious activity)
- Max retries exceeded (transient errors)

### Query DLQ in Redis

```bash
# Connect to Redis
redis-cli -h ${REDIS_HOST} -p 6379

# List all DLQ items
KEYS "dlq:*"

# Get DLQ job details
GET dlq:migration-task-123

# Output example:
# {
#   "task_id": "migration-task-123",
#   "workspace_id": "ws-456",
#   "status": "FAILED",
#   "reason": "tampering_detected",
#   "attempts": 3,
#   "last_error": "Checksum mismatch: expected abc123, got xyz789",
#   "timestamp": "2026-02-16T10:00:00Z"
# }
```

### Escalation Path

#### Checksum Mismatch (CRITICAL - SECURITY)

```bash
# 1. Alert on-call security team immediately
# 2. Prevent any further migration attempts
HSET workspace:ws-456 migration_locked true

# 3. Investigate: Was migration file modified?
# Check audit logs / git history
git log --oneline apps/api/src/db/tenant/migrations/v1.0.1/

# 4. If compromised: restore from snapshot
# See BACKUP_RECOVERY.md

# 5. If legitimate: recalculate and resubmit
shasum -a 256 apps/api/src/db/tenant/migrations/v1.0.1/migration.sql
```

#### Lock Timeout (OPERATIONAL)

```bash
# 1. Check blocking queries
psql -c "SELECT pid, usename, query FROM pg_stat_activity WHERE state = 'active';"

# 2. If safe, terminate blocker
psql -c "SELECT pg_terminate_backend(${block_pid});"

# 3. Retry migration
curl -X POST http://api.local:3000/api/workspaces/{id}/schema/migrate ...
```

#### Max Retries (OPERATIONAL)

```bash
# 1. Review error logs
grep "migration_failed" /var/log/zidney/worker.log

# 2. Common causes:
#    - Transient DB unavailability
#    - Network timeout
#    - Server restarted mid-migration
#    - Concurrency issue

# 3. Verify database is healthy
psql -c "SELECT version FROM schema_version;"

# 4. If version unchanged, retry:
curl -X POST http://api.local:3000/api/workspaces/{id}/schema/migrate ...

# 5. If still fails, page on-call DBA
```

---

## Workspace Reset

⚠️ **DANGER**: This completely wipes a workspace schema. Use only as last resort.

### Before Reset

```bash
# 1. Take snapshot
pg_dump -h ${DB_HOST} -d ${TENANT_DB} > /backups/zidney_acme_before_reset.sql

# 2. Notify workspace admins
# "We're resetting your schema. Enrollment data will be lost."

# 3. Mark workspace as maintenance
UPDATE licenses SET status = 'MAINTENANCE' WHERE workspace_id = '${ws_id}';

# 4. Verify no active attempts
SELECT COUNT(*) FROM attempts
WHERE status IN ('STARTED', 'IN_PROGRESS')
AND workspace_id = '${ws_id}';
# Expected: 0
```

### Execute Reset

```bash
# 1. Drop entire tenant database
psql -h ${DB_HOST} -U postgres \
  -c "DROP DATABASE zidney_acme_university;"

# 2. Recreate empty database
psql -h ${DB_HOST} -U postgres \
  -c "CREATE DATABASE zidney_acme_university;"

# 3. Re-initialize schema
# API will auto-call schema/initialize on first request
# OR manually trigger:
curl -X POST http://api.local:3000/api/workspaces/{id}/schema/initialize

# 4. Verify
SELECT version FROM schema_version;
```

### After Reset

```bash
# 1. Confirm schema version
SELECT version, applied_at FROM schema_version;

# 2. Mark workspace as active
UPDATE licenses SET status = 'ACTIVE' WHERE workspace_id = '${ws_id}';

# 3. Notify workspace
# "Workspace reset complete. Schema re-initialized to v1.0.0"

# 4. Monitor for errors
tail -f /var/log/zidney/api.log | grep ERROR
```

---

## Performance Tuning

### Index Usage

```sql
-- Which indexes are being used?
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC
LIMIT 10;

-- Unused indexes (candidate for removal)
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelname) DESC;
```

### Slow Queries

```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1s
SELECT pg_reload_conf();

-- Find slow queries
SELECT query, calls, mean_time
FROM pg_stat_statements
WHERE mean_time > 1000  -- > 1 second average
ORDER BY mean_time DESC
LIMIT 10;

-- Example output:
-- SELECT * FROM attempts WHERE user_id = ...
--        100 calls, 2500ms avg
-- → Add index: CREATE INDEX idx_attempts_user_id ON attempts(user_id);
```

### Connection Pool Management

```
Default: 10 connections per workspace

If exhausted:

1. Check active connections:
   SELECT user, application_name, state, state_change
   FROM pg_stat_activity;

2. Monitor idle connections:
   SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'idle';

3. Increase user max_connections if needed (reload DB):
   ALTER SYSTEM SET max_connections = 200;
   sudo systemctl restart postgresql
```

---

## Alerting & Escalation

### Auto-Generated Alerts

| Alert                        | Severity | Action                          |
| ---------------------------- | -------- | ------------------------------- |
| schema_initialization_failed | CRITICAL | Page on-call engineer           |
| checksum_mismatch            | CRITICAL | Page security team (tampering!) |
| lock_timeout                 | WARN     | Page on-call DBA                |
| migration_in_progress        | INFO     | Monitor progress                |
| version_mismatch             | WARN     | Auto-trigger migration          |

### Manual Alert: Schema Corrupted

```bash
# 1. Stop all API instances issuing requests to workspace
# 2. Query schema_version
SELECT version FROM schema_version;
# If FAILS or returns NULL → corruption detected

# 3. Create incident ticket
# Title: "Schema Corruption Detected: workspace-${id}"
# Assign to: On-Call DBA + Senior Engineer

# 4. Begin investigation
# See: DLQ investigation section above

# 5. If unrecoverable: restore snapshot
# See: BACKUP_RECOVERY.md
```

---

## Workspace Provisioning Checklist

```
Schema Initialization Workflow:
[  ] 1. License created in MMC (status: ACTIVE)
[  ] 2. Tenant registered in tenants_registry
[  ] 3. API call: POST /api/workspaces/{id}/schema/initialize
[  ] 4. Worker task enqueued (INIT_TENANT_SCHEMA)
[  ] 5. Database connection pool initialized
[  ] 6. Baseline schema + triggers created
[  ] 7. schema_version inserted (version: 1.0.0)
[  ] 8. Workspace ready for user enrollment
```

---

## Support & Escalation

- **API Issues**: Check [logs](logs/api.log) and [metrics](metrics/api_metrics)
- **Database Issues**: Escalate to DBA team
- **Security**: Alert [security@zidney.io](mailto:security@zidney.io) immediately
- **Compliance**: Document all manual operations in audit log
