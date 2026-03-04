# Implementation Plan: Infrastructure & Governance Alignment

**Branch**: `infra-003-alignment`
**Date**: 2026-03-04
**Stage**: STAGE_INFRA_03_ALIGNMENT
**Status**: READY FOR IMPLEMENTATION
**Research Input**: `specs/runtime/infra-003-alignment/research.md`
**Spec Input**: `specs/runtime/infra-003-alignment/spec.md`

---

## Constitutional Compliance Check

| Rule                          | Impact on This Stage                       | Status       |
| ----------------------------- | ------------------------------------------ | ------------ |
| Database-per-tenant isolation | No DB changes in this stage                | ✅ COMPLIANT |
| License middleware unchanged  | No route or middleware changes             | ✅ COMPLIANT |
| Attempt engine integrity      | No grading or attempt logic changes        | ✅ COMPLIANT |
| No cross-tenant joins         | No new data access paths                   | ✅ COMPLIANT |
| Import boundary rules         | No cross-app imports introduced            | ✅ COMPLIANT |
| UI layer rules                | No business logic added to UI              | ✅ COMPLIANT |
| Migration discipline          | No migration files created or modified     | ✅ COMPLIANT |
| Secrets management            | No secrets introduced; `.env` not modified | ✅ COMPLIANT |
| Production package bundle     | All new deps are devDependencies only      | ✅ COMPLIANT |

**Verdict**: Infrastructure-only stage. No constitutional drift. Implementation authorized.

---

## Transaction Boundaries & Idempotency

**N/A for this stage.** This is an infrastructure and tooling alignment stage. There are no database transactions, tenant operations, or attempt engine interactions. All changes are:

- File system operations (create/modify config files, documentation, test directories)
- Package installation (devDependencies only)
- CI workflow creation

All operations are inherently idempotent: re-running them produces the same result as running them once.

---

## Error Handling Strategy

**N/A for production code.** This stage does not introduce new application error handling paths. However:

- Playwright smoke tests must handle the case where the dev server is not running: test pre-condition must be documented
- Flaky test quarantine must document the error/reason in the `// QUARANTINE:` comment
- CI pipeline failures on lint/type-check are by design (gates, not bugs)

---

## Phases Overview

| Phase   | Tasks    | Description                               |
| ------- | -------- | ----------------------------------------- |
| Phase 0 | Research | Complete (see `research.md`)              |
| Phase 1 | T001     | Vitest configuration consolidation        |
| Phase 2 | T002     | Test directory structure normalization    |
| Phase 3 | T003     | Playwright installation and configuration |
| Phase 4 | T004     | ESLint + Prettier alignment               |
| Phase 5 | T005     | Flaky test stabilization                  |
| Phase 6 | T006     | Skipped test review                       |
| Phase 7 | T007     | README creation                           |
| Phase 8 | T008     | CI pipeline preparation                   |

**Execution order**: Sequential. T002 must complete before T003 (e2e dirs must exist). T004 must complete before T008 (lint script must work). T006 can be done in parallel with T005.

---

## Phase 1 — T001: Vitest Configuration Consolidation

### Goal

Replace the current monolithic `vitest.config.ts` root config with a Vitest `projects`-based orchestrator. Each app/package retains a minimal `vitest.config.ts` with only environment, setupFiles, and env vars.

### Current State

- Root `vitest.config.ts`: monolithic, uses `test: { environment: 'node', globals: true, setupFiles, coverage }` — NOT using projects
- 5 disconnected configs (see research.md §1)
- `apps/api` and `apps/worker` have NO vitest configs; their tests run via root config using root test dirs (`tests/unit/`, `tests/integration/`)

### Architecture Decision

The root vitest config will become the **projects orchestrator**:

- `apps/*` and `packages/*` participate via their own minimal `vitest.config.ts` files
- Coverage config stays centralized in root only
- Root `resolve.alias` and `plugins` are **removed** from root (they were needed for flat mode; per-project configs handle their own resolution)
- The root `tests/` directory (containing integration, unit, security, etc.) continues to be managed via the root config itself, which also functions as one of the projects

### Step-by-step Actions

**Step 1.1 — Rewrite root `vitest.config.ts`**

Replace the monolithic config with a projects-based config that:

- Declares `test.projects` pointing to all apps and packages with vitest configs
- Declares `test.coverage` centrally (reporters, output, exclude patterns)
- Includes the root `tests/` directory as a direct project entry (since API/worker tests live there)
- Removes all resolve aliases (each app/package config handles its own)

**Step 1.2 — Reduce `apps/mmc/vitest.config.ts` to minimal override**

Keep only:

- `plugins: [vue()]` — required for `.vue` SFC parsing
- `test.environment: 'jsdom'`
- `test.globals: true`
- `test.env` (VITE_API_BASE_URL, VITE_WORKSPACE_SLUG)
- `resolve.alias` for `@` → `src` and `@zidney/*` packages (required for test resolution)

Remove: `test.include` glob patterns (root projects glob handles discovery)

**Step 1.3 — Reduce `apps/backoffice/vitest.config.ts` to minimal override**

Identical treatment to MMC.

**Step 1.4 — Reduce `apps/frontoffice/vitest.config.ts` to minimal override**

Identical treatment to MMC.

**Step 1.5 — Create `apps/api/vitest.config.ts`**

Create minimal config:

- `test.environment: 'node'`
- `test.globals: true`
- `test.setupFiles: ['../../tests/vitest.setup.ts']`
- Include patterns for `apps/api/tests/**/*.test.ts`
- Resolve aliases for `@zidney/*` packages

**Note**: Currently `apps/api` tests live in `apps/api/tests/` AND some tests are in the root `tests/` dir (the root tests are API-focused integration tests). The root `tests/` project entry will continue to handle root-level tests.

**Step 1.6 — Create `apps/worker/vitest.config.ts`**

Create minimal config:

- `test.environment: 'node'`
- `test.globals: true`
- `test.setupFiles: ['../../tests/vitest.setup.ts']`
- Include patterns for `apps/worker/tests/**/*.test.ts`
- Resolve aliases for `@zidney/*` packages

**Step 1.7 — Create vitest configs for packages without one**

Create minimal `vitest.config.ts` for each of:

- `packages/domain-core/`
- `packages/logger/`
- `packages/config/`
- `packages/redis-utils/`
- `packages/types/`
- `packages/ui-system/`
- `packages/validation/`

All use: `environment: 'node'`, `globals: true`, `include: ['tests/unit/**/*.spec.ts', 'tests/unit/**/*.test.ts']`

**Step 1.8 — Reduce `packages/api-client/vitest.config.ts` to minimal override**

Keep: `test.environment` (node), `test.globals: true`, resolve alias `@` → `src`
Remove: custom `test.include` (root projects glob handles discovery)

**Step 1.9 — Update root `package.json` scripts**

Update `test` script: `"vitest run"` stays but now discovers via projects  
Update `test:unit`: `"vitest run --project api-client --project domain-core ..."` (or leave pattern-based)  
Confirm `test:coverage` still works: centralized coverage via root config

### Files to Create/Modify

| File                                    | Action                                      |
| --------------------------------------- | ------------------------------------------- |
| `vitest.config.ts`                      | **MODIFY** — Rewrite to use `test.projects` |
| `apps/mmc/vitest.config.ts`             | **MODIFY** — Strip to minimal override      |
| `apps/backoffice/vitest.config.ts`      | **MODIFY** — Strip to minimal override      |
| `apps/frontoffice/vitest.config.ts`     | **MODIFY** — Strip to minimal override      |
| `apps/api/vitest.config.ts`             | **CREATE** — New minimal config             |
| `apps/worker/vitest.config.ts`          | **CREATE** — New minimal config             |
| `packages/domain-core/vitest.config.ts` | **CREATE** — New minimal config             |
| `packages/logger/vitest.config.ts`      | **CREATE** — New minimal config             |
| `packages/config/vitest.config.ts`      | **CREATE** — New minimal config             |
| `packages/redis-utils/vitest.config.ts` | **CREATE** — New minimal config             |
| `packages/types/vitest.config.ts`       | **CREATE** — New minimal config             |
| `packages/ui-system/vitest.config.ts`   | **CREATE** — New minimal config             |
| `packages/validation/vitest.config.ts`  | **CREATE** — New minimal config             |
| `packages/api-client/vitest.config.ts`  | **MODIFY** — Strip to minimal override      |

### Validation Check: V001

- [ ] Exactly one root `vitest.config.ts` with `test.projects`
- [ ] No coverage config duplicated in any app/package config
- [ ] All apps use correct environment (`node` or `jsdom`)
- [ ] `bun run test` runs tests from all projects in one invocation

---

## Phase 2 — T002: Test Directory Structure Normalization

### Goal

Ensure all apps have `tests/unit/`, `tests/integration/`, `tests/e2e/`. Ensure all packages have `tests/unit/`. Use `.gitkeep` for empty directories.

### Required Directory Creations

**Apps — missing `tests/e2e/`**:

- `apps/api/tests/e2e/.gitkeep`
- `apps/backoffice/tests/e2e/.gitkeep`
- `apps/frontoffice/tests/e2e/.gitkeep`

**Note**: `apps/mmc/tests/e2e/` already exists. `apps/worker` does not need `tests/e2e/` (non-UI app; worker has no browser interface).

**Apps — verify existing dirs**:

- All 5 apps already have `tests/unit/` and `tests/integration/` ✅

**Packages — missing `tests/unit/`**:

- `packages/api-client/tests/unit/.gitkeep` (currently has `tests/adapters/` — not `unit/`)
- `packages/domain-core/tests/unit/.gitkeep` (currently has `tests/license/` — not `unit/`)
- `packages/config/tests/unit/.gitkeep` (no tests dir)
- `packages/logger/tests/unit/.gitkeep` (no tests dir)
- `packages/redis-utils/tests/unit/.gitkeep` (no tests dir)
- `packages/types/tests/unit/.gitkeep` (no tests dir)
- `packages/validation/tests/unit/.gitkeep` (no tests dir)

**Note**: `packages/ui-system/tests/unit/` already exists ✅

### Test File Relocation

- `packages/api-client/tests/adapters/` — these are adapter tests; consider moving to `tests/unit/adapters/` if they are pure unit tests; investigate before moving
- `packages/domain-core/tests/license/` — license domain tests; move to `tests/unit/license/` to conform to structure
- Root `tests/` dir structure: currently has `unit/`, `integration/`, `security/`, `smoke/`, `load/`, `performance/`, `static/`, `contract/`, `edge-cases/` — this non-standard structure is intentional for the root tests and is NOT changed (root tests are API-focused infrastructure tests, not module unit tests)

### Files to Create

| File                                       | Action                  |
| ------------------------------------------ | ----------------------- |
| `apps/api/tests/e2e/.gitkeep`              | **CREATE**              |
| `apps/backoffice/tests/e2e/.gitkeep`       | **CREATE**              |
| `apps/frontoffice/tests/e2e/.gitkeep`      | **CREATE**              |
| `packages/api-client/tests/unit/.gitkeep`  | **CREATE**              |
| `packages/domain-core/tests/unit/.gitkeep` | **CREATE**              |
| `packages/config/tests/.gitkeep`           | **CREATE** (parent dir) |
| `packages/config/tests/unit/.gitkeep`      | **CREATE**              |
| `packages/logger/tests/unit/.gitkeep`      | **CREATE**              |
| `packages/redis-utils/tests/unit/.gitkeep` | **CREATE**              |
| `packages/types/tests/unit/.gitkeep`       | **CREATE**              |
| `packages/validation/tests/unit/.gitkeep`  | **CREATE**              |

### Validation Check: V002

- [ ] All apps have `tests/unit/`, `tests/integration/`, `tests/e2e/`
- [ ] All packages have `tests/unit/`
- [ ] Empty dirs contain `.gitkeep`

---

## Phase 3 — T003: Playwright Installation and Configuration

### Goal

Install Playwright. Create per-app configs for MMC, Backoffice, Frontoffice. Create a shared smoke test. Exclude Playwright from Vitest discovery.

### Dependencies to Install

```bash
bun add -D @playwright/test
# Install browser binaries for CI (run separately):
bunx playwright install --with-deps chromium
```

**Package**: `@playwright/test` — root `devDependencies` only  
**Do NOT install**: `playwright` standalone; use `@playwright/test` directly

### Per-App Playwright Configs

**`apps/mmc/playwright.config.ts`**:

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.MMC_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
```

**`apps/backoffice/playwright.config.ts`**:

- `baseURL`: `process.env.BACKOFFICE_BASE_URL ?? 'http://localhost:5174'`
- `testDir: './tests/e2e'`
- `projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]`

**`apps/frontoffice/playwright.config.ts`**:

- `baseURL`: `process.env.FRONTOFFICE_BASE_URL ?? 'http://localhost:5175'`
- `testDir: './tests/e2e'`
- `projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]`

### Smoke Tests

**`apps/mmc/tests/e2e/smoke.spec.ts`**:

```typescript
import { test, expect } from '@playwright/test'

test('MMC app loads without errors', async ({ page }) => {
  await page.goto('/')
  await expect(page).not.toHaveTitle(/error/i)
  await expect(page.locator('body')).toBeVisible()
})
```

Create equivalent smoke tests for:

- `apps/backoffice/tests/e2e/smoke.spec.ts`
- `apps/frontoffice/tests/e2e/smoke.spec.ts`

### Root-Level Shared Smoke Test

**`tests/e2e/app-load.spec.ts`**: This file is referenced in FR-014. Since it's in the root `tests/e2e/` dir, it should test all 3 apps. However, each app runs from a different base URL. The recommended approach is to create individual smoke tests per app (above) and add a simple marker test at `tests/e2e/app-load.spec.ts` that documents the pattern without requiring a specific base URL.

### Vitest Exclusion

Add to root `vitest.config.ts` exclude patterns:

```typescript
exclude: [
  ...configDefaults.exclude,
  '**/*.spec.ts', // Excludes Playwright .spec.ts files
  '**/playwright.config.*', // Excludes Playwright config files
  '**/tests/e2e/**', // Excludes all e2e directories
]
```

**Note**: Vitest and Playwright use distinct file extensions by convention (`.test.ts` vs `.spec.ts`) but this is NOT enforced consistently in this repo (some unit tests use `.spec.ts`). The exclude must be scoped to `tests/e2e/` directories specifically.

### Root package.json Scripts

Add:

```json
"test:e2e:mmc": "bunx playwright test --config apps/mmc/playwright.config.ts",
"test:e2e:backoffice": "bunx playwright test --config apps/backoffice/playwright.config.ts",
"test:e2e:frontoffice": "bunx playwright test --config apps/frontoffice/playwright.config.ts",
"test:e2e": "bun run test:e2e:mmc && bun run test:e2e:backoffice && bun run test:e2e:frontoffice"
```

### Files to Create/Modify

| File                                       | Action                                |
| ------------------------------------------ | ------------------------------------- |
| `apps/mmc/playwright.config.ts`            | **CREATE**                            |
| `apps/backoffice/playwright.config.ts`     | **CREATE**                            |
| `apps/frontoffice/playwright.config.ts`    | **CREATE**                            |
| `apps/mmc/tests/e2e/smoke.spec.ts`         | **CREATE**                            |
| `apps/backoffice/tests/e2e/smoke.spec.ts`  | **CREATE**                            |
| `apps/frontoffice/tests/e2e/smoke.spec.ts` | **CREATE**                            |
| `tests/e2e/app-load.spec.ts`               | **CREATE**                            |
| `tests/e2e/.gitkeep`                       | **CREATE** (to ensure dir is tracked) |
| `package.json`                             | **MODIFY** — add `test:e2e` scripts   |
| `vitest.config.ts`                         | **MODIFY** — add `e2e` exclusion      |

### Validation Check: V003

- [ ] `@playwright/test` in root devDependencies
- [ ] `playwright.config.ts` present in mmc, backoffice, frontoffice
- [ ] Smoke test file present per UI app
- [ ] `tests/e2e/app-load.spec.ts` present
- [ ] `bun run test` does not pick up Playwright specs

---

## Phase 4 — T004: ESLint and Prettier Alignment

### Goal

Install Prettier. Install eslint-config-prettier. Add to root ESLint flat config. Add format scripts. Create `.prettierrc`.

### Dependencies to Install

```bash
bun add -D prettier eslint-config-prettier
```

### Prettier Configuration

Create `prettier.config.mjs` at repo root:

```javascript
/** @type {import('prettier').Config} */
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'es5',
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: [],
}
```

**Note**: These rules are consistent with TypeScript/Vue codebases. If team has an existing informal style preference, adjust before finalizing. The key constraint is `singleQuote: true` and `semi: false` which is a common Vue/TypeScript convention.

### `.prettierignore`

Create `.prettierignore` at repo root:

```
node_modules
dist
build
*.min.js
coverage
.nyc_output
bun.lockb
pnpm-lock.yaml
*.lock
```

### ESLint Flat Config Update (`eslint.config.mjs`)

Add `eslint-config-prettier` as the **last item** in the `tseslint.config(...)` call:

```javascript
import eslintConfigPrettier from 'eslint-config-prettier'

// ... existing imports and config blocks ...

// Add as the LAST config block to ensure Prettier wins over ESLint formatting:
eslintConfigPrettier,
```

**Important**: `eslint-config-prettier` must be the final entry in the flat config array. It disables all ESLint rules that conflict with Prettier's formatting (e.g., `indent`, `semi`, `quotes`, `max-len`, etc.). It does NOT affect non-formatting rules.

**Review required**: Check if any currently active ESLint rules in `eslint.config.mjs` are formatting rules that `eslint-config-prettier` will disable. If a disabled rule was being used for correctness (not formatting), it must be re-enabled explicitly with a comment. Current ESLint config has rules: `no-console`, `@typescript-eslint/no-explicit-any`, `@typescript-eslint/ban-ts-comment`, `@typescript-eslint/no-unused-vars`, `@typescript-eslint/no-require-imports`, `import-x/no-restricted-paths`, `no-restricted-imports`, `no-restricted-globals`, `vue/no-v-html` — none of these are formatting rules, so eslint-config-prettier should not disable any of them.

### Root package.json Scripts

Add:

```json
"format": "prettier --write .",
"format:check": "prettier --check ."
```

### Files to Create/Modify

| File                  | Action                                                          |
| --------------------- | --------------------------------------------------------------- |
| `prettier.config.mjs` | **CREATE**                                                      |
| `.prettierignore`     | **CREATE**                                                      |
| `eslint.config.mjs`   | **MODIFY** — add `eslint-config-prettier` import and last entry |
| `package.json`        | **MODIFY** — add `format` and `format:check` scripts            |

### Validation Check: V004

- [ ] `prettier` in root devDependencies
- [ ] `eslint-config-prettier` in root devDependencies
- [ ] `prettier.config.mjs` or `.prettierrc` present at root
- [ ] `eslint-config-prettier` is last entry in `eslint.config.mjs`
- [ ] `bun run format:check` runs without configuration errors
- [ ] `bun run lint` does not report formatting-related ESLint errors

---

## Phase 5 — T005: Flaky Test Stabilization

### Goal

Investigate 2 flaky test files. Stabilize if possible, quarantine with comment if not.

### Flaky Test Files

**File 1: `packages/api-client/tests/client.test.ts`**

Investigation steps:

1. Read the file — identify any `setTimeout`, `setInterval`, `Date.now()`, fake timer patterns
2. Check for unresolved promises or missing `await`
3. Check if it makes real network calls (should be mocked)
4. Stabilization: replace timing-based waits with `vi.useFakeTimers()` or deterministic mocks

If stabilization feasible → fix and document removal of flakiness in commit message  
If not immediately stabilizable → quarantine:

```typescript
// QUARANTINE: Race condition in HTTP retry mock timing. Needs fake timer refactor.
// Tracking ref: INFRA-003-FLAKY-001
it.skip('retries on network failure', async () => {
  // ... existing test body
})
```

**File 2: `apps/worker/tests/load-testing.test.ts`**

Investigation steps:

1. Determine if this is a performance/load test (timing-sensitive by nature)
2. If it's a load test that cannot be deterministic → it belongs in `test:performance` not `test:unit` or `test:integration`
3. Check if it should be moved to `apps/worker/tests/load/` (load-specific dir already exists)
4. If it asserts wall-clock timing (`expect(duration).toBeLessThan(1000)`) → likely cannot be stabilized in unit test context

If stabilization feasible → fix  
If load test by nature and not suitable for unit runner → move to `tests/load/` and document; quarantine in current location:

```typescript
// QUARANTINE: Load test with wall-clock timing assertions. Moved to tests/load/.
// Tracking ref: INFRA-003-FLAKY-002
it.skip('processes 100 jobs in under 5 seconds', async () => {
  // ...
})
```

### Pattern Rule (for all quarantined tests)

```typescript
// QUARANTINE: <reason explaining why the test is flaky and what needs to change>
// Tracking ref: INFRA-003-FLAKY-<NNN>
it.skip('test description', async () => { ... })
```

### Validation Check: V006

- [ ] Both flaky test files investigated
- [ ] Either stabilized (with deterministic assertions) or quarantined (with comment + tracking ref)
- [ ] No tests rely on wall-clock timing without `vi.useFakeTimers()`
- [ ] Test suite runs consistently across 3 consecutive `bun run test` executions

---

## Phase 6 — T006: Skipped Test Review

### Goal

Review all 10 files with skip markers. Either re-enable or annotate with documented reason.

### Files to Review

| #   | File                                                       | Required Action                                                       |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | `tests/unit/license-rbac.test.ts`                          | Investigate skip reason → re-enable or annotate                       |
| 2   | `tests/security/licenses.security.test.ts`                 | Investigate skip reason → re-enable or annotate                       |
| 3   | `tests/integration/licenses.e2e.test.ts`                   | Investigate skip reason → re-enable or annotate                       |
| 4   | `tests/integration/provisioning-failure.test.ts`           | Investigate skip reason → re-enable or annotate                       |
| 5   | `tests/integration/license-soft-lock.test.ts`              | Investigate skip reason → re-enable or annotate                       |
| 6   | `packages/ui-system/tests/unit/DataTable.spec.ts`          | Also excluded in vitest config — needs both review AND config cleanup |
| 7   | `packages/ui-system/tests/unit/composables.spec.ts`        | Investigate skip reason → re-enable or annotate                       |
| 8   | `packages/ui-system/tests/unit/utilities.spec.ts`          | Investigate skip reason → re-enable or annotate                       |
| 9   | `apps/api/tests/integration/tenant-resolver.test.ts`       | Investigate skip reason → re-enable or annotate                       |
| 10  | `apps/worker/tests/unit/provisioning/provisioning.test.ts` | Investigate skip reason → re-enable or annotate                       |

### Action Pattern

**If re-enabling**: Remove `.skip`, verify test passes, commit with message explaining what was fixed.

**If keeping as skip with documented reason**:

```typescript
// SKIP REASON: <explanation of why this test is skipped and what must change to enable it>
it.skip('description', () => { ... })
```

**Special case — `DataTable.spec.ts`**:  
This file is both skipped AND excluded in the root vitest config (`configDefaults.exclude`). Both markers must be addressed together:

1. If test is re-enabled → remove the `exclude` entry from root `vitest.config.ts`
2. If test remains skipped → remove the `exclude` entry from root `vitest.config.ts` (let the test runner see it; the `it.skip` handles suppression), and add `// SKIP REASON:` comment

### Validation Check: V005

- [ ] All 10 files reviewed
- [ ] No `.skip` without explanation comment
- [ ] `DataTable.spec.ts` exclude entry rationalized
- [ ] CI verbose reporter will surface skipped tests

---

## Phase 7 — T007: README Creation

### Goal

Create README files for all 11 missing directories; rewrite 2 incomplete ones. All must include required sections.

### Required Sections for All READMEs

**Apps**: Purpose, Responsibilities, Dependencies, How to Run Tests, Environment Variables, Known Boundaries  
**Packages**: Purpose, Responsibilities, Dependencies, **Public API**, How to Run Tests, Environment Variables, Known Boundaries

### Files to Create/Modify

| File                             | Action                           | Type    |
| -------------------------------- | -------------------------------- | ------- |
| `apps/api/README.md`             | **CREATE**                       | App     |
| `apps/worker/README.md`          | **CREATE**                       | App     |
| `apps/mmc/README.md`             | **CREATE**                       | App     |
| `apps/backoffice/README.md`      | **CREATE**                       | App     |
| `apps/frontoffice/README.md`     | **CREATE**                       | App     |
| `packages/types/README.md`       | **REWRITE** (exists, 0 sections) | Package |
| `packages/logger/README.md`      | **CREATE**                       | Package |
| `packages/config/README.md`      | **CREATE**                       | Package |
| `packages/redis-utils/README.md` | **CREATE**                       | Package |
| `packages/ui-system/README.md`   | **REWRITE** (exists, 0 sections) | Package |
| `packages/api-client/README.md`  | **CREATE**                       | Package |
| `packages/domain-core/README.md` | **CREATE**                       | Package |
| `packages/validation/README.md`  | **CREATE**                       | Package |

### README Content Summary (per app/package)

**`apps/api/README.md`**: Bun + Hono backend. Tenant resolver + license middleware chain. PostgreSQL per-tenant DB. REST API. Tests: `apps/api/tests/` + root `tests/`. Env vars: DB_HOST, DB_PORT, DB_MASTER_NAME, REDIS_URL, JWT_SECRET, etc.

**`apps/worker/README.md`**: Background job processor. Redis-backed queue. Grading, provisioning, DLQ handling. Tests: `apps/worker/tests/`. Env vars: REDIS_URL, WORKER_CONCURRENCY, etc.

**`apps/mmc/README.md`**: Platform control panel (Vue 3 SPA). Workspace and license management UI. Tests: Vitest unit/integration via `apps/mmc/vitest.config.ts`. Playwright E2E via `apps/mmc/playwright.config.ts`. Env vars: VITE_API_BASE_URL.

**`apps/backoffice/README.md`**: Institution control panel (Vue 3 SPA). Exam and student management UI. Tests: similar to MMC. Env vars: VITE_API_BASE_URL, VITE_WORKSPACE_SLUG.

**`apps/frontoffice/README.md`**: Student runtime (Vue 3 SPA). Exam taking and result viewing. Tests: similar to MMC. Env vars: VITE_API_BASE_URL, VITE_WORKSPACE_SLUG.

**`packages/types/README.md`**: Shared TypeScript type definitions. Enums, API types, license types, job types. Public API: all exported types. No dependencies on other `@zidney/*` packages.

**`packages/logger/README.md`**: Structured logger abstraction. Enforces required log fields (timestamp, level, service, workspace_slug, etc.). Public API: `createLogger(service)`, `Logger` interface.

**`packages/config/README.md`**: Configuration utilities. Environment variable parsing and validation. Public API: config schema exports.

**`packages/redis-utils/README.md`**: Redis algorithms and schema utilities. Rate limiting, lock patterns, queue helpers. Public API: algorithm functions, schema validators.

**`packages/ui-system/README.md`**: Shared shadcn-vue component library. Vue 3 + Tailwind v4. DataTable, Dialogs, Forms, Filters, Layout components. Public API: all exported components.

**`packages/api-client/README.md`**: HTTP client adapter for Zidney APIs. Used by Vue app stores only (not directly in components). Public API: `createApiClient()`, adapter interfaces.

**`packages/domain-core/README.md`**: Core business logic. Auth, tenants, licenses, attempts, RBAC, products, audit, versioning. Pure functions only. Public API: all domain service exports.

**`packages/validation/README.md`**: Zod-based validation schemas for request validation. Public API: all exported schemas.

### Validation Check: V007

- [ ] All 13 directories have README.md
- [ ] All READMEs contain required sections
- [ ] Package READMEs include Public API section
- [ ] Plain language, suitable for onboarding

---

## Phase 8 — T008: CI Pipeline Preparation

### Goal

Create GitHub Actions CI workflow supporting: lint → type-check → unit tests → integration tests → E2E tests. No coverage thresholds enforced.

### CI File Location

Create: `.github/workflows/ci.yml`

**Note**: The `.github/` directory does not currently exist at the repo root. It must be created.

### CI Workflow Design

> **Package Manager Note**: The repo uses `bun` (only `bun.lock` exists; `pnpm-lock.yaml` is absent). The `packageManager` field in `package.json` references pnpm but is not honoured — bun is the canonical install tool for this repo. All CI steps must use `bun`. The `packageManager` field discrepancy is logged as a TODO for a future housekeeping stage.

```yaml
name: CI

on:
  push:
    branches: [main, develop, 'infra-*', 'feature/*']
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    name: ESLint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - run: bun install --frozen-lockfile
      - run: bun run lint

  typecheck:
    name: TypeScript Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - run: bun install --frozen-lockfile
      - run: bun run typecheck

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: [lint, typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - run: bun install --frozen-lockfile
      - run: bun run test:unit
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: unit-test-coverage
          path: coverage/

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: [unit-tests]
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: zidney
          POSTGRES_PASSWORD: zidney
          POSTGRES_DB: zidney_master
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - run: bun install --frozen-lockfile
      - run: bun run test:integration
        env:
          DATABASE_URL: postgresql://zidney:zidney@localhost:5432/zidney_master
          REDIS_URL: redis://localhost:6379

  e2e-tests:
    name: E2E Tests (Playwright)
    runs-on: ubuntu-latest
    needs: [integration-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - run: bun install --frozen-lockfile
      - run: bunx playwright install --with-deps chromium
      - name: Start app servers
        run: |
          bun run dev:mmc &
          bun run dev:backoffice &
          bun run dev:frontoffice &
          bunx wait-on http://localhost:5173 http://localhost:5174 http://localhost:5175 --timeout 60000
      - run: bun run test:e2e
        env:
          MMC_BASE_URL: http://localhost:5173
          BACKOFFICE_BASE_URL: http://localhost:5174
          FRONTOFFICE_BASE_URL: http://localhost:5175
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

**Notes**:

- `bun` is used in CI (repo has only `bun.lock`; `pnpm-lock.yaml` does not exist)
- E2E depends on running dev servers; `wait-on` health-checks replace fragile `sleep` buffer
- `wait-on` is invoked via `bunx` — no separate installation required
- Coverage artifacts uploaded but NO threshold gates (FR-037)
- Skipped tests are visible in verbose output (FR-028, FR-038)
- Lint failures fail the build (FR-038)
- Type-check failures fail the build (FR-039)

### Additional package.json Scripts

Add to root `package.json`:

```json
"dev:backoffice": "bun --cwd apps/backoffice dev",
"dev:frontoffice": "bun --cwd apps/frontoffice dev"
```

(Already exists: `dev:api`, `dev:worker`, `dev:mmc`)

### Files to Create/Modify

| File                       | Action                                                       |
| -------------------------- | ------------------------------------------------------------ |
| `.github/workflows/ci.yml` | **CREATE**                                                   |
| `package.json`             | **MODIFY** — add `dev:backoffice`, `dev:frontoffice` scripts |

### Validation Check: V008

- [ ] `.github/workflows/ci.yml` present
- [ ] Workflow has 5 stages: lint, typecheck, unit, integration, e2e
- [ ] Stages run sequentially (needs dependency chain)
- [ ] No coverage thresholds configured
- [ ] Lint failures → workflow fails
- [ ] Typecheck failures → workflow fails

---

## Complete File Inventory

### Files to CREATE (new files)

```
# Vitest configs (new)
apps/api/vitest.config.ts
apps/worker/vitest.config.ts
packages/domain-core/vitest.config.ts
packages/logger/vitest.config.ts
packages/config/vitest.config.ts
packages/redis-utils/vitest.config.ts
packages/types/vitest.config.ts
packages/ui-system/vitest.config.ts
packages/validation/vitest.config.ts

# Test directories (gitkeep)
apps/api/tests/e2e/.gitkeep
apps/backoffice/tests/e2e/.gitkeep
apps/frontoffice/tests/e2e/.gitkeep
packages/api-client/tests/unit/.gitkeep
packages/domain-core/tests/unit/.gitkeep
packages/config/tests/unit/.gitkeep
packages/logger/tests/unit/.gitkeep
packages/redis-utils/tests/unit/.gitkeep
packages/types/tests/unit/.gitkeep
packages/validation/tests/unit/.gitkeep

# Playwright
apps/mmc/playwright.config.ts
apps/backoffice/playwright.config.ts
apps/frontoffice/playwright.config.ts
apps/mmc/tests/e2e/smoke.spec.ts
apps/backoffice/tests/e2e/smoke.spec.ts
apps/frontoffice/tests/e2e/smoke.spec.ts
tests/e2e/app-load.spec.ts
tests/e2e/.gitkeep

# Prettier
prettier.config.mjs
.prettierignore

# READMEs (new)
apps/api/README.md
apps/worker/README.md
apps/mmc/README.md
apps/backoffice/README.md
apps/frontoffice/README.md
packages/logger/README.md
packages/config/README.md
packages/redis-utils/README.md
packages/api-client/README.md
packages/domain-core/README.md
packages/validation/README.md

# CI
.github/workflows/ci.yml
```

### Files to MODIFY (existing files changed)

```
# Vitest configs (modified)
vitest.config.ts                              — rewrite to use projects
apps/mmc/vitest.config.ts                     — strip to minimal override
apps/backoffice/vitest.config.ts              — strip to minimal override
apps/frontoffice/vitest.config.ts             — strip to minimal override
packages/api-client/vitest.config.ts          — strip to minimal override

# ESLint
eslint.config.mjs                             — add eslint-config-prettier

# package.json
package.json                                  — add format, format:check, test:e2e, dev:backoffice, dev:frontoffice scripts

# READMEs (rewrite)
packages/types/README.md                      — rewrite with required sections
packages/ui-system/README.md                  — rewrite with required sections

# Skipped test files (annotate)
tests/unit/license-rbac.test.ts               — add SKIP REASON or re-enable
tests/security/licenses.security.test.ts      — add SKIP REASON or re-enable
tests/integration/licenses.e2e.test.ts        — add SKIP REASON or re-enable
tests/integration/provisioning-failure.test.ts — add SKIP REASON or re-enable
tests/integration/license-soft-lock.test.ts   — add SKIP REASON or re-enable
packages/ui-system/tests/unit/DataTable.spec.ts — add SKIP REASON + fix vitest exclude
packages/ui-system/tests/unit/composables.spec.ts — add SKIP REASON or re-enable
packages/ui-system/tests/unit/utilities.spec.ts — add SKIP REASON or re-enable
apps/api/tests/integration/tenant-resolver.test.ts — add SKIP REASON or re-enable
apps/worker/tests/unit/provisioning/provisioning.test.ts — add SKIP REASON or re-enable

# Flaky test files
packages/api-client/tests/client.test.ts      — stabilize or quarantine
apps/worker/tests/load-testing.test.ts        — stabilize or quarantine
```

---

## Dependencies to Install

| Package                  | Version   | Where                | Purpose                     |
| ------------------------ | --------- | -------------------- | --------------------------- |
| `@playwright/test`       | `^1.50.0` | root devDependencies | E2E testing framework       |
| `prettier`               | `^3.0.0`  | root devDependencies | Code formatter              |
| `eslint-config-prettier` | `^9.0.0`  | root devDependencies | ESLint/Prettier integration |

Install command:

```bash
bun add -D @playwright/test prettier eslint-config-prettier
```

---

## Risks and Concerns

### Risk 1 — Vitest Projects Migration (HIGH)

**Risk**: Migrating from monolithic to projects-based Vitest config may break test discovery or resolution.  
**Mitigation**: Run `bun run test` in dry-run mode after each config change. Keep original config as `.vitest.config.ts.bak` until all tests pass.  
**Trigger**: If any test that previously passed now fails after the migration.

### Risk 2 — Vue Plugin per-project Isolation (MEDIUM)

**Risk**: In Vitest projects mode, Vue SFC parsing requires `@vitejs/plugin-vue` in each per-app config. If the plugin version differs between app node_modules, parsing errors may occur.  
**Mitigation**: Verify `@vitejs/plugin-vue` version consistency across `apps/mmc`, `apps/backoffice`, `apps/frontoffice` before proceeding with T001.

### Risk 3 — Root `tests/` vs App `tests/` Test Discovery Overlap (MEDIUM)

**Risk**: The root `tests/` directory contains API/worker integration tests that currently run via the monolithic root config. After migration to projects, these tests must not be double-discovered (once by root project entry, once by app project entry).  
**Mitigation**: Scope per-app vitest config `include` patterns tightly to `apps/<app>/tests/**` only. Root project entry covers `tests/**` only.

### Risk 4 — `DataTable.spec.ts` Exclude Conflict (LOW)

**Risk**: `packages/ui-system/tests/unit/DataTable.spec.ts` is currently in the root vitest config's `exclude` list. If the test is re-enabled during T006 without removing this exclude, it will appear to pass the CI check but will silently never run.  
**Mitigation**: T006 task 6 (DataTable) must simultaneously remove the root config exclude AND address the `it.skip` marker.

### Risk 5 — No CI Before This Stage (MEDIUM)

**Risk**: No historical CI baseline exists. The first CI run may fail on pre-existing issues (not regressions from this stage).  
**Mitigation**: First CI run should be treated as a baseline-capture run. All failures should be triaged as pre-existing before attributing them to this stage's changes.

### Risk 6 — pnpm vs bun discrepancy (LOW)

**Risk**: The root `package.json` `packageManager` field specifies `pnpm@10.12.2` but repo scripts use `bun run`. CI uses pnpm for caching efficiency.  
**Mitigation**: Document both pnpm (CI) and bun (local dev) as valid runners. Ensure `pnpm run` commands in CI are equivalent to `bun run` commands locally.

---

## Task Numbering Summary

| Task ID | Phase   | Description                  | Files Changed     |
| ------- | ------- | ---------------------------- | ----------------- |
| T001    | Phase 1 | Vitest consolidation         | 14 files          |
| T002    | Phase 2 | Test directory normalization | 11 .gitkeep files |
| T003    | Phase 3 | Playwright installation      | 8 files + 3 deps  |
| T004    | Phase 4 | ESLint + Prettier alignment  | 4 files + 2 deps  |
| T005    | Phase 5 | Flaky test stabilization     | 2 files           |
| T006    | Phase 6 | Skipped test review          | 10 files          |
| T007    | Phase 7 | README creation              | 13 files          |
| T008    | Phase 8 | CI pipeline                  | 2 files           |

**Total implementation tasks**: T001–T008 (8 tasks)  
**Total files created**: ~54  
**Total files modified**: ~24  
**Total new devDependencies**: 3 packages (`@playwright/test`, `prettier`, `eslint-config-prettier`)

---

## Validation Gate Summary

All 8 checks must pass before this stage is marked ALIGNMENT COMPLETE:

| Check | Task | Condition                                                  |
| ----- | ---- | ---------------------------------------------------------- |
| V001  | T001 | Single root vitest.config.ts with projects                 |
| V002  | T002 | All apps have unit/integration/e2e; all packages have unit |
| V003  | T003 | Playwright installed; configs present; smoke tests present |
| V004  | T004 | Prettier installed; eslint-config-prettier in root config  |
| V005  | T006 | All skipped tests reviewed and documented                  |
| V006  | T005 | All flaky tests stabilized or quarantined                  |
| V007  | T007 | All apps and packages have complete READMEs                |
| V008  | T008 | CI supports lint + typecheck + unit + integration + e2e    |

**Stage completion status after all gates pass**: ALIGNMENT COMPLETE → GOVERNANCE READY
