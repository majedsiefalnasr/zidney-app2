# Tasks: ENV Configuration

**Input**: Design documents from `specs/runtime/ui-05-env-configuration/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/env-module-api.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup — Shared Types (packages/types)

**Purpose**: Create compile-time-only shared TypeScript interfaces that all three apps implement. Zero runtime footprint.

- [X] T001 Create shared env config interfaces (`ZidneyEnvConfig`, `ZidneyFeatureFlags`, `ZidneyAppConfig`) in `packages/types/src/env-config.ts`
- [X] T002 Re-export env config types from `packages/types/src/index.ts`

**Checkpoint**: Shared types compile. No runtime code added.

---

## Phase 2: Foundational — MMC Reference Implementation

**Purpose**: Implement the full env configuration pattern in MMC as the reference. All user stories are implemented here first. MUST complete before Backoffice/Frontoffice phases.

**⚠️ CRITICAL**: This phase establishes the pattern that Backoffice and Frontoffice replicate.

### US1 — Centralized Environment Access (P1)

- [X] T003 [US1] Refactor `apps/mmc/src/core/config/env.ts` — replace `resolveConfig()` with `createEnvConfig(overrides?)` factory function that reads `import.meta.env`, accepts optional `Partial<EnvConfig>` overrides for testability, validates required vars, returns `Object.freeze()`-ed `EnvConfig` implementing `ZidneyEnvConfig`
- [X] T004 [US1] In `createEnvConfig()` inside `apps/mmc/src/core/config/env.ts`, read `VITE_APP_ENV` instead of Vite `MODE` for application environment. Add `normalizeAppEnv()` that maps `'staging'`→`'staging'`, `'production'`→`'production'`, `'development'`→`'development'`, and returns `'development'` as fallback — **GUARDIAN FIX**: unrecognized values must cause all mode helpers to return `false` (see T008 for the fix in `normalizeAppEnv`)
- [X] T005 [US1] Add `ImportMetaEnv` interface augmentation to `apps/mmc/src/vite-env.d.ts` declaring `VITE_API_BASE_URL`, `VITE_APP_ENV`, `VITE_APP_NAME`, `VITE_DEBUG_MODE`, `VITE_ENABLE_DEBUG_PANEL`
- [X] T006 [US1] Rewrite `apps/mmc/tests/unit/core/env-config.test.ts` — replace `vi.stubEnv()`/`vi.resetModules()` pattern with factory-based tests: valid config, missing `VITE_API_BASE_URL` throws, `appEnv` normalization, overrides applied, returned object is frozen, mutation has no effect

### US2 — API Base URL Resolution (P1)

- [X] T007 [US2] Create `apps/mmc/src/core/config/app-config.ts` — import `createEnvConfig()` and `createFeatureFlags()`, compose frozen `appConfig: AppConfig` aggregate, export `getApiBase()` returning `envConfig.apiBaseUrl`, export `appConfig` and standalone `featureFlags` — **GUARDIAN FIX**: must export standalone `featureFlags` per contract
- [X] T008 [US2] Update `apps/mmc/src/main.ts` — change `import '@/core/config/env'` to `import '@/core/config/app-config'`
- [X] T009 [US2] Update `apps/mmc/src/core/api/client.ts` — change `import { appConfig } from '@/core/config/env'` to `import { appConfig, getApiBase } from '@/core/config/app-config'`, update `AppConfig` type import path
- [X] T010 [P] [US2] Create `apps/mmc/tests/unit/core/app-config.test.ts` — test `getApiBase()` returns `apiBaseUrl`, test `appConfig` is frozen, test `appConfig.env` is frozen, test `appConfig.flags` is frozen

### US3 — Environment Mode Helpers (P2)

- [X] T011 [US3] Add mode helpers `isDev()`, `isProd()`, `isStaging()` as standalone exported functions in `apps/mmc/src/core/config/app-config.ts` — pure functions of frozen `envConfig`
- [X] T012 [US3] **GUARDIAN FIX**: Update `normalizeAppEnv()` in `apps/mmc/src/core/config/env.ts` to NOT default unrecognized values to `'development'` — instead, store the raw normalized value and let mode helpers return `false` for all when `appEnv` is not one of the three known values. Change `appEnv` type to `string` internally and keep the union type for known values only in the validation path
- [X] T013 [P] [US3] Add mode helper tests to `apps/mmc/tests/unit/core/app-config.test.ts` — `isDev()` true in development, `isProd()` true in production, `isStaging()` true in staging, all return `false` for unrecognized mode value (e.g., `'custom'`)

### US4 — Feature Flag Injection (P2)

- [X] T014 [US4] Create `apps/mmc/src/core/config/feature-flags.ts` — export `createFeatureFlags(env: EnvConfig)` factory that receives parsed env config, reads `VITE_ENABLE_DEBUG_PANEL` from `import.meta.env` only within `env.ts` — **GUARDIAN FIX**: `feature-flags.ts` must NOT read `import.meta.env` directly; all env reads go through `env.ts` per design decision D3. Instead, `createFeatureFlags` must accept overrides or the raw flag values passed from `env.ts`
- [X] T015 [US4] **GUARDIAN FIX**: Update `createFeatureFlags()` in `apps/mmc/src/core/config/feature-flags.ts` to accept and use its parameter/overrides object for testability — signature: `createFeatureFlags(overrides?: Partial<FeatureFlags>): FeatureFlags`
- [X] T016 [P] [US4] Create `apps/mmc/tests/unit/core/feature-flags.test.ts` — test `parseBooleanFlag`: `"true"`→`true`, `"1"`→`true`, `"yes"`→`true`, `"false"`→`false`, `undefined`→`false`; test returned flags are frozen; test mutation has no effect; test overrides are applied

### US5 — Secure Exposure Policy (P1)

- [X] T017 [US5] Add `no-restricted-syntax` ESLint rule to `apps/mmc/eslint.config.js` targeting `MemberExpression` for `import.meta.env` — applied to all `**/*.ts` and `**/*.vue` files, ignoring `src/core/config/env.ts`
- [X] T018 [P] [US5] Verify no `import.meta.env` usage exists outside `apps/mmc/src/core/config/env.ts` by running ESLint on the MMC app

### US6 — Test Environment Support (P2)

- [X] T019 [US6] Verify factory pattern enables isolated testing in `apps/mmc/tests/unit/core/env-config.test.ts` — add test that provides mock overrides to `createEnvConfig()` without `vi.stubEnv()` and confirms mocked values returned
- [X] T020 [P] [US6] Add test in `apps/mmc/tests/unit/core/app-config.test.ts` that simulates staging mode via factory override and verifies `isStaging()` returns `true`

### US7 — Multi-App Consistency (P3) — deferred to Phase 5

### Environment Files

- [X] T021 [P] Create/update `apps/mmc/.env.example` — document all `VITE_` variables: `VITE_API_BASE_URL`, `VITE_APP_ENV`, `VITE_APP_NAME`, `VITE_DEBUG_MODE`, `VITE_ENABLE_DEBUG_PANEL` — **GUARDIAN FIX**: include comment documenting `MODE → VITE_APP_ENV` migration (old `MODE` usage replaced by `VITE_APP_ENV`)

**Checkpoint**: MMC env configuration is fully functional. All 7 user stories covered (US7 validated in Phase 5). Factory pattern works. Lint rule active. Tests pass.

---

## Phase 3: Backoffice — Extension Pattern

**Purpose**: Replicate MMC pattern with Backoffice-specific `workspaceSlug` extension.

### US1 — Centralized Environment Access (P1)

- [X] T022 [US1] Refactor `apps/backoffice/src/core/config/env.ts` — replace `resolveConfig()` with `createEnvConfig(overrides?)` factory. Extend `ZidneyEnvConfig` with `BackofficeEnvConfig` adding optional `workspaceSlug`. Read `VITE_WORKSPACE_SLUG` additionally. Use `VITE_APP_ENV` instead of `MODE`. **GUARDIAN FIX**: `normalizeAppEnv()` must handle unrecognized values (not default to `'development'`). Return `Object.freeze()`-ed config.
- [X] T023 [P] [US1] Add `ImportMetaEnv` interface augmentation to `apps/backoffice/src/vite-env.d.ts` declaring `VITE_API_BASE_URL`, `VITE_APP_ENV`, `VITE_APP_NAME`, `VITE_DEBUG_MODE`, `VITE_ENABLE_DEBUG_PANEL`, `VITE_WORKSPACE_SLUG`
- [X] T024 [P] [US1] Rewrite `apps/backoffice/tests/unit/core/env-config.test.ts` — factory pattern tests including `workspaceSlug` override, unrecognized `appEnv` handling, frozen output

### US2 — API Base URL Resolution (P1)

- [X] T025 [US2] Create `apps/backoffice/src/core/config/app-config.ts` — compose frozen `appConfig`, export `getApiBase()`, `isDev()`, `isProd()`, `isStaging()`, standalone `featureFlags` — **GUARDIAN FIX**: must export standalone `featureFlags`
- [X] T026 [US2] Update `apps/backoffice/src/main.ts` — change `import '@/core/config/env'` to `import '@/core/config/app-config'`
- [X] T027 [US2] Update `apps/backoffice/src/core/api/client.ts` — change imports from `@/core/config/env` to `@/core/config/app-config`
- [X] T028 [P] [US2] Create `apps/backoffice/tests/unit/core/app-config.test.ts` — test `getApiBase()`, frozen `appConfig`, mode helpers, unrecognized mode returns `false` for all

### US4 — Feature Flag Injection (P2)

- [X] T029 [US4] Create `apps/backoffice/src/core/config/feature-flags.ts` — `createFeatureFlags(overrides?)` factory. **GUARDIAN FIX**: must NOT read `import.meta.env` directly; accept overrides parameter for testability
- [X] T030 [P] [US4] Create `apps/backoffice/tests/unit/core/feature-flags.test.ts` — boolean normalization, frozen output, overrides applied

### US5 — Secure Exposure Policy (P1)

- [X] T031 [US5] Add `no-restricted-syntax` ESLint rule to `apps/backoffice/eslint.config.js` targeting `import.meta.env` MemberExpression — ignoring `src/core/config/env.ts`
- [X] T032 [P] [US5] Verify no `import.meta.env` usage outside `apps/backoffice/src/core/config/env.ts`

### Environment Files

- [X] T033 [P] Update `apps/backoffice/.env.example` — document all `VITE_` variables including `VITE_WORKSPACE_SLUG`. **GUARDIAN FIX**: include `MODE → VITE_APP_ENV` migration comment

**Checkpoint**: Backoffice env configuration is fully functional. Extension pattern with `workspaceSlug` validated.

---

## Phase 4: Frontoffice

**Purpose**: Replicate MMC pattern exactly (no extensions). Completes the three-app rollout.

### US1 — Centralized Environment Access (P1)

- [X] T034 [US1] Refactor `apps/frontoffice/src/core/config/env.ts` — replace `resolveConfig()` with `createEnvConfig(overrides?)` factory. Use `VITE_APP_ENV` instead of `MODE`. **GUARDIAN FIX**: `normalizeAppEnv()` handles unrecognized values. Return `Object.freeze()`-ed config.
- [X] T035 [P] [US1] Add `ImportMetaEnv` interface augmentation to `apps/frontoffice/src/vite-env.d.ts` declaring `VITE_API_BASE_URL`, `VITE_APP_ENV`, `VITE_APP_NAME`, `VITE_DEBUG_MODE`, `VITE_ENABLE_DEBUG_PANEL`
- [X] T036 [P] [US1] Rewrite `apps/frontoffice/tests/unit/core/env-config.test.ts` — factory pattern tests, unrecognized `appEnv` handling, frozen output

### US2 — API Base URL Resolution (P1)

- [X] T037 [US2] Create `apps/frontoffice/src/core/config/app-config.ts` — compose frozen `appConfig`, export `getApiBase()`, `isDev()`, `isProd()`, `isStaging()`, standalone `featureFlags` — **GUARDIAN FIX**: must export standalone `featureFlags`
- [X] T038 [US2] Update `apps/frontoffice/src/main.ts` — change `import '@/core/config/env'` to `import '@/core/config/app-config'`
- [X] T039 [US2] Update `apps/frontoffice/src/core/api/client.ts` — change imports from `@/core/config/env` to `@/core/config/app-config`
- [X] T040 [P] [US2] Create `apps/frontoffice/tests/unit/core/app-config.test.ts` — test `getApiBase()`, frozen `appConfig`, mode helpers, unrecognized mode returns `false` for all

### US4 — Feature Flag Injection (P2)

- [X] T041 [US4] Create `apps/frontoffice/src/core/config/feature-flags.ts` — `createFeatureFlags(overrides?)` factory. **GUARDIAN FIX**: must NOT read `import.meta.env` directly; accept overrides parameter
- [X] T042 [P] [US4] Create `apps/frontoffice/tests/unit/core/feature-flags.test.ts` — boolean normalization, frozen output, overrides applied

### US5 — Secure Exposure Policy (P1)

- [X] T043 [US5] Add `no-restricted-syntax` ESLint rule to `apps/frontoffice/eslint.config.js` targeting `import.meta.env` MemberExpression — ignoring `src/core/config/env.ts`
- [X] T044 [P] [US5] Verify no `import.meta.env` usage outside `apps/frontoffice/src/core/config/env.ts`

### Environment Files

- [X] T045 [P] Update `apps/frontoffice/.env.example` — document all `VITE_` variables. **GUARDIAN FIX**: include `MODE → VITE_APP_ENV` migration comment

**Checkpoint**: Frontoffice env configuration is fully functional. Same API surface as MMC.

---

## Phase 5: Cross-App Validation & Polish

**Purpose**: Validate multi-app consistency (US7), run final checks, clean up.

### US7 — Multi-App Consistency (P3)

- [X] T046 [US7] Verify all three apps export the same public API surface from `app-config.ts`: `appConfig`, `featureFlags`, `isDev()`, `isProd()`, `isStaging()`, `getApiBase()` — compare function signatures and return types
- [X] T047 [US7] Run TypeScript compiler across all three apps — verify all `EnvConfig` types satisfy `ZidneyEnvConfig` interface from `packages/types`
- [X] T048 [US7] Run ESLint across all three apps — confirm zero violations of `no-restricted-syntax` rule for `import.meta.env` outside `env.ts`
- [X] T049 [US7] Run all unit tests across all three apps — confirm env-config, feature-flags, and app-config test suites pass

### Cross-Cutting Concerns

- [X] T050 [P] Scan all three apps for any remaining `import { appConfig } from '@/core/config/env'` references — migrate to `@/core/config/app-config`
- [X] T051 [P] Scan all three apps for any remaining `appConfig.buildEnv` references — migrate to `appConfig.env.appEnv`
- [X] T052 [P] Scan all three apps for any remaining `appConfig.apiBaseUrl` direct references — migrate to `appConfig.env.apiBaseUrl` or `getApiBase()`
- [X] T053 [P] Scan all three apps for any remaining `appConfig.debugMode` references — migrate to `appConfig.env.debugMode`
- [X] T054 Run `quickstart.md` validation — follow the developer usage guide end-to-end in one app and confirm imports, mode helpers, feature flags, and lint behavior work as documented

**Checkpoint**: All three apps are consistent. All tests pass. Lint clean. Migration complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Shared Types)**: No dependencies — start immediately
- **Phase 2 (MMC)**: Depends on Phase 1 completion — BLOCKS Phases 3 & 4
- **Phase 3 (Backoffice)**: Depends on Phase 2 pattern established — can run in PARALLEL with Phase 4
- **Phase 4 (Frontoffice)**: Depends on Phase 2 pattern established — can run in PARALLEL with Phase 3
- **Phase 5 (Cross-App Validation)**: Depends on Phases 2, 3, and 4 ALL complete

### Within Phase 2 (MMC) — Execution Order

1. **T003–T006** (US1): Foundational — env.ts factory must exist first
2. **T007–T010** (US2): Depends on T003 — app-config.ts composes env.ts
3. **T011–T013** (US3): Depends on T007 — mode helpers live in app-config.ts
4. **T014–T016** (US4): Depends on T003 — feature-flags.ts receives from env.ts
5. **T017–T018** (US5): Independent of US2–US4 — lint config only
6. **T019–T020** (US6): Depends on T003, T007 — validates factory testability
7. **T021**: Independent — env file documentation

### Parallel Opportunities

**Phase 1**:

- T001 and T002 are sequential (create then export)

**Phase 2 (after T003–T006 complete)**:

- T007 (app-config) and T014 (feature-flags) can start in parallel
- T017 (eslint) can start in parallel with US2–US4
- T021 (.env.example) can start in parallel with everything after T001

**Phases 3 & 4**:

- ALL of Phase 3 and ALL of Phase 4 can run in parallel (different apps, different files)
- Within each phase, same ordering as Phase 2

**Phase 5**:

- T050–T053 (migration scans) can all run in parallel
- T046–T049 (validation) are sequential

---

## Guardian-Identified Corrections Summary

| #   | Correction                                                                                                            | Tasks            |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | `feature-flags.ts` must NOT read `import.meta.env` directly — all env reads through `env.ts` per D3                   | T014, T029, T041 |
| 2   | `normalizeAppEnv` must handle unrecognized values so all mode helpers return `false` (not default to `'development'`) | T012, T022, T034 |
| 3   | `createFeatureFlags` must accept and use its parameter/overrides for testability                                      | T015, T029, T041 |
| 4   | Add standalone `featureFlags` export to `app-config.ts` per contract                                                  | T007, T025, T037 |
| 5   | Document `MODE → VITE_APP_ENV` migration in `.env` files                                                              | T021, T033, T045 |

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2 Only)

1. Complete Phase 1: Shared Types (T001–T002)
2. Complete Phase 2: MMC Reference (T003–T021)
3. **STOP and VALIDATE**: Run MMC tests, lint, type-check
4. Confirm pattern is correct before replicating

### Incremental Delivery

1. Phase 1 + Phase 2 → MMC validated → Pattern locked
2. Phase 3 + Phase 4 (parallel) → Backoffice + Frontoffice → Each validated independently
3. Phase 5 → Cross-app consistency confirmed → Feature complete

### Suggested MVP Scope

- Phase 1 (2 tasks) + Phase 2 (19 tasks) = 21 tasks for MVP
- Delivers all 7 user stories in the reference app
- Phases 3–5 are replication + validation (33 additional tasks)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in same phase
- All `import.meta.env` access is confined to `env.ts` in each app — enforced by lint + design
- `feature-flags.ts` receives flag values as parameters, never reads env directly
- Existing `resolveConfig()` callers (`api/client.ts`) must be migrated to `app-config.ts` imports
- Current tests use `vi.stubEnv()` — new tests use factory overrides pattern
- `MODE` env var is replaced by `VITE_APP_ENV` for application environment detection
