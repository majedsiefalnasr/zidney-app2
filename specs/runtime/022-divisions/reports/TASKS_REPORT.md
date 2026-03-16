# Tasks Report — Divisions

**Step:** 4 — Tasks
**Timestamp:** 2026-03-16T00:04:00Z
**Status:** COMPLETE

---

## Summary

36 atomic tasks generated and dependency-ordered across 6 phases. All tasks include exact file
paths. Parallel markers applied where concurrent execution is safe. Constitutional compliance
confirmed — all write paths are transactional, idempotency tasks defined, layer boundaries
respected.

---

## Inputs Reviewed

- `specs/runtime/022-divisions/spec.md`
- `specs/runtime/022-divisions/plan.md`
- `specs/runtime/022-divisions/data-model.md`
- `specs/runtime/022-divisions/research.md`
- `specs/runtime/022-divisions/tasks.md`

---

## Task Breakdown

| Category / Phase                  | Count  | Notes                                                                                                    |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| Phase 0 — Foundation (pre-checks) | 7      | T001–T007: read-only verification, 6 parallel                                                            |
| Phase 1 — Data Layer              | 5      | T008 migration (sequential) + T009–T012 schemas (3 parallel)                                             |
| Phase 2 — Domain Layer            | 5      | T013–T014 parallel, T015 service (sequential), T016 index, T017 root export                              |
| Phase 3 — Validation Layer        | 2      | T018 Zod schemas (sequential), T019 index re-export                                                      |
| Phase 4 — API Layer               | 11     | T020 helpers (sequential), T021–T027 handlers (parallel), T028 helpers.ts, T029 router index, T030 mount |
| Phase 5 — Tests                   | 3      | T031 unit, T032 integration, T033 [P] edge-case/idempotency                                              |
| **Total**                         | **36** |                                                                                                          |

---

## Transactional Tasks

- **T008** — Migration: all 8 DDL steps wrapped in `BEGIN / try / COMMIT / catch ROLLBACK`
- **T025** — `delete.ts`: checks student/staff assignments before DELETE; single-transaction guard
- **T027** — `post-disable.ts`: `SERIALIZABLE` isolation for full workspace-wide transition; atomic
  reassignment of students and staff to default division before marking `divisions_enabled = false`
- All other write handlers use implicit per-statement transactions (single-write, no multi-step state)

---

## Idempotency Tasks

- **T022** — `create.ts`: UNIQUE constraint on name → 409 DIVISION_NAME_CONFLICT on duplicate
- **T026** — `assign-staff.ts`: `INSERT ... ON CONFLICT DO NOTHING` — repeat assign calls are safe
- **T027** — `post-disable.ts`: re-entry guard checks `divisions_enabled = false` first → 422 if already disabled; SERIALIZABLE prevents double-execution
- **T028** — `remove-staff.ts`: `DELETE ... WHERE staff_id = $1 AND division_id = $2`; 404 if absent
- **T031** — Unit tests include idempotency scenario coverage for all service functions
- **T033** — Idempotency/edge-case tests replay destructive operations to confirm safe re-entry

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                                  |
| -------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | T008, T025, T027 explicitly transactional                              |
| Idempotency tasks are defined where required | ✅     | T022, T026, T027, T028 all have idempotency strategies                 |
| Layer boundary rules are respected           | ✅     | Domain logic in `packages/domain-core`; no DB in UI; no HTTP in domain |
| No unrelated file modifications planned      | ✅     | Only stage-scoped files in plan; no cross-stage mutations              |
| Migration tasks included when required       | ✅     | T008 covers full schema_version 1.4.0 → 1.5.0 migration                |

**Overall: COMPLIANT**

---

## Critical Ordering Notes

1. **T008 before T009–T012**: Migration must exist before schema files import from it for types
2. **T013–T014 before T015**: `divisions.types.ts` and `divisions.errors.ts` must exist before `divisions.service.ts`
3. **T018 before T020–T029**: Zod validation schemas must exist before route handlers import them
4. **T020 before T021–T027**: `helpers.ts` must exist before handler files use it
5. **T027 route registered before `/:id`**: `POST /disable-divisions` must be mounted before `/:id` in the Hono router to avoid path conflict (T029)

---

## Open Risks

- Phase 0 pre-checks (T001, T002) assume STAGE_17 bootstrap migration exists and seeded at least one default division — migration will fail at STEP 5 otherwise
- T008 STEP 6 `ALTER students ... SET NOT NULL` will take `ACCESS EXCLUSIVE` lock; recommend off-peak deployment for tenants with > 10K students

---

## Next Step

Proceed to Step 5 — Analyze.
