# Testing Guide — Infrastructure Governance

**Stage:** Infrastructure Governance **Phase:** 01_PLATFORM_FOUNDATION **Stage Directory:**
`specs/runtime/infra-governance/` **Generated On:** 2026-03-05

---

## Purpose

This guide explains how to validate the infrastructure governance tooling changes introduced in this
stage. It is intended for engineers reviewing the PR and QA engineers performing end-to-end
validation of the commit hook system, CI pipeline, and coverage tooling.

---

## Summary of Delivered Behavior

This stage establishes the mandatory infrastructure governance baseline for the entire Zidney
monorepo. Prior to this stage, commit hooks were either absent or using the old Husky v8 format,
coverage tooling was not configured, and the CI pipeline ran a single monolithic E2E job for all
apps.

After this stage:

- Every `git commit` runs lint-staged (per-file ESLint + Prettier), the AI architecture guard, and
  `infra-audit --quick` (architecture score gate)
- Every `git push` runs the full unit test suite to prevent broken pushes
- Coverage reports are generated with the v8 provider with thresholds defined (relaxed via
  `failOnError: false` until the clean baseline is measured)
- CI runs E2E for each app (mmc, backoffice, frontoffice) in fully isolated jobs
- `scripts/infra-audit.ts` accepts a `--quick` / `-q` flag completing in seconds instead of the full
  30+ second deep audit

---

## Prerequisites

| Requirement            | Validation Command / Check                                                  |
| ---------------------- | --------------------------------------------------------------------------- |
| Bun installed (v1.x)   | `bun --version`                                                             |
| Git v2.x+              | `git --version`                                                             |
| Node.js v20+           | `node --version` (for vitest/playwright)                                    |
| Correct branch         | `git branch` should show `infra-governance`                                 |
| Dependencies installed | Re-run `bun install` to ensure Husky v9 + lint-staged + wait-on are present |

**No database, no Docker, no API server required.** This stage is tooling-only.

---

## Files in Scope

```text
package.json                                  ← devDependencies + prepare script
vitest.config.ts                              ← coverage provider + thresholds
lint-staged.config.mjs                        ← NEW: per-file lint/format config
.husky/pre-commit                             ← Husky v9 rewrite
.husky/pre-push                               ← NEW: test:unit gate
scripts/infra-audit.ts                        ← --quick / -q flag added at line 32
.github/workflows/ci.yml                      ← E2E split + coverage + build jobs
```

---

## Local Run Commands

```bash
# Install dependencies (important: installs Husky v9 hooks via prepare script)
bun install

# Run unit tests (what pre-push hook executes)
bun run test:unit

# Run architecture audit (full)
bun run scripts/infra-audit.ts

# Run architecture audit (quick — what pre-commit hook executes)
bun run scripts/infra-audit.ts --quick

# Run coverage report
bun run test --coverage
```

---

## Automated Validation Commands

```bash
# Verify hooks are executable
ls -la .husky/

# Expected output:
# -rwxr-xr-x  1 <user>  staff  ...  pre-commit
# -rwxr-xr-x  1 <user>  staff  ...  pre-push

# Run unit test suite (mirrors pre-push hook)
bun run test:unit

# Run lint (to confirm stable baseline — expect 12 pre-existing errors, no new ones)
bun run lint 2>&1 | tail -5

# Run type-check (to confirm 2 pre-existing TS2306, no new errors)
bun run typecheck 2>&1 | tail -10

# Run coverage (expect thresholds to be calculated but NOT fail the run — failOnError:false)
bun run test --coverage 2>&1 | tail -20
```

Expected outcome: unit tests pass, lint shows at most 12 pre-existing errors, typecheck shows at
most 2 pre-existing TS2306 errors, coverage runs to completion without failing the process.

---

## Manual Test Scenarios

### Scenario 1 — Pre-Commit Hook Fires on `git commit`

**Purpose:** Verify that the Husky v9 pre-commit hook actually runs lint-staged, ai-guard, and
infra-audit on every commit.

1. Create a test file with a minor change: `echo "// test" >> apps/api/src/index.ts`
2. Stage it: `git add apps/api/src/index.ts`
3. Run: `git commit -m "test: trigger pre-commit hook"`
4. Observe terminal output for:
   - `Running tasks for staged files...` (lint-staged)
   - `AI Guard: architecture validation passed.` (ai-guard)
   - `[INFRA AUDIT] Starting...` and `Architecture score: 100 / 100` (infra-audit --quick)

Expected: Commit succeeds. All three hook steps complete without error. The commit appears in
`git log`.

Troubleshooting:

- If `husky: command not found` → run `bun install` to re-trigger the `prepare` script which
  installs hooks.
- If `lint-staged` fails on ESLint errors → these are pre-existing errors. The pre-commit hook runs
  lint-staged with `--fix`, so fixable issues auto-fix. Non-fixable errors will block the commit.
- Undo the test commit: `git reset --soft HEAD~1` then `git restore apps/api/src/index.ts`

---

### Scenario 2 — Pre-Push Hook Runs Unit Tests

**Purpose:** Verify that `git push` triggers `bun run test:unit` and blocks on failures.

1. Ensure you are on the `infra-governance` branch.
2. Make a small uncommitted change: `echo "// push-test" >> package.json`
3. Stage and commit: `git add package.json && git commit -m "test: trigger pre-push"`
4. Attempt a push to a **test remote** (do NOT push to origin if you want to avoid polluting the
   remote): `git push --dry-run origin infra-governance`
   - Alternatively, inspect what the pre-push hook would do by running `bun run test:unit` directly.
5. Observe: `bun run test:unit` runs all unit tests.

Expected: All unit tests pass (exit 0). The push is not blocked. If any unit test fails → push is
blocked with a clear exit code 1 from the hook.

Troubleshooting:

- If tests fail, run `bun run test:unit 2>&1 | grep -E "FAIL|Error"` to identify the failing test
  file.
- Undo the test commit: `git reset --soft HEAD~1` then `git restore package.json`

---

### Scenario 3 — infra-audit `--quick` Flag Performance (Edge Case)

**Purpose:** Verify that `scripts/infra-audit.ts --quick` exits quickly and scores correctly without
running the full deep audit.

1. Run the full audit (baseline timing): `time bun run scripts/infra-audit.ts`
2. Run the quick audit: `time bun run scripts/infra-audit.ts --quick`
3. Compare elapsed times.

Expected:

- Full audit: typically 15–40 seconds depending on codebase size.
- Quick audit (`--quick`): exits in under 5 seconds.
- Both should output `Architecture score: 100 / 100` (or the current score — must not drop below
  90).
- Quick audit exits with code 0.

Troubleshooting:

- If `--quick` takes as long as the full audit → `QUICK_MODE` variable at line 32 of
  `scripts/infra-audit.ts` may have been moved. Verify: `sed -n '28,40p' scripts/infra-audit.ts`
  should show `QUICK_MODE` at line 32 immediately after `ROOT` at line 31.

---

## CI Pipeline Validation

### Verify the E2E job split in GitHub Actions

After the PR is merged, confirm the following jobs appear in the GitHub Actions run for the PR:

| Job Name              | Expected Port | Status Gate                      |
| --------------------- | ------------- | -------------------------------- |
| `e2e-mmc`             | 5173          | Required                         |
| `e2e-backoffice`      | 5174          | Required                         |
| `e2e-frontoffice`     | 5175          | Required                         |
| `coverage-validation` | N/A           | Non-blocking (failOnError:false) |
| `build-verification`  | N/A           | Required                         |

Each E2E job must:

1. Install dependencies
2. Start the app on its designated port
3. Run Playwright tests in that app's directory
4. Upload the Playwright report as an artifact

---

## Negative Cases

| Scenario                                       | Trigger                                                            | Expected Response                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Commit with unstaged formatting errors         | Stage a `.ts` file with trailing spaces                            | lint-staged runs prettier --write and auto-fixes; commit resumes                  |
| Commit with unfixable ESLint error             | Introduce `var x = 1` in a staged file (if `no-var` rule is error) | lint-staged fails; commit aborted with lint error output                          |
| Push with failing unit test                    | Introduce a `expect(true).toBe(false)` in a unit test              | pre-push hook exits 1; push blocked; test failure printed                         |
| infra-audit score below threshold              | Manually add a circular dependency                                 | pre-commit hook exits 1; `[INFRA AUDIT] CRITICAL` in output                       |
| Coverage threshold not met (failOnError:false) | Delete unit tests to drop line coverage below 85%                  | coverage job runs; threshold violation reported; CI does NOT fail (design intent) |

---

## Multi-Tenant Isolation Verification

Not applicable for this stage. The Infrastructure Governance stage is tooling-only and introduces no
application code, database access, API endpoints, or tenant-scoped logic. There is no test-isolation
scenario to run.

---

## Known Documentation Debt (Do Not Block PR)

| Item                                                       | When to Act                                                            |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| Re-enable `bun run lint` + `bun run typecheck` in pre-push | After pre-existing 12 lint + 2 TS2306 errors on develop are resolved   |
| Re-enable `failOnError: true` in vitest thresholds         | After clean unit-only coverage baseline is measured                    |
| Start API server in E2E CI jobs                            | If/when E2E tests begin requiring API responses                        |
| T022: GitHub branch protection                             | Manual admin action → follow instructions in IMPLEMENT_REPORT.md §T022 |
