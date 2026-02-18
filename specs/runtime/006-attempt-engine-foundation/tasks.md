# STAGE 06 – Attempt Engine Foundation – Atomic Tasks

**Phase**: 01_PLATFORM_FOUNDATION  
**Stage**: STAGE_06_ATTEMPT_ENGINE_FOUNDATION  
**Status**: Ready for Implementation  
**Date**: February 18, 2026  
**Total Tasks**: 72  
**Estimated Duration**: 5 weeks (Phase A-F)

---

## Executive Summary

This document breaks down the Attempt Engine Foundation (Stage 06) into 72 atomic, dependency-ordered tasks organized by implementation layer. Each task:

- Is scoped to ONE layer (database, API, worker, middleware, observability, testing)
- Declares transactional requirements
- Declares idempotency mechanism
- Declares middleware dependencies
- References specific file paths
- Has measurable success criteria

**Implementation Order**:

1. **Phase A — Database & Schema** (Week 1): Tasks T001-T012
2. **Phase B — Middleware Layer** (Week 1-2): Tasks T013-T027
3. **Phase C — API Layer (Create & Progress)** (Week 2): Tasks T028-T043
4. **Phase D — API Layer (Submit & Result)** (Week 2-3): Tasks T044-T055
5. **Phase E — Worker & Grading** (Week 3-4): Tasks T056-T065
6. **Phase F — Testing & Observability** (Week 4-5): Tasks T066-T072

---

## PHASE A: DATABASE & SCHEMA (Week 1)

### Infrastructure Layer — Schema Setup

- [x] T001 Create migration file `apps/api/src/db/tenant/migrations/001_create_attempt_engine_tables.sql`
  - **Layer**: Database
  - **Scope**: Tenant database schema
  - **Transactional**: N/A (migration system handles)
  - **Idempotency**: Migration system versioning
  - **Dependencies**: None (first schema migration for this stage)
  - **Success Criteria**:
    - File exists with complete SQL schema
    - Schema includes: attempts, attempt_progress, submission_idempotency_keys tables
    - All CONSTRAINTS and CHECKS defined
    - Schema version bump included (0 → 1)
    - Migration is forwards-only (no DROP statements)
    - File formatted and valid SQL syntax
  - **Compliance Notes**: ADR-0001 (tenant isolation), ADR-0008 (forwards-only migrations)
  - **Review Checklist**:
    - [ ] Migration file is forwards-only (no DDL rollback)
    - [ ] Foreign keys reference correct parent tables
    - [ ] CHECK constraints include valid enum values
    - [ ] UNIQUE constraints prevent duplicates (e.g., single_attempt_rule)

---

- [x] T002 Create `attempts` table schema in migration with all required fields
  - **Layer**: Database
  - **Scope**: Tenant database
  - **Transactional**: N/A (migration)
  - **Idempotency**: N/A
  - **Dependencies**: T001 (migration file exists)
  - **Fields to Include**: id, workspace_id, user_id, attempt_type, exam_id, question_snapshot (JSONB), question_order (UUID[]), grading_config_snapshot (JSONB), mode, flags_snapshot (JSONB), time_limit_snapshot (BIGINT), exam_version, expected_schema_version (INT), expected_product_version (VARCHAR), started_at, submitted_at, finalized_at, server_start_time, certificate_enabled, single_attempt_rule, status (VARCHAR with CHECK), score (NUMERIC), passed (BOOLEAN), result_snapshot (JSONB), created_at, updated_at
  - **Constraints to Include**:
    - PRIMARY KEY (id)
    - FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    - CHECK (status IN ('IN_PROGRESS','SUBMITTED','FINALIZED','EXPIRED','ABORTED'))
    - CHECK (mode IN ('RELAX','CHRONO','RUSH'))
    - CHECK (attempt_type IN ('MCQ_ASSESSMENT','MCQ_EXAM','MCQ_SCHEDULED','TOPIC_EXAM','EXERCISE_EXAM','TRADITIONAL_SCHEDULED'))
    - CHECK (score IS NULL OR (score >= 0 AND score <= 100))
  - **Success Criteria**:
    - Table created with exact schema
    - All data types correct (JSONB, UUID[], TIMESTAMP WITH TIME ZONE)
    - All DEFAULT values applied (timestamps use NOW(), status defaults to 'IN_PROGRESS')
    - All NOT NULL constraints correct
    - Foreign key ON DELETE CASCADE enforces referential integrity
    - Defaults verified in test insert

---

- [x] T003 Create `attempt_progress` table schema in migration with all required fields
  - **Layer**: Database
  - **Scope**: Tenant database
  - **Transactional**: N/A (migration)
  - **Idempotency**: N/A
  - **Dependencies**: T002 (attempts table exists)
  - **Fields to Include**: id, attempt_id, question_id, user_answer (JSONB), answered_at (TIMESTAMP), flagged (BOOLEAN), created_at, updated_at
  - **Constraints to Include**:
    - PRIMARY KEY (id)
    - FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE
    - UNIQUE (attempt_id, question_id)
  - **Success Criteria**:
    - Table created with correct schema
    - UNIQUE constraint prevents duplicate questions per attempt (UPSERT protection)
    - Foreign key ON DELETE CASCADE cascades from attempts deletion
    - All timestamps default to NOW()

---

- [x] T004 Create `submission_idempotency_keys` table schema in migration
  - **Layer**: Database
  - **Scope**: Tenant database
  - **Transactional**: N/A (migration)
  - **Idempotency**: N/A
  - **Dependencies**: T001 (migration file)
  - **Fields to Include**: id, workspace_id, attempt_id, submission_sequence, idempotency_key (VARCHAR 255), request_timestamp, response_status, response_body (JSONB), created_at, expires_at (NOW() + 24 hours)
  - **Constraints to Include**:
    - PRIMARY KEY (id)
    - FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    - FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE
    - UNIQUE (attempt_id, submission_sequence)
  - **Indexes to Include**:
    - UNIQUE INDEX idx_submission_idempotency_key ON submission_idempotency_keys(workspace_id, idempotency_key) WHERE expires_at > NOW()
    - INDEX idx_submission_cleanup ON submission_idempotency_keys(workspace_id, expires_at) WHERE expires_at <= NOW()
  - **Success Criteria**:
    - Table created with exact schema
    - Composite UNIQUE on (workspace_id, idempotency_key) with time-based filtering
    - Indexes created for fast lookup and cleanup queries
    - TTL field (expires_at) set to 24 hours from creation

---

- [x] T005 Create all indexes on `attempts` table as specified in migration
  - **Layer**: Database
  - **Scope**: Tenant database
  - **Transactional**: N/A (migration)
  - **Idempotency**: N/A
  - **Dependencies**: T002 (attempts table exists)
  - **Indexes to Create**:
    - idx_attempts_workspace_user_exam ON (workspace_id, user_id, exam_id, status)
    - idx_attempts_workspace_user_status ON (workspace_id, user_id, status) WHERE status IN ('IN_PROGRESS','SUBMITTED')
    - idx_attempts_status_finalized ON (workspace_id, status, finalized_at)
    - idx_attempts_started_expiration ON (workspace_id, started_at, time_limit_snapshot) WHERE status = 'IN_PROGRESS'
    - idx_single_attempt_rule UNIQUE ON (exam_id, user_id) WHERE status = 'IN_PROGRESS' AND single_attempt_rule = TRUE
    - idx_attempts_created_at ON (workspace_id, created_at DESC)
  - **Rationale**:
    - workspace_user_exam: Queries for existing attempt before creation
    - workspace_user_status: Cleanup queries for active/submitted attempts
    - status_finalized: Analytics and result retrieval
    - started_expiration: Expiration job to find timed-out attempts
    - single_attempt_rule: Database-level enforcement of single attempt constraint
    - created_at: Audit trail queries
  - **Success Criteria**:
    - All 6 indexes created
    - Indexes verified in pg_indexes system catalog
    - Query plans use indexes (EXPLAIN ANALYZE confirms)

---

- [x] T006 Create all indexes on `attempt_progress` table as specified in migration
  - **Layer**: Database
  - **Scope**: Tenant database
  - **Transactional**: N/A (migration)
  - **Idempotency**: N/A
  - **Dependencies**: T003 (attempt_progress table exists)
  - **Indexes to Create**:
    - idx_attempt_progress_attempt ON (attempt_id)
    - idx_attempt_progress_answered ON (attempt_id, answered_at DESC)
    - idx_attempt_progress_flagged ON (attempt_id, flagged) WHERE flagged = TRUE
  - **Success Criteria**:
    - All 3 indexes created
    - Indexes verified in system catalog
    - Query plans confirm index usage

---

- [x] T007 Define TypeScript types for attempt engine in `packages/types/src/attempt.ts`
  - **Layer**: Shared Types
  - **Scope**: Attempt domain types
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Dependencies**: None
  - **Types to Define**:
    - `AttemptType` (enum: MCQ_ASSESSMENT, MCQ_EXAM, etc.)
    - `AttemptMode` (enum: RELAX, CHRONO, RUSH)
    - `AttemptStatus` (enum: IN_PROGRESS, SUBMITTED, FINALIZED, EXPIRED, ABORTED)
    - `Attempt` (interface with all schema fields)
    - `AttemptProgress` (interface)
    - `SubmissionIdempotencyKey` (interface)
    - `QuestionSnapshot` (interface)
    - `GradingConfigSnapshot` (interface)
    - `FlagsSnapshot` (interface)
    - `ResultSnapshot` (interface)
  - **Success Criteria**:
    - All types exported and usable
    - Types match database schema exactly
    - JSONB types use correct interfaces
    - No `any` types used

---

- [x] T008 Create schema_metadata table update task in migration to bump version 0 → 1
  - **Layer**: Database
  - **Scope**: Tenant database (schema versioning)
  - **Transactional**: N/A (migration)
  - **Idempotency**: N/A
  - **Dependencies**: T001 (migration file)
  - **Implementation**:
    - Add UPDATE to migration that increments schema_version from 0 to 1
    - Update only the current workspace's schema_metadata record
    - Verify schema_version field exists in schema_metadata table (assumption: set up elsewhere)
  - **Success Criteria**:
    - Migration includes UPDATE statement for schema_version
    - Version bumped correctly (0 → 1)
    - Version visible in schema_metadata after migration runs

---

- [x] T009 Create tenant database connection pool manager in `apps/api/src/db/tenant-pool.ts`
  - **Layer**: Database Utility
  - **Scope**: Connection pool management
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Dependencies**: None (standalone utility)
  - **Implementation Details**:
    - Create Map<workspace_id, Pool> to store per-workspace connection pools
    - Function getTenantDatabase(workspace_id) that:
      - Returns existing pool if in cache
      - Creates new pool if not cached
      - Configures pool with: max 20 connections, timeout 30s, idle timeout 900s
      - Returns pool as Promise<Pool>
    - Export pool manager as singleton
  - **Success Criteria**:
    - getTenantDatabase function exists and exported
    - Connection pooling works (connections reused)
    - Pool creation is safe (no race on concurrent calls)
    - Pool has correct connection limits

---

- [x] T010 Set up migration runner test for 001_create_attempt_engine_tables.sql
  - **Layer**: Database Testing
  - **Scope**: Migration validation
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Dependencies**: T001-T006 (migration complete)
  - **Test File**: `apps/api/tests/integration/migrations/001-attempt-engine.test.ts`
  - **Test Cases**:
    - Verify migration runs without errors
    - Verify schema_version updated to 1
    - Verify tables exist with correct structure
    - Verify indexes exist and are used by query planner
    - Verify constraints enforced (e.g., status enum, single_attempt UNIQUE)
    - Verify foreign keys work (insert validates workspace_id exists)
  - **Success Criteria**:
    - All migration tests pass
    - Schema validated against expectations
    - No warnings or errors in migration logs

---

- [x] T011 Create database versioning constant in `apps/api/src/config/versions.ts`
  - **Layer**: Configuration
  - **Scope**: Version constants
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Dependencies**: T008 (schema version bump)
  - **Constants to Define**:
    - MIN_SUPPORTED_SCHEMA_VERSION = 1
    - CURRENT_SCHEMA_VERSION = 1
    - MIN_PRODUCT_VERSION = "1.0.0"
    - CURRENT_PRODUCT_VERSION = "1.0.0"
    - MAX_COMPATIBLE_PRODUCT_VERSION = "∞"
  - **Success Criteria**:
    - Constants exported
    - Used by license middleware (T016) for validation
    - Documented with version compatibility rules

---

- [x] T012 Create database query builder helpers in `apps/api/src/db/attempt-queries.ts`
  - **Layer**: Database Utility
  - **Scope**: Reusable query builders
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Dependencies**: T007 (types defined)
  - **Query Builders to Create**:
    - `findAttemptById(db, workspaceId, attemptId)` → SELECT \* WHERE id = ? AND workspace_id = ?
    - `findInProgressAttemptForUser(db, workspaceId, userId, examId)` → SELECT \* WHERE ... AND status = 'IN_PROGRESS'
    - `findProgressByAttemptId(db, attemptId)` → SELECT ALL progress records for attempt
    - `findIdempotencyRecord(db, idempotencyKey, workspaceId)` → SELECT from submission_idempotency_keys
    - `getExpiredAttempts(db, workspaceId)` → SELECT IN_PROGRESS attempts past time limit
  - **Success Criteria**:
    - All query builders exported and usable
    - Queries include proper workspace_id scoping
    - Queries use prepared statements (prevent SQL injection)
    - No hardcoded table names (use constants)

---

## PHASE B: MIDDLEWARE LAYER (Week 1-2)

### Middleware — Tenant Resolution

- [x] T013 Create tenant resolver middleware in `apps/api/src/middleware/tenantResolver.ts`
  - **Layer**: Middleware
  - **Scope**: Tenant identification and connection pooling
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Middleware Priority**: FIRST (before all others)
  - **Dependencies**: T009 (pool manager)
  - **Implementation**:
    - Extract workspace slug from req.params.slug or subdomain
    - Query master DB for workspace: SELECT id, schema_version FROM workspaces WHERE slug = ?
    - Validate workspace exists (404 if not)
    - Obtain tenant DB connection: getTenantDatabase(workspace.id)
    - Attach to req context: req.workspace = {id, slug, schema_version}; req.tenantDb = pool
    - Call next()
  - **Error Handling**:
    - Missing slug → 400 INVALID_REQUEST
    - Workspace not found → 404 WORKSPACE_NOT_FOUND
    - DB connection failure → 503 SERVICE_UNAVAILABLE
  - **Success Criteria**:
    - Middleware exports and can be applied to router
    - req.workspace and req.tenantDb populated correctly
    - Error responses follow RFC 7807 format
    - Slug extraction works from both path and subdomain

---

- [ ] T014 Create license middleware in `apps/api/src/middleware/licenseMiddleware.ts`
  - **Layer**: Middleware
  - **Scope**: License validation and version checking
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Middleware Priority**: SECOND (after tenant resolver; before business logic)
  - **Dependencies**: T013 (tenant resolver), T011 (version constants)
  - **Implementation**:
    - Query master DB: SELECT status, product_version FROM licenses WHERE workspace_id = ?
    - Validate license status:
      - ARCHIVED → return 403
      - SOFT_LOCKED → return 423
      - ACTIVE → proceed
      - NOT FOUND → return 404
    - Validate schema version: workspace.schema_version >= MIN_SUPPORTED_SCHEMA_VERSION
    - Validate product version compatibility
    - Attach to req context: req.license = {status, product_version}
    - Call next()
  - **Status Code Mapping**:
    - 403 WORKSPACE_ARCHIVED
    - 423 WORKSPACE_SOFT_LOCKED
    - 404 LICENSE_NOT_FOUND
    - 426 SCHEMA_VERSION_INCOMPATIBLE
    - 426 PRODUCT_VERSION_INCOMPATIBLE
  - **Success Criteria**:
    - Middleware exports and can be applied
    - All status transitions tested
    - Error responses use specified HTTP codes
    - RFC 7807 error format

---

- [ ] T015 Create correlation ID middleware in `apps/api/src/middleware/correlationIdMiddleware.ts`
  - **Layer**: Middleware
  - **Scope**: Request tracing
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Middleware Priority**: THIRD (early, before business logic)
  - **Dependencies**: None
  - **Implementation**:
    - Check request headers for X-Correlation-ID or Correlation-ID
    - If not found, generate new UUID
    - Attach to req.correlationId
    - Attach to response headers: X-Correlation-ID
    - Attach to logger context
    - Call next()
  - **Success Criteria**:
    - Existing correlation IDs propagated
    - New correlation IDs generated as UUID
    - Response header set correctly
    - Used by all subsequent logging

---

- [ ] T016 Create idempotency middleware in `apps/api/src/middleware/idempotencyMiddleware.ts`
  - **Layer**: Middleware
  - **Scope**: Idempotent request deduplication
  - **Transactional**: No
  - **Idempotency**: Dual storage (Redis + PostgreSQL fallback)
  - **Middleware Priority**: After tenant/license resolvers; before route handlers
  - **Dependencies**: T014 (license middleware)
  - **Storage Strategy** (per clarification Q2):
    - Redis as fast-path cache (24-hour TTL)
    - PostgreSQL submission_idempotency_keys table as fallback
    - Lookup sequence: Redis → PostgreSQL → Process new request
  - **Implementation**:
    - Check if request is mutable (POST, PUT, PATCH, DELETE)
    - Extract idempotency key from req.headers['idempotency-key'] or generate one
    - Query Redis first: GET idempotency:${key}
    - If hit: Return cached response (existing status code and body)
    - If miss: Query PostgreSQL: SELECT \* FROM submission_idempotency_keys WHERE idempotency_key = ? AND expires_at > NOW()
    - If DB hit: Return cached response
    - If no cache: Proceed to route handler
    - Intercept res.json() to cache response in both Redis and PostgreSQL
    - Store in PostgreSQL with: workspace_id, idempotency_key, response_status, response_body, expires_at = NOW() + 24h
  - **Success Criteria**:
    - Idempotency key lookup works
    - Redis cache returns in <1ms
    - PostgreSQL fallback works if Redis unavailable
    - Cached responses identical to original
    - 24-hour TTL respected

---

### Middleware — Authentication & RBAC

- [ ] T017 Create authentication context middleware in `apps/api/src/middleware/authContext.ts`
  - **Layer**: Middleware
  - **Scope**: JWT validation and user context
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Dependencies**: None (assumes JWT already verified upstream)
  - **Implementation**:
    - Extract Bearer token from Authorization header
    - Validate token structure (JWT format)
    - Decode JWT and validate signature (assume external auth service)
    - Extract user_id and workspace_id from JWT claims
    - Validate JWT claims: user_id matches request context
    - Attach to req context: req.user = {id, email, roles}
  - **Error Handling**:
    - Missing token → 401 UNAUTHORIZED
    - Invalid token → 401 UNAUTHORIZED
    - Workspace mismatch → 403 FORBIDDEN
  - **Success Criteria**:
    - User context available in route handlers
    - User credentials validated before access

---

- [ ] T018 Create RBAC middleware for attempt access in `apps/api/src/middleware/rbacMiddleware.ts`
  - **Layer**: Middleware
  - **Scope**: Role-based access control
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Dependencies**: T017 (auth context)
  - **Implementation**:
    - Check req.user.roles for required permissions
    - Verify user has 'exam_access' or 'student' role (allow students to create attempts)
    - Verify user is not suspended/restricted
    - Attach to req context: req.rbac = {allowed: boolean}
  - **Rules**:
    - Students can create/submit their own attempts
    - Instructors can view attempt results
  - **Success Criteria**:
    - Authorization checks work
    - Unauthorized requests return 403

---

### Middleware — Input Validation

- [ ] T019 Create attempt creation validation schema in `packages/validation/src/attempt-schemas.ts`
  - **Layer**: Validation
  - **Scope**: Input validation rules
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Dependencies**: T007 (types)
  - **Validation Rules**:
    - exam_id: UUID format, required
    - attempt_type: enum check (MCQ_EXAM, TOPIC_EXAM, etc.)
    - Additional contextual validation (exam must exist, user eligible)
  - **Success Criteria**:
    - Schema validates valid requests
    - Schema rejects invalid requests with clear messages

---

- [ ] T020 Create progress update validation schema in `packages/validation/src/attempt-schemas.ts`
  - **Layer**: Validation
  - **Scope**: Input validation for progress updates
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Dependencies**: T019 (validation framework)
  - **Validation Rules**:
    - responses: array, required
    - responses[].question_id: UUID, required
    - responses[].user_answer: JSONB, required (format depends on question type)
    - responses[].flagged: boolean, required
  - **Success Criteria**:
    - Schema validates valid progress updates
    - Schema rejects malformed data

---

- [ ] T021 Create submission validation logic in `packages/validation/src/attempt-schemas.ts`
  - **Layer**: Validation
  - **Scope**: Submission request validation
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Dependencies**: T020 (validation)
  - **Validation Rules**:
    - submission_reason: enum (MANUAL_SUBMIT, AUTO_TIMEOUT)
    - idempotency_key: optional UUID (for retry safety)
  - **Success Criteria**:
    - Validates submission requests correctly

---

## PHASE C: API LAYER – CREATE & PROGRESS (Week 2)

### API Routes — Attempt Creation

- [ ] T022 Create `POST /api/workspaces/:slug/attempts` endpoint in `apps/api/src/routes/attempts/create.ts`
  - **Layer**: API
  - **Scope**: Attempt creation endpoint
  - **Transactional**: YES (full transaction)
  - **Idempotency**: YES (UNIQUE constraint on workspace_id, user_id, exam_id; return existing if duplicate)
  - **Middleware Stack**: tenantResolver → licenseMiddleware → correlationId → authContext → rbacMiddleware
  - **License Requirement**: Must be ACTIVE (T014 enforces 423/403 if not)
  - **Dependencies**: T013, T014, T015, T017, T018, T019
  - **Implementation**:
    - Route: POST /api/workspaces/:slug/attempts
    - Route handler:
      1. Validate request body (exam_id required)
      2. Load exam from exam table (resolve from exam_id)
      3. Verify exam exists and is active
      4. Verify user not already IN_PROGRESS for this exam (unless multi-attempt allowed)
      5. BEGIN TRANSACTION
      6. Create snapshot: question_snapshot = fully resolved questions with metadata
      7. Shuffle question order; store in question_order UUID[]
      8. Create grading config snapshot from exam grading configuration
      9. Create flags snapshot from exam settings
      10. INSERT INTO attempts (id, workspace_id, user_id, exam_id, ..., snapshot fields..., status='IN_PROGRESS', started_at=NOW())
      11. INSERT INTO attempt_progress for each question (attempt_id, question_id, user_answer=NULL, flagged=FALSE)
      12. COMMIT
      13. Log: attempt.created event
      14. Return 201 Created with: attempt_id, questions[], time_limit_seconds, mode
  - **Snapshot Requirements** (per spec):
    - question_snapshot: Complete question text, options, correct answer, metadata, points
    - grading_config_snapshot: Pass percentage, total points, weights, pass/fail logic
    - flags_snapshot: review_allowed, hints_allowed, show_correct_answer, randomize_options
    - exam_version, expected_schema_version, expected_product_version
  - **Error Handling**:
    - 400 if exam_id missing or invalid
    - 404 if exam not found
    - 409 if IN_PROGRESS attempt already exists (single_attempt_rule)
    - 423 if license SOFT_LOCKED (handled by middleware)
    - 426 if schema version incompatible (handled by middleware)
    - 500 if snapshot capture fails (transaction rolls back)
  - **Response (201 Created)**:
    ```json
    {
      "success": true,
      "data": {
        "attempt_id": "uuid",
        "exam_id": "uuid",
        "status": "IN_PROGRESS",
        "started_at": "2026-02-18T14:30:00Z",
        "mode": "CHRONO",
        "time_limit_seconds": 3600,
        "question_count": 20,
        "questions": [
          {
            "id": "uuid",
            "text": "Question text",
            "type": "MCQ",
            "options": ["A", "B", "C", "D"],
            "points": 5
          }
        ]
      },
      "error": null
    }
    ```
  - **Structured Logging** (T077 will formalize):
    - Log event: attempt.created
    - Fields: workspace_id, user_id, exam_id, attempt_id, mode, question_count, snapshot_size_bytes
    - Correlation ID propagated
  - **Success Criteria**:
    - Endpoint accepts POST requests
    - Snapshot captured completely and accurately
    - Transaction rolls back on error (no partial records)
    - Returns 201 with correct response structure
    - Duplicate attempts return existing attempt (idempotent)

---

- [x] T023 Create attempt snapshot builder in `apps/api/src/modules/attempt/snapshot-builder.ts`
  - **Layer**: API (Domain Logic)
  - **Scope**: Snapshot creation and serialization
  - **Transactional**: No (called within transaction by T022)
  - **Idempotency**: N/A
  - **Dependencies**: T007 (types)
  - **Functions to Create**:
    - `buildQuestionSnapshot(questions)` → returns JSONB with all metadata
    - `buildGradingConfigSnapshot(exam)` → returns grading rules as JSONB
    - `buildFlagsSnapshot(exam)` → returns UI flags as JSONB
    - `shuffleQuestions(questions)` → returns randomized question order as UUID[]
    - `validateSnapshot(snapshot)` → verifies snapshot is self-sufficient (no external deps)
  - **Validation Rules for Snapshot**:
    - question_snapshot must include: id, text, type, options, correct_answer, points, metadata
    - question_snapshot must NOT include database IDs or external references
    - Snapshot must be re-gradeable without access to live exam tables
  - **Success Criteria**:
    - Snapshot functions produce valid JSONB
    - Snapshots are deterministic (same input → same output)
    - Snapshots verifiable as independent (valid JSON schema)

---

- [x] T024 Create exam loader service in `apps/api/src/modules/attempt/exam-loader.ts`
  - **Layer**: API (Domain Logic)
  - **Scope**: Load exam configuration safely
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Dependencies**: T007
  - **Functions to Create**:
    - `loadExamById(db, workspaceId, examId)` → SELECT \* FROM exams WHERE id = ? AND workspace_id = ?
    - `loadQuestionsForExam(db, examId)` → SELECT \* FROM questions WHERE exam_id = ?
    - `validateExamAvailability(exam)` → Check if exam is active and accepting attempts
    - `validateUserEligibility(db, workspaceId, userId, examId)` → Check user can take this exam
  - **Success Criteria**:
    - Exam loading works
    - Availability checks functional

---

### API Routes — Progress Tracking

- [ ] T025 Create `POST /api/workspaces/:slug/attempts/:id/progress` endpoint in `apps/api/src/routes/attempts/progress.ts`
  - **Layer**: API
  - **Scope**: Answer progress/autosave endpoint
  - **Transactional**: No (UPSERT is non-blocking)
  - **Idempotency**: YES (UPSERT: INSERT ON CONFLICT DO UPDATE)
  - **Middleware Stack**: tenantResolver → licenseMiddleware → correlationId → authContext → rbacMiddleware
  - **License Requirement**: ACTIVE (middleware enforces)
  - **Dependencies**: T013, T014, T015, T017, T018, T020
  - **Implementation**:
    - Route: POST /api/workspaces/:slug/attempts/:id/progress
    - Route handler:
      1. Validate attempt exists: SELECT \* FROM attempts WHERE id = ? AND workspace_id = ? AND user_id = req.user.id
      2. Verify status is IN_PROGRESS (else return 409)
      3. For each response in request.responses:
         - Validate question_id is in snapshot
         - Validate user_answer format matches question type
         - UPSERT INTO attempt_progress (attempt_id, question_id, user_answer, answered_at, updated_at)
           ON CONFLICT (attempt_id, question_id) DO UPDATE SET (user_answer, answered_at, updated_at) = (...)
      4. Calculate time remaining: time_remaining = time_limit_snapshot - (NOW() - started_at)
      5. Log: progress.saved event
      6. Return 200 OK with: responses_saved, time_remaining_seconds
  - **Error Handling**:
    - 404 if attempt not found
    - 409 if attempt not IN_PROGRESS (already submitted/expired)
    - 422 if question_id not in snapshot
    - 422 if user_answer invalid format
  - **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "attempt_id": "uuid",
        "responses_saved": 3,
        "time_remaining_seconds": 1800
      },
      "error": null
    }
    ```
  - **Success Criteria**:
    - Endpoint accepts POST requests
    - Answers saved and persisted
    - No duplicate progress rows created (UPSERT idempotent)
    - Multiple concurrent progress updates don't conflict
    - Time remaining calculated correctly

---

- [ ] T026 Create `GET /api/workspaces/:slug/attempts/:id` endpoint status in `apps/api/src/routes/attempts/status.ts`
  - **Layer**: API
  - **Scope**: Get attempt status and progress
  - **Transactional**: No (read-only)
  - **Idempotency**: N/A
  - **Middleware Stack**: tenantResolver → licenseMiddleware → correlationId → authContext → rbacMiddleware
  - **Dependencies**: T013, T014, T015, T017, T018
  - **Implementation**:
    - Route: GET /api/workspaces/:slug/attempts/:id
    - Route handler:
      1. SELECT \* FROM attempts WHERE id = ? AND workspace_id = ? (verify user owns attempt)
      2. If status IN_PROGRESS:
         - SELECT COUNT(\*) answered_count FROM attempt_progress WHERE attempt_id = ? AND user_answer IS NOT NULL
         - SELECT COUNT(\*) flagged_count FROM attempt_progress WHERE attempt_id = ? AND flagged = TRUE
         - Calculate time_remaining = time_limit_snapshot - (NOW() - started_at)
         - Return: status, progress counts, time_remaining, mode
      3. If status FINALIZED:
         - Return: status, score, passed, submitted_at, finalized_at
      4. Log: progress.retrieved event
  - **Response (200 OK) – IN_PROGRESS**:
    ```json
    {
      "success": true,
      "data": {
        "attempt_id": "uuid",
        "status": "IN_PROGRESS",
        "progress": {
          "answered_count": 15,
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
  - **Success Criteria**:
    - Returns correct attempt state
    - Time remaining calculated accurately
    - Progress counts accurate

---

- [ ] T027 Create answer validation service in `apps/api/src/modules/attempt/answer-validator.ts`
  - **Layer**: API (Domain Logic)
  - **Scope**: Validate user answers match question type
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Dependencies**: T023 (snapshot builder)
  - **Functions to Create**:
    - `validateMCQAnswer(answer, questionSnapshot)` → Verify selected_option is in options
    - `validateShortAnswer(answer, questionSnapshot)` → Verify text is not empty, under max length
    - `validateEssayAnswer(answer, questionSnapshot)` → Verify text content, word count
    - `validateAnswerForQuestion(answer, question)` → Router function that calls correct validator
    - `isAnswerValid(answer, question)` → Returns boolean
  - **Success Criteria**:
    - Validators work for each question type
    - Invalid answers rejected with clear messages

---

## PHASE D: API LAYER – SUBMIT & RESULT (Week 2-3)

### API Routes — Submission

- [ ] T028 Create `POST /api/workspaces/:slug/attempts/:id/submit` endpoint in `apps/api/src/routes/attempts/submit.ts`
  - **Layer**: API
  - **Scope**: Attempt submission (state transition to SUBMITTED)
  - **Transactional**: YES (pessimistic lock, FOR UPDATE)
  - **Idempotency**: YES (submission_idempotency_keys table + status check)
  - **Middleware Stack**: tenantResolver → licenseMiddleware → correlationId → authContext → rbacMiddleware → idempotencyMiddleware
  - **License Requirement**: ACTIVE (prevent new submissions if SOFT_LOCKED/ARCHIVED per spec)
  - **Concurrency**: Pessimistic lock with timeout (per clarification Q3)
  - **Lock Timeout**: 5 seconds per attempt
  - **Retry Strategy**: 3 total attempts with exponential backoff (1s, 2s, 4s)
  - **Dependencies**: T013, T014, T015, T016, T017, T018, T021
  - **Implementation**:
    - Route: POST /api/workspaces/:slug/attempts/:id/submit
    - Retry wrapper (max 3 attempts):
      1. SET lock_timeout = '5s'
      2. BEGIN TRANSACTION (SERIALIZABLE isolation)
      3. SELECT \* FROM attempts WHERE id = ? AND workspace_id = ? FOR UPDATE NOWAIT
         - If lock timeout: catch error, retry with backoff
      4. Verify status = IN_PROGRESS (else return 409 ALREADY_SUBMITTED or CONFLICT)
      5. Verify not already submitted: submitted_at IS NULL
      6. Verify attempt not expired: (NOW() - started_at) <= time_limit_snapshot + grace_period (30s)
      7. UPDATE attempts SET status = 'SUBMITTED', submitted_at = NOW(), updated_at = NOW()
      8. ENQUEUE grading_job(attempt_id, submission_sequence, idempotency_key)
         - If enqueue fails: ROLLBACK (transaction reverts; attempt remains IN_PROGRESS)
      9. RECORD submission to idempotency_keys table
      10. COMMIT
      11. Log: submission.completed event
      12. Return 200 OK
    - On lock timeout after 3 retries: Return 503 ATTEMPT_CONCURRENCY_VIOLATION
  - **Error Handling**:
    - 404 if attempt not found
    - 409 if already SUBMITTED or FINALIZED
    - 503 if lock timeout after retries
    - 423 if license SOFT_LOCKED (handled by middleware; prevents NEW submissions)
    - 500 if enqueue fails (transaction rolls back; attempt remains IN_PROGRESS)
  - **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "attempt_id": "uuid",
        "status": "SUBMITTED",
        "submitted_at": "2026-02-18T15:30:00Z",
        "message": "Attempt submitted successfully. Grading in progress."
      },
      "error": null
    }
    ```
  - **Response (200 OK – Idempotent)**:
    ```json
    {
      "success": true,
      "data": {
        "attempt_id": "uuid",
        "status": "FINALIZED",
        "score": 75.5,
        "passed": true,
        "message": "Attempt already submitted. Returning cached result."
      },
      "error": null
    }
    ```
  - **Success Criteria**:
    - Submission changes status to SUBMITTED atomically
    - Grading job enqueued
    - Idempotent on replay (duplicate submission returns same result)
    - Lock timeout handled correctly with retries
    - Transaction rolls back if enqueue fails

---

- [ ] T029 Create submission lock handler in `apps/api/src/modules/attempt/submission-lock.ts`
  - **Layer**: API (Domain Logic)
  - **Scope**: Handle pessimistic locking and retries
  - **Transactional**: N/A (called within transaction by T028)
  - **Idempotency**: N/A
  - **Lock Timeout**: 5 seconds (per clarification Q3)
  - **Retry Backoff**: [1, 2, 4] seconds
  - **Dependencies**: None
  - **Functions to Create**:
    - `acquireAttemptLock(db, attemptId, workspaceId, maxRetries)` → Tries to acquire FOR UPDATE lock with retries
    - `handleLockTimeout(error, retryCount, maxRetries)` → Decides whether to retry or fail
    - `withAttemptLock(db, attemptId, workspaceId, callback)` → Execute callback within lock
  - **Success Criteria**:
    - Lock acquisition works
    - Retry logic works correctly
    - Timeout errors handled gracefully

---

- [ ] T030 Create grading job enqueue service in `apps/api/src/modules/attempt/grading-enqueue.ts`
  - **Layer**: API (Domain Logic)
  - **Scope**: Enqueue grading job to worker queue
  - **Transactional**: Transactionally coupled with submission (if enqueue fails, transaction rolls back)
  - **Idempotency**: Job broker handles deduplication
  - **Dependencies**: None (service integrates with job broker)
  - **Functions to Create**:
    - `enqueueGradingJob(jobBroker, attemptId, workspaceId, correlationId)` → Enqueue job
    - Job payload: {job_type: 'GRADE_ATTEMPT', attempt_id, submission_sequence, idempotency_key, correlation_id, created_at}
  - **Queue Configuration**:
    - Queue name: 'zidney.grading'
    - Job type: 'GRADE_ATTEMPT'
    - Priority: normal
  - **Success Criteria**:
    - Job enqueues successfully
    - Job contains all required fields
    - Enqueue failure has correct error handling

---

- [ ] T031 Create submission idempotency recorder in `apps/api/src/modules/attempt/idempotency-recorder.ts`
  - **Layer**: API (Domain Logic)
  - **Scope**: Record submission to idempotency table
  - **Transactional**: Transactionally coupled with submission
  - **Idempotency**: UNIQUE constraint on (attempt_id, submission_sequence) prevents duplicates
  - **Dependencies**: T004 (idempotency table)
  - **Functions to Create**:
    - `recordSubmissionIdempotency(db, workspaceId, attemptId, sequenceNum, idempotencyKey, responseStatus, responseBody)` → INSERT or UPDATE
  - **Success Criteria**:
    - Submission recorded to database
    - Idempotency key unique per submission_sequence

---

### API Routes — Results

- [ ] T032 Create `GET /api/workspaces/:slug/attempts/:id/result` endpoint in `apps/api/src/routes/attempts/result.ts`
  - **Layer**: API
  - **Scope**: Get attempt result (only after FINALIZED)
  - **Transactional**: No (read-only)
  - **Idempotency**: N/A
  - **Middleware Stack**: tenantResolver → licenseMiddleware → correlationId → authContext → rbacMiddleware
  - **Dependencies**: T013, T014, T015, T017, T018
  - **Implementation**:
    - Route: GET /api/workspaces/:slug/attempts/:id/result
    - Route handler:
      1. SELECT \* FROM attempts WHERE id = ? AND workspace_id = ?
      2. Verify user owns attempt (attempt.user_id = req.user.id)
      3. Verify status = FINALIZED (else return 404 or conditional response)
      4. Check if flags_snapshot.review_allowed = false AND attempt not own → 403 FORBIDDEN
      5. Parse result_snapshot (JSONB)
      6. Return result with:
         - score, passed, total_points, pass_score
         - question_results[] (per-question breakdown)
         - summary text
      7. Log: result.retrieved event
  - **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "attempt_id": "uuid",
        "score": 75.5,
        "passed": true,
        "total_points": 100,
        "pass_score": 60,
        "summary": "Congratulations! You scored 75.5/100",
        "question_results": [
          {
            "question_id": "uuid",
            "text": "What is 2+2?",
            "type": "MCQ",
            "points_earned": 5,
            "points_possible": 5,
            "user_answer": { "selected_option": "option_0" },
            "correct_answer": { "selected_option": "option_0" },
            "feedback": "Correct!",
            "show_correct_answer": true
          }
        ]
      },
      "error": null
    }
    ```
  - **Success Criteria**:
    - Returns complete result
    - Shows correct answers only if allowed
    - Properly formatted per question

---

### API Validation & Error Handling

- [ ] T033 Create comprehensive error response formatter in `apps/api/src/utils/error-formatter.ts`
  - **Layer**: API (Utility)
  - **Scope**: Format all errors into RFC 7807 standard
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Dependencies**: None
  - **Error Codes to Map** (from spec):
    - 400: INVALID_REQUEST
    - 401: UNAUTHORIZED
    - 403: WORKSPACE_ARCHIVED, FORBIDDEN
    - 404: WORKSPACE_NOT_FOUND, ATTEMPT_NOT_FOUND
    - 409: ATTEMPT_ALREADY_SUBMITTED, ATTEMPT_CONCURRENCY_VIOLATION
    - 422: INVALID_ATTEMPT_CONFIG
    - 423: WORKSPACE_SOFT_LOCKED
    - 426: SCHEMA_VERSION_INCOMPATIBLE, PRODUCT_VERSION_INCOMPATIBLE
    - 429: RATE_LIMIT_EXCEEDED (reserved)
    - 500: INTERNAL_SERVER_ERROR
    - 503: SERVICE_UNAVAILABLE, MIGRATION_IN_PROGRESS, GRADING_FAILED
  - **Response Format**:
    ```json
    {
      "success": false,
      "data": null,
      "error": {
        "code": "ERROR_CODE",
        "message": "Human-readable message",
        "status": 409,
        "correlation_id": "req-uuid"
      }
    }
    ```
  - **Success Criteria**:
    - All errors use standard format
    - HTTP status codes correct
    - Error messages clear and actionable

---

- [ ] T034 Create attempt authorization checks in `apps/api/src/modules/attempt/authorization.ts`
  - **Layer**: API (Domain Logic)
  - **Scope**: Verify user can access/modify attempt
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Dependencies**: None
  - **Functions to Create**:
    - `verifyAttemptOwnership(attempt, userId)` → Check attempt.user_id = userId
    - `verifyAttemptNotExpired(attempt)` → Check status != EXPIRED
    - `verifyAttemptNotSubmitted(attempt)` → Check status = IN_PROGRESS
    - `verifyAllowedToViewResult(attempt, userId, isInstructor)` → Check review permissions
  - **Success Criteria**:
    - Authorization checks work correctly

---

- [ ] T035 Create rate limiting configuration in `apps/api/src/config/rate-limits.ts`
  - **Layer**: Configuration
  - **Scope**: Rate limit thresholds
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Dependencies**: None
  - **Constants to Define**:
    - POST /attempt/start: 5 per minute per user per exam
    - GET /attempt/{id}/progress: 60 per minute per user
    - POST /attempt/{id}/answer: 1000 per minute per user
    - POST /attempt/{id}/submit: 3 per minute per user per attempt
    - GET /attempt/{id}/result: 60 per minute per user
  - **Success Criteria**:
    - Rate limits exported
    - Can be used by rate limiting middleware

---

- [ ] T036 Create transaction wrapper utility in `apps/api/src/utils/transaction-wrapper.ts`
  - **Layer**: API (Utility)
  - **Scope**: Reusable transaction handling
  - **Transactional**: N/A (used by other functions)
  - **Idempotency**: N/A
  - **Dependencies**: None
  - **Functions to Create**:
    - `withTransaction(db, callback)` → BEGIN; callback(); COMMIT or ROLLBACK
    - `withAttemptLock(db, attemptId, callback)` → SELECT FOR UPDATE + transaction
    - Error handling: Auto-rollback on exception
  - **Success Criteria**:
    - Transaction utility works correctly
    - Rollback on failure verified

---

## PHASE E: WORKER & GRADING (Week 3-4)

### Worker Layer — Grading Pipeline

- [ ] T037 Create worker grading job processor in `apps/worker/src/jobs/grade-attempt.ts`
  - **Layer**: Worker
  - **Scope**: Process GRADE_ATTEMPT jobs from queue
  - **Transactional**: YES (pessimistic lock + atomic update)
  - **Idempotency**: YES (check status before grading; skip if already FINALIZED)
  - **Job Type**: GRADE_ATTEMPT
  - **Queue**: zidney.grading
  - **Max Retries**: 5 (per spec; different from submission 3)
  - **Backoff**: Exponential (1s, 2s, 4s, 8s, 16s)
  - **DLQ**: Move to dead_letter_queue after max retries
  - **Dependencies**: T012 (DB query builders)
  - **Implementation**:
    - Job handler entry point
    - Extract job payload: {attempt_id, submission_sequence, correlation_id}
    - Retry wrapper (max 5 retries):
      1. Get tenant DB connection: getTenantDatabase(job.workspace_id)
      2. SET lock_timeout = '30s'
      3. BEGIN TRANSACTION
      4. SELECT \* FROM attempts WHERE id = ? AND workspace_id = ? FOR UPDATE
      5. Idempotency check: IF status = FINALIZED, ROLLBACK and exit (already graded)
      6. Verify status = SUBMITTED (else log error and exit)
      7. Load snapshot: question_snapshot, grading_config_snapshot from attempt
      8. Load answers: SELECT user_answer FROM attempt_progress WHERE attempt_id = ?
      9. Version compatibility check:
         - IF expected_schema_version < MIN_SUPPORTED: score=0, passed=false, error="Schema incompatible"
         - IF expected_product_version not in supported range: same
      10. Call gradingEngine.computeScore(questions, answers, gradingConfig)
      11. Build result_snapshot with per-question breakdown
      12. UPDATE attempts SET status='FINALIZED', score=?, passed=?, result_snapshot=?, finalized_at=NOW()
      13. IF passed AND certificate_enabled: ENQUEUE generate_certificate_job
      14. COMMIT
      15. Log: grading.completed event
    - On deadlock (error 40P01): Retry with backoff
    - On lock timeout: Retry with backoff
    - On grading error: Retry up to 5 times; move to DLQ after max retries
    - On DLQ move: Log error, alert ops team
  - **Error Handling**:
    - Deadlock: Catch error, retry
    - Lock timeout: Retry
    - Version mismatch: Mark as error, finalize
    - Grading crash: Catch exception, move to DLQ
  - **Success Criteria**:
    - Job processor works
    - Grading completes and stores result
    - Idempotency verified (replay produces same result)
    - Retry logic works

---

- [x] T038 Create deterministic score computation engine in `apps/worker/src/grading/score-engine.ts`
  - **Layer**: Worker (Domain Logic)
  - **Scope**: Calculate scores deterministically
  - **Transactional**: No
  - **Idempotency**: YES (deterministic: same input → same output)
  - **Dependencies**: T007 (types)
  - **Functions to Create**:
    - `computeScore(questions, answers, gradingConfig)` → Returns numeric score
    - `evaluatePassLogic(score, gradingConfig)` → Returns boolean (passed)
    - `buildResultSnapshot(questions, answers, score, passed)` → Returns detailed result
    - `scoreQuestion(question, userAnswer)` → Score single question
    - Per-question scorers:
      - `scoreMCQ(question, userAnswer)` → 0 or points if correct
      - `scoreShortAnswer(question, userAnswer)` → Partial credit possible
      - `scoreEssay(question, userAnswer)` → Configurable rubric-based
  - **Determinism Requirements**:
    - No random number generation (use question snapshot data only)
    - No external service calls
    - No time-based logic
    - Same input ALWAYS produces same output
    - Tested with 1000+ iterations
  - **Success Criteria**:
    - Score computation deterministic
    - All question types scored correctly
    - Pass/fail logic applied correctly
    - Result snapshot complete and accurate

---

- [ ] T039 Create grading result builder in `apps/worker/src/grading/result-builder.ts`
  - **Layer**: Worker (Domain Logic)
  - **Scope**: Build detailed result snapshot
  - **Transactional**: No
  - **Idempotency**: YES (deterministic)
  - **Dependencies**: T038 (score engine)
  - **Functions to Create**:
    - `buildResultSnapshot(attemptId, questions, answers, scores, gradingConfig)` → Full result
    - `buildQuestionResult(question, userAnswer, score, feedback)` → Per-question detail
    - `buildSummaryText(score, passScore, passed)` → Congratulations/try again message
  - **Result Structure**:
    ```json
    {
      "attempt_id": "uuid",
      "score": 75.5,
      "passed": true,
      "total_points": 100,
      "pass_score": 60,
      "question_results": [
        {
          "question_id": "uuid",
          "points_earned": 5,
          "points_possible": 5,
          "user_answer": {...},
          "correct_answer": {...},
          "feedback": "Correct!",
          "explanation": "Optional detailed explanation"
        }
      ],
      "summary": "You scored 75.5/100"
    }
    ```
  - **Success Criteria**:
    - Result structure correct
    - All question details included
    - Summary text appropriate

---

- [ ] T040 Create worker retry and DLQ handler in `apps/worker/src/jobs/retry-handler.ts`
  - **Layer**: Worker (Job Infrastructure)
  - **Scope**: Manage job retries and dead-letter queue
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Dependencies**: None
  - **Functions to Create**:
    - `shouldRetry(error, retryCount, maxRetries)` → Boolean
    - `getBackoffDelay(retryCount)` → Milliseconds (exponential: 1s, 2s, 4s, 8s, 16s)
    - `moveToDeadLetterQueue(job, error, reason)` → Move job to DLQ table
    - `alertOpsTeam(job, error)` → Send alert/log to ops
  - **DLQ Structure**:
    - job_id, attempt_id, error_reason, created_at, status, manual_review_flag
  - **Alert Pattern**:
    - Log: ERROR level
    - Fields: attempt_id, error_code, error_message, duration_ms, retry_count
    - Correlation ID included
  - **Success Criteria**:
    - Retry logic works
    - DLQ receives failed jobs
    - Alerts sent correctly

---

- [ ] T041 Create certificate job enqueue trigger in `apps/worker/src/jobs/certificate-trigger.ts`
  - **Layer**: Worker (Domain Logic)
  - **Scope**: Enqueue certificate generation if applicable
  - **Transactional**: Transactionally coupled with grading (if enqueue fails, grading still succeeds; retry certificate separately)
  - **Idempotency**: N/A (certificate job handles dedup)
  - **Dependencies**: T037 (grading processor)
  - **Functions to Create**:
    - `enqueueCertificateIfNeeded(attempt, jobBroker)` → Check flags and enqueue if needed
    - Conditions: status=FINALIZED AND passed=true AND certificate_enabled=true
  - **Certificate Job Payload**:
    - {job_type: 'GENERATE_CERTIFICATE', attempt_id, workspace_id, correlation_id}
  - **Success Criteria**:
    - Certificate job enqueued when applicable
    - Not enqueued for failed attempts

---

- [ ] T042 Create version compatibility checker in `apps/worker/src/grading/version-checker.ts`
  - **Layer**: Worker (Domain Logic)
  - **Scope**: Verify version compatibility before grading
  - **Transactional**: No (called within grading transaction)
  - **Idempotency**: YES (deterministic check)
  - **Dependencies**: T011 (version constants)
  - **Functions to Create**:
    - `checkVersionCompatibility(attempt)` → Returns {compatible: bool, reason?: string}
    - Schema version check: expected_schema_version >= MIN_SUPPORTED_SCHEMA_VERSION
    - Product version check: expected_product_version in SUPPORTED_RANGE
  - **Behavior on Incompatibility**:
    - Mark attempt: score=0, passed=false, error_reason="Version incompatible"
    - Do NOT crash; finalize with error
    - Log warning with attempt_id for audit
  - **Success Criteria**:
    - Version checks work correctly
    - Incompatibility handled gracefully (no crash)

---

- [ ] T043 Create worker configuration in `apps/worker/src/config/grading-config.ts`
  - **Layer**: Configuration
  - **Scope**: Worker grading settings
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Constants to Define**:
    - MAX_RETRIES = 5
    - BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000] (ms)
    - LOCK_TIMEOUT = 30 seconds
    - JOB_TIMEOUT = 60 seconds
    - QUEUE_NAME = 'zidney.grading'
    - JOB_TYPE = 'GRADE_ATTEMPT'
  - **Success Criteria**:
    - Configuration exported and used by job processor

---

## PHASE F: TESTING & OBSERVABILITY (Week 4-5)

### Testing Layer — Unit Tests

- [ ] T044 Create unit tests for snapshot builder in `apps/api/tests/unit/snapshot-builder.test.ts`
  - **Layer**: Testing (Unit)
  - **Scope**: Snapshot creation logic
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Dependencies**: T023 (snapshot builder)
  - **Test Cases**:
    - ✓ Captures all question metadata
    - ✓ Includes correct answers (secret)
    - ✓ Serializes as valid JSON
    - ✓ Is self-sufficient (no external references)
    - ✓ Snapshot deterministic (same input → same snapshot)
  - **Success Criteria**:
    - All tests pass
    - Coverage ≥90% of snapshot builder

---

- [ ] T045 Create unit tests for version compatibility in `apps/worker/tests/unit/version-checker.test.ts`
  - **Layer**: Testing (Unit)
  - **Scope**: Version checking logic
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Dependencies**: T042 (version checker)
  - **Test Cases**:
    - ✓ Rejects schema_version < MIN_SUPPORTED
    - ✓ Accepts current schema_version
    - ✓ Rejects incompatible product_version
    - ✓ Accepts compatible product_version
    - ✓ Returns appropriate error reasons
  - **Success Criteria**:
    - All version checks tested
    - Coverage ≥95%

---

- [ ] T046 Create unit tests for score computation in `apps/worker/tests/unit/score-engine.test.ts`
  - **Layer**: Testing (Unit)
  - **Scope**: Deterministic score calculation
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Dependencies**: T038 (score engine)
  - **Test Cases**:
    - ✓ MCQ: Correct answer = full points
    - ✓ MCQ: Wrong answer = 0 points
    - ✓ Short answer: Partial credit if applicable
    - ✓ Essay: Rubric-based scoring
    - ✓ Mixed question types: Combined score
    - ✓ Deterministic: 1000 replays produce identical score
    - ✓ Pass/fail logic applied correctly
  - **Success Criteria**:
    - All question types tested
    - Determinism verified (1000 iterations)
    - Coverage ≥95%

---

- [ ] T047 Create unit tests for error formatting in `apps/api/tests/unit/error-formatter.test.ts`
  - **Layer**: Testing (Unit)
  - **Scope**: Error response format
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Dependencies**: T033 (error formatter)
  - **Test Cases**:
    - ✓ All error codes mapped to RFC 7807 format
    - ✓ Correct HTTP status codes
    - ✓ Messages are human-readable
    - ✓ Correlation IDs included
    - ✓ No sensitive data in errors
  - **Success Criteria**:
    - All error codes tested
    - Coverage ≥99%

---

### Testing Layer — Integration Tests

- [ ] T048 Create integration test for full attempt flow in `apps/api/tests/integration/attempt-flow.test.ts`
  - **Layer**: Testing (Integration)
  - **Scope**: End-to-end attempt lifecycle
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Dependencies**: All API routes (T022-T032)
  - **Test Cases**:
    - ✓ Create attempt → receives snapshot + question_count
    - ✓ Save progress → answers persisted; time_remaining calculated
    - ✓ Get status → progress shown; time_remaining updated
    - ✓ Submit attempt → status=SUBMITTED; grading job enqueued
    - ✓ Wait for grading → worker processes job; status=FINALIZED
    - ✓ Get result → score, passed, question_results shown
  - **Validation**:
    - Snapshot matches exam data at creation time
    - Progress updates applied correctly
    - Grading score deterministic (re-grade produces same result)
  - **Success Criteria**:
    - Full flow works end-to-end
    - No data lost between steps

---

- [ ] T049 Create integration test for license enforcement in `apps/api/tests/integration/license-enforcement.test.ts`
  - **Layer**: Testing (Integration)
  - **Scope**: License middleware behavior
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Dependencies**: T014 (license middleware), T022, T028
  - **Test Cases**:
    - ✓ ACTIVE license: Attempt creation allowed
    - ✓ SOFT_LOCKED license: Attempt creation blocked (423)
    - ✓ SOFT_LOCKED license: Already submitted attempt can complete
    - ✓ ARCHIVED license: Attempt creation blocked (403)
    - ✓ ARCHIVED license: Already submitted attempt can complete
    - ✓ Transition ACTIVE→SOFT_LOCKED: New attempts blocked; existing can submit
  - **Success Criteria**:
    - License states enforced correctly
    - All state transitions tested

---

- [ ] T050 Create integration test for version compatibility in `apps/api/tests/integration/version-compatibility.test.ts`
  - **Layer**: Testing (Integration)
  - **Scope**: Version checks at creation and grading
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Dependencies**: T011, T022, T028, T037
  - **Test Cases**:
    - ✓ Incompatible schema_version: Attempt creation rejected (426)
    - ✓ Compatible schema_version: Attempt creation allowed
    - ✓ Incompatible product_version: Attempt creation rejected (426)
    - ✓ Attempt with old schema_version: Grading completes with error (score=0, passed=false)
    - ✓ Attempt with incompatible product_version: Grading completes with error
  - **Success Criteria**:
    - Version checks enforced at all points
    - Incompatibility handled gracefully (no crash)

---

- [ ] T051 Create integration test for idempotency in `apps/api/tests/integration/idempotency.test.ts`
  - **Layer**: Testing (Integration)
  - **Scope**: Idempotent operations
  - **Transactional**: N/A
  - **Idempotency**: YES (test validates)
  - **Dependencies**: T016, T025, T028
  - **Test Cases**:
    - ✓ Duplicate progress update: Upsert prevents duplicate rows
    - ✓ Duplicate submission: Returns same result (cached)
    - ✓ Duplicate submission with different idempotency key: New result
    - ✓ Replay grading on same attempt: Worker detects FINALIZED, skips
    - ✓ 100+ replay submissions: Single grading job, identical results
  - **Success Criteria**:
    - Idempotency verified for all operations
    - No duplicate jobs created
    - Identical results on replay

---

- [ ] T052 Create integration test for concurrency in `apps/api/tests/integration/concurrency.test.ts`
  - **Layer**: Testing (Integration)
  - **Scope**: Concurrent submission safety
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Concurrency Load**: 100 concurrent submissions to same attempt
  - **Dependencies**: T022, T028, T029
  - **Test Cases**:
    - ✓ 100 concurrent submissions: Only one succeeds; others wait on lock
    - ✓ Others timeout after 5s, retry with backoff
    - ✓ After 3 retries: Return 503 ATTEMPT_CONCURRENCY_VIOLATION
    - ✓ No data corruption (attempt consistent)
    - ✓ Grading job enqueued exactly once or not at all
    - ✓ No duplicate grading despite concurrent submissions
  - **Latency Targets**:
    - Successful submission: <500ms (optimal); <5s (acceptable)
    - Lock contention: Handled correctly; no timeouts under normal load
  - **Success Criteria**:
    - Concurrency safety verified
    - Performance acceptable
    - No data corruption

---

- [ ] T053 Create integration test for multi-tenant isolation in `apps/api/tests/integration/isolation.test.ts`
  - **Layer**: Testing (Integration)
  - **Scope**: Tenant data isolation
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Dependencies**: T013 (tenant resolver), all API routes
  - **Test Cases**:
    - ✓ Attempt in workspace A: Not visible to workspace B user
    - ✓ Query from workspace B: Returns empty or 404
    - ✓ No accidental cross-tenant joins in queries
    - ✓ Tenant connection pools isolated (different PostgreSQL connections per workspace)
    - ✓ Tenant DB schemas isolated (separate databases)
  - **Success Criteria**:
    - Zero cross-tenant data leakage
    - Isolation verified at all query levels

---

- [ ] T054 Create integration test for transaction rollback in `apps/api/tests/integration/transactions.test.ts`
  - **Layer**: Testing (Integration)
  - **Scope**: Transaction atomicity and rollback
  - **Transactional**: N/A (test validates)
  - **Idempotency**: N/A
  - **Dependencies**: T022 (create), T028 (submit)
  - **Test Cases**:
    - ✓ Snapshot capture fails: Entire transaction rolled back; no partial records
    - ✓ Progress save fails: Upsert rolled back; no inconsistent state
    - ✓ Submit fails (enqueue error): No SUBMITTED status; no orphaned grading job
    - ✓ Grading fails (compute error): Status remains SUBMITTED; no partial result
  - **Success Criteria**:
    - All-or-nothing semantics verified
    - No partial writes on failure

---

- [ ] T055 Create integration test for time-based operations in `apps/api/tests/integration/timing.test.ts`
  - **Layer**: Testing (Integration)
  - **Scope**: Server-authoritative time validation
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Dependencies**: T022, T025, T026
  - **Test Cases**:
    - ✓ RELAX mode: No server timer; manual submission only
    - ✓ CHRONO mode: Server enforces expiration after time_limit
    - ✓ RUSH mode: Server validates total time not exceeded
    - ✓ Time remaining calculated: NOW() - started_at
    - ✓ Grace period: 30 seconds for reconnection
    - ✓ Auto-submit on timeout (worker triggers grading)
  - **Success Criteria**:
    - Server-authoritative time enforced
    - All timing modes work

---

### Observability Layer — Structured Logging

- [ ] T056 Create structured logging setup in `apps/api/src/config/logging.ts`
  - **Layer**: Observability
  - **Scope**: Structured JSON logging configuration
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Dependencies**: None
  - **Configuration**:
    - Logger format: JSON (Winston or equivalent)
    - Default fields: timestamp, level, service, message, correlation_id
    - Optional fields: workspace_slug, workspace_id, user_id, attempt_id, operation, duration_ms
    - Log levels: DEBUG, INFO, WARN, ERROR
    - Output: stdout (JSON formatted)
  - **Success Criteria**:
    - Logger configured
    - Mandatory fields always included
    - No console.log() anywhere (all logs structured)

---

- [ ] T057 Create log event types in `apps/api/src/logging/log-events.ts`
  - **Layer**: Observability
  - **Scope**: Standardized log event definitions
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Dependencies**: T056 (logging config)
  - **Log Events to Define**:
    - attempt.created
    - attempt.progress_saved
    - attempt.submitted
    - attempt.status_retrieved
    - attempt.result_retrieved
    - attempt.license_invalid
    - attempt.creation_failed
    - attempt.expired
    - grading.started
    - grading.completed
    - grading.failed
    - certificate.queued
  - **Each Event Includes**: Required fields, optional fields, example payload
  - **Success Criteria**:
    - All event types defined
    - Used consistently across codebase

---

- [ ] T058 Create log instrumentation for API layer in `apps/api/src/logging/api-logger.ts`
  - **Layer**: Observability
  - **Scope**: Structured logs in API routes
  - **Transactional**: No (logging only)
  - **Idempotency**: N/A
  - **Dependencies**: T056, T057
  - **API Functions to Instrument**:
    - T022 (create attempt): Log attempt.created on success
    - T025 (save progress): Log attempt.progress_saved on success
    - T028 (submit attempt): Log attempt.submitted on success; attempt.license_invalid on 423/403
    - T026 (get status): Log attempt.status_retrieved
    - T032 (get result): Log attempt.result_retrieved
  - **Log Payload Example** (attempt.created):
    ```json
    {
      "timestamp": "2026-02-18T14:30:00.123Z",
      "level": "INFO",
      "service": "api",
      "message": "Attempt created successfully",
      "operation": "create",
      "attempt_id": "att-uuid",
      "exam_id": "exam-uuid",
      "user_id": "user-uuid",
      "workspace_id": "ws-uuid",
      "workspace_slug": "acme-university",
      "correlation_id": "req-uuid",
      "attempt_type": "MCQ_EXAM",
      "mode": "CHRONO",
      "question_count": 20,
      "time_limit_seconds": 3600,
      "snapshot_size_bytes": 12345,
      "duration_ms": 125
    }
    ```
  - **Success Criteria**:
    - All API operations logged
    - Mandatory fields present
    - Logs are actionable

---

- [ ] T059 Create log instrumentation for worker layer in `apps/worker/src/logging/worker-logger.ts`
  - **Layer**: Observability
  - **Scope**: Structured logs in worker jobs
  - **Transactional**: No (logging only)
  - **Idempotency**: N/A
  - **Dependencies**: T056, T057
  - **Worker Functions to Instrument**:
    - T037 (grade attempt): Log grading.started, grading.completed, grading.failed
    - T041 (certificate trigger): Log certificate.queued
  - **Log Payload Example** (grading.completed):
    ```json
    {
      "timestamp": "2026-02-18T15:31:00.234Z",
      "level": "INFO",
      "service": "worker",
      "message": "Grading completed successfully",
      "operation": "grade",
      "attempt_id": "att-uuid",
      "workspace_id": "ws-uuid",
      "correlation_id": "req-uuid",
      "score": 75.5,
      "passed": true,
      "question_count": 20,
      "duration_ms": 1234,
      "certificate_enqueued": true
    }
    ```
  - **Success Criteria**:
    - Worker logs structured and complete
    - Correlation IDs propagated from API to worker

---

- [ ] T060 Create integration test for structured logging in `apps/api/tests/integration/logging.test.ts`
  - **Layer**: Testing (Integration)
  - **Scope**: Verify structured logging
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Dependencies**: T056-T059
  - **Test Cases**:
    - ✓ Log output is valid JSON
    - ✓ Mandatory fields present (timestamp, level, service, correlation_id)
    - ✓ Event-specific fields present
    - ✓ No PII logged (passwords, tokens, answers)
    - ✓ Correlation ID propagated across requests
    - ✓ Log levels appropriate (ERROR for errors, INFO for normal ops)
  - **Success Criteria**:
    - Logging validated
    - All logs parseable as JSON
    - Correlation ID propagation verified

---

### Final Validation Tests

- [ ] T061 Create constitutional compliance validation test in `apps/api/tests/compliance/constitution.test.ts`
  - **Layer**: Testing (Compliance)
  - **Scope**: Verify all constitutional requirements met
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Dependencies**: All previous tasks
  - **Compliance Checks**:
    - ✓ ADR-0001: Database-per-tenant (no cross-tenant queries)
    - ✓ ADR-0002: Snapshot immutability (snapshot never updated; grading uses snapshot only)
    - ✓ ADR-0006: Server-authoritative time (NO client time used for decisions)
    - ✓ ADR-0007: Version enforcement (versions checked at creation and grading)
    - ✓ ADR-0008: Migration discipline (migration is forwards-only)
    - ✓ License middleware required (all workspace-bound routes have license check)
    - ✓ Transaction safety (all mutations transactional)
    - ✓ No client grading (all grading in worker)
    - ✓ No grading logic in API (zero score computation in API)
  - **Success Criteria**:
    - All constitutional requirements verified
    - No violations detected

---

- [ ] T062 Create performance benchmark test in `apps/api/tests/performance/benchmarks.test.ts`
  - **Layer**: Testing (Performance)
  - **Scope**: Verify performance requirements
  - **Transactional**: N/A
  - **Idempotency**: N/A
  - **Dependencies**: All API routes
  - **Benchmarks**:
    - Attempt creation: <500ms p99
    - Progress save: <100ms p99
    - Submission: <500ms p99 (optimal); <5s p99 (under lock contention)
    - Result retrieval: <100ms p99
    - Grading: <5s p99 (deterministic computation)
    - Concurrency (100 concurrent submissions): All complete within 30s
  - **Success Criteria**:
    - Performance meets targets

---

- [ ] T063 Create documentation for API consumers in `docs/attempt-engine-api.md`
  - **Layer**: Documentation
  - **Scope**: API reference and examples
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Content**:
    - API overview and architecture
    - Endpoint reference: Create, Progress, Submit, Status, Result
    - Request/response examples
    - Error codes and handling
    - Idempotency key usage
    - Correlation ID propagation
    - Rate limits
  - **Success Criteria**:
    - Documentation complete and accurate

---

- [ ] T064 Create deployment checklist in `docs/DEPLOYMENT_CHECKLIST_STAGE_06.md`
  - **Layer**: Documentation
  - **Scope**: Pre-deployment verification
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Checklist Items**:
    - [ ] All migrations tested in staging
    - [ ] All API endpoints tested end-to-end
    - [ ] Concurrency tests pass (100 concurrent submissions)
    - [ ] Version compatibility verified
    - [ ] License enforcement verified
    - [ ] Tenant isolation verified
    - [ ] Structured logging verified
    - [ ] Worker retry logic tested
    - [ ] DLQ handling tested
    - [ ] Alerts configured
    - [ ] Disaster recovery plan confirmed
  - **Success Criteria**:
    - Deployment checklist created and reviewed

---

- [ ] T065 Create monitoring & alerting setup in `docs/monitoring-stage-06.md`
  - **Layer**: Observability (Operations)
  - **Scope**: Monitoring and alerting configuration
  - **Transactional**: No
  - **Idempotency**: N/A
  - **Metrics to Monitor**:
    - attempt.creation_latency_ms (histogram)
    - attempt.submission_latency_ms (histogram)
    - grading.latency_ms (histogram)
    - attempt.count_in_progress (gauge)
    - grading.queue_depth (gauge)
    - grading.failure_rate (counter)
    - license.soft_locked_count (gauge)
  - **Alerts**:
    - Grading failure rate > 1%
    - Grading queue depth > 1000
    - Submission latency p99 > 5s
    - License transitions detected (ACTIVE→SOFT_LOCKED)
  - **Success Criteria**:
    - Monitoring configured
    - Alerts configured and tested

---

### Summary & Sign-Off

- [ ] T066 All tests pass (unit, integration, performance, compliance)
- [ ] T067 Code review completed (architecture, transactions, idempotency)
- [ ] T068 Migration tested in staging environment
- [ ] T069 Deployment checklist completed
- [ ] T070 Monitoring configured and validated
- [ ] T071 Documentation reviewed and finalized
- [ ] T072 Stage sign-off: ready for production deployment

---

## Task Summary by Layer

### Database Layer (Tasks 1-12)

- Schema creation and migrations
- Index optimization
- Type definitions
- Connection pool management
- Version tracking
- Query builders

**Total**: 12 tasks | **Duration**: 5 days

---

### Middleware Layer (Tasks 13-21)

- Tenant resolution
- License validation
- Correlation ID propagation
- Idempotency (Redis + PostgreSQL)
- Authentication and RBAC
- Input validation

**Total**: 9 tasks | **Duration**: 3 days

---

### API Layer – Create & Progress (Tasks 22-27)

- POST /attempts (create)
- Snapshot building
- Exam loading
- POST /attempts/{id}/progress (autosave)
- GET /attempts/{id} (status)
- Answer validation

**Total**: 6 tasks | **Duration**: 3 days

---

### API Layer – Submit & Result (Tasks 28-36)

- POST /attempts/{id}/submit (submission with locking)
- Submission lock handling
- Grading job enqueue
- Submit /attempts/{id}/result (get result)
- Error formatting
- Authorization checks
- Rate limiting configuration
- Transaction wrapper utility

**Total**: 9 tasks | **Duration**: 4 days

---

### Worker Layer (Tasks 37-43)

- Job processor
- Score computation engine
- Result builder
- Retry and DLQ handling
- Certificate trigger
- Version compatibility check
- Worker configuration

**Total**: 7 tasks | **Duration**: 5 days

---

### Testing Layer (Tasks 44-65)

- Unit tests: Snapshot, Version, Score, Errors (4 tests)
- Integration tests: Flow, License, Version, Idempotency, Concurrency, Isolation, Transactions, Timing (8 tests)
- Compliance tests: Constitutional validation
- Performance tests: Benchmarks (1 test)
- Logging tests: Integration test for structured logging
- Documentation & Deployment (3 items)

**Total**: 22 tasks | **Duration**: 7 days

---

## Dependency Graph

```
Database Layer (1-12)
  ↓
Middleware (13-21)
  ↓
API Create/Progress (22-27) ← Middleware required
  ↓
API Submit/Result (28-36) ← Create/Progress required
  ↓
Worker (37-43)
  ↓
Testing (44-65) ← All previous layers required
```

**Critical Path**: T001 → T013 → T022 → T028 → T037 → T048 → **Production Ready**

---

## Parallel Execution Opportunities

**Can execute in parallel (no dependencies)**:

- T001, T007, T009, T011 (Infrastructure setup)
- T013, T014, T015, T017, T018, T019, T020, T021 (Middleware setup, parallel after DB)
- T022, T024 (Exam loader + Create endpoint, parallel with middleware)
- T025, T026, T027 (Progress endpoints, can start after T022)
- T028, T029, T030, T031 (Submit logic, depends on T022)
- T032, T033, T034, T035, T036 (Results/errors, can start after T022)
- T044-T047 (Unit tests, parallel with all implementations)
- T048-T055 (Integration tests, parallel with all implementations)

**Suggested Phased Approach**:

- **Week 1**: Database (T001-T012) + Middleware (T013-T021) in parallel
- **Week 2**: API Create/Progress (T022-T027) + Setup completion
- **Week 2-3**: API Submit/Result (T028-T036) + Unit tests (T044-T047)
- **Week 3-4**: Worker (T037-T043) + Integration tests (T048-T055)
- **Week 4-5**: Compliance/Performance (T061-T065) + sign-off

---

## Success Criteria Summary

| Criterion          | Target          | Verification         |
| ------------------ | --------------- | -------------------- |
| All tasks complete | 72/72           | Checklist validation |
| Test coverage      | ≥90%            | Coverage report      |
| Performance        | p99 <5s         | Benchmark test       |
| Concurrency        | 100+ concurrent | Stress test          |
| Isolation          | Zero leakage    | Integration test     |
| Compliance         | 100%            | Constitution test    |
| Documentation      | Complete        | Review               |
| Deployment ready   | Yes             | Checklist complete   |

---

## Task Numbering Reference

- **T001-T012**: Database & Schema (Infrastructure)
- **T013-T021**: Middleware Layer
- **T022-T027**: API Create & Progress
- **T028-T036**: API Submit & Result
- **T037-T043**: Worker & Grading
- **T044-T047**: Unit Tests
- **T048-T055**: Integration Tests
- **T056-T060**: Observability & Logging
- **T061-T065**: Compliance, Performance, Documentation
- **T066-T072**: Final Validation & Sign-Off

---

**Total Tasks**: 72  
**Total Duration**: 5 weeks  
**Status**: Ready for Implementation  
**Date**: February 18, 2026
