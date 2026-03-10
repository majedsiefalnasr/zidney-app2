# PLAN REPORT — STAGE_INFRA_03_ALIGNMENT

**Step:** 3 — Plan **Stage:** STAGE_INFRA_03_ALIGNMENT **Phase:** 01_PLATFORM_FOUNDATION **Branch:**
`infra-003-alignment` **Date:** 2026-03-04 **Agent:** speckit.plan

---

## Plan Summary

A complete technical implementation plan for the Infrastructure & Governance Alignment stage has
been generated. The plan covers 8 implementation tasks across 8 phases, resulting in **54 files to
create** and **24 files to modify**.

---

## Guardian Validation

| Guardian                    | Verdict | Notes                                                                                                       |
| --------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| Zidney Architecture Checker | ✅ PASS | All architectural content clean; no tenant isolation risk; no import boundary violations; no DDD violations |
| Zidney API Designer         | ✅ PASS | No new API endpoints; CI integration test setup is correct pattern                                          |

**Plan Amendments Applied (post-guardian review):**

- CI workflow changed from `pnpm` to `bun` (only `bun.lock` exists in repo)
- `sleep 10` E2E startup buffer replaced with `bunx wait-on` health-check pattern

---

## Implementation Phases

| Phase | Task | Description                                                                                | Risk   |
| ----- | ---- | ------------------------------------------------------------------------------------------ | ------ |
| 1     | T001 | Vitest configuration consolidation (root projects config + per-app minimal overrides)      | HIGH   |
| 2     | T002 | Test directory normalization (create missing unit/integration/e2e dirs)                    | LOW    |
| 3     | T003 | Playwright installation + per-app configs + smoke tests                                    | MEDIUM |
| 4     | T004 | ESLint + Prettier alignment (install prettier, eslint-config-prettier, add format scripts) | LOW    |
| 5     | T005 | Flaky test stabilization or quarantine                                                     | MEDIUM |
| 6     | T006 | Skipped test review and documentation                                                      | LOW    |
| 7     | T007 | README creation for all apps and packages                                                  | LOW    |
| 8     | T008 | CI pipeline preparation (`.github/workflows/ci.yml`)                                       | LOW    |

---

## Files Inventory Summary

| Category                   | Create           | Modify                                                |
| -------------------------- | ---------------- | ----------------------------------------------------- |
| Vitest configs             | 9                | 4                                                     |
| Test directories (gitkeep) | 11               | 0                                                     |
| Playwright configs         | 3                | 0                                                     |
| Playwright smoke tests     | 4                | 0                                                     |
| Prettier config            | 2                | 0                                                     |
| README files               | 11 (+2 rewrites) | 2                                                     |
| CI workflow                | 1                | 0                                                     |
| Root config changes        | 0                | 3 (package.json, eslint.config.mjs, vitest.config.ts) |
| Test files (skip review)   | 0                | 12                                                    |
| Test files (flaky)         | 0                | 2                                                     |
| **Total**                  | **54**           | **24**                                                |

---

## Dependencies to Install

| Package                  | Type          | Purpose                          |
| ------------------------ | ------------- | -------------------------------- |
| `@playwright/test`       | devDependency | E2E testing                      |
| `prettier`               | devDependency | Code formatting                  |
| `eslint-config-prettier` | devDependency | Disable conflicting ESLint rules |

---

## Risks

| Risk                                                        | Severity | Mitigation                                                     |
| ----------------------------------------------------------- | -------- | -------------------------------------------------------------- |
| Vitest projects migration may disrupt test discovery        | HIGH     | Incremental migration; test after each config change           |
| Root `tests/` vs app `tests/` overlap in include patterns   | MEDIUM   | Scope per-app include patterns to `./src/**`, not `./tests/**` |
| First CI run may surface pre-existing failures              | MEDIUM   | Treat as baseline-capture run                                  |
| `DataTable.spec.ts` double-suppression (it.skip + excluded) | LOW      | T006 task 6 addresses both simultaneously                      |
| `packageManager` field says pnpm but repo uses bun          | LOW      | Documented in plan; CI uses bun; TODO for future housekeeping  |

---

## Key Decisions

| Decision                        | Resolution                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------- |
| Per-app vitest configs          | Keep as minimal overrides (environment + setupFiles only)                       |
| Playwright vs Vitest separation | Playwright runs via `bun run test:e2e` only; excluded from Vitest projects glob |
| Flaky test quarantine           | `it.skip()` + `// QUARANTINE: <reason> <tracking-ref>` comment                  |
| README format                   | Free-form with required section checklist                                       |
| ESLint/Prettier scope           | Global in root `eslint.config.mjs`                                              |
| CI package manager              | `bun` (only `bun.lock` exists; pnpm-lock.yaml absent)                           |
| E2E server startup              | `bunx wait-on` health check (not `sleep`)                                       |

---

## Constitutional Compliance

All constitutional rules are unaffected by this stage. This is a pure infrastructure and tooling
alignment:

- No tenant database changes
- No migration files
- No license middleware changes
- No attempt engine modifications
- No business logic
- All new packages are devDependencies

---

## Outputs

| File                                            | Status                                       |
| ----------------------------------------------- | -------------------------------------------- |
| `specs/runtime/infra-003-alignment/plan.md`     | ✅ Created (961+ lines, amended post-review) |
| `specs/runtime/infra-003-alignment/research.md` | ✅ Created (~12 KB current-state analysis)   |

---

## Next Step

Proceed to **Step 4 — Tasks** to generate the atomic implementation task list.
