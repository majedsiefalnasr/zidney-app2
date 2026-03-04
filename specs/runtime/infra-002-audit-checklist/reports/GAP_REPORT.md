# Gap Report — INFRA_AUDIT_CHECKLIST

## Related Documents

- [RISK_CLASSIFICATION.md](./RISK_CLASSIFICATION.md)
- [SAFE_ROLLOUT_PLAN.md](./SAFE_ROLLOUT_PLAN.md)

---

## Audit Metadata

| Field         | Value                                      |
| ------------- | ------------------------------------------ |
| Timestamp     | 2026-03-04T09:37:45.391Z                   |
| Git SHA       | `10d878c3ae506e15ecd470327598ac87de186fb2` |
| Branch        | `infra-002-audit-checklist`                |
| Auditor       | speckit.implement (automated audit stage)  |
| Bun Version   | 1.3.9                                      |
| Script Output | `infra-audit-report.json` (at repo root)   |

---

## §1 Vitest Configuration Inventory (US1)

### 1.1 Discovered Configs

Five `vitest.config.ts` files found across the monorepo. No `vitest.workspace.*` file found at root.

| Config Path                            | `test.environment` | `globals` | Coverage Enabled | Custom Reporters       |
| -------------------------------------- | ------------------ | --------- | ---------------- | ---------------------- |
| `vitest.config.ts` (root)              | `node`             | `true`    | ✅ YES           | `text`, `json`, `html` |
| `apps/backoffice/vitest.config.ts`     | `jsdom`            | `true`    | ❌ NO            | —                      |
| `apps/frontoffice/vitest.config.ts`    | `jsdom`            | `true`    | ❌ NO            | —                      |
| `apps/mmc/vitest.config.ts`            | `jsdom`            | `true`    | ❌ NO            | —                      |
| `packages/api-client/vitest.config.ts` | _(not set)_        | `true`    | ❌ NO            | —                      |

### 1.2 Conflicts Detected

| Property      | Root Config | App Configs (backoffice/frontoffice/mmc) | api-client  |
| ------------- | ----------- | ---------------------------------------- | ----------- |
| `environment` | `node`      | `jsdom`                                  | _(not set)_ |
| `coverage`    | Enabled     | Not enabled                              | Not enabled |

**Conflict:** `test.environment` is `node` in root but `jsdom` in all three Vue app configs. Coverage block only defined in root, not in per-app configs. `packages/api-client` does not set environment at all.

### 1.3 Missing Workspace Consolidation

No `vitest.workspace.ts` or `vitest.workspace.js` found at root. 5 independent configs without a central workspace orchestrator creates a fragmentation risk: running `vitest run` from root does not automatically execute per-app configs.

### 1.4 Consolidation Risk

**Verdict: HIGH** — 5 separate Vitest configs with environment conflicts and no workspace consolidation file.

**GAP-V1:** No `vitest.workspace.*` at repo root — each app must be run independently.  
**GAP-V2:** `test.environment` conflict — root uses `node`, Vue apps use `jsdom`, api-client unset.  
**GAP-V3:** Coverage configuration only in root config — per-app configs do not enforce coverage collection.

---

## §2 Test Distribution Audit (US2)

### 2.1 Test File Counts (from infra-audit-report.json)

| App / Package      | Unit Tests | Integration Tests | Spec Tests | Total   |
| ------------------ | ---------- | ----------------- | ---------- | ------- |
| `apps/api`         | 2          | 32                | 0          | 34      |
| `apps/mmc`         | 0          | 4                 | 3          | 7       |
| `apps/frontoffice` | 0          | 2                 | 3          | 5       |
| `apps/backoffice`  | 0          | 2                 | 4          | 6       |
| `apps/worker`      | 0          | 1                 | 0          | 1       |
| `tests/` (root)    | —          | ~57               | —          | ~57     |
| `packages/*`       | —          | —                 | 4+         | 4+      |
| **Total**          | **2**      | **100**           | **14**     | **116** |

> Note: Root `tests/integration/` files are counted in the integration total. Per-app unit counts reflect `apps/*/src/**/*.test.ts` files only.

### 2.2 E2E Tests

**Playwright configs found: 0**  
All 5 apps return `e2ePresent: false`. E2E testing with Playwright is completely absent from the monorepo.

**GAP-E1:** No E2E test configuration present in any app — all apps are `e2ePresent: false`.

### 2.3 Unit Test Coverage Gap

Only `apps/api` has unit tests in `src/` (2 files). All Vue frontend apps have 0 unit tests in their `src/` directory.

**GAP-E2:** Frontend apps (backoffice, frontoffice, mmc) have 0 unit tests in `apps/*/src/` — all testing is integration-only.

### 2.4 Skipped & Flaky Tests (Static Scan)

| Metric        | Count | Detection Method   |
| ------------- | ----- | ------------------ |
| Skipped tests | 10    | `STATIC_SCAN_ONLY` |
| Flaky tests   | 2     | `STATIC_SCAN_ONLY` |

**Skipped test files (10):**

- `tests/unit/license-rbac.test.ts`
- `tests/security/licenses.security.test.ts`
- `tests/integration/licenses.e2e.test.ts`
- `tests/integration/provisioning-failure.test.ts`
- `tests/integration/license-soft-lock.test.ts`
- `packages/ui-system/tests/unit/DataTable.spec.ts`
- `packages/ui-system/tests/unit/composables.spec.ts`
- `packages/ui-system/tests/unit/utilities.spec.ts`
- `apps/api/tests/integration/tenant-resolver.test.ts`
- `apps/worker/tests/unit/provisioning/provisioning.test.ts`

**Files with flaky markers (2):**

- `packages/api-client/tests/client.test.ts`
- `apps/worker/tests/load-testing.test.ts`

**GAP-T1:** 10 test files contain `.skip(` or `.todo(` patterns — these tests are not running in CI.  
**GAP-T2:** 2 test files contain `.retry(` or `// flaky` markers indicating known non-determinism.

---

## §3 ESLint Configuration Audit (US3)

### 3.1 Config Inventory

| Config Path                         | Format    | Scope             |
| ----------------------------------- | --------- | ----------------- |
| `eslint.config.mjs`                 | Flat (v9) | Root (all apps)   |
| `apps/backoffice/eslint.config.js`  | Flat (v9) | App — backoffice  |
| `apps/frontoffice/eslint.config.js` | Flat (v9) | App — frontoffice |
| `apps/mmc/eslint.config.js`         | Flat (v9) | App — mmc         |

**No ESLint configs for:** `apps/api`, `apps/worker`, or any `packages/*` directory.

### 3.2 Rule Severity Table

#### Root `eslint.config.mjs`

| Rule                                 | Severity  | Notes                                          |
| ------------------------------------ | --------- | ---------------------------------------------- |
| `no-unused-vars`                     | —         | Handled by `@typescript-eslint/no-unused-vars` |
| `@typescript-eslint/no-unused-vars`  | `warn`    | Args/vars matching `^_` are ignored            |
| `@typescript-eslint/no-explicit-any` | `warn`    | Not enforced as error                          |
| `no-console`                         | `warn`    | Not enforced as error                          |
| `vue/multi-word-component-names`     | _(unset)_ | Not configured in any ESLint config            |

#### Per-App Configs (backoffice, frontoffice, mmc)

| Rule                                 | Severity             |
| ------------------------------------ | -------------------- |
| `@typescript-eslint/no-unused-vars`  | _(inherits root)_    |
| `@typescript-eslint/no-explicit-any` | _(inherits root)_    |
| `no-console`                         | _(inherits root)_    |
| `vue/multi-word-component-names`     | _(unset everywhere)_ |

> Per-app configs only override import-related rules (`no-restricted-imports`, `import/no-restricted-paths`) and `import.meta.env` enforcement (`no-restricted-syntax`). No rules are overridden to `error` for the 4 monitored rules.

### 3.3 Prettier Conflict Risk

**`prettier` in root `devDependencies`:** ❌ Not found  
**`eslint-config-prettier` in any `package.json`:** ❌ Not found  
**Verdict: NEEDS_ALIGNMENT** — No Prettier integration configured; formatting rules may conflict with any future Prettier addition.

### 3.4 Active ESLint Errors (pre-existing)

From `bun run lint` (SHA: `10d878c3ae506e15ecd470327598ac87de186fb2`, timestamp: 2026-03-04):

| Metric   | Count |
| -------- | ----- |
| Errors   | 10    |
| Warnings | 2369  |
| Total    | 2379  |

**GAP-L1:** `no-console` and `no-explicit-any` are set to `warn` in root config — these should be `error` to enforce the no-`console.log` rule from AGENTS.md.  
**GAP-L2:** `vue/multi-word-component-names` rule absent from all ESLint configs.  
**GAP-L3:** No ESLint config for `apps/api`, `apps/worker`, or any `packages/*` — these directories fall through to root config only.  
**GAP-L4:** 10 pre-existing ESLint errors in the codebase at current SHA.

---

## §4 CI Pipeline Audit (US4)

### 4.1 Workflow Enforcement Matrix

| Workflow                   | Lint       | Type Check | Unit Tests | Integration Tests | E2E Tests | Coverage Gate    |
| -------------------------- | ---------- | ---------- | ---------- | ----------------- | --------- | ---------------- |
| `test-stage-001.yml`       | ❌ ABSENT  | ❌ ABSENT  | ✅ PRESENT | ✅ PRESENT        | ❌ ABSENT | ⚠️ INFORMATIONAL |
| `typecheck.yml`            | ✅ PRESENT | ✅ PRESENT | ❌ ABSENT  | ❌ ABSENT         | ❌ ABSENT | ❌ ABSENT        |
| `mmc-dashboard-deploy.yml` | ✅ PRESENT | ✅ PRESENT | ✅ PRESENT | ✅ PRESENT        | ❌ ABSENT | ❌ ABSENT        |
| `hard-mode-guard.yml`      | ❌ ABSENT  | ❌ ABSENT  | ❌ ABSENT  | ❌ ABSENT         | ❌ ABSENT | ❌ ABSENT        |

> `hard-mode-guard.yml` is a governance workflow (validates SpecKit workflow-state.json). It does not run tests and is not expected to. Coverage result: informational = codecov upload only, no fail threshold.

### 4.2 Gaps Identified

**GAP-C1:** `test-stage-001.yml` has no Lint step and no Type Check step — static analysis is not enforced in the platform foundation test workflow.  
**GAP-C2:** No workflow enforces a coverage threshold gate — codecov uploads are informational only; a failing coverage percentage cannot block a merge.  
**GAP-C3:** E2E testing is absent from all 4 workflows.  
**GAP-C4:** `typecheck.yml` does not run any tests — it is a lint-only workflow by design, but a unified pre-merge gate combining lint, type-check, and unit tests is absent.

---

## §5 Bun Compatibility Check (US5)

### 5.1 Command Results

All commands run at SHA `10d878c3ae506e15ecd470327598ac87de186fb2` on 2026-03-04.

| Command                | Exit Code | Notes                                                                     |
| ---------------------- | --------- | ------------------------------------------------------------------------- |
| `bun install`          | 0         | 1122 installs, no changes; no compatibility warnings                      |
| `bun run tsc --noEmit` | non-zero  | 2 pre-existing TS errors (see §7); no errors in new files                 |
| `bun run lint`         | non-zero  | 10 errors, 2369 warnings; all pre-existing; none in new files             |
| `bun test --coverage`  | —         | **DB-GATED** — connection refused to staging API and local DB             |
| `bun run build`        | non-zero  | `bun workspaces run build` — `workspaces` subcommand not supported by Bun |

### 5.2 Coverage Baseline

`bun test --coverage` status: **DB-GATED**  
Coverage percentage: **UNAVAILABLE** — tests failed before coverage could be collected due to DB/network connection failures. No staging API (`staging-mmc-api.example.com`) is reachable, and local PostgreSQL/Redis services are not running. A baseline requires running inside Docker Compose test environment (`docker-compose.test.yml`).

### 5.3 Build Notes

The root `build` script is `bun workspaces run build`. Bun does not support the `workspaces` subcommand in this form (it is an npm-style workspace runner). Per-app builds (`bun run --cwd apps/mmc build`) work individually via Vite. The root build orchestration needs to be migrated to use Bun workspace syntax.

**GAP-B1:** Root `build` script uses `bun workspaces run build` — not a valid Bun command; per-app builds work individually.  
**GAP-B2:** TypeScript has 2 pre-existing errors (`apps/frontoffice/src/main.ts` and `apps/mmc/src/main.ts`): `TS2306: File 'apps/mmc/src/core/guards/index.ts' is not a module`.  
**GAP-B3:** `bun test --coverage` is DB-GATED; coverage baseline cannot be established without Docker Compose environment.

### 5.4 Verdict

**PARTIALLY COMPATIBLE** — `bun install` succeeds; per-app Vite builds succeed individually; test runner is environment-gated; root workspace build command requires migration from npm-style to Bun-native syntax.

---

## §6 README Coverage Audit (US6)

### 6.1 App Directory README Status

| Directory          | README Present | Status           |
| ------------------ | -------------- | ---------------- |
| `apps/api`         | ❌ No          | `README_MISSING` |
| `apps/backoffice`  | ❌ No          | `README_MISSING` |
| `apps/frontoffice` | ❌ No          | `README_MISSING` |
| `apps/mmc`         | ❌ No          | `README_MISSING` |
| `apps/worker`      | ❌ No          | `README_MISSING` |

**All 5 app directories are missing README files.**

### 6.2 Package Directory README Status

| Directory              | README Present | Status                             |
| ---------------------- | -------------- | ---------------------------------- |
| `packages/types`       | ✅ Yes         | `PRESENT` — sections NOT compliant |
| `packages/ui-system`   | ✅ Yes         | `PRESENT` — sections NOT compliant |
| `packages/api-client`  | ❌ No          | `README_MISSING`                   |
| `packages/config`      | ❌ No          | `README_MISSING`                   |
| `packages/domain-core` | ❌ No          | `README_MISSING`                   |
| `packages/logger`      | ❌ No          | `README_MISSING`                   |
| `packages/redis-utils` | ❌ No          | `README_MISSING`                   |
| `packages/validation`  | ❌ No          | `README_MISSING`                   |

**6 of 8 package directories are missing README files.**

### 6.3 Present READMEs — Section Compliance

Both present READMEs use non-standard section headings. None of the 7 required sections (Purpose, Responsibilities, Dependencies, Public API, How to Run Tests, Environment Variables, Known Boundaries) are present in either file.

| Section               | `packages/types` | `packages/ui-system` |
| --------------------- | ---------------- | -------------------- |
| Purpose               | MISSING          | MISSING              |
| Responsibilities      | MISSING          | MISSING              |
| Dependencies          | MISSING          | MISSING              |
| Public API            | MISSING          | MISSING              |
| How to Run Tests      | MISSING          | MISSING              |
| Environment Variables | MISSING          | MISSING              |
| Known Boundaries      | MISSING          | MISSING              |

> Both READMEs have substantial content but use domain-specific sections (Entity Types, Usage Examples, Component API, etc.) instead of the governance-required headings.

**GAP-R1:** All 5 `apps/*` directories missing README.md — HIGH documentation debt.  
**GAP-R2:** 6 of 8 `packages/*` directories missing README.md — HIGH documentation debt.  
**GAP-R3:** Both present READMEs (`packages/types`, `packages/ui-system`) lack all 7 required governance section headings — existing content must be reorganized to comply.

---

## §7 Technical Debt Snapshot (US7)

### 7.1 TypeScript Errors

| Metric          | Value                                      |
| --------------- | ------------------------------------------ |
| Total TS Errors | 2                                          |
| Timestamp       | 2026-03-04T09:37:45.391Z                   |
| Git SHA         | `10d878c3ae506e15ecd470327598ac87de186fb2` |

Errors:

1. `apps/frontoffice/src/main.ts(17,32): error TS2306: File 'apps/mmc/src/core/guards/index.ts' is not a module.`
2. `apps/mmc/src/main.ts(28,32): error TS2306: File 'apps/mmc/src/core/guards/index.ts' is not a module.`

**Root Cause:** `apps/mmc/src/core/guards/index.ts` does not export a proper module (no `export` statements). This affects both the MMC app itself and any consumer.

### 7.2 ESLint Debt

| Metric    | Value                                      |
| --------- | ------------------------------------------ |
| Errors    | 10                                         |
| Warnings  | 2369                                       |
| Timestamp | 2026-03-04T09:37:45.391Z                   |
| Git SHA   | `10d878c3ae506e15ecd470327598ac87de186fb2` |

The high warning count (2369) is dominated by `no-console` and `@typescript-eslint/no-explicit-any` at `warn` level across the entire codebase. If either rule is escalated to `error`, the error count would grow significantly.

### 7.3 Test Debt

| Metric             | Value              |
| ------------------ | ------------------ |
| Skipped test files | 10                 |
| Flaky test files   | 2                  |
| Detection method   | `STATIC_SCAN_ONLY` |

License-related tests (`licenses.e2e.test.ts`, `license-soft-lock.test.ts`, `license-rbac.test.ts`) are skipped — this is a governance risk.

### 7.4 Pre-commit Hook Integrity

Husky is installed (`.husky/pre-commit` exists). The pre-commit hook runs:

```
bun run lint
bun run type-check
```

However, `type-check` is not a defined script in root `package.json` — the correct script is `typecheck`. The `husky` package is not listed in root `package.json` devDependencies. The hook runs `bun run lint` which currently fails with exit 1 (pre-existing errors), so pre-commit linting would block all commits.

**GAP-D1:** 2 pre-existing TypeScript compilation errors.  
**GAP-D2:** Pre-commit hook references `bun run type-check` (script not found; correct name is `typecheck`).  
**GAP-D3:** `husky` is not listed in root `package.json` devDependencies — hook may not initialize on clean installs.  
**GAP-D4:** `bun run lint` exits with non-zero due to pre-existing errors — pre-commit hook currently blocks all commits.

---

## §8 Enforcement Readiness Score (US8)

**Verdict rule (CL7 — must appear verbatim):**

> 0 NEEDS WORK → `READY FOR ENFORCEMENT`  
> 1–3 NEEDS WORK → `PARTIAL — FIX REQUIRED`  
> 4–6 NEEDS WORK → `NOT READY`

### Score Table

| Governance Area      | Status     | Justification                                                                                                                                              |
| -------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest Consolidation | NEEDS WORK | 5 separate configs with `environment` conflicts (node vs jsdom vs unset); no `vitest.workspace.*` at root.                                                 |
| Coverage Threshold   | NEEDS WORK | No coverage threshold defined in any CI workflow; codecov upload is informational only — failures do not block merges.                                     |
| E2E Isolation        | NEEDS WORK | No Playwright config found in any app; E2E testing is completely absent from the monorepo.                                                                 |
| ESLint Enforcement   | NEEDS WORK | 10 pre-existing errors; `no-console` and `no-explicit-any` at `warn` (not `error`); `apps/api`, `apps/worker`, all packages lack dedicated ESLint configs. |
| Husky Hooks          | NEEDS WORK | Pre-commit hook references `bun run type-check` (script not found; correct name is `typecheck`); `husky` not in root devDependencies.                      |
| CI Matrix            | NEEDS WORK | `test-stage-001.yml` lacks lint and type-check; no workflow enforces a coverage threshold gate; E2E absent from all workflows.                             |

**NEEDS WORK count: 6**

### Overall Verdict

**`NOT READY`**

6 of 6 governance areas require remediation before enforcement can begin. This is consistent with the expected pre-governance-enforcement state. The [Safe Rollout Plan](./SAFE_ROLLOUT_PLAN.md) defines the sequenced remediation path.

---

## Summary Table

| Gap ID | Section | Description                                                 | Severity |
| ------ | ------- | ----------------------------------------------------------- | -------- |
| GAP-V1 | §1      | No `vitest.workspace.*` at repo root                        | MEDIUM   |
| GAP-V2 | §1      | `test.environment` conflicts across configs                 | MEDIUM   |
| GAP-V3 | §1      | Coverage only enabled in root config                        | LOW      |
| GAP-E1 | §2      | No E2E / Playwright config in any app                       | MEDIUM   |
| GAP-E2 | §2      | Frontend apps have 0 unit tests in `src/`                   | MEDIUM   |
| GAP-T1 | §2      | 10 test files contain skip markers (tests not running)      | HIGH     |
| GAP-T2 | §2      | 2 test files contain flaky markers                          | MEDIUM   |
| GAP-L1 | §3      | `no-console`/`no-explicit-any` only at `warn` level         | MEDIUM   |
| GAP-L2 | §3      | `vue/multi-word-component-names` not configured             | LOW      |
| GAP-L3 | §3      | No ESLint config for api, worker, all packages              | MEDIUM   |
| GAP-L4 | §3      | 10 pre-existing ESLint errors                               | HIGH     |
| GAP-C1 | §4      | `test-stage-001.yml` lacks lint and type-check steps        | HIGH     |
| GAP-C2 | §4      | No coverage threshold gate in any CI workflow               | HIGH     |
| GAP-C3 | §4      | E2E testing absent from all CI workflows                    | MEDIUM   |
| GAP-C4 | §4      | No unified pre-merge gate (lint + typecheck + unit)         | MEDIUM   |
| GAP-B1 | §5      | Root `build` script uses npm-style `bun workspaces`         | MEDIUM   |
| GAP-B2 | §5      | 2 pre-existing TypeScript errors blocking `tsc --noEmit`    | HIGH     |
| GAP-B3 | §5      | Coverage baseline unavailable (DB-GATED)                    | MEDIUM   |
| GAP-R1 | §6      | All 5 `apps/*` directories missing README.md                | HIGH     |
| GAP-R2 | §6      | 6 of 8 `packages/*` directories missing README.md           | HIGH     |
| GAP-R3 | §6      | Present READMEs lack all 7 required governance sections     | MEDIUM   |
| GAP-D1 | §7      | 2 pre-existing TypeScript errors                            | HIGH     |
| GAP-D2 | §7      | Pre-commit hook references non-existent `type-check` script | MEDIUM   |
| GAP-D3 | §7      | `husky` not in root devDependencies                         | MEDIUM   |
| GAP-D4 | §7      | `bun run lint` exits non-zero — pre-commit blocks commits   | HIGH     |
