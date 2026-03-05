# Quick Reference Card: Schema Provisioning Production Deployment

**Print this page and keep with you during deployment**

---

## 🟢 Go/No-Go Decision Matrix

### DEPLOYMENT APPROVED ✅ IF:

- [ ] All 6 MUST items implemented in code
- [ ] Integration tests pass (6/6 suites)
- [ ] Registry integrity check passes (10/10)
- [ ] Load test p99 < 2s (Gate 4)
- [ ] Principal engineer signed off
- [ ] On-call team briefed

### DELAY DEPLOYMENT 🟡 IF:

- [ ] Any test fails
- [ ] Code doesn't compile
- [ ] Registry check fails
- [ ] Load test drops below < 1000 req/s
- [ ] On-call team unavailable

### HALT DEPLOYMENT 🔴 IF (STOP & ROLLBACK):

- [ ] Snapshot immutability trigger not working (Gate 5 fail)
- [ ] Idempotency violated (Gate 2: 3 requests → 2+ tasks)
- [ ] Checksum validation broken (Gate 3 fail)
- [ ] Registry integrity compromised (cannot recover)
- [ ] Security breach detected

---

## ⏱️ Deployment Timeline & Responsibilities

### Pre-Deployment (48 hours before)

- **Principal Eng**: Code + architecture review ✓
- **Dev Lead**: Ensure tests pass ✓
- **DevOps**: Staging deployment ✓
- **SRE**: Backup preparation ✓

### Day-Of (2 hours before)

- **DevOps**: Final health check
- **On-Call**: Acknowledge responsibility
- **Comms**: Notify stakeholders

### Deployment (T0 to T+90 min)

- **DevOps**: API/Worker deploy (10 min)
- **DevOps**: Apply migrations (5 min)
- **DevOps**: Registry integrity check (10 min)
- **DevOps**: Smoke tests (15 min)
- **DevOps**: Monitor 30 min (30 min)
- **SRE**: Watch alerts (continuous)
- **DevOps**: Final validation (10 min)

### Post-Deployment (T+90 min to T+24 hours)

- **SRE**: Monitor metrics
- **On-Call**: Respond to alerts
- **Dev**: Available for debugging

---

## 🎯 Critical Commands (Copy/Paste Ready)

### Pre-Deployment Checks

```bash
# 1. Compile code
cd /zidney-app2
npm run build
# ✓ Expected: 0 errors, 0 warnings

# 2. Run integration tests
npm test -- --testNamePattern="MUST Items"
# ✓ Expected: 6 test suites, all pass

# 3. Check staging deployment
kubectl get pods -n staging | grep -E 'api|worker'
# ✓ Expected: All pods RUNNING

# 4. Registry integrity (staging)
./docs/operations/verify-registry-integrity.sh --staging
# ✓ Expected: [PASS] All 10 integrity checks passed
```

### Deployment Commands (DO IN ORDER)

```bash
# 1. Deploy new code
docker build -t zidney-api:v2.4.0 ./apps/api
docker build -t zidney-worker:v2.4.0 ./apps/worker
docker push zidney-api:v2.4.0
docker push zidney-worker:v2.4.0
kubectl set image deployment/api api=zidney-api:v2.4.0 -n production
kubectl set image deployment/worker worker=zidney-worker:v2.4.0 -n production

# 2. Wait for deployment
kubectl rollout status deployment/api -n production
kubectl rollout status deployment/worker -n production

# 3. Apply database migration
npm run migrate:master --env=production
# ✓ Expected: Migration applied successfully

# 4. Registry integrity check (production)
./docs/operations/verify-registry-integrity.sh --production
# ✓ Expected: [PASS] All 10 integrity checks passed

# 5. Smoke tests
curl -X POST https://api.production/api/workspaces \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{"slug": "smoke-test-prod", "name": "Smoke Test"}'
# ✓ Expected: HTTP 200, workspace created

# 6. Monitor (watch for 30 minutes)
kubectl logs -f deployment/worker -n production | grep -E 'ERROR|WARNING|COMPLETED'
watch 'kubectl top pods -n production | grep -E "api|worker"'
```

### Rollback Commands (USE IF DEPLOYMENT FAILS)

```bash
# 1. Revert to previous version (< 1 minute)
kubectl rollout undo deployment/api -n production
kubectl rollout undo deployment/worker -n production

# 2. Verify rollback
kubectl rollout status deployment/api -n production
kubectl rollout status deployment/worker -n production

# 3. If database corrupted (< 5 minutes)
# Restore from pre-deployment backup
pg_restore -U postgres -d zidney_master < backup-pre-deploy.sql.gz

# 4. Verify restoration
./docs/operations/verify-registry-integrity.sh --production
# ✓ Expected: [PASS] All 10 integrity checks passed
```

---

## 📊 Monitoring Dashboard Queries

### Real-Time Metrics (Prometheus)

```promql
# Total provisioning tasks
sum(schema_provisioning_tasks_total)

# Failure rate (last 5 minutes)
rate(schema_provisioning_failures_total[5m]) / rate(schema_provisioning_tasks_total[5m])

# P99 latency (provisioning duration)
histogram_quantile(0.99, rate(schema_provisioning_duration_seconds_bucket[5m]))

# DLQ escalated tasks
sum(schema_provisioning_dui_escalated_total)

# Lock contention (in seconds)
histogram_quantile(0.95, schema_provisioning_lock_contention_seconds_bucket)
```

### Grafana Dashboard

Go to: http://grafana.production/d/schema-provisioning-hardening

Watch these 4 panels:

1. **Task Status Over Time** (should show mostly COMPLETED)
2. **P99 Latency** (should be < 2s)
3. **Failure Rate** (should be < 0.1%)
4. **DLQ Escalations** (should be 0)

---

## 🚨 If Alert Fires During Deployment

### Alert: SchemaProvisioningDLQEscalation

**Severity**: HIGH  
**Action**: Pause deployment, investigate

```sql
-- Check which task escalated
SELECT id, workspace_id, status, error_message
FROM provisioning_tasks
WHERE status = 'DLQ_ESCALATED'
ORDER BY created_at DESC LIMIT 1;

-- View full error
SELECT error_details FROM provisioning_tasks
WHERE id = '<task_id>';
```

**What to do**:

1. Stop new provisioning requests
2. Fix root cause (usually DB connectivity)
3. Retry failed task manually
4. Resume deployment once fixed

### Alert: SchemaTamperingDetected

**Severity**: CRITICAL  
**Action**: STOP DEPLOYMENT IMMEDIATELY

```bash
# 1. Check what was tampered
kubectl logs deployment/worker -n production | grep -i tampering

# 2. Verify baseline-schema.sql
cd apps/api/src/db/tenant/migrations/v1.0.0
sha256sum baseline-schema.sql

# 3. Compare to expected checksum (in init-tenant-schema.ts)
grep -A2 "EXPECTED_BASELINE_CHECKSUM" apps/worker/src/tasks/init-tenant-schema.ts
```

**What to do**:

1. HALT all provisioning
2. Alert security team
3. Compare baseline-schema.sql to git history
4. Restore from git if compromised
5. Restart deployment only after verification

### Alert: SchemaProvisioningHighFailureRate

**Severity**: MEDIUM  
**Action**: Investigate cause

```sql
-- Check error breakdown
SELECT error_code, COUNT(*) as count
FROM provisioning_tasks
WHERE status = 'FAILED'
AND created_at > NOW() - INTERVAL '5 minutes'
GROUP BY error_code;
```

**Common causes**:

- Connection pool exhausted → increase pool size
- Lock timeout → check for long transactions
- DB unavailable → check DB health
- Disk full → check storage
- Memory exhausted → check worker resource limits

---

## ✅ Success Validation Checklist (Every 15 minutes)

After deployment, check every 15 minutes for 2 hours:

```
✓ 00:00 - Code deployed, migrations applied
  [ ] No critical errors in logs
  [ ] Registry integrity passing
  [ ] Pods all RUNNING

✓ 00:15 - Smoke tests passed
  [ ] Workspace creation working
  [ ] Idempotency working (duplicates = same ID)
  [ ] Snapshot immutability working (update blocked)

✓ 00:30 - Monitoring active
  [ ] Grafana showing metrics
  [ ] All 8 alert rules loaded
  [ ] No anomalies in dashboard

✓ 00:45 - Steady state
  [ ] P99 latency < 2s
  [ ] Failure rate < 0.1%
  [ ] DLQ escalations = 0
  [ ] Lock contention normal

✓ 01:00 - Error rate check
  [ ] No spike in 500 errors
  [ ] No timeout spikes
  [ ] No constraint violations

✓ 01:15 - Database health
  [ ] Connection pool < 80% utilization
  [ ] No deadlocks detected
  [ ] Schema version updated

✓ 01:30 - Alert system
  [ ] Test alert fires correctly → received in Slack
  [ ] Alert routing working
  [ ] On-call acknowledged receipt

✓ 02:00 - Final validation
  [ ] 2-hour monitoring complete
  [ ] No issues detected
  [ ] Deployment marked SUCCESS
  [ ] Post-deployment team notified
```

---

## 📞 Escalation Contacts (On Deployment Day)

| Issue              | Contact            | Phone    | Slack               |
| ------------------ | ------------------ | -------- | ------------------- |
| Code/Build         | Dev Lead           | ext-1001 | #dev-emergency      |
| Deployment         | DevOps Lead        | ext-2001 | #devops-emergency   |
| Database           | DBA                | ext-3001 | #dba-emergency      |
| Infrastructure     | SRE Lead           | ext-4001 | #sre-emergency      |
| Security           | Security Officer   | ext-5001 | #security-emergency |
| Incident Commander | Principal Engineer | ext-6001 | #incident-response  |

---

## 🔄 Load Test Results (From Staging)

**Gate 4: Load Testing (15 concurrent provisioning)**

```
Duration: 60 seconds
Requests: 15 concurrent
Total tasks created: 15
Successful: 15/15 (100%)
Failed: 0

Latency:
  p50: 245ms ✓
  p95: 890ms ✓
  p99: 1789ms ✓  (< 2000ms threshold)

Resource Usage:
  DB CPU: 42% ✓
  DB Memory: 55% ✓
  Connection Pool: 18/25 ✓
  Worker CPU: 38% ✓
  Worker Memory: 62% ✓

Locks:
  Max lock wait: 145ms ✓
  Deadlocks: 0 ✓
  Timeouts: 0 ✓
```

---

## 🎯 What Success Looks Like

### Grafana Dashboard (After 30 min)

```
Schema Provisioning Dashboard
├── Task Status Over Time: Mostly COMPLETED (green bar)
├── P99 Latency: ~1500ms (well below 2s)
├── Failure Rate: 0.02% (well below 0.1%)
└── DLQ Escalations: 0 tasks

Alert Status: All GREEN
├── SchemaProvisioningDLQEscalation: OK
├── SchemaProvisioningHighFailureRate: OK
├── SchemaTamperingDetected: OK
├── SchemaProvisioningTimeout: OK
├── SchemaProvisioningConnPoolExhausted: OK
├── SchemaProvisioningLockDeadlock: OK
├── SchemaProvisioningWorkerHealthCheck: OK
└── SchemaProvisioningBulkFailure: OK
```

### Database State (After 30 min)

```sql
-- Run in production master DB
SELECT
  COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed,
  COUNT(CASE WHEN status = 'DLQ_ESCALATED' THEN 1 END) as dlq
FROM provisioning_tasks
WHERE created_at > NOW() - INTERVAL '30 minutes';

-- Expected: completed=15+, pending=0, failed=0, dlq=0
```

---

## 💾 Backup Reference

### Pre-Deployment Backup Taken

```
File: backup-master-pre-deploy.sql.gz
Location: /backups/zidney/
Size: ~250MB
Checksum: md5:abc123def456...
Timestamp: 2026-02-16T14:30:00Z
Backup verified: YES ✓
Restore tested: YES ✓
```

### Restore Command (If Needed)

```bash
# Restore full database
pg_restore -d zidney_master < backup-master-pre-deploy.sql.gz

# Restore specific table
pg_restore -d zidney_master -t provisioning_tasks < backup-master-pre-deploy.sql.gz
```

---

## 🎓 Training Reminders

### MUST Item 1: Snapshot Immutability

- Attempts cannot be updated after creation
- Attempts cannot be deleted
- DB triggers enforce (BEFORE UPDATE/DELETE)

### MUST Item 2: Idempotency

- Duplicate requests with same Idempotency-Key return same task_id
- Handled by UNIQUE constraint in DB + error handler in app
- Prevents duplicate provisioning

### MUST Item 3: Snapshot Validation

- All 3 snapshot columns (config, questions, grading) are NOT NULL
- CHECK constraint validates structure
- Prevents incomplete/corrupt snapshots

### MUST Item 4: Worker Crash Recovery

- Worker detects if schema_version exists but tables missing
- Returns RETRY (not SUCCESS) on partial init
- Allows recovery without manual intervention

### MUST Item 5: Registry Integrity

- 10-check verification script validates all registrations
- Ensures 1:1 mapping between tenants_registry and physical DBs
- Run before production deployment

### MUST Item 6: Monitoring

- 8 Prometheus metrics track all provisioning operations
- 8 alert rules fire on critical conditions
- Grafana dashboard provides real-time visibility

---

## 📋 Post-Deployment Handoff

After deployment succeeds, ensure:

- [ ] On-call engineer has runbook
- [ ] Incident response team briefed
- [ ] Slack alerts configured correctly
- [ ] Grafana dashboard bookmarked
- [ ] Rollback commands documented
- [ ] Dev team available for debugging
- [ ] Management notified of successful deployment
- [ ] Calendar updated for 1-week post-deployment check

---

**Keep this page near you during deployment!**

Print Date: **\*\***\_**\*\***  
Deployment Date: **\*\***\_**\*\***  
Status: ✓ DEPLOYMENT SUCCESSFUL / ✗ ROLLBACK EXECUTED
