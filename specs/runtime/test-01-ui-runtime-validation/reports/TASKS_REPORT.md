# Tasks Report — UI Runtime Validation

**Step:** 4 — Tasks
**Timestamp:** 2026-04-08T01:00:00.000Z
**Status:** COMPLETE

---

## Summary

17 atomic tasks generated across 9 phases covering the full validation scope. All tasks produce test files or run commands only — zero production code modifications. 9 tasks are parallelizable (Phase 2, Phase 5, Phase 7 builds). Task dependency chain is linear at the phase level: Baseline → Gap Closure → Validation Run → Build Validation → Integration Re-run → Perf Baseline.

---

## Inputs Reviewed

- `specs/runtime/test-01-ui-runtime-validation/spec.md` — 22 tests across 8 areas
- `specs/runtime/test-01-ui-runtime-validation/plan.md` — 5-phase plan + 5 coverage gaps (G1–G5)
- `specs/runtime/test-01-ui-runtime-validation/research.md` — coverage gap analysis (31 existing files, 5 gap files)

---

## Task Breakdown

| Category                | Tasks                | Count  | Notes                                                                          |
| ----------------------- | -------------------- | ------ | ------------------------------------------------------------------------------ |
| Baseline run            | T001                 | 1      | Confirms 31 existing files pass before any gap work                            |
| New test files          | T002, T006, T007     | 3      | `static-analysis.test.ts`, `correlation-id.test.ts`, `store-isolation.test.ts` |
| Extended test files     | T003–T005, T008–T010 | 6      | 3× `error-normalizer.spec.ts`, 3× `session-clear-wiring.test.ts`               |
| Full gap validation run | T011                 | 1      | All new + extended files in one pass                                           |
| Build validation        | T012–T015            | 4      | typecheck + lint (T012), per-app production builds (T013–T015 parallel)        |
| Integration re-run      | T016                 | 1      | auth + session-clear suites after gap closure                                  |
| Perf baseline           | T017                 | 1      | NON-BLOCKING — Playwright smoke + p95 navigation metric                        |
| **Total**               | —                    | **17** | 16 blocking, 1 non-blocking                                                    |

---

## Coverage Gap Closure

| Gap                          | Tasks     | Tests Covered            | File(s)                                                                 |
| ---------------------------- | --------- | ------------------------ | ----------------------------------------------------------------------- |
| G1 — Correlation ID          | T006      | Test 3.3                 | `tests/unit/api-client/interceptors/correlation-id.test.ts` (NEW)       |
| G2 — HTTP status propagation | T003–T005 | Test 3.2                 | `apps/*/src/core/errors/__tests__/error-normalizer.spec.ts` (EXTEND ×3) |
| G3 — Static analysis         | T002      | Tests 3.1, 5.3, 6.1, 7.1 | `tests/validation/static-analysis.test.ts` (NEW)                        |
| G4 — Store isolation         | T007      | Test 5.1                 | `tests/unit/store-isolation.test.ts` (NEW)                              |
| G5 — Session-clear wiring    | T008–T010 | Tests 5.2, 2.3           | `tests/integration/*/auth/session-clear-wiring.test.ts` (EXTEND ×3)     |

---

## Risk-Ranked Task Summary

| Task ID   | Risk      | Description                                                                                            |
| --------- | --------- | ------------------------------------------------------------------------------------------------------ |
| T002      | 🟡 MEDIUM | Create `tests/validation/static-analysis.test.ts` — uses `rg`/`grep` subprocess                        |
| T006      | 🟡 MEDIUM | Create `tests/unit/api-client/interceptors/correlation-id.test.ts` — imports interceptor from packages |
| T007      | 🟡 MEDIUM | Create `tests/unit/store-isolation.test.ts` — reads `main.ts` via `readFileSync`                       |
| T003      | 🟢 LOW    | Extend `apps/mmc` `error-normalizer.spec.ts` — append only                                             |
| T004      | 🟢 LOW    | Extend `apps/backoffice` `error-normalizer.spec.ts` — append only                                      |
| T005      | 🟢 LOW    | Extend `apps/frontoffice` `error-normalizer.spec.ts` — append only                                     |
| T008      | 🟢 LOW    | Extend `tests/integration/mmc/auth/session-clear-wiring.test.ts` — append only                         |
| T009      | 🟢 LOW    | Extend `tests/integration/backoffice/auth/session-clear-wiring.test.ts` — append only                  |
| T010      | 🟢 LOW    | Extend `tests/integration/frontoffice/auth/session-clear-wiring.test.ts` — append only                 |
| T001      | 🟢 LOW    | Baseline run — read-only command                                                                       |
| T011      | 🟢 LOW    | Full gap validation run — read-only command                                                            |
| T012      | 🟢 LOW    | typecheck + lint — read-only commands                                                                  |
| T013–T015 | 🟢 LOW    | Production builds — compile only                                                                       |
| T016      | 🟢 LOW    | Integration re-run — read-only command                                                                 |
| T017      | 🟢 LOW    | Perf baseline — NON-BLOCKING                                                                           |

---

## Tasks with External Dependencies

| Task ID   | Package               | Version Note                                                                                                                |
| --------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| T003–T005 | `packages/api-client` | `AdapterResponse` type — verified in plan.md GAP 2 against current `AdapterResponse` shape: `{ status, headers, body, ok }` |
| T006      | `packages/api-client` | `applyCorrelationId()` from `packages/api-client/src/interceptors` — verified exists in research.md                         |
| T002      | ripgrep (`rg`) / grep | `rg --version` availability guard required (Architecture Guardian advisory)                                                 |

---

## High-Downstream-Impact Tasks

No tasks in this stage modify architectural hotspots. All changes are test-only with no production code paths modified.

---

## Transactional Tasks

None — this is a validation-only stage. No write-path tasks.

---

## Idempotency Tasks

None — this is a validation-only stage. No idempotency requirements.

---

## Architecture Governance Compliance

| Check                                        | Status | Notes                                                       |
| -------------------------------------------- | ------ | ----------------------------------------------------------- |
| All write paths include transaction tasks    | ✅ N/A | Validation-only stage — no production write paths           |
| Idempotency tasks are defined where required | ✅ N/A | No idempotency surface in test files                        |
| Layer boundary rules are respected           | ✅     | Test files do not import DB schemas or cross app boundaries |
| No unrelated file modifications planned      | ✅     | Only test files and AGENTS.md-approved validation files     |
| Migration tasks included when required       | ✅ N/A | No schema changes                                           |
| Trust chain respected                        | ✅     | Tests validate isolation; no code bypasses trust chain      |
| Import boundaries respected                  | ✅     | Tests import from `packages/*` only via standard paths      |
| Architecture guard task included             | ✅     | T012 includes `bun run lint` + `bun run typecheck`          |

**Overall:** COMPLIANT

---

## Parallel Execution Summary

| Wave | Tasks                                                | Dependency         |
| ---- | ---------------------------------------------------- | ------------------ |
| 1    | T001                                                 | Always             |
| 2    | T002, T003, T004, T005, T006, T007, T008, T009, T010 | T001 passes        |
| 3    | T011                                                 | T002–T010 complete |
| 4    | T012                                                 | T011 passes        |
| 5    | T013, T014, T015                                     | T012 passes        |
| 6    | T016                                                 | T013–T015 pass     |
| 7    | T017 (non-blocking)                                  | T016 passes        |

---

## Open Risks

1. **`rg` availability** (T002): `static-analysis.test.ts` uses `rg` subprocess. Architecture Guardian flagged: add `rg --version` guard that throws if absent. Will be addressed in T002 implementation.
2. **`license-status.store` path** (T008–T010): Store may not exist in all three apps. Requires verification during T008–T010 (fall back to plan.md alternative if store is absent).
3. **`applyCorrelationId` export** (T006): Interceptor must be exported from `packages/api-client/src/interceptors` index. Verify export exists before writing T006 test.

---

## Next Step

Proceed to Step 5 — Analyze.
