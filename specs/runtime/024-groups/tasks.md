# Tasks — STAGE_24_GROUPS

**Stage:** STAGE_24_GROUPS  
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Generated:** 2026-03-19  
**Status:** PENDING IMPLEMENTATION  
**Depends on:** STAGE_22_DIVISIONS, STAGE_23_DEPARTMENTS

Tasks are ordered by execution dependency. Tasks marked `[P]` within a phase group are safe to
execute in parallel because they have no inter-task dependencies within that group. A parallel
group must fully complete before the next sequential task begins.

---

## Phase 0 — Infrastructure (DB Schema + Migration)

> T001, T002, and T026 are parallel (no mutual dependency). T003 and T004 are parallel after T001+T002. T026 is fully independent and runs in parallel with T001–T004.

- [x] T001 [P] Define Drizzle ORM schema for `groups` table with soft-delete, status check, and FK to `departments` — `apps/api/src/db/tenant/schemas/groups.schema.ts`
- [x] T002 [P] Define Drizzle ORM schema for `staff_groups` join table with composite PK and cascade FKs — `apps/api/src/db/tenant/schemas/staff-groups.schema.ts`
- [x] T003 [P] Export `groups` and `staff-groups` schemas from the tenant schema barrel — `apps/api/src/db/tenant/schemas/index.ts`
- [x] T004 [P] Write forward-only migration 1.6.0 → 1.7.0: create `groups`, create `staff_groups`, add `students.group_id` FK, bump `schema_version` — `apps/api/src/db/tenant/migrations/20260319_001_groups.ts`
- [x] T026 [P] Add nullable `group_id` UUID FK column (`ON DELETE SET NULL`) and `groupIdIdx` index to existing Drizzle ORM students schema — `apps/api/src/db/tenant/schemas/students.schema.ts`

---

## Phase 1 — Domain Layer

> T005 and T006 are parallel (no mutual dependency). T007 depends on T005. T008 depends on T005,
> T006, and T007. T009 depends on T005–T008.

- [x] T005 [P] Define all TypeScript types and interfaces: `DbClient`, `AuditContext`, `GroupRow`, `StaffGroupRow`, input and output types for every service function — `packages/domain-core/src/groups/groups.types.ts`
- [x] T006 [P] Define `GroupsErrorCode` union type, HTTP status map, default messages map, and `GroupsError` class — `packages/domain-core/src/groups/groups.errors.ts`
- [x] T007 Define pure DB query functions: list, getById, create, update, softDelete; count students and staff; check exam and ads targets; student and staff assignment queries — `packages/domain-core/src/groups/groups.repository.ts`
- [x] T008 Implement all 9 domain service functions with transaction discipline, `SELECT FOR UPDATE` for `max_members`, SAVEPOINT deletion guards (AD-05), division mismatch checks (AD-06), and structured logging — `packages/domain-core/src/groups/groups.service.ts`
- [x] T009 Re-export all public Groups domain symbols as a public barrel — `packages/domain-core/src/groups/index.ts`
- [x] T027 Add `"./groups": "./src/groups/index.ts"` to the exports map so `@zidney/domain-core/groups` resolves correctly — `packages/domain-core/package.json`
- [x] T028 Add `export * as groups from './groups'` to the domain-core main barrel after the divisions export line — `packages/domain-core/src/index.ts`

---

## Phase 2 — Validation Layer

- [x] T010 Define Zod schemas for all Groups request bodies: create-group, update-group, assign-student, assign-staff — `packages/validation/src/backoffice/groups.schemas.ts`

---

## Phase 3 — API Routes

> T029 (helpers.ts) must be created first — all handlers (T011–T021) import from it. T011–T021 are
> parallel after T029 completes. T022 (router) depends on T011–T021.

- [x] T029 Implement shared route helpers: `getDb` (tenant pool access), `buildAuditCtx` (extract correlation/user fields from Hono context), `groupErrorResponse`, and `successResponse` utilities — `apps/api/src/routes/backoffice/groups/helpers.ts`

- [x] T011 [P] [US1] Implement `GET /groups` list handler with keyset pagination (`created_at, id`), `status` filter, and `department_id` filter — `apps/api/src/routes/backoffice/groups/list-groups.ts`
- [x] T012 [P] [US1] Implement `POST /groups` create handler with `department_id` existence check and case-insensitive name uniqueness enforcement — `apps/api/src/routes/backoffice/groups/create-group.ts`
- [x] T013 [P] [US2] Implement `GET /groups/:id` handler with soft-delete guard returning 404 `GROUP_NOT_FOUND` on miss — `apps/api/src/routes/backoffice/groups/get-group.ts`
- [x] T014 [P] [US2] Implement `PUT /groups/:id` partial update handler with conditional name uniqueness check, `department_id` validation, status toggling, and `updated_at = NOW()` — `apps/api/src/routes/backoffice/groups/update-group.ts`
- [x] T015 [P] [US3] Implement `DELETE /groups/:id` soft-delete handler with transactional student/staff count guards and SAVEPOINT-isolated exam/ads target guards — `apps/api/src/routes/backoffice/groups/delete-group.ts`
- [x] T016 [P] [US4] Implement `PUT /students/:studentId/group` student assignment handler with `SELECT FOR UPDATE` max_members check, division mismatch guard (AD-06), and atomic single-group update — `apps/api/src/routes/backoffice/groups/assign-student-group.ts`
- [x] T017 [P] [US4] Implement `DELETE /students/:studentId/group` student assignment removal handler with `GROUP_STUDENT_ASSIGNMENT_NOT_FOUND` guard — `apps/api/src/routes/backoffice/groups/remove-student-group.ts`
- [x] T018 [P] [US4] Implement `GET /students/:studentId/group` student group membership read handler returning group object or `data: null` — `apps/api/src/routes/backoffice/groups/get-student-group.ts`
- [x] T019 [P] [US5] Implement `POST /staff/:staffId/groups` idempotent staff assignment handler with `ON CONFLICT DO NOTHING`, disabled guard, and division mismatch guard (AD-06) — `apps/api/src/routes/backoffice/groups/assign-staff-group.ts`
- [x] T020 [P] [US5] Implement `DELETE /staff/:staffId/groups/:groupId` staff assignment removal handler with `GROUP_STAFF_ASSIGNMENT_NOT_FOUND` guard — `apps/api/src/routes/backoffice/groups/remove-staff-group.ts`
- [x] T021 [P] [US5] Implement `GET /staff/:staffId/groups` staff group membership list handler returning all groups a staff member is assigned to — `apps/api/src/routes/backoffice/groups/get-staff-groups.ts`
- [x] T022 Assemble Hono groups router `createGroupsRouter()` registering all 11 handlers with full middleware chain (`correlationId → tenantResolver → licenseEnforcement → schemaVersion → rateLimit → JWT auth → RBAC`) — `apps/api/src/routes/backoffice/groups/index.ts`

---

## Phase 4 — Router Registration

- [x] T023 Mount groups router at `/groups` within the Backoffice router — `apps/api/src/routes/backoffice/index.ts`

---

## Phase 5 — Tests

> T024 and T025 are parallel (unit tests and integration tests are independent).

- [x] T024 [P] Write unit tests for all Groups service functions: 30 scenarios covering list/create/update/delete, `max_members` enforcement (including `SELECT FOR UPDATE` concurrent path), SAVEPOINT deletion guards, division mismatch rejection, staff idempotency, and student single-group constraint — `packages/domain-core/src/groups/__tests__/groups.service.test.ts`
- [x] T025 [P] Write integration tests for all 11 Groups API endpoints: full middleware chain validation, RBAC permission checks, 409/422/404 error paths, keyset pagination correctness, concurrent student assignment race condition, and soft-delete visibility — `apps/api/src/routes/backoffice/groups/__tests__/groups.routes.test.ts`

---

Total tasks: 29
