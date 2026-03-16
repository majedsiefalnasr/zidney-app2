# Plan Report — Divisions

**Step:** 3 — Plan
**Timestamp:** 2026-03-16T00:03:00Z
**Status:** COMPLETE

---

## Summary

Technical plan for STAGE_22_DIVISIONS is complete. All five implementation phases are defined with
exact file paths, code patterns, transaction boundaries, and idempotency strategies. Two rounds of
Guardian validation were required: the API Designer raised two blocking issues (missing cursor
pagination + route namespace inconsistency) which were resolved before final sign-off. All
constitutional checks pass.

---

## Inputs Reviewed

- `specs/runtime/022-divisions/spec.md`
- `specs/runtime/022-divisions/plan.md`
- `specs/runtime/022-divisions/research.md`
- `specs/runtime/022-divisions/data-model.md`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| API       | 10 new Hono route handlers under `apps/api/src/routes/backoffice/divisions/` at `/api/v1/backoffice/workspace/divisions/...`      |
| Worker    | None                                                                                                                              |
| Frontend  | None                                                                                                                              |
| DB Master | None                                                                                                                              |
| DB Tenant | New `divisions` table, new `staff_divisions` join table, `workspace_settings.divisions_enabled` column, `students.division_id` FK |

---

## Key Technical Decisions

| #   | Decision                                                    | Rationale                                                                              |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | `SERIALIZABLE` isolation for disable-divisions              | Prevents concurrent double-disables; correctness > throughput for a low-frequency op   |
| 2   | `INSERT ... ON CONFLICT DO NOTHING` for staff reassign      | Idempotent re-assignment; safe for retry and concurrent calls                          |
| 3   | Cursor pagination keyset `(created_at, id)` on GET list     | O(1) seek; consistent ordering; safe under concurrent inserts                          |
| 4   | Composite PK on `staff_divisions(staff_id, division_id)`    | Natural uniqueness constraint; eliminates surrogate PK overhead                        |
| 5   | Redis rate-limit fail-closed (return 503)                   | Destructive endpoints degrade safely when Redis is unavailable; no silent pass-through |
| 6   | `division_id` FK on `students` SET NOT NULL after back-fill | Enforces referential integrity while preserving safe migration on existing tenants     |
| 7   | `schema_version` bump: 1.4.0 → 1.5.0                        | Aligns with ADR-0008 semantic versioning; current codebase version is 1.4.0            |
| 8   | All DB access via injected `db: DbClient`                   | No direct `Pool` instantiation inside domain or routes                                 |
| 9   | Route namespace `/api/v1/backoffice/workspace`              | Matches existing backoffice route group (confirmed from `apps/api/src/app.ts`)         |
| 10  | Staff table: `backoffice_staff_users`                       | Authoritative name confirmed from existing schema files                                |

---

## Migration Impact

| Item                  | Value | Notes                                                                  |
| --------------------- | ----- | ---------------------------------------------------------------------- |
| Migration required    | Yes   | `apps/api/src/db/tenant/migrations/20260316_001_divisions.ts`          |
| `schema_version` bump | Yes   | 1.4.0 → 1.5.0                                                          |
| Backward compatible   | Yes   | All new columns have safe defaults; students back-fill before NOT NULL |

### 8-Step Migration Sequence

1. `CREATE TABLE divisions` + CHECK constraint + 2 indexes
2. `CREATE TABLE staff_divisions` + composite PK + FK constraints + 2 indexes
3. `ALTER workspace_settings ADD COLUMN divisions_enabled BOOLEAN NOT NULL DEFAULT true`
4. `ALTER students ADD COLUMN division_id UUID` (nullable initially)
5. `UPDATE students SET division_id = <default division id>`
6. `ALTER students ALTER COLUMN division_id SET NOT NULL`
7. `ALTER students ADD CONSTRAINT students_division_id_fkey FK` + index
8. `UPDATE schema_version SET version = '1.5.0'`

---

## Transaction Boundaries

- All write endpoints use explicit `BEGIN / COMMIT` blocks via raw SQL
- `disable-divisions` uses `SERIALIZABLE` isolation level
- Staff reassignment uses `INSERT ... ON CONFLICT DO NOTHING` for idempotency
- Migration file uses a single transaction wrapping all 8 steps
- `DIVISION_DELETED` is blocked if students or staff are assigned (422 before any DB writes)

---

## Idempotency Strategy

- `POST /divisions` — unique constraint on `name` returns 409 on duplicate
- `POST /divisions/:id/staff/:staffId` — `ON CONFLICT DO NOTHING` makes repeat calls safe
- `DELETE /divisions/:id/staff/:staffId` — `DELETE ... WHERE NOT EXISTS` guard returns 404 on absent
- `POST /workspace/disable-divisions` — SERIALIZABLE + re-entry guard checks `divisions_enabled = false` first; 422 if already disabled
- Rate-limited endpoints (destructive ops): Redis token bucket, fail-closed on Redis unavailability

---

## Endpoint Plan

| Method | Path                                                        | Handler              |
| ------ | ----------------------------------------------------------- | -------------------- |
| GET    | `/api/v1/backoffice/workspace/divisions`                    | listDivisions        |
| POST   | `/api/v1/backoffice/workspace/divisions`                    | createDivision       |
| GET    | `/api/v1/backoffice/workspace/divisions/:id`                | getDivision          |
| PUT    | `/api/v1/backoffice/workspace/divisions/:id`                | updateDivision       |
| PATCH  | `/api/v1/backoffice/workspace/divisions/:id/status`         | updateDivisionStatus |
| DELETE | `/api/v1/backoffice/workspace/divisions/:id`                | deleteDivision       |
| GET    | `/api/v1/backoffice/workspace/divisions/:id/staff`          | listDivisionStaff    |
| POST   | `/api/v1/backoffice/workspace/divisions/:id/staff/:staffId` | assignStaff          |
| DELETE | `/api/v1/backoffice/workspace/divisions/:id/staff/:staffId` | removeStaff          |
| POST   | `/api/v1/backoffice/workspace/disable-divisions`            | disableDivisions     |

All inherit middleware chain: `correlationId → tenantResolver → licenseEnforcement → schemaVersion → rateLimit → auth-jwt`

---

## Files to Create / Modify

### New Files

- `apps/api/src/db/tenant/migrations/20260316_001_divisions.ts`
- `apps/api/src/db/tenant/schemas/divisions.schema.ts`
- `apps/api/src/db/tenant/schemas/staff-divisions.schema.ts`
- `packages/domain-core/src/divisions/divisions.types.ts`
- `packages/domain-core/src/divisions/divisions.errors.ts`
- `packages/domain-core/src/divisions/divisions.service.ts`
- `packages/domain-core/src/divisions/index.ts`
- `apps/api/src/routes/backoffice/divisions/list.ts`
- `apps/api/src/routes/backoffice/divisions/create.ts`
- `apps/api/src/routes/backoffice/divisions/get.ts`
- `apps/api/src/routes/backoffice/divisions/update.ts`
- `apps/api/src/routes/backoffice/divisions/update-status.ts`
- `apps/api/src/routes/backoffice/divisions/delete.ts`
- `apps/api/src/routes/backoffice/divisions/list-staff.ts`
- `apps/api/src/routes/backoffice/divisions/assign-staff.ts`
- `apps/api/src/routes/backoffice/divisions/remove-staff.ts`
- `apps/api/src/routes/backoffice/divisions/disable-divisions.ts`
- `apps/api/src/routes/backoffice/divisions/index.ts`

### Modified Files

- `apps/api/src/db/tenant/schemas/workspace-settings.schema.ts` — add `divisions_enabled`
- `apps/api/src/db/tenant/schemas/students.schema.ts` — add `division_id` FK
- `apps/api/src/routes/backoffice/index.ts` — mount divisions router
- `packages/domain-core/src/index.ts` — re-export divisions module
- `packages/validation/src/backoffice/divisions.schemas.ts` (new) — Zod validation schemas

### Test Files

- `tests/api/backoffice/divisions/` — integration test suite (10 test files, 8 pagination cases)

---

## Guardian Validation Results

### Round 1

| Guardian                    | Verdict    | Issues                                                                           |
| --------------------------- | ---------- | -------------------------------------------------------------------------------- |
| Zidney Architecture Checker | ✅ PASS    | All 10 constraints satisfied                                                     |
| Zidney API Designer         | ❌ BLOCKED | 1. Missing cursor pagination on GET /divisions; 2. Route namespace inconsistency |

### Round 2 (after fixes)

| Guardian                    | Verdict | Fixes Confirmed                                                                       |
| --------------------------- | ------- | ------------------------------------------------------------------------------------- |
| Zidney Architecture Checker | ✅ PASS | No changes needed                                                                     |
| Zidney API Designer         | ✅ PASS | FR-026 cursor pagination added; namespace corrected; Redis fail-closed FR-028 applied |

**Final Guardian Verdict: APPROVED**

---

## Fixes Applied (Round 2)

| #   | Fix                                                         | Spec Change                                                         | Plan Change                                                               |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Route namespace corrected to `/api/v1/backoffice/workspace` | All 10 endpoint paths updated                                       | Route file `index.ts` mount updated                                       |
| 2   | Cursor pagination added to `GET /divisions`                 | FR-026, FR-027 added; response shape `{ items, nextCursor, total }` | `listDivisions()` service function updated with keyset `(created_at, id)` |
| 3   | Redis fail-closed on destructive ops                        | FR-028 added (fail 503 if Redis unavailable)                        | Rate-limit middleware block updated: `if (!redis) return 503`             |

---

## Constitutional Compliance

| Check                                  | Status | Notes                                               |
| -------------------------------------- | ------ | --------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | All queries use `tenant.pool` from resolver context |
| All writes are transactional by design | ✅     | BEGIN/COMMIT on all multi-step writes               |
| Server-authoritative time enforced     | ✅     | `NOW()` at DB level; no client timestamps           |
| License middleware enforced            | ✅     | Inherited from backoffice group middleware chain    |
| Version compatibility enforced         | ✅     | schema_version guard in middleware                  |
| No architecture redesign without ADR   | ✅     | No new layers; all changes within existing patterns |

**Overall: COMPLIANT**

---

## Open Risks

- `students` table `ACCESS EXCLUSIVE` lock during column addition (Step 4–7 of migration) — recommend off-peak deployment window for tenants with > 10K students
- Default division seed dependency (STAGE_17) — migration Step 5 assumes at least one `is_default = true` division row exists; pre-deploy check required

---

## Next Step

Proceed to Step 4 — Tasks.
