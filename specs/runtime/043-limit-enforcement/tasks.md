# Tasks — Stage 43: License Limit Enforcement

**Stage:** STAGE_43_LIMIT_ENFORCEMENT  
**Phase:** 03_BACKOFFICE_CORE / 05_USER_MANAGEMENT  
**Branch:** `spec/043-limit-enforcement`  
**Total Tasks:** 24

---

## Execution Order

Tasks must be executed in the order listed. TypeScript correctness requires bottom-up ordering (Phase A → B → C → D → E → F → G).

---

## Phase A — Foundation: Types, Error Classes, Middleware

- [x] T001 [US1] Fix `BackofficeVariables` limit types from `number` to `number | null` in `apps/api/src/routes/backoffice/types.ts`
- [x] T002 [US1] Fix middleware limit context assignment to pass `number | null` (not string `'unlimited'`) in `apps/api/src/middleware/license-enforcement.ts`
- [x] T003 [US1] Extend `StudentError` class with optional `limit_value?: number` and `current_value?: number` constructor params in `packages/domain-core/src/students/students.errors.ts`
- [x] T004 [US1] Extend `StaffError` class with optional `limit_value?: number` and `current_value?: number` constructor params in `packages/domain-core/src/staff/staff.errors.ts`

---

## Phase B — Domain Signature Normalization

- [x] T005 [US2] Change `createStaff()` parameter `staffLimit: number` → `staffLimit: number | null` in `packages/domain-core/src/staff/staff.service.ts`
- [x] T006 [US2] Change `processBulkImport()` parameter `studentLimit: number` → `studentLimit: number | null` and update guard to `if (limit !== null && ...)` in `packages/domain-core/src/students/students.bulk-import.ts`
- [x] T007 [US2] Change `bulkImportStudents()` parameter `studentLimit: number` → `studentLimit: number | null` in `packages/domain-core/src/students/students.service.ts`

---

## Phase C — Enable Limit Checks (CRITICAL)

- [x] T008 [US3] Add SERIALIZABLE transaction + count-before-enable limit check to `enableStudent()` in `packages/domain-core/src/students/students.service.ts` — throw `StudentError('STUDENT_LIMIT_EXCEEDED', { limit_value, current_value })` when `limit !== null && count >= limit`; update function signature to accept `studentLimit: number | null`
- [x] T009 [US3] Add SERIALIZABLE transaction + count-before-enable limit check to `enableStaff()` in `packages/domain-core/src/staff/staff.service.ts` — switch from `db.query('BEGIN')` pool-level to `db.connect()` client-level SERIALIZABLE pattern; throw `StaffError('STAFF_LIMIT_EXCEEDED', { limit_value, current_value })` when `limit !== null && count >= limit`; update function signature to accept `staffLimit: number | null`

---

## Phase D — Route Handler Wiring

- [x] T010 [US4] Update `enable-student.ts` to read `studentLimit` from `c.get('student_limit')` and pass it to `enableStudent()` in `apps/api/src/routes/backoffice/students/enable-student.ts`
- [x] T011 [US4] Update `enable-staff.ts` to read `staffLimit` from `c.get('staff_limit')` and pass it to `enableStaff()` in `apps/api/src/routes/backoffice/staff/enable-staff.ts`
- [x] T012 [US4] Remove `?? 50` fallback in `create-staff.ts` — read `staffLimit` from `c.get('staff_limit')` directly (may be `null`) in `apps/api/src/routes/backoffice/staff/create-staff.ts`
- [x] T013 [US4] Fix null-unsafe limit read in `bulk-import-students.ts` — replace `c.get('license').student_limit` with `c.get('student_limit')` in `apps/api/src/routes/backoffice/students/bulk-import-students.ts`

---

## Phase E — Error Response Mapping

- [x] T014 [US5] Update `studentErrorResponse()` in `apps/api/src/routes/backoffice/students/helpers.ts` to map `STUDENT_LIMIT_EXCEEDED` error code to HTTP response code `LICENSE_LIMIT_REACHED` with `limit_value` and `current_value` metadata
- [x] T015 [US5] Update `staffErrorResponse()` in `apps/api/src/routes/backoffice/staff/helpers.ts` to map `STAFF_LIMIT_EXCEEDED` error code to HTTP response code `LICENSE_LIMIT_REACHED` with `limit_value` and `current_value` metadata

---

## Phase F — New Feature: Staff Bulk Import

- [x] T016 [US6] Add `StaffBulkImportRow`, `StaffBulkImportRowError`, and `StaffBulkImportResult` types to `packages/domain-core/src/staff/staff.types.ts`
- [x] T017 [US6] Add `bulkImportStaffRowSchema` (fields: email, name, password, role_id?) and `bulkImportStaffBodySchema` (rows array — no division_id) to `packages/validation/src/staff.schema.ts`
- [x] T018 [US6] Export `bulkImportStaffRowSchema`, `bulkImportStaffBodySchema`, and their inferred types from `packages/validation/src/index.ts`
- [x] T019 [US6] Create `packages/domain-core/src/staff/staff.bulk-import.ts` implementing `processStaffBulkImport(db, workspaceId, rows, staffLimit, audit)` — mirrors student pattern: SERIALIZABLE per batch, `countActiveStaff` + `findStaffByEmailForUpdate` + `insertStaff`, throws `StaffError('STAFF_LIMIT_EXCEEDED', ...)`, no divisionId param
- [x] T020 [US6] Add `bulkImportStaff()` service wrapper in `packages/domain-core/src/staff/staff.service.ts` that calls `processStaffBulkImport()`
- [x] T021 [US6] Create `apps/api/src/routes/backoffice/staff/bulk-import-staff.ts` implementing `handleBulkImportStaff()` route handler — validates body via `bulkImportStaffBodySchema`, reads `c.get('staff_limit')`, calls `bulkImportStaff()`, returns structured result
- [x] T022 [US6] Register `POST /bulk-import` route in `apps/api/src/routes/backoffice/staff/index.ts` and add export of `bulkImportStaff` to `packages/domain-core/src/staff/index.ts`

---

## Phase G — Tests

- [x] T023 [US7] Write unit tests for `enableStudent()`, `enableStaff()`, `processStaffBulkImport()`, `processBulkImport()` covering: unlimited (null) path allows enable, limit=0 blocks all, count-at-limit blocks, count-below-limit allows, correct error metadata in thrown error
- [x] T024 [US7] Write integration tests for `POST /backoffice/:workspace_slug/v1/staff/bulk-import` and verify `enableStudent`/`enableStaff` return 422/403 at limit

---

## Deferred Tasks

None.
