# Tasks: Tenant Baseline Schema

**Feature Branch**: `002B-tenant-baseline-schema`  
**Created**: 2026-02-16  
**Status**: Ready for Implementation  
**Phase**: 01 – Platform Foundation  
**Stage**: STAGE_02B_TENANT_BASELINE_SCHEMA  
**Related Spec**: [spec.md](./spec.md)  
**Related Plan**: [plan.md](./plan.md)  
**Related Data Model**: [data-model.md](./data-model.md)

---

## Task Overview

**Total Tasks**: 67  
**Parallelizable Tasks**: 34  
**Critical Path**: 21 sequential tasks

**User Stories Covered**:

- US1 (P1): Tenant Provisioning - 16 tasks
- US2 (P1): Audit Trail Immutability - 8 tasks
- US3 (P1): Attempt Snapshot Immutability - 9 tasks
- US4 (P2): Referential Integrity - 12 tasks
- US5 (P2): Schema Versioning - 8 tasks
- Infrastructure & Testing - 14 tasks

**MVP Scope** (minimum viable): Phase 1 + Phase 2 + US1 + US5 (complete tenant provisioning with migration)

---

## Phase 1: Setup & Infrastructure (Foundation)

### Initialization & Project Structure

- [x] T001 Create database migration directories in `apps/api/src/db/tenant/migrations/` and `apps/api/src/db/master/migrations/`
- [x] T002 Create tenant schema SQL baseline file at `apps/api/src/db/tenant/migrations/v1.0.0/baseline-schema.sql` (empty, to be populated)
- [x] T003 Create PostgreSQL trigger functions file at `apps/api/src/db/tenant/migrations/v1.0.0/triggers.sql`
- [x] T004 Create migration execution utilities in `packages/domain-core/src/migrations/migrate.ts` (checksums, versioning)
- [x] T005 Create schema initialization task definition in `packages/domain-core/src/workers/tasks/init-tenant-schema.ts`
- [x] T006 Create migration application task definition in `packages/domain-core/src/workers/tasks/apply-migration.ts`
- [x] T007 Verify PostgreSQL 14+ installed and `pgBouncer` connection pool available (local dev)
- [x] T008 Verify Redis 6+ available for idempotency caching (local dev)

---

## Phase 2: Foundational Infrastructure (Blocking)

### Database Layer Setup

- [x] T009 [P] Create `schema_version` table definition with single-row trigger in `apps/api/src/db/tenant/migrations/v1.0.0/baseline-schema.sql`
  - Columns: `version VARCHAR(20)`, `applied_at TIMESTAMPTZ`, `checksum VARCHAR(64)`, `UNIQUE(version)`
  - Trigger: Enforce max 1 row
  - Transactional: Yes
  - Idempotent: N/A (schema initialization)
  - Middleware dependency: None (internal table)

- [x] T010 [P] Create PostgreSQL trigger function `raise_single_row_violation()` in `apps/api/src/db/tenant/migrations/v1.0.0/triggers.sql`
  - Prevents multiple rows in schema_version
  - Raises EXCEPTION on INSERT when count > 0
  - Transactional: Yes (trigger context)
  - Idempotent: N/A
  - Middleware dependency: None

- [x] T011 [P] Create PostgreSQL trigger function `raise_immutable_violation()` in `apps/api/src/db/tenant/migrations/v1.0.0/triggers.sql`
  - Prevents UPDATE on immutable tables (attempt_events, audit_logs)
  - Raises EXCEPTION on UPDATE attempt
  - Transactional: Yes (trigger context)
  - Idempotent: N/A
  - Middleware dependency: None

### Worker Infrastructure

- [x] T012 Create worker queue configuration in `apps/worker/src/config/queues.ts`
  - Queue name: `schema-initialization` (separate from attempt queue)
  - Queue name: `schema-migration` (for APPLY_MIGRATION tasks)
  - Retry policy: Exponential backoff (2s, 4s, 8s), max 3 retries
  - Timeout: 30 seconds per task
  - DLQ enabled: Yes
  - Transactional: N/A (configuration)
  - Idempotent: N/A
  - Middleware dependency: None

- [x] T013 Create worker task registry in `apps/worker/src/tasks/registry.ts`
  - Register INIT_TENANT_SCHEMA handler
  - Register APPLY_MIGRATION handler
  - Register DLQ handler for migration failures
  - Transactional: N/A (registry)
  - Idempotent: N/A
  - Middleware dependency: None
  - **Hardening**: Enforce retry policy: DO NOT RETRY on checksum mismatch (flag: tampering_detected)

### Middleware Foundation

- [x] T014 Create tenant resolver middleware in `apps/api/src/middleware/tenant-resolver.ts`
  - Extract tenant slug from subdomain OR req.params.tenant_id
  - Query MMC master DB for workspace_id
  - Return 404 if not found
  - Check user workspace membership (separate namespace)
  - Return 401/403 if unauthorized
  - Initialize tenant connection pool (lazy or eager) with explicit max size: 10 per workspace
  - Inject tenant_id, user_id into request context
  - **Hardening**: Document pool size limit in code; prevent silent unlimited pools
  - Transactional: No (read-only selects from master DB)
  - Idempotent: Yes (deterministic per request)
  - Middleware dependency: None (first middleware)
  - Version enforcement: No

- [x] T015 Create license validation middleware in `apps/api/src/middleware/license.ts`
  - Query MMC master DB: licenses table for workspace_id
  - Return 423 if status = SOFT_LOCKED
  - Return 403 if status = ARCHIVED
  - Return 404 if license not found
  - Proceed if status IN (ACTIVE, TRIAL)
  - Inject license info into request context
  - Transactional: No (read-only)
  - Idempotent: Yes (deterministic per request)
  - Middleware dependency: Requires tenant resolver
  - Version enforcement: No

- [x] T016 Create schema version validation middleware in `apps/api/src/middleware/schema-version.ts`
  - Get tenant DB connection from pool
  - SELECT version FROM schema_version LIMIT 1
  - Get expected version from license.product_version_compatibility
  - Return 409 if actual > expected (tenant ahead of product)
  - Return 503 + enqueue migration if actual < expected
  - Proceed if actual == expected
  - Transactional: No (read-only)
  - Idempotent: Yes
  - Middleware dependency: Requires license middleware
  - Version enforcement: Yes

---

## Phase 3: User Story 1 – Tenant Provisioning (P1)

### Schema Initialization Tables

- [x] T017 [US1] Create Identity layer tables in `apps/api/src/db/tenant/migrations/v1.0.0/baseline-schema.sql`
  - `users` table: id (UUID PK), email, first_name, last_name, password_hash, is_active, created_at, updated_at, created_by, updated_by, is_deleted
  - `roles` table: id, workspace_id, name, description, permissions_json, created_at, updated_at, created_by, updated_by, is_deleted
  - `role_permissions` table: id, role_id (FK RESTRICT), permission_code, created_at, created_by
  - Indexes: users(email), roles(workspace_id, name), role_permissions(role_id, permission_code)
  - Transactional: Yes (part of baseline init)
  - Idempotent: No (schema creation)
  - Middleware dependency: Tenant resolver required

- [x] T018 [P] [US1] Create Academic Structure layer tables in `apps/api/src/db/tenant/migrations/v1.0.0/baseline-schema.sql`
  - `divisions` table: id, name, code, parent_division_id (FK SET NULL), is_active, created_at, updated_at, created_by, updated_by, is_deleted
  - `departments` table: id, division_id (FK RESTRICT), name, code, is_active, created_at, updated_at, created_by, updated_by, is_deleted
  - `groups` table: id, department_id (FK RESTRICT), name, code, capacity, is_active, created_at, updated_at, created_by, updated_by, is_deleted
  - `hierarchy_nodes`, `teams`, `semesters`, `subjects`, `lessons` tables (similar pattern)
  - Indexes: (division_id), (department_id), (group_id), (semester_id), (subject_id)
  - Transactional: Yes (part of baseline init)
  - Idempotent: No
  - Middleware dependency: None (internal schema)

- [x] T019 [P] [US1] Create Classification layer tables in `apps/api/src/db/tenant/migrations/v1.0.0/baseline-schema.sql`
  - `categories` table: id, name, type, parent_category_id (FK SET NULL), is_active, created_at, updated_at, created_by, updated_by, is_deleted
  - `category_values` table: id, category_id (FK CASCADE), value, display_order, is_active, created_at, updated_at, created_by, updated_by, is_deleted
  - `tags` table: id, name, color_hex, is_active, created_at, updated_at, created_by, updated_by, is_deleted
  - `mcq_baskets` table: id, name, description, question_count, is_active, created_at, updated_at, created_by, updated_by, is_deleted
  - Indexes: (category_id), (tag keyword search), (mcq_baskets name)
  - Transactional: Yes (part of baseline init)
  - Idempotent: No
  - Middleware dependency: None

- [x] T020 [P] [US1] Create Exam Engine layer tables in `apps/api/src/db/tenant/migrations/v1.0.0/baseline-schema.sql`
  - `mcq_questions` table: id, basket_id (FK RESTRICT), question_text, options_json, correct_option, difficulty, tags_json, created_at, updated_at, created_by, updated_by, is_deleted
  - `traditional_questions` table: id, basket_id, question_text, solution_text, difficulty, tags_json, created_at, updated_at, created_by, updated_by, is_deleted
  - `mcq_exams` table: id, name, duration_minutes, question_count, passing_score, created_at, updated_at, created_by, updated_by, is_deleted
  - `traditional_exams` table: id, name, duration_minutes, created_at, updated_at, created_by, updated_by, is_deleted
  - `scheduled_exams` table: id (FK to mcq/traditional exam), scheduled_at, timezone, created_at, updated_at, created_by, updated_by, is_deleted
  - Indexes: (basket_id), (exam_id), (scheduled_at), (difficulty)
  - Transactional: Yes (part of baseline init)
  - Idempotent: No
  - Middleware dependency: None

- [x] T021 [P] [US1] Create Runtime layer tables in `apps/api/src/db/tenant/migrations/v1.0.0/baseline-schema.sql`
  - `attempts` table: id (PK), exam_id (FK RESTRICT), user_id (FK RESTRICT), configuration_snapshot (JSONB), question_list_snapshot (JSONB), grading_config_snapshot (JSONB), status (ENUM), started_at, submitted_at, duration_seconds, submission_deadline_at, server_time_at_submission, created_at, updated_at, created_by, updated_by, is_deleted
  - Constraint: UNIQUE(exam_id, user_id, started_at)
  - Indexes: (exam_id), (user_id), (status), (submission_deadline_at)
  - Transactional: Yes (part of baseline init)
  - Idempotent: No
  - Middleware dependency: None

- [x] T022 [P] [US1] Create Commercial + Communication + Media + Ads + Certificates + System layer tables in `apps/api/src/db/tenant/migrations/v1.0.0/baseline-schema.sql`
  - `subscriptions` table: id, user_id (FK), plan_type, status (ENUM ACTIVE/PAUSED/CANCELLED), started_at, expired_at, created_at, updated_at, created_by, updated_by, is_deleted
  - `invoices` table: id, subscription_id (FK), amount, issued_at, due_at, paid_at, created_at, updated_at, created_by, updated_by, is_deleted
  - `promocodes` table: id, code, discount_percent, valid_until, max_uses, used_count, created_at, updated_at, created_by, updated_by, is_deleted
  - `subscription_events` table: id, subscription_id (FK), event_type, event_data_json, occurred_at, created_at, created_by
  - `notifications` table: id, user_id (FK), message, is_read, created_at, updated_at, created_by, updated_by, is_deleted
  - `feedback` table: id, user_id (FK), feedback_text, rating, created_at, updated_at, created_by, updated_by, is_deleted
  - `system_feedback` table: id, feedback_text, created_at, updated_at, created_by, updated_by, is_deleted
  - `media_files` table: id, file_name, file_size, mime_type, url, created_at, updated_at, created_by, updated_by, is_deleted
  - `ads` table: id, content, is_active, created_at, updated_at, created_by, updated_by, is_deleted
  - `certificates` table: id, user_id (FK), template_id (FK), issued_at, created_at, updated_at, created_by, updated_by, is_deleted
  - `certificate_templates` table: id, name, template_html, created_at, updated_at, created_by, updated_by, is_deleted
  - `translations` table: id, language_code, key, value, created_at, updated_at, created_by, updated_by, is_deleted
  - `audit_logs` table (optional): id, table_name, record_id, action, change_data_json, created_at, created_by
  - All indexes on FK columns and frequently queried fields
  - Transactional: Yes (part of baseline init)
  - Idempotent: No
  - Middleware dependency: None

### Idempotency & Validation

- [x] T023 [US1] Create idempotency key validation in `apps/api/src/modules/schema/schema.service.ts`
  - Check Redis cache: `schema-init:{workspace_id}:{idempotency_key}`
  - If hit (24h TTL) → return cached 202 response (idempotent replay)
  - If miss → check if schema_version table exists (fallback DB check for cache failure)
  - If exists → return success 202 (already initialized)
  - If not exists → proceed with initialization
  - Transactional: No (read-only checks)
  - Idempotent: Yes (deterministic idempotency key)
  - Middleware dependency: Tenant resolver required
  - Version enforcement: No

- [x] T024 [US1] Create checksum calculation in `packages/domain-core/src/migrations/checksum.ts`
  - Function: `calculateSHA256(filePath: string): string`
  - Read migration SQL file from disk
  - Calculate SHA256 hash
  - Return hex-encoded checksum
  - Error handling: File not found, read permission denied
  - Transactional: No (file I/O only)
  - Idempotent: Yes (deterministic per file)
  - Middleware dependency: None
  - Version enforcement: No

### API Endpoint Implementation

- [x] T025 [US1] Create provisioning endpoint `POST /mmm/workspaces/:workspace_id/schema/initialize` in `apps/api/src/modules/schema/schema.controller.ts`
  - Accept idempotency_key in request body (optional)
  - Apply middleware stack: tenant resolver → license → schema version validation
  - Call schema initialization service
  - Return 202 Accepted with task_id on success
  - Return 409 Conflict if already initialized (idempotency)
  - Return 423/403/504 for license/version issues
  - Transactional: No (enqueues worker task)
  - Idempotent: Yes (via idempotency key check)
  - Middleware dependency: All three (resolver, license, schema version)
  - Version enforcement: Yes

- [x] T026 [US1] Create schema initialization service in `apps/api/src/modules/schema/schema.service.ts`
  - Validate idempotency key (or generate UUID)
  - Generate task_id (UUID)
  - Enqueue INIT_TENANT_SCHEMA task in worker queue with:
    - workspace_id
    - task_id
    - idempotency_key
    - schema_version: "1.0.0"
    - schema_file_checksum: (calculated from baseline-schema.sql)
  - Store in Redis: `schema-init:{workspace_id}:{idempotency_key}` → {task_id, status: QUEUED, created_at} (24h TTL)
  - Return {task_id, status: "QUEUED"}
  - Transactional: No (async task enqueue)
  - Idempotent: Yes (checked before enqueue)
  - Middleware dependency: None
  - Version enforcement: No

### Worker Task Implementation

- [x] T027 [US1] Create INIT_TENANT_SCHEMA worker task in `apps/worker/src/tasks/init-tenant-schema.ts`
  - Accept task payload: {workspace_id, task_id, idempotency_key, schema_version, schema_file_checksum}
  - Get tenant database connection from pool (tenant resolver context)
  - Set transaction timeout: `SET LOCAL statement_timeout = 30000` (30s, prevents stuck migrations)
  - BEGIN TRANSACTION (READ COMMITTED isolation)
  - Read baseline-schema.sql file from disk
  - Validate checksum matches payload
  - If mismatch → ABORT, log CRITICAL, send to DLQ with tampering_detected=true, **DO NOT RETRY**
  - Execute schema initialization SQL:
    - Create all 38–40 tables
    - Create all indexes
    - Create all triggers
  - INSERT INTO schema_version (version='1.0.0', applied_at=now(), checksum=CALCULATED)
  - COMMIT
  - Update Redis: `schema-init:{workspace_id}:{idempotency_key}` → {status: COMPLETED, completed_at}
  - Transactional: Yes (all-or-nothing schema creation)
  - Idempotent: Yes (schema_version unique constraint prevents re-init)
  - Middleware dependency: None (runs in worker context)
  - Version enforcement: No (baseline v1.0.0)
  - On success: Log CRITICAL "Tenant schema initialized: workspace={workspace_id}, version=1.0.0"
  - On failure: Retry with exponential backoff (3 retries); after 3 failures → DLQ

---

## Phase 4: User Story 2 – Audit Trail Immutability (P1)

### Immutable Tables & Triggers

- [x] T028 [US2] Create `attempt_events` table in `apps/api/src/db/tenant/migrations/v1.0.0/baseline-schema.sql`
  - id (UUID PK), attempt_id (FK CASCADE), event_type (ENUM: START, RESUME, PAUSE, ANSWER_SUBMIT, TIME_WARNING, SUBMIT_REQUEST, FINALIZED, GRADED, ARCHIVED), event_payload (JSONB), occurred_at (TIMESTAMPTZ), created_at, created_by
  - NO updated_at, NO updated_by (immutable table indicator)
  - Index: (attempt_id), (event_type), (occurred_at)
  - Transactional: Yes (part of baseline init)
  - Idempotent: No
  - Middleware dependency: None
  - Version enforcement: No

- [x] T029 [US2] Apply immutability trigger to `attempt_events` table in `apps/api/src/db/tenant/migrations/v1.0.0/triggers.sql`
  - Trigger: `enforce_attempt_events_immutable`
  - BEFORE UPDATE on attempt_events
  - EXECUTE FUNCTION raise_immutable_violation()
  - Raises EXCEPTION if UPDATE attempted
  - Transactional: Yes (trigger context)
  - Idempotent: N/A
  - Middleware dependency: None
  - Version enforcement: No

### Audit Logging Service

- [x] T030 [US2] Create attempt event logger in `packages/domain-core/src/audit/attempt-event-logger.ts`
  - Function: `logAttemptEvent(attemptId: UUID, eventType: string, payload?: object): Promise<void>`
  - INSERT into attempt_events table
  - Validates event_type is in allowed ENUM
  - Sets occurred_at = NOW() (server-authoritative time)
  - Sets created_at = NOW()
  - Sets created_by = current_user_id (from request context)
  - Errors: If table locked, retry with exponential backoff
  - Transactional: No (single INSERT)
  - Idempotent: No (each event is unique)
  - Middleware dependency: None
  - Version enforcement: No

### Integration Tests for Immutability

- [x] T031 [US2] Add unit test for immutability trigger in `apps/api/tests/db/triggers/immutable-trigger.test.ts`
  - Test: INSERT into attempt_events succeeds
  - Test: UPDATE on attempt_events raises constraint exception
  - Test: DELETE on attempt_events is allowed (soft delete via is_deleted)
  - Transactional: Yes (test transactions)
  - Idempotent: Yes (test isolation)
  - Middleware dependency: None
  - Version enforcement: No

- [x] T032 [US2] Add integration test for audit trail in `apps/api/tests/integration/audit-trail.integration.test.ts`
  - Test: Start attempt → attempt_events START event created
  - Test: Submit answer → attempt_events ANSWER_SUBMIT event created
  - Test: Submit attempt → attempt_events SUBMIT_REQUEST event created
  - Test: Finalize attempt → attempt_events FINALIZED event created
  - Test: Verify immutable events cannot be modified
  - Test: Query attempt_events history → verify event order
  - Transactional: Yes (test transactions)
  - Idempotent: Yes
  - Middleware dependency: None
  - Version enforcement: No

---

## Phase 5: User Story 3 – Attempt Snapshot Immutability (P1)

### Snapshot Table Setup

- [x] T033 [US3] Create `attempts` table with snapshot columns in `apps/api/src/db/tenant/migrations/v1.0.0/baseline-schema.sql`
  - id (UUID PK), exam_id (FK RESTRICT), user_id (FK RESTRICT)
  - configuration_snapshot (JSONB NOT NULL): Exam configuration frozen at attempt start
  - question_list_snapshot (JSONB NOT NULL): Question order frozen at attempt start
  - grading_config_snapshot (JSONB NOT NULL): Grading rules frozen at attempt start
  - status (ENUM: IN_PROGRESS, SUBMITTED, GRADED, ARCHIVED)
  - started_at, submitted_at, duration_seconds, submission_deadline_at, server_time_at_submission
  - created_at, updated_at, created_by, updated_by, is_deleted
  - Constraint: UNIQUE(exam_id, user_id, started_at)
  - Index: (exam_id), (user_id), (status), (submission_deadline_at)
  - Transactional: Yes (part of baseline init)
  - Idempotent: No
  - Middleware dependency: None
  - Version enforcement: No

- [x] T034 [US3] Create `attempt_answers` table (append-only) in `apps/api/src/db/tenant/migrations/v1.0.0/baseline-schema.sql`
  - id (UUID PK), attempt_id (FK CASCADE), question_id (UUID, denormalized), submitted_answer (JSONB)
  - submitted_at, submission_order
  - created_at, updated_at, created_by, updated_by, is_deleted
  - Constraint: UNIQUE(attempt_id, question_id)
  - Index: (attempt_id), (question_id)
  - Transactional: Yes (part of baseline init)
  - Idempotent: No
  - Middleware dependency: None
  - Version enforcement: No

### Snapshot Capture Service

- [x] T035 [US3] Create snapshot capture service in `packages/domain-core/src/attempts/snapshot-service.ts`
  - Function: `captureExamSnapshot(examId: UUID): Promise<{config, questions, grading}>`
  - Query exam_engine tables for:
    - Exam configuration (from mcq_exams or traditional_exams)
    - Question list with order (from mcq_questions or traditional_questions with current ordering)
    - Grading configuration (from exam settings or defaults)
  - Return JSONB-serializable objects
  - Transactional: No (read-only)
  - Idempotent: Yes (deterministic per exam at time of snapshot)
  - Middleware dependency: None
  - Version enforcement: No

- [x] T036 [US3] Create attempt initialization service in `packages/domain-core/src/attempts/attempt-init.ts`
  - Function: `initializeAttempt(examId: UUID, userId: UUID): Promise<Attempt>`
  - Capture exam snapshot (configuration, questions, grading)
  - Generate started_at = NOW() (server-authoritative time)
  - Calculate submission_deadline_at = started_at + exam.duration_minutes
  - INSERT into attempts table:
    - exam_id, user_id, configuration_snapshot, question_list_snapshot, grading_config_snapshot
    - status='IN_PROGRESS', started_at, submission_deadline_at
    - created_by=current_user_id
  - Return attempts record
  - Handle duplicate attempt (per UNIQUE constraint)
  - Transactional: Yes (atomic attempt creation with snapshots)
  - Idempotent: No (each new attempt is unique)
  - Middleware dependency: None
  - Version enforcement: No

### Snapshot Validation Tests

- [x] T037 [US3] Add unit test for snapshot capture in `apps/api/tests/domain/snapshot-service.test.ts`
  - Test: Capture snapshot from exam → returns config + questions + grading as JSONB
  - Test: Snapshot is consistent across calls (deterministic)
  - Test: Snapshot includes all required fields
  - Transactional: Yes (test transactions)
  - Idempotent: Yes
  - Middleware dependency: None
  - Version enforcement: No

- [x] T038 [US3] Add integration test for snapshot immutability in `apps/api/tests/integration/snapshot-immutability.integration.test.ts`
  - Setup: Create exam + question + create attempt
  - Modify exam question (add new option) in live exam
  - Query attempt → verify question_list_snapshot has OLD question (not new)
  - Verify grading_config_snapshot is unchanged
  - Transactional: Yes
  - Idempotent: Yes
  - Middleware dependency: None
  - Version enforcement: No

- [x] T039 [US3] Add integration test for concurrent attempt snapshots in `apps/api/tests/integration/concurrent-snapshots.integration.test.ts`
  - Setup: Create exam
  - Concurrently (100 users): Initialize attempts on same exam
  - Verify: All 100 attempts have identical snapshots
  - Verify: No race conditions in snapshot capture
  - Transactional: Yes
  - Idempotent: Yes
  - Middleware dependency: None
  - Version enforcement: No

---

## Phase 6: User Story 4 – Referential Integrity (P2)

### Foreign Key Constraints & ON DELETE Policies

All following tasks create FK constraints with explicit ON DELETE policies in `apps/api/src/db/tenant/migrations/v1.0.0/baseline-schema.sql`:

- [x] T040 [P] [US4] Create FK constraints: roles → role_permissions (ON DELETE CASCADE), departments → divisions (ON DELETE RESTRICT), groups → departments (ON DELETE RESTRICT), hierarchy_nodes → divisions (ON DELETE CASCADE)
  - All in baseline schema SQL
  - Transactional: Yes
  - Idempotent: No
  - Middleware dependency: None
  - Version enforcement: No

- [x] T041 [P] [US4] Create FK constraints: lessons → subjects (ON DELETE RESTRICT), semesters → divisions (ON DELETE RESTRICT), subjects → semesters (ON DELETE RESTRICT), teams → departments (ON DELETE RESTRICT)
  - All in baseline schema SQL
  - Transactional: Yes
  - Idempotent: No
  - Middleware dependency: None
  - Version enforcement: No

- [x] T042 [P] [US4] Create FK constraints: categories on parent_category_id (ON DELETE SET NULL), category_values → categories (ON DELETE CASCADE), tags (self-referential if needed)
  - All in baseline schema SQL
  - Transactional: Yes
  - Idempotent: No
  - Middleware dependency: None
  - Version enforcement: No

- [x] T043 [P] [US4] Create FK constraints: mcq_exams → mcq_baskets (ON DELETE RESTRICT), traditional_exams (no basket FK), scheduled_exams → mcq/traditional_exams (polymorphic, ON DELETE RESTRICT)
  - All in baseline schema SQL
  - Transactional: Yes
  - Idempotent: No
  - Middleware dependency: None
  - Version enforcement: No

- [x] T044 [P] [US4] Create FK constraints: attempts → scheduled_exams (ON DELETE RESTRICT), attempts → users (ON DELETE RESTRICT), attempt_answers → attempts (ON DELETE CASCADE), attempt_events → attempts (ON DELETE CASCADE)
  - All in baseline schema SQL
  - Transactional: Yes
  - Idempotent: No
  - Middleware dependency: None
  - Version enforcement: No

- [x] T045 [P] [US4] Create FK constraints: subscriptions → users (ON DELETE RESTRICT), invoices → subscriptions (ON DELETE CASCADE), promocodes (no parent), subscription_events → subscriptions (ON DELETE CASCADE)
  - All in baseline schema SQL
  - Transactional: Yes
  - Idempotent: No
  - Middleware dependency: None
  - Version enforcement: No

- [x] T046 [P] [US4] Create FK constraints: notifications → users (ON DELETE CASCADE), feedback → users (ON DELETE CASCADE), certificates → users (ON DELETE CASCADE), certificates → certificate_templates (ON DELETE RESTRICT)
  - All in baseline schema SQL
  - Transactional: Yes
  - Idempotent: No
  - Middleware dependency: None
  - Version enforcement: No

### FK Constraint Validation Tests

- [x] T047 [US4] Add unit test for FK cascade delete in `apps/api/tests/db/constraints/fk-cascade.test.ts`
  - Test: Delete parent (subscription) → child records (invoices, subscription_events) deleted
  - Test: Delete parent (attempt) → child records (attempt_answers, attempt_events) deleted
  - Test: Delete parent (exam) → child records (scheduled_exams, attempts) NOT deleted (RESTRICT)
  - Transactional: Yes
  - Idempotent: Yes
  - Middleware dependency: None
  - Version enforcement: No

- [x] T048 [US4] Add unit test for FK restrict policy in `apps/api/tests/db/constraints/fk-restrict.test.ts`
  - Test: Attempt to delete exam with active attempts → constraint violation
  - Test: Attempt to delete division with departments → constraint violation
  - Test: Verify orphaned records prevented
  - Transactional: Yes
  - Idempotent: Yes
  - Middleware dependency: None
  - Version enforcement: No

- [x] T049 [US4] Add integration test for referential integrity during user operations in `apps/api/tests/integration/referential-integrity.integration.test.ts`
  - Test: Create exam + question + attempt → all relationships valid
  - Test: Delete question → attempt_answers reference orphaned question_id (acceptable)
  - Test: Archive exam → no new attempts possible
  - Transactional: Yes
  - Idempotent: Yes
  - Middleware dependency: None
  - Version enforcement: No

- [x] T050 [US4] Add concurrency test for FK constraints in `apps/api/tests/integration/fk-concurrency.integration.test.ts`
  - Test: 50 concurrent attempt submissions on same exam → all FK validated
  - Test: Concurrent deletion of parent + insert of child → constraint prevents race condition
  - Test: No lost deletes or deadlocks
  - Transactional: Yes
  - Idempotent: Yes
  - Middleware dependency: None
  - Version enforcement: No

---

## Phase 7: User Story 5 – Schema Versioning (P2)

### Version Bumping & Migration Management

- [x] T051 [US5] Create version bumping utilities in `packages/domain-core/src/migrations/version-bump.ts`
  - Function: `bumpVersion(currentVersion: string, changeType: 'major'|'minor'|'patch'): string`
  - Parse semantic version (follow ADR-0008)
  - Increment according to change type (major: 2.0.0, minor: 1.1.0, patch: 1.0.1)
  - Validate backward compatibility based on change type
  - Return new version string
  - Transactional: No
  - Idempotent: Yes (deterministic per input)
  - Middleware dependency: None
  - Version enforcement: No

- [x] T052 [US5] Create migration file generator in `packages/domain-core/src/migrations/migration-generator.ts`
  - Function: `generateMigrationFile(version: string, changeType: string, sqlStatements: string[]): {filePath, checksum}`
  - Create directory: `apps/api/src/db/tenant/migrations/v{version}/`
  - Create file: `apps/api/src/db/tenant/migrations/v{version}/migration.sql`
  - Combine all SQL statements with transaction wrapper (BEGIN TRANSACTION... COMMIT)
  - Calculate SHA256 checksum of final migration file
  - Return file path and checksum
  - Transactional: No (file I/O)
  - Idempotent: No (generates new files)
  - Middleware dependency: None
  - Version enforcement: No

- [x] T053 [US5] Create migration validation service in `packages/domain-core/src/migrations/migration-validator.ts`
  - Function: `validateMigration(fromVersion: string, toVersion: string): {valid: boolean, errors: string[]}`
  - Check version ordering (to > from)
  - Check backward compatibility (patch/minor OK, major → rollback only)
  - Check schema_version table ready for update
  - Return validation result
  - Transactional: No (read-only validation)
  - Idempotent: Yes
  - Middleware dependency: None
  - Version enforcement: No

### Migration Execution (Async Worker)

- [x] T054 [US5] Create APPLY_MIGRATION worker task in `apps/worker/src/tasks/apply-migration.ts`
  - Accept task payload: {workspace_id, from_version, to_version, migration_file_checksum}
  - Get tenant DB connection (resolver context)
  - Set connection timeout: `SET LOCAL lock_timeout = '5s'` (prevents stuck locks)
  - Set statement timeout: `SET LOCAL statement_timeout = 30000` (30s, prevents hung migrations)
  - BEGIN TRANSACTION (READ COMMITTED)
  - LOCK schema_version (exclusive lock, wait up to 5s)
  - SELECT current version from schema_version
  - Validate version ordering (current < to_version)
  - Read migration file from disk: `apps/api/src/db/tenant/migrations/v{to_version}/migration.sql`
  - Calculate SHA256 checksum
  - Validate checksum matches payload:
    - If mismatch → ABORT IMMEDIATELY, log CRITICAL "Migration checksum mismatch", send to DLQ with tampering_detected=true, **ENFORCE: DO NOT RETRY**
  - Execute migration SQL
  - Validate schema integrity (new tables/columns present)
  - UPDATE schema_version SET version={to_version}, applied_at=NOW(), checksum={recalculated}
  - COMMIT
  - Update Redis migration status (if tracking)
  - Transactional: Yes (all-or-nothing migration)
  - Idempotent: Yes (UNIQUE constraint on schema_version(version))
  - Middleware dependency: None
  - Version enforcement: Yes (validates versions)
  - On success: Log CRITICAL "Migration applied: workspace={workspace_id}, version={from}→{to}"
  - On failure (non-checksum): Retry with exponential backoff (2s, 4s, 8s, max 3 retries ~5min); after 3 failures → DLQ

- [x] T055 [US5] Create migration enqueue utility in `apps/api/src/modules/schema/migration-enqueue.ts`
  - Function: `enqueueMigration(workspace_id: UUID, from_version: string, to_version: string, filePath: string): Promise<string>`
  - Read migration file
  - Calculate SHA256 checksum
  - Enqueue APPLY_MIGRATION task with:
    - workspace_id, from_version, to_version, migration_file_checksum
  - Store migration metadata in Redis (for tracking)
  - Return task_id
  - Transactional: No (async enqueue)
  - Idempotent: No (each migration is separate)
  - Middleware dependency: None
  - Version enforcement: No

### Version Mismatch Handling

- [x] T056 [US5] Update schema version validation middleware to enqueue migrations in `apps/api/src/middleware/schema-version.ts`
  - If actual_schema_version < expected_schema_version:
    - Check if migration already queued (Redis: `migration-in-progress:{workspace_id}`)
    - If queued → return 503 "Migration in progress"
    - If not queued:
      - Call enqueueMigration(workspace_id, actual, expected, migration_file_path)
      - Store in Redis: `migration-in-progress:{workspace_id}` → task_id (24h TTL)
      - Return 503 "Migration in progress"
  - Transactional: No (read-only + enqueue)
  - Idempotent: Yes (checked if already queued)
  - Middleware dependency: Requires license middleware
  - Version enforcement: Yes

### Migration Failure Handling & DLQ

- [x] T057 [US5] Create DLQ handler for migration failures in `apps/worker/src/dlq/migration-dlq-handler.ts`
  - Process failed migration from DLQ
  - Check tampering_detected flag:
    - If true → log CRITICAL alert, do NOT retry (hardening: enforce flag check), escalate to security team
    - If false → log ERROR, create ticket for manual investigation
  - Extract workspace_id, version info
  - Update workspace status: mark as migration_failed (new flag)
  - Send alert notification
  - Transactional: No (logging + alerts)
  - Idempotent: Yes (DLQ processing)
  - Middleware dependency: None
  - Version enforcement: No

### Version Mismatch Tests

- [x] T058 [US5] Add unit test for version bumping in `apps/api/tests/domain/version-bump.test.ts`
  - Test: Bump patch: 1.0.0 → 1.0.1
  - Test: Bump minor: 1.0.0 → 1.1.0
  - Test: Bump major: 1.0.0 → 2.0.0
  - Test: Invalid version format → error
  - Transactional: Yes
  - Idempotent: Yes
  - Middleware dependency: None
  - Version enforcement: No

- [x] T059 [US5] Add integration test for schema version mismatch in `apps/api/tests/integration/schema-version-mismatch.integration.test.ts`
  - Setup: Create workspace with schema v1.0.0
  - Simulate product upgrade (license.product_version = 1.1.0)
  - Make request to workspace → 503 "Migration in progress"
  - Verify APPLY_MIGRATION task enqueued
  - Execute worker task → migration applied
  - Verify schema_version updated to 1.1.0
  - Make request to workspace → 200 OK (migration complete)
  - Transactional: Yes
  - Idempotent: Yes
  - Middleware dependency: None
  - Version enforcement: Yes

---

## Phase 8: API Layer (Middleware & Routing)

### Middleware Stack Integration

- [x] T060 Create global middleware chain in `apps/api/src/app.ts` or `apps/api/src/middleware/index.ts`
  - Register tenant resolver middleware (first)
  - Register license validation middleware (second)
  - Register schema version validation middleware (third)
  - Register request ID / correlation ID middleware
  - Register error handling middleware
  - Order MUST be preserved (tenant → license → schema version → other)
  - Transactional: No (configuration)
  - Idempotent: N/A
  - Middleware dependency: All three must be enabled

- [x] T061 Create error handling middleware in `apps/api/src/middleware/error-handler.ts`
  - Catch all errors from downstream handlers
  - Convert to standard error contract: {success: false, data: null, error: {code, message}}
  - Map database errors to error codes (FK violation → 409, unique constraint → 409, timeout → 503)
  - Log structured error with correlation_id, workspace_id, user_id
  - Return appropriate HTTP status code
  - Transactional: No
  - Idempotent: N/A

- [x] T062 Create request ID middleware in `apps/api/src/middleware/correlation-id.ts`
  - Generate unique correlation_id (UUID v7) per request
  - Inject into request context
  - Include in all logs and responses (x-correlation-id header)
  - Transactional: No
  - Idempotent: N/A

### API Route Definition

- [x] T063 Create schema initialization controller in `apps/api/src/modules/schema/schema.controller.ts`
  - Route: POST /mmm/workspaces/:workspace_id/schema/initialize
  - Middleware: tenant resolver, license, schema version validation
  - Request body: { idempotency_key?: string, notify_on_complete?: string }
  - Response 202 Accepted: { task_id, status: "QUEUED", created_at }
  - Response 409 Conflict: Schema already initialized
  - Response 423: License locked
  - Response 403: License archived
  - Response 503: Migration in progress

---

## Phase 9: Worker Layer (Task Processing)

### Worker Task Handlers

- [x] T064 Register INIT_TENANT_SCHEMA handler in `apps/worker/src/tasks/registry.ts`
  - Import handler from `./init-tenant-schema.ts`
  - Register queue: `schema-initialization`
  - Register retry policy: exponential backoff (3 retries)
  - Register timeout: 30s
  - Register DLQ: yes

- [x] T065 Register APPLY_MIGRATION handler in `apps/worker/src/tasks/registry.ts`
  - Import handler from `./apply-migration.ts`
  - Register queue: `schema-migration`
  - Register retry policy: exponential backoff (3 retries)
  - Register timeout: 30s
  - Register DLQ: yes

### Worker Main Loop

- [x] T066 Create worker main loop in `apps/worker/src/index.ts` or `apps/worker/src/worker.ts`
  - Initialize database connection pools (per tenant)
  - Start consuming from queues: schema-initialization, schema-migration
  - Invoke handlers based on task type
  - Handle success/failure per task
  - Send to DLQ on max retries
  - Transactional: N/A (worker orchestration)
  - Idempotent: N/A

---

## Phase 10: Observability & Logging

### Structured Logging

- [x] T067 Create structured logging utilities in `packages/domain-core/src/logging/structured-log.ts`
  - Function: `logDatabaseOperation(op: {table, action, workspace_id, user_id, correlation_id, duration_ms, rows_affected, status}): void`
  - Format: JSON with required fields (timestamp, level, service, correlation_id, workspace_slug, workspace_id, user_id, operation, table, rows_affected, duration_ms, status)
  - Log to stdout (for Docker JSON log driver)
  - Include function name + line number for debugging
  - Transactional: No (logging only)
  - Idempotent: N/A

- [x] T068 Add structured logging to all critical operations:
  - [P] Log in tenant resolver middleware (success + failures)
  - [P] Log in license validation middleware (status check + result)
  - [P] Log in schema version middleware (version mismatch + migration enqueue)
  - [P] Log in INIT_TENANT_SCHEMA worker (start + checksum validation + success/failure)
  - [P] Log in APPLY_MIGRATION worker (start + checksum validation + commit + success/failure)
  - All with structured format
  - Transactional: No
  - Idempotent: N/A

### Metrics & Monitoring

- [x] T069 Create metrics collection in `packages/domain-core/src/metrics/metrics.ts`
  - Counter: schema_initialization_total, schema_initialization_failures, migration_total, migration_failures
  - Gauge: migration_in_progress per workspace
  - Histogram: schema_initialization_duration_ms, migration_duration_ms
  - Transactional: No
  - Idempotent: Yes

- [x] T070 Emit metrics from critical operations:
  - [P] Emit in INIT_TENANT_SCHEMA (start, success, failure)
  - [P] Emit in APPLY_MIGRATION (start, success, failure, duration)
  - [P] Emit in schema version middleware (version_mismatch_count)
  - Transactional: No
  - Idempotent: N/A

---

## Phase 11: Comprehensive Testing

### Unit Tests (Already Partially Covered)

- [x] T071 Add unit test for tenant resolver middleware in `apps/api/tests/middleware/tenant-resolver.test.ts`
  - Test: Valid slug → workspace_id resolved
  - Test: Invalid slug → 404
  - Test: User not member → 401/403
  - Test: Connection pool created and cached
  - Test: Error handling (DB unavailable)

- [x] T072 Add unit test for license middleware in `apps/api/tests/middleware/license.test.ts`
  - Test: ACTIVE license → proceed
  - Test: SOFT_LOCKED → 423
  - Test: ARCHIVED → 403
  - Test: License not found → 404

- [x] T073 Add unit test for schema version middleware in `apps/api/tests/middleware/schema-version.test.ts`
  - Test: Versions match → proceed
  - Test: Actual > expected → 409
  - Test: Actual < expected + no migration queued → enqueue + 503
  - Test: Actual < expected + migration in progress → 503

### Integration Tests

- [x] T074 Add end-to-end provisioning test in `apps/api/tests/integration/e2e-provisioning.integration.test.ts`
  - Setup: Create workspace in MMC
  - Call POST /mmm/workspaces/{id}/schema/initialize
  - Verify: 202 Accepted response with task_id
  - Wait for worker task completion
  - Verify: All 38–40 tables exist in tenant DB
  - Verify: schema_version set to 1.0.0
  - Call again (idempotent) → 409 Conflict or cached 202

- [x] T075 Add end-to-end migration test in `apps/api/tests/integration/e2e-migration.integration.test.ts`
  - Setup: Tenant with schema v1.0.0
  - Simulate migration: v1.0.0 → v1.1.0 (add new column)
  - Update license.product_version_compatibility to v1.1.0
  - Make request → 503 "Migration in progress"
  - Wait for migration completion
  - Verify: schema_version now v1.1.0
  - Verify: New column exists with default value

### Isolation & Concurrency Tests

- [x] T076 Add cross-tenant isolation test in `apps/api/tests/integration/cross-tenant-isolation.integration.test.ts`
  - Setup 2 workspaces: A and B
  - User from A attempts query on B → 403 Unauthorized
  - Both workspaces have independent schemas
  - Modifications in A do not affect B

- [x] T077 Add concurrency test for schema initialization in `apps/api/tests/integration/concurrent-initialization.integration.test.ts`
  - Setup: 10 workspaces
  - Call schema/initialize concurrently on all 10
  - Verify: All 10 complete successfully
  - Verify: Each has independent schema

- [x] T078 Add concurrency test for attempt submission in `apps/api/tests/integration/concurrent-attempt-submission.integration.test.ts`
  - Setup: Exam + 100 users
  - Concurrently: 100 users submit attempt answers
  - Verify: All submissions succeed
  - Verify: No lost updates, no race conditions
  - Verify: Idempotency key prevents duplicates

---

## Phase 12: Polish & Cross-Cutting Concerns

### Documentation

- [x] T079 Create database schema documentation in `docs/SCHEMA.md`
  - Overview of all 38–40 tables (by layer)
  - Entity-relationship diagram (text format)
  - FK policies (ON DELETE rules)
  - Index strategy
  - Tenant isolation guarantees

- [x] T080 Create migration runbook in `docs/MIGRATIONS.md`
  - How to create a new migration
  - Version bumping rules (ADR-0008)
  - Testing migration locally
  - Rollback procedure (snapshot restore)
  - Monitoring migration progress

- [x] T081 Create operational guide in `docs/OPERATIONS.md`
  - Connecting to tenant database (safe queries only)
  - Schema version querying
  - DLQ investigation (tampering detection)
  - Workspace reset procedure (dangerous, doc only)
  - Performance tuning hints

### Backup & Recovery

- [x] T082 Document backup strategy in `docs/BACKUP_RECOVERY.md`
  - Backup pre-initialization (master DB)
  - Backup per-tenant (database.sql dump)
  - Snapshot strategy per ADR-0002
  - Recovery: restore from snapshot or rebuild
  - RTO/RPO targets

### Monitoring & Alerting

- [x] T083 Create monitoring dashboard configuration in `docs/MONITORING.md`
  - Metrics to track: schema_initialization_duration, migration_duration, failed_migrations, tampering_detected
  - Alerts: Migration failure (page on-call), Tampering detected (CRITICAL), Version mismatch lasting > 5min

### Final Validation

- [x] T084 Checklist: All constitutional requirements met
  - ✅ Database-per-tenant (no shared tables)
  - ✅ Tenant resolver mandatory
  - ✅ License middleware mandatory
  - ✅ Schema version validation mandatory
  - ✅ Transactions atomic (all-or-nothing)
  - ✅ Idempotency hybrid (Redis + DB)
  - ✅ Server-authoritative time (NOW())
  - ✅ Audit fields (id, created_at, updated_at, created_by, updated_by, is_deleted)
  - ✅ No cross-tenant access
  - ✅ No direct DB instantiation

- [x] T085 Final code review & lint check
  - Run eslint on all new files
  - Run tsc type check on all new files
  - Run prettier formatting
  - Verify no secrets in code

---

## Dependencies & Execution Strategy

### Task Dependency Graph

```
Setup & Infrastructure (T001–T008)
    ↓
Foundational Infrastructure (T009–T016)
    ├→ Schema Initialization (T017–T027) [Parallel to other stories]
    │   └→ API Endpoint (T025–T026)
    │   └→ Worker Task (T027)
    │
    ├→ Audit Trail (T028–T032) [Parallel, depends on T009]
    │
    ├→ Attempt Snapshots (T033–T039) [Parallel, depends on T009]
    │
    ├→ Referential Integrity (T040–T050) [Parallel, depends on T009]
    │
    └→ Schema Versioning (T051–T059) [Parallel, depends on T009]
        └→ API Middleware Update (T056)
        └→ Worker DLQ (T057)

API Layer Integration (T060–T063) [Depends on T017–T027]

Worker Layer (T064–T066) [Depends on T027, T054]

Observability (T067–T070) [Can run in parallel]

Testing (T071–T078) [Final, depends on all implementation]

Documentation & Validation (T079–T085) [Final]
```

### Parallelization Examples

**Parallel Execution Opportunity 1** (Database Layer): Simultaneously create:

- T017 (Identity tables) + T018 (Academic) + T019 (Classification) + T020 (Exam Engine)
- All populate the same baseline-schema.sql file (can merge in final step)

**Parallel Execution Opportunity 2** (User Stories): All 5 user stories (T049–T059) can technically run in parallel once foundational middleware ready (T009-T016), but data model dependencies suggest:

- US1 + US2 (provisioning + audit) prerequisite for US3 (snapshots)
- US4 (referential integrity) independent, can start alongside US3
- US5 (versioning) must start after US1 complete (needs baseline schema)

**Parallel Execution Opportunity 3** (Testing): Once implementation complete:

- Unit tests (T071–T073) can run in parallel
- Integration tests (T074–T075) can run serially after unit tests pass
- Isolation tests (T076–T078) can run after integration tests

**Recommended MVP Execution Path**:

1. Phase 1 (T001–T008): Sequential setup, ~30 min
2. Phase 2 (T009–T016): Can parallelize trigger functions + middleware, ~1 hour
3. Phase 3 (T017–T027): Tables + API + Worker, ~2 hours
4. Phase 7 (T051–T059): Schema versioning (depends on Phase 3), ~1.5 hours
5. Phase 8–9 (T060–T066): Middleware integration + worker main loop, ~1 hour
6. Phase 10 (T067–T070): Observability, ~1 hour
7. Phase 11 (T071–T078): Testing, ~2 hours
8. Phase 12 (T079–T085): Documentation, ~1 hour

**Total Estimated MVP Time**: ~10 hours serial, ~6 hours with parallelization

---

## Success Criteria Validation

| SC #   | Criterion                                                          | Task Coverage                     |
| ------ | ------------------------------------------------------------------ | --------------------------------- |
| SC-001 | Tenant schema initialization completes atomically                  | T017–T027 (INIT_TENANT_SCHEMA)    |
| SC-002 | All 38–40 tables created with correct structure                    | T017–T022, T074 (end-to-end test) |
| SC-003 | Audit trail immutable (no updates to attempt_events)               | T029–T032                         |
| SC-004 | Attempt snapshots frozen (question changes don't affect snapshots) | T035–T039                         |
| SC-005 | Referential integrity enforced (FK constraints prevent orphans)    | T040–T050                         |
| SC-006 | Schema versioning working (migrations applied, version bumped)     | T051–T059                         |
| SC-007 | Idempotency working (repeated calls return same response)          | T023, T074                        |
| SC-008 | Server-authoritative time (all timestamps from NOW())              | T035, T036                        |
| SC-009 | Tenant isolation enforced (cross-tenant queries fail)              | T076                              |
| SC-010 | Concurrency safe (100+ concurrent operations succeed)              | T039, T077, T078                  |
| SC-011 | Middleware stack executes in order                                 | T060, T061, T062                  |
| SC-012 | Error codes standardized (contracts respected)                     | T063, T071–T073                   |

---

## Constitutional Compliance Statement

This task list adheres to **Zidney Constitution v1.2.0**:

- ✅ **ADR-0001** (Database-per-Tenant): All tasks preserve isolated tenant databases
- ✅ **ADR-0002** (Snapshot Attempt Model): Tasks T033–T039 ensure snapshot immutability
- ✅ **ADR-0006** (Server-Authoritative Time): All timestamps use PostgreSQL `now()`
- ✅ **ADR-0007** (Product Version Compatibility): Tasks T051–T059 enforce schema versioning
- ✅ **ADR-0008** (Semantic Versioning): Migration versioning follows semver (patch, minor, major)
- ✅ **Multi-Tenancy Rules**: No row-based isolation, no shared tables, no cross-tenant access
- ✅ **License Enforcement**: Middleware mandatory on all routes (T015)
- ✅ **Transaction Boundaries**: All-or-nothing semantics (T027, T054)
- ✅ **Idempotency**: Hybrid Redis + DB fallback (T023, T054)
- ✅ **Audit Fields**: All tables have id, created_at, updated_at, created_by, updated_by, is_deleted (T017–T022)
- ✅ **Structured Logging**: Correlation IDs and JSON format (T067–T068)

**No violations detected. Tasks are ready for implementation.**

---

## Quick Reference: Task Categorization

### By Layer

**Infrastructure** (T001–T008, T060–T070): Database setup, logging, metrics  
**Database Schema** (T009–T050): Tables, constraints, triggers  
**API** (T025–T026, T063): Provisioning endpoint  
**Worker** (T027, T054–T057, T064–T066): Task processing  
**Testing** (T031–T032, T047–T078): All test types  
**Documentation** (T079–T085): Runbooks and guides

### By Transactionality

**Transactional** (T017–T027, T054, T074–T075): Schema-altering, atomic operations  
**Non-Transactional** (T001–T008, T060–T063, T067–T070): Config, logging, middleware

### By Idempotency

**Idempotent** (T023–T024, T039, T054–T057): Safe to retry  
**Non-Idempotent** (T017–T022, T027): Must run once

### By Middleware Dependency

**None** (T001–T008, T009–T013, T024, T031–T039, T071–T073): Internal tasks  
**Tenant Resolver Only** (T025, T027): Workspace isolation required  
**Resolver + License** (T026, T063): Full auth stack  
**Resolver + License + Schema Version** (T063 variant, schema-init endpoint): Full middleware

---

## Continuation After Task Completion

Once all tasks completed:

1. **Commit & Push**: `git add . && git commit -m "STAGE_02B: Tenant baseline schema implementation"` → Create PR
2. **Code Review**: Verify constitutional compliance, test coverage, documentation
3. **Merge**: To `develop` branch
4. **Deployment**: Trigger CI/CD pipeline for staging environment
5. **Next Stage**: STAGE_02C_MIGRATION_AND_VERSIONING_MODEL (depends on this baseline schema)

For any task clarifications or blockers, refer back to:

- [spec.md](./spec.md) – Feature requirements
- [plan.md](./plan.md) – Implementation design
- [data-model.md](./data-model.md) – Entity definitions
- Zidney Constitution (root AGENTS.md)
