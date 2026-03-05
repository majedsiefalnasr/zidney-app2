# Tasks: Infrastructure Governance

**Phase:** 01_PLATFORM_FOUNDATION
**Stage:** STAGE_INFRA_GOVERNANCE
**Plan:** `specs/runtime/infra-governance/plan.md`
**Spec:** `specs/runtime/infra-governance/spec.md`
**Tasks Version:** 1.0.0
**Date:** 2026-03-05
**Status:** READY FOR EXECUTION

---

## Constitution Gate

| Rule                             | Result |
| -------------------------------- | ------ |
| No database access introduced    | PASS   |
| No middleware bypass             | PASS   |
| No attempt engine changes        | PASS   |
| Import boundary compliance       | PASS   |
| No architectural runtime changes | PASS   |
| ADR required                     | NO     |

Implementation may proceed.

---

## Dependency Order

```
T001 → T002 → T003 → T004   (sequential: all edit package.json)
                  ↓
         T005 [P], T006 [P]  (parallel: different files; can start once T004 is done)
                  ↓
              T007            (bun install — requires T001–T004 committed to package.json)
                  ↓
              T008            (bun run prepare — Husky init; requires T007)
                  ↓
    T009 [P], T010 [P]       (parallel: different hook files; requires T008)

T011 → T012 → T013 → T014   (sequential: all edit scripts/infra-audit.ts)

T015 → T016 → T017 → T018 → T019 → T020   (sequential: all edit .github/workflows/ci.yml)

T021, T022                   (post-install verification and manual gate; requires T009, T010)
```

---

## Tasks

### Phase 1 — package.json Additions (Work Items T001 + T002)

- [ ] T001 Add `"@vitest/coverage-v8": "^1.0.0"` to `devDependencies` in `package.json`
- [ ] T002 Add `"husky": "^9.0.0"` to `devDependencies` in `package.json`
- [ ] T003 Add `"lint-staged": "^15.0.0"` to `devDependencies` in `package.json`
- [ ] T004 Add `"prepare": "husky"` to the `scripts` section in `package.json`

### Phase 2 — Config File Changes (Work Items T001 + T003)

- [ ] T005 [P] Update coverage block in `vitest.config.ts`: add `provider: 'v8'`, expand `exclude` array to include `**/*.d.ts`, `**/vitest.config.ts`, `**/playwright.config.ts`, and add `thresholds` block (lines ≥ 85, functions ≥ 85, statements ≥ 85, branches ≥ 80)
- [ ] T006 [P] Create `lint-staged.config.mjs` at repo root with two rules: run `eslint --fix` then `prettier --write` on `*.{ts,tsx,vue}` staged files; run `prettier --write` on `*.{md,json}` staged files

### Phase 3 — Dependency Installation (Work Item T002)

- [ ] T007 Run `bun install` from repo root to install `@vitest/coverage-v8`, `husky`, and `lint-staged` from the updated `package.json`
- [ ] T008 Run `bun run prepare` from repo root to initialize Husky — creates `.husky/_/` directory and makes existing hook files executable

### Phase 4 — Husky Hook Files (Work Items T004 + T005)

- [ ] T009 [P] Rewrite `.husky/pre-commit` in Husky v9 format (plain `#!/bin/sh`, no `_/husky.sh` sourcing): add `bunx lint-staged` (staged ESLint fix + Prettier), `bun scripts/ai-guard.ts` (hard gate), `bun scripts/infra-audit.ts --quick` (structural governance hard gate)
- [ ] T010 [P] Create `.husky/pre-push` as a new file with Husky v9 format: add `bun run lint` (full repo ESLint), `bun run typecheck` (TypeScript type check — not `type-check`), `bun run test:unit` (unit-test tier only)

### Phase 5 — infra-audit.ts `--quick` Flag (Work Item T006)

- [ ] T011 Add `const QUICK_MODE = process.argv.includes('--quick')` on the line immediately after the existing `CI_MODE` constant at line 876 in `scripts/infra-audit.ts`
- [ ] T012 Guard all five top-level `mkdirSync` blocks (for `REPORT_DIR`, `ARCH_DIR`, `ARCH_GRAPHS_DIR`, `ARCH_INTEL_DIR`, `ARCH_HISTORY_DIR` at lines 39–56) with `if (!QUICK_MODE) { ... }` in `scripts/infra-audit.ts`
- [ ] T013 Wrap every `writeFileSync` call in the report-generation section (lines 992–1223) with `if (!QUICK_MODE) { ... }` in `scripts/infra-audit.ts` — violation scan variables must still be computed; only file I/O is guarded
- [ ] T014 Extend the enforcement exit block from `if (CI_MODE)` to `if (CI_MODE || QUICK_MODE)` at line 1288 in `scripts/infra-audit.ts` so `--quick` triggers the same non-zero exit on violations as `--ci`

### Phase 6 — CI Workflow Updates (Work Item T007)

- [ ] T015 Remove the monolithic `e2e-tests` job from `.github/workflows/ci.yml` (currently at line 173)
- [ ] T016 Add `e2e-mmc` job to `.github/workflows/ci.yml`: `needs: [integration-tests]`, timeout 30 min, installs Chromium, starts MMC dev server on port 5173 with `bun run dev:mmc &`, waits with `bunx wait-on`, runs `bun run test:e2e:mmc`, uploads `apps/mmc/playwright-report/` artifact on failure (retention 7 days)
- [ ] T017 Add `e2e-backoffice` job to `.github/workflows/ci.yml`: `needs: [integration-tests]`, timeout 30 min, installs Chromium, starts Backoffice dev server on port 5174 with `bun run dev:backoffice &`, waits with `bunx wait-on`, runs `bun run test:e2e:backoffice`, uploads `apps/backoffice/playwright-report/` artifact on failure (retention 7 days)
- [ ] T018 Add `e2e-frontoffice` job to `.github/workflows/ci.yml`: `needs: [integration-tests]`, timeout 30 min, installs Chromium, starts Frontoffice dev server on port 5175 with `bun run dev:frontoffice &`, waits with `bunx wait-on`, runs `bun run test:e2e:frontoffice`, uploads `apps/frontoffice/playwright-report/` artifact on failure (retention 7 days)
- [ ] T019 Add `coverage-validation` job to `.github/workflows/ci.yml`: `needs: [unit-tests]`, timeout 20 min, runs `bun run test:unit --coverage` (threshold enforcement via `vitest.config.ts`), uploads `coverage/` artifact with `if: always()` (retention 14 days)
- [ ] T020 Add `build-verification` job to `.github/workflows/ci.yml`: `needs: [lint, typecheck, unit-tests, integration-tests, e2e-mmc, e2e-backoffice, e2e-frontoffice, coverage-validation]`, timeout 20 min, runs `bun run build`

### Phase 7 — Post-Installation Verification & Manual Gate

- [ ] T021 Verify hooks are operational: run `cat .husky/pre-commit` and `cat .husky/pre-push` and confirm correct Husky v9 content; run `ls -la .husky/` to confirm files are executable (mode `755`)
- [ ] T022 Update GitHub branch protection rules on `main` in repository settings to require all nine status checks before merge: `Lint`, `Type Check`, `Unit Tests`, `Integration Tests`, `E2E: MMC`, `E2E: Backoffice`, `E2E: Frontoffice`, `Coverage Validation`, `Build Verification`

---

## Parallel Execution Map

| Group | Tasks      | Files Modified                               | Trigger    |
| ----- | ---------- | -------------------------------------------- | ---------- |
| A     | T005, T006 | `vitest.config.ts`, `lint-staged.config.mjs` | After T004 |
| B     | T009, T010 | `.husky/pre-commit`, `.husky/pre-push`       | After T008 |

All other tasks are sequential within their phase due to operating on the same file.

---

## Implementation Strategy

**Recommended execution order:**

1. Complete T001–T004 as a single atomic `package.json` edit session
2. Execute T005 and T006 in parallel (different files, mutual independence)
3. Run T007 (`bun install`) — blocks T008
4. Run T008 (`bun run prepare`) — blocks T009, T010
5. Execute T009 and T010 in parallel (different hook files)
6. Execute T011–T014 sequentially (single file, logic-order dependency)
7. Execute T015–T020 sequentially (single file; T015 must precede T016–T018 to remove the conflicting monolithic job)
8. Execute T021 to confirm operational state before pushing CI changes
9. Execute T022 manually in GitHub repository settings after CI is deployed

**Pre-CI-deployment gate:** T021 must pass before the branch containing T015–T020 is pushed. Hook infrastructure must be confirmed working locally before CI validates it in pipeline.

**Lockfile note:** After T007, if the pnpm lockfile is regenerated, commit the updated lockfile alongside `package.json` in the same commit. CI uses `bun install --frozen-lockfile` — a stale lockfile will break the pipeline.

---

<!-- TASKS_TOTAL: 22 -->

**TASKS_TOTAL: 22**
