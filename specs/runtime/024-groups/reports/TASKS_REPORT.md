# Tasks Report — Groups (STAGE_24_GROUPS)

**Step:** 4 — Tasks  
**Timestamp:** 2026-03-19T02:00:00.000Z  
**Status:** COMPLETE

---

## Summary

25 atomic tasks generated across 5 phases covering the full Groups feature implementation:
DB schema and migration, domain service layer, validation, 11 API route handlers + router, backoffice
router registration, and unit + integration test suites. All tasks are ordered by execution dependency
with parallelism groups declared. No tasks are deferred.

---

## Inputs Reviewed

- `specs/runtime/024-groups/spec.md`
- `specs/runtime/024-groups/plan.md`
- `specs/runtime/024-groups/research.md`
- `specs/runtime/024-groups/data-model.md`
- `specs/runtime/024-groups/tasks.md`

---

## Task Breakdown

| Phase                    | Tasks     | Parallel Tasks       | Notes                                         |
| ------------------------ | --------- | -------------------- | --------------------------------------------- |
| Phase 0 — Infrastructure | T001–T004 | T001+T002, T003+T004 | DB schema + migration                         |
| Phase 1 — Domain Layer   | T005–T009 | T005+T006            | Types, errors, repository, service, barrel    |
| Phase 2 — Validation     | T010      | —                    | Single Zod schemas file                       |
| Phase 3 — API Routes     | T011–T022 | T011–T021            | 11 handlers parallel, router sequential after |
| Phase 4 — Router Reg.    | T023      | —                    | Mount groups router in backoffice             |
| Phase 5 — Tests          | T024–T025 | T024+T025            | Unit + integration parallel                   |
| **Total**                | **25**    | **17 parallel**      | All user stories US1–US5 covered              |

### Detailed Count by Category

| Category            | Count  | Files                                                                                                                        |
| ------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| DB Schema           | 3      | groups.schema.ts, staff-groups.schema.ts, schemas/index.ts                                                                   |
| Migration           | 1      | 20260319_001_groups.ts                                                                                                       |
| Domain Layer        | 5      | types, errors, repository, service, barrel                                                                                   |
| Validation          | 1      | groups.schemas.ts (Zod)                                                                                                      |
| API Route Handlers  | 11     | list, create, get, update, delete, assign-student, remove-student, get-student, assign-staff, remove-staff, get-staff-groups |
| API Router          | 1      | groups/index.ts (createGroupsRouter)                                                                                         |
| Router Registration | 1      | backoffice/index.ts (modify)                                                                                                 |
| Tests               | 2      | groups.service.test.ts, groups.routes.test.ts                                                                                |
| **Total**           | **25** |                                                                                                                              |

---

## Transactional Tasks

Tasks that require a PostgreSQL transaction (`BEGIN … COMMIT`):

- **T008** (`groups.service.ts`) — All write-path service functions: `createGroup`, `updateGroup`, `softDeleteGroup`, `assignStudentToGroup`, `removeStudentFromGroup`, `assignStaffToGroup`, `removeStaffFromGroup` must execute within a single `PoolClient` transaction
- **T015** (`delete-group.ts`) — Handler passes single client for transactional soft-delete with student/staff count guards and SAVEPOINT-isolated exam/ads target guards
- **T016** (`assign-student-group.ts`) — `SELECT FOR UPDATE` on `groups` row and atomic `UPDATE students` within a single transaction to prevent `max_members` race condition

---

## Idempotency Tasks

Tasks that enforce idempotency (safe to replay without side effects):

- **T007 / T008** (`groups.repository.ts` + `groups.service.ts`) — Student assignment uses `UPDATE students SET group_id=$new WHERE id=$sid` to ensure idempotent re-assignment (not INSERT); count query excludes current student to avoid spurious `GROUP_MAX_MEMBERS_EXCEEDED`
- **T019** (`assign-staff-group.ts`) — `INSERT INTO staff_groups … ON CONFLICT DO NOTHING` ensures idempotent staff assignment
- **T022** (`groups/index.ts`) — Router assembles idempotent middleware chain including `correlationId` propagation

---

## User Story Coverage

| User Story                     | Tasks                  |
| ------------------------------ | ---------------------- |
| US1 — Create and list groups   | T011, T012, T022, T023 |
| US2 — View and update groups   | T013, T014             |
| US3 — Delete group with guards | T015                   |
| US4 — Student assignment       | T016, T017, T018       |
| US5 — Staff assignment         | T019, T020, T021       |
| Infrastructure (no story)      | T001–T010, T022–T025   |

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                                 |
| ----------------------------------------- | ------ | --------------------------------------------------------------------- |
| All write paths include transaction tasks | ✅     | T008 service layer, T015/T016 route handlers                          |
| Idempotency tasks defined where required  | ✅     | T008 student assign, T019 staff assign ON CONFLICT DO NOTHING         |
| Layer boundary rules respected            | ✅     | DB schema → domain → validation → routes; no cross-layer imports      |
| No unrelated file modifications planned   | ✅     | Only backoffice/index.ts (mount) + schemas/index.ts (export) modified |
| Migration tasks included                  | ✅     | T004: 20260319_001_groups.ts, 1.6.0 → 1.7.0                           |
| SAVEPOINT pattern (AD-05) tasks present   | ✅     | T008 repository + T015 handler                                        |
| SELECT FOR UPDATE (AD-03) tasks present   | ✅     | T008 service + T016 route                                             |
| Soft-delete only (AD-02)                  | ✅     | T008 `softDeleteGroup` sets `deleted_at = NOW()`                      |

**Overall:** COMPLIANT

---

## Open Risks

- **RISK-01** (LOW): `apps/api/src/db/tenant/schemas/index.ts` is a barrel file shared across all tenant schemas. T003 modifies this file. If other in-flight PRs also modify this file, a merge conflict is likely. Mitigation: sequential merge ordering for schema barrel files.
- **RISK-02** (LOW): `apps/api/src/routes/backoffice/index.ts` (T023) is the backoffice router index. Same shared-file merge conflict risk as RISK-01.

---

## Next Step

Proceed to Step 5 — Analyze (Drift Detector).
