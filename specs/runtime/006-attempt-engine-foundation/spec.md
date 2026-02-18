# Attempt Engine Foundation – Formal Specification

**Document Version**: 1.0  
**Phase**: 01_PLATFORM_FOUNDATION  
**Stage**: STAGE_06_ATTEMPT_ENGINE_FOUNDATION  
**Status**: Specification Complete  
**Date**: February 18, 2026

---

## Executive Summary

This specification defines the Attempt Engine, the unified, immutable attempt execution model that guarantees academic integrity through snapshot isolation, server-authoritative enforcement, and worker-based grading. The Attempt Engine is Zidney's foundational layer for all exam delivery modes (MCQ Assessment, MCQ Exam, MCQ Scheduled, Topic Exam, Exercise Exam, Traditional Scheduled).

The engine ensures:

- Deterministic, auditable grading independent of runtime configuration changes
- Concurrency safety via transactional semantics
- Version compatibility enforcement for safe platform evolution
- Multi-tenant isolation at the database level
- No client-controlled academic operations

---

## Feature Overview

### What Is Being Built

A unified **Attempt Engine** that manages the entire lifecycle of an exam attempt from initialization through grading finalization. This is not a new feature module—it is the academic credibility foundation upon which all exam delivery modes depend.

### Components

1. **Attempt Lifecycle Management**: Creation, submission, expiration, and finalization
2. **Snapshot Model**: Immutable capture of exam configuration at attempt start
3. **Progress Registry**: Per-question answer tracking with incremental updates
4. **Submission Pipeline**: Idempotent, transactional state transition
5. **Worker Grading System**: Server-side deterministic grading from snapshots
6. **Concurrency Safety**: Row-level locking and transaction serialization
7. **Mode Enforcement**: Server-authoritative timer validation for RELAX, CHRONO, and RUSH modes
8. **Expiration Handler**: Background job for automatic attempt timeout

### Phase & Stage Mapping

- **Phase**: 01_PLATFORM_FOUNDATION
- **Stage**: STAGE_06_ATTEMPT_ENGINE_FOUNDATION
- **Affects**:
  - Multi-tenant isolation (database-per-tenant)
  - License enforcement (middleware integration)
  - Attempt engine core (new feature)
  - Worker system (grading integration)
  - Runtime (mode validation)
  - Frontoffice (submission/progress APIs)

### Architectural Context

The Attempt Engine is the trust chain foundation:

```
License Validation → Attempt Creation → Snapshot Capture →
Progress Tracking → Submission → Worker Grading → Finalization
```

No Phase 2 expansion is allowed until Attempt Engine integrity is verified.

---

## Constitutional Compliance Declaration

### Explicit Compliance Confirmations

This specification **COMPLIES** with the Zidney Constitution on all critical points:

✅ **No Cross-Tenant Access**

- All tenant data isolation enforced via database-per-tenant model (ADR-0001)
- Tenant resolved via subdomain/path slug _before_ any database operation
- No shared attempts table across tenants
- Connection pool uniquely identified per workspace_id

✅ **No Middleware Bypass**

- License middleware is mandatory before all workspace-bound attempt operations
- License status validation (ACTIVE) required at attempt creation
- Schema version compatibility check required before start
- Soft-lock (SOFT_LOCKED) state returns HTTP 423
- ARCHIVED state returns HTTP 403

✅ **No Grading Outside Worker**

- API layer contains zero grading logic
- Grading computation delegated entirely to worker process
- Worker reads snapshot only (never live exam configuration)
- Worker is idempotent and handles own failure recovery

✅ **No Direct DB Instantiation**

- Tenant connection pool obtained via `getTenantDatabase(workspace_id)`
- No connection strings hardcoded in API logic
- All DB access originates from middleware context

✅ **No Weakening of Snapshot Integrity**

- Snapshot is immutable after attempt creation
- Grading references snapshot only—never exam/question tables
- Snapshot includes all metadata needed for deterministic grading
- Product upgrade safety guaranteed by version checks

✅ **No Weakening of Transaction Boundaries**

- Attempt creation is fully transactional
- Submission is transactional with FOR UPDATE lock
- Grading is transactional with FOR UPDATE lock
- No partial writes; all-or-nothing semantics enforced

✅ **No Weakening of Version Enforcement**

- Each attempt stores `schema_version` (snapshot of tenant state)
- Each attempt stores `product_version` (snapshot of product state)
- Grading rejects attempts if compatibility check fails
- Forward-only migrations only; no schema regressions

### Exception Declaration

No exceptions to Constitutional rules are required for this stage.

---

## Isolation Impact Analysis

### Database Architecture

**Database Model**: Database-per-Tenant (ADR-0001)

- Each workspace has a unique PostgreSQL database
- Isolated schema per workspace—no shared tables
- Connection pool managed in-memory map keyed by workspace_id

### Data Access Patterns

**Attempt Table Location**: Tenant database (not master)

All attempt data resides in the tenant's isolated database:

```
master_db/
└── workspaces (MMC control only)

tenant_db_<workspace_id>/
├── attempts (new)
├── attempt_progress (new)
└── [existing schemas]
```

### Tenant Resolution

**Resolution Order**:

1. Extract subdomain from request Host header (or path slug)
2. Query master DB: `SELECT workspace_id FROM workspaces WHERE slug = ?`
3. Obtain tenant connection pool: `const pool = await getTenantDatabase(workspace_id)`
4. Execute all subsequent queries against tenant pool

**No tenant override from request body allowed.**

### New Tables Introduced

**attempts**:

- Stores unified attempt records across all delivery modes
- Immutable snapshot fields ensure deterministic processing
- Located in tenant database only

**attempt_progress**:

- Stores per-question answer and flag state
- Incremental updates via upsert operations
- Located in tenant database only

**All tables are tenant-isolated. No cross-tenant joins possible.**

---

## License & Version Enforcement

### License Middleware Requirement

**Status**: MANDATORY for all workspace-bound attempt operations

Every endpoint that accesses or creates attempts must:

1. **Resolve workspace** (via subdomain/path slug)
2. **Load license** from master DB: `SELECT * FROM licenses WHERE workspace_id = ?`
3. **Validate license status**:
   - ACTIVE → proceed
   - SOFT_LOCKED → return HTTP 423 (Locked)
   - ARCHIVED → return HTTP 403 (Forbidden)
   - NOT FOUND → return HTTP 404 (Not Found)
4. **Load workspace schema_version** from tenant DB
5. **Validate version compatibility** (see next section)
6. **Attach to request context**: `req.license = license; req.workspace = workspace;`

### License States Allowed During Attempt

| License State | Attempt Creation | Attempt Submission | Attempt Grading | Rationale                                   |
| ------------- | ---------------- | ------------------ | --------------- | ------------------------------------------- |
| ACTIVE        | ✅ Yes           | ✅ Yes             | ✅ Yes          | Normal operation                            |
| SOFT_LOCKED   | ❌ No (423)      | ❌ No (423)        | ⚠️ Yes\*        | \*Grading completes in-flight attempts only |
| ARCHIVED      | ❌ No (403)      | ❌ No (403)        | ❌ No (403)     | Institution inactive                        |

### Version Compatibility Enforcement

**On Attempt Creation**:

The system must validate version compatibility before accepting attempt start:

```
IF tenant.schema_version < MIN_SUPPORTED_SCHEMA_VERSION
  THEN return HTTP 426 (Upgrade Required)

IF license.product_version < MIN_PRODUCT_VERSION
  THEN return HTTP 426 (Upgrade Required)

IF license.product_version > MAX_PRODUCT_VERSION
  THEN return HTTP 426 (Upgrade Required)
```

**Compatibility Constants** (to be defined per release):

- `MIN_SUPPORTED_SCHEMA_VERSION` = 1 (initial)
- `CURRENT_SCHEMA_VERSION` = 1
- `MIN_PRODUCT_VERSION` = "1.0.0"
- `MAX_PRODUCT_VERSION` = "∞" (forward-compatible, no upper bound)

**On Attempt Grading**:

Worker must verify stored versions match runtime before grading:

```
IF attempt.expected_schema_version != current_schema_version
  AND attempt.expected_schema_version < MIN_SUPPORTED_SCHEMA_VERSION
  THEN mark attempt FINALIZED with error: "Schema version incompatible"

IF attempt.expected_product_version not in SUPPORTED_RANGE
  THEN mark attempt FINALIZED with error: "Product version incompatible"
```

### Limit Enforcement

**Soft Limits** (per license):

- Max concurrent attempts per user per exam
- Max attempts per exam per user (lifetime)
- Max total exam attempts per license

**Enforcement**: Checked at attempt creation time. If exceeded → return HTTP 429 (Too Many Requests).

---

## Data Model Changes

### New Tables Required

#### Table: `attempts`

**Purpose**: Unified attempt record for all exam delivery modes.

**Location**: Tenant database

**Schema**:

```sql
CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID NOT NULL,
  attempt_type VARCHAR(50) NOT NULL,
  exam_id UUID NOT NULL,

  -- Snapshot Fields (Immutable after start)
  question_snapshot JSONB NOT NULL,          -- Full resolved question set
  question_order UUID[] NOT NULL,             -- Shuffled question IDs
  grading_config_snapshot JSONB NOT NULL,    -- Pass/fail logic, weights
  mode VARCHAR(20) NOT NULL,                  -- RELAX | CHRONO | RUSH
  flags_snapshot JSONB NOT NULL,              -- review_allowed, hints_allowed, etc.
  time_limit_snapshot BIGINT,                 -- Seconds (null for RELAX)
  exam_version VARCHAR(20) NOT NULL,          -- Exam version at snapshot time
  expected_schema_version INT NOT NULL,       -- Tenant schema version at start
  expected_product_version VARCHAR(20) NOT NULL, -- Product version at start

  -- Timing Fields
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  finalized_at TIMESTAMP WITH TIME ZONE,
  server_start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Attempt-Level Configuration
  certificate_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  single_attempt_rule BOOLEAN NOT NULL DEFAULT FALSE,

  -- State
  status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    -- Enum: IN_PROGRESS | SUBMITTED | FINALIZED | EXPIRED | ABORTED

  -- Results (Populated by worker)
  score NUMERIC(5,2),                         -- 0-100
  passed BOOLEAN,
  result_snapshot JSONB,                      -- Full grading result

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  CONSTRAINT valid_status CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'FINALIZED', 'EXPIRED', 'ABORTED')),
  CONSTRAINT valid_mode CHECK (mode IN ('RELAX', 'CHRONO', 'RUSH')),
  CONSTRAINT valid_attempt_type CHECK (attempt_type IN (
    'MCQ_ASSESSMENT', 'MCQ_EXAM', 'MCQ_SCHEDULED',
    'TOPIC_EXAM', 'EXERCISE_EXAM', 'TRADITIONAL_SCHEDULED'
  ))
};

-- Indexes for common queries
CREATE INDEX idx_attempts_workspace_user_exam ON attempts(workspace_id, user_id, exam_id, status);
CREATE INDEX idx_attempts_status_finalized ON attempts(workspace_id, status, finalized_at);
CREATE INDEX idx_attempts_started_expiration ON attempts(workspace_id, started_at, time_limit_snapshot) WHERE status = 'IN_PROGRESS';
CREATE UNIQUE INDEX idx_single_attempt_rule ON attempts(exam_id, user_id) WHERE status = 'IN_PROGRESS' AND single_attempt_rule = TRUE;
```

#### Table: `attempt_progress`

**Purpose**: Per-question progress tracking.

**Location**: Tenant database

**Schema**:

```sql
CREATE TABLE attempt_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,

  -- Answer Storage (JSON allows flexibility across question types)
  user_answer JSONB,
  answered_at TIMESTAMP WITH TIME ZONE,

  -- UI State
  flagged BOOLEAN NOT NULL DEFAULT FALSE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_attempt FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
  CONSTRAINT unique_question_per_attempt UNIQUE (attempt_id, question_id)
};

-- Indexes
CREATE INDEX idx_attempt_progress_attempt ON attempt_progress(attempt_id);
CREATE INDEX idx_attempt_progress_answered ON attempt_progress(attempt_id, answered_at);
```

### Modified Tables

None. The Attempt Engine introduces new tables but does not modify existing schemas.

### Migration Impact

**New Migration File**:

```
apps/api/src/db/tenant/migrations/001_create_attempt_engine_tables.sql
```

**Rollback Strategy**: Forward-only migration. Rollback via snapshot restore only (per ADR-0008).

**Schema Version Bump**: YES

- Current `schema_version` = 0
- Post-migration `schema_version` = 1

**Backward Compatibility**: Not applicable. This is Phase 1 foundational work.

---

## Transaction Boundaries

### Atomic Operations

All operations listed below must be fully transactional (all-or-nothing, ACID).

#### Operation 1: Attempt Creation

**Transactional Boundary**:

```sql
BEGIN TRANSACTION;
  1. Validate license status (License middleware)
  2. Validate schema_version compatibility
  3. Resolve question set from exam
  4. Compute shuffled question order
  5. Capture grading configuration
  6. INSERT INTO attempts (...)
    VALUES (id, workspace_id, user_id, question_snapshot, ...)
    RETURNING id;
  7. INSERT INTO attempt_progress (...)
    VALUES (attempt_id, question_id, null, null, false, now(), now())
    FOR EACH question_id IN question_order;
COMMIT;
```

**Failure Handling**:

If any step fails within the transaction:

- All inserts rolled back
- No partial attempt record created
- Return error to client with structured error response

**Retry Policy**: Idempotent. Client can retry with same arguments; duplicate-key constraint prevents double-insertion.

---

#### Operation 2: Answer Progress Save

**Transactional Boundary**:

```sql
BEGIN TRANSACTION;
  UPSERT INTO attempt_progress (...)
  ON CONFLICT (attempt_id, question_id)
  DO UPDATE SET (user_answer, answered_at, updated_at) = (...)
  RETURNING *;
COMMIT;
```

**Idempotency**: Upsert operation is idempotent. Replay of the same answer produces identical result.

**Concurrency**: Client sends all progress updates; multiple clients can submit answers for different questions without conflict.

---

#### Operation 3: Submission

**Transactional Boundary**:

```sql
BEGIN TRANSACTION;
  SELECT * FROM attempts
  WHERE id = ? AND workspace_id = ?
  FOR UPDATE;  -- LOCK ROW

  IF status != 'IN_PROGRESS' THEN return Conflict error;
  IF submitted_at IS NOT NULL THEN return Idempotent response (already submitted);

  UPDATE attempts
  SET status = 'SUBMITTED',
      submitted_at = NOW(),
      updated_at = NOW()
  WHERE id = ?;

  ENQUEUE grading_job(attempt_id);
COMMIT;
```

**Idempotency**: If already SUBMITTED, return cached result (last submission).

**Failure Handling**:

- If status validation fails → rollback + return 409 Conflict
- If enqueue fails → rollback
- If job loses in queue → retry via worker recovery mechanism

**Retry Policy**: Client can retry submission; idempotency is guaranteed.

---

#### Operation 4: Worker Grading

**Transactional Boundary**:

```sql
BEGIN TRANSACTION;
  SELECT * FROM attempts
  WHERE id = ? AND workspace_id = ?
  FOR UPDATE;  -- LOCK ROW

  IF status != 'SUBMITTED' THEN return Idempotent response (already finalized);

  score = computeScore(attempt.question_snapshot, answers...);
  passed = evaluatePassLogic(score, attempt.grading_config_snapshot);
  result_snapshot = buildResultSnapshot(...);

  UPDATE attempts
  SET status = 'FINALIZED',
      score = score,
      passed = passed,
      result_snapshot = result_snapshot,
      finalized_at = NOW(),
      updated_at = NOW()
  WHERE id = ?;

  IF passed AND certificate_enabled THEN
    ENQUEUE generate_certificate_job(attempt_id);
  END IF;
COMMIT;
```

**Idempotency**: If already FINALIZED, worker exits safely. Replay produces identical result.

**Failure Handling**:

- Worker maintains DLQ for failed attempts
- Retry logic: exponential backoff (1s, 2s, 4s, 8s, 16s)
- Max 5 retries; after that → move to DLQ for manual review

---

#### Operation 5: Expiration

**Transactional Boundary**:

```sql
FOR EACH attempt IN (
  SELECT id FROM attempts
  WHERE workspace_id = ?
    AND status = 'IN_PROGRESS'
    AND started_at + make_interval(secs => time_limit_snapshot) < NOW()
)
BEGIN TRANSACTION;
  SELECT * FROM attempts WHERE id = attempt.id FOR UPDATE;

  IF status != 'IN_PROGRESS' THEN skip (concurrent finalization);

  UPDATE attempts SET status = 'EXPIRED', updated_at = NOW()
  WHERE id = attempt.id;

  ENQUEUE grading_job(attempt_id);
COMMIT;
```

**Concurrency Safety**: FOR UPDATE prevents race between expiration job and submission.

---

### Idempotency Strategy

**All operations must be idempotent** (safe to replay without side effects).

| Operation        | Idempotency Key                              | Strategy                                                        |
| ---------------- | -------------------------------------------- | --------------------------------------------------------------- |
| Attempt Creation | (workspace_id, user_id, exam_id, started_at) | Unique constraint (prevents duplicates); return existing record |
| Answer Progress  | (attempt_id, question_id)                    | UPSERT; last-write-wins                                         |
| Submission       | attempt_id + submitted_at                    | Submission lock; return existing result if already SUBMITTED    |
| Grading          | attempt_id + finalized_at                    | Finalization lock; return existing result if already FINALIZED  |
| Expiration       | attempt_id + EXPIRED status                  | Status check before update; skip if already processed           |

**Replay Behavior**: If a client sends the same request twice, the system returns identical results (no duplicates, no state drift).

---

## Authoritative Time Usage

### Server-Only Time Validation (ADR-0006)

**Principle**: All time-based decisions are made by the server using server clocks only. Client time is never trusted.

### Time Sources

**Authoritative**: PostgreSQL `NOW()` function (server database clock)

- All timestamps written to attempts table use `NOW()`
- All time validations use server time
- Client time is decorative only (visual timer for UX)

### Timing Rules

#### RELAX Mode (No Timer)

- No server timer active
- `time_limit_snapshot = NULL`
- Manual submission only
- Expiration job skips this attempt

#### CHRONO Mode (Global Timer)

- `started_at` recorded by server
- `time_limit_snapshot = duration_in_seconds`
- Expiration deadline: `started_at + time_limit_snapshot`
- Auto-submit on timeout via background job
- Client timer is visual reference only; server enforces true deadline

#### RUSH Mode (Per-Question Timer)

- Each question has a time window (e.g., 45 seconds)
- Client enforces visual countdown
- Server validates total elapsed time: `(NOW() - started_at) <= time_limit_snapshot`
- Server blocks submission if total elapsed time exceeded
- Client cannot extend time

### Scheduled Exam Enforcement

For scheduled exams:

```
exam.scheduled_start_datetime = "2026-03-01T09:00:00Z"
exam.scheduled_end_datetime = "2026-03-01T11:00:00Z"
grace_period_seconds = 30

Attempt allowed if:
  NOW() >= exam.scheduled_start_datetime
  AND NOW() <= (exam.scheduled_end_datetime + grace_period_seconds)
```

After grace period: auto-submit via expiration job.

### Reconnection Behavior

If client loses connection during attempt:

1. Client automatically reconnects
2. Backend validates: `attempt.status = IN_PROGRESS`
3. Backend validates: `(NOW() - started_at) <= time_limit_snapshot + grace_period`
4. If within grace → allow resume
5. If expired → mark EXPIRED, enqueue grading

Grace period for reconnection: `30 seconds`

### Drift Prevention

- Server time is authoritative; no clock correction from client
- All calculations use PostgreSQL time
- No NTP client-side interaction required
- Distributed servers use NTP server-side only (deployment concern)

---

## Idempotency & Safety Guarantee

### Idempotency Implementation

All mutable operations must be safe to execute multiple times with identical outcome.

**Idempotency techniques used**:

1. **Unique Constraints**: Prevent duplicate attempts for same (workspace_id, user_id, exam_id) tuple
2. **FOR UPDATE Locks**: Serialize concurrent submissions/grading
3. **Status Guards**: Check status before state transitions
4. **UPSERT Operations**: Answer progress updates use INSERT...ON CONFLICT

### Double Submission Protection

If client submits attempt twice (network retry):

```
First submission:
  1. Lock attempt row
  2. Set status = SUBMITTED
  3. Enqueue grading job
  4. Return result_id

Second submission (within 10 seconds):
  1. Lock attempt row
  2. Status check: Already SUBMITTED
  3. Return cached result (idempotent)
```

Result is identical; no duplicate grading jobs created.

### Worker Failure Recovery

If grading job crashes or loses in queue:

1. Worker health check detects missing completion
2. Job is re-enqueued with exponential backoff
3. Worker re-executes grading (idempotent)
4. Duplicate job in queue? FOR UPDATE lock prevents concurrent grading
5. Second worker skips already-FINALIZED attempt

---

## Observability Requirements

### Structured Logging

All services must emit structured JSON logs with these **mandatory fields**:

```json
{
  "timestamp": "2026-02-18T14:23:45.123Z",
  "level": "INFO|WARN|ERROR|DEBUG",
  "service": "api|worker",
  "message": "Attempt created successfully",
  "correlation_id": "req-12345abcde",
  "workspace_slug": "acme-university",
  "workspace_id": "ws-uuid",
  "user_id": "user-uuid",
  "attempt_id": "attempt-uuid",
  "additional_context": {...}
}
```

### Log Events

**API Layer**:

- `[INFO] attempt.created` → workspace_id, user_id, exam_id, attempt_id
- `[INFO] attempt.submitted` → attempt_id, question_count, status
- `[WARN] attempt.license_invalid` → workspace_id, reason (SOFT_LOCKED|ARCHIVED|...)
- `[ERROR] attempt.creation_failed` → workspace_id, reason
- `[INFO] attempt.expired` → attempt_id, elapsed_time, time_limit

**Worker Layer**:

- `[INFO] grading.started` → attempt_id, question_count
- `[INFO] grading.completed` → attempt_id, score, passed, duration_ms
- `[ERROR] grading.failed` → attempt_id, reason, retry_count
- `[INFO] certificate.queued` → attempt_id (if passed)

### Error Contract (RFC 7807)

All error responses must follow standard format:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ATTEMPT_ALREADY_SUBMITTED",
    "message": "This attempt has already been submitted.",
    "status": 409,
    "correlation_id": "req-12345abcde"
  }
}
```

### Metrics Emitted

(For critical path; optional for non-critical operations):

- `attempt.creation_latency_ms` (histogram)
- `attempt.submission_latency_ms` (histogram)
- `grading.latency_ms` (histogram)
- `attempt.count_in_progress` (gauge)
- `grading.queue_depth` (gauge)
- `grading.failure_rate` (counter)

---

## Rate Limiting & Abuse Protection

### Endpoint Classification

| Endpoint                   | Classification         | Rate Limit                        |
| -------------------------- | ---------------------- | --------------------------------- |
| POST /attempt/start        | auth (workspace-bound) | 5 per minute per user per exam    |
| GET /attempt/{id}/progress | auth (workspace-bound) | 60 per minute per user            |
| POST /attempt/{id}/answer  | auth (workspace-bound) | 1000 per minute per user          |
| POST /attempt/{id}/submit  | auth (workspace-bound) | 3 per minute per user per attempt |
| GET /attempt/{id}/result   | auth (workspace-bound) | 60 per minute per user            |

### Protection Strategies

1. **Duplicate Submission Prevention**: FOR UPDATE lock prevents concurrent submissions
2. **Attempt Rate Limit**: Soft limit enforced by license (max N attempts per exam per user)
3. **Worker Queue Protection**: Max queue depth = 10,000 jobs; reject new jobs if exceeded
4. **Progress Batching**: Client sends answer updates every 5-10 seconds minimum (by client design, not server enforcement)

---

## Layer Separation Confirmation

### Frontend (Frontoffice App)

**Allowed Responsibilities**:

- Render exam questions
- Display visual timer (client-side countdown)
- Capture user answers
- Send answer updates to API
- Calculate and show UI progress indicator
- Display attempt completion acknowledgment

**Forbidden Responsibilities**:

- Compute grading
- Make pass/fail decisions
- Extend time limits
- Skip questions (server enforces order validation)
- Override snapshot configuration

**Violations**: None. Frontoffice is UI-only; grading logic is server-side only.

---

### API Layer (apps/api)

**Allowed Responsibilities**:

- Receive attempt creation request
- Validate license + version
- Load exam configuration
- Create snapshot
- Persist attempt to database
- Receive answer updates
- Validate answer format
- Return time-remaining and attempt status
- Accept submission request
- Enqueue grading job

**Forbidden Responsibilities**:

- Execute grading computation
- Calculate scores
- Make pass/fail decisions
- Access live exam config during grading (snapshot only)
- Directly read/write worker queue

**Compliance**: ✅ API contains zero grading logic. All grading deferred to worker.

---

### Worker Layer (apps/worker)

**Allowed Responsibilities**:

- Dequeue grading job
- Lock attempt row
- Read attempt + snapshot
- Compute score deterministically
- Apply grading rules
- Write result to database
- Mark attempt FINALIZED
- Enqueue certificate job (if applicable)
- Handle own failure recovery

**Forbidden Responsibilities**:

- Accept HTTP requests
- Compute UI-related state
- Directly modify license records
- Access live exam configuration
- Perform schema migrations

**Compliance**: ✅ Worker is pure compute + database write. No HTTP concerns.

---

### Database Isolation Check

- MMC does not access tenant DB ✅
- API queries tenant DB only (for attempts) ✅
- Worker queries tenant DB only (for grading) ✅
- No direct DB instantiation outside pool management ✅
- Tenant connection obtained via middleware resolver ✅

---

## Failure Modes & Recovery

### Database Failures

#### Failure: Connection Pool Exhaustion

**Scenario**: All connections in pool are held by long-running transactions.

**Detection**: Connection timeout after 30 seconds.

**Recovery**:

1. Client receives error: "Connection pool exhausted; retry later"
2. Return HTTP 503 Service Unavailable
3. Client retries after exponential backoff
4. If persistent, operator investigates stuck transactions

#### Failure: Deadlock During Submission

**Scenario**: Two workers attempt to grade same attempt simultaneously (shouldn't happen, but protect anyway).

**Detection**: PostgreSQL deadlock error (error code 40P01).

**Recovery**:

1. Worker A aborts, receives deadlock error
2. Worker A re-enqueues job with backoff
3. Worker B proceeds with grading
4. On retry, Worker A finds status = FINALIZED and exits gracefully

---

### Version Mismatch During Grading

#### Failure: Schema Version Incompatible

**Scenario**: Product upgraded, but attempt was created on old schema. Grading code expects new schema columns.

**Detection**: Worker checks `attempt.expected_schema_version` before grading.

**Recovery**:

1. Worker reads: `expected_schema_version = 0, current_schema_version = 1`
2. If `expected_schema_version < MIN_SUPPORTED`:
   - Mark attempt FINALIZED with score = 0, passed = false
   - Log error with attempt_id for manual review
   - Enqueue alert to ops team
   - Do NOT corrupt grading; fail safely

---

### License Enforcement Failures

#### Failure: License Becomes SOFT_LOCKED During In-Flight Attempt

**Scenario**: Attempt is IN_PROGRESS, license transitions ACTIVE → SOFT_LOCKED.

**Detection**: License middleware checks on every request; student receives error on next action.

**Recovery**:

1. Student cannot submit
2. API returns HTTP 423 (Locked)
3. License can be restored via MMC; attempt remains IN_PROGRESS
4. Once restored, student can resume and submit

#### Failure: License ARCHIVED During Grading

**Scenario**: Grading job starts but license is now ARCHIVED.

**Detection**: Worker checks license status before finalizing.

**Recovery**:

1. Worker logs warning: "Grading attempt for archived license"
2. Worker proceeds with grading anyway (in-flight attempts must complete)
3. Result is persisted but not visible to students (archived workspace)
4. Audit trail preserved for compliance

---

### Worker Failures

#### Failure: Grading Job Crashes

**Scenario**: Worker crashes during grading calculation (divide-by-zero, out-of-memory).

**Detection**: Job does not send completion acknowledgment; job broker retries.

**Recovery**:

1. Job is re-enqueued with exponential backoff (1s, 2s, 4s, 8s, 16s)
2. Max 5 retries
3. If still failing after 5 retries, job is moved to DLQ
4. Alert to ops team; manual investigation required
5. Attempt remains SUBMITTED; student eventually sees timeout, not corruption

#### Failure: Partial Worker Restart

**Scenario**: Worker restarts mid-grading, some jobs lost from in-memory queue.

**Detection**: Job broker health check detects missing completion.

**Recovery**:

1. Job broker marks job as failed, re-enqueues
2. On restart, worker processes queued jobs
3. Idempotency ensures no duplicate grading
4. No attempt data is lost

---

### Timeout Behavior

#### Expiration Job Timeout

**Scenario**: Expiration job hangs while locking attempt row.

**Detection**: Job exceeds 60-second timeout threshold.

**Recovery**:

1. Job broker kills hanging job
2. Attempt remains IN_PROGRESS
3. Expiration job re-runs on next cycle (5 minutes later)
4. If still stuck, operator investigates DB locks

---

### Partial Transaction Failure

#### Failure: Enqueue Grading Job After Submission Update

**Scenario**: Submission succeeds, attempt is marked SUBMITTED, but job enqueue fails.

**Detection**: Exception during queue.enqueue() call.

**Recovery**:

1. Transaction is rolled back entirely
2. Submission does NOT complete
3. Attempt remains IN_PROGRESS
4. Client retries submission
5. No orphaned attempts with status = SUBMITTED but no grading job

---

## Test Strategy

### Unit Tests Required

- `grading.test.ts`: Deterministic score calculation under various question types
- `snapshot.test.ts`: Snapshot capture and serialization
- `idempotency.test.ts`: Idempotent operation replay
- `time-validation.test.ts`: Server-authoritative time checks (RELAX/CHRONO/RUSH modes)
- `version-compatibility.test.ts`: Schema/product version checks

**Coverage Target**: ≥90% of grading and validation logic

---

### Integration Tests Required

- `attempt-creation.integration.test.ts`
  - Valid attempt creation with full snapshot
  - Duplicate attempt rejection
  - License validation before creation
  - version compatibility check

- `attempt-submission.integration.test.ts`
  - Submission flow end-to-end
  - Idempotent resubmission
  - Status guards (cannot submit if already submitted)
  - Grading job enqueued after submission

- `attempt-grading.integration.test.ts`
  - Worker grading workflow
  - Idempotent grading replay
  - Result persistence
  - Certificate job enqueued if applicable

- `concurrency.integration.test.ts`
  - Two concurrent submissions rejected (FOR UPDATE prevents race)
  - Two concurrent grading jobs return identical result (idempotent)
  - Expiration race with submission (expiration does not corrupt submission)

- `progress-tracking.integration.test.ts`
  - Answer updates persisted
  - Multiple answer updates idempotent
  - Progress survives page refresh

- `multi-tenant.integration.test.ts`
  - Attempts isolated per workspace
  - No cross-tenant data leakage
  - License validation per workspace

---

### Transaction Rollback Test

```typescript
describe('Transaction Rollback Protection', () => {
  test('Attempt creation rollback if snapshot fails', async () => {
    // Simulate snapshot failure mid-transaction
    // Assert: No partial attempt record persists
  })

  test('Submission rollback if enqueue fails', async () => {
    // Simulate job enqueue failure
    // Assert: Attempt remains IN_PROGRESS; no orphaned SUBMITTED state
  })
})
```

---

### Idempotency Test

```typescript
describe('Idempotency Guarantees', () => {
  test('Resubmit same attempt twice → same result', async () => {
    await submit(attempt_id)
    const result1 = await waitForGrading()

    // Simulate network retry; call submit again
    await submit(attempt_id)
    const result2 = await waitForGrading()

    expect(result1).toEqual(result2)
  })

  test('Replay answer update → no duplicate progress rows', async () => {
    const answer = { question_id, user_answer: 'A' }
    await updateAnswer(answer)
    await updateAnswer(answer) // Replay

    const count = await db.query(
      'SELECT COUNT(*) FROM attempt_progress WHERE attempt_id = ?'
    )
    expect(count).toBe(expectedQuestionCount)
  })
})
```

---

### Version Compatibility Test

```typescript
describe('Version Compatibility Enforcement', () => {
  test('Reject attempt start if schema_version incompatible', async () => {
    // Create workspace with schema_version = 0
    // Attempt to start exam with MIN_SUPPORTED_SCHEMA = 1
    // Assert: HTTP 426 Upgrade Required
  })

  test('Reject grading if product_version incompatible', async () => {
    // Create attempt with product_version = "0.9.0"
    // Runtime = "2.0.0", MAX_SUPPORTED = "1.5.0"
    // Worker attempts grading
    // Assert: Mark FINALIZED with error; do not corrupt grading
  })
})
```

---

### Isolation Test

```typescript
describe('Multi-Tenant Isolation', () => {
  test('Attempt in workspace A not visible to workspace B', async () => {
    // Create attempt in workspace A
    // Query workspace B DB
    // Assert: Attempt not found
  })
})
```

---

### Concurrency Test

```typescript
describe('Concurrency Safety', () => {
  test('Concurrent submissions prevented by FOR UPDATE lock', async () => {
    const p1 = submit(attempt_id)
    const p2 = submit(attempt_id)

    const [result1, result2] = await Promise.all([p1, p2])

    // One succeeds, one returns Idempotent/Conflict
    expect([result1, result2]).toContainEqual(idempotentResponse)
  })
})
```

---

## Explicit Non-Goals

### Not Included in This Stage

1. **Frontoffice UI Implementation**
   - This stage defines the data model and API contracts only
   - UI rendering of exam questions is Phase 2 work

2. **Certificate Generation**
   - Trigger logic included (enqueue job if passed)
   - Actual certificate template rendering is separate stage

3. **Question Analytics**
   - Attempt and result data captured
   - Analytics reporting pipeline is future work

4. **Partial Attempt Recovery**
   - If student loses connection during exam, stored answers are preserved
   - Reconnection to resume is API contract
   - Recovery UX is Frontoffice work

5. **Advanced Grading Engines** (e.g., AI-based scoring)
   - Foundation supports deterministic grading only
   - Advanced grading engines can be plugged in future (via worker extension)

6. **Proctoring Integration**
   - Attempt model supports proctoring metadata fields (future columns)
   - Actual proctoring system integration is separate

7. **Question Import/Versioning**
   - Attempted version captured in snapshot
   - Question import tooling is Backoffice scope

---

## Success Criteria

The Attempt Engine is production-ready when:

| Criterion              | Measurable Outcome                                                                    | Verification                                                  |
| ---------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Snapshot Independence  | 100% of grading queries use snapshot only; zero live exam lookups during finalization | Code review + integration test logs                           |
| Transactional Safety   | 100% of submission/grading operations rollback on failure                             | Transaction rollback test suite passes                        |
| Idempotency            | Replayed operations produce identical results; no duplicate state                     | Idempotency test suite passes                                 |
| Concurrency            | Zero race condition between submissions; FOR UPDATE prevents conflicts                | Concurrency stress test (100 concurrent submissions) succeeds |
| Version Enforcement    | Incompatible schema/product versions rejected before attempt start                    | Version compatibility test suite passes                       |
| Multi-Tenant Isolation | Zero cross-tenant data leakage; all queries scoped to workspace_id                    | Multi-tenant isolation test suite passes; code review         |
| License Enforcement    | License middleware required before all workspace-bound operations                     | Code review + license middleware integration test             |
| Deterministic Grading  | Same attempt re-graded produces identical score                                       | Grading determinism test suite passes                         |
| Upgrade Safety         | Attempt remains valid after platform upgrade; results reproducible                    | Upgrade migration test (schema version rollover) passes       |
| Observability          | All critical operations emit structured logs with correlation IDs                     | Log audit: sample production logs contain all required fields |

---

## Final Constitutional Compliance Statement

This specification **IS FULLY COMPLIANT** with the Zidney Constitution v1.2.0.

### Compliance Verification

✅ **ADR-0001 (Database-per-Tenant)**: Attempt and progress tables reside in tenant database. No shared tables. Tenant resolved via subdomain/slug before database access.

✅ **ADR-0002 (Snapshot Attempt Model)**: Snapshot captured at attempt start. Grading references snapshot only. No live exam configuration lookups during grading. Snapshot is immutable.

✅ **ADR-0003 (White-Label Visual Only)**: Attempt model is agnostic to branding. Theme and branding applied at Frontoffice rendering layer only.

✅ **ADR-0004 (Single Runtime Engine)**: Single attempts table supports all delivery modes (MCQ, Traditional, etc.). No separate module-specific attempt tables.

✅ **ADR-0005 (Upgrade Opt-In)**: Version compatibility checks enforced. Incompatible versions rejected before execution. Upgrades are explicit via MMC.

✅ **ADR-0006 (Runtime Authoritative Time)**: Server time only. Client timer is visual. All deadline validation uses PostgreSQL NOW(). No client time trusted.

✅ **ADR-0007 (Product Version Compatibility)**: Each attempt stores expected_schema_version and expected_product_version. Grading validates compatibility.

✅ **ADR-0008 (Semantic Versioning)**: Schema migration versioning follows semantic versioning. Version bumps explicit. Rollback via snapshot only.

✅ **License Enforcement**: License middleware required before all workspace-bound operations. License states (ACTIVE, SOFT_LOCKED, ARCHIVED) enforced per rules.

✅ **Multi-Tenancy Isolation**: No cross-tenant joins. Connection pool per workspace_id. Tenant resolver acts as first middleware step.

✅ **No Client-Side Grading**: All grading deferred to worker. API contains zero score computation logic. Frontoffice has zero grading responsibility.

✅ **Transaction Boundaries**: All mutable operations transactional. Submission, grading, and answer progress use appropriate locking and rollback.

✅ **Idempotency**: All operations safe to replay. Duplicate submission returns cached result. Duplicate grading returns cached result.

✅ **Layer Separation**: Frontoffice = UI only. API = routing + validation. Worker = grading. MMC = licensing. No layer violations.

### Conflict Assessment

**No conflicts detected.** This specification enforces all Constitutional requirements without exception.

---

## Document Metadata

- **Created**: February 18, 2026
- **Author**: AI Specification System
- **Status**: Ready for Planning Phase
- **Next Phase**: `/speckit.plan` (Create implementation plan)
- **Related Stages**: STAGE_05_TENANT_PROVISIONING_SERVICE, STAGE_07_FRONTOFFICE_RUNTIME
- **Dependencies**: STAGE_02_MULTI_TENANCY_ARCHITECTURE, STAGE_04_LICENSE_ENGINE

---

**SPECIFICATION COMPLETE**

This document is the formal specification for STAGE_06_ATTEMPT_ENGINE_FOUNDATION and is ready to proceed to the Planning phase.
