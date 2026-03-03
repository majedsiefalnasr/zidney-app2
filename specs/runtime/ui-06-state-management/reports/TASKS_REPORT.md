# Tasks Report — STAGE_UI_06_STATE_MANAGEMENT

**Step:** 4 — Tasks
**Timestamp:** 2026-03-03T00:03:00.000Z
**Status:** COMPLETE
**Tasks Total:** 38

---

## Summary

38 dependency-ordered atomic tasks generated across 8 groups. The task set follows the plan's
5-phase structure (Infrastructure, MMC, Backoffice, Frontoffice, Validation) and identifies 8
parallel execution batches to minimize implementation wall time. All tasks reference exact file
paths and are traceable back to spec functional requirements.

---

## Task Breakdown

| Group                       | Tasks     | Count  | Dependencies        |
| --------------------------- | --------- | ------ | ------------------- |
| A — Infrastructure          | T001–T005 | 5      | None (all parallel) |
| B — MMC Stores              | T006–T011 | 6      | T001, T004          |
| C — Backoffice Stores       | T012–T018 | 7      | T001, T004          |
| D — Frontoffice Stores      | T019–T024 | 6      | T001, T004          |
| E1 — MMC Unit Tests         | T025–T027 | 3      | T006–T011           |
| E2 — Backoffice Unit Tests  | T028–T031 | 4      | T012–T018           |
| E3 — Frontoffice Unit Tests | T032–T034 | 3      | T019–T024           |
| E4 — Integration & CI Tests | T035–T038 | 4      | All Phase A–D       |
| **TOTAL**                   |           | **38** |                     |

---

## Parallel Execution Batches

| Batch | Tasks            | Condition                                                  |
| ----- | ---------------- | ---------------------------------------------------------- |
| 1     | T001, T002, T003 | All independent — install dep across 3 apps simultaneously |
| 2     | T004, T005       | Shared helper + ESLint rule — independent                  |
| 3     | T007–T010        | 4 MMC store files — after T006 (main.ts)                   |
| 4     | T013–T017        | 5 Backoffice store files — after T012 (main.ts)            |
| 5     | T020–T023        | 4 Frontoffice store files — after T019 (main.ts)           |
| 6     | T025–T027        | MMC unit tests — after T011 (index)                        |
| 7     | T028–T031        | Backoffice unit tests — after T018 (index)                 |
| 8     | T032–T037        | FO tests + integration — after T024 (index)                |

---

## Task Format Used

```
- [ ] T001 [P] Description with exact file path
- [ ] T002 [P] [US1] Description with exact file path
```

- `- [ ]` checkbox — incomplete; marked `- [X]` by speckit.implement when done
- `[P]` — parallel marker (can run concurrently with sibling tasks)
- `[US1]`–`[US5]` — user story traceability label

---

## Coverage Against Spec Requirements

| FR Category                           | Tasks Covering It                                                 |
| ------------------------------------- | ----------------------------------------------------------------- |
| FR-001 (Pinia in main.ts)             | T006, T012, T019                                                  |
| FR-002 (Composition API setup stores) | T007–T010, T013–T017, T020–T023                                   |
| FR-003 (TypeScript annotations)       | All store creation tasks                                          |
| FR-004 (core/state layout)            | T007–T010, T013–T017, T020–T023                                   |
| FR-008 (no direct HTTP in components) | T003 (ESLint rule)                                                |
| FR-016 + FR-017 (isLoading + error)   | All async store tasks                                             |
| FR-021 (persistedstate plugin)        | T006, T012, T019 (main.ts tasks)                                  |
| FR-022 (explicit pick whitelist)      | App store creation tasks                                          |
| FR-026 (JWT not in localStorage)      | Auth store tasks (T007, T013, T020); verified in T025, T028, T032 |
| FR-028 (isolated unit tests)          | T025–T034                                                         |
| FR-032 (store ID uniqueness)          | T038                                                              |
| SC-006 (TypeScript strict mode)       | T036 (type-check gate)                                            |

---

## Constitutional Compliance

| Check                                    | Status | Notes                                                |
| ---------------------------------------- | ------ | ---------------------------------------------------- |
| All spec functional requirements covered | ✅     | 37 FRs mapped to tasks                               |
| Database-per-tenant isolation preserved  | ✅ N/A | UI stage                                             |
| Testing tasks included                   | ✅     | T025–T038 cover all stores (unit + integration + CI) |
| Dependency order correct                 | ✅     | Infrastructure → App init → Stores → Tests           |
| No tasks modify staged/closed stages     | ✅     | All file paths within this stage's scope             |

**Overall:** COMPLIANT — Ready for drift analysis gate.

---

## Open Notes

- T038 (store ID uniqueness test) uses a grep-based approach per L-03 recommendation from API
  Designer — self-maintaining, not a hardcoded array.
- workspace.store.ts (T017) is a stub implementation — tests in T030 test lifecycle but not API
  integration.
- AppNotification type is defined locally in notification store files — identical shape across 3
  apps enforced by type-checking in tests.
