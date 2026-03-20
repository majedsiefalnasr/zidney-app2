# Tasks: STAGE_28 — Subjects

**Stage:** STAGE_28_SUBJECTS  
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Total Tasks:** 27  
**Generated:** 2026-03-20  
**Plan Source:** specs/runtime/028-subjects/plan.md

---

## Task Format

```
- [ ] TXXX [P] [USX] Description — apps/path/to/file.ts
```

- `[P]` — task can execute in parallel with adjacent `[P]`-marked tasks
- `[USX]` — user story label (omitted for foundational/setup tasks)
- Tasks without `[P]` must complete before the next task begins

---

## Phase A — Migration & Schema (Foundational)

- [x] T001 Create tenant migration file: subjects table, all 9 indexes, schema_version bump 1.11.0→1.12.0 — apps/api/src/db/tenant/migrations/20260320_006_subjects.ts

- [x] T002 Create Drizzle ORM schema for subjects table (6 indexes declared in schema; partial/functional indexes are migration-owned only) — apps/api/src/db/tenant/schemas/subjects.schema.ts

---

## Phase B — Domain Package Core Types (Foundational, Parallel Group)

- [x] T003 [P] Create subjects types (SubjectStatus, SubjectRow, CreateSubjectInput, UpdateSubjectInput, TransitionSubjectInput, ListSubjectsInput, ListSubjectsResult, AuditContext, DbClient) — packages/domain-core/src/subjects/subjects.types.ts

- [x] T004 [P] Create subjects error definitions (SubjectsErrorCode union, HTTP status map, message map, SubjectsError class — 11 error codes) — packages/domain-core/src/subjects/subjects.errors.ts

- [x] T005 [P] Create dependency check registry (DependencyCheckFn type, subjectDependencyRegistry array, checkSubjectDependencies aggregator — starts empty at STAGE_28) — packages/domain-core/src/subjects/subjects.dependency-registry.ts

---

## Phase C — Repository Layer

- [x] T006 Create repository with all read/write query functions: findSubjectById, findSubjects, countSubjects, lockSubjectForUpdate, subjectNameExists, subjectCodeExists, insertSubject, updateSubjectRow, casTransitionSubject, softDeleteSubject — packages/domain-core/src/subjects/subjects.repository.ts

---

## Phase D — Service Layer (Sequential — each depends on prior service functions)

- [x] T007 [US2] Implement listSubjects service function (concurrent count + find, no transaction, offset pagination) — packages/domain-core/src/subjects/subjects.service.ts

- [x] T008 [US1] Implement createSubject service function (transaction: FK validation, division auto-assign, name/code uniqueness, insertSubject) — packages/domain-core/src/subjects/subjects.service.ts

- [x] T009 [US3] Implement getSubjectById service function (no transaction, SUBJECT_NOT_FOUND on null) — packages/domain-core/src/subjects/subjects.service.ts

- [x] T010 [US4] Implement updateSubject service function (transaction: lockForUpdate, SUBJECT_ARCHIVED guard, name/code/FK validation, updateSubjectRow) — packages/domain-core/src/subjects/subjects.service.ts

- [x] T011 [US5] Implement transitionSubjectStatus service function (transaction: lockForUpdate, state machine validation DRAFT→ACTIVE / ACTIVE→ARCHIVED only, CAS update, conflict on rowCount=0) — packages/domain-core/src/subjects/subjects.service.ts

- [x] T012 [US6] Implement deleteSubject service function (transaction: lockForUpdate, dependency registry check, softDeleteSubject) — packages/domain-core/src/subjects/subjects.service.ts

- [x] T013 Create domain package barrel export (re-exports all types, errors, dependency registry, service functions — follows semesters/index.ts pattern) — packages/domain-core/src/subjects/index.ts

---

## Phase E — Validation Schemas

- [x] T014 Create Zod validation schemas: listSubjectsQuerySchema, subjectParamsSchema, createSubjectBodySchema (whitespace-only name guard + transform), updateSubjectBodySchema (all-optional + at-least-one-field refine), transitionSubjectBodySchema — packages/validation/src/backoffice/subjects.schemas.ts

---

## Phase F — Route Helpers

- [x] T015 Create route helpers: getDb, buildAuditCtx, successResponse, subjectsErrorResponse (handles pg 55P03→503, SubjectsError→mapped HTTP, ZodError→422, unknown→500) — apps/api/src/routes/backoffice/subjects/helpers.ts

---

## Phase G — Route Handlers (Parallel Group — independent modules)

- [x] T016 [P] [US2] Implement list subjects handler (parse listSubjectsQuerySchema from query, call listSubjects service, structured log) — apps/api/src/routes/backoffice/subjects/list-subjects.ts

- [x] T017 [P] [US1] Implement create subject handler (parse createSubjectBodySchema from body, call createSubject service, 201 response, structured log) — apps/api/src/routes/backoffice/subjects/create-subject.ts

- [x] T018 [P] [US7] Implement get active subjects handler (parse query omitting status param, call listSubjects with forced status=ACTIVE — runtime endpoint) — apps/api/src/routes/backoffice/subjects/get-active-subjects.ts

- [x] T019 [P] [US3] Implement get subject handler (parse subjectParamsSchema, call getSubjectById, structured log) — apps/api/src/routes/backoffice/subjects/get-subject.ts

- [x] T020 [P] [US4] Implement update subject handler (parse params + updateSubjectBodySchema from body, call updateSubject service, structured log) — apps/api/src/routes/backoffice/subjects/update-subject.ts

- [x] T021 [P] [US5] Implement transition subject handler (parse params + transitionSubjectBodySchema from body, call transitionSubjectStatus service, structured log) — apps/api/src/routes/backoffice/subjects/transition-subject.ts

- [x] T022 [P] [US6] Implement delete subject handler (parse subjectParamsSchema, call deleteSubject service, 200 response, structured log) — apps/api/src/routes/backoffice/subjects/delete-subject.ts

---

## Phase H — Router Assembly & Registration

- [x] T023 Create subjects router (createSubjectsRouter function, register all 7 routes in correct order: GET /subjects, POST /subjects, GET /subjects/runtime BEFORE GET /subjects/:id, PATCH /subjects/:id, POST /subjects/:id/transition, DELETE /subjects/:id) — apps/api/src/routes/backoffice/subjects/index.ts

- [x] T024 Register subjects router in API app (import subjectsRouter, add app.route('/api/v1/backoffice/workspace', subjectsRouter) after semesters registration) — apps/api/src/app.ts

---

## Phase I — Tests

- [x] T025 Write unit tests for subjects service layer: 13 test cases covering all service functions (createSubject, getSubjectById, updateSubject, transitionSubjectStatus, deleteSubject — success and error paths, state machine validation, CAS conflict, SUBJECT_ARCHIVED guard, dependency check) — packages/domain-core/src/subjects/**tests**/subjects.service.test.ts

- [x] T026 Write integration tests for all 7 subject API endpoints: 26 scenarios covering full CRUD lifecycle, pagination, filters, workflow transitions, error responses, cross-tenant isolation, auth/authz, soft delete, runtime endpoint, schema version mismatch, license enforcement — apps/api/src/routes/backoffice/subjects/**tests**/subjects.integration.test.ts

---

## Phase J — Final Validation

- [x] T027 Run full validation gate: unit tests pass, integration tests pass, biome check exits 0, tsc type-check exits 0, migration idempotency verified (apply twice = no error), lint clean — (validation only, no new files)
