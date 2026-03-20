# Tasks Report — Teams & Work Team Types

**Step:** 4 — Tasks  
**Timestamp:** 2026-03-19T00:00:00Z  
**Status:** COMPLETE

---

## Summary

35 atomic tasks generated across 4 phases: Foundation (6), Domain (11), Routes (16), Tests (2). All tasks name exact file paths and honour the dependency ordering required by the implementation plan. 19 of 35 tasks are parallel-safe. No unrelated files are touched.

---

## Inputs Reviewed

- `specs/runtime/026-teams-work-team-types/spec.md`
- `specs/runtime/026-teams-work-team-types/plan.md`
- `specs/runtime/026-teams-work-team-types/data-model.md`
- `specs/runtime/026-teams-work-team-types/tasks.md`

---

## Task Breakdown

| Category                     | Tasks  | IDs                    | Notes                                                                       |
| ---------------------------- | ------ | ---------------------- | --------------------------------------------------------------------------- |
| Migration / DB Schema        | 6      | T001, T001b, T002–T005 | 1 migration + MIN_SCHEMA_VERSION update + 3 Drizzle schemas + barrel update |
| Domain (types+errors)        | 2      | T006–T007              | parallel-safe foundation files                                              |
| Domain (repository)          | 3      | T008–T010              | sequential (same file, 3 function groups)                                   |
| Domain (service)             | 3      | T011–T013              | sequential (same file, 3 function groups)                                   |
| Domain (barrel + validation) | 3      | T014–T016              | index, domain-core barrel, Zod schemas                                      |
| API Route Handlers           | 15     | T017–T031              | helpers + 13 handlers + router index                                        |
| Router Mount                 | 1      | T032                   | mount teamsRouter in backoffice main router                                 |
| Unit Tests                   | 1      | T033                   | service unit tests (14 scenarios)                                           |
| Integration Tests            | 1      | T034                   | API integration tests (CRUD + RBAC + pagination)                            |
| **Total**                    | **35** |                        |                                                                             |

---

## Transactional Tasks

- **T001** — Migration itself runs inside Drizzle's migration transaction
- **T011** — createTeamType service: unique-name check + INSERT in TX
- **T011** — updateTeamType service: soft-delete guard + UPDATE in TX
- **T011** — deleteTeamType service: SELECT FOR UPDATE NOWAIT + soft UPDATE in TX; blocks if teams reference this type
- **T012** — createTeam service: team-type ENABLED check + INSERT in TX
- **T012** — updateTeam service: existence check + UPDATE in TX
- **T012** — deleteTeam service: assignment count check + reporting reference check + soft UPDATE in TX
- **T013** — assignStaffToTeam: SELECT FOR UPDATE NOWAIT (capacity lock) + INSERT ON CONFLICT DO NOTHING in TX
- **T013** — removeStaffFromTeam: DELETE inside TX; 404 if already absent

---

## Idempotency Tasks

- **T008/T011** — `teamTypeNameExists` guards create; partial unique index provides DB-level guarantee
- **T009/T012** — `teamNameExists` guards create; partial unique index provides DB-level guarantee
- **T010/T013** — `upsertStaffTeamAssignment` using `ON CONFLICT DO NOTHING`; re-assignment returns 200 silently
- **T022/T027** — delete handlers resolve 404 from TX guard; re-deletion idempotent to 404
- **T030** — removeStaffTeam returns 404 if assignment already removed

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                                                                                                        |
| -------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | T011–T013 cover all 8 TX boundaries from plan section 7                                                                                      |
| Idempotency tasks are defined where required | ✅     | T008–T010, T013 cover all idempotent operations from plan section 13                                                                         |
| Layer boundary rules are respected           | ✅     | Domain tasks (T006–T016) have zero imports from apps/; route tasks (T017–T032) import only from packages/domain-core and packages/validation |
| No unrelated file modifications planned      | ✅     | Only 2 existing files modified: schemas/index.ts (T005) and packages/domain-core/src/index.ts (T015) and backoffice main router (T032)       |
| Migration tasks included when required       | ✅     | T001 creates the forward-only DDL migration                                                                                                  |
| No `console.log` — structured logging        | ✅     | All service + handler tasks implicitly use @zidney/logger per plan section 14                                                                |

**Overall:** COMPLIANT

---

## Parallel Execution Opportunities

The following tasks can run concurrently once their predecessor batch completes:

| Batch | Prerequisites | Tasks                       |
| ----- | ------------- | --------------------------- |
| 1     | —             | T001                        |
| 2     | T001          | T002, T003, T004 (parallel) |
| 3     | T002–T004     | T005                        |
| 4     | T005          | T006, T007 (parallel)       |
| 5     | T006–T007     | T008                        |
| 6     | T008          | T009                        |
| 7     | T009          | T010                        |
| 8     | T010          | T011                        |
| 9     | T011          | T012                        |
| 10    | T012          | T013                        |
| 11    | T013          | T014, T016 (parallel)       |
| 12    | T014, T016    | T015                        |
| 13    | T015          | T017                        |
| 14    | T017          | T018–T030 (all parallel)    |
| 15    | T018–T030     | T031                        |
| 16    | T031          | T032                        |
| 17    | T032          | T033, T034 (parallel)       |

---

## Open Risks

- T032 depends on finding the correct backoffice main router file path — plan says `apps/api/src/routes/backoffice/<main router>`. Implementor must locate the exact filename before executing T032.
- T016 adds a new Zod schema file in `packages/validation/src/backoffice/` — if this path does not yet exist, a `mkdir -p` will be needed first.

---

## Next Step

Proceed to Step 5 — Analyze.
