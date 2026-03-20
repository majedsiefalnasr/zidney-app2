# Step 4 — Tasks Report: Semesters (STAGE_27)

**Stage:** STAGE_27_SEMESTERS  
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Step:** 4 — Tasks  
**Completed:** 2026-03-20  
**Total Tasks:** 27

---

## Task Breakdown

### Group A — Migration & Database Schema (3 tasks)

| Task | Risk      | Description                                                                    |
| ---- | --------- | ------------------------------------------------------------------------------ |
| T001 | 🔴 HIGH   | Create tenant migration: semesters table + students FK + schema_version 1.11.0 |
| T002 | 🟡 MEDIUM | Create Drizzle schema: semesters.schema.ts                                     |
| T003 | 🟡 MEDIUM | Update Drizzle schema: students.schema.ts (add semester_id FK)                 |

### Group B — Domain Types & Errors (2 tasks, parallel)

| Task | Risk   | Description                                                                                   |
| ---- | ------ | --------------------------------------------------------------------------------------------- |
| T004 | 🟢 LOW | Create semesters.types.ts (DbClient, SemesterStatus, SemesterRow, input/result types)         |
| T005 | 🟢 LOW | Create semesters.errors.ts (SemestersErrorCode, HTTP map, messages map, SemestersError class) |

### Group C — Domain Repository (1 task)

| Task | Risk      | Description                                                                                                                                                                                                  |
| ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T006 | 🟡 MEDIUM | Create semesters.repository.ts (findSemesters, countSemesters, findSemesterById, lockSemesterForUpdate, semesterNameExists, insertSemester, updateSemesterRow, softDeleteSemester, countStudentsForSemester) |

### Group D — Domain Service (5 tasks, sequential)

| Task | Risk    | Description                                                                          |
| ---- | ------- | ------------------------------------------------------------------------------------ |
| T007 | 🔴 HIGH | createSemester: TX with date validation + name uniqueness + insert                   |
| T008 | 🟢 LOW  | getSemesterById: read-only, SEMESTER_NOT_FOUND guard                                 |
| T009 | 🟢 LOW  | listSemesters: no TX, offset-based pagination, count + find                          |
| T010 | 🔴 HIGH | updateSemester: TX with existence check + self-name exclusion + effective date merge |
| T011 | 🔴 HIGH | deleteSemester: TX with SELECT FOR UPDATE + student ref check + soft delete          |

### Group E — Domain Barrel & Package Exports (2 tasks, sequential)

| Task | Risk      | Description                                                            |
| ---- | --------- | ---------------------------------------------------------------------- |
| T012 | 🟢 LOW    | Create semesters/index.ts barrel export                                |
| T013 | 🟡 MEDIUM | Update domain-core/package.json: add ./semesters + fix missing ./teams |

### Group F — Validation Schemas (4 tasks, parallel)

| Task | Risk   | Description                                                     |
| ---- | ------ | --------------------------------------------------------------- |
| T014 | 🟢 LOW | listSemestersQuerySchema (page/limit/status/search)             |
| T015 | 🟢 LOW | semesterParamsSchema (id UUID)                                  |
| T016 | 🟢 LOW | createSemesterBodySchema (name/description/start_date/end_date) |
| T017 | 🟢 LOW | updateSemesterBodySchema (all optional, at-least-one refine)    |

### Group G — Route Handlers (7 tasks)

| Task | Risk      | Description                                                                       |
| ---- | --------- | --------------------------------------------------------------------------------- |
| T018 | 🟡 MEDIUM | Create helpers.ts (getDb, buildAuditCtx, successResponse, semestersErrorResponse) |
| T019 | 🟡 MEDIUM | list-semesters.ts handler                                                         |
| T020 | 🟡 MEDIUM | create-semester.ts handler                                                        |
| T021 | 🟡 MEDIUM | get-semester.ts handler                                                           |
| T022 | 🟡 MEDIUM | update-semester.ts handler                                                        |
| T023 | 🟡 MEDIUM | delete-semester.ts handler                                                        |
| T024 | 🟡 MEDIUM | semesters/index.ts — createSemestersRouter factory                                |

### Group H — Route Registration (1 task)

| Task | Risk      | Description                                                      |
| ---- | --------- | ---------------------------------------------------------------- |
| T025 | 🟡 MEDIUM | Update app.ts: import semestersRouter + app.route() registration |

### Group I — Tests (2 tasks, parallel)

| Task | Risk      | Description                                                                |
| ---- | --------- | -------------------------------------------------------------------------- |
| T026 | 🟡 MEDIUM | semesters.service.test.ts — unit tests for all 5 service functions         |
| T027 | 🟡 MEDIUM | semesters.integration.test.ts — integration tests for all 5 route handlers |

---

## Risk-Ranked Task Summary

| Task ID   | Risk      | Description                                                             |
| --------- | --------- | ----------------------------------------------------------------------- |
| T001      | 🔴 HIGH   | Tenant migration: semesters table + students FK + schema_version 1.11.0 |
| T007      | 🔴 HIGH   | createSemester TX with date validation and name uniqueness              |
| T010      | 🔴 HIGH   | updateSemester TX with existence check and effective date merge         |
| T011      | 🔴 HIGH   | deleteSemester TX with SELECT FOR UPDATE and student ref guard          |
| T002      | 🟡 MEDIUM | Drizzle schema: semesters.schema.ts                                     |
| T003      | 🟡 MEDIUM | Drizzle schema update: students.schema.ts                               |
| T006      | 🟡 MEDIUM | semesters.repository.ts                                                 |
| T013      | 🟡 MEDIUM | domain-core/package.json exports update                                 |
| T018      | 🟡 MEDIUM | semesters/helpers.ts                                                    |
| T019-T024 | 🟡 MEDIUM | All route handler files                                                 |
| T025      | 🟡 MEDIUM | app.ts route registration                                               |
| T026      | 🟡 MEDIUM | Unit tests                                                              |
| T027      | 🟡 MEDIUM | Integration tests                                                       |
| T004      | 🟢 LOW    | semesters.types.ts                                                      |
| T005      | 🟢 LOW    | semesters.errors.ts                                                     |
| T008      | 🟢 LOW    | getSemesterById read-only service                                       |
| T009      | 🟢 LOW    | listSemesters read-only service                                         |
| T012      | 🟢 LOW    | semesters/index.ts barrel                                               |
| T014-T017 | 🟢 LOW    | Zod validation schema files                                             |

---

## External Dependencies

| Task ID   | Package             | Version Note                                                                                 |
| --------- | ------------------- | -------------------------------------------------------------------------------------------- |
| T002      | drizzle-orm/pg-core | pgTable, uuid, varchar, text, timestamp, date, index — verified pattern from teams.schema.ts |
| T006      | pg (PoolClient)     | Structural DbClient interface; parameterized query pattern confirmed                         |
| T019–T024 | @hono/hono          | Hono context and route handler pattern verified from teams handlers                          |

---

## High-Downstream-Impact Tasks

| Task ID | Module                         | Centrality | Description                                                      |
| ------- | ------------------------------ | ---------- | ---------------------------------------------------------------- |
| T001    | apps/api/src/db/tenant         | HIGH       | Migration adds semesters table and alters students               |
| T013    | packages/domain-core           | HIGH       | Package.json exports affect all consumers of @zidney/domain-core |
| T025    | apps/api/src/app.ts            | HIGH       | Route registration in central app file                           |
| T003    | apps/api/src/db/tenant/schemas | HIGH       | students.schema.ts modification affects student domain           |

---

**Task breakdown complete. Proceeding to Step 5 — Analyze.**
