# Tasks: Global Error Boundary & Normalization Layer

**Stage**: STAGE_UI_04_GLOBAL_ERROR_HANDLING
**Phase**: 06_UI_APPLICATION_RUNTIME
**Spec**: `specs/runtime/ui-04-global-error-handling/spec.md`
**Plan**: `specs/runtime/ui-04-global-error-handling/plan.md`
**Generated**: 2026-04-06
**Total Tasks**: 32

---

## Phase 0 — Shared Package (Sequential — must complete before Phase 1)

- [ ] T001 [US1] Add 7 ErrorCodes + mapHttpStatusToCode to http-error.ts — `packages/api-client/src/http-error.ts`
- [ ] T002 [US1] Export mapHttpStatusToCode + normalizeResponseError from barrel — `packages/api-client/src/index.ts`

---

## Phase 1 — MMC Error Infrastructure (Group 1 — baseline)

- [ ] T003 [US2] Replace error-normalizer.ts + delete types.ts (NormalizedError) — `apps/mmc/src/core/errors/error-normalizer.ts`, `apps/mmc/src/core/errors/types.ts`
- [ ] T004 [US3] Create pure redact-error.ts with isProduction param — `apps/mmc/src/core/errors/redact-error.ts`
- [ ] T005 [US4] Create ErrorBoundary.vue with onErrorCaptured + fallback slot — `apps/mmc/src/core/errors/ErrorBoundary.vue`
- [ ] T006 [US5] Create global-error-handler.ts with window event listeners — `apps/mmc/src/core/errors/global-error-handler.ts`
- [ ] T007 [US6] Wrap RouterView with ErrorBoundary in App.vue — `apps/mmc/src/App.vue`
- [ ] T008 [US7] Insert Step 8.5 + app.provide logger/isProduction in main.ts — `apps/mmc/src/main.ts`

---

## Phase 1 — Backoffice Error Infrastructure (Group 2 — parallel with Group 3)

- [ ] T009 [P] [US2] Replace error-normalizer.ts + delete types.ts (NormalizedError) — `apps/backoffice/src/core/errors/error-normalizer.ts`, `apps/backoffice/src/core/errors/types.ts`
- [ ] T010 [P] [US3] Create pure redact-error.ts with isProduction param — `apps/backoffice/src/core/errors/redact-error.ts`
- [ ] T011 [P] [US4] Create ErrorBoundary.vue with onErrorCaptured + fallback slot — `apps/backoffice/src/core/errors/ErrorBoundary.vue`
- [ ] T012 [P] [US5] Create global-error-handler.ts with window event listeners — `apps/backoffice/src/core/errors/global-error-handler.ts`
- [ ] T013 [P] [US6] Wrap RouterView with ErrorBoundary in App.vue — `apps/backoffice/src/App.vue`
- [ ] T014 [P] [US7] Insert Step 8.5 + app.provide logger/isProduction in main.ts — `apps/backoffice/src/main.ts`

---

## Phase 1 — Frontoffice Error Infrastructure (Group 3 — parallel with Group 2)

- [ ] T015 [P] [US2] Replace error-normalizer.ts + delete types.ts (NormalizedError) — `apps/frontoffice/src/core/errors/error-normalizer.ts`, `apps/frontoffice/src/core/errors/types.ts`
- [ ] T016 [P] [US3] Create pure redact-error.ts with isProduction param — `apps/frontoffice/src/core/errors/redact-error.ts`
- [ ] T017 [P] [US4] Create ErrorBoundary.vue with onErrorCaptured + fallback slot — `apps/frontoffice/src/core/errors/ErrorBoundary.vue`
- [ ] T018 [P] [US5] Create global-error-handler.ts with window event listeners — `apps/frontoffice/src/core/errors/global-error-handler.ts`
- [ ] T019 [P] [US6] Wrap RouterView with ErrorBoundary in App.vue — `apps/frontoffice/src/App.vue`
- [ ] T020 [P] [US7] Insert Step 8.5 + app.provide logger/isProduction in main.ts — `apps/frontoffice/src/main.ts`

---

## Phase 2 — Unit Tests (all 3 apps — all parallelizable after Phase 1)

- [ ] T021 [P] [US8] Create error-normalizer.spec.ts (16 cases, 100% coverage) — `apps/mmc/src/core/errors/__tests__/error-normalizer.spec.ts`
- [ ] T022 [P] [US9] Create redact-error.spec.ts (6 cases, 100% coverage) — `apps/mmc/src/core/errors/__tests__/redact-error.spec.ts`
- [ ] T023 [P] [US10] Create global-error-handler.spec.ts (6 cases, >=90% coverage) — `apps/mmc/src/core/errors/__tests__/global-error-handler.spec.ts`
- [ ] T024 [P] [US10] Create ErrorBoundary.spec.ts (7 cases, >=80% branch coverage) — `apps/mmc/src/core/errors/__tests__/ErrorBoundary.spec.ts`
- [ ] T025 [P] [US8] Create error-normalizer.spec.ts (16 cases, 100% coverage) — `apps/backoffice/src/core/errors/__tests__/error-normalizer.spec.ts`
- [ ] T026 [P] [US9] Create redact-error.spec.ts (6 cases, 100% coverage) — `apps/backoffice/src/core/errors/__tests__/redact-error.spec.ts`
- [ ] T027 [P] [US10] Create global-error-handler.spec.ts (6 cases, >=90% coverage) — `apps/backoffice/src/core/errors/__tests__/global-error-handler.spec.ts`
- [ ] T028 [P] [US10] Create ErrorBoundary.spec.ts (7 cases, >=80% branch coverage) — `apps/backoffice/src/core/errors/__tests__/ErrorBoundary.spec.ts`
- [ ] T029 [P] [US8] Create error-normalizer.spec.ts (16 cases, 100% coverage) — `apps/frontoffice/src/core/errors/__tests__/error-normalizer.spec.ts`
- [ ] T030 [P] [US9] Create redact-error.spec.ts (6 cases, 100% coverage) — `apps/frontoffice/src/core/errors/__tests__/redact-error.spec.ts`
- [ ] T031 [P] [US10] Create global-error-handler.spec.ts (6 cases, >=90% coverage) — `apps/frontoffice/src/core/errors/__tests__/global-error-handler.spec.ts`
- [ ] T032 [P] [US10] Create ErrorBoundary.spec.ts (7 cases, >=80% branch coverage) — `apps/frontoffice/src/core/errors/__tests__/ErrorBoundary.spec.ts`

---

## Task Summary

| Category                            | Count |
| ----------------------------------- | ----- |
| Total tasks                         | 32    |
| Phase 0 (shared package)            | 2     |
| Phase 1 implementation (3 apps x 6) | 18    |
| Phase 2 tests (3 apps x 4)          | 12    |

## Risk Classification

| Task                            | Risk   | Reason                                                                          |
| ------------------------------- | ------ | ------------------------------------------------------------------------------- |
| T001                            | HIGH   | Shared package modification — breaks all 3 apps if incorrect                    |
| T002                            | HIGH   | Public API barrel change — downstream typecheck failure if missed               |
| T003                            | HIGH   | Atomic delete+replace — types.ts removal breaks imports if normalizer not ready |
| T009                            | HIGH   | Same as T003 for backoffice                                                     |
| T015                            | HIGH   | Same as T003 for frontoffice                                                    |
| T005, T011, T017                | MEDIUM | New Vue SFC with inject — provide/inject key must match main.ts                 |
| T006, T012, T018                | MEDIUM | Window event listeners — deregistration pattern required                        |
| T007-T008, T013-T014, T019-T020 | LOW    | App.vue wrap + main.ts bootstrap step are additive changes                      |
| T021-T032                       | LOW    | Test-only files — no production impact                                          |

## Parallel Execution Groups

| Group                | Tasks                     | Can run after             |
| -------------------- | ------------------------- | ------------------------- | --------- | ------------- |
| Group A (sequential) | T001 -> T002 -> T003-T008 | Start of stage            |
| Group B (parallel)   | T009-T014                 |                           | T015-T020 | T002 complete |
| Group C (parallel)   | T021-T032 (all 12)        | T008, T014, T020 complete |
