# Plan Report — Teams & Work Team Types

**Step:** 3 — Plan  
**Timestamp:** 2026-03-19T00:00:00Z  
**Status:** COMPLETE

---

## Summary

A full technical plan has been produced for STAGE_26_TEAMS (Teams & Work Team Types). The plan defines three new tenant-DB tables (`team_types`, `teams`, `staff_teams`), a forward-only migration bumping `schema_version` from `1.9.0` to `1.10.0`, 13 CRUD + assignment routes registered under the Backoffice router, 8 explicit transaction boundaries, and a complete unit + integration + academic-regression test strategy. All business logic is isolated in `packages/domain-core/src/teams/`. No existing tables are modified.

A parallel guardian audit was run:

- **Zidney Architecture Checker** → `VERDICT: PASS` (3 non-blocking observations noted, addressed in plan)
- **Zidney API Designer** → Initial `VERDICT: BLOCKED` (F3: missing pagination on members endpoint; F6: PUT used for partial updates). Both blocking findings were resolved — pagination was added to `GET /teams/:id/members` and all partial-update routes changed from `PUT` to `PATCH`. Re-run returned `VERDICT: PASS`.

---

## Inputs Reviewed

- `specs/runtime/026-teams-work-team-types/spec.md`
- `specs/runtime/026-teams-work-team-types/plan.md`
- `specs/runtime/026-teams-work-team-types/research.md`
- `specs/runtime/026-teams-work-team-types/data-model.md`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------- |
| API       | 1 new router module (`apps/api/src/routes/backoffice/teams/`), 13 handler files, router mounted in backoffice main router |
| Worker    | None                                                                                                                      |
| Frontend  | None                                                                                                                      |
| DB Master | None                                                                                                                      |
| DB Tenant | 1 new migration (`20260319_004_teams.ts`), 3 new Drizzle ORM schema files, `schemas/index.ts` updated                     |
| Domain    | New `packages/domain-core/src/teams/` module: types, errors, repository, service, barrel export                           |

---

## Key Technical Decisions

| #   | Decision                                                                              | Rationale                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | PATCH for partial updates (not PUT)                                                   | All update-body fields are optional; PATCH is semantically correct and matches Zidney API convention                                             |
| 2   | Cursor-based pagination on all list endpoints including `GET /teams/:id/members`      | Consistent paging contract across all collection routes; prevents full-table scans on large member lists                                         |
| 3   | `SELECT FOR UPDATE NOWAIT` for max_members check                                      | Prevents race conditions during concurrent staff assignment; returns `TEAM_CAPACITY_EXCEEDED` immediately on lock contention rather than queuing |
| 4   | Partial unique indexes (`WHERE deleted_at IS NULL`)                                   | Allows re-use of soft-deleted names without unique constraint violations                                                                         |
| 5   | Composite PK on `staff_teams (team_id, staff_id)` + `INSERT … ON CONFLICT DO NOTHING` | Ensures idempotent staff assignment — double-submits return `200` silently                                                                       |
| 6   | SAVEPOINT guard around `staff_teams` insert within team assignment TX                 | Protects the outer transaction if the inner insert hits an unexpected constraint                                                                 |
| 7   | `schema_version >= '1.10.0'` enforcement via license middleware                       | Guarantees tenant DBs are migrated before serving team endpoints                                                                                 |
| 8   | Academic isolation invariant                                                          | `teams` and `team_types` tables MUST NOT appear in content, exam, or student-visibility queries; domain module enforces this boundary            |

---

## Migration Impact

| Item                  | Value                 | Notes                                                                                      |
| --------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| Migration required    | Yes                   | `20260319_004_teams.ts`                                                                    |
| `schema_version` bump | Yes                   | `1.9.0 → 1.10.0`                                                                           |
| Backward compatible   | Yes                   | No existing table modified; all new columns have explicit defaults or nullable constraints |
| Rollback strategy     | Snapshot restore only | `down()` throws; forward-only migration per ADR-0008                                       |

---

## Transaction Boundaries

1. **Create team type** — single `INSERT` in TX; unique partial index prevents duplicates.
2. **Update team type** — `UPDATE` inside TX; verify `deleted_at IS NULL` before write.
3. **Delete team type** — `SELECT … FOR UPDATE NOWAIT` + soft `UPDATE deleted_at` in TX; blocks if team currently references it.
4. **Create team** — `INSERT` in TX; verify `team_type_id` exists and is ENABLED; unique partial index prevents name duplicates.
5. **Update team** — `UPDATE` inside TX; verify record exists and is not soft-deleted.
6. **Delete team** — `SELECT … FOR UPDATE NOWAIT` on `staff_teams` count + soft `UPDATE deleted_at` in TX; prevents deletion of teams with active members.
7. **Assign staff to team** — `SELECT … FOR UPDATE NOWAIT` on team row (capacity check) + `INSERT … ON CONFLICT DO NOTHING` on `staff_teams` inside same TX; SAVEPOINT guard around inner insert.
8. **Remove staff from team** — `DELETE FROM staff_teams` inside TX; idempotent (404 if already absent).

---

## Idempotency Strategy

| Operation        | Mechanism                                                     | Double-submit result           |
| ---------------- | ------------------------------------------------------------- | ------------------------------ |
| Create team type | Partial unique index `(LOWER(name)) WHERE deleted_at IS NULL` | 409 `TEAM_TYPE_NAME_DUPLICATE` |
| Create team      | Partial unique index `(LOWER(name)) WHERE deleted_at IS NULL` | 409 `TEAM_NAME_DUPLICATE`      |
| Assign staff     | Composite PK + `ON CONFLICT DO NOTHING`                       | 200 success, no duplicate row  |
| Delete team type | `findTeamTypeById` inside TX → 404 if already deleted         | 404 `TEAM_TYPE_NOT_FOUND`      |
| Delete team      | `findTeamById` inside TX → 404 if already deleted             | 404 `TEAM_NOT_FOUND`           |
| Remove staff     | `DELETE` returns 0 rows → 404                                 | 404 `STAFF_TEAM_NOT_FOUND`     |

---

## API Routes Summary

**Base path**: `https://{workspace_slug}.zidney.app/api/v1/backoffice/`

| Method | Path                          | RBAC                 |
| ------ | ----------------------------- | -------------------- |
| GET    | `/team-types`                 | `team_types:manage`  |
| POST   | `/team-types`                 | `team_types:manage`  |
| GET    | `/team-types/:id`             | `team_types:manage`  |
| PATCH  | `/team-types/:id`             | `team_types:manage`  |
| DELETE | `/team-types/:id`             | `team_types:manage`  |
| GET    | `/teams`                      | `teams:manage`       |
| POST   | `/teams`                      | `teams:manage`       |
| GET    | `/teams/:id`                  | `teams:manage`       |
| PATCH  | `/teams/:id`                  | `teams:manage`       |
| DELETE | `/teams/:id`                  | `teams:manage`       |
| GET    | `/teams/:id/members`          | `staff_teams:assign` |
| POST   | `/teams/:id/members`          | `staff_teams:assign` |
| DELETE | `/teams/:id/members/:staffId` | `staff_teams:assign` |

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                                                      |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| No cross-tenant logic introduced       | ✅     | All DB access via `tenant.pool` from Hono context                                          |
| All writes are transactional by design | ✅     | 8 explicit TX boundaries documented                                                        |
| Server-authoritative time enforced     | ✅     | All timestamps set by `NOW()` at DB layer                                                  |
| License middleware enforced            | ✅     | Route stack: tenantResolver → license → auth → RBAC → handler                              |
| Version compatibility enforced         | ✅     | `schema_version >= '1.10.0'` required                                                      |
| No architecture redesign without ADR   | ✅     | No existing architecture modified; new team module follows established domain-core pattern |
| Soft delete only (no hard delete)      | ✅     | `deleted_at` column on all three tables                                                    |
| Academic isolation enforced            | ✅     | Invariant documented; domain module MUST NOT cross into content/exam queries               |

**Overall:** COMPLIANT

---

## Guardian Audit Results

| Guardian                    | Verdict                  | Notes                                                                                                              |
| --------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Zidney Architecture Checker | PASS                     | 3 non-blocking observations (NOWAIT contention mapping, member list rebounded by pagination, SAVEPOINT risk noted) |
| Zidney API Designer         | PASS (after remediation) | Blocking findings F3 (pagination) and F6 (PUT→PATCH) resolved before commit                                        |

---

## Open Risks

- **NOWAIT lock contention under high concurrency (OBS-01)**: If two concurrent assignment requests race on the same team row, the losing request will receive a PostgreSQL lock-not-available error. The service layer must map this to the structured `TEAM_CAPACITY_EXCEEDED` response code (or a dedicated `TEAM_LOCK_CONTENTION` code) rather than letting it surface as an unhandled 500.
- **SAVEPOINT reliability (OBS-03)**: SAVEPOINT guards inside a transaction rely on the outer connection not being in an aborted state. Ensure the repository layer checks transaction state before issuing SAVEPOINT.

---

## Next Step

Proceed to Step 4 — Tasks.
