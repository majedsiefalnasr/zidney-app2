# Tasks: STAGE_29 — Lessons

**Stage:** STAGE_29_LESSONS  
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Total Tasks:** 26  
**Generated:** 2026-03-21  
**Plan Source:** specs/runtime/029-lessons/plan.md

---

## Task Format

```
- [ ] TXXX [P] [USX] Description — apps/path/to/file.ts
```

- `[P]` — task can execute in parallel with adjacent `[P]`-marked tasks
- `[USX]` — user story label (omitted for foundational/setup tasks)
- Tasks without `[P]` must complete before the next task begins

---

## User Stories

- **US1** — Create Lesson
- **US2** — List Lessons
- **US3** — Get Lesson by ID
- **US4** — Update Lesson
- **US5** — Get Active Lessons (runtime dropdown)
- **US6** — Delete Lesson (soft delete)

---

## Phase A — Migration & Schema (Foundational)

- [ ] T001 Create tenant migration file: `lessons` table, PK, status CHECK, 3 FKs (subject_id RESTRICT, created_by/updated_by SET NULL), 3 indexes (unique_lessons_subject_name functional, idx_lessons_subject_id, idx_lessons_status), schema_version bump 1.12.0→1.13.0 — `apps/api/src/db/tenant/migrations/20260321_007_lessons.ts`

---

## Phase B — Domain Package Core Types (Foundational, Parallel Group)

- [ ] T002 [P] Create lessons types: DbClient interface, AuditContext, LessonStatus union, LessonRow, ListLessonsInput, ListLessonsResult, CreateLessonInput, UpdateLessonInput — `packages/domain-core/src/lessons/lessons.types.ts`

- [ ] T003 [P] Create lessons error definitions: LessonsErrorCode union (8 codes), LESSONS_ERROR_HTTP_STATUS map, LESSONS_ERROR_MESSAGES map, LessonsError class — `packages/domain-core/src/lessons/lessons.errors.ts`

- [ ] T004 [P] Create dependency-registry stub: DependencyCheckFn type, lessonDependencyRegistry empty array, checkLessonDependencies always returns 0 (no downstream tables in this stage) — `packages/domain-core/src/lessons/lessons.dependency-registry.ts`

---

## Phase C — Repository Layer

- [ ] T005 Create repository with all 8 query functions using parameterized SQL only (no string interpolation): findLessonById, findLessons (dynamic WHERE + ILIKE), countLessons, findActiveLessonsForSubject, subjectExists, lessonNameExistsInSubject (with optional excludeId), insertLesson, updateLessonRow (dynamic SET) — `packages/domain-core/src/lessons/lessons.repository.ts`

---

## Phase D — Service Layer (Sequential — each depends on prior service functions)

- [ ] T006 [US2] Implement listLessons service function: concurrent Promise.all([countLessons, findLessons]), returns ListLessonsResult, no transaction — `packages/domain-core/src/lessons/lessons.service.ts`

- [ ] T007 [US1] Implement createLesson service function: transaction (BEGIN/COMMIT/ROLLBACK) — subjectExists check, lessonNameExistsInSubject check, insertLesson, catch PG 23505 → LESSON_NAME_DUPLICATE — `packages/domain-core/src/lessons/lessons.service.ts`

- [ ] T008 [US3] Implement getLesson service function: findLessonById, throws LESSON_NOT_FOUND if null, no transaction — `packages/domain-core/src/lessons/lessons.service.ts`

- [ ] T009 [US5] Implement getActiveLessons service function: subjectExists guard → false → throw LESSON_SUBJECT_NOT_FOUND; findActiveLessonsForSubject → flat Array<{ id, name, code }>, no transaction — `packages/domain-core/src/lessons/lessons.service.ts`

- [ ] T010 [US4] Implement updateLesson service function: transaction — findLessonById (→ LESSON_NOT_FOUND), DISABLED guard with Q7 logic (non-status field on disabled → LESSON_DISABLED even if status=ENABLED present), status-only idempotency checks (LESSON_ALREADY_ENABLED/DISABLED), lessonNameExistsInSubject (→ LESSON_NAME_DUPLICATE), updateLessonRow, catch PG 23505 → LESSON_NAME_DUPLICATE — `packages/domain-core/src/lessons/lessons.service.ts`

- [ ] T011 [US6] Implement deleteLesson service function: transaction — findLessonById (→ LESSON_NOT_FOUND), LESSON_ALREADY_DISABLED guard, updateLessonRow with { status: DISABLED }, returns { deleted: true as const } — `packages/domain-core/src/lessons/lessons.service.ts`

- [ ] T012 Create lessons domain barrel (re-exports dependency-registry, errors, service functions, selected types) and add `"./lessons": "./src/lessons/index.ts"` subpath export to domain-core package — `packages/domain-core/src/lessons/index.ts` + `packages/domain-core/package.json`

---

## Phase E — Validation Schemas

- [ ] T013 Create Zod schemas: listLessonsQuerySchema (subject_id opt UUID, status opt enum, search opt max 100, page/limit coerced), activeLessonsQuerySchema (subject_id **required** UUID — distinct from list schema), lessonParamsSchema (id required UUID), createLessonBodySchema (subject_id req UUID, name req max 255 trimmed + whitespace refine, code opt max 100 nullable, description opt nullable), updateLessonBodySchema (all opt, subject_id forbidden, at-least-one-field refine) — `packages/validation/src/backoffice/lessons.schemas.ts`

---

## Phase F — Route Helpers

- [ ] T014 Create route helpers: getDb (extract tenant pool from context), buildAuditCtx (correlation_id, workspace_id, workspace_slug, user_id nullable), successResponse, lessonsErrorResponse (handles LessonsError → mapped HTTP, ZodError → 422 VALIDATION_ERROR, unknown → 500) — `apps/api/src/routes/backoffice/lessons/helpers.ts`

---

## Phase G — Route Handlers (Parallel Group — independent modules)

- [ ] T015 [P] [US2] Implement list lessons handler: parse listLessonsQuerySchema, call listLessons service, structured logger debug+info, return paginated 200 response — `apps/api/src/routes/backoffice/lessons/list-lessons.ts`

- [ ] T016 [P] [US1] Implement create lesson handler: parse createLessonBodySchema from body, call createLesson service, structured log, return 201 with LessonRow — `apps/api/src/routes/backoffice/lessons/create-lesson.ts`

- [ ] T017 [P] [US5] Implement get active lessons handler: parse activeLessonsQuerySchema (required subject_id → 422 if missing/invalid), call getActiveLessons service, return flat array `{ id, name, code }[]` as `data`, license-check only (no auth) — `apps/api/src/routes/backoffice/lessons/get-active-lessons.ts`

- [ ] T018 [P] [US3] Implement get lesson handler: parse lessonParamsSchema, call getLesson service, structured log, return 200 with LessonRow — `apps/api/src/routes/backoffice/lessons/get-lesson.ts`

- [ ] T019 [P] [US4] Implement update lesson handler: parse lessonParamsSchema + updateLessonBodySchema, call updateLesson service, structured log, return 200 with updated LessonRow — `apps/api/src/routes/backoffice/lessons/update-lesson.ts`

- [ ] T020 [P] [US6] Implement delete lesson handler: parse lessonParamsSchema, call deleteLesson service, structured log, return 200 with `{ deleted: true }` — `apps/api/src/routes/backoffice/lessons/delete-lesson.ts`

---

## Phase H — Router Assembly & Registration

- [ ] T021 Update subjects dependency-registry: define `countLessonsForSubject(db, subject_id)` function (SELECT COUNT from lessons WHERE subject_id = $1::uuid), push entry into `subjectDependencyRegistry` — `packages/domain-core/src/subjects/subjects.dependency-registry.ts`

- [ ] T022 Create lessons router: createLessonsRouter function, register 6 routes in correct Hono order (GET /lessons, POST /lessons, GET /lessons/runtime BEFORE GET /lessons/:id, PATCH /lessons/:id, DELETE /lessons/:id), export lessonsRouter const — `apps/api/src/routes/backoffice/lessons/index.ts`

- [ ] T023 Mount lessonsRouter in API app: import lessonsRouter from `./routes/backoffice/lessons`, add `app.route('/api/v1/backoffice/workspace', lessonsRouter)` after subjectsRouter registration — `apps/api/src/app.ts`

---

## Phase I — Tests

- [ ] T024 Write unit tests for lessons service layer: 15 test cases covering all 5 write/read service functions — createLesson (success, LESSON_SUBJECT_NOT_FOUND, LESSON_NAME_DUPLICATE pre-check, 23505 race guard), updateLesson (success, LESSON_NOT_FOUND, LESSON_DISABLED non-status field, Q7 status+name on DISABLED, ALREADY_ENABLED, ALREADY_DISABLED, name duplicate), deleteLesson (success, LESSON_NOT_FOUND, ALREADY_DISABLED), listLessons/getLesson basic paths — `packages/domain-core/src/lessons/__tests__/lessons.service.test.ts`

- [ ] T025 Write integration tests for all 6 lesson API routes: real tenant test DB with migrations 001–007 applied — GET /lessons (pagination, subject_id filter, status filter, search), POST /lessons (201, 404 subject, 409 duplicate, 422 missing, 403 auth), GET /lessons/runtime (ENABLED only, flat shape, required subject_id 422, 404 subject), GET /lessons/:id (200, 404, 422 UUID), PATCH /lessons/:id (field update, status transitions, DISABLED guard, Q7, 409 duplicate), DELETE /lessons/:id ({ deleted: true }, 422 already disabled), tenant isolation (lesson from tenant-A → 404 from tenant-B) — `apps/api/src/routes/backoffice/lessons/__tests__/lessons.integration.test.ts`

---

## Phase J — Final Validation

- [ ] T026 Run full validation gate: bun test (unit + integration), biome check exits 0, bun run typecheck exits 0, migration idempotency verified (apply 20260321_007_lessons.ts twice = no error due to IF NOT EXISTS guards), lint clean — (validation only, no new files)
