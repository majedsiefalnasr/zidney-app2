# Tasks Report — Stage 43: License Limit Enforcement

**Stage:** STAGE_43_LIMIT_ENFORCEMENT  
**Phase:** 03_BACKOFFICE_CORE / 05_USER_MANAGEMENT  
**Branch:** `spec/043-limit-enforcement`  
**Generated:** 2026-04-04

---

## Summary

| Field          | Value                                          |
| -------------- | ---------------------------------------------- |
| Total Tasks    | 24                                             |
| Phases         | 7 (A–G)                                        |
| New Files      | 2 (staff.bulk-import.ts, bulk-import-staff.ts) |
| Modified Files | 16                                             |
| Migrations     | None                                           |
| Deferred Tasks | 0                                              |

---

## Task List

| ID   | Phase | Risk      | Description                                                                       |
| ---- | ----- | --------- | --------------------------------------------------------------------------------- |
| T001 | A     | 🟢 LOW    | Fix `BackofficeVariables` limit types `number` → `number\|null`                   |
| T002 | A     | 🟡 MEDIUM | Fix middleware limit context assignment (string → `number\|null`)                 |
| T003 | A     | 🟢 LOW    | Extend `StudentError` with `limit_value?`/`current_value?`                        |
| T004 | A     | 🟢 LOW    | Extend `StaffError` with `limit_value?`/`current_value?`                          |
| T005 | B     | 🟢 LOW    | `createStaff()` staffLimit signature `number` → `number\|null`                    |
| T006 | B     | 🟡 MEDIUM | `processBulkImport()` studentLimit `number` → `number\|null` + null guard         |
| T007 | B     | 🟢 LOW    | `bulkImportStudents()` studentLimit signature `number` → `number\|null`           |
| T008 | C     | 🔴 HIGH   | `enableStudent()` — add SERIALIZABLE + count-before-enable limit check            |
| T009 | C     | 🔴 HIGH   | `enableStaff()` — switch to `db.connect()` + add SERIALIZABLE limit check         |
| T010 | D     | 🟡 MEDIUM | `enable-student.ts` — read `student_limit` from context, pass to service          |
| T011 | D     | 🟡 MEDIUM | `enable-staff.ts` — read `staff_limit` from context, pass to service              |
| T012 | D     | 🟡 MEDIUM | `create-staff.ts` — remove `?? 50` fallback bug                                   |
| T013 | D     | 🟡 MEDIUM | `bulk-import-students.ts` — fix null-unsafe `student_limit` read                  |
| T014 | E     | 🟡 MEDIUM | `studentErrorResponse()` — map `STUDENT_LIMIT_EXCEEDED` → `LICENSE_LIMIT_REACHED` |
| T015 | E     | 🟡 MEDIUM | `staffErrorResponse()` — map `STAFF_LIMIT_EXCEEDED` → `LICENSE_LIMIT_REACHED`     |
| T016 | F     | 🟢 LOW    | Add staff bulk import types to `staff.types.ts`                                   |
| T017 | F     | 🟢 LOW    | Add `bulkImportStaffRowSchema` + `bulkImportStaffBodySchema`                      |
| T018 | F     | 🟢 LOW    | Export new staff bulk import schemas from validation index                        |
| T019 | F     | 🔴 HIGH   | Create `staff.bulk-import.ts` — `processStaffBulkImport()` domain function        |
| T020 | F     | 🟡 MEDIUM | Add `bulkImportStaff()` service wrapper in `staff.service.ts`                     |
| T021 | F     | 🟡 MEDIUM | Create `bulk-import-staff.ts` — route handler + body validation                   |
| T022 | F     | 🟡 MEDIUM | Register `POST /bulk-import` route + update barrel exports                        |
| T023 | G     | 🟢 LOW    | Unit tests — all domain functions (enable, bulk import, null/limit paths)         |
| T024 | G     | 🟢 LOW    | Integration tests — new bulk import route + enable limit rejection cases          |

---

## Risk-Ranked Task Summary

| Task ID | Risk      | Description                                                                          |
| ------- | --------- | ------------------------------------------------------------------------------------ |
| T008    | 🔴 HIGH   | `enableStudent()` — new SERIALIZABLE limit check (critical enforcement path)         |
| T009    | 🔴 HIGH   | `enableStaff()` — db.connect() pattern switch + SERIALIZABLE limit check             |
| T019    | 🔴 HIGH   | `staff.bulk-import.ts` — new domain function (new file, complex transactional logic) |
| T002    | 🟡 MEDIUM | Middleware change affects all backoffice routes                                      |
| T006    | 🟡 MEDIUM | processsBulkImport() null guard path — behavioral change                             |
| T010    | 🟡 MEDIUM | enable-student.ts — now passes limit, changes call signature                         |
| T011    | 🟡 MEDIUM | enable-staff.ts — now passes limit, changes call signature                           |
| T012    | 🟡 MEDIUM | Removes ?? 50 bug — behavioral change for unlimited tenants                          |
| T013    | 🟡 MEDIUM | Fixes null-unsafe access — prevents runtime crash                                    |
| T014    | 🟡 MEDIUM | Error response shape change — clients consuming this endpoint                        |
| T015    | 🟡 MEDIUM | Error response shape change — clients consuming this endpoint                        |
| T020    | 🟡 MEDIUM | New service function in domain barrel                                                |
| T021    | 🟡 MEDIUM | New route handler — new endpoint                                                     |
| T022    | 🟡 MEDIUM | Route registration change                                                            |
| T001    | 🟢 LOW    | Type-only change, no runtime behavior                                                |
| T003    | 🟢 LOW    | Additive error class extension                                                       |
| T004    | 🟢 LOW    | Additive error class extension                                                       |
| T005    | 🟢 LOW    | Signature-only change — callers already updated in Phase D                           |
| T007    | 🟢 LOW    | Signature-only change — callers already updated in Phase D                           |
| T016    | 🟢 LOW    | Type-only additions                                                                  |
| T017    | 🟢 LOW    | Schema additions, no removals                                                        |
| T018    | 🟢 LOW    | Export additions only                                                                |
| T023    | 🟢 LOW    | Tests only                                                                           |
| T024    | 🟢 LOW    | Tests only                                                                           |

---

## Tasks with External Dependencies

| Task ID | Package              | Version Note                                                                                      |
| ------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| T006    | `pg` (node-postgres) | Uses `PoolClient` from `db.connect()` — verified pattern matches existing students.bulk-import.ts |
| T009    | `pg` (node-postgres) | `db.connect()` → SERIALIZABLE pattern — must mirror enableStudent.ts exactly                      |
| T019    | `pg` (node-postgres) | SERIALIZABLE per-batch pattern — mirrors students.bulk-import.ts                                  |

---

## High-Downstream-Impact Tasks

Tasks modifying architectural hotspots with HIGH centrality:

| Task ID | Module                                                  | Description                                                                    |
| ------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| T002    | `apps/api/src/middleware/license-enforcement.ts`        | Modifies middleware applied to ALL backoffice routes                           |
| T008    | `packages/domain-core/src/students/students.service.ts` | Critical enforcement path — all student enable flows                           |
| T009    | `packages/domain-core/src/staff/staff.service.ts`       | Critical enforcement path — all staff enable flows                             |
| T001    | `apps/api/src/routes/backoffice/types.ts`               | Type change affects all route handlers reading `student_limit` / `staff_limit` |

---

## Gap-to-Task Mapping

| Gap | Gap Description                                                 | Task(s)    |
| --- | --------------------------------------------------------------- | ---------- |
| G1  | `enableStudent()` no SERIALIZABLE limit check                   | T008       |
| G2  | `enableStaff()` no SERIALIZABLE limit check                     | T009       |
| G3  | `enable-student.ts` doesn't pass `student_limit`                | T010       |
| G4  | `enable-staff.ts` doesn't pass `staff_limit`                    | T011       |
| G5  | `createStaff()` staffLimit `number` not `number\|null`          | T005       |
| G6  | `create-staff.ts` uses `?? 50` fallback                         | T012       |
| G7  | `bulk-import-students.ts` null-unsafe limit read                | T013       |
| G8  | `processBulkImport()` studentLimit `number` not `number\|null`  | T006       |
| G9  | `bulkImportStudents()` studentLimit `number` not `number\|null` | T007       |
| G10 | Error helpers return domain code not `LICENSE_LIMIT_REACHED`    | T014, T015 |
| G11 | Staff bulk import feature does not exist                        | T016–T022  |
| G12 | `BackofficeVariables` limits typed `number` not `number\|null`  | T001       |
| G13 | Middleware sets limits as string not `null`                     | T002       |

All 13 gaps fully covered. No gap unaddressed.

---

## Verdict

**TASKS APPROVED — Ready for Drift Analysis (Step 5)**

All 24 tasks are atomic, ordered for TypeScript compatibility (bottom-up), and fully traceable to spec gaps.
