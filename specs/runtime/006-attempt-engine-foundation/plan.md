# Implementation Plan – STAGE_06_ATTEMPT_ENGINE_FOUNDATION

**Document Version**: 1.0  
**Phase**: 01_PLATFORM_FOUNDATION  
**Stage**: STAGE_06_ATTEMPT_ENGINE_FOUNDATION  
**Status**: READY FOR IMPLEMENTATION  
**Date**: February 18, 2026  
**Clarifications Status**: ✅ ALL 5 RESOLVED

---

## Stage Alignment

- **Phase**: 01_PLATFORM_FOUNDATION
- **Stage**: STAGE_06_ATTEMPT_ENGINE_FOUNDATION
- **Related Spec File**: [specs/runtime/006-attempt-engine-foundation/spec.md](spec.md)
- **Related ADRs**:
  - ADR-0001 (Database-per-Tenant)
  - ADR-0002 (Snapshot Attempt Model)
  - ADR-0006 (Runtime Authoritative Time)
  - ADR-0007 (Product Version Compatibility)
  - ADR-0008 (Semantic Versioning)

---

## Architectural Scope Confirmation

**Constitutional Compliance: ✅ FULL COMPLIANCE**

- ✅ **No cross-tenant data access**: All tables tenant-isolated; tenant resolved via slug before DB
  access
- ✅ **No middleware bypass**: License middleware required on all workspace-bound routes
- ✅ **No direct DB instantiation**: Tenant DB obtained via connection pool manager
- ✅ **No grading logic outside Worker**: API layer contains zero score computation; delegated
  entirely to worker
- ✅ **No weakening of snapshot integrity**: Snapshot immutable after creation; grading uses
  snapshot only
- ✅ **No weakening of version enforcement**: Schema and product versions validated at creation,
  submission, and grading
- ✅ **No layer boundary violations**: Frontoffice UI-only; API routing/validation; Worker pure
  compute; MMC licensing
- ✅ **No exceptions to Constitutional rules**: This plan enforces all mandatory constraints

---

## Implementation Layers

### API Layer

**Endpoints Introduced**:

- `POST /api/workspaces/:slug/attempts` → Create attempt
- `POST /api/workspaces/:slug/attempts/:id/progress` → Save progress
- `POST /api/workspaces/:slug/attempts/:id/submit` → Submit attempt
- `GET /api/workspaces/:slug/attempts/:id` → Get attempt status
- `GET /api/workspaces/:slug/attempts/:id/result` → Get attempt result

**Middleware Used**:

1. `tenantResolver` → Resolve workspace from slug; validate subdomain/path; obtain tenant DB
   connection
2. `licenseMiddleware` → Validate license status (ACTIVE check); enforce version compatibility
3. `correlationIdMiddleware` → Generate/propagate correlation_id; attach to request context

**Validation Package Usage**:

- Attempt creation: Validate exam_id exists, user eligibility, schema_version compatibility
- Progress update: Validate question_id, answer format matches question type
- Submission: Validate status is IN_PROGRESS, attempted_at within time window (CHRONO/RUSH)

**Transaction Boundaries**:

- **Attempt Creation**: Single transaction; all snapshots inserted atomically; no partial records
- **Progress Update**: Upsert operation; idempotent by design; no transaction blocking required
- **Submission**: Pessimistic lock (FOR UPDATE); atomically update status + enqueue job; rollback if
  enqueue fails
- **Result Retrieval**: Read-only; no transaction required

---

### Worker Layer

**Queue Name**: `zidney.grading`

**Job Type**: `GRADE_ATTEMPT`

**Idempotency Mechanism**: Attempt status check before grading + UNIQUE constraint on (attempt_id +
finalized_at)

**Transaction Usage**: Pessimistic lock (FOR UPDATE) + atomic status update + result write

**Retry Strategy**:

- Max Retries: 3 (per clarification Q1)
- Backoff: Exponential (1s → 2s → 4s)
- After max retries: Move to DLQ with manual review flag
- Implementation: Job broker handles retry logic; worker idempotent by design

**DLQ Handling**:

- Move failed jobs after 3 retries
- Alert ops team with attempt_id and error reason
- Manual investigation possible; attempt remains SUBMITTED until manual review

---

### Frontend Layer

**API Consumption Only**:

- Call `POST /api/workspaces/:slug/attempts` to start exam
- Poll `GET /api/workspaces/:slug/attempts/:id` for status updates
- Call `POST /api/workspaces/:slug/attempts/:id/progress` to save answers
- Call `POST /api/workspaces/:slug/attempts/:id/submit` to submit
- Poll `GET /api/workspaces/:slug/attempts/:id/result` after submission

**Forbidden Responsibilities**: Zero business logic; no grading; no time enforcement; no
configuration override

**Constraints**: Client timer is visual only; server time is authoritative; all attempts server-time
validated

---

### MMC/Backoffice Scope

**Out of Scope for This Stage**:

- License management is STAGE_04 scope
- User provisioning is STAGE_05 scope
- Exam configuration is separate UI stage

**In Scope**:

- Version compatibility checks use license.product_version
- Instance configuration loaded from MMC (MIN_SUPPORTED_SCHEMA_VERSION, CURRENT_SCHEMA_VERSION,
  etc.)

---

## Database Impact

### Master Database

**Tables Touched**: None (master DB unchanged for this stage)

**Migration Required**: No

**Version Bump**: No

**Notes**: Master DB contains workspaces and licenses (controlled by STAGE_04 \& STAGE_05)

---

### Tenant Database

**Tables Introduced**:

1. `attempts` (new)
2. `attempt_progress` (new)
3. `submission_idempotency_keys` (new, for deduplication track)

**Migration Required**: YES

**Migration File**: `apps/api/src/db/tenant/migrations/001_create_attempt_engine_tables.sql`

**Schema Version Change**: YES

- Current: `schema_version = 0`
- Post-Migration: `schema_version = 1`

**Product Version Compatibility Impact**:

- MIN_PRODUCT_VERSION: "1.0.0" (initial product launch)
- MAX_PRODUCT_VERSION: "∞" (forward-compatible; no upper bound)

---

## SQL Schema

### Table: `attempts`

**Purpose**: Unified attempt record for all exam delivery modes

**Location**: Tenant database

**Complete Schema**:

```sql
CREATE TABLE attempts (
  -- Identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  attempt_type VARCHAR(50) NOT NULL,
  exam_id UUID NOT NULL,

  -- Snapshot Fields (Immutable after start)
  question_snapshot JSONB NOT NULL,
      -- Structure: {
      --   "questions": [
      --     {
      --       "id": "uuid",
      --       "text": "Question text",
      --       "type": "MCQ|SHORT_ANSWER|ESSAY",
      --       "options": [...],
      --       "correct_answer": {...},
      --       "points": 10,
      --       "metadata": {...}
      --     }
      --   ]
      -- }
  question_order UUID[] NOT NULL,     -- Shuffled question IDs in display order
  grading_config_snapshot JSONB NOT NULL,
      -- Structure: {
      --   "pass_score_percentage": 60,
      --   "total_points": 100,
      --   "question_weights": {...},
      --   "pass_fail_logic": "SUM_SCORE >= pass_score_percentage",
      --   "review_allowed": true,
      --   "hints_allowed": false
      -- }
  mode VARCHAR(20) NOT NULL,          -- RELAX | CHRONO | RUSH
  flags_snapshot JSONB NOT NULL,
      -- Structure: {
      --   "review_allowed": true,
      --   "hints_allowed": false,
      --   "show_correct_answer": false,
      --   "randomize_options": true,
      --   "one_question_per_page": false
      -- }
  time_limit_snapshot BIGINT,         -- Seconds (null for RELAX mode)
  exam_version VARCHAR(20) NOT NULL,  -- Exam version at snapshot time
  expected_schema_version INT NOT NULL,   -- Tenant schema_version at start
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
      -- Valid values: IN_PROGRESS | SUBMITTED | FINALIZED | EXPIRED | ABORTED

  -- Results (Populated by worker only)
  score NUMERIC(5,2),                 -- 0-100 scale
  passed BOOLEAN,
  result_snapshot JSONB,
      -- Structure: {
      --   "score": 75.5,
      --   "passed": true,
      --   "question_results": [
      --     {
      --       "question_id": "uuid",
      --       "user_answer": {...},
      --       "correct_answer": {...},
      --       "points_earned": 10,
      --       "points_possible": 10,
      --       "feedback": "Correct!"
      --     }
      --   ],
      --   "summary": "75/100; passed threshold 60"
      -- }

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT valid_status CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'FINALIZED', 'EXPIRED', 'ABORTED')),
  CONSTRAINT valid_mode CHECK (mode IN ('RELAX', 'CHRONO', 'RUSH')),
  CONSTRAINT valid_attempt_type CHECK (attempt_type IN (
    'MCQ_ASSESSMENT', 'MCQ_EXAM', 'MCQ_SCHEDULED',
    'TOPIC_EXAM', 'EXERCISE_EXAM', 'TRADITIONAL_SCHEDULED'
  )),
  CONSTRAINT valid_score_range CHECK (score IS NULL OR (score >= 0 AND score <= 100))
);

-- Indexes for query optimization
CREATE INDEX idx_attempts_workspace_user_exam
  ON attempts(workspace_id, user_id, exam_id, status);

CREATE INDEX idx_attempts_workspace_user_status
  ON attempts(workspace_id, user_id, status)
  WHERE status IN ('IN_PROGRESS', 'SUBMITTED');

CREATE INDEX idx_attempts_status_finalized
  ON attempts(workspace_id, status, finalized_at);

CREATE INDEX idx_attempts_started_expiration
  ON attempts(workspace_id, started_at, time_limit_snapshot)
  WHERE status = 'IN_PROGRESS';

CREATE UNIQUE INDEX idx_single_attempt_rule
  ON attempts(exam_id, user_id)
  WHERE status = 'IN_PROGRESS' AND single_attempt_rule = TRUE;

CREATE INDEX idx_attempts_created_at
  ON attempts(workspace_id, created_at DESC);
```

### Table: `attempt_progress`

**Purpose**: Per-question progress tracking and answer storage

**Location**: Tenant database

**Complete Schema**:

```sql
CREATE TABLE attempt_progress (
  -- Identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL,
  question_id UUID NOT NULL,

  -- Answer Storage (JSONB allows flexibility across question types)
  user_answer JSONB,
      -- Structure varies by question type:
      -- MCQ: {"selected_option": "option_id"}
      -- SHORT_ANSWER: {"text": "user's response"}
      -- ESSAY: {"text": "essay content", "word_count": 250}
      -- MATCH: {"matches": [{"from": "A", "to": "1"}]}
  answered_at TIMESTAMP WITH TIME ZONE,

  -- UI State
  flagged BOOLEAN NOT NULL DEFAULT FALSE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_attempt FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
  CONSTRAINT unique_question_per_attempt UNIQUE (attempt_id, question_id)
);

-- Indexes for query optimization
CREATE INDEX idx_attempt_progress_attempt
  ON attempt_progress(attempt_id);

CREATE INDEX idx_attempt_progress_answered
  ON attempt_progress(attempt_id, answered_at DESC);

CREATE INDEX idx_attempt_progress_flagged
  ON attempt_progress(attempt_id, flagged)
  WHERE flagged = TRUE;
```

### Table: `submission_idempotency_keys`

**Purpose**: Track submission attempts for deduplication across retries

**Location**: Tenant database

**Complete Schema**:

```sql
CREATE TABLE submission_idempotency_keys (
  -- Identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  attempt_id UUID NOT NULL,
  submission_sequence INT NOT NULL,  -- Incremental counter per attempt

  -- Idempotency Tracking
  idempotency_key VARCHAR(255) NOT NULL,  -- Hash of request headers/body
  request_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Response Cache
  response_status INT NOT NULL,
  response_body JSONB NOT NULL,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Constraints
  CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
  CONSTRAINT unique_submission_sequence UNIQUE (attempt_id, submission_sequence)
);

-- Indexes for query optimization
CREATE UNIQUE INDEX idx_submission_idempotency_key
  ON submission_idempotency_keys(workspace_id, idempotency_key)
  WHERE expires_at > NOW();

CREATE INDEX idx_submission_cleanup
  ON submission_idempotency_keys(workspace_id, expires_at)
  WHERE expires_at <= NOW();
```

---

## Migrations

### Migration 001: Create Attempt Engine Tables

**File**: `apps/api/src/db/tenant/migrations/001_create_attempt_engine_tables.sql`

**Type**: Schema creation (forward-only)

**Rollback**: Via database snapshot restore only (per ADR-0008)

**Content**:

```sql
-- Migration: 001_create_attempt_engine_tables.sql
-- Purpose: Create unified attempts table, progress tracking, and idempotency tracking
-- Date: 2026-02-18
-- Status: Production-ready

BEGIN;

-- Create attempts table
CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  attempt_type VARCHAR(50) NOT NULL,
  exam_id UUID NOT NULL,
  question_snapshot JSONB NOT NULL,
  question_order UUID[] NOT NULL,
  grading_config_snapshot JSONB NOT NULL,
  mode VARCHAR(20) NOT NULL,
  flags_snapshot JSONB NOT NULL,
  time_limit_snapshot BIGINT,
  exam_version VARCHAR(20) NOT NULL,
  expected_schema_version INT NOT NULL,
  expected_product_version VARCHAR(20) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  finalized_at TIMESTAMP WITH TIME ZONE,
  server_start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  certificate_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  single_attempt_rule BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
  score NUMERIC(5,2),
  passed BOOLEAN,
  result_snapshot JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT valid_status CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'FINALIZED', 'EXPIRED', 'ABORTED')),
  CONSTRAINT valid_mode CHECK (mode IN ('RELAX', 'CHRONO', 'RUSH')),
  CONSTRAINT valid_attempt_type CHECK (attempt_type IN (
    'MCQ_ASSESSMENT', 'MCQ_EXAM', 'MCQ_SCHEDULED',
    'TOPIC_EXAM', 'EXERCISE_EXAM', 'TRADITIONAL_SCHEDULED'
  )),
  CONSTRAINT valid_score_range CHECK (score IS NULL OR (score >= 0 AND score <= 100))
);

-- Create indexes on attempts
CREATE INDEX idx_attempts_workspace_user_exam
  ON attempts(workspace_id, user_id, exam_id, status);
CREATE INDEX idx_attempts_workspace_user_status
  ON attempts(workspace_id, user_id, status)
  WHERE status IN ('IN_PROGRESS', 'SUBMITTED');
CREATE INDEX idx_attempts_status_finalized
  ON attempts(workspace_id, status, finalized_at);
CREATE INDEX idx_attempts_started_expiration
  ON attempts(workspace_id, started_at, time_limit_snapshot)
  WHERE status = 'IN_PROGRESS';
CREATE UNIQUE INDEX idx_single_attempt_rule
  ON attempts(exam_id, user_id)
  WHERE status = 'IN_PROGRESS' AND single_attempt_rule = TRUE;
CREATE INDEX idx_attempts_created_at
  ON attempts(workspace_id, created_at DESC);

-- Create attempt_progress table
CREATE TABLE attempt_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL,
  question_id UUID NOT NULL,
  user_answer JSONB,
  answered_at TIMESTAMP WITH TIME ZONE,
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_attempt FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
  CONSTRAINT unique_question_per_attempt UNIQUE (attempt_id, question_id)
);

-- Create indexes on attempt_progress
CREATE INDEX idx_attempt_progress_attempt
  ON attempt_progress(attempt_id);
CREATE INDEX idx_attempt_progress_answered
  ON attempt_progress(attempt_id, answered_at DESC);
CREATE INDEX idx_attempt_progress_flagged
  ON attempt_progress(attempt_id, flagged)
  WHERE flagged = TRUE;

-- Create submission_idempotency_keys table
CREATE TABLE submission_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  attempt_id UUID NOT NULL,
  submission_sequence INT NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  request_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  response_status INT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
  CONSTRAINT unique_submission_sequence UNIQUE (attempt_id, submission_sequence)
);

-- Create indexes on submission_idempotency_keys
CREATE UNIQUE INDEX idx_submission_idempotency_key
  ON submission_idempotency_keys(workspace_id, idempotency_key)
  WHERE expires_at > NOW();
CREATE INDEX idx_submission_cleanup
  ON submission_idempotency_keys(workspace_id, expires_at)
  WHERE expires_at <= NOW();

-- Update schema_version
UPDATE schema_metadata SET schema_version = 1, updated_at = NOW()
WHERE workspace_id = current_workspace_id;

COMMIT;
```

**Index Selection Rationale**:

- `idx_attempts_workspace_user_exam`: Primary query for checking existing attempts before start
- `idx_attempts_workspace_user_status`: Filter for active/submitted attempts for cleanup jobs
- `idx_attempts_status_finalized`: For analytics and result retrieval
- `idx_attempts_started_expiration`: For expiration job to find expired CHRONO/RUSH mode attempts
- `idx_single_attempt_rule`: Enforces single-attempt constraint at database level
- `idx_attempts_created_at`: For audit trails and historical queries

---

## API Endpoints

### Endpoint 1: Create Attempt

**Route**: `POST /api/workspaces/:slug/attempts`

**Authentication**: Required (Bearer token)

**Authorization**: User must have exam access role

**Middleware Stack**:

1. `tenantResolver({ source: 'path' })` → Resolve workspace from slug
2. `licenseMiddleware({ required: 'ACTIVE' })` → Validate license status
3. `correlationIdMiddleware()` → Generate correlation_id
4. `authMiddleware()` → Validate JWT token
5. `rbacMiddleware({ resource: 'exam', action: 'attempt_start' })`

**Request Body**:

```json
{
  "exam_id": "uuid",
  "attempt_type": "MCQ_EXAM|TOPIC_EXAM|EXERCISE_EXAM|MCQ_SCHEDULED|TRADITIONAL_SCHEDULED"
}
```

**Response (201 Created)**:

```json
{
  "success": true,
  "data": {
    "attempt_id": "attempt-uuid",
    "exam_id": "exam-uuid",
    "attempt_type": "MCQ_EXAM",
    "status": "IN_PROGRESS",
    "started_at": "2026-02-18T14:30:00Z",
    "mode": "CHRONO",
    "time_limit_seconds": 3600,
    "question_count": 20,
    "questions": [
      {
        "id": "question-uuid",
        "text": "What is 2+2?",
        "type": "MCQ",
        "options": ["4", "5", "6", "7"],
        "points": 5
      }
    ]
  },
  "error": null
}
```

**Response (423 Locked)**:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "WORKSPACE_SOFT_LOCKED",
    "message": "Workspace license is soft-locked. Contact administrator.",
    "status": 423,
    "correlation_id": "req-12345abcde"
  }
}
```

**Response (426 Upgrade Required)**:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VERSION_INCOMPATIBLE",
    "message": "Schema version 0 is not supported. Minimum required: 1",
    "status": 426,
    "correlation_id": "req-12345abcde"
  }
}
```

**Transactional Guarantee**: ACID

- All snapshot fields inserted atomically
- No partial records if transaction fails
- Rollback on schema validation error

**Snapshot Specification**:

The API MUST capture ALL of the following in `question_snapshot`:

1. Complete question text (exact copy at attempt time)
2. All question options (for MCQ; exact copy at attempt time)
3. Correct answer(s) (exact copy; used for grading)
4. Question metadata (points, type, etc.)
5. Randomization seed (if options randomized)

The API MUST capture ALL of the following in `grading_config_snapshot`:

1. Pass score percentage (e.g., 60%)
2. Total possible points
3. Question weights (if weighted grading)
4. Pass/fail logic (e.g., "SUM >= PASS_THRESHOLD")

The API MUST capture ALL of the following in `flags_snapshot`:

1. `review_allowed`: Can student review after submission?
2. `hints_allowed`: Can student request hints?
3. `show_correct_answer`: Can student see correct answers?
4. `randomize_options`: Options shuffled per student?
5. `one_question_per_page`: Single question or all visible?

---

### Endpoint 2: Save Progress / Answer Update

**Route**: `POST /api/workspaces/:slug/attempts/:id/progress`

**Authentication**: Required

**Middleware Stack**:

1. `tenantResolver({ source: 'path' })`
2. `licenseMiddleware({ required: 'ACTIVE' })`
3. `correlationIdMiddleware()`
4. `authMiddleware()`
5. `attemptAccessControl()` → Verify user owns attempt

**Request Body**:

```json
{
  "responses": [
    {
      "question_id": "question-uuid",
      "user_answer": {
        "selected_option": "option_id" // MCQ example
      },
      "flagged": false
    }
  ]
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "attempt_id": "attempt-uuid",
    "progress_count": 15,
    "responses_saved": 15,
    "time_remaining_seconds": 2400
  },
  "error": null
}
```

**Idempotency**: Upsert per (attempt_id, question_id)

- Sending same response twice produces same result
- No duplicate progress rows created
- TIMESTAMP updated; data identical

**Concurrency**: Non-blocking

- Multiple clients can update different questions simultaneously
- No FOR UPDATE lock required
- UPSERT ensures eventual consistency

**Frequency Constraint**: Client-side only (no server-side rate limiting for progress)

---

### Endpoint 3: Submit Attempt

**Route**: `POST /api/workspaces/:slug/attempts/:id/submit`

**Authentication**: Required

**Idempotency Header**: `Idempotency-Key: <uuid>` (optional; recommended)

**Middleware Stack**:

1. `tenantResolver({ source: 'path' })`
2. `licenseMiddleware({ required: 'ACTIVE' })`
3. `correlationIdMiddleware()`
4. `authMiddleware()`
5. `attemptAccessControl()`
6. `idempotencyMiddleware({ storage: 'redis-first', fallback: 'database' })`

**Request Body**:

```json
{
  "submission_reason": "MANUAL_SUBMIT|AUTO_TIMEOUT"
}
```

**Response (200 OK — First Submission)**:

```json
{
  "success": true,
  "data": {
    "attempt_id": "attempt-uuid",
    "status": "SUBMITTED",
    "submitted_at": "2026-02-18T15:30:00Z",
    "message": "Attempt submitted successfully. Grading in progress.",
    "submission_id": "submission-uuid"
  },
  "error": null
}
```

**Response (200 OK — Idempotent Resubmission)**:

```json
{
  "success": true,
  "data": {
    "attempt_id": "attempt-uuid",
    "status": "FINALIZED", // May be finalized if worker has completed
    "submitted_at": "2026-02-18T15:30:00Z",
    "score": 75.5,
    "passed": true,
    "message": "Attempt already submitted. Returning cached result."
  },
  "error": null
}
```

**Response (409 Conflict)**:

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

**Response (503 Service Unavailable — Lock Timeout)**:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ATTEMPT_CONCURRENCY_VIOLATION",
    "message": "Submission could not acquire lock after 3 retries. Please try again.",
    "status": 503,
    "correlation_id": "req-12345abcde"
  }
}
```

**Transaction Specification**:

```sql
BEGIN TRANSACTION (SERIALIZABLE isolation);
  1. SELECT * FROM attempts WHERE id = ? AND workspace_id = ? FOR UPDATE NOWAIT;
     -- If lock fails: CATCH → retry(backoff: 1s, 2s, 4s) → MAX 3 → return 503
     -- Lock timeout: 5 seconds (clarification Q3 response)

  2. IF status != 'IN_PROGRESS':
       RETURN cached_result (idempotent)

  3. IF submitted_at IS NOT NULL:
       RETURN cached_result (already submitted)

  4. UPDATE attempts
     SET status = 'SUBMITTED',
         submitted_at = NOW(),
         updated_at = NOW()
     WHERE id = ?

  5. ENQUEUE grading_job(
       attempt_id = ?,
       submission_sequence = next_sequence(),
       idempotency_key = hash(request)
     )
     -- If enqueue fails: ROLLBACK (attempt remains IN_PROGRESS)

  6. RECORD submission_idempotency_key (
       attempt_id = ?,
       submission_sequence = ?,
       idempotency_key = ?,
       response_status = 200,
       response_body = {...}
     )
COMMIT;
```

**Retry Logic**:

```
Attempt 1: lock_timeout = 5s
  → Retry with 1s backoff
Attempt 2: lock_timeout = 5s
  → Retry with 2s backoff
Attempt 3: lock_timeout = 5s
  → Retry with 4s backoff
Attempt 4: FAIL
  → Return 503 ATTEMPT_CONCURRENCY_VIOLATION
  → Move to DLQ if broker-side retry fails
```

---

### Endpoint 4: Get Attempt Status

**Route**: `GET /api/workspaces/:slug/attempts/:id`

**Authentication**: Required

**Middleware Stack**:

1. `tenantResolver({ source: 'path' })`
2. `licenseMiddleware({ required: 'ACTIVE' })`
3. `correlationIdMiddleware()`
4. `authMiddleware()`
5. `attemptAccessControl()`

**Response (200 OK — IN_PROGRESS)**:

```json
{
  "success": true,
  "data": {
    "attempt_id": "attempt-uuid",
    "status": "IN_PROGRESS",
    "progress": {
      "answered_count": 12,
      "flagged_count": 2,
      "total_questions": 20
    },
    "timing": {
      "started_at": "2026-02-18T14:30:00Z",
      "time_limit_seconds": 3600,
      "time_remaining_seconds": 2400,
      "mode": "CHRONO"
    }
  },
  "error": null
}
```

**Response (200 OK — FINALIZED)**:

```json
{
  "success": true,
  "data": {
    "attempt_id": "attempt-uuid",
    "status": "FINALIZED",
    "score": 75.5,
    "passed": true,
    "submitted_at": "2026-02-18T15:30:00Z",
    "finalized_at": "2026-02-18T15:30:30Z"
  },
  "error": null
}
```

---

### Endpoint 5: Get Attempt Result

**Route**: `GET /api/workspaces/:slug/attempts/:id/result`

**Authentication**: Required

**Authorization**: Student can view own result; instructor can view if permitted

**Middleware Stack**:

1. `tenantResolver({ source: 'path' })`
2. `licenseMiddleware({ required: 'ACTIVE' })`
3. `correlationIdMiddleware()`
4. `authMiddleware()`
5. `attemptAccessControl()`
6. `resultAccessControl()` → Verify review allowed or score ready

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "attempt_id": "attempt-uuid",
    "score": 75.5,
    "passed": true,
    "total_points": 100,
    "pass_score": 60,
    "summary": "Congratulations! You scored 75.5/100",
    "question_results": [
      {
        "question_id": "question-uuid",
        "text": "What is 2+2?",
        "type": "MCQ",
        "points_earned": 5,
        "points_possible": 5,
        "user_answer": {
          "selected_option": "option_0"
        },
        "correct_answer": {
          "selected_option": "option_0"
        },
        "feedback": "Correct!",
        "show_correct_answer": true
      }
    ]
  },
  "error": null
}
```

---

## Middleware Layers

### Middleware 1: Tenant Resolver

**Location**: `apps/api/src/middleware/tenantResolver.ts`

**Responsibility**: Resolve workspace from URL (slug or subdomain); obtain tenant DB connection

**Priority**: FIRST (before all other middleware)

**Implementation**:

```typescript
// Pseudo-code
export function tenantResolver() {
  return async (req, res, next) => {
    // 1. Extract slug from path or subdomain
    const slug = req.params.slug || extractSubdomainSlug(req.hostname);

    if (!slug) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_WORKSPACE", message: "Workspace not found" },
      });
    }

    // 2. Query master DB for workspace
    const workspace = await master.query(
      "SELECT id, schema_version FROM workspaces WHERE slug = ? LIMIT 1",
      [slug],
    );

    if (!workspace) {
      return res.status(404).json({
        success: false,
        error: { code: "WORKSPACE_NOT_FOUND", message: "Workspace not found" },
      });
    }

    // 3. Obtain tenant DB connection pool
    const tenantDb = await getTenantDatabaseConnection(workspace.id);

    // 4. Attach to request context
    req.workspace = workspace;
    req.tenantDb = tenantDb;
    req.workspaceId = workspace.id;

    next();
  };
}
```

**Error Handling**:

- Missing slug → 400 Bad Request
- Workspace not found → 404 Not Found
- DB connection failure → 503 Service Unavailable

---

### Middleware 2: License Middleware

**Location**: `apps/api/src/middleware/licenseMiddleware.ts`

**Responsibility**: Validate license status before workspace-bound operations

**Priority**: SECOND (after tenant resolver, before business logic)

**Configuration**:

```typescript
interface LicenseMiddlewareOptions {
  required?: "ACTIVE" | "ANY"; // Default: 'ACTIVE'
  allowSoftLocked?: boolean; // Default: false
}
```

**Implementation**:

```typescript
export function licenseMiddleware(opts = {}) {
  return async (req, res, next) => {
    const { workspaceId, tenantDb } = req;

    // 1. Query master DB for license
    const license = await master.query(
      "SELECT id, status, product_version FROM licenses WHERE workspace_id = ? LIMIT 1",
      [workspaceId],
    );

    if (!license) {
      return res.status(404).json({
        success: false,
        error: { code: "LICENSE_NOT_FOUND", message: "License not found" },
      });
    }

    // 2. Validate license status
    if (license.status === "ARCHIVED") {
      return res.status(403).json({
        success: false,
        error: {
          code: "WORKSPACE_ARCHIVED",
          message: "Workspace is archived. No new operations allowed.",
          status: 403,
        },
      });
    }

    if (license.status === "SOFT_LOCKED") {
      return res.status(423).json({
        success: false,
        error: {
          code: "WORKSPACE_SOFT_LOCKED",
          message: "Workspace license is soft-locked.",
          status: 423,
        },
      });
    }

    if (license.status !== "ACTIVE" && opts.required === "ACTIVE") {
      return res.status(503).json({
        success: false,
        error: {
          code: "LICENSE_INVALID",
          message: "License status invalid",
          status: 503,
        },
      });
    }

    // 3. Validate version compatibility
    const workspace = req.workspace;
    const MIN_SCHEMA_VERSION = 1;
    const MIN_PRODUCT_VERSION = "1.0.0";

    if (workspace.schema_version < MIN_SCHEMA_VERSION) {
      return res.status(426).json({
        success: false,
        error: {
          code: "SCHEMA_VERSION_INCOMPATIBLE",
          message: `Schema version ${workspace.schema_version} is not supported`,
          status: 426,
        },
      });
    }

    if (!isProductVersionCompatible(license.product_version)) {
      return res.status(426).json({
        success: false,
        error: {
          code: "PRODUCT_VERSION_INCOMPATIBLE",
          message: `Product version ${license.product_version} is not supported`,
          status: 426,
        },
      });
    }

    // 4. Attach to request context
    req.license = license;

    next();
  };
}
```

**Applied To Routes**:

- All `/api/workspaces/:slug/*` routes
- All `/api/attempts/*` routes (workspace-bound)

**Error Codes**:

- 403 WORKSPACE_ARCHIVED
- 423 WORKSPACE_SOFT_LOCKED
- 426 SCHEMA_VERSION_INCOMPATIBLE
- 426 PRODUCT_VERSION_INCOMPATIBLE
- 503 LICENSE_INVALID

---

### Middleware 3: Correlation ID

**Location**: `apps/api/src/middleware/correlationIdMiddleware.ts`

**Responsibility**: Generate or propagate correlation_id through request pipeline

**Priority**: THIRD (early, before business logic)

**Implementation**:

```typescript
export function correlationIdMiddleware() {
  return (req, res, next) => {
    // 1. Check for existing correlation_id in headers
    const correlationId =
      req.headers["x-correlation-id"] || req.headers["correlation-id"] || generateUUID();

    // 2. Attach to request
    req.correlationId = correlationId;

    // 3. Attach to response headers
    res.set("X-Correlation-ID", correlationId);

    // 4. Attach to logger context
    logger.setContext({ correlation_id: correlationId });

    next();
  };
}
```

**Header Convention**:

- Request header: `X-Correlation-ID` or `Correlation-ID`
- Response header: `X-Correlation-ID`
- Log field: `correlation_id`

**Propagation**: All downstream calls (worker jobs, DB queries, external APIs) include
correlation_id

---

### Middleware 4: Idempotency

**Location**: `apps/api/src/middleware/idempotencyMiddleware.ts`

**Responsibility**: Deduplicate requests based on idempotency key

**Priority**: After tenant resolver and license middleware; before business logic

**Storage Strategy**: Redis (fast-path) + PostgreSQL (fallback; per clarification Q2)

**TTL**: 24 hours (clarification Q2)

**Implementation**:

```typescript
export function idempotencyMiddleware(opts = {}) {
  return async (req, res, next) => {
    // 1. Determine if operation is idempotent
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return next(); // GET is always safe
    }

    // 2. Extract idempotency key from header or generate one
    const idempotencyKey =
      req.headers["idempotency-key"] || `${req.method}:${req.path}:${req.user?.id}:${Date.now()}`;

    if (!idempotencyKey) {
      return next();
    }

    // 3. Check Redis cache first
    let cachedResponse = await redis.get(`idempotency:${idempotencyKey}`);

    if (cachedResponse) {
      return res.status(cachedResponse.status).json(cachedResponse.body);
    }

    // 4. Check database fallback
    const idempotencyRecord = await req.tenantDb.query(
      "SELECT response_body, response_status FROM submission_idempotency_keys WHERE idempotency_key = ? AND expires_at > NOW() LIMIT 1",
      [idempotencyKey],
    );

    if (idempotencyRecord) {
      return res.status(idempotencyRecord.response_status).json(idempotencyRecord.response_body);
    }

    // 5. Intercept response to cache it
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      const status = res.statusCode;

      // Cache in Redis
      redis.setex(
        `idempotency:${idempotencyKey}`,
        24 * 60 * 60, // 24 hour TTL
        { status, body: data },
      );

      // Cache in database
      req.tenantDb
        .query("INSERT INTO submission_idempotency_keys (...) VALUES (...)", [
          req.workspaceId,
          idempotencyKey,
          status,
          JSON.stringify(data),
        ])
        .catch((err) => logger.warn("Idempotency DB cache failed", err));

      return originalJson(data);
    };

    next();
  };
}
```

---

## Transaction Boundaries

### Operation 1: Attempt Creation (ATOMIC)

**Isolation Level**: SERIALIZABLE

**Lock Type**: No explicit lock (constraints enforce uniqueness)

**Sequence**:

```
BEGIN TRANSACTION;

  -- Validate workspace and license (done by middleware; no lock)

  -- 1. Check no existing IN_PROGRESS attempt for same exam (if single_attempt_rule)
  SELECT * FROM attempts
  WHERE workspace_id = ?
    AND user_id = ?
    AND exam_id = ?
    AND status = 'IN_PROGRESS'
    AND single_attempt_rule = TRUE;

  IF exists THEN
    ROLLBACK;
    RETURN 409 CONFLICT;
  END IF;

  -- 2. Load and snapshot exam configuration
  exam = loadExamFromExamTable(exam_id);
  questions = loadQuestionsForExam(exam_id);
  shuffledOrder = shuffleQuestions(questions);
  gradingConfig = buildGradingConfig(exam);

  -- 3. Insert attempt with snapshot fields
  INSERT INTO attempts (
    id, workspace_id, user_id, exam_id, attempt_type,
    question_snapshot, question_order, grading_config_snapshot,
    mode, flags_snapshot, time_limit_snapshot,
    exam_version, expected_schema_version, expected_product_version,
    started_at, server_start_time, status
  ) VALUES (
    gen_random_uuid(), ?, ?, ?, ?,
    to_jsonb(questions), shuffledOrder, to_jsonb(gradingConfig),
    exam.mode, to_jsonb(exam.flags), exam.time_limit,
    exam.version, workspace.schema_version, license.product_version,
    NOW(), NOW(), 'IN_PROGRESS'
  )
  RETURNING id;

  -- 4. Create attempt_progress records (one per question)
  INSERT INTO attempt_progress (attempt_id, question_id, user_answer, flagged)
  VALUES (attempt_id, ?, NULL, FALSE)
  FOR EACH question_id IN shuffledOrder;

COMMIT;
```

**Failure Scenarios**:

| Failure Point                   | Action   | Result                                             |
| ------------------------------- | -------- | -------------------------------------------------- |
| Single-attempt check fails      | ROLLBACK | 409 Conflict                                       |
| Question load fails             | ROLLBACK | 500 Server Error                                   |
| INSERT attempt fails            | ROLLBACK | 500 Server Error                                   |
| INSERT progress fails (partial) | ROLLBACK | Entire transaction rolled back; no partial records |

**Idempotency**: If called twice with same (workspace_id, user_id, exam_id):

- Second call detects IN_PROGRESS attempt exists
- Returns existing attempt (idempotent)

---

### Operation 2: Progress Update (EVENTUAL CONSISTENCY)

**Isolation Level**: READ COMMITTED

**Lock Type**: None (UPSERT is optimistic)

**Sequence**:

```
BEGIN TRANSACTION;

  -- UPSERT each answer update
  INSERT INTO attempt_progress (attempt_id, question_id, user_answer, answered_at, updated_at)
  VALUES (?, ?, ?, NOW(), NOW())
  ON CONFLICT (attempt_id, question_id)
  DO UPDATE SET
    user_answer = EXCLUDED.user_answer,
    answered_at = EXCLUDED.answered_at,
    updated_at = NOW();

COMMIT;
```

**Concurrency**: Multiple clients updating different questions happen in parallel (no lock
contention)

**Idempotency**: Replaying same answer update produces identical result (last-write-wins)

**No Blocking**: Non-critical path; no FOR UPDATE required

---

### Operation 3: Submission (PESSIMISTIC LOCK)

**Isolation Level**: SERIALIZABLE

**Lock Type**: Row-level pessimistic lock (SELECT FOR UPDATE)

**Lock Timeout**: 5 seconds (clarification Q3)

**Retry Strategy**: 3 attempts with exponential backoff (1s, 2s, 4s)

**Sequence**:

```
ATTEMPT_COUNT = 0;
MAX_ATTEMPTS = 3;
BACKOFF = [1, 2, 4]; // seconds

WHILE ATTEMPT_COUNT < MAX_ATTEMPTS:
  TRY:
    BEGIN TRANSACTION (SERIALIZABLE);

      -- 1. Acquire row lock with timeout
      SELECT * FROM attempts
      WHERE id = ? AND workspace_id = ?
      FOR UPDATE NOWAIT;  -- Timeout: 5 seconds

      -- 2. Status validation
      IF status != 'IN_PROGRESS':
        ROLLBACK;
        RETURN 409 CONFLICT (already submitted);
      END IF;

      IF submitted_at IS NOT NULL:
        ROLLBACK;
        RETURN idempotent_response;
      END IF;

      -- 3. Update status to SUBMITTED
      UPDATE attempts
      SET status = 'SUBMITTED',
          submitted_at = NOW(),
          updated_at = NOW()
      WHERE id = ?;

      -- 4. Enqueue grading job
      ENQUEUE grading_job(
        attempt_id = ?,
        submission_sequence = next_sequence(),
        idempotency_key = hash(request)
      );

      -- 5. Record idempotency key
      INSERT INTO submission_idempotency_keys (
        workspace_id, attempt_id, submission_sequence,
        idempotency_key, response_status, response_body
      ) VALUES (?, ?, ?, ?, 200, {...});

    COMMIT;
    RETURN 200 OK;

  CATCH TimeoutError:
    ATTEMPT_COUNT += 1;
    IF ATTEMPT_COUNT < MAX_ATTEMPTS:
      SLEEP(BACKOFF[ATTEMPT_COUNT]);
      CONTINUE;
    ELSE:
      RETURN 503 ATTEMPT_CONCURRENCY_VIOLATION;
    END IF;

  CATCH OtherError:
    ROLLBACK;
    RETURN 500 SERVER_ERROR;

END WHILE;
```

**Failure Handling**:

| Error               | Action               | Response                                    |
| ------------------- | -------------------- | ------------------------------------------- |
| Lock timeout (5s)   | Retry with backoff   | After 3 retries: 503                        |
| Enqueue failure     | Rollback transaction | Attempt remains IN_PROGRESS; client retries |
| DB connection error | Rollback transaction | 503 Service Unavailable                     |
| Query parse error   | Rollback transaction | 500 Server Error                            |

**Idempotency** (clarification Q2):

- If already SUBMITTED: Return cached result from `submission_idempotency_keys` table
- If Redis cache hit: Return instantly (24-hour TTL)
- If Redis miss but DB hit: Return from DB (fallback)
- If no prior record: Process normally

---

### Operation 4: Worker Grading (PESSIMISTIC LOCK)

**Isolation Level**: SERIALIZABLE

**Lock Type**: Row-level pessimistic lock (SELECT FOR UPDATE)

**Sequence**:

```
BEGIN TRANSACTION;

  -- 1. Acquire lock on attempt row
  SELECT * FROM attempts
  WHERE id = ? AND workspace_id = ?
  FOR UPDATE;  -- Wait up to 30 seconds

  -- 2. Check status (idempotency)
  IF status = 'FINALIZED':
    ROLLBACK;
    RETURN (already graded; skip)
  END IF;

  IF status != 'SUBMITTED':
    ROLLBACK;
    LOG warn: "Attempt in unexpected status for grading: ${status}";
    RETURN (skip; let expiration handler clean up)
  END IF;

  -- 3. Verify version compatibility
  IF expected_schema_version < MIN_SUPPORTED_SCHEMA_VERSION:
    score = 0;
    passed = FALSE;
    error_reason = "Schema version incompatible";
  ELSE:
    -- 4. Retrieve snapshot and compute score
    questions = attempt.question_snapshot;
    answers = SELECT user_answer FROM attempt_progress WHERE attempt_id = ?;
    grading_config = attempt.grading_config_snapshot;

    -- 5. Compute score deterministically
    score = computeScore(questions, answers, grading_config);
    passed = evaluatePassLogic(score, grading_config);
    error_reason = NULL;
  END IF;

  -- 6. Build result snapshot
  result_snapshot = buildResultSnapshot(questions, answers, score, passed);

  -- 7. Update attempt with results
  UPDATE attempts
  SET status = 'FINALIZED',
      score = score,
      passed = passed,
      result_snapshot = to_jsonb(result_snapshot),
      finalized_at = NOW(),
      updated_at = NOW()
  WHERE id = ?;

  -- 8. Enqueue certificate job if passed
  IF passed AND certificate_enabled:
    ENQUEUE generate_certificate_job(attempt_id = ?);
  END IF;

COMMIT;
```

**Retry Strategy** (per spec):

- Max retries: 5 (NOT 3 like submission; grading is more critical)
- Backoff: Exponential (1s, 2s, 4s, 8s, 16s)
- After max retries: Move to DLQ with manual review flag

**Failure Handling**:

| Failure                   | Action                             | Recovery                           |
| ------------------------- | ---------------------------------- | ---------------------------------- |
| Deadlock (error 40P01)    | Rollback                           | Re-enqueue with backoff            |
| Lock timeout (30s)        | Rollback                           | Re-enqueue with backoff            |
| Score computation error   | Rollback                           | Move to DLQ after max retries      |
| Result write error        | Rollback                           | Move to DLQ after max retries      |
| Certificate enqueue fails | Rollback (attempt stays FINALIZED) | Log warning; manual retry possible |

---

### Operation 5: Expiration (TIME-BASED STATE MACHINE)

**Isolation Level**: SERIALIZABLE

**Trigger**: Background job (e.g., every 5 minutes)

**Sequence**:

```
FOR EACH workspace IN active_workspaces:
  FOR EACH attempt IN (
    SELECT id FROM attempts
    WHERE workspace_id = ?
      AND status = 'IN_PROGRESS'
      AND started_at + make_interval(secs => time_limit_snapshot) < NOW()
      AND time_limit_snapshot IS NOT NULL  -- Not RELAX mode
  ):
    TRY:
      BEGIN TRANSACTION;

        -- 1. Acquire lock
        SELECT * FROM attempts WHERE id = attempt.id FOR UPDATE;

        -- 2. Verify still IN_PROGRESS (concurrent submission might have changed)
        IF status != 'IN_PROGRESS':
          ROLLBACK;
          CONTINUE (next attempt);
        END IF;

        -- 3. Mark as EXPIRED
        UPDATE attempts
        SET status = 'EXPIRED',
            updated_at = NOW()
        WHERE id = ?;

        -- 4. Enqueue grading job (grade with auto-submit reason)
        ENQUEUE grading_job(
          attempt_id = ?,
          submission_sequence = auto_increment(),
          submission_reason = 'AUTO_TIMEOUT'
        );

      COMMIT;

    CATCH DeadlockError:
      LOG warn: "Expiration job deadlocked; skipping this attempt";
      CONTINUE (will retry in next job run);

    CATCH Error:
      LOG error: "Expiration job failed for attempt ${attempt.id}";
      CONTINUE (don't block other attempts);
```

**Concurrency Protection**: FOR UPDATE prevents race between expiration and manual submission

**No Partial Expiration**: If transaction fails for one attempt, others continue unaffected

---

## Idempotency Strategy

### Storage Architecture (Clarification Q2 Response)

**Authoritative Storage**: PostgreSQL `submission_idempotency_keys` table

**Performance Cache**: Redis with 24-hour TTL

**Lookup Sequence**:

1. Check Redis first (O(1) lookup; nanosecond response)
2. If miss: Query PostgreSQL (O(log n) with index)
3. On write: Store in both Redis and DB simultaneously
4. Cleanup: DB cleanup job removes expired records (>24 hours old)

---

### Idempotency Key Components

**For Submission Endpoint** (`POST /api/workspaces/:slug/attempts/:id/submit`):

```
idempotency_key = HASH(
  method = 'POST',
  path = '/api/workspaces/{slug}/attempts/{id}/submit',
  workspace_id = '{workspace_id}',
  attempt_id = '{attempt_id}',
  user_id = '{user_id}',
  idempotency_header = req.headers['idempotency-key'],  // If provided
  request_body = req.body
)
```

**Lookup**:

```sql
SELECT response_body, response_status FROM submission_idempotency_keys
WHERE workspace_id = ?
  AND idempotency_key = ?
  AND expires_at > NOW()
LIMIT 1;
```

---

### Idempotency Rules Per Operation

| Operation        | Idempotency Guarantee                                                  | Storage                | TTL                 |
| ---------------- | ---------------------------------------------------------------------- | ---------------------- | ------------------- |
| Attempt Creation | Unique constraint on (workspace_id, user_id, exam_id); return existing | DB only                | Lifetime of attempt |
| Answer Progress  | UPSERT per (attempt_id, question_id); last-write-wins                  | DB only                | Lifetime of attempt |
| Submit Attempt   | Entry in submission_idempotency_keys; return cached response           | DB + Redis             | 24 hours            |
| Grade Attempt    | Idempotent computation; check if FINALIZED before grading              | None (DB status check) | N/A                 |

---

### Replay Semantics

**Double Submission Example**:

```
Timeline:

T1: Student submits attempt_id=A
    → Acquire lock
    → status IN_PROGRESS → SUBMITTED
    → Enqueue grading_job
    → Write idempotency_key to Redis + DB
    → Return 200 OK

T2: Network timeout; student sees error
    → Student retries with same Idempotency-Key header

T3: Client retries submission
    → Redis queries idempotency_key
    → CACHE HIT: Return cached response from T1
    → No duplicate grading_job enqueued
    → Student gets same result

Result: ✅ No duplicate grading; response identical
```

---

## Concurrency & Locking

### Lock Strategy Specification (Clarification Q3 Response)

**Type**: Pessimistic (row-level locking with SELECT FOR UPDATE)

**Rationale**:

- Exam submissions are critical operations
- Pessimistic prevents race conditions transparently
- Optimistic would require retry loops in application code
- Academic integrity prioritized over throughput

**Lock Behavior**:

| Operation        | Lock Type                     | Duration                             | Conflict Handling                      |
| ---------------- | ----------------------------- | ------------------------------------ | -------------------------------------- |
| Attempt Creation | No lock (constraints enforce) | N/A                                  | Unique constraint rejects duplicate    |
| Progress Update  | No lock (UPSERT optimistic)   | N/A                                  | Last-write-wins                        |
| Submission       | FOR UPDATE pessimistic lock   | Duration of transaction (~100-500ms) | Retry with backoff (3 times); then 503 |
| Grading          | FOR UPDATE pessimistic lock   | Duration of transaction (~1-5s)      | Exponential backoff (max 5 retries)    |
| Expiration       | FOR UPDATE pessimistic lock   | Duration of transaction (~100ms)     | Skip if already processed              |

---

### Lock Timeout Specification (Clarification Q3 Response)

**Submission Lock Timeout**: 5 seconds

- If lock cannot be acquired within 5 seconds, fail
- Retry up to 3 times with exponential backoff

**Grading Lock Timeout**: 30 seconds

- If lock cannot be acquired within 30 seconds, fail
- Retry up to 5 times with exponential backoff

**Implementation**:

```sql
-- PostgreSQL syntax for lock timeout
SET lock_timeout = '5s';  -- Before submission SELECT FOR UPDATE

BEGIN TRANSACTION;
  SELECT * FROM attempts
  WHERE id = ? AND workspace_id = ?
  FOR UPDATE;  -- Times out after 5 seconds
END;

-- If timeout: PostgreSQL raises error 'lock_timeout_exceeded'
-- Application catches error and implements retry logic
```

**Retry Logic** (Submission, per clarification Q1):

```
retry_count = 0;
backoff_sequence = [1, 2, 4];  // seconds

while retry_count < 3:
  try:
    set lock_timeout = 5s;
    execute_submission_transaction();
    return 200 OK;
  except LockedError or LockTimeoutError:
    retry_count += 1;
    if retry_count >= 3:
      log.error("Submission lock timeout after 3 retries");
      return 503 ATTEMPT_CONCURRENCY_VIOLATION;
    await sleep(backoff_sequence[retry_count - 1] * 1000); // ms
```

---

### Deadlock Prevention

**Scenario**: Two workers try to grade same attempt AND both grab another resource

**Risk**: PostgreSQL deadlock error 40P01

**Prevention Strategy**:

1. **Single Lock**: Only lock attempts table; no multi-resource transactions
2. **Lock Ordering**: Always lock in same order (workers lock same resource first)
3. **Fast Operations**: Lock held for minimal time (100-1000ms max)
4. **Deadlock Recovery**: Catch error and retry (per spec retry logic)

**Implementation** (deduplicate concurrent grading):

```sql
-- Two workers try to grade attempt_id=A simultaneously

Worker 1:
  SELECT * FROM attempts WHERE id = A FOR UPDATE;
  → Acquires lock
  → Computes score
  → Writes result
  COMMIT

Worker 2:
  SELECT * FROM attempts WHERE id = A FOR UPDATE;
  → WAITS for lock (blocks until Worker 1 commits)

Worker 2:
  → Acquires lock
  → Reads status = 'FINALIZED'
  → Idempotency check: already finished
  → ROLLBACK (skip grading)

Result: ✅ Only one worker grades; second worker detects and skips
```

---

### Concurrency Load Test Specification

**Test**: 100 concurrent submissions to same attempt (worst-case)

**Expected Behavior**:

- First submission acquires lock → SUBMITTED → grading_job enqueued
- Next 99 submissions wait on lock (5s timeout)
- After 5s: Each times out, retries with backoff
- After 3 retries: 99 submissions return 503 ATTEMPT_CONCURRENCY_VIOLATION
- Student safely retries; lock acquired eventually; idempotency prevents duplicate grading

**Acceptable Performance**:

- Submission latency: <500ms (optimal); <5s (acceptable)
- After timeout: Automatic retry by client SDK
- No data corruption (idempotency guaranteed)
- No duplicate grading (transaction serialization guaranteed)

---

## Version Enforcement Strategy (Clarification Q4 Response)

### Check Timing: ALL (Creation + Submission + Grading)

**On Attempt Creation** (blocking):

```
IF tenant.schema_version < MIN_SUPPORTED_SCHEMA_VERSION (1):
  RETURN 426 UPGRADE_REQUIRED

IF license.product_version < MIN_PRODUCT_VERSION (1.0.0):
  RETURN 426 UPGRADE_REQUIRED

IF license.product_version > CURRENT_PRODUCT_VERSION:
  RETURN 426 VERSION_TOO_NEW  // Client is newer than server
```

**On Attempt Submission** (non-blocking for in-flight):

```
IF (license.status == SOFT_LOCKED):
  ALLOW submission (in-flight attempts must complete)

IF (license.status == ARCHIVED):
  ALLOW submission (in-flight attempts must complete)
```

Note: License status checks occur; version checks only at creation.

**On Attempt Grading** (worker validation):

```
IF attempt.expected_schema_version < MIN_SUPPORTED_SCHEMA_VERSION:
  score = 0, passed = false
  MARK FINALIZED with error: "Schema version incompatible"
  LOG: Error; do not corrupt grading

IF attempt.expected_product_version NOT IN supported_range:
  score = 0, passed = false
  MARK FINALIZED with error: "Product version incompatible"
  LOG: Error; do not corrupt grading
```

---

### Backward Compatibility Strategy

**Supported Versions**:

```
MIN_SUPPORTED_SCHEMA_VERSION = 1
CURRENT_SCHEMA_VERSION = 1
MAX_COMPATIBLE_SCHEMA_VERSION = ∞  (forward-compatible)

MIN_PRODUCT_VERSION = "1.0.0"
CURRENT_PRODUCT_VERSION = "1.0.0"  (will update per release)
MAX_COMPATIBLE_PRODUCT_VERSION = "∞"  (forward-compatible within major version)
```

**Upgrade Semantics**:

- Attempts created before schema upgrade: Snapshot stores `expected_schema_version=0`
- When grading: Check `0 < MIN_SUPPORTED_SCHEMA_VERSION (1)` → Fail safe (error result)
- Result: Attempt marked FINALIZED with error; audit trail preserved; no silent corruption

---

### In-Flight Attempt Behavior During Migration

**Scenario**: Schema migration ongoing; students have IN_PROGRESS attempts

**Behavior** (clarification Q4 response):

- New attempts: BLOCKED with 503 MIGRATION_IN_PROGRESS
- In-flight attempts: CAN SUBMIT (no version check at submission)
- Grading: Worker validates expected_schema_version matches runtime schema
- If mismatch: Grade as error (score=0, passed=false); do not corrupt

**Implementation**:

```
During migration:
  1. Lock all workspace databases
  2. Run migration script
  3. Update schema_version in metadata
  4. Release lock

Attempt creation checks:
  IF migration_lock held:
    RETURN 503 MIGRATION_IN_PROGRESS

Attempt submission:
  (No version check; any in-flight attempt can submit)

Worker grading:
  IF expected_schema_version != current_schema_version:
    IF not backwards_compatible:
      MARK FINALIZED with error
    ELSE:
      Grade normally (backward-compatible logic)
```

---

## License Enforcement

### License State Transition Enforcement (Clarification Q5 Response)

**Definition of States**:

- **ACTIVE**: Full operation; all attempts allowed
- **SOFT_LOCKED**: Grace period; existing attempts complete; no new attempts
- **ARCHIVED**: System inactive; no operations allowed

---

### License Check Points

**Point 1: Attempt Creation**

```
IF license.status == ACTIVE:
  ALLOW attempt creation

IF license.status == SOFT_LOCKED:
  BLOCK (423 WORKSPACE_SOFT_LOCKED)

IF license.status == ARCHIVED:
  BLOCK (403 WORKSPACE_ARCHIVED)

IF license NOT FOUND:
  BLOCK (404)
```

**Point 2: Attempt Submission** (clarification Q5 response: PROCEED)

```
IF license.status == ACTIVE:
  ALLOW submission

IF license.status == SOFT_LOCKED:
  ALLOW submission (in-flight must complete)

IF license.status == ARCHIVED:
  ALLOW submission (in-flight must complete)
```

**Point 3: Worker Grading** (clarification Q5 response: CONTINUE)

```
IF license.status == ACTIVE:
  GRADE normally

IF license.status == SOFT_LOCKED:
  GRADE normally (in-flight completion required)

IF license.status == ARCHIVED:
  GRADE normally (preserve audit trail)
  LOG: "Grading attempt for archived license"
```

---

### License Transitions Impact

**Transition: ACTIVE → SOFT_LOCKED**

```
Effect on attempts:
  - IN_PROGRESS: Can continue answering; CANNOT submit (blocked at submission point)
  - SUBMITTED: Can finalize (grading completes)
  - FINALIZED: No change

Recovery:
  - If license restored (SOFT_LOCKED → ACTIVE): Student can resume; no automatic recovery
  - Student must click resume; manual interaction required
```

**Transition: ACTIVE → ARCHIVED**

```
Effect on attempts:
  - IN_PROGRESS: Can submit (submission allowed per Q5 answer); grading completes
  - SUBMITTED: Grading completes (worker continues)
  - FINALIZED: Results accessible to institutional admins only

Recovery:
  - No recovery possible; archived workspace is terminal
  - Historical data preserved for compliance audit
```

---

## Error Contract (RFC 7807)

### Standard Response Format

All API responses follow this format:

```json
{
  "success": boolean,
  "data": object | null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "status": HTTP_STATUS_CODE,
    "correlation_id": "req-uuid"
  } | null
}
```

### Error Code Catalog

| HTTP Status | Error Code                    | Example Message                                   | Trigger                      |
| ----------- | ----------------------------- | ------------------------------------------------- | ---------------------------- |
| 400         | INVALID_REQUEST               | Missing required field: exam_id                   | Malformed request            |
| 401         | UNAUTHORIZED                  | Authentication token missing or invalid           | No Auth header               |
| 403         | WORKSPACE_ARCHIVED            | Workspace is archived                             | License status = ARCHIVED    |
| 404         | WORKSPACE_NOT_FOUND           | Workspace slug not found                          | Invalid slug                 |
| 404         | ATTEMPT_NOT_FOUND             | Attempt ID not found                              | Invalid attempt ID           |
| 409         | ATTEMPT_ALREADY_SUBMITTED     | This attempt has already been submitted           | Duplicate submission         |
| 409         | ATTEMPT_CONCURRENCY_VIOLATION | Submission could not acquire lock after 3 retries | Lock contention              |
| 422         | INVALID_ATTEMPT_CONFIG        | Snapshot validation failed                        | Config error at creation     |
| 423         | WORKSPACE_SOFT_LOCKED         | Workspace license is soft-locked                  | License status = SOFT_LOCKED |
| 426         | SCHEMA_VERSION_INCOMPATIBLE   | Schema version 0 is not supported                 | DB schema outdated           |
| 426         | PRODUCT_VERSION_INCOMPATIBLE  | Product version 2.0 is not supported              | License/product mismatch     |
| 429         | RATE_LIMIT_EXCEEDED           | Rate limit exceeded                               | Too many requests            |
| 500         | INTERNAL_SERVER_ERROR         | Unexpected server error                           | Unhandled exception          |
| 503         | SERVICE_UNAVAILABLE           | Service temporarily unavailable                   | DB down; queue full          |
| 503         | MIGRATION_IN_PROGRESS         | Schema migration in progress                      | Migration lock held          |
| 503         | GRADING_FAILED                | Grading job failed after max retries              | Worker error after retries   |

### Error Logging

Every error is logged with:

```json
{
  "timestamp": "2026-02-18T14:30:00Z",
  "level": "ERROR",
  "service": "api",
  "error_code": "ATTEMPT_ALREADY_SUBMITTED",
  "error_message": "This attempt has already been submitted",
  "correlation_id": "req-12345",
  "workspace_id": "ws-uuid",
  "user_id": "user-uuid",
  "attempt_id": "attempt-uuid",
  "stack_trace": "[optional; only in DEBUG mode]"
}
```

---

## Structured Logging

### Log Format

All logs are JSON-formatted with mandatory fields:

```json
{
  "timestamp": "2026-02-18T14:30:00.123Z",
  "level": "INFO|WARN|ERROR|DEBUG",
  "service": "api|worker|migration",
  "message": "Descriptive log message",
  "correlation_id": "req-12345abcde",
  "workspace_slug": "acme-university",
  "workspace_id": "ws-uuid",
  "user_id": "user-uuid",
  "attempt_id": "attempt-uuid",
  "operation": "create|submit|grade|progress|expire",
  "duration_ms": 123,
  "additional_context": {}
}
```

### Log Events

**On Attempt Creation**:

```json
{
  "level": "INFO",
  "message": "Attempt created successfully",
  "operation": "create",
  "attempt_id": "att-123",
  "exam_id": "exam-456",
  "attempt_type": "MCQ_EXAM",
  "mode": "CHRONO",
  "question_count": 20,
  "time_limit_seconds": 3600,
  "snapshot_size_bytes": 12345
}
```

**On Attempt Submission**:

```json
{
  "level": "INFO",
  "message": "Attempt submitted",
  "operation": "submit",
  "attempt_id": "att-123",
  "question_count": 20,
  "answered_count": 18,
  "status": "SUBMITTED",
  "duration_ms": 245,
  "submission_sequence": 1
}
```

**On License Validation Failure**:

```json
{
  "level": "WARN",
  "message": "Attempt creation blocked due to license state",
  "operation": "create",
  "reason": "WORKSPACE_SOFT_LOCKED",
  "license_status": "SOFT_LOCKED",
  "workspace_id": "ws-uuid"
}
```

**On Worker Grading Started**:

```json
{
  "level": "INFO",
  "message": "Grading started",
  "service": "worker",
  "operation": "grade",
  "attempt_id": "att-123",
  "question_count": 20,
  "attempt_type": "MCQ_EXAM"
}
```

**On Worker Grading Completed**:

```json
{
  "level": "INFO",
  "message": "Grading completed",
  "service": "worker",
  "operation": "grade",
  "attempt_id": "att-123",
  "score": 75.5,
  "passed": true,
  "duration_ms": 1234,
  "certificate_enqueued": true
}
```

**On Grading Error**:

```json
{
  "level": "ERROR",
  "message": "Grading failed; moving to DLQ",
  "service": "worker",
  "operation": "grade",
  "attempt_id": "att-123",
  "error_reason": "Division by zero in score calculation",
  "retry_count": 5,
  "status": "MOVED_TO_DLQ"
}
```

### Log Redaction Rules

**Never Log**:

- Student answers (personally identifiable academic data)
- Scores in plaintext (only log pass/fail or aggregate stats)
- Passwords, authentication tokens, API keys
- Full snapshot JSON (log size only)

**Safe to Log**:

- Attempt metadata (id, exam_id, mode, timing)
- Status transitions
- Error codes and categories
- Operation durations
- Counts (question_count, answered_count, etc.)

---

## Worker Job Schema

### Job Type: GRADE_ATTEMPT

**Queue Name**: `zidney.grading`

**Producer**: API layer (after submission)

**Consumer**: Worker service

**Payload**:

```json
{
  "job_type": "GRADE_ATTEMPT",
  "attempt_id": "attempt-uuid",
  "submission_sequence": 1,
  "idempotency_key": "hash-of-submission",
  "submission_reason": "MANUAL_SUBMIT|AUTO_TIMEOUT",
  "correlation_id": "req-12345abcde",
  "created_at": "2026-02-18T15:30:00Z"
}
```

---

### Job Processing Specification

**Retry Strategy** (per clarification Q1):

- **Max Retries**: 3 (for submission enqueue failure; different from worker retry)
- **Backoff**: Exponential (1s → 2s → 4s)
- **After Max Retries**: Move to DLQ with flag: `manual_review_required = true`

**Worker-Side Retry** (if job fails during grading):

- **Max Retries**: 5 (per spec)
- **Backoff**: Exponential (1s, 2s, 4s, 8s, 16s)
- **After Max Retries**: Move to DLQ with flag: `requires_manual_investigation = true`

---

### DLQ (Dead Letter Queue) Handling

**Conditions for DLQ**:

- Enqueue failure after 3 retries
- Grading failure after 5 retries
- Validation error (schema version incompatible)

**DLQ Processing**:

```
1. Move job to dead_letter_queue table
2. Log error with attempt_id and reason
3. Alert ops team (e.g., Slack integration)
4. Mark job: requires_manual_investigation = true
5. Create work ticket for manual review
6. Manual process: Review error, fix underlying issue, resubmit
```

**DLQ Query Example**:

```sql
SELECT job_id, attempt_id, error_reason, created_at FROM dead_letter_queue
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

---

## Testing Strategy

### Unit Tests Required

**File**: `apps/api/tests/unit/attempt-engine.test.ts`

**Scope**: Snapshot creation, version comparison, license validation

**Test Cases**:

```typescript
describe("Unit: Attempt Engine", () => {
  describe("Snapshot Creation", () => {
    test("should capture all question metadata in snapshot", () => {
      const exam = buildMockExam();
      const snapshot = createQuestionSnapshot(exam);

      expect(snapshot).toHaveProperty("questions");
      expect(snapshot.questions[0]).toHaveProperty("id");
      expect(snapshot.questions[0]).toHaveProperty("text");
      expect(snapshot.questions[0]).toHaveProperty("correct_answer");
    });

    test("should serialize snapshot as valid JSON", () => {
      const snapshot = createQuestionSnapshot(exam);
      const serialized = JSON.stringify(snapshot);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual(snapshot);
    });
  });

  describe("Version Compatibility", () => {
    test("should reject schema_version < MIN_SUPPORTED", () => {
      const attempt = { expected_schema_version: 0 };
      const result = validateCompatibility(attempt);

      expect(result.compatible).toBe(false);
      expect(result.reason).toBe("SCHEMA_VERSION_INCOMPATIBLE");
    });

    test("should accept schema_version == CURRENT", () => {
      const attempt = {
        expected_schema_version: 1,
        expected_product_version: "1.0.0",
      };
      const result = validateCompatibility(attempt);

      expect(result.compatible).toBe(true);
    });
  });

  describe("License State Checking", () => {
    test("should block attempt creation if license SOFT_LOCKED", () => {
      const license = { status: "SOFT_LOCKED" };
      const result = checkLicenseAllowsCreation(license);

      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(423);
    });

    test("should allow submission if license SOFT_LOCKED", () => {
      const license = { status: "SOFT_LOCKED" };
      const result = checkLicenseAllowsSubmission(license);

      expect(result.allowed).toBe(true);
    });
  });

  describe("Score Calculation", () => {
    test("should compute score deterministically", () => {
      const questions = buildMockQuestions();
      const answers = buildMockAnswers(questions);
      const gradingConfig = buildMockGradingConfig();

      const score1 = computeScore(questions, answers, gradingConfig);
      const score2 = computeScore(questions, answers, gradingConfig);

      expect(score1).toBe(score2);
    });
  });
});
```

---

### Integration Tests Required

**File**: `apps/api/tests/integration/attempt-flow.test.ts`

**Scope**: End-to-end flow from creation through grading

**Test Cases**:

```typescript
describe("Integration: Attempt Flow", () => {
  describe("Create → Submit → Grade Flow", () => {
    test("should create attempt with snapshot", async () => {
      const res = await POST(`/api/workspaces/acme/attempts`, {
        exam_id: "exam-123",
      });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("attempt_id");
      expect(res.body.data).toHaveProperty("questions");
    });

    test("should save progress updates", async () => {
      const attempt = await createAttempt();

      const res = await POST(`/api/workspaces/acme/attempts/${attempt.id}/progress`, {
        responses: [
          {
            question_id: attempt.questions[0].id,
            user_answer: { selected_option: "A" },
            flagged: false,
          },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.data.responses_saved).toBe(1);
    });

    test("should submit attempt and enqueue grading", async () => {
      const attempt = await createAttempt();

      const res = await POST(`/api/workspaces/acme/attempts/${attempt.id}/submit`, {
        submission_reason: "MANUAL_SUBMIT",
      });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("SUBMITTED");

      // Wait for worker to grade
      await waitForGrading(attempt.id);

      const final = await GET(`/api/workspaces/acme/attempts/${attempt.id}`);
      expect(final.body.data.status).toBe("FINALIZED");
      expect(final.body.data).toHaveProperty("score");
      expect(final.body.data).toHaveProperty("passed");
    });
  });

  describe("License Enforcement", () => {
    test("should block attempt creation if license SOFT_LOCKED", async () => {
      const res = await POST(
        `/api/workspaces/acme/attempts`,
        {
          exam_id: "exam-123",
        },
        { license_status: "SOFT_LOCKED" },
      );

      expect(res.status).toBe(423);
      expect(res.body.error.code).toBe("WORKSPACE_SOFT_LOCKED");
    });

    test("should allow submission if license SOFT_LOCKED", async () => {
      const attempt = await createAttempt({ license_status: "ACTIVE" });

      // Simulate license transition
      await transitionLicense("SOFT_LOCKED");

      const res = await POST(`/api/workspaces/acme/attempts/${attempt.id}/submit`, {});

      expect(res.status).toBe(200);
    });
  });

  describe("Version Compatibility", () => {
    test("should reject attempt creation if schema_version incompatible", async () => {
      const res = await POST(
        `/api/workspaces/acme/attempts`,
        {
          exam_id: "exam-123",
        },
        { schema_version: 0 },
      );

      expect(res.status).toBe(426);
      expect(res.body.error.code).toBe("SCHEMA_VERSION_INCOMPATIBLE");
    });
  });
});
```

---

### Transaction Tests

**File**: `apps/api/tests/integration/transactions.test.ts`

**Scope**: Verify atomicity and rollback semantics

```typescript
describe('Integration: Transactions', () => {

  test('should rollback attempt creation if snapshot capture fails', async () => {
    // Simulate snapshot validation error
    mockSnapshotValidation = () => throw new ValidationError('Invalid snapshot');

    await expect(POST(`/api/workspaces/acme/attempts`, {...}))
      .rejects.toThrow();

    // Verify no partial record created
    const attempt = await db.query('SELECT * FROM attempts WHERE exam_id = ?', ['exam-123']);
    expect(attempt).toBeNull();
  });

  test('should rollback submission if enqueue fails', async () => {
    const attempt = await createAttempt();

    // Simulate job broker failure
    mockJobBroker.enqueue = () => throw new Error('Broker unavailable');

    const res = await POST(`/api/workspaces/acme/attempts/${attempt.id}/submit`, {});

    expect(res.status).toBe(503);

    // Verify attempt remains IN_PROGRESS
    const fetched = await GET(`/api/workspaces/acme/attempts/${attempt.id}`);
    expect(fetched.body.data.status).toBe('IN_PROGRESS');
    expect(fetched.body.data.submitted_at).toBeNull();
  });
});
```

---

### Idempotency Tests

**File**: `apps/api/tests/integration/idempotency.test.ts`

```typescript
describe("Integration: Idempotency", () => {
  test("should return same result on duplicate submission", async () => {
    const attempt = await createAttempt();

    const res1 = await POST(
      `/api/workspaces/acme/attempts/${attempt.id}/submit`,
      {},
      { headers: { "idempotency-key": "submission-1" } },
    );

    expect(res1.status).toBe(200);
    const result1 = res1.body.data;

    // Duplicate submission
    const res2 = await POST(
      `/api/workspaces/acme/attempts/${attempt.id}/submit`,
      {},
      { headers: { "idempotency-key": "submission-1" } },
    );

    expect(res2.status).toBe(200);
    const result2 = res2.body.data;

    expect(result1.attempt_id).toBe(result2.attempt_id);
    expect(result1.status).toBe(result2.status);
  });

  test("should prevent duplicate grading jobs", async () => {
    const attempt = await createAttempt();

    // Submit twice
    await POST(`/api/workspaces/acme/attempts/${attempt.id}/submit`, {});
    await POST(`/api/workspaces/acme/attempts/${attempt.id}/submit`, {});

    await waitForGrading(attempt.id);

    // Verify grading happened once
    const jobCount = await db.query(
      "SELECT COUNT(*) FROM job_log WHERE attempt_id = ? AND job_type = ?",
      [attempt.id, "GRADE_ATTEMPT"],
    );

    // Should be at most 1 grading job (may be retried, but same atomic outcome)
    expect(jobCount).toBeLessThanOrEqual(2); // Initial + 1 potential retry
  });
});
```

---

### Concurrency Tests

**File**: `apps/api/tests/integration/concurrency.test.ts`

```typescript
describe("Integration: Concurrency", () => {
  test("should serialize concurrent submissions", async () => {
    const attempt = await createAttempt();

    // 10 concurrent submissions
    const promises = Array(10)
      .fill(null)
      .map(() => POST(`/api/workspaces/acme/attempts/${attempt.id}/submit`, {}));

    const results = await Promise.all(promises);

    // One should succeed; others should conflict or be idempotent
    const successes = results.filter((r) => r.status === 200);
    const conflicts = results.filter((r) => r.status === 409);
    const idempotents = results.filter((r) => r.status === 200 && r.body.data.cached);

    expect(successes.length + conflicts.length + idempotents.length).toBe(10);
    expect(successes.length).toBeGreaterThanOrEqual(1);
  });

  test("should prevent concurrent grading", async () => {
    const attempt = await createAttempt();
    await submitAttempt(attempt);

    // Simulate 2 workers attempting to grade
    const grade1 = gradeWorkflow(attempt.id);
    const grade2 = gradeWorkflow(attempt.id);

    const results = await Promise.all([grade1, grade2]);

    // One should succeed; other should skip (idempotent)
    const gradings = results.filter((r) => r.graded === true);
    expect(gradings).toHaveLength(1);
  });
});
```

---

### Multi-Tenant Isolation Tests

**File**: `apps/api/tests/integration/isolation.test.ts`

```typescript
describe("Integration: Multi-Tenant Isolation", () => {
  test("should not access attempts from other workspace", async () => {
    const attempt1 = await createAttempt({ workspace: "workspace-1" });

    // Try to access from workspace-2
    const res = await GET(`/api/workspaces/workspace-2/attempts/${attempt1.id}`, {
      token: getTokenForWorkspace("workspace-2"),
    });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ATTEMPT_NOT_FOUND");
  });

  test("should not leak attempt metadata across workspaces", async () => {
    const attempt1 = await createAttempt({ workspace: "workspace-1" });

    // Workspace-2 common query
    const res = await GET(`/api/workspaces/workspace-2/attempts`, {
      token: getTokenForWorkspace("workspace-2"),
    });

    const attemptIds = res.body.data.attempts.map((a) => a.id);
    expect(attemptIds).not.toContain(attempt1.id);
  });
});
```

---

### Version Compatibility Tests

**File**: `apps/api/tests/integration/versioning.test.ts`

```typescript
describe("Integration: Version Compatibility", () => {
  test("should reject attempt creation if schema outdated", async () => {
    const res = await POST(
      `/api/workspaces/acme/attempts`,
      {
        exam_id: "exam-123",
      },
      { workspace_schema_version: 0 },
    );

    expect(res.status).toBe(426);
  });

  test("should grade attempt with mismatched schema version", async () => {
    const attempt = await createAttempt({ expected_schema_version: 0 });
    await submitAttempt(attempt);

    await waitForGrading(attempt.id);

    const final = await GET(`/api/workspaces/acme/attempts/${attempt.id}`);

    // Should mark as error; no crash
    expect(final.body.data.status).toBe("FINALIZED");
    expect(final.body.data.score).toBe(0);
    expect(final.body.data.error_reason).toBe("Schema version incompatible");
  });
});
```

---

## Constraints & Non-Goals

### Hard Constraints

1. **No Cross-Tenant Data Access**: All queries scoped to workspace_id; no joins across workspaces
2. **Snapshot Immutability**: Snapshot frozen after creation; grading reads snapshot only (never
   live exam config)
3. **Server-Authoritative Time**: All deadlines enforced by server; client time decorative only
4. **Transactional Writes**: Submission and grading fully ACID; rollback on failure
5. **Worker-Only Grading**: API contains zero score computation; delegated entirely to worker
6. **No Weakening of Versioning**: Version mismatch fails gracefully (error result); no silent
   corruption
7. **No Client-Side Grading**: Client cannot compute scores; cannot override snapshot
8. **Single Attempt Rule Enforcement**: At most one IN_PROGRESS per exam per user (if enabled); DB
   constraint enforces

### Non-Goals (Deferred to Future Stages)

1. **Frontoffice UI** (Phase 2): This stage defines API only; UI rendering delegated
2. **Certificate Generation** (Separate Stage): Trigger logic included; template rendering separate
3. **Analytics & Reporting** (Phase 3): Data captured; reporting queries deferred
4. **Attempt Audit Trail** (Future): Historical attempt versions not tracked in this stage
5. **WebSocket Real-Time Updates** (Frontoffice Phase): Polling only in this stage
6. **Mobile-Specific Modes** (Future): Unified mode set (RELAX/CHRONO/RUSH) sufficient for now
7. **Third-Party LMS Integration** (Future): Zidney remains autonomous; LMS integration separate
8. **Offline Attempt Support** (Future): Online-first; offline deferred
9. **Proctoring Integration** (Future): Metadata fields reserved; actual proctoring separate stage

---

## Success Criteria

| Criterion                  | Measurement                                                           | Verification Method                                     |
| -------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| **Snapshot Independence**  | 100% of grading queries use snapshot; zero live exam table lookups    | Code review + integration test logs                     |
| **Transactional Safety**   | 100% of submission/grading operations rollback on failure             | Transaction rollback test suite passes                  |
| **Idempotency**            | Replayed operations produce identical results; zero duplicate state   | Idempotency test suite passes (100+ replays)            |
| **Concurrency**            | Zero race conditions between submissions; lock serializes access      | Concurrency stress test (100+ concurrent) passes        |
| **Version Enforcement**    | Incompatible schema/product versions rejected before attempt start    | Version compatibility test suite passes                 |
| **Multi-Tenant Isolation** | Zero cross-tenant data leakage; all queries scoped to workspace_id    | Multi-tenant isolation test suite passes; code review   |
| **License Enforcement**    | License middleware required on all workspace-bound routes; enforced   | Middleware integration test + code review               |
| **Deterministic Grading**  | Same attempt re-graded produces identical score                       | Grading determinism test (1000+ replays) passes         |
| **Upgrade Safety**         | Attempt remains valid after platform upgrade; results reproducible    | Upgrade migration test (schema rollover) passes         |
| **Observability**          | All critical operations emit structured JSON logs with correlation_id | Log audit: sample logs contain all required fields      |
| **Performance**            | Submission latency <500ms (optimal); <5s (acceptable under load)      | Load test: 1000 concurrent submissions, p99 latency <5s |

---

## Implementation Order

1. **Phase A: Data Model (Week 1)**
   - Create Migration 001: attempts, attempt_progress, submission_idempotency_keys tables
   - Create indexes
   - Define TypeScript types

2. **Phase B: API Layer (Week 2)**
   - Implement `POST /api/workspaces/:slug/attempts` (create)
   - Implement tenant resolver middleware
   - Implement license middleware
   - Implement correlation ID middleware

3. **Phase C: Progress & Submission (Week 2-3)**
   - Implement `POST /api/workspaces/:slug/attempts/:id/progress` (answer autosave)
   - Implement `POST /api/workspaces/:slug/attempts/:id/submit` (submission)
   - Implement idempotency middleware
   - Implement lock timeout retry logic

4. **Phase D: Worker Integration (Week 3)**
   - Implement `GRADE_ATTEMPT` job processor
   - Implement deterministic grading logic
   - Implement worker retry and DLQ logic
   - Implement certificate job enqueue

5. **Phase E: Testing (Week 4)**
   - Unit tests (snapshot, version, license)
   - Integration tests (full flow)
   - Concurrency tests (100+ concurrent submissions)
   - Load tests (performance validation)

6. **Phase F: Deployment (Week 5)**
   - Database migrations in production
   - API deployment
   - Worker deployment
   - Monitoring and alerts

---

## Constitutional Compliance — Final Verification

| ADR                   | Requirement                   | Compliance Status | Notes                                                                                                 |
| --------------------- | ----------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| ADR-0001              | Database-per-tenant isolation | ✅ MAINTAINED     | All tables tenant-isolated; tenant resolver acts as first middleware; no cross-tenant joins           |
| ADR-0002              | Snapshot immutability         | ✅ MAINTAINED     | Snapshot captured at creation; stored as JSONB; grading reads snapshot only; no live table references |
| ADR-0003              | White-label visual only       | ✅ MAINTAINED     | Attempt model agnostic to branding; theme applied at UI layer                                         |
| ADR-0004              | Single runtime engine         | ✅ MAINTAINED     | Unified attempts table supports MCQ, Traditional, Topic, Exercise (all types)                         |
| ADR-0005              | Upgrade opt-in                | ✅ MAINTAINED     | Version checks enforced; incompatible versions rejected; no silent upgrades                           |
| ADR-0006              | Server-authoritative time     | ✅ MAINTAINED     | All deadlines enforced by server NOW(); client timer visual only                                      |
| ADR-0007              | Product version compatibility | ✅ MAINTAINED     | Versions snapshots at creation; validation at submission and grading                                  |
| ADR-0008              | Semantic versioning           | ✅ MAINTAINED     | Migration versioning explicit; forward-only; rollback via snapshot restore                            |
| License Enforcement   | Middleware mandatory          | ✅ MAINTAINED     | License check on all workspace-bound routes; status enforced (ACTIVE, SOFT_LOCKED, ARCHIVED)          |
| Transaction Integrity | ACID guarantees               | ✅ MAINTAINED     | Submission and grading fully transactional; rollback on failure; no partial writes                    |
| Idempotency           | Safe replay                   | ✅ MAINTAINED     | All operations idempotent; UNIQUE constraints; status guards; UPSERT for progress                     |
| Layer Separation      | No cross-layer logic          | ✅ MAINTAINED     | Frontoffice UI-only; API routing/validation; Worker grading; MMC licensing                            |

**OVERALL STATUS: ✅ FULLY COMPLIANT WITH ZIDNEY CONSTITUTION**

---

## Document Metadata

- **Generated**: February 18, 2026
- **Status**: READY FOR IMPLEMENTATION
- **Phase**: 01_PLATFORM_FOUNDATION
- **Stage**: STAGE_06_ATTEMPT_ENGINE_FOUNDATION
- **Linked Spec**: [specs/runtime/006-attempt-engine-foundation/spec.md](spec.md)
- **Clarifications**: ✅ 5/5 Resolved
- **Next Step**: Task Generation (create granular 2-week implementation tasks)
- **Estimated Implementation**: 5 weeks (Phase A-F above)

---

**PLAN COMPLETE AND APPROVED**

This document is production-ready and defines all requirements for
STAGE_06_ATTEMPT_ENGINE_FOUNDATION implementation.
