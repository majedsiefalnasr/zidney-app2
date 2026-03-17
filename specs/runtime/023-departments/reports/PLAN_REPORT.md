# Plan Report — Departments

**Step:** 3 — Plan  
**Timestamp:** 2026-03-17T00:03:00Z  
**Status:** COMPLETE

---

## Summary

Technical implementation plan generated for STAGE_23_DEPARTMENTS. The 5-phase plan covers the full
data layer (migration + Drizzle schemas), domain package (`packages/domain-core/src/departments/`),
10 API route handlers, route registration, and 5 test files. Guardian validation (Architecture
Checker + API Designer) was run and 3 violations were identified and remediated before plan was
finalized:

1. POST /departments: Fixed `422 DEPARTMENT_NOT_FOUND` → `404 DEPARTMENT_NOT_FOUND` in spec
2. Tree endpoint response: Added `parent_id` + `division_id` fields to response example
3. `createDepartment` + `updateDepartment`: Added explicit `division_id` existence check step

All guardians: **VERDICT: PASS** after remediation.

---

## Inputs Reviewed

- `specs/runtime/023-departments/spec.md` (975+ lines, with 5 clarifications)
- `specs/runtime/023-departments/plan.md` (865 lines)
- `specs/runtime/023-departments/research.md` (288 lines)
- `specs/runtime/023-departments/data-model.md` (566 lines)
- `specs/runtime/022-divisions/plan.md` (reference pattern)

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                      |
| --------- | ------------------------------------------------------------------------------------ |
| API       | 10 new route files in `apps/api/src/routes/backoffice/departments/`; `app.ts` update |
| Worker    | None                                                                                 |
| Frontend  | None                                                                                 |
| DB Master | None                                                                                 |
| DB Tenant | 2 new tables (`departments`, `staff_departments`); 1 column added to `students`      |

---

## Key Technical Decisions

| #   | Decision                                                            | Rationale                                                                                                 |
| --- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Recursive CTE for cycle detection (PostgreSQL `WITH RECURSIVE`)     | Single SQL round-trip; executes inside write transaction; research.md §1 confirms safety                  |
| 2   | `SELECT … FOR UPDATE` on departments row before max_users check     | Prevents TOCTOU race when concurrent students are assigned to same department                             |
| 3   | Drizzle `AnyPgColumn` self-reference for `parent_id` FK             | Required by Drizzle's type system for self-referencing tables; functional unique index is migration-owned |
| 4   | `GET /departments/tree` registered before `GET /departments/:id`    | Hono matches routes in registration order; tree endpoint must come first to avoid `:id` capture           |
| 5   | Tree built in-app (Map<id, node>) instead of recursive DB query     | O(n) single-pass; acceptable for STAGE_23 scope (~10k dept limit); preserves insertion-order sort         |
| 6   | `ON CONFLICT DO NOTHING` for staff assignment                       | Idempotent upsert; FR-017 requirement; prevents duplicate rows without race conditions                    |
| 7   | Division consistency on reparent: moved node only (no subtree scan) | Clarification Q3: subtree validation is deferred to a future stage                                        |
| 8   | `max_users` reduction silently allowed                              | Clarification Q2: forward-only cap; existing over-cap enrollments are not ejected                         |
| 9   | Explicit `division_id` existence check before INSERT/UPDATE         | Prevents unhandled FK violation (postgres `23503`) from surfacing as HTTP 500                             |

---

## New Files (24)

### Data Layer

- `apps/api/src/db/tenant/migrations/20260317_001_departments.ts`
- `apps/api/src/db/tenant/schemas/departments.schema.ts`
- `apps/api/src/db/tenant/schemas/staff-departments.schema.ts`

### Domain Layer

- `packages/domain-core/src/departments/departments.errors.ts`
- `packages/domain-core/src/departments/departments.types.ts`
- `packages/domain-core/src/departments/departments.service.ts`
- `packages/domain-core/src/departments/index.ts`

### Validation

- `packages/validation/src/departments/departments.validation.ts`

### API Routes (10)

- `apps/api/src/routes/backoffice/departments/helpers.ts`
- `apps/api/src/routes/backoffice/departments/list-departments.ts`
- `apps/api/src/routes/backoffice/departments/create-department.ts`
- `apps/api/src/routes/backoffice/departments/get-department.ts`
- `apps/api/src/routes/backoffice/departments/update-department.ts`
- `apps/api/src/routes/backoffice/departments/delete-department.ts`
- `apps/api/src/routes/backoffice/departments/children-department.ts`
- `apps/api/src/routes/backoffice/departments/tree-departments.ts`
- `apps/api/src/routes/backoffice/departments/staff-departments.ts`
- `apps/api/src/routes/backoffice/departments/index.ts`

### Tests (5)

- `packages/domain-core/src/departments/__tests__/departments.service.test.ts`
- `tests/api/departments/departments-crud.test.ts`
- `tests/api/departments/departments-hierarchy.test.ts`
- `tests/api/departments/departments-staff.test.ts`
- `tests/api/departments/departments-concurrent.test.ts`

## Files to Update (6)

- `apps/api/src/db/tenant/schemas/students.schema.ts` — add `department_id` nullable FK + index
- `apps/api/src/db/tenant/schemas/index.ts` — add two barrel exports
- `apps/api/src/app.ts` — import + mount `departmentsRouter`
- `packages/domain-core/src/index.ts` — add `export * from './departments'`
- `packages/domain-core/package.json` — add `"./departments"` subpath export
- `packages/validation/src/index.ts` — add departments schema exports

---

## Migration Impact

| Item                  | Value    | Notes                                                                  |
| --------------------- | -------- | ---------------------------------------------------------------------- |
| Migration required    | Yes      | `20260317_001_departments.ts`                                          |
| `schema_version` bump | Yes      | `1.5.0` → `1.6.0`                                                      |
| Backward compatible   | Yes      | New tables; `students.department_id` nullable (no data loss)           |
| Hard dependency       | STAGE_22 | `divisions` table must exist; `ON DELETE RESTRICT` FK on `division_id` |

---

## Transaction Boundaries

- `createDepartment`: all 6 steps (parent check, division check, consistency, uniqueness, INSERT, log) in single transaction
- `updateDepartment`: all 7 steps (fetch, division check, cycle detection, consistency, uniqueness, UPDATE, log) in single transaction
- `deleteDepartment`: existence check + 3 guard checks + DELETE in single transaction
- `assignStaffDepartment`: existence + status + division check + INSERT in single transaction
- `removeStaffDepartment`: assignment existence check + DELETE in single transaction

---

## Idempotency Strategy

- `POST /staff/:staff_id/departments`: `ON CONFLICT (staff_id, department_id) DO NOTHING` — safe to retry
- `DELETE /departments/:id`: returns 404 if not found — safe to retry
- `DELETE /staff/:staff_id/departments/:department_id`: returns 404 if not found — safe to retry
- `PUT /departments/:id`: deterministic on same input — idempotent

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                                  |
| -------------------------------------- | ------ | ---------------------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | All DB access via `c.get('tenant').pool`; no global singleton          |
| All writes are transactional by design | ✅     | Each mutating service function wrapped in `BEGIN … COMMIT`             |
| Server-authoritative time enforced     | ✅     | `NOW()` used in all INSERT/UPDATE; no client timestamps                |
| License middleware enforced            | ✅     | Routes inherit backoffice group middleware chain                       |
| Version compatibility enforced         | ✅     | Migration bumps schema_version; compatibility checked by license layer |
| No architecture redesign without ADR   | ✅     | No new top-level modules; `domain-core` internal expansion only        |

**Overall:** COMPLIANT

---

## Open Risks

1. **ℹ️ Low — Arch Checker advisory**: Stage is `DRAFT` — implementation is blocked until stage advances to `IN PROGRESS`. This is expected and governed by the workflow lifecycle (Step 5 Analyze causes the transition).
2. **ℹ️ Low — API Designer low severity**: `GET /departments/:id/children` response example omits 4 fields (`max_users`, `description`, `created_at`, `updated_at`). Not blocking — contract is defined by the documented `DepartmentRow` type.
3. **ℹ️ Low — API Designer low severity**: `POST /staff` returns 200 instead of 201. Acceptable because the operation is an idempotent upsert per FR-017.
4. **ℹ️ Low — Arch Checker advisory**: FR-005 literal wording says cycle detection on every create AND update, but plan skips it on create (safe optimization). A comment explaining this will be added to `createDepartment` implementation.
5. **⚡ Medium — Tree endpoint memory bound**: Acceptable for STAGE_23 scope; pagination deferred to future stage.

---

## Next Step

Proceed to Step 4 — Tasks.
