# Tasks: STAGE_21 — Role & Permission System

**Branch**: `021-role-permission-system`  
**Date**: 2026-03-02  
**Phase 2 output of** `/speckit.tasks`  
**Stage**: `STAGE_21_ROLE_PERMISSION_SYSTEM`  
**Phase**: `03_BACKOFFICE_CORE / 01_FOUNDATION`  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md) | **Contracts**: [contracts/api-contracts.md](./contracts/api-contracts.md)

---

## Stage Status

IN PROGRESS

---

## Constitution Gate

| Rule                                | Status |
| ----------------------------------- | ------ |
| Database-per-tenant                 | ✓ PASS |
| No cross-tenant access              | ✓ PASS |
| License middleware prerequisite     | ✓ PASS |
| No global DB singleton              | ✓ PASS |
| Transaction boundaries respected    | ✓ PASS |
| Audit log within same transaction   | ✓ PASS |
| Attempt engine untouched            | ✓ PASS |
| No forward-only migration violation | ✓ PASS |
| No frontend enforcement             | ✓ PASS |
| JWT workspace_id assertion          | ✓ PASS |
| Structured logging                  | ✓ PASS |

---

## Stage Context

- **Phase**: `03_BACKOFFICE_CORE / 01_FOUNDATION`
- **Stage**: `STAGE_21_ROLE_PERMISSION_SYSTEM`
- **Related Plan**: `specs/runtime/021-role-permission-system/plan.md`
- **Related Spec**: `specs/runtime/021-role-permission-system/spec.md`
- **Related ADR**: None (no ADR exception required per spec)
- **Schema Version Transition**: `1.3.0 → 1.4.0`

Tasks MUST NOT extend beyond this stage scope.

---

## User Stories Summary

| Story | Priority | Goal                                             | Independent Test Criteria                                                         |
| ----- | -------- | ------------------------------------------------ | --------------------------------------------------------------------------------- |
| US1   | P1       | Role CRUD + permission assignment (domain layer) | Create role, assign permissions, verify evaluatePermission() output               |
| US2   | P1       | Disabled role revokes access immediately         | Add guard middleware; verify disabled role returns 403 on next request            |
| US3   | P1/P2    | API endpoints for role management                | Full CRUD flow; 409/422/403 error cases; serialized delete                        |
| US4   | P3       | Frontend display of role/permission data         | Render roles list, detail, create pages; `can()` composable is no-op for security |
| US5   | Cross    | Test coverage: unit + integration                | All test files pass; no partial-write scenarios left untested                     |

---

## Dependency Order

```
Phase 1 (Setup)
  T001 → T002, T003, T004, T005 [parallel: schema files independent of each other]
       ↓
Phase 2 (Foundational)
  T006 (route-permission-registry — API utility; unblocks guard and routes)
       ↓
Phase 3 (US1 — Domain Package)
  T007 (rbac.types — foundation for service + audit)
  → T008, T009, T010 [parallel: service, audit, permission-registry all depend on types]
  → T011 (index.ts re-export — depends on T007–T010 all existing)
       ↓
Phase 4 (US2 — Middleware)
  T012 (backoffice-permission-guard-v2 — depends on T006 registry + T008–T011 domain)
       ↓
Phase 5 (US3 — API Endpoints)
  T013 (roles.ts — depends on T012 guard + T011 domain exports)
  → T014 (register routes — depends on T013)
       ↓
Phase 6 (US4 — Frontend) [all parallel; depend on T013 API being defined]
  T015, T016, T017, T018

Phase 7 (US5 — Tests) [all parallel; depend on T007–T014 being complete]
  T019, T020, T021
```

---

## Phase 1: Setup — Database Foundation

**Goal**: Establish all DB schema changes and Drizzle ORM definitions required by every later phase.  
**Blocking**: All subsequent phases depend on T001 migration being correct.

- [ ] T001 Create tenant migration file with all STAGE_21 DDL in a single transaction: ALTER backoffice_roles (add status), CREATE backoffice_role_module_permissions, ALTER backoffice_staff_users (add role_id FK + division_ids), CREATE rbac_audit_logs (with immutability trigger), UPDATE schema_version 1.3.0→1.4.0, down() throws in `apps/api/src/db/tenant/migrations/20260302_001_rbac_role_permissions_complete.ts`
- [ ] T002 [P] Create Drizzle schema for the new boolean-flags permissions table (pgTable with id, role_id FK, module varchar, can_view/create/edit/delete booleans, timestamps; uniqueIndex on role_id+module; idx_brmp_role_id, idx_brmp_role_module) in `apps/api/src/db/tenant/schemas/backoffice-role-module-permissions.schema.ts`
- [ ] T003 [P] Create Drizzle schema for the new immutable RBAC audit table (pgTable with id, user_id, role_id, module, action, request_id, workspace_slug, timestamp, is_immutable, metadata; idx_rbac_al_role_id, idx_rbac_al_user_id, idx_rbac_al_timestamp; export RBAC_AUDIT_ACTIONS const and RbacAuditAction type) in `apps/api/src/db/tenant/schemas/rbac-audit-logs.schema.ts`
- [ ] T004 [P] Update existing Drizzle schema to add `status` VARCHAR(20) column with CHECK constraint ('ACTIVE'|'DISABLED'), NOT NULL DEFAULT 'ACTIVE', and BackofficeRole + NewBackofficeRole type exports in `apps/api/src/db/tenant/schemas/backoffice-roles.schema.ts`
- [ ] T005 [P] Update existing Drizzle schema to add `role_id` nullable UUID FK referencing backoffice_roles (onDelete: set null) and `division_ids` UUID[] NOT NULL DEFAULT '{}' columns; add idx_bsu_role_id index in `apps/api/src/db/tenant/schemas/backoffice-staff-users.schema.ts`

---

## Phase 2: Foundational — Route Permission Registry

**Goal**: Create the authoritative route→(module,action) registry that both the permission guard and validation layer depend on. Must exist before any guard or route file is authored.  
**Blocking**: T012 (guard) and T013 (routes) both import from this file.

- [ ] T006 Create the API-layer route permission registry as a **thin re-export shim** over the domain registry (T010 is the single source of truth); export ROUTE_PERMISSION_REGISTRY Record mapping "METHOD /path" → {module, action} for all 9 backoffice role routes; export PUBLIC_ROUTES Set; export lookupPermission(method, path) utility by re-exporting from `packages/domain-core/src/rbac/permission-registry.ts`; fail-closed: unregistered non-public routes resolve to undefined; **adding new routes requires updating T010 only — this file re-exports** in `apps/api/src/middleware/route-permission-registry.ts`

---

## Phase 3: US1 — Domain Package (RBAC Business Logic)

**Goal**: Implement all pure-function business logic for role CRUD, permission evaluation, and audit logging with no HTTP dependencies.  
**Independent Test Criteria**: Call `evaluatePermission()` with a fully constructed `PermissionGuardContext`; verify deny-by-default when role is null, disabled, or permission row is absent; verify correct flag evaluation when row exists.

- [ ] T007 [US1] Create TypeScript types: RoleStatus enum ('ACTIVE'|'DISABLED'), PermissionModule enum (all 10 module keys), PermissionAction type ('can_view'|'can_create'|'can_edit'|'can_delete'), PermissionFlags interface, RoleWithPermissions interface, PermissionGuardContext interface, RbacAuditEntry interface in `packages/domain-core/src/rbac/rbac.types.ts`
- [ ] T008 [P] [US1] Implement pure RBAC service functions: createRole, getRoleById, listRoles, updateRole, deleteRole (with Drizzle typed `.select({ id: backofficeRoles.id }).from(backofficeRoles).where(eq(backofficeRoles.id, roleId)).for('update')` — do NOT use raw SQL strings), updateRolePermissions (full-replace semantics), assignRoleToStaffUser, getRolePermissions, evaluatePermission — all accept db connection param, no HTTP logic, all writes transactional with co-transactional rbac_audit_logs INSERT in `packages/domain-core/src/rbac/rbac.service.ts`
- [ ] T009 [P] [US1] Implement writeRbacAuditLog function: accepts db connection + audit payload (user_id, role_id, module, action, request_id, workspace_slug, metadata?), inserts into rbac_audit_logs within the caller's transaction, validates action against RBAC_AUDIT_ACTIONS allowlist, never throws on immutability trigger (logs ERROR instead) in `packages/domain-core/src/rbac/rbac.audit.ts`
- [ ] T010 [P] [US1] Implement ROUTE_PERMISSION_REGISTRY static map (**SINGLE SOURCE OF TRUTH — T006 re-exports from this file**), PUBLIC_ROUTES Set, and lookupPermission(method: string, path: string): {module: PermissionModule, action: PermissionAction} | null utility function; returns null for public routes and unregistered paths (fail-closed); all 9 role route entries must be present and module keys must match PermissionModule enum values in `packages/domain-core/src/rbac/permission-registry.ts`
- [ ] T011 [US1] Add rbac module barrel export (types, service, audit, permission-registry) to the domain-core package public API in `packages/domain-core/src/index.ts`

---

## Phase 4: US2 — API Permission Guard Middleware

**Goal**: Implement the server-side enforcement layer that executes the full 10-step permission evaluation chain on every protected Backoffice route.  
**Independent Test Criteria**: Mount guard on a test route; confirm disabled role → 403, null role_id → 403, workspace_id mismatch → 403 (WARN log), missing permission row → 403, correct permission → passes to handler.

- [ ] T012 [US2] Implement createPermissionGuard(logger, module, action) factory starting at step 2 (workspace_id assertion is already performed by the chain-level `workspace-id-assertion` middleware before the guard executes — do NOT duplicate in guard to avoid double WARN log): (1) load backoffice_staff_users by jwt.sub — not found → 403, (2) check is_active === true — false → 403, (3) check role_id != null — null → 403, (4) load backoffice_roles by role_id — not found → 403, (5) check role.status === 'ACTIVE' — not active → 403, (6) load backoffice_role_module_permissions for (role_id, module) — check per-request Map cache then Redis rbac_v2:{workspace_id}:{user_id}:{module}:{action} TTL 30s using SCAN cursor for wildcard invalidation (not KEYS to avoid O(N) Redis blocking), (7) check permission[action] === true — false/absent → 403; all 403s use {code:'FORBIDDEN',message:'Access denied'}; denied requests logged at WARN with correlation_id, user_id, module, action, workspace_slug, workspace_id; cache invalidation on mutation: synchronous Redis SCAN+DEL rbac_v2:{workspace_id}:\* before commit, log ERROR if fails, do not abort transaction in `apps/api/src/middleware/backoffice-permission-guard-v2.ts`

---

## Phase 5: US3 — API Route Handlers

**Goal**: Implement all 9 Backoffice role management endpoints wired to the permission guard and domain services.  
**Independent Test Criteria**: POST /roles → 201; GET /roles → paginated list; PATCH /roles/:id status=DISABLED → 200; DELETE /roles/:id with active user → 409; PATCH /staff/:userId/role with disabled role → 422.

- [ ] T013 [US3] Implement all 9 route handlers: POST /roles (createRole + initial permissions in single tx, 409 on duplicate name, 422 on invalid module), GET /roles (paginated, filterable by status), GET /roles/:id (full permission matrix, 404 on missing), PATCH /roles/:id (update name/description/status + cache invalidation, 409 on name conflict), PUT /roles/:id/permissions (full-replace + cache invalidation), DELETE /roles/:id (SELECT FOR UPDATE + active-user count guard, 409 on ROLE_HAS_ACTIVE_USERS, 204 on success), GET /roles/:id/users (paginated, never returns password_hash or token_version), PATCH /staff/:userId/role (422 on disabled role, 404 on missing user/role), GET /role-permission-modules (static module list); all wired through createPermissionGuard per ROUTE_PERMISSION_REGISTRY; all mutation responses include audit log in same tx in `apps/api/src/routes/backoffice/roles.ts`
- [ ] T014 [US3] Register all STAGE_21 role routes on the backoffice Hono router (import roles.ts handlers, mount with correlationId→tenantResolver→licenseMiddleware→auth-jwt middleware chain prefix); verify no routes are left unregistered in ROUTE_PERMISSION_REGISTRY in `apps/api/src/routes/backoffice/index.ts`

---

## Phase 6: US4 — Frontend Role Management Pages (Display-Only)

**Goal**: Implement display-only role management UI using shadcn-vue components. Zero permission enforcement on client.  
**Independent Test Criteria**: Roles list page renders Table with Switch toggle; Role detail page renders permission matrix with Checkbox grid; Create page submits POST /roles; usePermission.can() returns false for missing module (NEVER used for security gate).

- [ ] T015 [P] [US4] Implement display-only usePermission composable: fetchPermissions() calls GET /api/backoffice/context and populates local permissions ref, can(module, action) returns permissions.value[module]?.[`can_${action}`] ?? false; add JSDoc warning that can() MUST NOT be used for security decisions; all enforcement is server-side only in `apps/backoffice/src/composables/usePermission.ts`
- [ ] T016 [P] [US4] Implement roles list page: fetch GET /api/backoffice/roles on mount, render paginated list using shadcn-vue Table component with columns (name, status, created_at, actions); use shadcn-vue Switch component for inline status toggle (PATCH /roles/:id); show 403 access-denied state when API returns forbidden in `apps/backoffice/src/pages/roles/RolesListPage.vue`
- [ ] T017 [P] [US4] Implement role detail page: fetch GET /api/backoffice/roles/:id on mount, display role metadata and full permission matrix as a 10-row × 4-col grid using shadcn-vue Checkbox components (one row per module, columns: can_view/create/edit/delete); submit changes via PUT /api/backoffice/roles/:id/permissions; show loading and error states in `apps/backoffice/src/pages/roles/RoleDetailPage.vue`
- [ ] T018 [P] [US4] Implement create role page: form with shadcn-vue Input for name and description; permission matrix using shadcn-vue Checkbox grid (same layout as detail page) with all flags defaulting to false; submit via POST /api/backoffice/roles; handle 409 ROLE_NAME_CONFLICT and 422 INVALID_MODULE inline form errors; redirect to role detail on success in `apps/backoffice/src/pages/roles/CreateRolePage.vue`

---

## Phase 7: US5 — Tests

**Goal**: Ensure all critical paths, error branches, concurrency guards, and isolation boundaries are verified.  
**Independent Test Criteria**: All test files run without errors; no partial-write scenarios remain untested; isolation assertions pass (cross-tenant access blocked).

- [ ] T019 [P] [US5] Write unit tests for domain service: evaluatePermission() with null role_id → deny; disabled role → deny; is_active=false → deny; **StaffUser not found → deny** (step 4 branch); missing permission row → deny; can_view=true but can_create=false → deny create allow view; all flags false → deny all; createRole with duplicate name → throws ROLE_NAME_CONFLICT; deleteRole with active users → throws ROLE_HAS_ACTIVE_USERS; writeRbacAuditLog with invalid action → throws; **mid-mutation DB failure simulation → assert full rollback (no orphan roles row AND no orphan audit row) (SC-005)**; audit log rollback on tx failure in `tests/unit/rbac/rbac.service.test.ts`
- [ ] T020 [P] [US5] Write integration tests for API routes: full CRUD flow (POST→GET→PATCH→DELETE); POST /roles duplicate name returns 409; POST /roles with invalid module returns 422; DELETE /roles/:id with active user returns 409; concurrent DELETE requests serialize via SELECT FOR UPDATE (second returns 404 after first commits); PATCH /roles/:id status=DISABLED causes assigned user's next request to return 403; **revoke can_delete flag via PUT /roles/:id/permissions then verify next DELETE attempt returns 403 (SC-003 end-to-end permisson revocation)**; PUT /roles/:id/permissions cache invalidated synchronously; PATCH /staff/:userId/role with disabled role returns 422; **re-assign same role twice is no-op (idempotency)**; **upsert same permission row (no duplicate row, idempotency)**; **re-disable already-disabled role is safe (idempotency)**; role from TenantA not accessible from TenantB context; **present TenantA JWT against TenantB resolved context → 403 + WARN log with jwt_workspace_id and resolved_workspace_id both present (cross-tenant token replay test)**; **each mutation (CREATE_ROLE, UPDATE_ROLE, DISABLE_ROLE, DELETE_ROLE, UPDATE_PERMISSIONS, ASSIGN_ROLE) produces an rbac_audit_logs entry with correct user_id, role_id, action, request_id fields (SC-006)**; **403/409/422 response bodies contain no role names, user counts, or permission flag values (SC-007)**; **denial WARN log entries contain correlation_id, workspace_slug, workspace_id, user_id fields (SC-010)** in `tests/integration/backoffice/roles.routes.test.ts`
- [ ] T021 [P] [US5] Write unit tests for permission registry: lookupPermission returns correct {module,action} for all 9 registered routes; lookupPermission returns null for unregistered path (fail-closed); PUBLIC_ROUTES entries resolve to null without 403; ROUTE_PERMISSION_REGISTRY covers all routes in roles.ts (no unregistered route escapes); module keys in registry all match PermissionModule enum values in `tests/unit/rbac/permission-registry.test.ts`
- [ ] T022 [US5] Write version compatibility tests: (1) run STAGE-21 migration against test DB, query tenant_schema_versions table, assert version value = '1.4.0'; (2) rollback schema_version to '1.3.0', issue a role list API request, assert response is 426 with error code `VERSION_MISMATCH`; confirms constitution requirement that runtime rejects incompatible tenants in `tests/integration/rbac/version-compatibility.test.ts`

---

## Polish & Cross-Cutting Concerns

**Note**: The following concerns are embedded within the tasks above per platform standards. Listed here for traceability:

- Structured logging (`@zidney/logger`; `console.log` forbidden) — enforced in T008, T009, T012, T013
- Correlation ID propagation in all log entries — enforced in T012, T013
- `workspace_slug` and `workspace_id` in all RBAC log entries — enforced in T012, T013
- `rbac_v2:` cache key prefix (distinct from STAGE_17 `rbac:` prefix) — enforced in T012
- Error responses never expose internal permission structure, role names, or user counts — enforced in T013
- Server-authoritative timestamps (`DEFAULT NOW()` in DB, never from client) — enforced in T001
- Forward-only migration (`down()` throws) — enforced in T001
- No modification of STAGE_17 migration file (`20260228_001_tenant_rbac_skeleton.ts`) — governance rule, not a task
- No modification of STAGE_03 migration file (`20260217_002_create_audit_logs.ts`) — governance rule, not a task

---

## Task Count Summary

| Phase                                | Tasks     | Count  |
| ------------------------------------ | --------- | ------ |
| Phase 1: Setup (Database Foundation) | T001–T005 | 5      |
| Phase 2: Foundational (Registry)     | T006      | 1      |
| Phase 3: US1 (Domain Package)        | T007–T011 | 5      |
| Phase 4: US2 (Permission Guard)      | T012      | 1      |
| Phase 5: US3 (API Endpoints)         | T013–T014 | 2      |
| Phase 6: US4 (Frontend Pages)        | T015–T018 | 4      |
| Phase 7: US5 (Tests)                 | T019–T022 | 4      |
| **TOTAL**                            |           | **22** |

---

## Parallel Execution Groups

| Group          | Tasks                  | Condition                     |
| -------------- | ---------------------- | ----------------------------- |
| Schema files   | T002, T003, T004, T005 | After T001 migration authored |
| Domain impls   | T008, T009, T010       | After T007 types file exists  |
| Frontend pages | T015, T016, T017, T018 | After T013 API routes defined |
| Test files     | T019, T020, T021, T022 | After T007–T014 all complete  |

---

## MVP Scope Suggestion

To deliver the smallest independently verifiable increment:

**MVP = Phase 1 + Phase 2 + Phase 3 + Phase 4 (T001–T012)**

This delivers: DB schema, domain business logic, and the permission guard middleware — enough to enforce access control on existing routes without any new UI or new API endpoints. All security-critical acceptance criteria (US1, US2, US3 spec scenarios) become testable.

Phase 5 (T013–T014) adds the management API. Phases 6–7 add frontend and test coverage to complete the full stage.
