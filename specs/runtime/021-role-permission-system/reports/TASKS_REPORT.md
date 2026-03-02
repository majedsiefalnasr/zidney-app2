# Tasks Report — STAGE_21_ROLE_PERMISSION_SYSTEM

**Step:** 4 — Tasks
**Timestamp:** 2026-03-02T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

21 atomic, dependency-ordered tasks generated for STAGE_21_ROLE_PERMISSION_SYSTEM. All tasks
are organized in 7 dependency phases: database foundation → route registry → domain package →
permission guard middleware → API endpoints → frontend pages → tests. Parallel execution
markers applied to 12 of the 21 tasks across 4 parallel groups, enabling efficient
implementation batching. No tasks reference cross-tenant logic, worker integration, or master
DB changes.

---

## Inputs Reviewed

- `specs/runtime/021-role-permission-system/spec.md`
- `specs/runtime/021-role-permission-system/plan.md`
- `specs/runtime/021-role-permission-system/data-model.md`
- `specs/runtime/021-role-permission-system/contracts/api-contracts.md`
- `specs/runtime/021-role-permission-system/research.md`
- `specs/runtime/021-role-permission-system/tasks.md`

---

## Task Breakdown

| Category                          | Tasks     | Count  | Notes                                        |
| --------------------------------- | --------- | ------ | -------------------------------------------- |
| Database Foundation (Setup)       | T001–T005 | 5      | Migration + 4 Drizzle schema files           |
| Route Permission Registry         | T006      | 1      | Foundational dependency for guard and routes |
| Domain Package (US1)              | T007–T011 | 5      | types → service → audit → index export       |
| Permission Guard Middleware (US2) | T012      | 1      | 10-step evaluation chain + cache             |
| API Endpoints (US3)               | T013–T014 | 2      | Route handlers + registration                |
| Frontend Pages (US4)              | T015–T018 | 4      | Display-only, all parallel                   |
| Tests (US5)                       | T019–T021 | 3      | Unit + integration, all parallel             |
| **Total**                         |           | **21** |                                              |

---

## Parallel Groups

| Group                 | Parallel Tasks         | Notes                                 |
| --------------------- | ---------------------- | ------------------------------------- |
| Schema authoring      | T002, T003, T004, T005 | All target distinct files             |
| Domain implementation | T008, T009, T010       | After types (T007); independent files |
| Frontend pages        | T015, T016, T017, T018 | Independent Vue SFCs                  |
| Test files            | T019, T020, T021       | Independent test suites               |

---

## Transactional Tasks

- T001 (migration): Single DDL transaction — all ALTER + CREATE + schema_version update
- T008 (rbac.service.ts): Implements 5 transactional mutation methods: createRole, updateRole, deleteRole (with SELECT FOR UPDATE), updateRolePermissions, assignRoleToStaffUser — each includes co-transactional audit log write
- T012 (permission-guard): Guard middleware reads within per-request context; no write path in guard itself
- T013 (roles routes): All mutation endpoint handlers wrapped in DB transactions (via service layer T008)

---

## Idempotency Tasks

- T008 (rbac.service.ts): createRole idempotent via UNIQUE(name) constraint → 409; updateRole idempotent (last-write-wins); assignRoleToStaffUser no-op if same role_id
- T009 (rbac.audit.ts): Audit writes idempotent via request_id uniqueness
- T013 (roles routes): PUT /roles/:id/permissions is explicit full-replace (idempotent); DELETE serialized via SELECT FOR UPDATE

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                                    |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| All write paths include transaction tasks    | ✅     | T008 implements all 5 transactional mutations                            |
| Idempotency tasks are defined where required | ✅     | Covered in T008, T009, T013                                              |
| Layer boundary rules are respected           | ✅     | Business logic in packages/domain-core; no imports from apps in packages |
| No unrelated file modifications planned      | ✅     | Only files within STAGE_21 scope listed                                  |
| Migration tasks included when required       | ✅     | T001 creates the complete tenant migration                               |

**Overall:** COMPLIANT

---

## MVP Checkpoint (Recommended)

T001–T012 (Phases 1–4, 12 tasks) deliver a fully working permission enforcement engine
with no frontend or management API. All critical US1/US2 security acceptance criteria become
testable at this checkpoint. Frontend (T015–T018) can be delivered in parallel with test
authoring (T019–T021).

---

## Open Risks

1. **T004/T005** (schema extension) — must not conflict with STAGE_17 schema files; verify existing backoffice_roles and backoffice_staff_users schema imports before extending.
2. **T006** (route registry) — completeness is a deployment safety requirement (FR-024); missing route registration = fail-closed 403; must be verified before any frontend smoke test.
3. **T012** (permission guard) — workspace_id claim assertion added to guard evaluation chain; existing staff sessions without workspace_id claim will fail (risk documented in plan).

---

## Next Step

Proceed to Step 5 — Analyze.
