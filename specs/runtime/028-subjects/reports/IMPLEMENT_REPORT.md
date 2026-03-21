# Implement Report — Subjects CRUD Feature

**Step:** 6 — Implement  
**Timestamp:** 2025-07-23T00:00:00.000Z  
**Status:** COMPLETE

---

## Summary

All 27 tasks for STAGE_28 (Subjects CRUD Feature) were implemented successfully. The feature adds a complete subjects domain package and 7 backoffice REST endpoints. All validation checks (unit tests, integration tests, lint, typecheck) pass. No tasks deferred.

---

## Inputs Reviewed

- `specs/runtime/028-subjects/tasks.md`
- `specs/runtime/028-subjects/plan.md`
- `specs/runtime/028-subjects/audits/VALIDATION_REPORT.md`

---

## Files Modified

| File Path                                                                        | Change Type | Notes                                                                                                                   |
| -------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/db/tenant/migrations/20260320_006_subjects.ts`                     | Created     | Tenant migration: subjects table + 9 indexes + schema_version bump 1.11.0→1.12.0                                        |
| `apps/api/src/db/tenant/schemas/subjects.schema.ts`                              | Created     | Drizzle ORM schema for subjects table                                                                                   |
| `apps/api/src/db/tenant/schemas/index.ts`                                        | Modified    | Added `export * from './subjects.schema'`                                                                               |
| `apps/api/src/routes/backoffice/subjects/helpers.ts`                             | Created     | Shared helpers: getDb, buildAuditCtx, successResponse, subjectsErrorResponse                                            |
| `apps/api/src/routes/backoffice/subjects/list-subjects.ts`                       | Created     | GET /subjects handler                                                                                                   |
| `apps/api/src/routes/backoffice/subjects/get-active-subjects.ts`                 | Created     | GET /subjects/runtime handler                                                                                           |
| `apps/api/src/routes/backoffice/subjects/create-subject.ts`                      | Created     | POST /subjects handler                                                                                                  |
| `apps/api/src/routes/backoffice/subjects/get-subject.ts`                         | Created     | GET /subjects/:id handler                                                                                               |
| `apps/api/src/routes/backoffice/subjects/update-subject.ts`                      | Created     | PATCH /subjects/:id handler                                                                                             |
| `apps/api/src/routes/backoffice/subjects/transition-subject.ts`                  | Created     | POST /subjects/:id/transition handler                                                                                   |
| `apps/api/src/routes/backoffice/subjects/delete-subject.ts`                      | Created     | DELETE /subjects/:id handler                                                                                            |
| `apps/api/src/routes/backoffice/subjects/index.ts`                               | Created     | Hono router: mounts all 7 handlers                                                                                      |
| `apps/api/src/app.ts`                                                            | Modified    | Registered subjectsRouter at `/api/v1/backoffice/workspace`                                                             |
| `packages/domain-core/src/subjects/subjects.types.ts`                            | Created     | TypeScript types: SubjectStatus, SubjectRow, all input/output types, DbClient, AuditContext                             |
| `packages/domain-core/src/subjects/subjects.errors.ts`                           | Created     | SubjectsErrorCode union (14 codes), HTTP status map, message map, SubjectsError class                                   |
| `packages/domain-core/src/subjects/subjects.dependency-registry.ts`              | Created     | DependencyCheckFn type, subjectDependencyRegistry (empty at STAGE_28), checkSubjectDependencies                         |
| `packages/domain-core/src/subjects/subjects.repository.ts`                       | Created     | 10 query functions + semesterBelongsToDivision forward-compatibility stub                                               |
| `packages/domain-core/src/subjects/subjects.service.ts`                          | Created     | 7 service functions: listSubjects, createSubject, getSubjectById, updateSubject, transitionSubjectStatus, deleteSubject |
| `packages/domain-core/src/subjects/index.ts`                                     | Created     | Domain barrel: named exports for all public types, errors, and service functions                                        |
| `packages/domain-core/package.json`                                              | Modified    | Added `./subjects` export entry pointing to `./src/subjects/index.ts`                                                   |
| `packages/validation/src/backoffice/subjects.schemas.ts`                         | Created     | Zod validation schemas for all 6 request payloads                                                                       |
| `packages/domain-core/src/subjects/__tests__/subjects.service.test.ts`           | Created     | 19 unit tests for all service functions                                                                                 |
| `apps/api/src/routes/backoffice/subjects/__tests__/subjects.integration.test.ts` | Created     | 17 integration tests for all 7 route handlers                                                                           |

---

## Tasks Completion

| Task ID | Description                                                                                 | Layer                | Status |
| ------- | ------------------------------------------------------------------------------------------- | -------------------- | ------ |
| T001    | Tenant migration — subjects table + 9 indexes + schema_version bump                         | Infra / Migration    | ✅     |
| T002    | Drizzle ORM schema — subjects.schema.ts                                                     | Infra / Schema       | ✅     |
| T003    | Subjects types file (SubjectStatus, SubjectRow, input/output types)                         | Domain / Types       | ✅     |
| T004    | Subjects error definitions (SubjectsErrorCode, HTTP map, SubjectsError class)               | Domain / Errors      | ✅     |
| T005    | Dependency check registry (forward-compatibility hook, empty at STAGE_28)                   | Domain / Registry    | ✅     |
| T006    | Repository — all 10 query functions + semesterBelongsToDivision                             | Domain / Repository  | ✅     |
| T007    | `listSubjects` service function (concurrent count + find, offset pagination)                | Domain / Service     | ✅     |
| T008    | `createSubject` service function (FK validation, name/code uniqueness, insert)              | Domain / Service     | ✅     |
| T009    | `getSubjectById` service function                                                           | Domain / Service     | ✅     |
| T010    | `updateSubject` service function (archived guard, name uniqueness, update)                  | Domain / Service     | ✅     |
| T011    | `transitionSubjectStatus` service function (FSM, CAS, conflict detection)                   | Domain / Service     | ✅     |
| T012    | `deleteSubject` service function (dependency check, soft-delete)                            | Domain / Service     | ✅     |
| T013    | Domain barrel `index.ts` (named exports for all public API)                                 | Domain / Barrel      | ✅     |
| T014    | `packages/domain-core/package.json` — add `./subjects` export                               | Domain / Config      | ✅     |
| T015    | Zod validation schemas — subjects.schemas.ts                                                | Validation / Schemas | ✅     |
| T016    | Route helpers — `helpers.ts` (getDb, buildAuditCtx, successResponse, subjectsErrorResponse) | API / Helpers        | ✅     |
| T017    | `listSubjectsHandler` — GET /subjects                                                       | API / Handler        | ✅     |
| T018    | `getActiveSubjectsHandler` — GET /subjects/runtime                                          | API / Handler        | ✅     |
| T019    | `createSubjectHandler` — POST /subjects                                                     | API / Handler        | ✅     |
| T020    | `getSubjectHandler` — GET /subjects/:id                                                     | API / Handler        | ✅     |
| T021    | `updateSubjectHandler` — PATCH /subjects/:id                                                | API / Handler        | ✅     |
| T022    | `transitionSubjectHandler` — POST /subjects/:id/transition                                  | API / Handler        | ✅     |
| T023    | `deleteSubjectHandler` — DELETE /subjects/:id                                               | API / Handler        | ✅     |
| T024    | Hono router `index.ts` + mount in `app.ts`                                                  | API / Router         | ✅     |
| T025    | Unit tests — 19 tests covering all 6 service functions                                      | Tests / Unit         | ✅     |
| T026    | Integration tests — 17 tests covering all 7 route handlers                                  | Tests / Integration  | ✅     |
| T027    | Validation gate — lint, typecheck, test re-run                                              | Validation           | ✅     |

**Completed:** 27 / 27

---

## Tests Added or Updated

| Test File                                                                        | Type        | Scope                                                                                                                     |
| -------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain-core/src/subjects/__tests__/subjects.service.test.ts`           | Unit        | `listSubjects`, `createSubject`, `getSubjectById`, `updateSubject`, `transitionSubjectStatus`, `deleteSubject` — 19 tests |
| `apps/api/src/routes/backoffice/subjects/__tests__/subjects.integration.test.ts` | Integration | All 7 route handlers (list, runtime, create, get, update, transition, delete) — 17 tests                                  |

---

## Deferred Tasks

None. All 27 tasks completed.

---

## Notable Implementation Decisions

1. **`semesterBelongsToDivision` stub**: Semesters table at STAGE_27 has no `division_id` column. The function always returns `true` and is a forward-compatibility hook for when semester-division linkage is implemented downstream. Documented with inline comments.

2. **`SUBJECT_HAS_DEPENDENT_CONTENT` error code**: The dependency registry pattern (`checkSubjectDependencies`) is designed for extensibility — downstream stages (questions, exams) will push dependency-check functions into `subjectDependencyRegistry`. At STAGE_28, the registry is empty so no dependencies are ever found.

3. **`SUBJECT_MISSING_TRANSLATIONS` / `SUBJECT_INVALID_DEFAULT_LANGUAGE`**: Error codes are defined for future i18n support. Not triggered by any current service path but reserved in the error contract.

4. **CAS-based transition idempotency**: `transitionSubjectStatus` uses `updated_at` as a compare-and-swap token. Concurrent transitions get `SUBJECT_TRANSITION_CONFLICT` (409), allowing clients to retry with fresh state.

---

## Constitutional Compliance

| Check                                             | Status | Notes                                                                                      |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Tenant resolver context used for tenant DB access | ✅     | `getDb(c)` in all handlers extracts tenant DB from Hono context                            |
| All write operations are transactional            | ✅     | `createSubject`, `updateSubject`, `deleteSubject` wrap all writes in explicit transactions |
| Idempotency is enforced where required            | ✅     | `transitionSubjectStatus` uses CAS on `updated_at`; migration uses `IF NOT EXISTS`         |
| Structured logging is present                     | ✅     | `createLogger` used in all handlers with debug/error scoped logs                           |
| `console.log` is absent                           | ✅     | No `console.log` statements in any subjects file                                           |
| No stack traces exposed to clients                | ✅     | `subjectsErrorResponse` returns only `code` + `message`, never `stack`                     |
| UI layer has no business logic                    | ✅     | No UI changes; subjects domain is pure domain-core and API layer                           |
| API error contract is preserved                   | ✅     | All responses: `{ success, data, error: { code, message } }`                               |
