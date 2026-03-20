# Tasks: Semesters (STAGE_27)

**Stage:** STAGE_27_SEMESTERS  
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Total Tasks:** 27  
**Generated:** 2026-03-20

Notation guide:

- `[P]` = parallel (can run concurrently with others in the same group)
- `[US1]` = user story reference
- Foundational/infra tasks have no US label

---

## Group A — Migration & Database Schema (Sequential)

- [ ] T001 Create tenant migration file with semesters table DDL, students.semester_id FK, and schema_version bump to 1.11.0 at `apps/api/src/db/tenant/migrations/20260320_005_semesters.ts`
- [ ] T002 [P] Create Drizzle ORM schema for semesters table at `apps/api/src/db/tenant/schemas/semesters.schema.ts`
- [ ] T003 [P] Add semester_id UUID FK column and semesterIdIdx index to students Drizzle schema at `apps/api/src/db/tenant/schemas/students.schema.ts`

---

## Group B — Domain Package: Types & Errors (Parallel)

- [ ] T004 [P] Create semesters domain types (DbClient, AuditContext, SemesterStatus enum, SemesterRow, ListSemestersInput, ListSemestersResult, CreateSemesterInput, UpdateSemesterInput) at `packages/domain-core/src/semesters/semesters.types.ts`
- [ ] T005 [P] Create semesters error codes, HTTP status map, error messages map, and SemestersError class at `packages/domain-core/src/semesters/semesters.errors.ts`

---

## Group C — Domain Package: Repository (Sequential after B)

- [ ] T006 Create semesters repository with all query functions: findSemesters, countSemesters, findSemesterById, lockSemesterForUpdate, semesterNameExists, insertSemester, updateSemesterRow, softDeleteSemester, countStudentsForSemester at `packages/domain-core/src/semesters/semesters.repository.ts`

---

## Group D — Domain Package: Service (Sequential after C)

- [ ] T007 [US2] Create createSemester service function with BEGIN/COMMIT TX, date range validation, name uniqueness check via semesterNameExists, and insertSemester call at `packages/domain-core/src/semesters/semesters.service.ts`
- [ ] T008 [US3] Add getSemesterById service function (read-only, throws SEMESTER_NOT_FOUND) to `packages/domain-core/src/semesters/semesters.service.ts`
- [ ] T009 [US1] Add listSemesters service function (no TX, offset-based pagination: offset=(page-1)\*limit, countSemesters + findSemesters) to `packages/domain-core/src/semesters/semesters.service.ts`
- [ ] T010 [US4] Add updateSemester service function with BEGIN/COMMIT TX, existence check, name collision check (excluding self), effective date validation (merge with existing), and updateSemesterRow call to `packages/domain-core/src/semesters/semesters.service.ts`
- [ ] T011 [US5] Add deleteSemester service function with BEGIN/COMMIT TX, SELECT FOR UPDATE row lock, deleted check, countStudentsForSemester guard (SEMESTER_HAS_STUDENTS), softDeleteSemester call, and STAGE_28 annotation comment to `packages/domain-core/src/semesters/semesters.service.ts`

---

## Group E — Domain Package: Barrel & Exports (Sequential after D)

- [ ] T012 Create semesters domain barrel re-exporting all public types, error class/codes, and service functions at `packages/domain-core/src/semesters/index.ts`
- [ ] T013 Add `"./semesters": "./src/semesters/index.ts"` export entry and fix missing `"./teams": "./src/teams/index.ts"` export entry in `packages/domain-core/package.json`

---

## Group F — Validation Schemas (Parallel, independent of D/E)

- [ ] T014 [P] [US1] Create listSemestersQuerySchema (page int≥1 default 1, limit 1–100 default 20 with HTTP 422 on out-of-range, status enum optional, search string optional) at `packages/validation/src/backoffice/semesters.schemas.ts`
- [ ] T015 [P] Create semesterParamsSchema (id UUID) at `packages/validation/src/backoffice/semesters.schemas.ts`
- [ ] T016 [P] [US2] Create createSemesterBodySchema (name 1–255 required, description max 5000 nullable, start_date YYYY-MM-DD regex nullable, end_date same nullable) at `packages/validation/src/backoffice/semesters.schemas.ts`
- [ ] T017 [P] [US4] Create updateSemesterBodySchema (all fields optional, at-least-one-field refine) at `packages/validation/src/backoffice/semesters.schemas.ts`

---

## Group G — Route Handler Layer (Parallel after E, F)

- [ ] T018 Create shared route utilities (getDb, buildAuditCtx, successResponse, semestersErrorResponse mapping SemestersError→JSON + ZodError→422 + unknown→500) at `apps/api/src/routes/backoffice/semesters/helpers.ts`
- [ ] T019 [P] [US1] Create listSemestersHandler: GET /semesters — parseAsync listSemestersQuerySchema from query, call listSemesters, return 200 at `apps/api/src/routes/backoffice/semesters/list-semesters.ts`
- [ ] T020 [P] [US2] Create createSemesterHandler: POST /semesters — parseAsync createSemesterBodySchema from body, call createSemester, return 201 at `apps/api/src/routes/backoffice/semesters/create-semester.ts`
- [ ] T021 [P] [US3] Create getSemesterHandler: GET /semesters/:id — parseAsync semesterParamsSchema from param, call getSemesterById, return 200 at `apps/api/src/routes/backoffice/semesters/get-semester.ts`
- [ ] T022 [P] [US4] Create updateSemesterHandler: PATCH /semesters/:id — parseAsync semesterParamsSchema + updateSemesterBodySchema, call updateSemester, return 200 at `apps/api/src/routes/backoffice/semesters/update-semester.ts`
- [ ] T023 [P] [US5] Create deleteSemesterHandler: DELETE /semesters/:id — parseAsync semesterParamsSchema from param, call deleteSemester, return 200 with { deleted: true } at `apps/api/src/routes/backoffice/semesters/delete-semester.ts`
- [ ] T024 Create createSemestersRouter factory and semestersRouter export registering all 5 handlers at `apps/api/src/routes/backoffice/semesters/index.ts`

---

## Group H — App Registration (Sequential after G)

- [ ] T025 Add semestersRouter import and app.route registration at `/api/v1/backoffice/workspace` (after the teamsRouter line) in `apps/api/src/app.ts`

---

## Group I — Tests (Parallel after G)

- [ ] T026 [P] Create unit tests covering all semesters service functions: createSemester (happy path, duplicate name, invalid date range), getSemesterById (found/not-found), updateSemester (name change, self-name, collision, date merge, invalid), deleteSemester (happy, has students, already deleted), listSemesters (pages, filters) at `packages/domain-core/src/semesters/__tests__/semesters.service.test.ts`
- [ ] T027 [P] Create integration tests for all 5 route handlers using vi.mock for domain service, @zidney/logger, and helpers; covering success, sentinel errors, and validation failures at `apps/api/src/routes/backoffice/semesters/__tests__/semesters.integration.test.ts`

---

## Task Execution Order Summary

```
A: T001 → T002 ‖ T003
B: T004 ‖ T005
C: T006
D: T007 → T008 → T009 → T010 → T011
E: T012 → T013
F: T014 ‖ T015 ‖ T016 ‖ T017   (parallel, independent)
G: T018 → T019 ‖ T020 ‖ T021 ‖ T022 ‖ T023 → T024
H: T025
I: T026 ‖ T027
```

Dependencies between groups:

- F can start once the spec is known (no code dependency on D/E for the schema shapes)
- G requires E (domain exports) and F (validation schemas)
- H requires G
- I requires G

Total: **27 tasks**
