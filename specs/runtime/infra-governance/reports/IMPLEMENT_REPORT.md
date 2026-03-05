# Implementation Report: Infrastructure Governance

**Stage:** STAGE_INFRA_GOVERNANCE
**Date:** 2026-03-05
**Branch:** infra-governance
**Implementer:** GitHub Copilot (Claude Sonnet 4.6)
**Tasks Completed:** 21 / 22 (T022 deferred — manual GitHub action required)

---

## Files Modified

### 1. `package.json` (root)

**Tasks:** T001, T002, T003, T004

**Changes:**

- Added `"@vitest/coverage-v8": "^1.0.0"` to `devDependencies`
- Added `"husky": "^9.0.0"` to `devDependencies`
- Added `"lint-staged": "^15.0.0"` to `devDependencies`
- Added `"prepare": "husky"` to `scripts`

**Installed versions:** `@vitest/coverage-v8@1.6.1`, `husky@9.1.7`, `lint-staged@15.5.2`

---

### 2. `vitest.config.ts` (root)

**Task:** T005

**Changes (coverage block):**

```ts
// Before:
coverage: {
  reporter: ['text', 'json', 'html'],
  exclude: ['node_modules/', 'dist/', 'build/', 'tests/e2e/**'],
},

// After:
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

**Coverage gap note:** Coverage thresholds cannot be verified clean until pre-existing test failures are resolved. See `audits/VALIDATION_REPORT.md` for full gap analysis.

---

### 3. `lint-staged.config.mjs` (root — NEW FILE)

**Task:** T006

**Content:**

```mjs
export default {
  '*.{ts,tsx,vue}': ['eslint --fix', 'prettier --write'],
  '*.{md,json}': ['prettier --write'],
}
```

---

### 4. `.husky/pre-commit`

**Task:** T009

**Change:** Rewritten from Husky v8 format (with `_/husky.sh` sourcing) to Husky v9 format.

**Key changes:**

- Removed `#!/usr/bin/env sh` → replaced with `#!/bin/sh`
- Removed `. "$(dirname -- "$0")/_/husky.sh"` (v8 shell source)
- Removed `bun run lint` (full repo lint, replaced by staged-only lint-staged)
- Removed `bun run type-check` (script did not exist)
- Added `bunx lint-staged` (staged ESLint fix + Prettier — only staged files)
- Retains `bun scripts/ai-guard.ts` (architecture guard)
- Retains `bun scripts/infra-audit.ts --quick` (governance gate)

---

### 5. `.husky/pre-push` (NEW FILE)

**Task:** T010

**Content:**

```sh
#!/bin/sh
bun run lint
bun run typecheck
bun run test:unit
```

**Notes:**

- Uses `bun run typecheck` (correct script name, NOT `type-check`)
- Runs `bun run test:unit` (unit-test tier only, not integration or E2E)

---

### 6. `bun.lock`

**Task:** T007 artifact

Lockfile updated automatically by `bun install` when adding the three new devDependencies. Must be committed alongside `package.json`.

---

### 7. `scripts/infra-audit.ts`

**Tasks:** T011, T012, T013, T014

**Changes:**

**T011 — QUICK_MODE constant at line 32:**

```ts
const ROOT = process.cwd()
const QUICK_MODE = process.argv.includes('--quick') // ← added at line 32
```

**T012 — mkdirSync guards:**

```ts
// Before:
if (!existsSync(REPORT_DIR)) {
  mkdirSync(REPORT_DIR, { recursive: true })
}
// ... (5 blocks)

// After:
if (!QUICK_MODE && !existsSync(REPORT_DIR)) {
  mkdirSync(REPORT_DIR, { recursive: true })
}
// ... (all 5 blocks guarded)
```

**T013 — writeFileSync wrapped in if (!QUICK_MODE) block:**

All file write operations (infra-audit-report.json, dependency-graph.json, dependency-graph-ai.json, dependency-graph.mmd, architecture-graph.mmd, history file, ARCHITECTURE_DASHBOARD.md, ARCHITECTURE_HEATMAP.md, ARCHITECTURE_CONTEXT.json, ARCHITECTURE_CONTRACT.json, architecture-graph.html) are wrapped in a single `if (!QUICK_MODE) { ... }` block.

Violation scan variables (circularDependencies, depViolations, layerViolations, architectureDrift, architectureScore) are computed regardless of QUICK_MODE.

**T014 — Enforcement block extended:**

```ts
// Before:
if (CI_MODE) {

// After:
if (CI_MODE || QUICK_MODE) {
```

**Bonus fix:** Fixed pre-existing `no-useless-escape` lint errors at (original) lines 783-784:

```ts
// Before (useless escape):
edge.from.replace(/[\/-]/g, '_')

// After (fixed):
edge.from.replace(/[/-]/g, '_')
```

---

### 8. `.github/workflows/ci.yml`

**Tasks:** T015, T016, T017, T018, T019, T020

**T015 — Removed monolithic `e2e-tests` job** (was lines 173-246, merged all 3 apps into one job with sequential test runs)

**T016-T018 — Added 3 separate per-app E2E jobs:**

- `e2e-mmc`: needs `integration-tests`, port 5173, uploads `apps/mmc/playwright-report/` on failure
- `e2e-backoffice`: needs `integration-tests`, port 5174, uploads `apps/backoffice/playwright-report/` on failure
- `e2e-frontoffice`: needs `integration-tests`, port 5175, uploads `apps/frontoffice/playwright-report/` on failure

Each job:

- Runs independently (can run in parallel in CI)
- Installs Chromium only
- Starts its own dev server
- Uploads per-app report artifact on failure (7 days retention)

**T019 — Added `coverage-validation` job:**

- `needs: [unit-tests]`
- Runs `bun run test:unit --coverage` (threshold enforcement via vitest.config.ts)
- Uploads `coverage/` artifact with `if: always()` (14 days retention)

**T020 — Added `build-verification` job:**

- `needs: [lint, typecheck, unit-tests, integration-tests, e2e-mmc, e2e-backoffice, e2e-frontoffice, coverage-validation]`
- Runs `bun run build`
- Gate job — only runs if all prior jobs pass

**New CI job topology:**

```
lint ──────────────────────────────────────────────────────────┐
typecheck ─────────────────────────────────────────────────────┤
                                                              unit-tests
                                                                │
                                         ┌──────────────────────┤
                                         ▼                      ▼
                                integration-tests    coverage-validation
                                         │
                     ┌───────────────────┼────────────────────┐
                     ▼                   ▼                    ▼
                  e2e-mmc        e2e-backoffice         e2e-frontoffice
                     │                   │                    │
                     └───────────────────┴──────────┬─────────┘
                                                     ▼
                                            build-verification
```

---

## Deferred Tasks

### T022 — GitHub Branch Protection (MANUALLY REQUIRED)

**Status:** Deferred (requires manual action in GitHub repository settings — cannot be automated)

**Instructions for manual completion:**

1. Go to `https://github.com/<owner>/zidney-app2/settings/branches`
2. Click "Add branch protection rule" or edit the existing `main` rule
3. Enable "Require status checks to pass before merging"
4. Add the following required status checks:
   - `Lint`
   - `Type Check`
   - `Unit Tests`
   - `Integration Tests`
   - `E2E: MMC`
   - `E2E: Backoffice`
   - `E2E: Frontoffice`
   - `Coverage Validation`
   - `Build Verification`
5. Enable "Require branches to be up to date before merging"
6. Save the rule

**Note:** These status checks will only appear in the dropdown after the first CI run that includes the new jobs has completed. Push the branch and create a PR to trigger the first run.

---

## Execution Order Summary

The following execution order was used (deviating from tasks.md sequence to address prerequisites):

1. **T009, T010** — Hook files rewritten to v9 format BEFORE installing Husky v9
2. **T001–T004** — package.json updated with new deps and prepare script
3. **T007** — `bun install` (Husky v9 installed; hooks already in v9 format)
4. **T008** — `bun run prepare` + `chmod 755` on hook files
5. **Coverage baseline check** — `bun run test:coverage` (failed due to pre-existing issues)
6. **T005** — vitest.config.ts updated with provider, excludes, and target thresholds
7. **T006** — lint-staged.config.mjs created
8. **T011–T014** — infra-audit.ts QUICK_MODE flag implementation
9. **T015–T020** — ci.yml E2E split + coverage + build jobs
10. **T021** — 6-step behavioral verification
11. **T022** — Documented manual steps

---

## Pre-existing Issues (Not Introduced by This Stage)

| Issue                         | File                                 | Count | Impact                        |
| ----------------------------- | ------------------------------------ | ----- | ----------------------------- |
| no-restricted-globals `fetch` | packages/api-client/tests/           | 4     | lint error                    |
| no-restricted-globals `fetch` | apps/backoffice/tests/               | 4     | lint error                    |
| no-restricted-globals `fetch` | apps/frontoffice/tests/              | 2     | lint error                    |
| no-restricted-imports         | apps/mmc                             | 1     | lint error                    |
| no-loss-of-precision          | 1 file                               | 1     | lint error                    |
| TS2306 (not a module)         | apps/mmc/main.ts                     | 1     | type error                    |
| TS2306 (not a module)         | apps/frontoffice/main.ts             | 1     | type error                    |
| Failing unit tests            | domain-core, backoffice, frontoffice | 26    | test failure                  |
| Failing integration tests     | tests/integration/                   | 45+   | test failure (needs DB/Redis) |

All of the above existed before this stage and are documented here for transparency.
