# Attempt Engine API – Technical Reference

**Version:** 1.0.0  
**Status:** Production Ready  
**Last Updated:** 2026-02-18

---

## Overview

The Attempt Engine API is the core exam and assignment attempt management system for Zidney. It provides database-per-tenant isolation, snapshot-based immutability, and pessimistic locking for safe concurrent exam environments.

### Architecture at a Glance

```
Frontoffice (Vue 3)
    ↓
API Layer (Hono)
    ├─ Correlation ID
    ├─ Tenant Resolver (database-per-tenant)
    ├─ License Validator (SOFT_LOCKED blocks submit)
    ├─ Auth Middleware (JWT)
    └─ Routes
        ├─ POST /attempts (create with snapshot)
        ├─ PATCH /progress (autosave, idempotent)
        ├─ POST /submit (pessimistic lock)
        └─ GET /result (poll async grading)
    ↓
Postgres (Tenant DB)
    ├─ attempts (core)
    ├─ attempt_progress (real-time)
    ├─ submission_idempotency_keys (dedup)
    └─ grading_jobs (async queue)
    ↓
Worker (Bun)
    ├─ Job Consumer (dequeue)
    ├─ Score Engine (deterministic)
    ├─ Result Persist (atomic)
    └─ DLQ Handler (retry strategy)
```

---

## Core Concepts

### 1. Attempt

An **attempt** is a single user's engagement with an exam or assignment from start to finish.

**States:**

- `IN_PROGRESS` – User is taking the exam
- `SUBMITTED` – User clicked "Submit", job enqueued for grading
- `FINALIZED` – Grading complete, score available
- `EXPIRED` – Time limit exceeded without submission
- `ABORTED` – Manually stopped (Phase 2)

**Key Properties:**

- `id` – UUID, immutable
- `workspace_id` – Tenant identifier (database isolation)
- `user_id` – Exam taker
- `exam_id` – Reference to exam configuration
- `status` – Current state
- `attempt_mode` – RELAX (unlimited), CHRONO (timed), RUSH (ultra-fast)
- `score` – Final score (null until finalized)
- `question_snapshot` – Frozen question list at creation
- `grading_config_snapshot` – Frozen grading rules at creation

### 2. Snapshot Integrity

**Why Snapshots?**

If exam configuration could change during grading, different users taking the same exam at nearly the same time could get different scores for identical responses. This breaks fairness and traceability.

**Snapshot Guarantee:**

When an attempt is created:

1. Current exam configuration is captured
2. All question details frozen (text, options, correct answer, point value)
3. All grading rules frozen (pass threshold, scoring algorithm)
4. Snapshot stored in JSONB with attempt
5. **During grading, worker only reads snapshot, never live config**

**Verification:**

```sql
-- Correct: Worker only reads from snapshot
SELECT grading_config_snapshot FROM attempts WHERE id = $1
-- Returns: {"pass_threshold": 0.6, "scoring": "all-or-nothing"}

-- Wrong: Worker reading live config
SELECT * FROM grading_configs WHERE exam_id = $1
-- This would be a bug!
```

### 3. Attempt Mode (Delivery Type)

| Mode     | Time Limit         | Use Case              | API Behavior                  |
| -------- | ------------------ | --------------------- | ----------------------------- |
| `RELAX`  | Unlimited          | Assignments, practice | No time validation            |
| `CHRONO` | Exam duration      | Timed exams           | Server enforces duration      |
| `RUSH`   | Half exam duration | Speed tests, finals   | Server enforces half duration |

### 4. Server-Authoritative Time

**Trust Model:**

- Client clock cannot be trusted
- Server clock (PostgreSQL NOW()) is authoritative
- All timestamps use NOW()
- Time limit validation: `(NOW() - created_at) > duration`

**Example:**

```typescript
// ✅ Correct
const remainingTime = examDuration - (now() - attempt.created_at)

// ❌ Wrong (data leak, cheating vector)
const remainingTime = examDuration - (client_now - client_started_at)
```

### 5. Submission Workflow & Idempotency

**Flow:**

```
1. POST /submit
   └─ Pessimistic lock (FOR UPDATE NOWAIT with 5s timeout)
   └─ If locked, return 409 CONFLICT
   └─ If available, mark as SUBMITTED
   └─ Enqueue grading job
   └─ Return 202 ACCEPTED + job_id

2. Retry logic (client-side)
   └─ 409? Retry with backoff (100ms, 200ms, 400ms)
   └─ After 3 retries, wait 5s

3. GET /result (polling)
   └─ Job still running? Return 202 with Retry-After
   └─ Job complete? Return 200 with results

4. Worker finalizes
   └─ Dequeue job
   └─ Grade using snapshot only
   └─ Atomic update: status=FINALIZED, score=X, result_snapshot=...
```

**Why Idempotency?**

If network fails after submission but before response, client doesn't know if it succeeded. Client retries with same idempotency key. Server returns same result, no double-grading.

**Three-Layer Idempotency:**

1. **Redis cache** – Fast dedup for same key within 30min
2. **DB index** – UNIQUE constraint on (attempt_id, idempotency_key)
3. **Status check** – If status=SUBMITTED, reject duplicate

---

## API Endpoints

### Health Check

```
GET /health
→ 200 OK
{
  "status": "healthy",
  "uptime": 123456,
  "timestamp": "2026-02-18T14:30:00Z",
  "version": "1.0.0"
}
```

### Create Attempt

```
POST /api/v1/workspaces/{workspace_slug}/attempts

Headers:
  Authorization: Bearer {JWT}
  X-Correlation-ID: {uuid} (optional)

Body:
{
  "exam_id": "550e8400-e29b-41d4-a716-446655440000",
  "attempt_mode": "CHRONO"
}

→ 201 CREATED
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440002",
  "user_id": "550e8400-e29b-41d4-a716-446655440003",
  "exam_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "IN_PROGRESS",
  "attempt_mode": "CHRONO",
  "score": null,
  "passed": null,
  "question_snapshot": [
    {
      "id": "q1",
      "type": "MCQ",
      "question": "What is 2+2?",
      "options": ["3", "4", "5"],
      "correct": "4",
      "points": 1
    }
  ],
  "grading_config_snapshot": {
    "pass_threshold": 0.6,
    "scoring_type": "all-or-nothing"
  },
  "created_at": "2026-02-18T14:30:00Z"
}
```

### Update Progress (Autosave)

```
PATCH /api/v1/workspaces/{workspace_slug}/attempts/{attempt_id}/progress

Headers:
  Authorization: Bearer {JWT}
  X-Idempotency-Key: {uuid} (optional)

Body:
{
  "question_index": 0,
  "response_data": {
    "selected": "4"
  },
  "elapsed_time": 5000
}

→ 200 OK
{
  "attempt_id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "IN_PROGRESS",
  "last_saved_question": 0,
  "elapsed_time": 5000,
  "timestamp": "2026-02-18T14:30:05Z"
}
```

**Safe to retry** – Idempotency key prevents duplicate saves.

### Submit Attempt

```
POST /api/v1/workspaces/{workspace_slug}/attempts/{attempt_id}/submit

Headers:
  Authorization: Bearer {JWT}
  X-Idempotency-Key: {uuid} (optional)

Body: {}

→ 202 ACCEPTED
{
  "attempt_id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "SUBMITTED",
  "job_id": "550e8400-e29b-41d4-a716-446655440099",
  "poll_url": "/api/v1/workspaces/tenant-acme/attempts/550e8400-e29b-41d4-a716-446655440001/result",
  "result_eta": 5
}
```

**On Conflict (409):**

```
→ 409 CONFLICT
Retry with backoff:
  Wait 100ms → Retry
  If 409 again → Wait 200ms → Retry
  If 409 again → Wait 400ms → Retry
  If 409 again → Wait 5s → Retry
```

### Poll Grading Result

```
GET /api/v1/workspaces/{workspace_slug}/attempts/{attempt_id}/result

Headers:
  Authorization: Bearer {JWT}

→ 202 ACCEPTED (still processing)
{
  "attempt_id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "SUBMITTED",
  "progress": {
    "processed_questions": 2,
    "total_questions": 20
  },
  "result_eta": 3
}

Retry-After: 2 (seconds)
```

**When Complete:**

```
→ 200 OK
{
  "attempt_id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "FINALIZED",
  "score": 18,
  "passed": true,
  "result_snapshot": {
    "total_score": 18,
    "max_score": 20,
    "question_scores": [
      {
        "question_id": "q1",
        "score": 1,
        "max_score": 1,
        "feedback": "Correct!"
      }
    ],
    "grading_timestamp": "2026-02-18T14:30:10Z"
  },
  "finalized_at": "2026-02-18T14:30:10Z"
}
```

---

## Error Handling

### Error Response Format (RFC 7807)

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

### Common Error Codes

| Code                        | HTTP | Meaning                                    | Action                |
| --------------------------- | ---- | ------------------------------------------ | --------------------- |
| `INVALID_EXAM_ID`           | 400  | Exam UUID format invalid                   | Fix input             |
| `EXAM_NOT_FOUND`            | 404  | Exam doesn't exist                         | Verify exam_id        |
| `ATTEMPT_NOT_FOUND`         | 404  | Attempt doesn't exist                      | Verify attempt_id     |
| `ATTEMPT_ALREADY_SUBMITTED` | 409  | Already submitted                          | Check status first    |
| `ATTEMPT_LOCKED`            | 409  | Concurrent submit (lock timeout)           | Retry with backoff    |
| `SOFT_LOCKED`               | 423  | License paused (create OK, submit blocked) | Wait for reactivation |
| `SCHEMA_MISMATCH`           | 426  | Schema version incompatible                | Upgrade to v1.1.0+    |
| `UNAUTHORIZED`              | 401  | Missing/invalid JWT                        | Provide valid token   |
| `FORBIDDEN`                 | 403  | User lacks permission                      | Request access        |

---

## Rate Limiting

| Endpoint          | Limit      | Scope         | Action                       |
| ----------------- | ---------- | ------------- | ---------------------------- |
| `POST /attempts`  | 5/minute   | Per user      | Return 429 Too Many Requests |
| `PATCH /progress` | 100/minute | Per attempt   | Return 429                   |
| `POST /submit`    | 1/attempt  | Per attempt   | Idempotent (safe to retry)   |
| `GET /result`     | Unlimited  | Poll-friendly | No limit                     |

---

## Middleware Stack (Required Order)

Every workspace-bound route must pass through:

1. **Correlation ID** – Generate or pass through UUID
2. **Tenant Resolver** – Extract workspace_slug, resolve to workspace_id
3. **License Validator** – Check license status (ACTIVE | SOFT_LOCKED | ARCHIVED)
4. **Authentication** – Verify JWT, extract user_id
5. **Authorization** – Verify user can access attempt
6. **Route Handler** – Execute business logic

**Example (Pseudocode):**

```typescript
app.post(
  '/workspaces/:workspace_slug/attempts',
  correlationIdMiddleware,
  tenantResolverMiddleware,
  licenseValidatorMiddleware, // ← Cannot submit if SOFT_LOCKED
  authMiddleware,
  authorizationMiddleware,
  createAttemptHandler // ← Route logic
)
```

---

## Webhooks (Future – Phase 2)

Planned webhook events:

- `attempt.created`
- `attempt.submitted`
- `attempt.graded` (with score)
- `attempt.expired`
- `attempt.aborted`

(Not yet implemented – Phase 2)

---

## Observability

### Structured Logging

All requests logged with:

```json
{
  "timestamp": "2026-02-18T14:30:00Z",
  "level": "info",
  "service": "api",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "workspace_slug": "tenant-acme",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440002",
  "user_id": "550e8400-e29b-41d4-a716-446655440003",
  "method": "POST",
  "path": "/attempts",
  "status": 201,
  "duration_ms": 45,
  "message": "Attempt created successfully"
}
```

### Metrics

- Attempt creation rate (per second)
- Progress save rate
- Submit success rate (%)
- Lock timeout frequency
- Grading latency (p50, p99)
- DLQ queue depth

---

## Client Integration

### Recommended Flow

```typescript
// 1. Create attempt
const createRes = await fetch('/api/v1/attempts', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'X-Correlation-ID': generateUUID(),
  },
  body: JSON.stringify({
    exam_id: '...',
    attempt_mode: 'CHRONO',
  }),
})
const { id: attemptId } = await createRes.json()

// 2. Show exam UI, autosave
setInterval(() => {
  fetch(`/api/v1/attempts/${attemptId}/progress`, {
    method: 'PATCH',
    body: JSON.stringify({
      question_index: currentQuestion,
      response_data: userResponse,
    }),
  })
}, 30000) // Every 30 seconds

// 3. On submit, retry with backoff
async function submitWithRetry(attemptId) {
  const delays = [100, 200, 400]
  for (let i = 0; i < delays.length; i++) {
    try {
      return await fetch(`/api/v1/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': generateUUID(),
        },
      })
    } catch (e) {
      if (e.status === 409) {
        await sleep(delays[i])
        continue
      }
      throw e
    }
  }
}

// 4. Poll result
async function pollResult(attemptId) {
  const maxAttempts = 60
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`/api/v1/attempts/${attemptId}/result`)
    if (res.status === 200) {
      return await res.json()
    }
    const retryAfter = res.headers.get('Retry-After') || 2
    await sleep(parseInt(retryAfter) * 1000)
  }
  throw new Error('Grading timeout')
}
```

---

## Compliance

### Constitutional Adherence

- ✅ **ADR-0001** – Database-per-tenant: workspace_id on every query
- ✅ **ADR-0002** – Snapshot immutability: Worker reads snapshot only
- ✅ **ADR-0006** – Server-auth time: NOW() exclusively
- ✅ **ADR-0007** – Version compatibility: validated at create/submit/grade

### Security

- ✅ SQL injection: All queries parameterized
- ✅ PII exposure: No sensitive data in error responses
- ✅ Secrets: No secrets in code (Docker secrets in production)
- ✅ CORS: Configured per deployment needs
- ✅ CSRF: JWT-based (no cookie-based sessions)

---

## Version Compatibility

**Current:** 1.0.0  
**Supported API versions:** 1.x  
**Deprecated:** None

**Breaking Changes:** None (new feature, Phase 1 only)

**Upgrade Path:**

v1.0.0 → v1.1.0 (Phase D2 – add manual essay grading)

- New tables: essay_responses, manual_grades
- Existing endpoints unchanged
- Optional new endpoint: POST /essays/{essay_id}/grade

---

## Support & Escalation

- **Documentation:** This file + OpenAPI 3.0 spec
- **Troubleshooting:** See [TROUBLESHOOTING_STAGE06.md](../TROUBLESHOOTING_STAGE06.md)
- **Runbooks:** See [RUNBOOKS_STAGE06.md](../RUNBOOKS_STAGE06.md)
- **Deployment:** See [DEPLOYMENT_GUIDE_STAGE06.md](../DEPLOYMENT_GUIDE_STAGE06.md)
- **Performance:** See [PERFORMANCE_BENCHMARKS_STAGE06.md](../PERFORMANCE_BENCHMARKS_STAGE06.md)

---

**Last Updated:** 2026-02-18  
**Next Review:** 2026-03-18  
**Maintainer:** Zidney Platform Team
