# Plan Report — Groups (STAGE_24)

**Step:** 3 — Plan  
**Timestamp:** 2026-03-19T00:00:00Z  
**Status:** COMPLETE

---

## Summary

Technical plan for the Groups feature is complete and guardian-validated. The plan covers a new
`groups` table, a `staff_groups` join table, and a nullable `group_id` FK column on `students`.
Eleven API endpoints are specified, covering CRUD on groups, student assignment, and staff
assignment. All mutating operations are fully transactional with `SELECT FOR UPDATE` for
concurrency control. A SAVEPOINT-per-guard pattern (AD-05) safely handles deletion guard queries
against tables (`exam_group_targets`, `ads_group_targets`) that do not yet exist.

Both guardian evaluations returned **VERDICT: PASS** after remediation.

---

## Inputs Reviewed

- `specs/runtime/024-groups/spec.md`
- `specs/runtime/024-groups/plan.md`
- `specs/runtime/024-groups/research.md`
- `specs/runtime/024-groups/data-model.md`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------- |
| API       | 11 new Hono route handlers under `apps/api/src/routes/backoffice/groups/`                         |
| Worker    | None                                                                                              |
| Frontend  | None                                                                                              |
| DB Master | None                                                                                              |
| DB Tenant | New tables: `groups`, `staff_groups`; alter `students` add `group_id` FK; migration 1.6.0 → 1.7.0 |

---

## Key Technical Decisions

| #     | Decision                                                                                                           | Rationale                                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| AD-01 | Service layer in `packages/domain-core/src/groups/`; accepts injected `DbClient`                                   | Domain-core isolation, testable without HTTP layer                                                                                                   |
| AD-02 | Soft-delete only (`deleted_at = NOW()`); hard delete forbidden                                                     | Prevents cascade integrity violations on dependent records                                                                                           |
| AD-03 | `SELECT FOR UPDATE` on `groups` row before counting `students WHERE group_id = :gid`                               | Serializes concurrent student-assignment requests; prevents TOCTOU race on `max_members`                                                             |
| AD-04 | `INSERT INTO staff_groups ... ON CONFLICT DO NOTHING`                                                              | Idempotent staff assignment without an extra SELECT                                                                                                  |
| AD-05 | SAVEPOINT per deletion guard (`sp_exam_guard`, `sp_ads_guard`) for `42P01` handling                                | 42P01 inside an open `BEGIN...COMMIT` aborts the whole transaction; SAVEPOINTs contain the error within the same TX while allowing graceful recovery |
| AD-06 | Partial unique index `LOWER(name) WHERE deleted_at IS NULL` in migration SQL; no `uniqueIndex()` in Drizzle schema | Functional indexes must be created in raw SQL; double-index risk if added to Drizzle schema too                                                      |
| AD-07 | Student assignment via `UPDATE students SET group_id = $new WHERE id = $sid` (not INSERT)                          | Enforces single-group-per-student at DB layer; idempotent                                                                                            |
| AD-08 | All deletion guards run inside the same `BEGIN...COMMIT` block, with SAVEPOINTs per AD-05                          | Atomic deletion check + soft-delete in one transaction                                                                                               |
| AD-09 | Zod schemas in `packages/validation/src/backoffice/groups.schemas.ts`                                              | Shared validation package; no business logic in route handlers                                                                                       |
| AD-10 | Route mount at `app.route('/groups', groupsRouter)` inside the workspace router                                    | Consistent with STAGE_22/STAGE_23 mount pattern                                                                                                      |

---

## Migration Impact

| Item                  | Value | Notes                                          |
| --------------------- | ----- | ---------------------------------------------- |
| Migration required    | Yes   | `20260319_001_groups.ts`                       |
| `schema_version` bump | Yes   | `1.6.0` → `1.7.0`                              |
| Backward compatible   | No    | Adds new tables and modifies `students` schema |

Migration steps (single atomic `BEGIN…COMMIT`):

1. CREATE TABLE `groups`
2. CREATE partial unique index on `LOWER(groups.name) WHERE deleted_at IS NULL`
3. CREATE TABLE `staff_groups`
4. ALTER TABLE `students` ADD COLUMN `group_id` UUID NULLABLE with FK to `groups.id` ON DELETE SET NULL
5. UPDATE `tenant_metadata` SET `schema_version = '1.7.0'`

---

## Transaction Boundaries

- **Create group**: `BEGIN … INSERT groups … COMMIT` (with name uniqueness and dept reference checks)
- **Update group**: `BEGIN … UPDATE groups … COMMIT` (with name and dept checks)
- **Delete group**: `BEGIN … SELECT FOR UPDATE … COUNT students … COUNT staff_groups … SAVEPOINT sp_exam_guard (COUNT exam_group_targets) … SAVEPOINT sp_ads_guard (COUNT ads_group_targets) … UPDATE deleted_at … COMMIT`
- **Assign student**: `BEGIN … SELECT groups FOR UPDATE … COUNT students WHERE group_id (excl. student) … UPDATE students SET group_id … COMMIT`
- **Remove student**: `BEGIN … UPDATE students SET group_id = NULL … COMMIT`
- **Assign staff**: `BEGIN … SELECT group FOR UPDATE … INSERT staff_groups ON CONFLICT DO NOTHING … COMMIT`
- **Remove staff**: `BEGIN … DELETE staff_groups … check rowCount … COMMIT`

---

## Idempotency Strategy

| Operation      | Idempotency Approach                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Assign student | `UPDATE students SET group_id = $new` — idempotent by nature; max_members count excludes the student being re-assigned (`AND id != $student_id`) |
| Assign staff   | `INSERT … ON CONFLICT DO NOTHING` on composite PK `(staff_id, group_id)`                                                                         |
| Delete group   | `deleted_at` check at start; double-delete returns 404 `GROUP_NOT_FOUND`                                                                         |

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                                   |
| -------------------------------------- | ------ | ----------------------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | All DB access via injected `DbClient` from tenant resolver              |
| All writes are transactional by design | ✅     | Every mutating operation wrapped in explicit `BEGIN … COMMIT`           |
| Server-authoritative time enforced     | ✅     | All timestamps use `now()` server-side; no client timestamps            |
| License middleware enforced            | ✅     | `licenseEnforcement` in every route's middleware chain                  |
| Version compatibility enforced         | ✅     | `schemaVersion` middleware in chain; migration bumps to `1.7.0`         |
| No architecture redesign without ADR   | ✅     | No new architecture introduced; plan follows STAGE_22/STAGE_23 patterns |

**Overall:** COMPLIANT

---

## Guardian Audit Results

### Architecture Checker — VERDICT: PASS (after remediation)

**Initial verdict:** BLOCKED  
**Critical violation:** AD-05 specified bare `42P01` catch inside `BEGIN…COMMIT` — PostgreSQL aborts the entire transaction on any uncaught error within an open block; JS `catch` does NOT reset PG connection state.  
**Remediation:** Replaced bare error-catch with SAVEPOINT per guard (`sp_exam_guard`, `sp_ads_guard`). Contains `42P01` within a nested savepoint; parent transaction remains healthy.

All 9 architectural criteria: ✅ PASS after fix.

### API Designer — VERDICT: PASS (after remediation)

**Initial verdict:** BLOCKED  
Issues resolved:

- H-01: Path params aligned to camelCase (`:studentId`, `:staffId`, `:groupId`) in spec.md
- H-02: `GET /students/:studentId/group` endpoint added to spec.md with full contract
- M-02: Forward-only pagination declared explicitly in spec.md
- M-03: Full `{ success, data, error }` JSON envelopes added for POST/DELETE staff assignment endpoints

All 7 API design criteria: ✅ PASS after fix.

---

## Open Risks

- **M-RISK (non-blocking):** `staff_groups.group_id ON DELETE CASCADE` is semantically inconsistent with the soft-delete model. Hard deletion of a `groups` row is explicitly forbidden (AD-02); the CASCADE will never fire in practice. A comment must be added in the migration file to document this invariant for future implementers.
- **Implementation note:** `nextCursor` uses camelCase to align with the established STAGE_22/STAGE_23 platform convention (`divisions.service.ts`, `departments.service.ts`). This is intentional and consistent.

---

## Next Step

Proceed to Step 4 — Tasks.
