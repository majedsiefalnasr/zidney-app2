# Technical Plan: Infrastructure Governance

**Stage:** STAGE_INFRA_GOVERNANCE
**Phase:** 01_PLATFORM_FOUNDATION
**Spec:** `specs/runtime/infra-governance/spec.md`
**Research:** `specs/runtime/infra-governance/research.md`
**Plan Version:** 1.0.0
**Date:** 2026-03-05
**Status:** READY FOR IMPLEMENTATION

---

## 1. Constitution Check

| Rule                          | Applies                                                      | Status |
| ----------------------------- | ------------------------------------------------------------ | ------ |
| Database-per-tenant isolation | No — tooling stage only                                      | SKIP   |
| License middleware mandatory  | No — no routes introduced                                    | SKIP   |
| Attempt engine immutability   | No — no attempt logic                                        | SKIP   |
| Import boundary rules         | Yes — no cross-app imports introduced                        | PASS   |
| No global DB singleton        | No DB access                                                 | PASS   |
| Structured logging required   | No — CLI scripts exempt                                      | PASS   |
| No secrets in code            | No secrets introduced                                        | PASS   |
| ADR required                  | No — tooling only, no architectural runtime behavior changed | PASS   |
| Stage lifecycle status        | DRAFT → IN PROGRESS upon implementation                      | PASS   |

**Gate result:** PASS. No architectural violations. Implementation may proceed.

---

## 2. Scope of Work

### 2.1 What is already compliant (do not touch)

- `eslint.config.mjs` — fully satisfies FR-06 (eslint-config-prettier last, no-console warn, explicit-any warn, all import boundaries)
- `prettier.config.mjs` — fully satisfies FR-07
- `vitest.workspace.ts` — all 13 projects registered, no standalone configs
- All per-app and per-package `vitest.config.ts` — correct project-entry format
- All `apps/*/playwright.config.ts` — per-app isolation, Chromium-only, FR-04 compliant
- All `apps/*/README.md` and `packages/*/README.md` — all FR-11 required sections present
- CI jobs: `lint`, `typecheck`, `unit-tests`, `integration-tests` — compliant with FR-10 steps 1–4
- `scripts/ai-guard.ts` — exists, idempotent, exits non-zero on violations
- `scripts/infra-audit.ts` — exists with `--ci` mode
- `.github/workflows/architecture-governance.yml` and `hard-mode-guard.yml` — untouched

### 2.2 What must be changed

Seven work items, ordered by dependency:

| ID   | Work Item                                                        | FR      | Files Changed                      |
| ---- | ---------------------------------------------------------------- | ------- | ---------------------------------- |
| T001 | Add `@vitest/coverage-v8` + coverage thresholds to Vitest config | FR-05.6 | `vitest.config.ts`, `package.json` |
| T002 | Add Husky + lint-staged packages + prepare script                | FR-08   | `package.json`                     |
| T003 | Create lint-staged configuration                                 | FR-08.2 | `lint-staged.config.mjs` (new)     |
| T004 | Rewrite `.husky/pre-commit`                                      | FR-08   | `.husky/pre-commit`                |
| T005 | Create `.husky/pre-push`                                         | FR-09   | `.husky/pre-push` (new)            |
| T006 | Add `--quick` flag to `scripts/infra-audit.ts`                   | FR-08.4 | `scripts/infra-audit.ts`           |
| T007 | Update `.github/workflows/ci.yml`                                | FR-10   | `.github/workflows/ci.yml`         |

---

## 3. Implementation Sequence

```
T001 → T002 → T003 → T004 → T005   (parallel after T002)
T006                                (independent)
T007                                (independent, depends on T001 logic for coverage job)
```

All items are independent except:

- T004 and T005 require T002 (Husky in devDeps) to be installable
- T007 coverage job references the threshold behavior defined in T001

---

## 4. Detailed File Changes

---

### T001: Coverage Thresholds + Coverage Provider

**File:** `vitest.config.ts`

**Change:** Add `provider: 'v8'` and `thresholds` to the `coverage` block.

**Current state:**

```ts
coverage: {
  reporter: ['text', 'json', 'html'],
  exclude: ['node_modules/', 'dist/', 'build/', 'tests/e2e/**'],
},
```

**Target state:**

```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  exclude: [
    'node_modules/',
    'dist/',
    'build/',
    'tests/e2e/**',
    '**/*.d.ts',
    '**/vitest.config.ts',
    '**/playwright.config.ts',
  ],
  thresholds: {
    lines: 85,
    functions: 85,
    statements: 85,
    branches: 80,
  },
},
```

**File:** `package.json`

**Change:** Add `@vitest/coverage-v8` to `devDependencies`.

```json
"@vitest/coverage-v8": "^1.0.0"
```

Note: Pin to same major as `vitest` (`^1.0.0`).

---

### T002: Add Husky + lint-staged to devDependencies + prepare script

**File:** `package.json`

**Changes:**

1. Add to `devDependencies`:

```json
"husky": "^9.0.0",
"lint-staged": "^15.0.0"
```

2. Add to `scripts`:

```json
"prepare": "husky"
```

The `prepare` lifecycle script runs automatically on `bun install`, ensuring all contributors get hooks installed without additional steps.

**After T002:** Run `bun install` then `bun run prepare` (or `bunx husky`) to initialize `.husky/_/` and make hooks executable.

---

### T003: Create `lint-staged.config.mjs`

**File:** `lint-staged.config.mjs` (new, at repo root)

```mjs
/** @type {import('lint-staged').Config} */
export default {
  // TypeScript and Vue files: auto-fix lint errors, then format
  '*.{ts,tsx,vue}': ['eslint --fix', 'prettier --write'],

  // Markdown and JSON files: format only
  '*.{md,json}': ['prettier --write'],
}
```

**Notes:**

- `eslint --fix` runs first so that auto-fixable lint errors are resolved before Prettier reformats.
- Files are passed as arguments by lint-staged automatically.
- If ESLint cannot auto-fix a remaining error, it exits non-zero, blocking the commit (FR-08.5).
- Prettier reformatting alone does not block the commit because it exits 0 after writing (FR-08.6).

---

### T004: Rewrite `.husky/pre-commit`

**File:** `.husky/pre-commit`

**Current content (non-compliant):**

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# AI Architecture Guard
bun scripts/ai-guard.ts

# Infrastructure Audit
bun scripts/infra-audit.ts --quick

# Standard quality gates
bun run lint
bun run type-check
```

**Issues with current content:**

- Sources `.husky/_/husky.sh` which does not exist → hooks cannot run
- `bun run lint` runs full repo lint (not staged-only)
- `bun run type-check` does not exist — correct script is `bun run typecheck`
- Does not call `lint-staged`

**Target content (Husky v9 format):**

```sh
#!/bin/sh

# ── Staged-file quality gates (lint-staged) ────────────────────────────────
# Runs ESLint --fix + Prettier --write on staged .ts/.tsx/.vue/.md/.json files.
# Commit is blocked if any lint error remains after auto-fix.
bunx lint-staged

# ── AI Architecture Guard (hard gate) ──────────────────────────────────────
# Checks ARCHITECTURE_CONTRACT.json for layer violations, dependency rule
# violations, circular dependencies, and architecture drift.
# Non-zero exit = commit blocked.
bun scripts/ai-guard.ts

# ── Infrastructure Audit — Quick Mode (hard gate) ──────────────────────────
# Runs structural governance checks (excludes slow file writes).
# Non-zero exit = commit blocked.
bun scripts/infra-audit.ts --quick
```

**Note:** Husky v9 hooks are plain shell scripts — no `_/husky.sh` sourcing required. After `husky` is initialized (by running `bun run prepare`), Husky makes this file executable automatically.

---

### T005: Create `.husky/pre-push`

**File:** `.husky/pre-push` (new)

```sh
#!/bin/sh

# ── Pre-Push Quality Gate ───────────────────────────────────────────────────
# All three checks must pass before a push is allowed.
# Target: complete in under 3 minutes on a standard developer machine.

# 1. Full ESLint (entire repo)
bun run lint

# 2. TypeScript type check (source + tests)
bun run typecheck

# 3. Unit tests (all unit-test projects)
bun run test:unit
```

**Notes:**

- Uses `bun run typecheck` (the correct script name, not `type-check`).
- Uses `bun run test:unit` which runs only unit-test projects (excludes integration and E2E).
- Push is blocked if any command exits non-zero.

---

### T006: Add `--quick` flag to `scripts/infra-audit.ts`

**File:** `scripts/infra-audit.ts`

**Change type:** Additive — one new constant + conditional wrapping around `writeFileSync` calls + extended enforcement block.

**Description:** The `--quick` flag enables fast pre-commit mode. When active:

1. All structural violation checks run identically to `--ci` mode.
2. All `writeFileSync` / `mkdirSync` / report-writing calls are skipped.
3. The script exits non-zero if any violations are found, or exits 0 if clean.
4. `process.exit(1)` on violations (same as `--ci` mode).

**Change at top of file (after existing `CI_MODE` line):**

```ts
const CI_MODE = process.argv.includes('--ci')
const QUICK_MODE = process.argv.includes('--quick')
```

**Pattern for all report-writing blocks:** Wrap each `writeFileSync` / directory-creation call with `if (!QUICK_MODE) { ... }`.

**Enforcement block addition:** The existing `if (CI_MODE)` block must be extended to also trigger on `QUICK_MODE`:

```ts
if (CI_MODE || QUICK_MODE) {
  // existing violation check logic unchanged
  // process.exit(1) on failures
}
```

**Important:** The `--quick` flag does NOT change what violations are checked — it only skips file I/O and runs in the same enforcement posture as `--ci`. This makes it idempotent per FR-08.4.

**Specific sections to wrap with `if (!QUICK_MODE)`:**

- `writeFileSync` call for `infra-audit-report.json`
- `writeFileSync` call for architecture graph outputs
- Any other `writeFileSync` / `mkdirSync` for report/graph/history directories

The violation scan variables (`circularDependencies`, `depViolations`, `layerViolations`, `architectureDrift`, `architectureScore`) must still be computed — only the file writes are guarded.

---

### T007: Update `.github/workflows/ci.yml`

**Change type:** Additive — no existing jobs are removed or renamed.

**Three changes required:**

#### 7a: Split E2E into 3 separate per-app jobs

**Replace** the single `e2e-tests` job with three independent jobs:

```yaml
# ──────────────────────────────────────────────────────────────────────────
# Job 5a: E2E — MMC
# ──────────────────────────────────────────────────────────────────────────
e2e-mmc:
  name: 'E2E: MMC'
  runs-on: ubuntu-latest
  timeout-minutes: 30
  needs:
    - integration-tests
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: ${{ env.BUN_VERSION }}

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Install Playwright browsers
      run: bunx playwright install --with-deps chromium

    - name: Start MMC dev server
      run: bun run dev:mmc &
      env:
        VITE_API_BASE_URL: http://localhost:3000

    - name: Wait for MMC dev server
      run: bunx wait-on http://localhost:5173 --timeout 60000

    - name: Run MMC E2E tests
      run: bun run test:e2e:mmc

    - name: Upload MMC Playwright report
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: playwright-report-mmc
        path: apps/mmc/playwright-report/
        retention-days: 7

# ──────────────────────────────────────────────────────────────────────────
# Job 5b: E2E — Backoffice
# ──────────────────────────────────────────────────────────────────────────
e2e-backoffice:
  name: 'E2E: Backoffice'
  runs-on: ubuntu-latest
  timeout-minutes: 30
  needs:
    - integration-tests
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: ${{ env.BUN_VERSION }}

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Install Playwright browsers
      run: bunx playwright install --with-deps chromium

    - name: Start Backoffice dev server
      run: bun run dev:backoffice &
      env:
        VITE_API_BASE_URL: http://localhost:3000

    - name: Wait for Backoffice dev server
      run: bunx wait-on http://localhost:5174 --timeout 60000

    - name: Run Backoffice E2E tests
      run: bun run test:e2e:backoffice

    - name: Upload Backoffice Playwright report
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: playwright-report-backoffice
        path: apps/backoffice/playwright-report/
        retention-days: 7

# ──────────────────────────────────────────────────────────────────────────
# Job 5c: E2E — Frontoffice
# ──────────────────────────────────────────────────────────────────────────
e2e-frontoffice:
  name: 'E2E: Frontoffice'
  runs-on: ubuntu-latest
  timeout-minutes: 30
  needs:
    - integration-tests
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: ${{ env.BUN_VERSION }}

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Install Playwright browsers
      run: bunx playwright install --with-deps chromium

    - name: Start Frontoffice dev server
      run: bun run dev:frontoffice &
      env:
        VITE_API_BASE_URL: http://localhost:3000

    - name: Wait for Frontoffice dev server
      run: bunx wait-on http://localhost:5175 --timeout 60000

    - name: Run Frontoffice E2E tests
      run: bun run test:e2e:frontoffice

    - name: Upload Frontoffice Playwright report
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: playwright-report-frontoffice
        path: apps/frontoffice/playwright-report/
        retention-days: 7
```

#### 7b: Add Coverage Validation job (Step 6)

```yaml
# ──────────────────────────────────────────────────────────────────────────
# Job 6: Coverage Validation
# Enforces unit-test coverage thresholds defined in vitest.config.ts.
# Integration test coverage is collected but not threshold-gated this stage.
# ──────────────────────────────────────────────────────────────────────────
coverage-validation:
  name: Coverage Validation
  runs-on: ubuntu-latest
  timeout-minutes: 20
  needs:
    - unit-tests
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: ${{ env.BUN_VERSION }}

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Run unit tests with coverage (enforces thresholds)
      run: bun run test:unit --coverage

    - name: Upload coverage report
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: coverage-report
        path: coverage/
        retention-days: 14
```

**Note:** The `--coverage` flag passes threshold enforcement via `vitest.config.ts`. If any threshold is not met, `vitest` exits non-zero, blocking merge. The `upload-artifact` step runs `if: always()` to preserve the report even on threshold failure.

#### 7c: Add Build Verification job (Step 7)

```yaml
# ──────────────────────────────────────────────────────────────────────────
# Job 7: Build Verification
# Runs after all prior jobs pass. Confirms the full monorepo builds cleanly.
# ──────────────────────────────────────────────────────────────────────────
build-verification:
  name: Build Verification
  runs-on: ubuntu-latest
  timeout-minutes: 20
  needs:
    - lint
    - typecheck
    - unit-tests
    - integration-tests
    - e2e-mmc
    - e2e-backoffice
    - e2e-frontoffice
    - coverage-validation
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: ${{ env.BUN_VERSION }}

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Build all workspaces
      run: bun run build
```

---

## 5. Complete CI Job Dependency Graph

After all changes, the `ci.yml` job topology matches FR-10 exactly:

```
lint ──────────────────────────────────────────────────────────────────┐
                                                                        │
typecheck ─────────────────────────────────────────────────────────────┤
                                                                        ▼
                                                               unit-tests
                                                                    │
                                             ┌──────────────────────┤
                                             │                      │
                                             ▼                      ▼
                                    integration-tests    coverage-validation
                                             │
                         ┌───────────────────┼────────────────────┐
                         ▼                   ▼                    ▼
                      e2e-mmc        e2e-backoffice         e2e-frontoffice
                         │                   │                    │
                         └───────────────────┴──────────┬─────────┘
                                                         │
                                                  build-verification
                                            (depends on ALL prior jobs)
```

| FR-10 Step | Job Name              | `needs`           | Blocks Merge | Status After Plan         |
| ---------- | --------------------- | ----------------- | ------------ | ------------------------- |
| 1          | `lint`                | —                 | Yes          | Already exists            |
| 2          | `typecheck`           | —                 | Yes          | Already exists            |
| 3          | `unit-tests`          | lint, typecheck   | Yes          | Already exists            |
| 4          | `integration-tests`   | unit-tests        | Yes          | Already exists            |
| 5a         | `e2e-mmc`             | integration-tests | Yes          | New (replaces monolithic) |
| 5b         | `e2e-backoffice`      | integration-tests | Yes          | New (replaces monolithic) |
| 5c         | `e2e-frontoffice`     | integration-tests | Yes          | New (replaces monolithic) |
| 6          | `coverage-validation` | unit-tests        | Yes          | New                       |
| 7          | `build-verification`  | all prior         | Yes          | New                       |

---

## 6. Branch Protection Requirements

After CI is updated, GitHub branch protection rules on `main` must require all of the following status checks before merge:

- `Lint`
- `Type Check`
- `Unit Tests`
- `Integration Tests`
- `E2E: MMC`
- `E2E: Backoffice`
- `E2E: Frontoffice`
- `Coverage Validation`
- `Build Verification`

**This is a manual GitHub repository setting** — it cannot be set via a workflow file. The implementer must update the branch protection rules in the repository settings after deploying the updated `ci.yml`.

---

## 7. Package Installation Steps

After modifying `package.json` (T001, T002), the following commands must be run in order:

```sh
# 1. Install new packages (coverage-v8, husky, lint-staged)
bun install

# 2. Initialize Husky (creates .husky/_/ and sets hooks executable)
bun run prepare

# 3. Verify hooks are active
cat .husky/pre-commit
cat .husky/pre-push
```

If `bun run prepare` fails because `bun lockfile` is frozen in CI, the lockfile must be updated locally and committed. This is expected for first-time package additions.

---

## 8. Backward Compatibility Guarantees

All changes in this plan are non-destructive:

| Concern                | Guarantee                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Existing passing tests | No test file is deleted or moved. Vitest workspace is not changed. All existing tests continue to run identically.                                                                                                             |
| ESLint rules           | No rule severity is escalated. `no-console` stays at `warn`. No new rules added.                                                                                                                                               |
| Prettier rules         | `prettier.config.mjs` is not changed.                                                                                                                                                                                          |
| Package scripts        | No existing script is removed or renamed. Only `prepare` and (optionally) `test:coverage:unit` are added.                                                                                                                      |
| Playwright configs     | No per-app E2E config is changed.                                                                                                                                                                                              |
| READMEs                | Not modified.                                                                                                                                                                                                                  |
| Per-app vitest configs | Not modified.                                                                                                                                                                                                                  |
| Coverage thresholds    | Applied after first measurement. If the first CI run with thresholds fails, the threshold values must be adjusted to match the actual measured baseline (documented in the stage completion notes), not met by removing tests. |

---

## 9. Coverage Threshold Rollout Strategy

FR-05.6 sets thresholds at Lines ≥ 85%, Functions ≥ 85%, Statements ≥ 85%, Branches ≥ 80%.

Per spec Assumption 3: "Thresholds are not enforced retroactively against code that was written before the thresholds were established. The first measurement after stage completion sets the enforced baseline."

**Rollout approach:**

1. First, run `bun run test:unit --coverage` locally without thresholds to measure the current baseline.
2. If baseline is below the FR-05.6 targets, the thresholds in `vitest.config.ts` must be set to the measured baseline values initially, with a tracked issue to reach the FR-05.6 targets.
3. If baseline already meets or exceeds FR-05.6 targets, set thresholds to the FR-05.6 values directly.
4. Document the measured baseline in the stage completion notes.

This prevents a coverage threshold failure from blocking the initial stage deployment.

---

## 10. Success Criteria Verification Checklist

| Success Criterion                      | How to Verify                                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Test tiers run in isolation            | Run `bun run test:unit`, `bun run test:integration`, `bun run test:e2e:mmc` separately — each completes independently. |
| All tests pass on main                 | `bun test` exits 0 after all changes are applied.                                                                      |
| Coverage meets thresholds              | `bun run test:unit --coverage` exits 0 with threshold report.                                                          |
| Commit with lint error is blocked      | Introduce a `console.error(undefined.property)` in a staged `.ts` file; `git commit` must fail with ESLint error.      |
| Push with failing unit test is blocked | Introduce a failing `expect(1).toBe(2)` in a `.test.ts`; `git push` must fail.                                         |
| CI enforces full quality gate          | Open a PR with a known lint error; all required checks must fail in GitHub Actions.                                    |
| Every app/package has complete README  | Run `bun scripts/infra-audit.ts` — the README section reports 0 missing sections.                                      |
| E2E suites run independently           | `bun run test:e2e:mmc` runs without starting backoffice or frontoffice servers.                                        |
| Existing tests remain green            | `bun test` baseline before and after stage shows identical passing test count.                                         |

---

## 11. Out-of-Scope Clarifications

The following are explicitly NOT part of this plan:

- No `data-model.md` — there is no data model in this stage.
- No database migrations.
- No new apps or packages.
- No changes to `vitest.workspace.ts` — it is already correct.
- No changes to ESLint rules — `eslint.config.mjs` is already fully compliant.
- No changes to Prettier config — `prettier.config.mjs` is already correct.
- No Playwright config changes — all three per-app configs are already compliant.
- No README changes — all READMEs already have all required sections.
- No ADR — this stage is tooling-only with no runtime architectural impact.
- No multi-browser E2E — Chromium-only, deferred per spec Out of Scope section.
- No escalation of `no-console` from `warn` to `error` — deferred to a future enforcement stage per FR-06.5 and FR-12.6.
