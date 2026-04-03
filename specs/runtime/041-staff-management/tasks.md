# Tasks — Stage 41: Staff Management

**Stage**: `STAGE_41_STAFF_MANAGEMENT`  
**Phase**: `03_BACKOFFICE_CORE`  
**Tasks Generated**: 2026-04-03  
**Total Tasks**: 45

---

## GROUP A — Package Installation

- [x] T001 Install argon2 package in apps/api — `bun add argon2` inside `apps/api/`

---

## GROUP B — Database Layer

- [x] T002 Write migration `apps/api/src/db/tenant/migrations/20260404_020_staff_management.ts` — ALTER password_hash to text, ADD status VARCHAR(20) CHECK, ADD failed_login_count/locked_until/last_login, backfill status from is_active, CREATE staff_hierarchy_levels, bump schema to 1.26.0
- [x] T003 Update Drizzle schema `apps/api/src/db/tenant/schemas/backoffice-staff-users.schema.ts` — change passwordHash to text, add status, failedLoginCount, lockedUntil, lastLogin column definitions
- [x] T004 Create Drizzle schema `apps/api/src/db/tenant/schemas/staff-hierarchy-levels.schema.ts` — new pgTable with staffId, hierarchyNodeId, workspaceId, assignedAt and composite PK
- [x] T005 Update `apps/api/src/db/tenant/schemas/index.ts` — export staffHierarchyLevels from new schema file

---

## GROUP C — Domain-Core Auth Layer

- [x] T006 Create `packages/domain-core/src/auth/staff-password.ts` — hashStaffPassword (Argon2id, memoryCost:65536 timeCost:3 parallelism:4), verifyStaffPassword, generateStaffDummyHash (constant pre-computed string, no async)
- [x] T007 Update `packages/domain-core/src/auth/index.ts` — add named exports: generateStaffDummyHash, hashStaffPassword, verifyStaffPassword from './staff-password'

---

## GROUP C — Domain-Core Staff Module

- [x] T008 Create `packages/domain-core/src/staff/staff.types.ts` — DbClient interface, StaffStatus, StaffRow (all columns), StaffRecord (no password_hash), CreateStaffInput, UpdateStaffInput, StaffListQuery, StaffListResult, AuditContext
- [x] T009 Create `packages/domain-core/src/staff/staff.errors.ts` — StaffErrorCode union type, STAFF_ERROR_HTTP map (all 6 codes), StaffError class extending Error with code and httpStatus
- [x] T010 Create `packages/domain-core/src/staff/staff.repository.ts` — raw SQL functions: findStaffByEmailForUpdate, findStaffById, countActiveStaff, insertStaff, updateStaff, updateStaffStatus, softDeleteStaff, listStaff (keyset pagination), checkAuthoredContent
- [x] T011 Create `packages/domain-core/src/staff/staff.service.ts` — createStaff (SERIALIZABLE, limit check FOR UPDATE, hash via hashStaffPassword), listStaff, getStaffById, updateStaff, disableStaff, enableStaff, deleteStaff — each with proper transaction discipline and both status+is_active sync
- [x] T012 Create `packages/domain-core/src/staff/index.ts` — barrel exports from staff.errors, staff.service, staff.types (all public types except StaffRow and DbClient internals)
- [x] T013 Update `packages/domain-core/src/index.ts` — add `export * as staff from './staff'` after the teams export

---

## GROUP D — Validation Layer

- [x] T014 Create `packages/validation/src/staff.schema.ts` — createStaffBodySchema (email/name/password/role_id/division_ids), updateStaffBodySchema (name|email|division_ids min 1 field refine), staffListQuerySchema (page/limit/status/division_id/search), staffIdParamsSchema (uuid)
- [x] T015 Update `packages/validation/src/index.ts` — export createStaffBodySchema, staffIdParamsSchema, staffListQuerySchema, updateStaffBodySchema from './staff.schema'

---

## GROUP E — API Route Layer

- [x] T016 Create `apps/api/src/routes/backoffice/staff/helpers.ts` — getDb(c), buildAuditCtx(c), staffErrorResponse(c, err) mapping StaffError codes to HTTP status using STAFF_ERROR_HTTP, isValidUuid(value)
- [x] T017 Create `apps/api/src/routes/backoffice/staff/create-staff.ts` — handleCreateStaff: validate createStaffBodySchema, read staff_limit from context, call createStaff service, return 201 StaffRecord
- [x] T018 Create `apps/api/src/routes/backoffice/staff/list-staff.ts` — handleListStaff: validate staffListQuerySchema, call listStaff service, return 200 StaffListResult
- [x] T019 Create `apps/api/src/routes/backoffice/staff/get-staff.ts` — handleGetStaff: validate staffIdParamsSchema, call getStaffById service, return 200 StaffRecord
- [x] T020 Create `apps/api/src/routes/backoffice/staff/update-staff.ts` — handleUpdateStaff: validate staffIdParamsSchema + updateStaffBodySchema, call updateStaff service, return 200 StaffRecord
- [x] T021 Create `apps/api/src/routes/backoffice/staff/disable-staff.ts` — handleDisableStaff: validate staffIdParamsSchema, call disableStaff service, return 200 StaffRecord
- [x] T022 Create `apps/api/src/routes/backoffice/staff/enable-staff.ts` — handleEnableStaff: validate staffIdParamsSchema, call enableStaff service, return 200 StaffRecord
- [x] T023 Create `apps/api/src/routes/backoffice/staff/delete-staff.ts` — handleDeleteStaff: validate staffIdParamsSchema, call deleteStaff service, return 204 empty body
- [x] T024 Create `apps/api/src/routes/backoffice/staff/index.ts` — Hono router composition with all 7 routes in correct registration order (PATCH /disable before PATCH /enable before DELETE before GET/:id before PUT/:id before POST before GET), with RBAC guards
- [x] T025 Update `apps/api/src/routes/auth/backoffice-login.ts` — replace FROM users query with JOIN backoffice_staff_users + backoffice_roles; replace verifyPassword/generateDummyHash with verifyStaffPassword/generateStaffDummyHash; replace is_active check with status='ACTIVE'; update all UPDATE statements to target backoffice_staff_users; update JWT role claim to use role_name from JOIN
- [x] T026 Update `apps/api/src/app.ts` — add import `import { staffRouter } from './routes/backoffice/staff/index'` and add `app.route('/api/v1/backoffice/workspace', staffRouter)`
- [x] T027 Delete `apps/api/src/routes/backoffice/users.ts` — dead code (449 lines, not registered in app.ts, queries legacy users table)

---

## GROUP F — Tests

- [x] T028 [P] Create `apps/api/src/routes/backoffice/staff/__tests__/staff.crud.test.ts` — POST /staff (success 201, email conflict 409, limit exceeded 403, validation error 422), GET /staff (success 200 with pagination and filters), GET /staff/:id (found 200, not found 404), PUT /staff/:id (success 200, not found 404, email conflict 409), PATCH disable (success 200, already disabled 409, not found 404), PATCH enable (success 200, already active 409, not found 404), DELETE (success 204, not found 404, authored content 409)
- [x] T029 [P] Create `apps/api/src/routes/backoffice/staff/__tests__/staff.isolation.test.ts` — staff from workspace A not visible from workspace B for GET/PATCH/DELETE operations, cross-tenant PATCH/DELETE returns 404, password hash never in response body
- [x] T030 [P] Create `apps/api/src/routes/backoffice/staff/__tests__/staff.limit.test.ts` — at exact staff_limit POST returns 403 STAFF_LIMIT_EXCEEDED, at limit-1 POST succeeds, disabled staff not counted toward limit, concurrent limit enforcement under SERIALIZABLE isolation

---

## GROUP G — Drizzle schema index (ensure export is complete)

- [x] T031 Verify `apps/api/src/db/tenant/schemas/index.ts` exports are correct after T005 — run typecheck to confirm no missing schema exports

---

## GROUP H — Typecheck + Lint Pass

- [x] T032 Run `bun run typecheck` in workspace root — confirm zero TypeScript errors
- [x] T033 Run `bun run lint` (or `biome check .`) in workspace root — confirm zero Biome errors

---

## GROUP I — Test Execution

- [x] T034 Run `bun run test` to execute all 3 staff test files — confirm all assertions pass

---

## SUMMARY

| Group     | Description       | Task IDs  | Count  |
| --------- | ----------------- | --------- | ------ |
| A         | Package Install   | T001      | 1      |
| B         | Database Layer    | T002–T005 | 4      |
| C         | Domain-Core Auth  | T006–T007 | 2      |
| C         | Domain-Core Staff | T008–T013 | 6      |
| D         | Validation        | T014–T015 | 2      |
| E         | API Routes        | T016–T027 | 12     |
| F         | Tests             | T028–T030 | 3      |
| G         | Schema Validation | T031      | 1      |
| H         | Quality Gates     | T032–T033 | 2      |
| I         | Test Execution    | T034      | 1      |
| **Total** |                   |           | **34** |
