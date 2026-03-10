# DLQ Recovery & Ops Runbook

**Stage**: STAGE_02B_TENANT_BASELINE_SCHEMA  
**Phase**: 3 Step 5 (Integration Tests & Monitoring)  
**Reference**: Task T063

---

## Executive Summary

This runbook provides step-by-step procedures for operations team to investigate and recover schema
initialization failures from the Dead Letter Queue (DLQ).

**Critical Rules**:

- ❌ **NEVER RETRY** on tampering_detected (security incident)
- ❌ **NEVER RETRY** on lock_timeout (suspicious activity)
- ✅ **DO RETRY** on transient failures (database timeout, connection pool exhausted)
- ✅ **INVESTIGATE FIRST** before retry

---

## Understanding DLQ Messages

### Message Structure

```json
{
  "taskId": "task-uuid",
  "taskType": "INIT_TENANT_SCHEMA",
  "workspaceId": "workspace-uuid",
  "payload": {
    "workspace_id": "workspace-uuid",
    "task_id": "task-uuid",
    "schema_version": "1.0.0",
    "schema_file_checksum": "sha256-hash"
  },
  "result": {
    "status": "FAILED|DLQ_ESCALATED",
    "error": "Specific error message",
    "tampering_detected": true|false
  },
  "attemptCount": 1-4,
  "lastError": "Error message",
  "timestamp": "2026-02-16T10:30:00Z",
  "requiresManualReview": true,
  "alertLevel": "CRITICAL|WARN|INFO"
}
```

### Alert Levels Explained

| Level        | Meaning                                    | Action                                      |
| ------------ | ------------------------------------------ | ------------------------------------------- |
| **CRITICAL** | Security incident or data corruption       | ⛔ Page on-call security team, DO NOT RETRY |
| **WARN**     | Operational problem (max retries exceeded) | 🔍 Investigate root cause, then retry       |
| **INFO**     | Transient issue                            | ✅ Safe to retry immediately                |

---

## Recovery Procedures by Alert Level

### CRITICAL: Tampering Detected (Security Incident)

**Trigger Condition**: `result.tampering_detected = true`

**What happened**:

- Schema file checksum doesn't match expected value
- Indicates tampering, file corruption, or deployment error

**Immediate Actions (< 5 min)**:

1. ✋ **DO NOT RETRY** the task
2. 📞 **Page on-call security team immediately**
3. 📋 **Document the incident**:
   - Workspace ID affected
   - When it occurred (timestamp)
   - Error message
   - Checksum mismatch details

**Investigation (within 1 hour)**:

1. Verify schema file integrity on disk:

   ```bash
   sha256sum apps/api/src/db/tenant/migrations/v1.0.0/baseline-schema.sql
   # Compare against: <expected_checksum>
   ```

2. Check for unauthorized file modifications:

   ```bash
   git log -p --follow apps/api/src/db/tenant/migrations/v1.0.0/baseline-schema.sql
   # Verify last change was authorized
   ```

3. Audit task execution logs:
   - Correlation ID: `<dlq_message.correlationId>`
   - Search logs for all operations on this workspace
   - Verify no unauthorized schema modifications

**Resolution Options**:

**Option A: Deployment Error (Most Common)**

- If unauthorized change detected: **ROLLBACK** deployment
- Revert schema file to known-good version
- Trigger new provisioning (fresh task)

**Option B: Data Center Issue**

- If file corruption suspected on disk
- Compare against backup on another node
- If corrupt everywhere: Restore from snapshot + retry

**Option C: Actual Tampering**

- If evidence of intentional modification
- Escalate to security team for forensics
- May require police report (depending on incident severity)

**Recovery Steps** (after investigation complete):

```typescript
// 1. Fix root cause (revert/restore schema file)
// 2. Wait for security team clearance

// 3. Via CLI or dashboard:
POST /admin/dlq/manual-retry
{
  "dlqMessageId": "<message_id>",
  "comment": "Tampering resolved - schema file verified/restored",
  "requiresApproval": true
}

// 4. Task will be requeued with attempt=1
// 5. Monitor task execution closely
```

---

### CRITICAL: Lock Timeout (Suspicious Activity)

**Trigger Condition**: `error.includes('lock_timeout')`

**What happened**:

- Worker couldn't acquire schema_version lock within 5 seconds
- Indicates either:
  - Concurrent migration causing deadlock
  - Hung transaction holding lock
  - Suspicious activity trying to prevent initialization

**Immediate Actions (< 5 min)**:

1. 🕵️ **Investigate concurrent activity**:

   ```bash
   # Query running transactions holding schema_version lock
   psql -c "
     SELECT pid, usename, query, query_start, state
     FROM pg_stat_activity
     WHERE query LIKE '%schema_version%'
   "
   ```

2. 💾 **Check for stuck migrations**:

   ```bash
   # List all running transactions on tenant DB
   psql -d <workspace_db> -c "
     SELECT * FROM pg_stat_activity
     WHERE state != 'idle'
     ORDER BY query_start DESC
   "
   ```

3. 📞 **If hung transaction detected**:
   - Do NOT kill transaction immediately
   - Page database team (might be intentional operation)
   - Wait for business context before killing

**Investigation (within 30 min)**:

- Query audit logs for workspace:

  ```sql
  SELECT * FROM schema_version
  WHERE workspace_id = '<workspace_id>'
  ORDER BY applied_at DESC
  LIMIT 10
  ```

- Check for other failing migrations:
  ```sql
  SELECT COUNT(*) FROM schema_version
  WHERE applied_at IS NULL OR status = 'failed'
  ```

**Resolution Options**:

**Option A: Legitimate Concurrent Operation**

- Another migration in progress (intentional)
- ✅ Safe to retry after current operation completes
- **Wait 2-3 minutes**, then retry

**Option B: Hung Transaction (Stuck)**

- Transaction stuck for > 10 minutes
- ✅ Safe to terminate:
  ```bash
  # Terminate stuck transaction (as last resort)
  psql -d <workspace_db> -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE pid <> pg_backend_pid()
    AND query LIKE '%schema%'
    AND query_start < NOW() - INTERVAL '10 minutes'
  "
  ```
- Then retry provisioning

**Option C: Suspicious/Attack Pattern**

- Multiple recurring lock timeouts on same workspace
- ❌ DO NOT RETRY immediately
- 📞 Page security team (potential DDoS of provisioning)
- Escalate for investigation

**Recovery Steps** (after investigation):

```bash
# After clearing blocking transaction:
curl -X POST \
  /admin/dlq/manual-retry \
  -H "Authorization: Bearer <token>" \
  -d '{
    "dlqMessageId": "<message_id>",
    "comment": "Blocking transaction cleared, safe to retry",
    "waitSeconds": 5
  }'

# Task requeued with attempt=1 + 5 second delay
```

---

### WARN: Max Retries Exceeded

**Trigger Condition**: `attemptCount >= 4` (after 3 retries failed)

**What happened**:

- Transient failures continuing after 3 retry attempts
- Examples: Database connection refused, statement timeout, pool exhausted
- Likely indicates infrastructure/environment problem

**Immediate Actions (< 15 min)**:

1. **Check infrastructure health**:

   ```bash
   # Database connectivity
   psql -c "SELECT 1"

   # Connection pool status
   pgBouncer admin -c "SHOW POOLS"

   # Disk space
   df -h /data

   # Memory
   free -h
   ```

2. **Review error pattern**:
   - Same error occurred 4 times?
   - Or different errors each attempt?
   - Look at last_error in DLQ message

3. **Queue depth**:
   - Check if job queue is saturated:
   ```bash
   # If using Redis
   redis-cli LLEN schema-initialization-queue
   redis-cli LLEN schema-migration-queue
   ```

**Investigation (within 1 hour)**:

| Error Pattern                   | Root Cause                        | Action                                      |
| ------------------------------- | --------------------------------- | ------------------------------------------- |
| `Connection refused` × 4        | Database down or unreachable      | ⏳ Wait for DB to recover, then retry       |
| `Connection pool exhausted` × 4 | High load, pool too small         | 📈 Scale pool size (currently 10/workspace) |
| `Statement timeout` × 4         | Heavy workload, slow schema init  | ⚠️ Review query plans, optimize DDL         |
| `Lock timeout` × 4              | Concurrent mutations (suspicious) | 🔍 Verify no unauthorized migrations        |

**Resolution Steps**:

```bash
# Step 1: Fix root cause (examples)

# If database down: Wait for recovery
systemctl status postgresql
systemctl restart postgresql  # If needed

# If pool exhausted: Scale up (temporarily)
# Edit pgbouncer config: max_client_conn = 1000

# If statement timeout: Analyze why schema init is slow
EXPLAIN ANALYZE <first_DDL_statement>

# Step 2: Retry job
curl -X POST /admin/dlq/manual-retry \
  -d '{"dlqMessageId": "<id>", "comment": "Infra issue resolved"}'

# Step 3: Monitor execution
tail -f logs/worker-$(date +%Y-%m-%d).log | grep task_id
```

---

### INFO: Transient Failure (Safe to Retry)

**Trigger Condition**: `attemptCount < 4` and non-critical error

**What happened**:

- Single-attempt failure that's likely transient
- Examples: Temporary network hiccup, brief database overload
- Should succeed on retry

**Quick Recovery** (Immediate):

```bash
# Approve and retry immediately
curl -X POST /admin/dlq/manual-retry \
  -d '{"dlqMessageId": "<id>"}'
```

No investigation needed (transient assumed to be resolved).

---

## Query DLQ

### Via CLI

```bash
# List all DLQ messages
curl https://api.zidney.com/admin/dlq/messages

# Filter by workspace
curl https://api.zidney.com/admin/dlq/messages?workspace_id=<id>

# Filter by alert level
curl https://api.zidney.com/admin/dlq/messages?alert_level=CRITICAL

# Get details of specific message
curl https://api.zidney.com/admin/dlq/messages/<dlq_message_id>
```

### Via Dashboard

1. Login to Ops Dashboard: https://ops.zidney.com
2. Navigate to: **Provisioning** → **DLQ**
3. Sort by: Alert Level (CRITICAL first)
4. Click message to see details
5. Click "Investigate" button (opens runbook steps)
6. After fixing: Click "Manual Retry"

---

## Manual Retry

### Via Dashboard

1. DLQ Management page
2. Select messages to retry (checkboxes)
3. Click "Retry Selected"
4. Enter comment: "Reason for retry"
5. Click "Confirm"
6. System will requeue with attempt=1

### Via API

```bash
POST /admin/dlq/manual-retry

{
  "dlqMessageId": "abc-123-def",
  "comment": "Database recovered, safe to retry",
  "batchRetry": false
}

# Response
{
  "success": true,
  "taskId": "new-task-uuid",
  "message": "Task requeued with attempt=1"
}
```

### Batch Retry (Multiple Messages)

```bash
POST /admin/dlq/batch-retry

{
  "filter": {
    "workspace_id": "ws-123",
    "alertLevel": "WARN"
  },
  "reason": "Infrastructure scaled up, retrying max-retries failures"
}

# Response
{
  "requeued": 23,
  "failed": 2,
  "details": [...]
}
```

---

## Escalation Path

### Who to Contact

| Situation                  | Team     | Urgency       | Contact                            |
| -------------------------- | -------- | ------------- | ---------------------------------- |
| Tampering detected         | Security | 🚨 IMMEDIATE  | security@zidney.com (page on-call) |
| Lock timeout recurring     | Database | 🔴 HIGH       | dba-oncall@zidney.com              |
| Pool exhaustion            | Platform | 🟠 MEDIUM     | platform-team@zidney.com           |
| Max retries, unclear cause | DevOps   | 🟡 LOW-MEDIUM | devops@zidney.com                  |

### Escalation Email Template

```
Subject: URGENT: Schema Provisioning DLQ - <ALERT_LEVEL>

Workspace: <workspace_id>
DLQ Message ID: <dlq_message_id>
Alert Level: <CRITICAL|WARN|INFO>
Timestamp: <yyyy-mm-dd hh:mm:ss>

Error: <last_error>
Attempts: <attempt_count>/4

Initial Investigation:
- [Finding 1]
- [Finding 2]
- [Finding 3]

Requested Action:
[Describe what you need the team to do]

Attached Logs:
- [Relevant log snippet]
```

---

## Monitoring & Follow-Up

### After Every Manual Retry

1. ✅ Task executing (watch logs):

   ```bash
   kubectl logs -f deployment/worker | grep <task_id>
   ```

2. ⏱️ Set 2-minute timer for completion
3. 📊 If succeeds: Close DLQ message
4. If fails again: Escalate (max 2 retries per ops)

### Weekly DLQ Health Report

Every Monday 9 AM:

- Count CRITICAL events (should be 0)
- Count WARN events (should be < 5)
- Identify patterns
- Email to: platform-leadership@zidney.com

---

## Prevention: Before Incidents Occur

### Pre-Deployment Checklist

- [ ] Schema file checksums match deployment manifest
- [ ] Baseline schema syntax validated (PostgreSQL lint)
- [ ] Trigger functions reviewed for security
- [ ] Connection pool size adequate for expected load
- [ ] Monitoring dashboards healthy
- [ ] On-call rotation confirmed

### Observability Best Practices

1. **Set up alerts** (from monitoring config):
   - High DLQ escalation rate (> 10 in 5 min)
   - Tampering detected (instant)
   - Pool utilization > 90% (warning)

2. **Daily review** (metrics dashboard):
   - Success rate should be ≥ 99%
   - Lock timeouts should be 0
   - Tampering events should be 0

3. **Quarterly load tests**:
   - Verify provisioning handles peak load
   - Test DLQ recovery procedures
   - Validate monitoring alerts

---

## Appendix: Common Errors & Solutions

### Error: "Checksum mismatch"

- Code: `schema_file_corruption`
- Solution: Verify file integrity, check git history, restore from backup
- Action: **Security escalation required**

### Error: "Lock timeout after 5 seconds"

- Code: `lock_timeout_exceeded`
- Solution: Check for concurrent migrations, terminate stuck transactions
- Action: **Investigate before retry**

### Error: "Connection pool at maximum capacity"

- Code: `pool_exhausted`
- Solution: Increase pool size or reduce concurrent load
- Action: **Scale infrastructure**

### Error: "Statement execution exceeded 30 second timeout"

- Code: `statement_timeout`
- Solution: Optimize schema SQL, check query plans
- Action: **Performance tuning**

### Error: "Tenant database does not exist"

- Code: `database_not_found`
- Solution: Pre-create database before provisioning
- Action: **Fix provisioning order**

---

## References

- **Monitoring Dashboard**: https://grafana.zidney.com/d/provisioning-main
- **Prometheus Metrics**: http://prometheus:9090
- **Schema Initialization Spec**: [spec.md](../spec.md)
- **Worker Queue Config**: [task-configs.ts](../../apps/worker/src/config/task-configs.ts)
- **API Endpoint**: [schema.controller.ts](../../apps/api/src/modules/schema/schema.controller.ts)

---

## Approval & Sign-Off

**Document Version**: 1.0  
**Last Updated**: 2026-02-16  
**Approved By**: Platform Leadership  
**Reviewed By**: Security, Database, DevOps Teams

**Next Review**: 2026-05-16 (Quarterly)
