# Operational Runbook - Licenses Management System

## Table of Contents

1. [System Overview](#system-overview)
2. [Deployment Checklist](#deployment-checklist)
3. [Troubleshooting Guide](#troubleshooting-guide)
4. [Emergency Procedures](#emergency-procedures)
5. [Monitoring & Alerts](#monitoring--alerts)
6. [Maintenance Windows](#maintenance-windows)

---

## System Overview

**Service Architecture:**

- API Layer: `apps/api/src/routes/mmc/licenses.ts`
- Domain Library: `packages/domain-core/src/licenses/`
- Database: PostgreSQL (master_db tenant record)
- Queue: Redis + Bull (provisioning jobs)
- Worker: `apps/worker/src/jobs/provisioning.handler.ts`

**Critical Dependencies:**

- PostgreSQL (master database)
- Redis (job queue)
- Bun v1.x runtime
- Node.js worker process

---

## Deployment Checklist

### Pre-Deployment (Staging)

- [ ] All tests passing (unit + integration)
- [ ] Type check clean: `bun run type-check`
- [ ] Lint clean: `bun run lint`
- [ ] Database migrations validated
- [ ] Worker health check passing
- [ ] Load test SLA targets met:
  - GET /licenses: < 300ms p95
  - POST /licenses: < 200ms p95
  - Worker provisioning: < 5min p95

### Deployment Steps

1. **Backup Production Database**

   ```bash
   pg_dump zidney_master > backup-$(date +%Y%m%d-%H%M%S).sql
   ```

2. **Deploy API Changes**

   ```bash
   git checkout origin/010-licenses-management
   bun install
   bun run build
   docker build -t zidney-api:v1.0.0 -f Dockerfile.api .
   docker push zidney-api:v1.0.0
   ```

3. **Run Database Migrations**

   ```bash
   bun run migrate:up --stage production
   ```

   Migrations run atomically:
   - 001_create_licenses_table.ts
   - 002_add_provisioning_fields.ts
   - 003_add_status_enum_values.ts
   - 004_add_updated_at_trigger.ts
   - 005_create_audit_log_table.ts
   - 006_update_tenants_registry_for_licenses.ts

4. **Deploy Worker**

   ```bash
   docker build -t zidney-worker:v1.0.0 -f Dockerfile.worker .
   docker push zidney-worker:v1.0.0
   docker run -e CONCURRENCY=12 zidney-worker:v1.0.0
   ```

5. **Smoke Tests**

   ```bash
   # Create test license
   curl -X POST $API_URL/mmc/licenses \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"product_id":"...", "workspace_slug":"test-$(date +%s)"}'

   # Verify provisioning job enqueued
   redis-cli LLEN bull:provisioning:license
   ```

6. **Monitor Provisioning Queue**

   ```bash
   watch -n 1 'redis-cli HGETALL bull:provisioning:license:status'
   ```

   Expect: Queue draining within 5 minutes

7. **Verify License Data**
   ```sql
   SELECT COUNT(*) FROM licenses WHERE created_at > NOW() - INTERVAL '1 hour';
   SELECT COUNT(*) FROM audit_log WHERE created_at > NOW() - INTERVAL '1 hour';
   ```

---

## Troubleshooting Guide

### Symptom: Licenses API Returns 500 Error

**Probable Cause:** Type error or database connection failure

**Debug Steps:**

1. Check API logs: `docker logs zidney-api | grep ERROR`
2. Verify database connectivity: `psql -h $DB_HOST -U postgres -d zidney_master -c "SELECT 1"`
3. Check for schema version mismatch: `SELECT * FROM schema_versions WHERE name='licenses'`
4. Review correlation ID in logs: `grep "<CORRELATION_ID>" app.log`

**Remediation:**

```bash
# If schema mismatch, check migrations
bun run migrate:status
# If corrupted, restore from backup
psql zidney_master < backup.sql
```

---

### Symptom: Provisioning Jobs Not Processing (Queue Stalled)

**Probable Cause:** Worker crashed, Redis down, or job handler error

**Debug Steps:**

1. Check Redis: `redis-cli ping` (should return "PONG")
2. Check worker process: `ps aux | grep provisioning.handler`
3. Review worker logs: `docker logs zidney-worker | tail -100`
4. Check queue depth: `redis-cli LLEN bull:provisioning:license`
5. Inspect first job: `redis-cli LINDEX bull:provisioning:license 0`

**Remediation:**

```bash
# Restart worker
docker restart zidney-worker

# Clear stuck jobs > 24h old
redis-cli EVAL "
  local keys=redis.call('keys','bull:provisioning:*')
  for i,k in ipairs(keys) do
    if redis.call('ttl',k) < 0 then
      redis.call('del',k)
    end
  end
" 0

# Monitor recovery
watch -n 5 'redis-cli LLEN bull:provisioning:license'
```

---

### Symptom: Soft-Lock Auto-Expiration Not Triggering

**Probable Cause:** Lazy evaluation requires request, or clock skew

**Debug Steps:**

1. Verify server time: `date -u` (must match database NOW())
2. Check for licenses past grace period:
   ```sql
   SELECT id, workspace_slug, soft_lock_until
   FROM licenses
   WHERE status='SOFT_LOCKED' AND soft_lock_until < NOW();
   ```
3. Trigger manual transition: Make API request to SOFT_LOCKED license

**Remediation:**

```bash
# Manually expire all grace periods
psql zidney_master << EOF
UPDATE licenses
SET status='ARCHIVED', archived_at=NOW()
WHERE status='SOFT_LOCKED' AND soft_lock_until < NOW();
EOF
```

---

### Symptom: Duplicate Licenses Created (Idempotency Failed)

**Probable Cause:** Unique constraint not enforced, or application bug

**Debug Steps:**

```sql
-- Find duplicates
SELECT workspace_slug, COUNT(*)
FROM licenses
GROUP BY workspace_slug
HAVING COUNT(*) > 1;

-- Check unique constraint exists
\d licenses
-- Should show: UNIQUE, btree (workspace_slug)
```

**Remediation:**

```bash
# Check application version for idempotency bug
git log --oneline -1

# Verify constraint
ALTER TABLE licenses ADD CONSTRAINT uq_licenses_workspace_slug
UNIQUE(workspace_slug) ON CONFLICT DO NOTHING;

# Manually clean duplicates (keep first, delete others)
DELETE FROM licenses WHERE id NOT IN (
  SELECT DISTINCT ON (workspace_slug) id
  FROM licenses ORDER BY workspace_slug, created_at
);
```

---

### Symptom: DLQ Queue Growing (Jobs Failing Repeatedly)

**Probable Cause:** Persistent infrastructure issues or application bug

**Debug Steps:**

1. Check DLQ depth: `redis-cli LLEN bull:provisioning:dlq`
2. Inspect failed job:
   ```bash
   redis-cli LINDEX bull:provisioning:dlq 0 | jq .
   ```
3. Review error pattern:
   ```bash
   redis-cli LRANGE bull:provisioning:dlq 0 -1 | grep -i "error"
   ```

**Remediation:**

```bash
# Identify root cause
redis-cli LINDEX bull:provisioning:dlq 0 | jq '.failedReason'

# If database issue, fix and retry
bun run provisioning:retry-dlq

# If persistent, escalate and preserve DLQ for audit
redis-cli BGSAVE  # Backup Redis state
```

---

## Emergency Procedures

### Rollback to Previous Version

**If Critical Bug Found:**

1. **Identify Last Good Version**

   ```bash
   git log --all --oneline | head -20
   git show <COMMIT_SHA>:CHANGELOG.md | head -20
   ```

2. **Backup Current Data**

   ```bash
   pg_dump zidney_master > backup-failed-$(date +%Y%m%d-%H%M%S).sql
   redis-cli BGSAVE
   ```

3. **Rollback Database**

   ```bash
   bun run migrate:down --stage production --to-version <PREVIOUS>
   ```

4. **Redeploy Previous API + Worker**

   ```bash
   git checkout <PREVIOUS_TAG>
   docker build -t zidney-api:rollback .
   docker stop zidney-api && docker run zidney-api:rollback
   docker stop zidney-worker && docker run zidney-worker:rollback
   ```

5. **Verify Stability**
   - Check API health: `curl $API_URL/health`
   - Verify licenses visible: `curl $API_URL/mmc/licenses -H "Authorization: Bearer $TOKEN"`
   - Check queue processing: `redis-cli LLEN bull:provisioning:license`

---

### Emergency Drain Queue

**If Queue Backlog Critical (> 1000 jobs stuck > 30min):**

```bash
# 1. Pause provisioning job processor
ssh $WORKER_SERVER
kill -SIGSTOP $(pgrep -f provisioning.handler)

# 2. Examine queue state
redis-cli INFO stats

# 3. Move jobs to DLQ (after investigation)
redis-cli EVAL "
  local count = 0
  while redis.call('LLEN','bull:provisioning:license') > 0 do
    local job = redis.call('LPOP','bull:provisioning:license')
    redis.call('RPUSH','bull:provisioning:dlq', job)
    count = count + 1
  end
  return count
" 0

# 4. Document in incident log
echo "INCIDENT: Queue drain at $(date), moved $count jobs to DLQ" >> /var/log/incidents.log

# 5. Resume under controlled restart
kill -SIGCONT $(pgrep -f provisioning.handler)
# Worker will process at normal rate (12 concurrent)
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

**Queue Health:**

- `bull:provisioning:license:pending` < 100 (jobs awaiting processing)
- `bull:provisioning:license:active` <= 12 (concurrent jobs)
- `bull:provisioning:dlq:length` < 5 (should be near zero)

**License Lifecycle:**

```sql
-- Daily report
SELECT
  DATE(created_at) as date,
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_time_to_active
FROM licenses
GROUP BY DATE(created_at), status
ORDER BY date DESC, status;
```

**Soft-Lock Expiration:**

```sql
-- Grace periods approaching expiration (within 7 days)
SELECT COUNT(*)
FROM licenses
WHERE status='SOFT_LOCKED' AND soft_lock_until < NOW() + INTERVAL '7 days'
```

### Alert Thresholds

| Alert                    | Threshold          | Action                              |
| ------------------------ | ------------------ | ----------------------------------- |
| DLQ Depth                | > 10               | Page on-call, review failed jobs    |
| Queue Backlog            | > 500 jobs > 15min | Scale worker concurrency to 24      |
| License Creation Latency | p95 > 500ms        | Investigate database indexes        |
| Worker CPU               | > 80% sustained    | Scale to multiple worker instances  |
| PostgreSQL Connections   | > 80 of 100        | Review for leaks, scale connections |

---

## Maintenance Windows

### Monthly Metrics Report

```bash
#!/bin/bash
# Run 1st of each month

echo "=== Licenses System Health Report ===" >> /var/log/health-reports.log
echo "Report generated: $(date)" >> /var/log/health-reports.log

# Query metrics
psql zidney_master -c "
SELECT
  'Total Licenses' as metric, COUNT(*)::text as value FROM licenses
UNION ALL
SELECT 'Active Licenses', COUNT(*)::text FROM licenses WHERE status='ACTIVE'
UNION ALL
SELECT 'Soft Locked', COUNT(*)::text FROM licenses WHERE status='SOFT_LOCKED'
UNION ALL
SELECT 'Archived', COUNT(*)::text FROM licenses WHERE status='ARCHIVED'
UNION ALL
SELECT 'Avg Provision Time (sec)', ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))))::text
  FROM licenses WHERE status='ACTIVE';
" >> /var/log/health-reports.log
```

### Quarterly Backup Verification

```bash
# Test restore from backup
docker run --name test-restore postgres:15
pg_restore -d zidney_master backup.sql
# Run consistency checks
bun run db:verify-integrity
# Document results
docker stop test-restore && docker rm test-restore
```

---

## Escalation Matrix

| Severity    | Issue                                   | Response Time     | Owner         |
| ----------- | --------------------------------------- | ----------------- | ------------- |
| 🔴 Critical | API down, all licenses inaccessible     | 5 min             | On-call SRE   |
| 🟠 High     | Provisioning queue stuck 30+ min        | 15 min            | Platform Team |
| 🟡 Medium   | Performance degradation p95 > SLA       | 1 hour            | DevOps Team   |
| 🟢 Low      | Documentation missing, non-critical bug | Next business day | Platform Team |

---

**Last Updated:** 2026-02-22  
**Owned By:** Platform Operations Team
