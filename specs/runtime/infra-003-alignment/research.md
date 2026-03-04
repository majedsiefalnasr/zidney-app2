# Research: Infrastructure & Governance Alignment — Current State Analysis

**Branch**: `infra-003-alignment`
**Date**: 2026-03-04
**Author**: SpecKit Phase 0 — Research Agent
**Stage**: STAGE_INFRA_03_ALIGNMENT
**Audit Source**: `infra-audit-report.json` (git SHA: `dfe11008e4c6f6459bd36abe77d7d6f66b1a8483`)

---

## 1. Vitest Configuration — Current State

### Discovered Configs (5 total)

| File                                   | Environment     | Globals | Coverage                 | Projects Used | Notes                                                |
| -------------------------------------- | --------------- | ------- | ------------------------ | ------------- | ---------------------------------------------------- |
| `vitest.config.ts` (root)              | `node`          | `true`  | enabled (text/json/html) | **NO**        | Monolithic flat config with extensive aliases        |
| `apps/mmc/vitest.config.ts`            | `jsdom`         | `true`  | none                     | NO            | Includes Vue plugin, resolve aliases, env vars       |
| `apps/backoffice/vitest.config.ts`     | `jsdom`         | `true`  | none                     | NO            | Includes Vue plugin, resolve aliases, env vars       |
| `apps/frontoffice/vitest.config.ts`    | `jsdom`         | `true`  | none                     | NO            | Includes Vue plugin, resolve aliases, env vars       |
| `packages/api-client/vitest.config.ts` | unset (default) | `true`  | none                     | NO            | Simple config with `include: ['tests/**/*.test.ts']` |

**No apps have `vitest.config.ts` for**: `apps/api`, `apps/worker`  
**No packages have `vitest.config.ts` for**: `domain-core`, `logger`, `config`, `redis-utils`, `types`, `ui-system`, `validation`

### Root Config Analysis

The root `vitest.config.ts`:

- Does **NOT** use Vitest `projects` configuration — it is a monolithic flat `test` block
- Manually aliases `hono`, `pg`, `bcrypt`, `redis`, `pinia`, `vue-router`, `vue`, and all `@zidney/*` packages
- Sets `environment: 'node'` globally — incompatible with `jsdom` tests from UI apps when run from root
- Centralizes coverage reporters (text, json, html) but has NO coverage directory or threshold configuration
- Excludes `packages/ui-system/tests/unit/DataTable.spec.ts` via `configDefaults.exclude`
- **Does not reference per-app vitest.config.ts files** — they are currently standalone / orphaned

### Per-App Config Analysis (mmc/backoffice/frontoffice)

All three configs have identical structure:

- `plugins: [vue()]` — necessary for Vue SFC parsing
- `resolve.alias` — hardcoded paths to packages (duplicates root config)
- `test.include` — fixed glob patterns for `tests/unit/` and `tests/integration/`
- `test.env` — VITE env vars (`VITE_API_BASE_URL`, `VITE_WORKSPACE_SLUG`)
- No `test.setupFiles` — these apps have no per-app setup file currently

### Key Gap

The root config and per-app configs are **completely disconnected**. Running `bun run test` from root uses the monolithic root config and sets `environment: 'node'` globally, which would break UI tests. Per-app configs can only be invoked by navigating into each app directory independently. There is no unified projects-based runner.

---

## 2. Test Directory Structure — Current State

### Apps

| App                | `tests/unit/` | `tests/integration/` | `tests/e2e/` | Other dirs                                                                       |
| ------------------ | ------------- | -------------------- | ------------ | -------------------------------------------------------------------------------- |
| `apps/api`         | ✅ present    | ✅ present           | ❌ MISSING   | `contract/`, `db/`, `domain/`, `fixtures/`, `load/`, `performance/`, `snapshot/` |
| `apps/backoffice`  | ✅ present    | ✅ present           | ❌ MISSING   | —                                                                                |
| `apps/frontoffice` | ✅ present    | ✅ present           | ❌ MISSING   | —                                                                                |
| `apps/mmc`         | ✅ present    | ✅ present           | ✅ present   | `audit/`, `performance/`                                                         |
| `apps/worker`      | ✅ present    | ✅ present           | N/A (non-UI) | `grading/`, `load/`, `snapshot/`                                                 |

### Packages

| Package                | `tests/unit/` | Notes                                                                            |
| ---------------------- | ------------- | -------------------------------------------------------------------------------- |
| `packages/api-client`  | ❌ MISSING    | Has `tests/adapters/` — needs `tests/unit/`                                      |
| `packages/domain-core` | ❌ MISSING    | Has `tests/license/` — needs `tests/unit/`                                       |
| `packages/config`      | ❌ MISSING    | No tests dir at all                                                              |
| `packages/logger`      | ❌ MISSING    | No tests dir at all                                                              |
| `packages/redis-utils` | ❌ MISSING    | No tests dir at all                                                              |
| `packages/types`       | ❌ MISSING    | No tests dir at all                                                              |
| `packages/ui-system`   | ✅ present    | Has `tests/unit/` with DataTable.spec.ts, composables.spec.ts, utilities.spec.ts |
| `packages/validation`  | ❌ MISSING    | No tests dir at all                                                              |

### Summary

Only `apps/mmc` has a complete test directory structure. All other apps are missing `e2e/`. Six packages are missing `tests/unit/` entirely.

---

## 3. Playwright — Current State

**Status: Not installed. Zero configuration.**

- `infra-audit-report.json` confirms: `"playwrightConfigs": []`
- No `playwright.config.ts` file exists anywhere in the repository
- `@playwright/test` is NOT present in root or any app `package.json`
- No `tests/e2e/` directory exists at the root level
- `apps/mmc` has `tests/e2e/` directory **but it is empty** (no spec files found)

---

## 4. ESLint & Prettier — Current State

### ESLint

- 4 eslint config files found:
  - `eslint.config.mjs` (root) — flat config, TypeScript ESLint, import-x, vue plugin
  - `apps/mmc/eslint.config.js` — flat config (per-app)
  - `apps/frontoffice/eslint.config.js` — flat config (per-app)
  - `apps/backoffice/eslint.config.js` — flat config (per-app)
- Root config is the authoritative config with full rule set (XSS, import firewall, api-client boundaries, etc.)
- Audit confirms: `"prettierConflictRisk": "NEEDS_ALIGNMENT"`

### Prettier

- **Not installed** — `prettier` is NOT present in root `package.json` devDependencies
- No `.prettierrc`, `prettier.config.mjs`, or `prettier.config.js` files exist
- No `format` or `format:check` scripts in root `package.json`
- `eslint-config-prettier` is NOT installed

### Root package.json Scripts (existing)

```json
{
  "typecheck:src": "tsc --noEmit",
  "typecheck:tests": "tsc --noEmit -p tsconfig.test.json",
  "typecheck": "bun typecheck:src && bun typecheck:tests",
  "lint": "eslint .",
  "test": "vitest run",
  "test:unit": "vitest run --dir tests/unit",
  "test:integration": "vitest run --dir tests/integration --fileParallelism=false",
  "test:performance": "vitest run --dir tests/performance",
  "test:static": "vitest run --dir tests/static",
  "test:coverage": "vitest run --coverage"
}
```

**Missing scripts**: `format`, `format:check`, `test:e2e`

---

## 5. Skipped Tests — Current State

**Count**: 10 files identified via static scan (may contain multiple skipped tests per file)

| File                                                       | Location                                          |
| ---------------------------------------------------------- | ------------------------------------------------- |
| `tests/unit/license-rbac.test.ts`                          | Root tests dir                                    |
| `tests/security/licenses.security.test.ts`                 | Root tests dir                                    |
| `tests/integration/licenses.e2e.test.ts`                   | Root tests dir                                    |
| `tests/integration/provisioning-failure.test.ts`           | Root tests dir                                    |
| `tests/integration/license-soft-lock.test.ts`              | Root tests dir                                    |
| `packages/ui-system/tests/unit/DataTable.spec.ts`          | Package (also globally excluded from root config) |
| `packages/ui-system/tests/unit/composables.spec.ts`        | Package                                           |
| `packages/ui-system/tests/unit/utilities.spec.ts`          | Package                                           |
| `apps/api/tests/integration/tenant-resolver.test.ts`       | App                                               |
| `apps/worker/tests/unit/provisioning/provisioning.test.ts` | App                                               |

**Note**: `packages/ui-system/tests/unit/DataTable.spec.ts` is both skipped AND currently excluded from the root vitest config via `configDefaults.exclude`. Any re-enablement requires removing this exclude entry as well.

---

## 6. Flaky Tests — Current State

**Count**: 2 files identified via static scan

| File                                       | Likely Cause                                                          |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `packages/api-client/tests/client.test.ts` | Network mock timing; likely uses fake timers or async waterfalls      |
| `apps/worker/tests/load-testing.test.ts`   | Load/timing-dependent test; wall-clock or concurrency non-determinism |

**Detection method**: `STATIC_SCAN_ONLY` — actual runtime flakiness has not been confirmed by 3-consecutive-run validation. Investigation is required during T005 implementation.

---

## 7. README Coverage — Current State

**Total directories requiring README**: 13 (5 apps + 8 packages)  
**Current README coverage**: 2/13 files exist but with 0/7 required sections complete

| Directory              | README exists | Required sections complete |
| ---------------------- | ------------- | -------------------------- |
| `apps/mmc`             | ❌ MISSING    | —                          |
| `apps/frontoffice`     | ❌ MISSING    | —                          |
| `apps/backoffice`      | ❌ MISSING    | —                          |
| `apps/api`             | ❌ MISSING    | —                          |
| `apps/worker`          | ❌ MISSING    | —                          |
| `packages/types`       | ✅ exists     | 0/7 sections               |
| `packages/logger`      | ❌ MISSING    | —                          |
| `packages/config`      | ❌ MISSING    | —                          |
| `packages/redis-utils` | ❌ MISSING    | —                          |
| `packages/ui-system`   | ✅ exists     | 0/7 sections               |
| `packages/api-client`  | ❌ MISSING    | —                          |
| `packages/domain-core` | ❌ MISSING    | —                          |
| `packages/validation`  | ❌ MISSING    | —                          |

**11 directories need new READMEs**, 2 need full rewrites.

---

## 8. CI Pipeline — Current State

**Status: No CI pipeline exists.**

- No `.github/` directory at the repository root (only appears inside `node_modules`)
- No `.github/workflows/` directory
- No CircleCI, GitLab CI, or other CI configuration files found
- CI must be created from scratch as part of T008
- Package manager confirmed: `pnpm@10.12.2` (from `packageManager` field in `package.json`)

---

## 9. Consolidation Risk

**Risk level reported by audit**: `HIGH`

Root cause: The root vitest config uses hardcoded module aliases that resolve app-level `node_modules` (hono, pg, bcrypt, redis, pinia, vue-router, vue). When migrating to a projects-based config:

- Per-project configs must either inherit or re-declare these aliases
- OR the root config retains `resolve.alias` as a shared context
- The `environment: 'node'` at root must NOT override jsdom in per-app configs — this is the key risk

**Decision** (from clarification Q1): Per-app `vitest.config.ts` files are **kept as minimal overrides** with only `environment`, `setupFiles`, and `env` fields. The root config becomes the projects orchestrator with coverage centralized. Per-app aliases and plugins are retained at the app level since the projects model allows per-project resolution.

---

## 10. Decisions & Rationale

| Decision                                                                                                 | Rationale                                                                                      |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Keep per-app `vitest.config.ts` with minimal overrides (env + setupFiles + env vars)                     | Preserves jsdom vs node isolation (clarification Q1)                                           |
| Playwright uses `test:e2e` script, excluded from Vitest projects glob                                    | E2E needs running dev server; must not run during `bun run test` (clarification Q2)            |
| Quarantine flaky tests with `it.skip()` + `// QUARANTINE: <reason> <tracking-ref>`                       | No quarantine file/dir needed; verbose reporter shows skips (clarification Q3)                 |
| READMEs are free-form with required section checklist                                                    | No internal template exists; FR-032/FR-033 defines mandatory sections (clarification Q4)       |
| `eslint-config-prettier` applied globally in root `eslint.config.mjs`                                    | Single authoritative config; prevents per-app Prettier rule conflicts (clarification Q5)       |
| CI must be created from scratch (no existing workflows)                                                  | Repo has no `.github/workflows/` directory                                                     |
| per-app vitest configs for API and Worker do not exist; these apps have their tests in root `tests/` dir | Need to decide how to handle this during T001 — API/Worker tests currently run via root config |

---

## 11. Open Investigation Items (for T005 execution)

1. **`packages/api-client/tests/client.test.ts`** — Inspect for race conditions, fake timer usage, unresolved promises
2. **`apps/worker/tests/load-testing.test.ts`** — Inspect for wall-clock timing assertions (`setTimeout`, `Date.now()` comparisons), verify if it should be excluded from standard test run and placed under `test:performance`

---

## 12. Summary of Gaps by Task

| Task | Gap                                                                            | Severity |
| ---- | ------------------------------------------------------------------------------ | -------- |
| T001 | Root vitest.config.ts not using `projects`; 5 disconnected configs             | HIGH     |
| T002 | 4 apps missing `e2e/`; 6 packages missing `tests/unit/`                        | MEDIUM   |
| T003 | Playwright not installed; 0 playwright configs; 0 smoke tests                  | HIGH     |
| T004 | Prettier not installed; eslint-config-prettier not installed; 0 format scripts | HIGH     |
| T005 | 2 flaky test files need investigation                                          | MEDIUM   |
| T006 | 10 files with unexplained skip markers                                         | MEDIUM   |
| T007 | 11 READMEs missing; 2 READMEs need full rewrites                               | MEDIUM   |
| T008 | No CI pipeline exists — must build from scratch                                | HIGH     |
