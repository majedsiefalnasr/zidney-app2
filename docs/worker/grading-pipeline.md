# Worker Grading Pipeline – Technical Reference

**Version:** 1.0.0  
**Status:** Production Ready  
**Last Updated:** 2026-02-18

---

## Overview

The Worker is a background job processor that handles asynchronous grading operations for submitted exam attempts. It decouples grading from API request cycles, enabling deterministic scoring without blocking UI interactions.

### Architecture

```
Redis Job Queue (sorted set)
    ↓
Worker Consumer Loop
    ├─ Dequeue job (FIFO)
    ├─ Load attempt + snapshots
    ├─ Execute ScoreEngine (deterministic)
    ├─ Persist result + finalize attempt
    └─ Repeat
    ↓
Postgres (grading_jobs table + attempts table)
    ↓
Failed Job? → DLQ (dead_letter_queue table)
```

---

## Job Model

### Job States

| State         | Meaning                       | Action                             |
| ------------- | ----------------------------- | ---------------------------------- |
| `PENDING`     | Queued, awaiting processing   | Worker picks up                    |
| `PROCESSING`  | Worker currently grading      | If 5min+ → potential crash         |
| `COMPLETED`   | Grading finished successfully | Finalize attempt                   |
| `FAILED`      | Grading failed (retry-able)   | Exponential backoff (1s, 10s, 60s) |
| `DEAD_LETTER` | Failed after 5 retries        | Manual intervention (Phase 2)      |

### Job Structure

```typescript
interface GradingJob {
  id: UUID // Job UUID
  workspace_id: UUID // Tenant ID
  attempt_id: UUID // Attempt to grade
  user_id: UUID // Exam taker
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER'
  result_data: JSONB | null // Grading result when COMPLETED
  error_message: string | null // Error reason if FAILED
  error_stack: string | null // Stack trace
  retry_count: integer // Number of retries attempted
  created_at: timestamp // Redis time
  started_at: timestamp | null // Worker pickup time
  completed_at: timestamp | null // Completion time
}
```

---

## Worker Execution Model

### Consumer Loop

```
LOOP forever:
  1. Dequeue job (REDIS BLPOP timeout 30s)
  2. If no job, sleep 1s, continue
  3. Load job details from DB
  4. Check if already COMPLETED (dedup) → Skip
  5. Update status to PROCESSING (with started_at)
  6. TRY:
       a. Load attempt + snapshots
       b. Execute ScoreEngine (deterministic)
       c. Persist result (atomic update)
       d. Update job status → COMPLETED
       e. Log: { correlation_id, attempt_id, score, duration }
     CATCH:
       f. Increment retry_count
       g. If retry_count < 5:
            - Sleep exponential backoff (1s, 10s, 60s, ...)
            - Re-enqueue job
            - Update status → PENDING
          ELSE:
            - Update status → DEAD_LETTER
            - Move to DLQ table
            - Alert monitoring
```

### Configuration

**Environment Variables:**

```bash
# Worker behavior
MAX_CONCURRENT_JOBS=1              # Jobs to process in parallel
PROCESSING_TIMEOUT=30              # Seconds before marking job as stale
REDIS_QUEUE_NAME=grading_jobs     # Redis queue name (sorted set key)

# Retry strategy
RETRY_INTERVALS=[1000, 10000, 60000, 120000, 300000]
# 1s, 10s, 60s, 120s, 5min

# Logging
LOG_LEVEL=info
CORRELATION_ID_TRACKING=true
```

---

## Grading Engine (ScoreEngine)

### Execution Model

The ScoreEngine is **deterministic** – same inputs always produce same outputs.

```typescript
async function gradeAttempt(
  attempt: Attempt,
  questionSnapshot: Question[],
  gradingConfigSnapshot: GradingConfig,
  progressData: ProgressRecord[]
): Promise<GradingResult> {
  const scores = []
  const feedbacks = []
  let totalScore = 0

  for (const question of questionSnapshot) {
    // NEVER read live question data
    // ONLY use snapshot
    const userResponse = findProgressByQuestionId(progressData, question.id)

    const scored = scoreQuestion(
      question, // Frozen snapshot
      userResponse, // User's answer
      gradingConfigSnapshot.scoringAlgorithm
    )

    scores.push({
      question_id: question.id,
      score: scored.points,
      max_score: question.points,
      feedback: scored.feedback,
    })

    totalScore += scored.points
  }

  const passed = totalScore / maxScore >= gradingConfigSnapshot.passThreshold

  return {
    total_score: totalScore,
    max_score: maxScore,
    passed: passed,
    question_scores: scores,
    grading_timestamp: NOW(),
  }
}
```

### Scoring Strategies

| Algorithm        | Logic                                               | Example                           |
| ---------------- | --------------------------------------------------- | --------------------------------- |
| `all_or_nothing` | Full points if correct, 0 otherwise                 | 20 questions × 1 point = 20       |
| `partial_credit` | Points per correct option (MCQ with partial curves) | 4 options, 2 correct → 0.5 points |
| `penalty`        | Negative points for wrong (unused in Phase 1)       | +1 correct, -0.5 wrong            |

### Output: Result Snapshot

```json
{
  "total_score": 18,
  "max_score": 20,
  "passed": true,
  "question_scores": [
    {
      "question_id": "q1",
      "score": 1,
      "max_score": 1,
      "feedback": "Correct!"
    },
    {
      "question_id": "q2",
      "score": 0,
      "max_score": 1,
      "feedback": "Incorrect. Correct answer is B."
    }
  ],
  "grading_timestamp": "2026-02-18T14:30:10Z"
}
```

---

## Failure Handling & Retry Strategy

### Failure Types

#### A. Transient (Retry-able)

- Database connection lost (connection pool exhausted)
- Redis unavailable (job queue inaccessible)
- Temporary network error

**Action:** Retry with exponential backoff

#### B. Permanent (Not Retry-able)

- Invalid attempt ID (attempt was deleted)
- Snapshot corruption (JSONB invalid)
- Algorithm error (bug in ScoreEngine)

**Action:** Move to DLQ, alert

### Retry Backoff

```
Attempt 1: Immediate
Attempt 2: Wait 1 second
Attempt 3: Wait 10 seconds
Attempt 4: Wait 60 seconds
Attempt 5: Wait 120 seconds
Attempt 6: DEAD_LETTER (give up)
```

**Example:**

```
13:30:00 - Job enqueued (PENDING)
13:30:05 - Worker starts grading (PROCESSING)
13:30:12 - Database error → retry_count=1, wait 1s
13:30:13 - Retry, success → COMPLETED
13:30:13 - Attempt finalized, score saved
```

### Dead Letter Queue (DLQ)

When a job fails 5 times:

```
Status: DEAD_LETTER
Error Message: "Database connection timeout after 30s"
Error Stack: (full stack trace)
Retry Count: 5
```

**DLQ Processing:**

- Logged with `correlation_id` for debugging
- Alerted to on-call engineer
- Phase 2: Manual retry via admin console

---

## Observability

### Structured Logging

Every job transitions logged:

```json
{
  "timestamp": "2026-02-18T14:30:10Z",
  "level": "info",
  "service": "worker",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "workspace_slug": "tenant-acme",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440002",
  "attempt_id": "550e8400-e29b-41d4-a716-446655440001",
  "job_id": "550e8400-e29b-41d4-a716-446655440099",
  "event": "attempt_graded",
  "status": "COMPLETED",
  "score": 18,
  "max_score": 20,
  "passed": true,
  "duration_ms": 245,
  "retry_count": 0,
  "message": "Attempt graded successfully"
}
```

### Metrics

**Per-job metrics:**

- `grading_duration_ms` – Time to grade (p50, p99)
- `retry_count` – Retries needed
- `queue_depth` – Jobs pending
- `dlq_size` – Dead letter queue size

**Aggregate metrics:**

- `jobs_completed_per_sec` – Throughput
- `grading_errors_per_min` – Error rate
- `average_grading_duration` – Performance baseline

**Alerts:**

- DLQ size > 10 → Page on-call
- Queue depth > 100 → Warning
- Grading duration > 10sec → Investigate

---

## Graceful Shutdown

### SIGTERM Handling

```typescript
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')

  // 1. Stop accepting new jobs
  stopConsumer()

  // 2. Wait for current job to finish (max 30 seconds)
  if (currentJob) {
    await withTimeout(finishCurrentJob(), 30000)
  }

  // 3. Release database connection
  await db.disconnect()

  // 4. Exit
  process.exit(0)
})
```

**In Kubernetes:**

```bash
# Pod deletion triggers SIGTERM
kubectl delete pod zidney-worker-abc123 --grace-period=30

# Worker finishes current job, then exits
# Next worker picks up remaining jobs from queue
```

---

## Deployment

### Docker Compose (Development)

```yaml
version: '3.9'

services:
  worker:
    build:
      context: apps/worker
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/zidney
      REDIS_URL: redis://redis:6379
      LOG_LEVEL: info
      MAX_CONCURRENT_JOBS: 1
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
```

### Kubernetes (Production)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zidney-worker
spec:
  replicas: 3 # Horizontal scaling
  selector:
    matchLabels:
      app: zidney-worker
  template:
    metadata:
      labels:
        app: zidney-worker
    spec:
      containers:
        - name: worker
          image: zidney-worker:1.0.0
          env:
            - name: DATABASE_URL
              valueFrom: { secretKeyRef: { name: db, key: url } }
            - name: REDIS_URL
              valueFrom: { secretKeyRef: { name: redis, key: url } }
            - name: MAX_CONCURRENT_JOBS
              value: '1'
          resources:
            requests:
              cpu: '1'
              memory: '1Gi'
            limits:
              cpu: '2'
              memory: '2Gi'
          livenessProbe:
            exec:
              command: ['curl', 'http://localhost:3001/health']
            initialDelaySeconds: 10
            periodSeconds: 30
```

### Scaling Recommendations

| Scenario                        | Workers | Throughput    | Latency |
| ------------------------------- | ------- | ------------- | ------- |
| Dev/Test                        | 1       | ~10 jobs/sec  | <500ms  |
| Small (100 concurrent attempts) | 1       | ~10 jobs/sec  | <1s     |
| Medium (1000 concurrent)        | 5       | ~50 jobs/sec  | <5s     |
| Large (10000 concurrent)        | 20      | ~200 jobs/sec | <10s    |

---

## Determinism Verification

### Testing Determinism

```typescript
// Unit test: Same input → Same output 100x
const attempt = createTestAttempt()
const snapshot = captureSnapshot(attempt)
const questions = snapshot.questionSnapshot
const config = snapshot.gradingConfigSnapshot

const results = []
for (let i = 0; i < 100; i++) {
  const result = await scoreEngine.grade(questions, config, userResponses)
  results.push(result.total_score)
}

// All results should be identical
expect(new Set(results).size).toBe(1) // All same
expect(results[0]).toBe(18) // Expected score
```

### Snapshot Immutability Test

```typescript
// Verify snapshot is never modified
const before = JSON.stringify(snapshot)

// This should NOT change snapshot
await scoreEngine.grade(
  snapshot.questionSnapshot,
  snapshot.gradingConfigSnapshot,
  userResponses
)

const after = JSON.stringify(snapshot)
expect(after).toBe(before) // Unchanged
```

---

## Troubleshooting

### Symptom: Job Stuck in PROCESSING

**Cause:** Worker crashed while grading, status never updated

**Detection:**

```sql
SELECT * FROM grading_jobs
WHERE status = 'PROCESSING'
  AND started_at < NOW() - INTERVAL '5 minutes'
```

**Fix:**

```bash
# Restart worker
docker restart zidney-worker

# Or manually reset stuck job (Phase 2 admin console)
UPDATE grading_jobs
SET status = 'PENDING', retry_count = 4
WHERE id = 'stuck-job-uuid'
AND retry_count < 5;
```

### Symptom: DLQ Growing

**Cause:** Systematic failure (DB error, algorithm bug)

**Investigation:**

```bash
# Check error pattern
SELECT error_message, COUNT(*)
FROM grading_jobs
WHERE status = 'DEAD_LETTER'
GROUP BY error_message
ORDER BY count DESC;
```

**Actions:**

1. If "connection timeout" → Scale workers +2
2. If "JSON parse error" → Check snapshot corruption
3. If algorithm error → Fix bug, redeploy, retry DLQ jobs

### Symptom: Slow Grading (>10sec per attempt)

**Cause:** Query performance or algorithm inefficiency

**Profiling:**

```bash
# Check PostgreSQL slow query logs
tail -f /var/log/postgresql/postgres.log | grep "duration"

# Example: Query taking 500ms per attempt × 1000 attempts = 500s
```

**Optimization:**

- Add indexes (already present in schema)
- Archiv old attempts (Phase 2)
- Batch similar questions

---

## Configuration Reference

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/zidney_tenant_1
REDIS_URL=redis://localhost:6379/0

# Optional (defaults shown)
LOG_LEVEL=info
MAX_CONCURRENT_JOBS=1
PROCESSING_TIMEOUT=30
REDIS_QUEUE_NAME=grading_jobs

# Health check
WORKER_HEALTH_PORT=3001
```

### Health Check Endpoint

```
GET http://localhost:3001/health

→ 200 OK
{
  "status": "healthy",
  "uptime": 123456,
  "queue_depth": 42,
  "current_job": "550e8400-e29b-41d4-a716-446655440099",
  "dlq_size": 0
}
```

---

## Performance Baseline

### Per-Attempt Metrics

- **Deterministic grading:** ~50ms per 20-question exam
- **Queue latency:** <100ms from submit to dequeue
- **Retry overhead:** +1-5 seconds per retry

### Aggregate Metrics

- **Single worker:** ~10 jobs/sec, <500ms average latency
- **5 workers:** ~50 jobs/sec
- **20 workers:** ~200 jobs/sec

---

## Version History

| Version | Date       | Changes                                                      |
| ------- | ---------- | ------------------------------------------------------------ |
| 1.0.0   | 2026-02-18 | Initial release (deterministic grading, retry strategy, DLQ) |
| 1.1.0   | (Phase 2)  | Manual essay grading support                                 |

---

**Last Updated:** 2026-02-18  
**Next Review:** 2026-03-18  
**Maintainer:** Zidney Platform Team
