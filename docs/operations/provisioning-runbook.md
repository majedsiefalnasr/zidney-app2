# Operations Runbook: Tenant Provisioning Service

## Stage: STAGE_05_TENANT_PROVISIONING_SERVICE

## Authority: Zidney Operations Manual v1.0

## Last Updated: 2026-02-18

---

## 1. System Overview

### Purpose

The Tenant Provisioning Service automates the lifecycle of workspace database creation, schema initialization, and baseline data seeding for Zidney SaaS tenants. This runbook guides operations teams through monitoring, troubleshooting, and recovery procedures.

### Architecture

```
Master DB (Central)
├── licenses (status, schema_version)
├── tenants_registry (workspace metadata)
└── schema_migrations (audit trail)

Tenant DB (Per-Workspace)
├── schema_version (singleton)
├── schema_migrations (audit trail)
├── provisioning_checkpoints (recovery)
└── 14 core application tables

Worker Process
├── Job Queue (Redis FIFO)
├── Distributed Lock (Redis SET NX EX)
├── Dead Letter Queue (Redis list)
└── Status Checkpoints (Tenant DB)

API Middleware Stack
├── TenantResolver → LicenseValidation → SchemaVersionCheck
└── Connection Pool Manager (per-tenant)
```

### Key Flows

- **Provisioning Job**: POST /api/workspaces → enqueue → worker dequeues → 9-step pipeline → ACTIVE license
- **Recovery**: Worker crash → Check checkpoint → Resume from next step → Complete provisioning
- **Failure**: Step failure → Rollback (drop DB, delete registry) → License FAILED → Manual intervention via DLQ

---

## 2. Health Checks & Monitoring

### System Status Commands

#### Check Queue Status

```bash
# Redis: Connect and check job queue depth
redis-cli LLEN provisioning_jobs
# Expected: 0-5 (low queue depth indicates normal processing)
# Alert if: > 100 (provisioning backlog)

redis-cli LLEN provisioning_jobs:dlq
# Expected: 0 (no failed jobs)
# Alert if: > 0 (investigate DLQ items)
```

#### Check Active Locks

```bash
# Redis: Find locks currently held
redis-cli KEYS "provisioning:*"
# Expected: 0-1 (one lock per active provisioning)
# Alert if: > 5 (many concurrent jobs or stuck locks)

redis-cli TTL provisioning:acme-university
# Expected: 5-300 (TTL in seconds)
# Alert if: -1 (no TTL, lock will never expire)
```

#### Check Tenant Database Status

```bash
# Postgres: List all workspace databases
psql -U admin -h master-db -d postgres -c \
  "SELECT datname FROM pg_database WHERE datname LIKE 'workspace_%' ORDER BY datname;"
# Expected: list of workspace_<slug> databases
```

#### Check Provisioning Progress

```bash
# Postgres: Check latest checkpoints (shows which workspaces are provisioning)
psql -U admin -h tenant-db -d workspace_acme_university -c \
  "SELECT correlation_id, step, step_ordinal, completed_at FROM provisioning_checkpoints
   ORDER BY step_ordinal DESC LIMIT 20;"
# last step_ordinal=9 means provisioning complete
# incomplete ordinals indicate in-progress provisioning
```

#### Check Lock Status

```bash
# Postgres: Query lock status (if implementing ops endpoint)
redis-cli GET "provisioning:acme-university"
# Response format: "${timestamp}-${random9chars}"
# If TTL expired: (nil) – lock acquired, can be re-entrant now
```

### Prometheus Metrics

- `provisioning_duration_seconds` (histogram): Time to complete 9-step pipeline
- `provisioning_lock_wait_seconds` (histogram): Time to acquire lock (indicates contention)
- `provisioning_migrations_duration_seconds` (histogram): Per-migration execution time
- `provisioning_attempt_count` (counter): Total provisioning attempts by workspace
- `provisioning_job_retry_total` (counter): Retry count by failure reason

### Alerting Rules

| Metric                         | Threshold         | Action                                                    |
| ------------------------------ | ----------------- | --------------------------------------------------------- |
| provisioning_jobs queue length | > 100             | Page on-call (scaling issue or worker crashed)            |
| provisioning_jobs:dlq length   | > 5               | Page on-call (manual intervention required)               |
| provisioning lock TTL          | -1 (no TTL)       | Investigate lock acquisition code, may indicate Redis bug |
| provisioning_duration_seconds  | p95 > 60s         | Investigate slow provisioning (DB creation bottleneck?)   |
| provisioning_job_retry_total   | spike             | Identify failure mode (PROV_003 = migration error)        |
| database count workspace\_\*   | unexpected growth | Check for orphan databases (run orphan detection job)     |

---

## 3. Common Issues & Resolution

### Issue: "Lock already held by another process"

**Error Code**: PROV_006 (409 Conflict)

**Root Cause**: Two provisioning jobs trying to acquire lock for same workspace simultaneously.

**Resolution**:

1. Check which job holds lock:
   ```bash
   redis-cli GET "provisioning:${WORKSPACE_SLUG}"
   ```
2. If locked and job is running normally: Wait for completion (check logs for progress).
3. If locked and no active process (worker crashed):
   ```bash
   redis-cli DEL "provisioning:${WORKSPACE_SLUG}"
   ```
   Then retry provisioning job.
4. Verify lock TTL is set correctly (should be ~5 minutes):
   ```bash
   redis-cli TTL "provisioning:${WORKSPACE_SLUG}"
   ```

---

### Issue: "Database creation failed"

**Error Code**: PROV_002 (500 Internal Server Error)

**Root Cause**: PostgreSQL error during `CREATE DATABASE workspace_${slug}`.

**Resolution**:

1. Check error logs:
   ```bash
   grep "PROV_002" worker-logs.json | tail -20 | jq '.error.message'
   ```
2. Common causes:
   - **Disk full**: `df -h /var/lib/postgresql` – expand volume
   - **Connection limit**: `SELECT count(*) FROM pg_stat_activity;` – check connection count
   - **Invalid slug**: Verify slug matches pattern `^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$`
3. After fixing root cause, move job from DLQ back to main queue (see DLQ Recovery section).

---

### Issue: "Migration checksum mismatch"

**Error Code**: PROV_010 (500 Internal Server Error)

**Root Cause**: Migration file was modified after being applied to other tenants.

**Resolution**:

1. **DO NOT modify migration files** – migrations are append-only.
2. Check if migration was already applied:
   ```bash
   psql -U admin -h tenant-db -d workspace_${SLUG} -c \
     "SELECT version, checksum FROM schema_migrations WHERE version = '002';"
   ```
3. If checksum differs:
   - New migration must have new version number (e.g., 003 instead of 002).
   - Create new migration file: `003-fix-previous-issue.sql`
   - Run against **all** tenants in sequence.
4. Never remove or rollback migrations – design all changes as forward-only.

---

### Issue: "Provisioning stuck at step 5 (seeding)"

**Error Code**: PROV_004 (500 Internal Server Error) or checkpoint stuck at ordinal 6

**Root Cause**: Seed data has duplicate keys or foreign key constraint violation.

**Resolution**:

1. Check checkpoint to see which step failed:
   ```bash
   psql -U admin -h tenant-db -d workspace_${SLUG} -c \
     "SELECT step, step_ordinal, payload FROM provisioning_checkpoints
      ORDER BY step_ordinal DESC LIMIT 3;"
   ```
2. If ordinal=6 (migration_004_applied) but not 7 (seed_data): Seed failed.
3. Inspect seed data manually:
   ```bash
   psql -U admin -h tenant-db -d workspace_${SLUG} -c \
     "SELECT role_id, role_name FROM roles;"
   ```
4. Remove orphan database (rollback should have done this):
   ```bash
   psql -U admin -h master-db -d postgres -c \
     "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='workspace_${SLUG}';
      DROP DATABASE IF EXISTS workspace_${SLUG};"
   ```
5. Retry job (it will re-create database and re-run all steps from checkpoint).

---

### Issue: "Orphaned workspace databases detected"

**Error Code**: OrphanDetectionJob warning in logs

**Root Cause**: Database exists, but no entry in `tenants_registry`, or vice versa.

**Resolution**:

1. List orphan databases and entries:

   ```bash
   # Via ops endpoint (if implemented):
   curl https://api.zidney.app/health/orphans \
     -H "Authorization: Bearer ${OPS_TOKEN}"

   # Manual check:
   psql -U admin -h master-db -d postgres -c \
     "SELECT datname FROM pg_database WHERE datname LIKE 'workspace_%' ORDER BY datname;"

   # Compare against registry:
   psql -U admin -h master-db -d zidney_platform -c \
     "SELECT database_name FROM tenants_registry WHERE is_active=true ORDER BY database_name;"
   ```

2. For orphaned _databases_ (no registry entry):
   ```bash
   # Confirm no active tenants use this DB, then drop:
   psql -U admin -h master-db -d postgres -c \
     "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname='workspace_orphan_slug';
      DROP DATABASE IF EXISTS workspace_orphan_slug;"
   ```
3. For orphaned _registry entries_ (no DB):
   ```bash
   psql -U admin -h master-db -d zidney_platform -c \
     "UPDATE tenants_registry SET is_active=false, archived_at=NOW()
      WHERE database_name='workspace_orphan_slug';"
   ```

---

## 4. Manual Intervention: Dead Letter Queue (DLQ) Recovery

### When to Use DLQ Recovery

- Job failed after max retries (3 attempts).
- Root cause identified and fixed (e.g., disk space, DB issue).
- Need to manually retry provisioning.

### DLQ Operations

#### View Failed Jobs

```bash
# Redis: Peek at dead-letter queue
redis-cli LRANGE provisioning_jobs:dlq 0 -1
# Output: JSON serialized jobs with attempt count and last error
```

#### Extract Job Details

```bash
# Get first job from DLQ
redis-cli LINDEX provisioning_jobs:dlq 0 | jq '.'
# Output:
# {
#   "id": "job-uuid",
#   "license_id": 123,
#   "workspace_slug": "acme-university",
#   "attempt": 3,
#   "correlation_id": "corr-uuid",
#   "error": "PROV_002: Database creation failed"
# }
```

#### Retry Failed Job (Move Back to Queue)

```bash
# Remove from DLQ
redis-cli LPOP provisioning_jobs:dlq

# Push back to main queue (fresh attempt)
redis-cli RPUSH provisioning_jobs "${JOB_JSON}"

# Worker will pick it up on next dequeue cycle
```

#### Delete Failed Job (if Unrecoverable)

```bash
# Example: Workspace slug was invalid, not worth retrying
redis-cli LPOP provisioning_jobs:dlq
# (discarded – log the action)
```

#### Monitor DLQ

```bash
# Automated alert (should trigger if DLQ > 0):
redis-cli LLEN provisioning_jobs:dlq
# If > 0: Generate pagerduty alert + notify ops slack
```

---

## 5. Provisioning Lifecycle

### Normal Provisioning Flow

```
1. [API] POST /api/workspaces → Validate → Create ProvisioningJob → Enqueue to Redis
2. [Worker] Dequeue job → Acquire lock (provisioning:${slug})
3. [Worker] Step 1: Validate slug format
4. [Worker] Step 2: Create database (CREATE DATABASE workspace_${slug})
5. [Worker] Step 3: Connect to new database, execute migrations (001-004)
6. [Worker] Step 4: Seed baseline data (roles, permissions, settings)
7. [Worker] Step 5: Insert registry entry (tenants_registry)
8. [Worker] Step 6: Transition license status PROVISIONING → ACTIVE (transactions)
9. [Worker] Step 7: Register connection pool
10. [Worker] Step 8: Release lock, log completion
11. [API] License middleware now allows requests to workspace
12. [Tenant] First request to workspace triggers schema_version check
```

### Failure & Rollback Flow

```
1. [Worker] Step N fails (e.g., Step 4: migration error)
2. [Worker] Call RollbackManager
   - Drop database (workspace_${slug})
   - Delete registry entry
   - Set license status = FAILED
   - Log error with correlation_id
3. [Worker] Move job to DLQ (Redis provisioning_jobs:dlq)
4. [Ops] Receive alert (DLQ length > 0)
5. [Ops] Investigate error logs, identify root cause
6. [Ops] Fix root cause (patch migration, expand storage, etc.)
7. [Ops] Manually retry job from DLQ (push back to main queue)
8. [Worker] Dequeue and provision again (from Step 1)
```

### Crash & Recovery Flow

```
1. [Worker] Provisioning in progress, at Step 5 (seeding)
2. [Worker] Worker process crashes (OOM, signal 9, etc.)
3. [Worker] (Restarted by container orchestrator)
4. [Worker] Dequeue same job from queue (Redis persists)
5. [Worker] Call CheckpointManager.getNextStep(correlation_id)
6. [Worker] Query provisioning_checkpoints, find latest ordinal=6 (SEED_DATA_APPLIED)
7. [Worker] Resume provisioning from Step 7 (REGISTRY_ENTRY_CREATED)
8. [Worker] Re-acquire lock (provisioning:${slug})
9. [Worker] Skip Steps 1-6 (idempotent, already completed)
10. [Worker] Complete Steps 7-9
11. [Worker] Provisioning succeeds, license ACTIVE
```

---

## 6. Maintenance Tasks

### Daily Maintenance

#### Check Queue Depth

```bash
cron job (daily 00:00 UTC):
  redis-cli LLEN provisioning_jobs
  # Alert if > 50 (backlog building)
```

#### Run Orphan Detection

```bash
# Automated job (daily 02:00 UTC):
POST /api/operations/orphan-detection \
  -H "Authorization: Bearer ${OPS_TOKEN}"
# Logs warnings if orphans found
# Ops team reviews daily digest
```

#### Prune Old Checkpoints

```bash
# After provisioning complete, checkpoints can be archived:
psql -U admin -h tenant-db -d workspace_${SLUG} -c \
  "DELETE FROM provisioning_checkpoints
   WHERE completed_at < NOW() - INTERVAL '30 days'
   AND step_ordinal = 9;"
```

### Weekly Maintenance

#### Review Provisioning Metrics

```bash
# Pull Prometheus metrics
curl http://prometheus:9090/api/v1/query?query=provisioning_duration_seconds
# Check for:
# - Increasing p95 latency
# - Spike in retry rates
# - Errors by type (PROV_002 vs PROV_003, etc.)
```

#### Audit Migration Checksums

```bash
# Verify no migrations were accidentally modified:
psql -U admin -h master-db -d zidney_platform -c \
  "SELECT COUNT(DISTINCT version) FROM (
     SELECT version, COUNT(*) as cnt FROM schema_migrations
     GROUP BY version
   ) WHERE cnt > 1;"
# Should return 0 (no duplicate versions)
```

### Monthly Maintenance

#### Backup Tenant Databases

```bash
# Automated backup (monthly 23:00 UTC):
for db in $(psql -U admin -h master-db -d postgres -tc \
            "SELECT datname FROM pg_database WHERE datname LIKE 'workspace_%' ORDER BY datname;"); do
  pg_dump -U admin -h master-db -d "$db" > /backups/"$db"_$(date +%Y%m%d).sql.gz
done
# Verify backups stored securely (S3, etc.)
```

#### Review Disaster Recovery Procedure

- Simulate database corruption scenario
- Verify restore from backup works
- Update recovery runbook with lessons learned

---

## 7. Escalation & On-Call Guide

### Critical Alerts

| Alert                                | SLA    | Action                                         |
| ------------------------------------ | ------ | ---------------------------------------------- |
| DLQ length > 10                      | 15 min | Page on-call, investigate job failure reason   |
| Provisioning queue > 200             | 30 min | Assess if worker crashed or needs scaling      |
| License status != ACTIVE for >1 hour | 15 min | Check if provisioning stuck (check checkpoint) |
| Orphaned databases > 5               | 1 hour | Run cleanup, update orphan detection threshold |

### Escalation Path

**Tier 1: Automated Response** (0-5 min)

- Alert fires → Check if recoverable automatically (e.g., lock TTL expired)
- Count failures by type (PROV_002 vs PROV_003)
- If recoverable: Attempt auto-remediation (delete orphaned lock, move job back to queue)

**Tier 2: On-Call Debug** (5-30 min)

- On-call developer receives pagerduty alert
- SSH to worker pods, check logs for `correlation_id`
- Identify failing step in provisioning pipeline
- Attempt manual fix (expand volume, patch migration, etc.)

**Tier 3: Engineering Head** (30+ min)

- If root cause unknown or requires code change
- Escalate to provisioning service owner
- Potentially roll back recent changes if corruption is risk

---

## 8. Example Operations Playbooks

### Playbook: "Workspace Provisioning Failed – Manual Recovery"

**Trigger**: Alert: "DLQ has 1+ jobs"

**Steps**:

1. Get job ID from DLQ:
   ```bash
   redis-cli LINDEX provisioning_jobs:dlq 0 | jq '.id'
   ```
2. Extract correlation_id:
   ```bash
   redis-cli LINDEX provisioning_jobs:dlq 0 | jq '.correlation_id'
   ```
3. Check failure reason in logs:
   ```bash
   grep "${CORRELATION_ID}" api-logs.json worker-logs.json | tail -50 | jq '.error'
   ```
4. Determine root cause from error code:
   - PROV_002 → Database creation issue
   - PROV_003 → Migration failed
   - PROV_004 → Seed data failed
5. Fix root cause (see Common Issues section).
6. Move job back to queue:
   ```bash
   redis-cli LPOP provisioning_jobs:dlq > /tmp/job.json
   redis-cli RPUSH provisioning_jobs "$(cat /tmp/job.json)"
   ```
7. Monitor provisioning completion:
   ```bash
   watch -n 5 "redis-cli LLEN provisioning_jobs && redis-cli LLEN provisioning_jobs:dlq"
   ```
8. Verify workspace accessible:
   ```bash
   curl https://acme-university.zidney.app/api/health \
     -H "Authorization: Bearer ${TEST_TOKEN}"
   # Should return 200 OK
   ```

---

## 9. References

- **Architecture Decision Records**: `docs/architecture/ADR-0001.md` (database-per-tenant)
- **Provisioning Specification**: `specs/phases/04_runtime/STAGE_05_TENANT_PROVISIONING_SERVICE.md`
- **Error Codes**: See `ErrorHandling.ts` for full PROV\_\* code reference
- **Structured Logging**: All logs include correlation_id for tracing across services

---

## 10. Troubleshooting Decision Tree

```
Is provisioning stuck?
├─ YES → Check checkpoint ordinal
│ ├─ Ordinal 0 (no checkpoint)
│ │ └─ Lock still held? → DEL lock, retry
│ ├─ Ordinal 1-8 (intermediate step)
│ │ └─ Is worker running? LLEN provisioning_jobs > 0?
│ │   ├─ YES → Wait (worker is processing)
│ │   └─ NO → Worker crashed, new one will pick up job
│ └─ Ordinal 9 (complete)
│   └─ License should be ACTIVE. If not, check license status query ↓
│
└─ NO → Provisioning completed successfully
  └─ Verify: License ACTIVE? Schema_version in tenant DB? Pool registered?
```

---

**Document Status**: PRODUCTION READY v1.0
**Last Reviewed**: 2026-02-18
**Owner**: Operations Team
**Feedback**: ops@zidney.app
