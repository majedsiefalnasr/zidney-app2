# Tasks: STAGE_TEST_01_UI_RUNTIME_VALIDATION

**Feature Branch**: `spec/test-01-ui-runtime-validation`
**Stage**: STAGE_TEST_01_UI_RUNTIME_VALIDATION
**Phase**: 06_UI_APPLICATION_RUNTIME
**Stage Type**: VALIDATION-ONLY — test files and run commands only; no production code changes
**Input**: `specs/runtime/test-01-ui-runtime-validation/`
**Plan**: `specs/runtime/test-01-ui-runtime-validation/plan.md`
**Spec**: `specs/runtime/test-01-ui-runtime-validation/spec.md`
**Research**: `specs/runtime/test-01-ui-runtime-validation/research.md`

> **Note**: No story labels are used in this stage — all tasks serve a single validation objective.
> File content for every task is fully specified in `plan.md`. Do not invent content.

## Format: `[ID] [P?] Description — exact file path`

- **[P]**: Can run in parallel (targets different files, no unresolved dependency)
- No `[US*]` story labels — this is a single-objective validation stage

---

## Phase 0: Baseline Confirmation

**Purpose**: Confirm all existing test files covering validation criteria pass before any new file is introduced.

- [ ] T001 Run existing test suite baseline — execute the full command from `plan.md` Phase 0 against all 31 files spanning `tests/integration/*/auth/`, `tests/unit/*/core/`, `apps/*/src/core/guards/__tests__/`, `apps/*/src/core/errors/__tests__/`, and `apps/mmc/src/core/errors/__tests__/redact-error.spec.ts`; confirm exit code 0 with zero failures

---

## Phase 1: Static Analysis Coverage (GAP 3)

**Purpose**: Create a new Vitest file that codifies grep-based assertions for Tests 3.1, 5.3, 6.1, and 7.1 — covering raw HTTP usage, XSS surface, env secrets, and business-logic placement.

- [ ] T002 Create `tests/validation/static-analysis.test.ts` — new file; content fully specified in `plan.md` Phase 1; covers Tests 3.1 (no raw fetch/axios/XHR), 7.1 (no v-html), 6.1 (.env.production not git-tracked), 5.3 (no direct apiClient calls in .vue files); run after creation to confirm all four describe blocks pass

---

## Phase 2: Error Normalizer Extension (GAP 2)

**Purpose**: Append the HTTP status code propagation describe block (Test 3.2) to each app's error-normalizer spec. Tasks are independent (different files) and may run in parallel.

- [ ] T003 [P] Extend `apps/mmc/src/core/errors/__tests__/error-normalizer.spec.ts` — append the `"normalizeError — HTTP status code propagation (Test 3.2)"` describe block from `plan.md` Phase 2 (5 it-blocks: 403→PERMISSION_DENIED, 423→LOCKED, 426→UPGRADE_REQUIRED, 429→RATE_LIMITED, 500→SERVER_ERROR); add `AdapterResponse` import only if not already present; do not modify existing tests
- [ ] T004 [P] Extend `apps/backoffice/src/core/errors/__tests__/error-normalizer.spec.ts` — same describe block and rules as T003; adjust imports to backoffice paths
- [ ] T005 [P] Extend `apps/frontoffice/src/core/errors/__tests__/error-normalizer.spec.ts` — same describe block and rules as T003; adjust imports to frontoffice paths

---

## Phase 3: Correlation ID Test (GAP 1)

**Purpose**: Create a new unit test that verifies `applyCorrelationId()` sets `X-Correlation-ID` correctly on every outgoing request (Test 3.3).

- [ ] T006 Create `tests/unit/api-client/interceptors/correlation-id.test.ts` — new file in new directory `tests/unit/api-client/interceptors/`; content fully specified in `plan.md` Phase 2 (GAP 1); 5 it-blocks covering explicit ID, auto-UUID generation, UUID uniqueness, exact key name, and overwrite behaviour; import `applyCorrelationId` from `../../../../packages/api-client/src/interceptors`

---

## Phase 4: Store Isolation Test (GAP 4)

**Purpose**: Create a new unit test confirming each app instantiates its own Pinia instance rather than importing a shared cross-app singleton (Test 5.1).

- [ ] T007 Create `tests/unit/store-isolation.test.ts` — new file; content fully specified in `plan.md` Phase 2 (GAP 4); reads `apps/{mmc,backoffice,frontoffice}/src/main.ts` via `readFileSync`; 7 it-blocks: per-app `createPinia()` call, per-app import from `'pinia'`, per-app absence of `@zidney/*` pinia import, plus one cross-app check for `const pinia = createPinia()`

---

## Phase 5: Session Clear Wiring Extension (GAP 5)

**Purpose**: Append the `licenseStatusStore` reset assertions (Tests 5.2, 2.3) to each app's session-clear-wiring integration test. Tasks target different files and may run in parallel.

- [ ] T008 [P] Extend `tests/integration/mmc/auth/session-clear-wiring.test.ts` — append the `"licenseStatusStore cleared on session expiry (Tests 5.2, 2.3)"` describe block from `plan.md` Phase 2 (GAP 5); 2 it-blocks: `isWorkspaceLocked` reset and `isUpgradeRequired` reset; add `useLicenseStatusStore` import from `../../../../apps/mmc/src/core/state/license-status.store` if not present; do not modify existing tests
- [ ] T009 [P] Extend `tests/integration/backoffice/auth/session-clear-wiring.test.ts` — same describe block and rules as T008; adjust import to `../../../../apps/backoffice/src/core/state/license-status.store`
- [ ] T010 [P] Extend `tests/integration/frontoffice/auth/session-clear-wiring.test.ts` — same describe block and rules as T008; adjust import to `../../../../apps/frontoffice/src/core/state/license-status.store`

---

## Phase 6: Full Gap Suite Validation

**Purpose**: Run every new and extended test file in one pass to confirm all gaps are closed and zero failures remain.

- [ ] T011 Run all new and extended test files — execute `bun run test tests/validation/static-analysis.test.ts tests/unit/api-client/interceptors/correlation-id.test.ts tests/unit/store-isolation.test.ts apps/mmc/src/core/errors/__tests__/error-normalizer.spec.ts apps/backoffice/src/core/errors/__tests__/error-normalizer.spec.ts apps/frontoffice/src/core/errors/__tests__/error-normalizer.spec.ts tests/integration/mmc/auth/session-clear-wiring.test.ts tests/integration/backoffice/auth/session-clear-wiring.test.ts tests/integration/frontoffice/auth/session-clear-wiring.test.ts`; confirm exit code 0 with zero failures

---

## Phase 7: Build Validation

**Purpose**: Confirm typecheck, lint, and production builds are clean for all three apps — covers Test 6.2. Archive output to `specs/runtime/test-01-ui-runtime-validation/reports/build-validation.log`.

- [ ] T012 Run typecheck and lint across all apps — execute `rtk bun run typecheck` then `rtk bun run lint`; both must exit 0
- [ ] T013 [P] Build `apps/mmc` for production — `cd apps/mmc && bun run build`; must exit 0
- [ ] T014 [P] Build `apps/backoffice` for production — `cd apps/backoffice && bun run build`; must exit 0
- [ ] T015 [P] Build `apps/frontoffice` for production — `cd apps/frontoffice && bun run build`; must exit 0

---

## Phase 8: Integration Tests Re-Run

**Purpose**: Re-run the 401 race and session-clear integration suites after all gap files are in place — covers Tests 1.1, 1.2, 5.2, 2.3. Archive output to `specs/runtime/test-01-ui-runtime-validation/reports/integration-tests.log`.

- [ ] T016 Run auth + session-clear integration suite — execute `rtk bun run test tests/integration/mmc/auth/401-race.test.ts tests/integration/backoffice/auth/401-race.test.ts tests/integration/frontoffice/auth/401-race.test.ts tests/integration/mmc/auth/session-clear-wiring.test.ts tests/integration/backoffice/auth/session-clear-wiring.test.ts tests/integration/frontoffice/auth/session-clear-wiring.test.ts`; confirm exit code 0

---

## Phase 9: Performance Baseline (NON-BLOCKING)

**Purpose**: Establish router navigation p95 baseline (<50ms guard + mount, net of API data loading). Result does NOT gate stage promotion. Archive to `specs/runtime/test-01-ui-runtime-validation/reports/perf-baseline.md`.

- [ ] T017 Run Playwright smoke tests and record navigation baseline — execute `rtk bun run playwright test apps/mmc/tests/e2e/smoke.spec.ts apps/backoffice/tests/e2e/smoke.spec.ts apps/frontoffice/tests/e2e/smoke.spec.ts tests/e2e/app-load.spec.ts`; record p95 metric; NON-BLOCKING — does not gate stage promotion

---

## Dependencies

```
T001                       ← baseline gate; must pass before any new file is created
  └── T002 (Phase 1)       ← static analysis; independent of Phase 2–5
  └── T003, T004, T005 (Phase 2) ← parallel; independent of each other
  └── T006 (Phase 3)       ← independent of Phase 2
  └── T007 (Phase 4)       ← independent of Phase 2–3
  └── T008, T009, T010 (Phase 5) ← parallel; independent of each other; depends on T001 only
T002–T010 → T011           ← all gap work must complete before full validation run
T011 → T012                ← gap suite must pass before build validation
T012 → T013, T014, T015   ← parallel build tasks; typecheck+lint must pass first
T013, T014, T015 → T016    ← integration re-run after builds confirmed clean
T016 → T017                ← perf baseline is last (non-blocking)
```

## Parallel Execution Summary

| Wave | Tasks                                  | Can start when        |
| ---- | -------------------------------------- | --------------------- |
| 1    | T001                                   | Always                |
| 2    | T002, T003–T005, T006, T007, T008–T010 | T001 passes           |
| 3    | T011                                   | T002–T010 complete    |
| 4    | T012                                   | T011 passes           |
| 5    | T013, T014, T015                       | T012 passes           |
| 6    | T016                                   | T013, T014, T015 pass |
| 7    | T017 (non-blocking)                    | T016 passes           |

## Task Summary

| Metric                       | Count    |
| ---------------------------- | -------- |
| Total tasks                  | 17       |
| Parallelizable tasks [P]     | 9        |
| New files created            | 4        |
| Existing files extended      | 6        |
| Blocking tasks (gap closure) | 16       |
| Non-blocking tasks           | 1 (T017) |

## New Files

| File                                                        | Gap | Tests              |
| ----------------------------------------------------------- | --- | ------------------ |
| `tests/validation/static-analysis.test.ts`                  | G3  | 3.1, 5.3, 6.1, 7.1 |
| `tests/unit/api-client/interceptors/correlation-id.test.ts` | G1  | 3.3                |
| `tests/unit/store-isolation.test.ts`                        | G4  | 5.1                |

## Extended Files

| File                                                                  | Gap | Tests    |
| --------------------------------------------------------------------- | --- | -------- |
| `apps/mmc/src/core/errors/__tests__/error-normalizer.spec.ts`         | G2  | 3.2      |
| `apps/backoffice/src/core/errors/__tests__/error-normalizer.spec.ts`  | G2  | 3.2      |
| `apps/frontoffice/src/core/errors/__tests__/error-normalizer.spec.ts` | G2  | 3.2      |
| `tests/integration/mmc/auth/session-clear-wiring.test.ts`             | G5  | 5.2, 2.3 |
| `tests/integration/backoffice/auth/session-clear-wiring.test.ts`      | G5  | 5.2, 2.3 |
| `tests/integration/frontoffice/auth/session-clear-wiring.test.ts`     | G5  | 5.2, 2.3 |

## Stage Promotion Gate

Phase 06 cannot be marked **VALIDATED** until:

- [ ] T001 passes (baseline clean)
- [ ] T011 passes (all gap files green)
- [ ] T013, T014, T015 pass (all production builds clean)
- [ ] T016 passes (integration suite re-run clean)
- T017 (perf baseline) is recorded but does not block promotion
