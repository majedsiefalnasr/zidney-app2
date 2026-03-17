# Tasks — Departments

**Stage:** Departments  
**Step:** 4 — Tasks  
**Total:** 30 tasks  
**Generated:** 2026-03-17

---

## Group 1 — Data Layer

- [x] T001 Create migration file with `BEGIN`/`COMMIT` block: departments table + all indexes, staff_departments table + index, students.department_id column + FK + index, schema_version bump `1.5.0` → `1.6.0` — `apps/api/src/db/tenant/migrations/20260317_001_departments.ts`
- [x] T002 Create departments Drizzle schema: all columns, `parent_id` self-reference via `(): AnyPgColumn =>` deferred lambda (`onDelete: 'restrict'`), `division_id` FK (`onDelete: 'restrict'`), 4 Drizzle indexes (no `uniqueIndex()` — functional composite index is migration-owned), exports `Department` and `NewDepartment` types — `apps/api/src/db/tenant/schemas/departments.schema.ts`
- [x] T003 Create staff_departments Drizzle schema: composite PK via `primaryKey({ columns: [table.staff_id, table.department_id] })`, `staff_id` FK → `backoffice_staff_users` (`onDelete: 'cascade'`), `department_id` FK → `departments` (`onDelete: 'cascade'`), `idx_staff_departments_department_id` index, exports `StaffDepartment` and `NewStaffDepartment` types — `apps/api/src/db/tenant/schemas/staff-departments.schema.ts`
- [x] T004 Update students schema: add `import { departments } from "./departments.schema"`, add `department_id` nullable UUID FK column (`references(() => departments.id, { onDelete: 'setNull' })`), add `departmentIdIdx` index — `apps/api/src/db/tenant/schemas/students.schema.ts`
- [x] T005 Update schema barrel: add `export * from "./departments.schema"` and `export * from "./staff-departments.schema"` — `apps/api/src/db/tenant/schemas/index.ts`

---

## Group 2 — Domain Package

- [x] T006 Create departments errors file: `DepartmentsErrorCode` union type (10 codes), `DEPARTMENTS_ERROR_HTTP_STATUS` map (404/409/422 per code), `DepartmentsError` class extending `Error` with `.httpStatus`, `.code`, `.message` — `packages/domain-core/src/departments/departments.errors.ts`
- [x] T007 Create departments types file: `DbClient` interface, `AuditContext` interface, `DepartmentStatus` enum (`ENABLED`/`DISABLED`), `DepartmentType` enum (`MAIN`/`SUB`/`SIMPLE`), `DepartmentRow`, `DepartmentTreeNode`, `StaffDepartmentRow` interfaces, `CreateDepartmentInput`, `UpdateDepartmentInput`, `ListDepartmentsInput`, `ListDepartmentsResult` types — `packages/domain-core/src/departments/departments.types.ts`
- [x] T008 Create departments service with all 10 functions: `listDepartments` (keyset pagination + filters), `getDepartment`, `createDepartment` (steps 1–6 including division_id existence check at step 2), `updateDepartment` (steps 1–7 including division_id existence check at step 2, recursive CTE cycle detection at step 3), `deleteDepartment` (children + student + staff assignment guards), `getDepartmentChildren`, `getDepartmentTree` (flat fetch + O(n) in-app `Map` tree build), `getStaffDepartments`, `assignStaffDepartment` (ON CONFLICT DO NOTHING — idempotent), `removeStaffDepartment`, `checkDepartmentCapacity` (SELECT FOR UPDATE); all logging via `createLogger('backoffice-departments')` — `packages/domain-core/src/departments/departments.service.ts`
- [x] T009 Create departments domain barrel: re-export from errors, service, and selective named exports from types (`AuditContext`, `CreateDepartmentInput`, `DepartmentStatus`, `DepartmentType`, `DepartmentRow`, `DepartmentTreeNode`, `ListDepartmentsInput`, `ListDepartmentsResult`, `StaffDepartmentRow`, `UpdateDepartmentInput`) — `packages/domain-core/src/departments/index.ts`
- [x] T010 Update domain-core root barrel: add `export * from "./departments"` — `packages/domain-core/src/index.ts`
- [x] T011 Update domain-core package.json exports: add `"./departments"` subpath entry with `import` and `types` pointing to `./src/departments/index.ts` (mirror the existing `"./divisions"` pattern) — `packages/domain-core/package.json`

---

## Group 3 — Validation

- [x] T012 Create departments validation schemas file with all 8 Zod schemas: `listDepartmentsQuerySchema` (limit, cursor, status, division_id, parent_id, type), `createDepartmentBodySchema` (name min(1) max(255) no-control-chars, type enum, optional parent_id/division_id/max_users/description), `updateDepartmentBodySchema` (all fields optional), `getDepartmentParamsSchema` (id UUID), `deleteDepartmentParamsSchema` (id UUID), `staffDepartmentsParamsSchema` (staffId UUID), `assignStaffDepartmentBodySchema` (department_id UUID), `removeStaffDepartmentParamsSchema` (staffId + departmentId UUIDs) — `packages/validation/src/departments/departments.validation.ts`
- [x] T013 Update validation barrel: add departments schema exports — `packages/validation/src/index.ts`

---

## Group 4 — API Routes

- [x] T014 Create route helpers: `getDb(c)` returning `c.get('tenant').pool`, `buildAuditCtx(c)` returning `AuditContext` (user_id, correlation_id, workspace_slug, workspace_id), `departmentErrorResponse(c, err)` mapping all 10 `DepartmentsErrorCode` values to correct HTTP status codes + JSON envelope, unknown errors → 500; `isValidUuid(s)` UUID guard — `apps/api/src/routes/backoffice/departments/helpers.ts`
- [x] T015 [P] [US2] Create list-departments handler: `GET /departments`, RBAC `ACADEMIC_STRUCTURE can_view`, validates query with `listDepartmentsQuerySchema`, calls `listDepartments(db, input)`, returns 200 with `{ items, nextCursor, total }` — `apps/api/src/routes/backoffice/departments/list-departments.ts`
- [x] T016 [P] [US1] Create create-department handler: `POST /departments`, RBAC `ACADEMIC_STRUCTURE can_create`, validates body with `createDepartmentBodySchema`, calls `createDepartment(db, input, audit)`, returns 201 with created department — `apps/api/src/routes/backoffice/departments/create-department.ts`
- [x] T017 [P] [US2] Create get-department handler: `GET /departments/:id`, RBAC `ACADEMIC_STRUCTURE can_view`, validates params with `getDepartmentParamsSchema`, calls `getDepartment(db, id)`, returns 200 with department row — `apps/api/src/routes/backoffice/departments/get-department.ts`
- [x] T018 [P] [US3] Create update-department handler: `PUT /departments/:id`, RBAC `ACADEMIC_STRUCTURE can_edit`, validates params (`getDepartmentParamsSchema`) + body (`updateDepartmentBodySchema`), calls `updateDepartment(db, id, input, audit)`, returns 200 with updated department — `apps/api/src/routes/backoffice/departments/update-department.ts`
- [x] T019 [P] [US5] Create delete-department handler: `DELETE /departments/:id`, RBAC `ACADEMIC_STRUCTURE can_delete`, validates params with `deleteDepartmentParamsSchema`, calls `deleteDepartment(db, id, audit)`, returns 200 with `{ deleted: true }` — `apps/api/src/routes/backoffice/departments/delete-department.ts`
- [x] T020 [P] [US6] Create children-department handler: `GET /departments/:id/children`, RBAC `ACADEMIC_STRUCTURE can_view`, validates params with `getDepartmentParamsSchema`, calls `getDepartmentChildren(db, id)`, returns 200 with `{ items: DepartmentRow[] }` — `apps/api/src/routes/backoffice/departments/children-department.ts`
- [x] T021 [P] [US6] Create tree-departments handler: `GET /departments/tree`, RBAC `ACADEMIC_STRUCTURE can_view`, no params validation required, calls `getDepartmentTree(db)`, returns 200 with `{ tree: DepartmentTreeNode[] }` — `apps/api/src/routes/backoffice/departments/tree-departments.ts`
- [x] T022 [P] [US7] Create staff-departments handler file with 3 handlers: `handleGetStaffDepartments` (`GET /staff/:staffId/departments`, RBAC `can_view`, calls `getStaffDepartments`), `handleAssignStaffDepartment` (`POST /staff/:staffId/departments`, RBAC `can_edit`, validates `staffDepartmentsParamsSchema` + `assignStaffDepartmentBodySchema`, calls `assignStaffDepartment`), `handleRemoveStaffDepartment` (`DELETE /staff/:staffId/departments/:departmentId`, RBAC `can_edit`, validates `removeStaffDepartmentParamsSchema`, calls `removeStaffDepartment`) — `apps/api/src/routes/backoffice/departments/staff-departments.ts`
- [x] T023 Create router barrel: registers all routes in correct order — `GET /departments` → `GET /departments/tree` → `GET /departments/:id/children` → `GET /departments/:id` → `POST /departments` → `PUT /departments/:id` → `DELETE /departments/:id` → `GET /staff/:staffId/departments` → `POST /staff/:staffId/departments` → `DELETE /staff/:staffId/departments/:departmentId`; exports `departmentsRouter`; `/departments/tree` MUST be registered before `/:id` — `apps/api/src/routes/backoffice/departments/index.ts`

---

## Group 5 — Route Registration

- [x] T024 Update app.ts: add `import { departmentsRouter } from "./routes/backoffice/departments/index"` and `app.route("/api/v1/backoffice/workspace", departmentsRouter)` alongside the existing divisions mount — `apps/api/src/app.ts`

---

## Group 6 — Tests

- [x] T025 [P] Create domain service unit tests covering: cycle detection (6 cases — allows valid reparent, rejects direct/3-level descendant cycles, skips check for null parent_id / absent parent_id / create), `checkDepartmentCapacity` (4 cases — count < max, null max_users, count === max, count > max), division consistency on create (4 cases) and update reparent (1 case), name uniqueness (3 cases — case-insensitive same-parent rejection, same-name different-parents, root vs. under-parent), `assignStaffDepartment` status guard (2 cases), `deleteDepartment` guards (4 cases) — `packages/domain-core/src/departments/__tests__/departments.service.test.ts`
- [x] T026 [P] [US1] [US2] [US3] [US4] [US5] Create departments CRUD integration tests: POST creates top-level (201) and nested (201) departments, 409 duplicate name, 422 division mismatch, 422 missing fields, 404 DEPARTMENT_NOT_FOUND when parent_id UUID does not exist; GET list returns all with correct fields, filters by status/division_id/parent_id/type; GET /:id returns 200 / 404 for unknown id; PUT /:id updates name (200), 409 duplicate name, 422 circular reference, 422 division mismatch, PUT with parent_id=null reparents to root (200 with parent_id=null in response); DELETE /:id succeeds (200), 422 has-children, 422 has-student-assignments, 422 has-staff-assignments, DELETE same id twice returns 404 (idempotent); cross-tenant isolation: seed department in tenant-A workspace, assert tenant-B authenticated request to GET /departments returns empty list (no tenant-A data leaks) — `tests/api/departments/departments-crud.test.ts`
- [x] T027 [P] [US6] Create departments hierarchy integration tests: GET /departments/tree returns 3-level nested structure; GET /departments/:id/children returns only direct children (not grandchildren); GET /departments/:id/children returns empty list for leaf node; verify /tree route resolves before /:id (no UUID parse error for literal 'tree') — `tests/api/departments/departments-hierarchy.test.ts`
- [x] T028 [P] [US7] Create staff-departments integration tests: GET /staff/:staffId/departments returns assigned list; POST assigns staff to department (200), is idempotent on duplicate assign (no error, 200); 422 DEPARTMENT_DISABLED on assign to disabled department; 422 DEPARTMENT_DIVISION_MISMATCH when department division not in staff's divisions; DELETE removes assignment (200); 404 on removing non-existent assignment — `tests/api/departments/departments-staff.test.ts`
- [x] T029 [P] [US8] Create departments concurrent domain-unit tests (service layer, not HTTP layer — `checkDepartmentCapacity` has no HTTP endpoint in Stage 23): `max_users = 2` with one existing assignment — run `checkDepartmentCapacity` concurrently from two parallel DB clients, verify `SELECT … FOR UPDATE` serializes access and exactly one returns `DEPARTMENT_MAX_USERS_EXCEEDED`; `max_users = null` — concurrent calls return without error; `max_users` reduced below current assignment count — next call throws `DEPARTMENT_MAX_USERS_EXCEEDED` — `packages/domain-core/src/departments/__tests__/departments-concurrent.test.ts`
- [x] T030 [P] Create departments auth/RBAC integration tests: all 10 endpoints without JWT return 401; staff without any ACADEMIC_STRUCTURE permission attempting GET /departments returns 403; `can_view` role attempting POST /departments returns 403 Forbidden; `can_view` role attempting PUT /:id returns 403; `can_view` role attempting DELETE /:id returns 403; `can_view` role attempting POST /staff/:staffId/departments returns 403; `can_view` role attempting DELETE /staff/:staffId/departments/:departmentId returns 403; `can_edit` role can successfully call all write endpoints (200/201); SOFT_LOCKED workspace returns 423 on any endpoint; ARCHIVED workspace returns 403 on any endpoint — `tests/api/departments/departments-auth.test.ts`
