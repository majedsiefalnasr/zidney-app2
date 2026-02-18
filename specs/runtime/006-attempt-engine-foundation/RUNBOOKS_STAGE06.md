# STAGE 06 Runbooks

**Version:** 1.0.0  
**Status:** Production Ready  
**Last Updated:** 2026-02-18

---

## Quick Reference

### Emergency Contacts

- **On-Call Engineer:** [Page via PagerDuty/Slack]
- **Database Specialist:** [Contact info]
- **Architecture Lead:** [Contact info]

### Critical Services

| Service    | Health Endpoint           | Status Page            |
| ---------- | ------------------------- | ---------------------- |
| API        | http://api:3000/health    | Monitoring dashboard   |
| Worker     | http://worker:3001/health | Monitoring dashboard   |
| PostgreSQL | psql command              | Database admin console |
| Redis      | redis-cli ping            | Redis admin console    |

---

## Incident Response Procedures

### 1. DLQ Backlog Growing (> 10 Jobs)

**Severity:** CRITICAL  
**Detection:** Alert "grading_jobs_dlq_size > 10"

#### Investigation

```bash
# Step 1: Confirm DLQ size
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT COUNT(*) FROM grading_jobs WHERE status = 'DEAD_LETTER';"

# Step 2: Check recent failures
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT id, error_message, retry_count, created_at
      FROM grading_jobs
      WHERE status = 'DEAD_LETTER'
      ORDER BY created_at DESC LIMIT 10;"

# Step 3: Check worker logs for error patterns
docker logs zidney-worker | grep ERROR | tail -20
```

#### Common Failure Causes & Solutions

**Cause A: Database Connection Error**

```bash
# Symptom in logs
# "Error: getaddrinfo ENOTFOUND postgres.example.com"

# Solution
# 1. Check database connectivity
psql -U postgres -d zidney_tenant_acme -c "SELECT NOW();"

# 2. Verify connection string
echo $DATABASE_URL

# 3. If connection pool exhausted
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT application_name, state, state_change FROM pg_stat_activity LIMIT 10;"

# 4. Scale workers down temporarily
docker scale zidney-worker=1

# 5. Monitor and scale back up
docker scale zidney-worker=5
```

**Cause B: JSON Parse Error (Snapshot Corruption)**

```bash
# Symptom in logs
# "Error: JSON.parse failed - invalid JSONB in snapshot"

# Solution
# 1. Check for corrupt snapshot
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT id FROM attempts WHERE question_snapshot IS NULL OR grading_config_snapshot IS NULL;"

# 2. If found, escalate (data integrity issue)
# This should never happen - indicates schema violation

# 3. Query specific attempt
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT question_snapshot FROM attempts WHERE id = '550e8400-e29b-41d4-a716-446655440001';" | head -5
```

**Cause C: Algorithm Error (Bug in Grading Logic)**

```bash
# Symptom in logs
# "Error: Scoring algorithm failed - divide by zero"

# Solution
# 1. Fix bug in ScoreEngine code
# 2. Commit and tag new version
# 3. Build new worker image
# 4. Restart workers with new image
# 5. Manual retry DLQ jobs (Phase 2 admin console)
# For now: Log ticket for Phase 2 implementation
```

#### Recovery

```bash
# Option 1: Wait for next worker restart (automatic retry)
# DLQ jobs are NOT automatically retried - they stay in DEAD_LETTER

# Option 2: Manual retry (requires admin tool, Phase 2)
# curl -X POST http://admin-api:3000/admin/dlq/retry \
#   -H "Authorization: Bearer $ADMIN_TOKEN" \
#   -d '{"job_id":"..."}'

# For now, document all DLQ entries:
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT id, error_message FROM grading_jobs WHERE status = 'DEAD_LETTER';" \
  > /logs/dlq_entries_$(date +%Y%m%d_%H%M%S).txt
```

---

### 2. Submission Lock Timeout Frequent (>1% of submissions)

**Severity:** HIGH  
**Detection:** Alert "submission_lock_timeout_rate > 0.01"

#### Investigation

```bash
# Step 1: Check timeout occurrence rate
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT COUNT(*) FROM grading_jobs WHERE status = 'PROCESSING' AND started_at < NOW() - INTERVAL '30 seconds';"

# Step 2: Check worker throughput
docker logs zidney-worker | grep "grading_completed" | tail -10 | wc -l
# Should see ~1 line per second = healthy

# Step 3: Check database connection pool
psql -U postgres \
  -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'zidney_tenant_acme';"
# If close to max_connections, connection pool exhausted
```

#### Solutions

**Solution A: Increase Worker Instances**

```bash
# Current setup (check)
docker ps | grep zidney-worker | wc -l

# Scale up (Docker)
docker scale zidney-worker=10

# Scale up (Kubernetes)
kubectl scale deployment zidney-worker --replicas=10

# Verify
kubectl get deployment zidney-worker
# Should show 10/10 ready

# Monitor throughput
docker logs -f zidney-worker | grep "grading_completed"
# Should see increase in throughput
```

**Solution B: Increase Lock Timeout**

```bash
# Current timeout: 5 seconds (in code)
# To increase: Edit apps/api/src/handlers/submit.ts

# Change
const lockTimeout = 5000; // ms

# to
const lockTimeout = 30000; // 30 seconds

# Redeploy
docker build -t zidney-api:1.0.1 apps/api/
docker restart zidney-api
```

**Solution C: Optimize Query Performance**

```bash
# Check slow queries
postgres=# SELECT query, calls, total_time/calls AS avg_time
FROM pg_stat_statements
WHERE query LIKE '%attempts%'
ORDER BY avg_time DESC
LIMIT 10;

# If submitting SELECT is slow (>100ms):
# Add missing index or archiv old attempts (Phase 2)
```

---

### 3. Worker Crash Loop

**Severity:** CRITICAL  
**Detection:** Worker pod keeps restarting

#### Investigation

```bash
# Step 1: Check startup logs
docker logs zidney-worker --tail=100

# Alternative (if using previous run)
docker logs zidney-worker --previous

# Step 2: Check pod events (Kubernetes)
kubectl describe pod zidney-worker-abc123

# Look for:
# - "CrashLoopBackOff"
# - "Reason: Error"
```

#### Common Startup Failures

**Failure A: Database Unreachable**

```bash
# Symptom
# "Error: connect ECONNREFUSED postgres:5432"

# Solution
# 1. Check database health
psql -U postgres -h postgres -c "SELECT 1;"

# 2. Check connection string
echo $DATABASE_URL

# 3. Verify database is running
docker ps | grep postgres

# 4. If database down, restart
docker restart postgres-container
```

**Failure B: Out of Memory**

```bash
# Symptom
# "worker process killed (OOMKilled)"

# Solution
# 1. Check memory usage
docker stats zidney-worker --no-stream

# 2. Increase memory limit (Docker Compose)
# services:
#   worker:
#     memswap_limit: 2gb
#     mem_limit: 2gb

# 3. Redeploy
docker-compose up -d --force-recreate

# Or Kubernetes
kubectl set resources deployment zidney-worker \
  --limits=memory=2Gi --requests=memory=1Gi
```

**Failure C: Missing Secrets/ENV Variables**

```bash
# Symptom
# "Error: DATABASE_URL not set"

# Solution
# 1. Check env variables
docker inspect zidney-worker | grep -A 20 "Env"

# 2. Set if missing (Docker)
docker run -d \
  -e DATABASE_URL="..." \
  -e REDIS_URL="..." \
  zidney-worker:1.0.0

# 3. Or Kubernetes
kubectl set env deployment/zidney-worker \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="redis://..."
```

---

### 4. Database Connection Pool Exhausted

**Severity:** CRITICAL  
**Detection:** "Timeout acquiring connection" errors in API logs

#### Investigation

```bash
# Step 1: Check current connections
psql -U postgres \
  -c "SELECT datname, usename, state, COUNT(*)
      FROM pg_stat_activity
      GROUP BY datname, usename, state;"

# Step 2: Check max connections setting
psql -U postgres -c "SELECT name, setting FROM pg_settings WHERE name = 'max_connections';"
# Default: 100

# Step 3: Check long-running queries
psql -U postgres \
  -c "SELECT pid, usename, application_name, state, query, query_start
      FROM pg_stat_activity
      WHERE state != 'idle'
      ORDER BY query_start ASC;"
```

#### Solutions

**Solution A: Kill Idle Connections**

```bash
# Kill connections idle >5 min
psql -U postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = 'zidney_tenant_acme'
    AND state = 'idle'
    AND query_start < NOW() - INTERVAL '5 minutes';
"

# Or all idle
psql -U postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle in transaction';
"
```

**Solution B: Increase Pool Size**

```bash
# Current: max_connections = 100
# In postgresql.conf

# Change to
max_connections = 200

# Restart PostgreSQL
docker restart postgres-container

# Verify
psql -U postgres -c "SELECT setting FROM pg_settings WHERE name = 'max_connections';"
```

**Solution C: Scale Down Temporarily**

```bash
# Reduce API instances temporarily
docker scale zidney-api=1

# Reduces connection demand
# Monitor for 10 minutes

# Scale back up
docker scale zidney-api=2
```

---

## Maintenance Tasks

### Daily (0:00 UTC)

```bash
# 1. Check DLQ size (should be ~0)
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT COUNT(*) FROM grading_jobs WHERE status = 'DEAD_LETTER';"

# 2. Check error logs
docker logs zidney-api | grep ERROR | wc -l
docker logs zidney-worker | grep ERROR | wc -l

# 3. Review alerting
# Check PagerDuty/Slack for any page-outs
```

### Weekly (Every Monday 09:00 UTC)

```bash
# 1. Review slow queries
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT query, calls, total_time/calls AS avg_time
      FROM pg_stat_statements
      WHERE datname = 'zidney_tenant_acme'
      ORDER BY avg_time DESC LIMIT 10;" \
  > /logs/slow_queries_week_$(date +%Y%m%d).txt

# 2. Test backup/restore
# (Document procedure, don't restore to prod)

# 3. Review attempt counts
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT COUNT(*) FROM attempts
      WHERE created_at > NOW() - INTERVAL '7 days';"
# Should track growth
```

### Monthly (First Friday of Month)

```bash
# 1. Database vacuum & analyze
psql -U postgres -d zidney_tenant_acme \
  -c "VACUUM ANALYZE;"

# 2. Check index bloat
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT schemaname, tablename, indexname, idx_scan, ax_blks_read
      FROM pg_stat_user_indexes
      ORDER BY idx_blks_read DESC LIMIT 10;"

# 3. Review Constitutional compliance
# - Verify all queries have workspace_id filter
# - Check no console.log in production logs
# - Verify snapshots are immutable

# 4. Performance baseline
# - Record throughput (jobs/sec)
# - Record latency (p50, p99)
# - Document vs baseline
```

---

## Emergency Procedures

### Graceful Shutdown (Planned Maintenance)

```bash
# 1. Notify users (5 min warning)
# 2. Stop accepting new jobs
#    (Set feature flag or remove load balancer)

# 3. Wait for current jobs to complete
#    (Max 30 seconds grace period)
docker kill -s SIGTERM zidney-worker
# Worker will drain queue gracefully

# 4. Verify no outstanding jobs
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT COUNT(*) FROM grading_jobs WHERE status IN ('PENDING', 'PROCESSING');"
# Should be 0

# 5. Restart for next deployment
docker start zidney-worker
```

### Force Stop (Emergency Only)

```bash
# Last resort if graceful shutdown fails
docker kill -s SIGKILL zidney-worker

# Result:
# - Current job ABANDONED
# - Attempt stays SUBMITTED
# - Job stays PENDING (can be resumed)

# VERIFY: Attempt is stuck, manual intervention needed
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT id, status FROM attempts WHERE status = 'SUBMITTED' AND submitted_at < NOW() - INTERVAL '10 minutes';"

# TODO: Implement manual resume (Phase 2)
```

---

## Disaster Recovery Checklist

### Scenario: Entire Database Lost

**Recovery Steps:**

```bash
# 1. Restore from backup
gunzip -c /backups/backup_20260218_140000.sql.gz \
  | psql -U postgres

# 2. Verify restore
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT COUNT(*) FROM attempts;"

# 3. Restart workers
# Workers will resume pending grading_jobs

# 4. Verify services online
curl http://localhost:3000/health
```

**Data Loss:** All attempts created after last backup are lost.  
**RTO:** ~15 minutes (backup restore + service restart)  
**RPO:** Latest backup (usually <1 hour)

### Scenario: API Corruption in Production

**Rollback Steps:**

```bash
# 1. Identify last good version
git log --oneline | head -20

# 2. Get docker image of previous version
docker pull zidney-api:0.9.9

# 3. Stop current
docker stop zidney-api

# 4. Start previous
docker run -d \
  --name zidney-api \
  -e DATABASE_URL="..." \
  zidney-api:0.9.9

# 5. Verify
curl http://localhost:3000/health

# 6. While rolling back, worker continues grading
# NO schema changes, so schema version still v1.0.0
```

**RTO:** ~2 minutes (container swap)  
**Data Loss:** NONE (API doesn't modify data, only queries it)

---

## Escalation Matrix

| Issue                 | P1            | P2            | P3      | Owner         |
| --------------------- | ------------- | ------------- | ------- | ------------- |
| DLQ growing           | Page on-call  | Warn on-call  | Monitor | Platform Lead |
| Lock timeout frequent | Scale workers | Monitor       | –       | DevOps + Lead |
| Database down         | Page DBA      | Immediate     | –       | Database Team |
| API crash loop        | Page on-call  | Debug locally | –       | Backend Lead  |

---

## Contact & Escalation

- **Page Teams:** [PagerDuty URL]
- **Slack On-Call:** [Slack channel]
- **Status Page:** [Public status URL]
- **War Room:** [Zoom/Teams URL]

---

**Last Updated:** 2026-02-18  
**Owner:** Zidney Operations  
**Review Frequency:** Quarterly
