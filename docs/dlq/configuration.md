# Dead Letter Queue (DLQ) Configuration Guide

**STAGE 08 - Rate Limiting & Security Baseline**

## Overview

The Dead Letter Queue (DLQ) collects jobs that fail permanently after exhausting all retry attempts.
Manual inspection and recovery is possible through the admin API.

## How Jobs End Up in DLQ

```
Job Enqueued
    ↓
[Attempt 1] → Fails with retryable error (network timeout, DB lock)
    ↓
[Exponential Backoff] Wait 1 second
    ↓
[Attempt 2] → Fails with retryable error
    ↓
[Exponential Backoff] Wait 2 seconds
    ↓
[Attempt 3] → Fails with retryable error
    ↓
[Exponential Backoff] Wait 4 seconds
    ↓
[Final Attempt] → Fails or Max retries exhausted
    ↓
MOVE TO DLQ ← Record created with full error context
    ↓
Alert sent to ops
Awaiting manual intervention
```

## DLQ Database Schema

### dead_letter_queue Table

```sql
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job identifiers
  job_id UUID NOT NULL UNIQUE,
  job_type VARCHAR(50) NOT NULL,

  -- Context
  workspace_id UUID NOT NULL,
  workspace_slug VARCHAR(255) NOT NULL,
  attempt_id UUID NOT NULL,
  user_id UUID NOT NULL,
  correlation_id UUID NOT NULL,

  -- Original job data
  original_payload JSONB NOT NULL,

  -- Error information
  error_message TEXT NOT NULL,
  error_stack TEXT,

  -- Retry information
  retry_count INT NOT NULL,
  max_retries INT NOT NULL DEFAULT 3,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  first_failure_at TIMESTAMP NOT NULL DEFAULT NOW(),
  moved_to_dlq_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Indexes for queries
  CONSTRAINT workspace_on_attempt UNIQUE (workspace_id, attempt_id),
  CONSTRAINT job_type_valid CHECK (job_type IN ('grade_attempt', 'email_notification', 'webhook_delivery'))
);

CREATE INDEX idx_dlq_workspace_created
  ON dead_letter_queue(workspace_id, created_at DESC);
CREATE INDEX idx_dlq_job_type
  ON dead_letter_queue(job_type);
CREATE INDEX idx_dlq_attempt_id
  ON dead_letter_queue(attempt_id);
CREATE INDEX idx_dlq_moved_to_dlq
  ON dead_letter_queue(moved_to_dlq_at DESC);
```

### dlq_resolutions Table

```sql
CREATE TABLE dlq_resolutions (
  id SERIAL PRIMARY KEY,

  -- Reference to DLQ job
  dlq_id UUID NOT NULL REFERENCES dead_letter_queue(id) ON DELETE CASCADE,

  -- Resolution metadata
  resolved_by UUID NOT NULL, -- Admin user ID
  resolution_action VARCHAR(50) NOT NULL,
  notes TEXT,

  -- Timestamp
  resolved_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT action_valid CHECK (resolution_action IN ('retry', 'discard', 'escalate'))
);

CREATE INDEX idx_resolutions_dlq_id ON dlq_resolutions(dlq_id);
CREATE INDEX idx_resolutions_resolved_at ON dlq_resolutions(resolved_at DESC);
```

## Admin API Endpoints

### 1. Inspect DLQ Jobs

**GET /admin/workspace/{workspaceId}/dlq**

```bash
curl -H "Authorization: Bearer $JWT" \
  https://api.zidney.example.com/admin/workspace/ws-123/dlq?limit=20&offset=0

# Response:
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "dlq-456",
        "job_type": "grade_attempt",
        "attempt_id": "attempt-789",
        "user_id": "user-456",
        "error_message": "Database connection timeout",
        "retry_count": 3,
        "max_retries": 3,
        "created_at": "2026-02-19T10:30:00Z",
        "moved_to_dlq_at": "2026-02-19T10:31:45Z",
        "original_payload": {
          "exam_id": "exam-123",
          "student_answers": [...]
        }
      }
    ],
    "total": 47,
    "limit": 20,
    "offset": 0
  }
}
```

**Query Parameters:**

- `limit` (default: 100, max: 1000) - Results per page
- `offset` (default: 0) - Pagination offset
- `job_type` (optional) - Filter by job type
- `sort_by` (default: "moved_to_dlq_at") - Sort order

### 2. Manually Retry a DLQ Job

**POST /admin/workspace/{workspaceId}/dlq/{dlqId}/retry**

```bash
curl -X POST \
  -H "Authorization: Bearer $JWT" \
  -H "X-CSRF-TOKEN: $CSRF_TOKEN" \
  https://api.zidney.example.com/admin/workspace/ws-123/dlq/dlq-456/retry

# Response:
{
  "success": true,
  "data": {
    "job_id": "job-789-retry",
    "status": "enqueued",
    "retry_count": 4,
    "message": "Job re-enqueued for processing"
  }
}
```

**What happens:**

1. Fetch job from DLQ
2. Create new job with retry_count = 0
3. Re-enqueue to job queue
4. Record resolution action in dlq_resolutions table
5. Update DLQ entry (optional: mark as resolved)
6. Return new job ID for tracking
7. Log action with admin user_id

### 3. Discard a DLQ Job

**POST /admin/workspace/{workspaceId}/dlq/{dlqId}/discard**

```bash
curl -X POST \
  -H "Authorization: Bearer $JWT" \
  -H "X-CSRF-TOKEN: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Manual investigation shows invalid attempt ID - likely data inconsistency"
  }' \
  https://api.zidney.example.com/admin/workspace/ws-123/dlq/dlq-456/discard

# Response:
{
  "success": true,
  "data": {
    "dlq_id": "dlq-456",
    "resolution": "discarded",
    "message": "Job permanently discarded"
  }
}
```

**What happens:**

1. Create dlq_resolutions record with action='discard'
2. Mark DLQ entry as resolved (optional)
3. Update student's attempt status to NOT_GRADED (after manual review)
4. Log discardal with reasoning
5. Alert monitoring system

## Automatic Monitoring

### DLQ Monitor Cron Job

Runs every 5 minutes:

```
Every 5 min
    ↓
Query DLQ jobs from last hour
    ↓
Group by workspace, job_type
    ↓
If count > threshold (10 jobs):
    ├─ Alert to ops channel (Slack/PagerDuty)
    └─ Include link to admin dashboard
```

### Alert Example

```
🚨 HIGH: DLQ Spike Detected
Workspace: Acme University (ws-123)
Job Type: grade_attempt
Count: 27 jobs in last 1 hour
Threshold: 10 jobs

Last Error: "Database connection timeout"
Most Recent: 2026-02-19T10:30:00Z

Action: Review DB health, check rate limits
Admin Panel: /admin/workspace/ws-123/dlq
```

### Metrics Collected

```
dlq_jobs_total{workspace_slug,job_type}
dlq_jobs_by_error_type{workspace_slug,error_type}
dlq_resolution_time_seconds{resolution_action}
dlq_retry_success_rate{job_type}
```

## Troubleshooting Common Patterns

### Pattern 1: Consistent Database Timeouts

**Symptoms:**

```
Error message (repeated): "Database connection timeout after 30s"
Retry count: 3/3 on all jobs
Time of occurrence: 10:30-11:00 UTC
```

**Diagnosis:**

1. Check DB connection pool exhaustion
2. Review long-running queries during that window
3. Check if DB reached max connections

**Recovery:**

```bash
# On database:
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

# If too many connections:
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE query LIKE '%SELECT%' AND query_start < NOW() - INTERVAL '5 minutes';

# Then retry DLQ jobs via admin API
```

### Pattern 2: Invalid Attempt IDs

**Symptoms:**

```
Error message: "Attempt not found (id: attempt-abc-123)"
Job payload exists in original_payload
But attempt record doesn't exist in DB
```

**Diagnosis:**

- Likely data inconsistency or race condition
- Attempt record deleted before grading completed
- Possible Kraken exam creation issue

**Recovery:**

```bash
# Option 1: Discard (if attempt truly doesn't exist)
curl -X POST /admin/workspace/ws-123/dlq/dlq-456/discard \
  -d '{"notes": "Attempt record not found in DB - likely purged"}'

# Option 2: Retry if you'll recreate the attempt
# (Requires manual intervention to restore attempt)
```

### Pattern 3: Webhook Delivery Failures

**Symptoms:**

```
Job type: webhook_delivery
Error message: "HTTP 503: Service Unavailable"
Affects: All webhooks to external_system_x
```

**Diagnosis:**

- External system down
- Network connectivity issue
- Webhook endpoint invalid (4xx errors shouldn't reach DLQ)

**Recovery:**

```bash
# Check endpoint health
curl -v https://external.example.com/webhook/endpoint

# Once resolved, retry all DLQ webhook jobs for that endpoint:
# (Requires batch retry API - future enhancement)
```

## Best Practices

### 1. Regular Review Schedule

- **Daily:** Check DLQ count during business hours
- **Weekly:** Review error patterns and root causes
- **Monthly:** Archive resolved DLQ entries

### 2. Alert Response Process

1. **Immediate (< 5 min):**
   - Check alert context
   - Determine if systematic issue or one-off

2. **Investigation (< 30 min):**
   - Review error messages and payloads
   - Check system health (DB, Redis, services)

3. **Resolution (< 2 hours):**
   - Fix underlying cause
   - Retry affected jobs
   - Verify grading completed

### 3. Retention Policy

```
DLQ entries retention:
- Unresolved: Keep indefinitely (pending review)
- Resolved (discarded): Archive after 30 days
- Resolved (retried successfully): Delete after 7 days
```

## Configuration

### Environment Variables

```bash
# DLQ Monitoring
DLQ_MONITOR_INTERVAL_SECONDS=300          # Run every 5 min
DLQ_ALERT_THRESHOLD_COUNT=10              # Alert if > 10 jobs
DLQ_ALERT_CHANNEL=slack                   # Alert destination
DLQ_ALERT_WEBHOOK_URL=https://...         # Slack webhook

# Job Retry
JOB_MAX_RETRIES=3
JOB_BACKOFF_BASE_SECONDS=1
JOB_BACKOFF_MAX_SECONDS=30

# DLQ Retention
DLQ_RETENTION_DAYS_UNRESOLVED=0            # Keep forever
DLQ_RETENTION_DAYS_RESOLVED=30
```

## Example Workflows

### Workflow 1: Investigation & Retry

```bash
#!/bin/bash

WORKSPACE_ID="ws-123"
ADMIN_JWT="$(get_jwt_for_admin)"
CSRF_TOKEN="$(get_csrf_token)"

# Step 1: List DLQ jobs
curl -H "Authorization: Bearer $ADMIN_JWT" \
  "https://api.zidney.example.com/admin/workspace/$WORKSPACE_ID/dlq?limit=100" | jq .

# Step 2: Investigate specific job
DLQ_ID="dlq-456"
curl -H "Authorization: Bearer $ADMIN_JWT" \
  "https://api.zidney.example.com/admin/workspace/$WORKSPACE_ID/dlq/$DLQ_ID" | jq .data.original_payload

# Step 3: Fix underlying issue (example: restart Redis)
systemctl restart redis

# Step 4: Retry the job
curl -X POST \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "X-CSRF-TOKEN: $CSRF_TOKEN" \
  "https://api.zidney.example.com/admin/workspace/$WORKSPACE_ID/dlq/$DLQ_ID/retry"

# Step 5: Verify grading completed
curl -H "Authorization: Bearer $STUDENT_JWT" \
  "https://api.zidney.example.com/attempt/attempt-789/result"
```

### Workflow 2: Bulk Operations

```bash
# Future enhancement: Bulk retry/discard API
# For now, use scripts to call single-job endpoints in loop

for dlq_id in $(get_dlq_ids_by_error_type "timeout"); do
  curl -X POST /admin/workspace/$WS_ID/dlq/$dlq_id/retry \
    -H "Authorization: Bearer $JWT" \
    -H "X-CSRF-TOKEN: $CSRF"
  sleep 1  # Rate limit ourselves
done
```

## References

- [Rate Limiting Architecture](./rate-limiting/architecture.md)
- [Worker Process Documentation](../worker/README.md)
- [Monitoring & Observability](../02_DEVOPS_DEPLOYMENT/06_MONITORING_AND_HEALTHCHECKS.md)
