# Research: Infrastructure Governance — Pre-Planning Inventory

**Stage:** STAGE_INFRA_GOVERNANCE **Phase:** 01_PLATFORM_FOUNDATION **Date:** 2026-03-05
**Purpose:** Existing configuration inventory, gap analysis, and decision rationale used as input to
plan.md.

---

## 1. Existing Infrastructure Inventory

### 1.1 Vitest Configuration

| File                                | Status                 | Notes                                                                                                                                |
| ----------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `vitest.config.ts`                  | EXISTS                 | Root orchestrator. Uses `workspace: './vitest.workspace.ts'`. Coverage section has `reporter` and `exclude` but **no `thresholds`**. |
| `vitest.workspace.ts`               | EXISTS — COMPLIANT     | Defines all 13 projects (root + 5 apps + 7 packages). All per-app configs are referenced as project entries — none are standalone.   |
| `apps/api/vitest.config.ts`         | EXISTS — COMPLIANT     | `defineProject`, node env, globalsl, aliases, includes `./src/**/*.test.ts` and `./tests/unit/**` and `./tests/integration/**`.      |
| `apps/backoffice/vitest.config.ts`  | EXISTS — COMPLIANT     | `defineProject`, jsdom env, Vue plugin, aliases.                                                                                     |
| `apps/frontoffice/vitest.config.ts` | EXISTS — COMPLIANT     | `defineProject`, jsdom env, Vue plugin, aliases.                                                                                     |
| `apps/mmc/vitest.config.ts`         | EXISTS — COMPLIANT     | `defineProject`, jsdom env, Vue plugin, aliases.                                                                                     |
| `apps/worker/vitest.config.ts`      | EXISTS — COMPLIANT     | `defineProject`, node env, aliases.                                                                                                  |
| `packages/*/vitest.config.ts`       | EXISTS × 8 — COMPLIANT | All 8 packages have project-entry configs referenced in `vitest.workspace.ts`.                                                       |

**Gap identified:** `vitest.config.ts` coverage block is missing `thresholds`. FR-05.6 requires
Lines ≥ 85%, Functions ≥ 85%, Statements ≥ 85%, Branches ≥ 80%. Additionally, `@vitest/coverage-v8`
is not in `devDependencies` and is not installed.

---

### 1.2 ESLint Configuration

| File                | Status                       | Notes                                                                                                                                                                                                                                                        |
| ------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `eslint.config.mjs` | EXISTS — **FULLY COMPLIANT** | Includes `@typescript-eslint`, `eslint-plugin-vue`, `eslint-plugin-import-x`. `eslint-config-prettier` is the final entry. `no-console: 'warn'`. `@typescript-eslint/no-explicit-any: 'warn'`. import boundary zones defined for all cross-app restrictions. |

No gaps. FR-06 is satisfied in full.

---

### 1.3 Prettier Configuration

| File                  | Status                       | Notes                                                                                                                             |
| --------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `prettier.config.mjs` | EXISTS — **FULLY COMPLIANT** | Root-only, single authority. Semi-colon off, single quotes, trailing comma es5, printWidth 100, LF endings. No per-app overrides. |

No gaps. FR-07 is satisfied in full.

---

### 1.4 Commit Hooks (Husky + lint-staged)

| Item                                     | Status                     | Notes                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `husky` in devDependencies               | **MISSING**                | Not in root `package.json` devDeps.                                                                                                                                                                                                                                                                                                                                                                              |
| `lint-staged` in devDependencies         | **MISSING**                | Not in root `package.json` devDeps.                                                                                                                                                                                                                                                                                                                                                                              |
| `@vitest/coverage-v8` in devDependencies | **MISSING**                | Required for coverage reporting.                                                                                                                                                                                                                                                                                                                                                                                 |
| `prepare` script in `package.json`       | **MISSING**                | No `"prepare": "husky"` entry. Hooks will not auto-install on `bun install`.                                                                                                                                                                                                                                                                                                                                     |
| `.husky/pre-commit`                      | EXISTS — **NON-COMPLIANT** | File exists but: (a) uses Husky v8 shell-sourcing syntax (`. "$(dirname -- "$0")/_/husky.sh"`) but `.husky/_/` directory does not exist, meaning hooks cannot run; (b) runs `bun run lint` (full repo lint, not staged-only); (c) references `bun run type-check` which does not exist — the correct script is `bun run typecheck`; (d) does not call `lint-staged` for staged-only ESLint fix + Prettier write. |
| `.husky/pre-push`                        | **MISSING**                | No pre-push hook. FR-09 requires full lint + typecheck + unit tests before push.                                                                                                                                                                                                                                                                                                                                 |
| `.husky/_/` directory                    | **NOT INITIALIZED**        | Husky init has not been run. The directory does not exist.                                                                                                                                                                                                                                                                                                                                                       |
| lint-staged configuration                | **MISSING**                | No `.lintstagedrc*` or `lint-staged.config.mjs` or `package.json["lint-staged"]` key present.                                                                                                                                                                                                                                                                                                                    |

---

### 1.5 GitHub Actions CI Workflows

| File                                            | Status           | Notes                                                                                                               |
| ----------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`                      | EXISTS — PARTIAL | Has 5 jobs: `lint`, `typecheck`, `unit-tests`, `integration-tests`, `e2e-tests`. Missing 3 required jobs per FR-10. |
| `.github/workflows/architecture-governance.yml` | EXISTS           | Separate governance enforcement workflow.                                                                           |
| `.github/workflows/hard-mode-guard.yml`         | EXISTS           | Separate Hard Mode guard workflow.                                                                                  |

**CI gaps identified:**

1. **E2E jobs are a single monolithic job** (`e2e-tests`) that runs all three apps sequentially.
   FR-10 requires three separate per-app jobs: `e2e-mmc`, `e2e-backoffice`, `e2e-frontoffice` — each
   independently blockable.

2. **Coverage Validation job missing** — FR-10 Step 6: a dedicated job that depends on `unit-tests`,
   runs unit tests with coverage, and enforces thresholds. Without this, coverage threshold failures
   do not block merge.

3. **Build Verification job missing** — FR-10 Step 7: a job that depends on all prior jobs and runs
   `bun workspaces run build` (already in package.json as `build` script).

---

### 1.6 Playwright E2E Configurations

| File                                    | Status                 | Notes                                                                                                                                                             |
| --------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mmc/playwright.config.ts`         | EXISTS — **COMPLIANT** | Per-app isolation, `testDir: './tests/e2e'`, `baseURL: process.env.MMC_BASE_URL ?? 'http://localhost:5173'`, Chromium only, retries in CI, traces on first retry. |
| `apps/backoffice/playwright.config.ts`  | EXISTS — **COMPLIANT** | Per-app isolation, port 5174, same structure.                                                                                                                     |
| `apps/frontoffice/playwright.config.ts` | EXISTS — **COMPLIANT** | Per-app isolation, port 5175, same structure.                                                                                                                     |

No per-app cross-dependency. Each config is independently runnable. FR-04 is satisfied.

---

### 1.7 README Governance

All 13 apps and packages have `README.md` files. Complete section audit:

| Unit                   | Required Sections Present                                                                          | Public API Section |
| ---------------------- | -------------------------------------------------------------------------------------------------- | ------------------ |
| `apps/api`             | Purpose, Responsibilities, Dependencies, How to Run Tests, Environment Variables, Known Boundaries | N/A — app          |
| `apps/backoffice`      | All 6 required app sections                                                                        | N/A — app          |
| `apps/frontoffice`     | All 6 required app sections                                                                        | N/A — app          |
| `apps/mmc`             | All 6 required app sections                                                                        | N/A — app          |
| `apps/worker`          | All 6 required app sections                                                                        | N/A — app          |
| `packages/api-client`  | All 6 + Public API                                                                                 | ✓                  |
| `packages/config`      | All 6 + Public API                                                                                 | ✓                  |
| `packages/domain-core` | All 6 + Public API                                                                                 | ✓                  |
| `packages/logger`      | All 6 + Public API                                                                                 | ✓                  |
| `packages/redis-utils` | All 6 + Public API                                                                                 | ✓                  |
| `packages/types`       | All 6 + Public API + Extended                                                                      | ✓                  |
| `packages/ui-system`   | All 6 + Public API + Extended                                                                      | ✓                  |
| `packages/validation`  | All 6 + Public API                                                                                 | ✓                  |

**FR-11 is fully satisfied.** No README gaps found.

---

### 1.8 Guard Scripts

| Script                   | Status | Notes                                                                                                                                                                      |
| ------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/ai-guard.ts`    | EXISTS | Reads `ARCHITECTURE_CONTRACT.json`, checks layer violations, dependency rules, circular deps, arch drift. Exits non-zero on violations. Idempotent — does not write state. |
| `scripts/infra-audit.ts` | EXISTS | Full monorepo governance scanner. Has `--ci` mode (exits non-zero on violations). **Does NOT support `--quick` flag**.                                                     |

**Gap identified:** `infra-audit.ts` must have `--quick` flag support per FR-08.4. The `--quick`
mode must: (a) skip writing large report files (fast), (b) run only structural checks that do not
require full filesystem traversal, (c) exit non-zero on violations. Currently only `--ci` mode
exists (which does enforce violations but runs the full scan including file writes).

---

### 1.9 Package Manager and Runtime

| Item                       | Observed                                        | Spec Requirement                                            |
| -------------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| `packageManager` field     | `pnpm@10.12.2`                                  | Spec Assumption 1: "pnpm remains the package manager"       |
| Script executor            | `bun run ...`, `bunx ...`                       | Spec Assumption 2: "Bun is the runtime and script executor" |
| CI install                 | `bun install --frozen-lockfile`                 | Compliant                                                   |
| Package manager resolution | Hybrid: pnpm workspace resolution + bun runtime | Husky hooks must use `bun` for script execution             |

**Decision:** The `packageManager` field in package.json declares pnpm as the workspace resolver.
All scripts use bun as the executor. Husky hooks will call `bun` (not `pnpm run`) for lint,
typecheck, and test commands, consistent with all existing scripts.

---

## 2. Gap Analysis Summary

| FR             | Title               | Gap                                                                            | Severity   |
| -------------- | ------------------- | ------------------------------------------------------------------------------ | ---------- |
| FR-05.6        | Coverage Thresholds | `thresholds` missing from `vitest.config.ts` coverage block                    | **HIGH**   |
| FR-05.6        | Coverage Provider   | `@vitest/coverage-v8` not in devDependencies                                   | **HIGH**   |
| FR-08          | lint-staged         | `lint-staged` package not in devDependencies                                   | **HIGH**   |
| FR-08          | Husky install       | `husky` package not in devDependencies                                         | **HIGH**   |
| FR-08          | prepare script      | No `prepare` script for auto-install                                           | **HIGH**   |
| FR-08          | Pre-commit hook     | Existing hook is non-compliant (no lint-staged, wrong script name, old format) | **HIGH**   |
| FR-08.4        | infra-audit --quick | `--quick` flag not implemented in `scripts/infra-audit.ts`                     | **MEDIUM** |
| FR-09          | Pre-push hook       | `.husky/pre-push` does not exist                                               | **HIGH**   |
| FR-10 (Step 6) | Coverage CI job     | No `coverage-validation` job in `ci.yml`                                       | **HIGH**   |
| FR-10 (Step 7) | Build CI job        | No `build-verification` job in `ci.yml`                                        | **HIGH**   |
| FR-10 (E2E)    | Per-app E2E jobs    | Single `e2e-tests` job; must be split into 3 separate jobs                     | **HIGH**   |

---

## 3. Decisions & Rationale

### D-01: Husky version — v9

**Decision:** Use Husky v9 (current stable, `^9.0.0`). **Rationale:** The `.husky/_/` directory does
not exist, meaning Husky has never been properly initialized in this repo. Starting fresh with v9 is
cleaner than retrofitting v8 compatibility. Husky v9 hooks do not require sourcing `_/husky.sh` —
they are plain shell scripts, compatible with `bun` as the executor. **Alternative considered:**
Husky v8 — requires `.husky/_/husky.sh` which does not exist; would require additional init step. v9
is simpler and current.

### D-02: lint-staged configuration location — `lint-staged.config.mjs`

**Decision:** Create a dedicated `lint-staged.config.mjs` at the repo root. **Rationale:** Keeps
`package.json` clean. Allows the config to use ES module syntax consistent with the rest of the
codebase (`*.mjs` pattern). Lint-staged supports this file name natively. **Alternative
considered:** Inline `package.json["lint-staged"]` key — valid but adds noise to package.json.

### D-03: infra-audit.ts `--quick` flag — skip report writes, run structural checks only

**Decision:** Add `--quick` flag that runs the violation checks (circular deps, layer violations,
dep boundary violations, arch drift) but skips writing `infra-audit-report.json` and other large
file outputs. **Rationale:** Pre-commit hooks must be fast (under 3 minutes per FR-09). The full
scan writes multiple JSON report files; this is unnecessary for a pre-commit gate. The `--ci` mode
already has the right enforcement logic — `--quick` reuses that logic but skips file I/O.
**Implementation note:** `--quick` implies `--ci` enforcement behavior. The check
`process.argv.includes('--quick')` sets `QUICK_MODE = true`, which skips `writeFileSync` calls and
behaves identically to `--ci` for the exit code decision.

### D-04: CI E2E — 3 separate jobs (not matrix strategy)

**Decision:** Create 3 explicit jobs (`e2e-mmc`, `e2e-backoffice`, `e2e-frontoffice`) rather than
using `strategy.matrix`. **Rationale:** Each app has different env vars (base URL, port), different
dev server start commands, and potentially different wait conditions. Explicit jobs are clearer,
independently blockable, and avoid matrix complexity where the jobs are not truly homogeneous.

### D-05: Coverage Validation job — runs `test:unit` with `--coverage` flag

**Decision:** The CI Coverage Validation job runs `bun run test:unit --coverage`. No new script is
required. **Rationale:** The `test:unit` script already targets the correct set of unit-test
projects. Adding `--coverage` applies coverage collection and threshold enforcement (from
`vitest.config.ts`) without needing a separate script entry. **Clarification alignment:** FR-10 Step
6 coverage depends on `unit-tests` only. Integration test coverage is informational. This matches
the clarification: "Unit-test coverage only is threshold-enforced in this stage."

### D-06: `@vitest/coverage-v8` as coverage provider

**Decision:** Use `@vitest/coverage-v8` (V8-based, no instrumentation overhead). **Rationale:**
Compatible with Bun/Node, does not require Babel instrumentation like `@vitest/coverage-istanbul`.
Faster for a monorepo. The `provider: 'v8'` must be set in `vitest.config.ts`.

---

## 4. Files That Are Already Correct and Must Not Be Modified

The following files are fully compliant with all functional requirements and **must not be changed**
by this stage implementation:

- `eslint.config.mjs`
- `prettier.config.mjs`
- `vitest.workspace.ts`
- All per-app and per-package `vitest.config.ts` files (`apps/*/vitest.config.ts`,
  `packages/*/vitest.config.ts`)
- All `apps/*/playwright.config.ts` files
- All `apps/*/README.md` and `packages/*/README.md` files
- `.github/workflows/architecture-governance.yml`
- `.github/workflows/hard-mode-guard.yml`
- All `root package.json` scripts (except additions — no existing script may be removed or renamed)
