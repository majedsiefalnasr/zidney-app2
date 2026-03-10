# Tasks: Infrastructure & Governance Alignment

**Branch**: `infra-003-alignment` **Stage**: STAGE_INFRA_03_ALIGNMENT **Date**: 2026-03-04
**Status**: READY FOR EXECUTION **Spec**: `specs/runtime/infra-003-alignment/spec.md` **Plan**:
`specs/runtime/infra-003-alignment/plan.md`

---

## User Stories

| ID  | Story                                                   | Priority |
| --- | ------------------------------------------------------- | -------- |
| US1 | Developer can run all tests from repo root              | P1       |
| US2 | Developer can run E2E tests for UI applications         | P2       |
| US3 | Engineer formats code without ESLint/Prettier conflicts | P2       |
| US4 | Developer understands app/package purpose from README   | P3       |
| US5 | Skipped and flaky tests are addressed                   | P3       |

---

## Dependency Graph

```
Phase 1 (US1 — Vitest)
  └─→ Phase 2 (US1 continued — Test dirs required before E2E dirs exist for PW)
       └─→ Phase 3 (US2 — Playwright, requires e2e dirs from Phase 2)
            └─→ Phase 4 (US3 — ESLint/Prettier, parallel-safe with Phase 3 but scripts land in package.json after PW scripts)
                 Phase 5 (US5a — Flaky) ─┐ can run in parallel with each other
                 Phase 6 (US5b — Skips) ─┘ (but after Phase 1 completes vitest.config.ts)
                      └─→ Phase 7 (US4 — READMEs, fully independent; start after Phase 1)
                           └─→ Phase 8 (CI — requires all scripts from Phases 1–4)
```

> **Key sequencing rule**: Phase 2 must complete before Phase 3 (e2e dirs must exist before
> Playwright smoke tests are created into them). Phase 4 must complete before Phase 8 (CI references
> `bun run lint`, `bun run format:check`). Phases 5 and 6 depend only on Phase 1 completing
> (vitest.config.ts must be stable before skip review touches it). Phase 7 is fully independent and
> can start any time after Phase 1.

---

## Phase 1 — Vitest Configuration Consolidation

**US1 Goal**: Establish a single projects-based Vitest root config that orchestrates all apps and
packages. **Independent Test**: Run `bun run test` from repo root; confirm tests from all
apps/packages execute in one invocation.

- [x] T001 Rewrite root config to projects-based orchestrator (preserve full resolve.alias block;
      run `bun run test` after rewrite and confirm existing test count unchanged before proceeding
      to T002-T014) — vitest.config.ts
- [x] T002 [P] Strip apps/mmc/vitest.config.ts to minimal override (env + plugins + alias +
      setupFiles; remove coverage) — apps/mmc/vitest.config.ts
- [x] T003 [P] Strip apps/backoffice/vitest.config.ts to minimal override (env + plugins + alias +
      setupFiles; remove coverage) — apps/backoffice/vitest.config.ts
- [x] T004 [P] Strip apps/frontoffice/vitest.config.ts to minimal override (env + plugins + alias +
      setupFiles; remove coverage) — apps/frontoffice/vitest.config.ts
- [x] T005 [P] Strip packages/api-client/vitest.config.ts to minimal override (env + globals; remove
      custom include glob) — packages/api-client/vitest.config.ts
- [x] T006 [P] Create new minimal Vitest config for apps/api (node env, globals, setupFiles; include
      glob: `['./src/**/*.test.ts','./tests/unit/**/*.test.ts','./tests/integration/**/*.test.ts']`)
      — apps/api/vitest.config.ts
- [x] T007 [P] Create new minimal Vitest config for apps/worker (node env, globals, setupFiles;
      include glob: `['./src/**/*.test.ts','./tests/unit/**/*.test.ts']`; exclude load-testing
      tests) — apps/worker/vitest.config.ts
- [x] T008 [P] Create new minimal Vitest config for packages/domain-core (node env, globals, unit
      include glob) — packages/domain-core/vitest.config.ts
- [x] T009 [P] Create new minimal Vitest config for packages/logger (node env, globals, unit include
      glob) — packages/logger/vitest.config.ts
- [x] T010 [P] Create new minimal Vitest config for packages/config (node env, globals, unit include
      glob) — packages/config/vitest.config.ts
- [x] T011 [P] Create new minimal Vitest config for packages/redis-utils (node env, globals, unit
      include glob) — packages/redis-utils/vitest.config.ts
- [x] T012 [P] Create new minimal Vitest config for packages/types (node env, globals, unit include
      glob) — packages/types/vitest.config.ts
- [x] T013 [P] Create new minimal Vitest config for packages/ui-system (jsdom env, globals, unit
      include glob) — packages/ui-system/vitest.config.ts
- [x] T014 [P] Create new minimal Vitest config for packages/validation (node env, globals, unit
      include glob) — packages/validation/vitest.config.ts
- [x] T015 Update root scripts so test/test:unit/test:coverage work with the new projects config —
      package.json

---

## Phase 2 — Test Directory Structure Normalization

**US1 Goal**: All apps have unit/integration/e2e dirs; all packages have unit dir. E2e dirs must
exist before Playwright configs reference them. **Independent Test**: Confirm directory structure
via `find apps packages -type d -name e2e -o -name unit`.

- [x] T016 [P] Create missing e2e directory placeholder — apps/api/tests/e2e/.gitkeep
- [x] T017 [P] Create missing e2e directory placeholder — apps/backoffice/tests/e2e/.gitkeep
- [x] T018 [P] Create missing e2e directory placeholder — apps/frontoffice/tests/e2e/.gitkeep
- [x] T019 [P] Create missing unit directory placeholder — packages/api-client/tests/unit/.gitkeep
- [x] T020 [P] Create missing unit directory placeholder — packages/domain-core/tests/unit/.gitkeep
- [x] T021 [P] Create missing unit directory placeholder — packages/config/tests/unit/.gitkeep
- [x] T022 [P] Create missing unit directory placeholder — packages/logger/tests/unit/.gitkeep
- [x] T023 [P] Create missing unit directory placeholder — packages/redis-utils/tests/unit/.gitkeep
- [x] T024 [P] Create missing unit directory placeholder — packages/types/tests/unit/.gitkeep
- [x] T025 [P] Create missing unit directory placeholder — packages/validation/tests/unit/.gitkeep
- [x] T026 Investigate packages/api-client/tests/adapters/ — determine if adapter tests are pure
      unit tests; relocate to tests/unit/adapters/ if confirmed; update all relative import paths in
      relocated test files — packages/api-client/tests/
- [x] T027 Move packages/domain-core/tests/license/ into tests/unit/license/ to conform to standard
      directory structure; update all relative import paths in moved test files —
      packages/domain-core/tests/

---

## Phase 3 — Playwright Installation and Configuration

**US2 Goal**: Install Playwright; create per-app configs and smoke tests for MMC, Backoffice,
Frontoffice. **Independent Test**: Run `bunx playwright test --config apps/mmc/playwright.config.ts`
and confirm smoke test passes with dev server running.

- [x] T028 Install @playwright/test as root devDependency — package.json
- [x] T029 [P] Create Playwright config for MMC (baseURL 5173, testDir ./tests/e2e, chromium) —
      apps/mmc/playwright.config.ts
- [x] T030 [P] Create Playwright config for Backoffice (baseURL 5174, testDir ./tests/e2e, chromium)
      — apps/backoffice/playwright.config.ts
- [x] T031 [P] Create Playwright config for Frontoffice (baseURL 5175, testDir ./tests/e2e,
      chromium) — apps/frontoffice/playwright.config.ts
- [x] T032 [P] Create MMC smoke test (page.goto('/'), expect no error title, expect body visible) —
      apps/mmc/tests/e2e/smoke.spec.ts
- [x] T033 [P] Create Backoffice smoke test (page.goto('/'), expect login or root route renders) —
      apps/backoffice/tests/e2e/smoke.spec.ts
- [x] T034 [P] Create Frontoffice smoke test (page.goto('/'), expect root route renders) —
      apps/frontoffice/tests/e2e/smoke.spec.ts
- [x] T035 Create root-level E2E documentation/pattern file (NOT a runnable test — no root
      playwright.config.ts exists; this is a reference document showing the per-app smoke test
      pattern for contributors) — tests/e2e/app-load.spec.ts
- [x] T036 Create placeholder to track root e2e directory in version control — tests/e2e/.gitkeep
- [x] T037 Add tests/e2e/\*\* exclusion to root Vitest config exclude patterns so Playwright specs
      are not picked up by Vitest — vitest.config.ts
- [x] T038 Add test:e2e:mmc, test:e2e:backoffice, test:e2e:frontoffice, and test:e2e scripts to root
      — package.json

---

## Phase 4 — ESLint and Prettier Alignment

**US3 Goal**: Install Prettier; configure eslint-config-prettier; add format scripts. Zero
ESLint/Prettier conflicts. **Independent Test**: Run `bun run format:check && bun run lint` and
confirm zero conflicting errors.

- [x] T039 Install prettier and eslint-config-prettier as root devDependencies — package.json
- [x] T040 [P] Create Prettier config (semi:false, singleQuote:true, trailingComma:es5,
      printWidth:100) — prettier.config.mjs
- [x] T041 [P] Create Prettier ignore file (node_modules, dist, build, coverage, lock files) —
      .prettierignore
- [x] T042 Add eslint-config-prettier import and append as last flat config entry in root ESLint
      config — eslint.config.mjs
- [x] T043 Add format and format:check scripts to root package.json — package.json

---

## Phase 5 — Flaky Test Stabilization

**US5 Goal**: Investigate 2 flagged flaky test files; stabilize with deterministic assertions or
quarantine with QUARANTINE comment and tracking ref. **Independent Test**: Run `bun run test` 3
consecutive times and confirm consistent results across all runs.

- [x] T044 Investigate packages/api-client/tests/client.test.ts for race conditions, unresolved
      promises, fake timer misuse — packages/api-client/tests/client.test.ts
- [x] T045 Apply fix (deterministic mocks/await) or quarantine with
      `// QUARANTINE: <reason> // Tracking ref: INFRA-003-FLAKY-001` —
      packages/api-client/tests/client.test.ts
- [x] T046 Investigate apps/worker/tests/load-testing.test.ts for wall-clock timing assertions;
      determine if test belongs under tests/load/ — apps/worker/tests/load-testing.test.ts
- [x] T047 Apply fix or quarantine with
      `// QUARANTINE: <reason> // Tracking ref: INFRA-003-FLAKY-002`; relocate to tests/load/ if
      load test by nature — apps/worker/tests/load-testing.test.ts

---

## Phase 6 — Skipped Test Review

**US5 Goal**: Every skip marker in the codebase either re-enabled or annotated with
`// SKIP REASON: <explanation>`. DataTable.spec.ts exclude entry in vitest.config.ts also resolved.
**Independent Test**: Grep for `\.skip` across the codebase; confirm every occurrence has a SKIP
REASON comment on the preceding line or the test is re-enabled.

- [x] T048 [P] Review tests/unit/license-rbac.test.ts — re-enable if underlying issue resolved, else
      annotate with SKIP REASON comment — tests/unit/license-rbac.test.ts
- [x] T049 [P] Review tests/security/licenses.security.test.ts — re-enable or annotate —
      tests/security/licenses.security.test.ts
- [x] T050 [P] Review tests/integration/licenses.e2e.test.ts — re-enable or annotate —
      tests/integration/licenses.e2e.test.ts
- [x] T051 [P] Review tests/integration/provisioning-failure.test.ts — re-enable or annotate —
      tests/integration/provisioning-failure.test.ts
- [x] T052 [P] Review tests/integration/license-soft-lock.test.ts — re-enable or annotate —
      tests/integration/license-soft-lock.test.ts
- [x] T053 Review packages/ui-system/tests/unit/DataTable.spec.ts (also excluded in vitest config) —
      re-enable or annotate AND remove the exclude entry from vitest.config.ts (NOTE: T053 must run
      AFTER T037 due to shared vitest.config.ts modification) —
      packages/ui-system/tests/unit/DataTable.spec.ts + vitest.config.ts
- [x] T054 [P] Review packages/ui-system/tests/unit/composables.spec.ts — re-enable or annotate —
      packages/ui-system/tests/unit/composables.spec.ts
- [x] T055 [P] Review packages/ui-system/tests/unit/utilities.spec.ts — re-enable or annotate —
      packages/ui-system/tests/unit/utilities.spec.ts
- [x] T056 [P] Review apps/api/tests/integration/tenant-resolver.test.ts — re-enable or annotate —
      apps/api/tests/integration/tenant-resolver.test.ts
- [x] T057 [P] Review apps/worker/tests/unit/provisioning/provisioning.test.ts — re-enable or
      annotate — apps/worker/tests/unit/provisioning/provisioning.test.ts

---

## Phase 7 — README Creation

**US4 Goal**: Every apps/_ and packages/_ directory has a README with all required sections
(Purpose, Responsibilities, Dependencies, How to Run Tests, Environment Variables, Known
Boundaries; + Public API for packages). **Independent Test**: Confirm
`find apps packages -maxdepth 1 -mindepth 1 -type d` each maps to a README file with all required
section headings present.

- [x] T058 [P] Create apps/api README (Bun+Hono backend, tenant resolver, license middleware, DB
      config, test commands) — apps/api/README.md
- [x] T059 [P] Create apps/worker README (Redis-backed job processor, grading, provisioning, DLQ,
      test commands) — apps/worker/README.md
- [x] T060 [P] Create apps/mmc README (Platform control panel Vue3 SPA, Vitest + Playwright test
      commands, env vars) — apps/mmc/README.md
- [x] T061 [P] Create apps/backoffice README (Institution control panel Vue3 SPA, Vitest +
      Playwright test commands, env vars) — apps/backoffice/README.md
- [x] T062 [P] Create apps/frontoffice README (Student runtime Vue3 SPA, Vitest + Playwright test
      commands, env vars) — apps/frontoffice/README.md
- [x] T063 [P] Create packages/logger README (structured logger, required log fields, Public API:
      createLogger/Logger) — packages/logger/README.md
- [x] T064 [P] Create packages/config README (env var parsing/validation, Public API: config schema
      exports) — packages/config/README.md
- [x] T065 [P] Create packages/redis-utils README (rate limiting, lock patterns, queue helpers,
      Public API: algorithm functions) — packages/redis-utils/README.md
- [x] T066 [P] Create packages/api-client README (HTTP client adapter for Vue stores, Public API:
      createApiClient/adapter interfaces) — packages/api-client/README.md
- [x] T067 [P] Create packages/domain-core README (business logic,
      auth/tenants/licenses/attempts/RBAC, Public API: all domain service exports) —
      packages/domain-core/README.md
- [x] T068 [P] Create packages/validation README (Zod-based request validation schemas, Public API:
      all exported schemas) — packages/validation/README.md
- [x] T069 [P] Rewrite packages/types README — add all 7 required sections including Public API (all
      exported types, enums) — packages/types/README.md
- [x] T070 [P] Rewrite packages/ui-system README — add all 7 required sections including Public API
      (shadcn-vue components list) — packages/ui-system/README.md

---

## Phase 8 — CI Pipeline Preparation

**US1/US2/US3 Goal**: Create GitHub Actions CI workflow with 5 sequential stages (lint → typecheck →
unit → integration → e2e). No coverage thresholds. **Independent Test**: Push branch and confirm all
5 CI jobs appear in GitHub Actions; lint and typecheck jobs reach green.

- [x] T071 Create .github/workflows/ci.yml with 5 jobs: lint (add `--reporter=verbose`), typecheck,
      unit-tests (--reporter=verbose; needs lint+typecheck; add grep assertion:
      `! grep -r '\.skip' tests/ packages/ apps/ --include='*.test.ts' | grep -v 'SKIP REASON\|QUARANTINE'`),
      integration-tests (needs unit; postgres+redis services), e2e-tests (needs integration; dev
      servers + wait-on) — .github/workflows/ci.yml
- [x] T072 Add dev:backoffice and dev:frontoffice scripts to root package.json for CI e2e server
      start step — package.json

---

## Parallel Execution Guide

### Within-Phase Parallel Sets

| Phase | Can run in parallel                                                          | Must run serially after                                        |
| ----- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1     | T002–T014 (per-app/package vitest configs)                                   | T001 rewrites root first; T015 updates scripts last            |
| 2     | T016–T025 (gitkeep files)                                                    | T026–T027 need investigation before acting                     |
| 3     | T029–T034 (playwright configs and smoke tests)                               | T028 installs dep first; T037–T038 modify shared files last    |
| 4     | T040–T041 (prettier config + ignore)                                         | T039 installs dep first; T042 eslint update; T043 scripts last |
| 5     | T044 and T046 can investigate in parallel; T045 and T047 after investigation | Pairs: investigate then act                                    |
| 6     | T048–T052, T054–T057 (independent review per file)                           | T053 must be last (also touches vitest.config.ts)              |
| 7     | T058–T070 (all independent README files)                                     | All parallel                                                   |
| 8     | T071–T072 must be serial (both commit)                                       | T072 can be bundled with T071                                  |

### Cross-Phase Parallel Opportunities

- Phases 5 (flaky) can start as soon as Phase 1 completes (only modifies test files).
- Phase 6 (skip review): T048–T052, T054–T057 can start after Phase 1 completes. **EXCEPTION: T053
  must run AFTER T037 (Phase 3) because it also modifies `vitest.config.ts` — running concurrently
  would create a merge conflict that could lose the Playwright e2e exclusion.**
- Phase 7 is fully independent; README creation can begin immediately after Phase 1 and run
  alongside Phases 2–6.
- Phase 8 must be last (references scripts from Phases 1, 3, and 4).

---

## Validation Checklist (from plan.md)

| Check | Validation                                                | Covered by tasks |
| ----- | --------------------------------------------------------- | ---------------- |
| V001  | Exactly one root vitest.config.ts with projects setup     | T001–T015        |
| V002  | All modules have correct test directory structure         | T016–T027        |
| V003  | Playwright installed with per-app configs and smoke tests | T028–T038        |
| V004  | Prettier installed and ESLint flat config references it   | T039–T043        |
| V005  | All skipped tests reviewed and documented                 | T048–T057        |
| V006  | Flaky tests stabilized or quarantined                     | T044–T047        |
| V007  | All apps and packages have complete READMEs               | T058–T070        |
| V008  | CI supports lint + typecheck + unit + integration + e2e   | T071–T072        |

---

## Task Summary

| Phase | US    | Task Range | Count  | Description                             |
| ----- | ----- | ---------- | ------ | --------------------------------------- |
| 1     | US1   | T001–T015  | 15     | Vitest configuration consolidation      |
| 2     | US1   | T016–T027  | 12     | Test directory structure normalization  |
| 3     | US2   | T028–T038  | 11     | Playwright installation & configuration |
| 4     | US3   | T039–T043  | 5      | ESLint + Prettier alignment             |
| 5     | US5   | T044–T047  | 4      | Flaky test stabilization                |
| 6     | US5   | T048–T057  | 10     | Skipped test review                     |
| 7     | US4   | T058–T070  | 13     | README creation & rewrites              |
| 8     | US1–3 | T071–T072  | 2      | CI pipeline creation                    |
| **—** | **—** | **—**      | **72** | **TOTAL**                               |
