# INFRA_AUDIT_CHECKLIST — Research

**Stage:** INFRA_AUDIT_CHECKLIST  
**Phase:** 01_PLATFORM_FOUNDATION  
**Authored:** 2026-03-04  
**Purpose:** Catalog the existing monorepo structure as the factual foundation for the
implementation plan.

---

## 1. apps/ Directory Inventory

| Directory     | Path                | Notes                           |
| ------------- | ------------------- | ------------------------------- |
| `api`         | `apps/api/`         | Bun + Hono backend              |
| `backoffice`  | `apps/backoffice/`  | Vue 3 institution control panel |
| `frontoffice` | `apps/frontoffice/` | Vue 3 student runtime           |
| `mmc`         | `apps/mmc/`         | Vue 3 platform control layer    |
| `worker`      | `apps/worker/`      | Background job processor        |

Total: **5 apps**

---

## 2. packages/ Directory Inventory

| Directory     | Path                    | Notes                                       |
| ------------- | ----------------------- | ------------------------------------------- |
| `api-client`  | `packages/api-client/`  | Typed HTTP client shared by frontends       |
| `config`      | `packages/config/`      | Shared runtime configuration helpers        |
| `domain-core` | `packages/domain-core/` | Core domain business logic (pure functions) |
| `logger`      | `packages/logger/`      | Structured logger package                   |
| `redis-utils` | `packages/redis-utils/` | Redis client utilities                      |
| `types`       | `packages/types/`       | Shared TypeScript types                     |
| `ui-system`   | `packages/ui-system/`   | shadcn-vue design system package            |
| `validation`  | `packages/validation/`  | Zod-based validation schemas                |

Total: **8 packages**

---

## 3. Vitest Config File Inventory

| File Path                              | Scope   | Notes                                   |
| -------------------------------------- | ------- | --------------------------------------- |
| `vitest.config.ts`                     | Root    | Root-level config; likely orchestration |
| `apps/backoffice/vitest.config.ts`     | App     | App-specific config                     |
| `apps/frontoffice/vitest.config.ts`    | App     | App-specific config                     |
| `apps/mmc/vitest.config.ts`            | App     | App-specific config                     |
| `packages/api-client/vitest.config.ts` | Package | Package-specific config                 |

**Not found:** `apps/api/`, `apps/worker/`, and most `packages/*` do not have standalone Vitest
configs — they likely rely on the root config or are covered by the `vitest.workspace.ts` pattern
(none found at root).

Total discovered: **5 vitest.config.ts files**. No `vitest.workspace.*` files found.

---

## 4. ESLint Config File Inventory

| File Path                           | Format    | Scope |
| ----------------------------------- | --------- | ----- |
| `eslint.config.mjs`                 | Flat (v9) | Root  |
| `apps/backoffice/eslint.config.js`  | Flat (v9) | App   |
| `apps/frontoffice/eslint.config.js` | Flat (v9) | App   |
| `apps/mmc/eslint.config.js`         | Flat (v9) | App   |

**Not found:** No ESLint configs in `apps/api/`, `apps/worker/`, or any `packages/*` directory.
These directories likely inherit from the root config or have no independent ESLint configuration.

All configs use flat config format (ESLint v9). No legacy `.eslintrc.*` files found.

Total: **4 eslint.config.\* files**

---

## 5. GitHub Workflows Inventory

| File Path                                    | Purpose (inferred from name)             |
| -------------------------------------------- | ---------------------------------------- |
| `.github/workflows/test-stage-001.yml`       | Runs tests for platform foundation stage |
| `.github/workflows/typecheck.yml`            | TypeScript type checking                 |
| `.github/workflows/mmc-dashboard-deploy.yml` | Deployment pipeline for MMC dashboard    |
| `.github/workflows/hard-mode-guard.yml`      | SpecKit Hard Mode governance guard       |

Total: **4 workflow files**. Enforcement posture per workflow requires reading each file's job steps
(Phase 1, manual supplement).

---

## 6. Playwright Config Inventory

No `playwright.config.*` files found anywhere in the monorepo.

**Finding:** E2E testing with Playwright is **not configured** in any app. This is a confirmed gap
that will appear in the Gap Report.

---

## 7. README File Coverage

### apps/ — README Status

| Directory          | README Present |
| ------------------ | -------------- |
| `apps/api`         | NO             |
| `apps/backoffice`  | NO             |
| `apps/frontoffice` | NO             |
| `apps/mmc`         | NO             |
| `apps/worker`      | NO             |

**All 5 app directories are missing README files.** This is HIGH documentation debt per FR-US6-3.

### packages/ — README Status (initial scan)

| Directory              | README Present |
| ---------------------- | -------------- |
| `packages/api-client`  | NO             |
| `packages/config`      | NO             |
| `packages/domain-core` | NO             |
| `packages/logger`      | NO             |
| `packages/redis-utils` | NO             |
| `packages/types`       | YES            |
| `packages/ui-system`   | YES            |
| `packages/validation`  | NO             |

**6 of 8 packages are missing README files.** The 2 present (`types`, `ui-system`) require
section-completeness checks during Phase 2. All 6 missing packages are HIGH documentation debt.

---

## 8. Other Config Files Found

| File                      | Notes                                         |
| ------------------------- | --------------------------------------------- |
| `tsconfig.base.json`      | Base TypeScript config shared across monorepo |
| `tsconfig.json`           | Root TypeScript config                        |
| `tsconfig.test.json`      | Test-specific TypeScript config               |
| `vitest.config.ts`        | Root Vitest config                            |
| `docker-compose.yml`      | Local development DB/Redis                    |
| `docker-compose.test.yml` | Test environment services                     |
| `package.json`            | Root workspace definition (bun workspaces)    |

---

## 9. Test Infrastructure Summary

| Location          | Test Files Pattern                        | Notes                                                    |
| ----------------- | ----------------------------------------- | -------------------------------------------------------- |
| `tests/`          | `tests/unit/`, `tests/integration/`, etc. | Root-level test directories exist                        |
| `apps/*/tests/`   | Per-app test directories present          | Confirmed in `apps/api/tests/`, `apps/backoffice/tests/` |
| `packages/*/src/` | Inline `*.test.ts` files (to verify)      | Requires script scan                                     |

---

## 10. Research Gaps (Require Script Execution)

The following data points cannot be determined by static filesystem inspection and require running
`scripts/infra-audit.ts`:

- Exact test file counts per app and package
- Coverage percentages (Lines%, Functions%, Statements%, Branches%)
- TypeScript error count (`bun run typecheck:src --noEmit`)
- ESLint error and warning counts (`bun run lint`)
- Skipped/flaky test markers count per app
- Bun command exit codes
- Vitest config `environment`, `globals`, `coverage` values (require reading each config)
- ESLint rule severity per config (require reading each config)
- GitHub workflow enforcement step presence (require reading each YAML)
- README section completeness for `packages/types` and `packages/ui-system`
