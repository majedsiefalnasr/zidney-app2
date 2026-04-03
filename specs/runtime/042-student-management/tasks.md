# Tasks: Student Management (STAGE_42)

**Stage**: STAGE_42_STUDENT_MANAGEMENT  
**Phase**: 03_BACKOFFICE_CORE / 05_USER_MANAGEMENT  
**Total Tasks**: 55  
**Plan Reference**: [plan.md](plan.md)

---

## Phase A — Database Layer

- [x] T001 [US1] Create migration file `apps/api/src/db/tenant/migrations/20260406_022_student_management.ts` — add 7 columns (phone, password_hash, subscription_status, status, token_version, failed_login_count, locked_until) with safe NOT NULL defaults; add 2 CHECK constraints (chk_students_status, chk_students_subscription_status); add 2 partial indexes (idx_students_status, idx_students_subscription_status); bump workspace_schema_versions to 1.28.0; include informational down() function

- [x] T002 [US1] Update Drizzle schema `apps/api/src/db/tenant/schemas/students.schema.ts` — add imports for `integer`, `text`, `check`, `sql` from drizzle-orm; add 7 new columns (phone, password_hash, subscription_status, status, token_version, failed_login_count, locked_until) in the pgTable definition after semester_id; add statusIdx, subscriptionStatusIdx, emailIdx indexes and validStatus, validSubscriptionStatus CHECK constraints to the table config

---

## Phase B — Domain-Core Module

- [x] T003 [US2] Create `packages/domain-core/src/students/students.types.ts` — define StudentStatus, SubscriptionStatus union types; DbClient interface; StudentRow (with password_hash, failed_login_count, locked_until); StudentRecord (without password_hash); CreateStudentInput; UpdateStudentInput; UpdateSubscriptionInput; StudentListQuery; StudentListResult; AuditContext (fields: user_id, workspace_id, workspace_slug, correlation_id); BulkImportRow; BulkImportResult

- [x] T004 [US2] Create `packages/domain-core/src/students/students.errors.ts` — define StudentErrorCode union type (11 codes); STUDENT_ERROR_HTTP Record mapping codes to HTTP status numbers; StudentError class extending Error with readonly code and httpStatus properties

- [x] T005 [US2] Create `packages/domain-core/src/students/students.repository.ts` — implement all raw SQL functions (no HTTP, no framework): findStudentById, findStudentByEmailForUpdate (SELECT FOR UPDATE), countActiveStudents (SELECT FOR UPDATE), insertStudent, listStudents (dynamic WHERE + COUNT(\*) OVER window), updateStudent, updateStudentStatus (with tokenVersionIncrement flag), updateSubscriptionStatus, softDeleteStudent, checkStudentHasAttempts, bulkInsertStudents, validateDivisionActive, validateDepartmentBelongsToDivision, validateGroupBelongsToDepartmentOrDivision — all parameterized with $N placeholders, all scoped to workspaceId

- [x] T006 [US2] Create `packages/domain-core/src/students/students.service.ts` — implement createStudent (SERIALIZABLE: email FOR UPDATE → count FOR UPDATE → division check → department check → group check → hashStaffPassword → insertStudent → COMMIT/ROLLBACK); listStudents; getStudentById; updateStudent; disableStudent (DISABLED + token_version++); enableStudent (ACTIVE); deleteStudent (calls checkStudentHasAttempts first); updateSubscriptionStatus; bulkImportStudents (delegates to bulk-import); helper toStudentRecord() strips password_hash, failed_login_count, locked_until

- [x] T007 [US2] Create `packages/domain-core/src/students/students.bulk-import.ts` — implement bulkImportStudents function: process rows in chunks of 50; per batch: begin SERIALIZABLE transaction → countActiveStudents FOR UPDATE → per-row: email uniqueness check + validate division + hash password + insertStudent; collect errors per row with row index + email + reason; return BulkImportResult {inserted, skipped, errors}; stop accepting new rows when studentLimit reached (record STUDENT_LIMIT_EXCEEDED per remaining row)

- [x] T008 [US2] Create `packages/domain-core/src/students/index.ts` — re-export all public service functions (createStudent, listStudents, getStudentById, updateStudent, disableStudent, enableStudent, deleteStudent, updateSubscriptionStatus, bulkImportStudents); re-export all types from students.types.ts; re-export StudentError, StudentErrorCode, STUDENT_ERROR_HTTP from students.errors.ts

---

## Phase B — Domain-Core Tests

- [x] T009 [P] [US2] Create `packages/domain-core/src/students/__tests__/students.service.test.ts` — unit tests with mocked DbClient; test: createStudent success, email conflict → STUDENT_EMAIL_CONFLICT, limit exceeded → STUDENT_LIMIT_EXCEEDED, ROLLBACK called on error; disableStudent success, already disabled → STUDENT_ALREADY_DISABLED; enableStudent success, already active → STUDENT_ALREADY_ACTIVE; deleteStudent no-attempts happy path, has-attempts → STUDENT_HAS_ATTEMPTS; bulkImportStudents partial failure returns correct counts

---

## Phase C — Validation Schemas

- [x] T010 [US3] Create `packages/validation/src/student.schema.ts` — define Zod schemas: subscriptionStatusSchema (enum), studentStatusSchema (enum), createStudentBodySchema (all fields, password min 8), updateStudentBodySchema (optional fields + .refine at-least-one), studentListQuerySchema (pagination + filters with .coerce.number for page/limit), bulkImportRowSchema (single row), bulkImportBodySchema (array min 1 max 500), updateSubscriptionStatusBodySchema

- [x] T011 [US3] Update `packages/validation/src/index.ts` — add named re-exports for all schemas from student.schema.ts

---

## Phase D — Backoffice API Routes

- [x] T012 [US4] Create `apps/api/src/routes/backoffice/students/helpers.ts` — implement getDb(c) → c.get('tenant').pool; buildAuditCtx(c) → {user_id: user.id, workspace_id, workspace_slug, correlation_id}; isValidUuid(value) UUID regex; studentErrorResponse(c, err) → StudentError branch returns typed error response; fallback logs with createLogger and returns 500 INTERNAL_ERROR

- [x] T013 [US4] Create `apps/api/src/routes/backoffice/students/index.ts` — assemble Hono<BackofficeEnv> router; define canView/canCreate/canEdit/canDelete guards (PermissionModule.USERS); register routes in strict order: bulk-import first → action paths (disable, enable, subscription) before /:id → CRUD (POST, GET list, GET /:id, PATCH /:id, DELETE /:id); export studentsRouter

- [x] T014 [US4] Create `apps/api/src/routes/backoffice/students/create-student.ts` — handleCreateStudent: JSON parse (catch invalid JSON → 400); safeParse createStudentBodySchema; getDb(c) + buildAuditCtx(c) + c.get('license')?.student_limit ?? 100; call createStudent with workspace_id from tenant context; return 201 StudentRecord; catch → studentErrorResponse

- [x] T015 [US4] Create `apps/api/src/routes/backoffice/students/list-students.ts` — handleListStudents: parse query params with studentListQuerySchema; getDb(c); call listStudents with workspace_id + query; return 200 StudentListResult; catch → studentErrorResponse

- [x] T016 [US4] Create `apps/api/src/routes/backoffice/students/get-student.ts` — handleGetStudent: validate :id UUID using isValidUuid (400 if invalid); getDb(c); call getStudentById; return 200 StudentRecord; catch → studentErrorResponse (throws STUDENT_NOT_FOUND → 404)

- [x] T017 [US4] Create `apps/api/src/routes/backoffice/students/update-student.ts` — handleUpdateStudent: validate :id UUID; safeParse updateStudentBodySchema; getDb(c) + buildAuditCtx(c); call updateStudent; return 200 StudentRecord; catch → studentErrorResponse

- [x] T018 [US4] Create `apps/api/src/routes/backoffice/students/disable-student.ts` — handleDisableStudent: validate :id UUID; getDb(c) + buildAuditCtx(c); call disableStudent; return 200 StudentRecord; catch → studentErrorResponse

- [x] T019 [US4] Create `apps/api/src/routes/backoffice/students/enable-student.ts` — handleEnableStudent: validate :id UUID; getDb(c) + buildAuditCtx(c); call enableStudent; return 200 StudentRecord; catch → studentErrorResponse

- [x] T020 [US4] Create `apps/api/src/routes/backoffice/students/delete-student.ts` — handleDeleteStudent: validate :id UUID; getDb(c) + buildAuditCtx(c); call deleteStudent; return 200 {success: true, data: {deleted: true}, error: null}; catch → studentErrorResponse

- [x] T021 [US4] Create `apps/api/src/routes/backoffice/students/update-subscription-status.ts` — handleUpdateSubscriptionStatus: validate :id UUID; safeParse updateSubscriptionStatusBodySchema; getDb(c) + buildAuditCtx(c); call updateSubscriptionStatus; return 200 StudentRecord; catch → studentErrorResponse

- [x] T022 [US4] Create `apps/api/src/routes/backoffice/students/bulk-import-students.ts` — handleBulkImportStudents: parse body; safeParse bulkImportBodySchema (max 500 rows); getDb(c) + buildAuditCtx(c) + c.get('license')?.student_limit ?? 100; call bulkImportStudents; return 200 BulkImportResult; catch → studentErrorResponse

---

## Phase E — Auth Migration (Frontoffice Login)

- [x] T023 [US5] Update `apps/api/src/routes/auth/frontoffice-login.ts` — replace the SELECT query targeting `users WHERE role = 'student'` with equivalent query targeting `students WHERE email = $1 AND workspace_id = $2`; add workspace_id parameter; replace `is_active` check with `status = 'ACTIVE'` check; replace all UPDATE statements for failed_login_count and locked_until to target `students` table; preserve JWT structure; preserve account-lock and token_version logic

---

## Phase F — App Registration

- [x] T024 [US6] Update `apps/api/src/app.ts` — add import for studentsRouter from `./routes/backoffice/students`; add `app.route('/api/v1/backoffice/workspace', studentsRouter)` immediately after the existing staffRouter line (~216)

---

## Phase F — Integration Tests

- [x] T025 [P] [US6] Create `apps/api/src/routes/backoffice/students/__tests__/students.test.ts` — integration tests covering: POST /students success (201, no password_hash in response); POST /students email conflict (409 STUDENT_EMAIL_CONFLICT); POST /students limit exceeded (422 STUDENT_LIMIT_EXCEEDED); POST /students invalid division (422 STUDENT_DIVISION_INACTIVE); GET /students paginated (200 + StudentListResult); GET /students/:id found (200 + StudentRecord); GET /students/:id not found (404 STUDENT_NOT_FOUND); PATCH /students/:id update (200); PATCH /students/:id/disable (200 + status=DISABLED); PATCH /students/:id/enable (200 + status=ACTIVE); PATCH /students/:id/disable already disabled (409 STUDENT_ALREADY_DISABLED); DELETE /students/:id no attempts (200 + {deleted: true}); DELETE /students/:id has attempts (409 STUDENT_HAS_ATTEMPTS); PATCH /students/:id/subscription (200); POST /students/bulk-import success (200 + BulkImportResult); POST /students/bulk-import limit reached (200 + BulkImportResult with errors)
