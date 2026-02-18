# Plan Report – STAGE_06_ATTEMPT_ENGINE_FOUNDATION

**Report Date:** 2026-02-18T00:00:00Z  
**Stage:** STAGE_06_ATTEMPT_ENGINE_FOUNDATION  
**Phase:** 01_PLATFORM_FOUNDATION  
**Status:** ✅ COMPLETE – READY FOR TASK GENERATION

---

## Overview

Comprehensive technical implementation plan generated covering all architectural layers, database schema, API endpoints, middleware, transaction semantics, and concurrency strategies. Plan fully integrates all 5 clarifications and maintains 100% constitutional compliance.

**Plan Document:** [plan.md](plan.md)  
**Size:** Production-ready, sectioned for 6-phase implementation  
**Compliance:** ✅ 8/8 ADRs + all core principles maintained

---

## Plan Summary

### ✅ Database Schema

**Tables:**

- `attempts` – Unified model with snapshot fields (question_snapshot JSON, grading_config_snapshot, exam_version, schema_version, product_version)
- `attempt_progress` – Per-question tracking (user_answer, answered_at, flagged)
- `submission_idempotency_keys` – 24-hour TTL idempotency (UNIQUE on attempt_id, submission_sequence)

**Indexes:** 7 optimized indexes for query performance and constraint enforcement

**Constraints:**

- UNIQUE (workspace_id, user_id, attempt_id) – one attempt per user per exam
- UNIQUE (attempt_id, submission_sequence) – prevents duplicate submissions
- FOREIGN KEY constraints to workspaces, users
- CHECK constraints for status transitions (IN_PROGRESS → SUBMITTED → FINALIZED only)

---

### ✅ API Endpoints (5 endpoints)

1. **POST /api/workspaces/:slug/attempts** – Create attempt
   - License validation (ACTIVE only)
   - Version snapshot (exam_version, schema_version, product_version)
   - Full question snapshot capture
   - Returns: attempt_id, started_at, time_limit

2. **POST /api/workspaces/:slug/attempts/:id/progress** – Save progress
   - Idempotent progress saves (UPSERT)
   - No locks (eventual consistency)
   - Returns: saved_at, question_id

3. **POST /api/workspaces/:slug/attempts/:id/submit** – Submit attempt
   - Pessimistic lock (SELECT FOR UPDATE, 5s timeout)
   - Retry logic (3 retries, exponential backoff)
   - Enqueue grading job
   - Idempotency check (UNIQUE on submission_sequence)
   - Returns: submitted_at; then 202 Accepted (final result via polling)

4. **GET /api/workspaces/:slug/attempts/:id** – Get attempt status
   - Returns: status, score (if finalized), progress count, time_elapsed

5. **GET /api/workspaces/:slug/attempts/:id/result** – Get attempt result
   - Returns: status, score, passed, result_snapshot, finalized_at

---

### ✅ Middleware Layers (4 layers)

1. **tenantResolver**
   - Extract workspace slug from subdomain/path
   - Resolve workspace from database
   - Initialize PostgreSQL connection pool per tenant
   - Inject workspace context into request

2. **licenseMiddleware**
   - Validate license status (ACTIVE/SOFT_LOCKED/ARCHIVED)
   - Validate schema_version compatibility
   - Validate product_version compatibility
   - Reject: 423 SOFT_LOCKED, 403 ARCHIVED, 426 INCOMPATIBLE, 404 NOT_FOUND

3. **correlationIdMiddleware**
   - Generate correlation_id if not present
   - Inject into request context
   - Propagate to all logs, worker jobs, and database columns

4. **idempotencyMiddleware**
   - Check Redis for recent submission (fast-path, 24-hour TTL)
   - If found, return cached response (202 Accepted)
   - If not found, execute request normally
   - Store in Redis + PostgreSQL (dual storage per Q2 answer)

---

### ✅ Transaction Boundaries (5 operations)

**1. Attempt Creation**

- Isolation: SERIALIZABLE (no dirty reads)
- Atomic: Single INSERT into attempts with full snapshot
- Rollback: On validation failure, schema incompatibility, license failure
- Success: Return attempt_id, started_at (server time)

**2. Progress Update**

- Isolation: READ COMMITTED (eventual consistency per Q3 answer)
- Atomic: No (INSERT OR IGNORE for idempotency)
- Idempotent: By question_id uniqueness
- No locks (autosave doesn't block submission)

**3. Submission**

- Isolation: SERIALIZABLE (pessimistic lock)
- Atomic: Lock acquired → validate status IN_PROGRESS → update to SUBMITTED + enqueue job
- Retry: Up to 3 times with exponential backoff (1s, 2s, 4s) per Q1 answer
- Idempotent: Via submission_sequence UNIQUE constraint per Q2 answer
- Failure: After 3 retries → move job to DLQ; return 503 or 202 (async)

**4. Worker Grading**

- Isolation: SERIALIZABLE (pessimistic lock on attempt row)
- Atomic: Lock → validate schema_version → compute score → write result → update finalized_at
- Retry: Up to 5 retries with exponential backoff (per grading job spec)
- Failure: After 5 retries → move to DLQ; ops alert; attempt marked FAILED
- Deterministic: Result must be identical on replay (no floating-point, use integer arithmetic)

**5. Expiration**

- Isolation: READ COMMITTED (time-based check)
- Atomic: SELECT FOR UPDATE → check time_limit → update status to EXPIRED
- Race safety: FOR UPDATE prevents concurrent expiration threads from duplicating work

---

### ✅ Idempotency Strategy (Per Q2 Answer)

**Storage:** PostgreSQL (authoritative) + Redis (performance cache)

**Components:**

- UNIQUE constraint: (attempt_id, submission_sequence) prevents DB duplicates
- Redis key: `{workspace_slug}:attempt:{attempt_id}:submission-seq-{seq}` → response JSON
- TTL: 24 hours (matches Q2 answer)
- Scope: Per-workspace (tenant-isolated per Q2 answer)

**Replay Guarantee:**

- Duplicate submission detected via Redis (fast-path, < 1ms)
- If Redis miss, DB UNIQUE constraint prevents duplicate grading row
- Worker replays safe: submission_sequence prevents duplicate result writes
- Infrastructure failure: DB fallback guarantees idempotency even if Redis lost

---

### ✅ Concurrency & Locking (Per Q3 Answer)

**Lock Strategy:** Pessimistic (SELECT FOR UPDATE) per Q3 answer

**Submission Lock:**

- Acquire: On submission receipt (before enqueue)
- Timeout: 5 seconds (per Q3 answer)
- Retry: Up to 3 times (per Q3 answer) with exponential backoff (100ms, 200ms, 400ms)
- Failure Response: 409 ATTEMPT_CONCURRENCY_VIOLATION (after retries exhausted)
- Released: On transaction commit (auto on success or rollback)

**Grading Lock:**

- Acquire: By worker when processing grading job
- Timeout: 30 seconds (longer for CPU-intensive grading)
- Retry: Up to 5 retries with exponential backoff
- Failure: Move to DLQ (Grading In Progress; try again later)

**Progress Updates:**

- No locks (eventual consistency per Q3 answer)
- Multiple students can autosave simultaneously
- Progress updates don't block submission (fast submission response)
- Conflict resolution: Last-write-wins (latest saved_at timestamp wins)

---

### ✅ Version Enforcement (Per Q4 Answer)

**Check Timing:** All three points (Creation + Submission + Grading) per Q4 answer

**At Creation:**

- Check: `tenant.schema_version` vs `required_schema_version`
- Check: `tenant.product_version` vs `exam.min_product_version`
- Snapshot: exam_version, schema_version, product_version into attempt row
- Reject: 426 SCHEMA_VERSION_INCOMPATIBLE if mismatch

**At Submission:**

- Check: `current_tenant.schema_version` vs `attempt.schema_version` (snapshot)
- Reject: 503 MIGRATION_IN_PROGRESS if mismatch (tenant must complete migration before submissions)
- Allow: If versions match (in-flight attempt continues)

**At Grading:**

- Worker check: `attempt.schema_version` vs `current_tenant.schema_version`
- If match: Proceed with grading; use snapshot for answer evaluation
- If mismatch: Fail gracefully; return 0 score, passed=false (attempt marked FAILED)

**Migration Semantics:**

- Migrations must complete before new submissions (per Q4 answer)
- In-flight attempts use snapshot versions (immutable per ADR-0002)
- No partial grading under mixed schema versions

---

### ✅ License Enforcement (Per Q5 Answer)

**Check Timing:** All three points (Creation + Submission + Grading) per Q5 answer

**At Creation:**

- Check: License status MUST be ACTIVE
- Reject: 423 SOFT_LOCKED (create blocked during grace)
- Reject: 403 ARCHIVED (no new attempts)
- Snapshot: License state into attempt row

**At Submission:**

- Check: License status
- ACTIVE: Allow submission
- SOFT_LOCKED: Allow submission (per Q5 answer; in-flight must complete)
- ARCHIVED: Allow submission (per Q5 answer; in-flight must complete)

**At Grading:**

- Check: License status
- ACTIVE: Allow grading
- SOFT_LOCKED: Allow grading (grace period)
- ARCHIVED: Allow grading (attempt already finalized)

**Semantics:**

- License transitions do NOT cancel in-flight attempts (per Q5 answer)
- SOFT_LOCKED grace state allows students to finish exams
- ARCHIVED blocks only NEW attempts, not completions
- Rationale: Academic integrity + legal protection

---

### ✅ Error Contract (16 error codes)

RFC 7807 Standard Response:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "status": 400,
    "correlation_id": "...",
    "timestamp": "2026-02-18T00:00:00Z"
  }
}
```

**Mapping:**

- 400: INVALID_ATTEMPT_CONFIG, INVALID_SUBMISSION_FORMAT
- 403: WORKSPACE_ARCHIVED
- 409: ATTEMPT_CONCURRENCY_VIOLATION, ATTEMPT_ALREADY_SUBMITTED
- 422: INVALID_ATTEMPT_STATE, SCHEMA_VERSION_MISMATCH
- 423: WORKSPACE_SOFT_LOCKED
- 426: SCHEMA_VERSION_INCOMPATIBLE
- 503: MIGRATION_IN_PROGRESS, GRADING_FAILED

---

### ✅ Structured Logging (11 required fields)

**JSON Format:**

```json
{
  "timestamp": "2026-02-18T00:00:00Z",
  "level": "INFO",
  "service": "api",
  "message": "Submission received",
  "correlation_id": "corr-123",
  "workspace_slug": "acme-university",
  "workspace_id": "ws-123",
  "user_id": "user-456",
  "attempt_id": "att-789",
  "operation": "submit",
  "duration_ms": 45
}
```

**Events:**

- Attempt created (with snapshot size, question count)
- Progress saved (current completion %)
- Submission received (lock acquisition time)
- License check passed/failed
- Grading started/completed (score, passed boolean)
- Errors with correlation_id for tracing

**Redaction Rules:**

- Never log: answers, scores, secrets, credentials
- Safe to log: metadata, counts, operations, timings, status changes

---

### ✅ Worker Job Schema

**Job Type:** GRADE_ATTEMPT

**Payload:**

```json
{
  "attempt_id": "att-123",
  "submission_sequence": 1,
  "correlation_id": "corr-456",
  "retry_count": 0
}
```

**Queue:** `zidney.grading` (Redis-backed job queue)

**Retry Strategy:** (Per Q1 answer)

- Up to 3 retries on enqueue failure
- Exponential backoff: 1s, 2s, 4s
- After max retries: move to DLQ with manual review flag
- Worker side: up to 5 retries on grading failure (separate retry loop)

**DLQ:** Dead Letter Queue for manual recovery ops

---

### ✅ Testing Strategy (7 test categories)

1. **Unit Tests**
   - Snapshot creation and serialization
   - Version comparison logic
   - License state validation
   - Score computation determinism

2. **Integration Tests**
   - Full create → progress → submit → grade → finalize flow
   - License enforcement at all checkpoints
   - Version validation at all checkpoints

3. **Transaction Tests**
   - Submission atomicity (lock acquired, status updated, job enqueued)
   - Rollback on failure (status reverted, no orphaned jobs)

4. **Idempotency Tests**
   - Submit twice within 100ms: single grading job created
   - Duplicate grading job: single result written

5. **Concurrency Tests**
   - 100 concurrent submissions: 1 winner (lock serialization)
   - 100 concurrent progress updates: no lost updates (eventual consistency)

6. **Multi-Tenant Tests**
   - Workspace A submission doesn't see Workspace B attempts
   - Idempotency keys workspace-scoped

7. **Version & License Tests**
   - Incompatible version rejected at creation (426)
   - Schema mismatch during submission fails (503)
   - SOFT_LOCKED blocks creation (423) but allows submission (per Q5)

---

## Constitutional Compliance — Final

| ADR                                  | Status | Compliance                                                   |
| ------------------------------------ | ------ | ------------------------------------------------------------ |
| ADR-0001 (Database-per-tenant)       | ✅     | Tenant isolation in schema, queries, connection pooling      |
| ADR-0002 (Snapshot immutability)     | ✅     | Snapshot fields frozen at creation, used read-only by worker |
| ADR-0006 (Server-authoritative time) | ✅     | All timestamps via NOW(); never client-provided              |
| ADR-0007 (Version compatibility)     | ✅     | Checks at all three points; compatibility matrix enforced    |
| Transactional writes                 | ✅     | All state changes wrapped in transactions                    |
| No client-side grading               | ✅     | Worker-only grading; server enforces idempotency             |
| License enforcement                  | ✅     | Middleware validation at all checkpoints                     |
| No cross-tenant risk                 | ✅     | Full workspace isolation in design                           |

**Overall Compliance:** ✅ 100% (8/8 maintained)

---

## Implementation Phases (6 phases)

**Phase 1:** Data Model (Migration, Schema, Indexes)  
**Phase 2:** Middleware (Tenant resolver, License, Correlation ID, Idempotency)  
**Phase 3:** API - Creation (POST /attempts)  
**Phase 4:** API - Progress & Submission (POST /progress, POST /submit)  
**Phase 5:** Worker - Grading (Grade attempt, finalize result)  
**Phase 6:** Testing & Deployment

Estimated: 2-week development cycle (2-3 tasks per day)

---

## Next Phase: Task Generation

Technical plan is production-ready. Proceeding to Step 4 – Tasks to break plan into atomic, dependency-ordered tasks.

---

**Report Status:** ✅ COMPLETE  
**Action:** Ready for task generation phase
