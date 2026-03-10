# Tasks Report — STAGE_INFRA_04_BIOME

**Step:** 4 — Tasks **Stage:** STAGE_INFRA_04_BIOME **Phase:** 01_PLATFORM_FOUNDATION **Branch:**
spec/infra-004-biome **Generated:** 2026-03-06T00:00:00.000Z

---

## Summary

45 atomic tasks generated across 17 phases. 30 tasks are parallelizable. Full coverage of 3-pass
migration strategy.

**Drift analysis gate required before implementation.**

---

## Task Statistics

| Metric               | Value |
| -------------------- | ----- |
| Total tasks          | 45    |
| Parallelizable tasks | 30    |
| Sequential tasks     | 15    |
| Passes               | 3     |
| Phases               | 17    |

---

## Pass Structure

### Pass 1 — Install & Configure (T001–T004)

| Task | Description                                                             |
| ---- | ----------------------------------------------------------------------- |
| T001 | `bun add -D @biomejs/biome` in repo root                                |
| T002 | Create `biome.json` at repo root (full config with overrides)           |
| T003 | Update root `package.json` scripts: add `lint`, `lint:fix`, `format`    |
| T004 | Run `bun biome --version` to confirm installation and record schema URL |

### Pass 2 — Resolve Violations (T005–T028)

| Task ID Range | Description                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| T005          | `bun biome format --write .` (full format pass — large diff expected)                                 |
| T006          | `bun biome check --apply .` (auto-fixable lint violations)                                            |
| T007–T013     | Group A: `apps/api/src` — replace `console.*` with `@zidney/logger` by subgroup (6 parallel subtasks) |
| T014          | Evaluate `apps/worker/src/observability/structured-logger.ts` — logger bridge or migrate              |
| T015–T018     | Group A: `apps/worker/src` — replace `console.*` after T014 decision (4 parallel)                     |
| T019          | Group A: `apps/mmc/src` — replace `console.log` debug artifacts                                       |
| T020–T021     | Group B: migration runners (master + tenant) — add `biome-ignore` suppressions                        |
| T022          | Group A: `packages/domain-core` violations                                                            |
| T023          | Group A: `packages/redis-utils` violations                                                            |
| T024          | Group C: Verify test file override (`noConsole: "off"`) covers all test violations                    |
| T025          | Group D: Vue `console.error` error boundaries — add suppressions with tracking comments               |
| T026          | Group D: Remove `console.log` debug calls from Vue components                                         |
| T027          | Run `bun biome check .` — must exit 0                                                                 |
| T028          | Run `bun biome format --check .` — must exit 0                                                        |

### Pass 3 — Remove Legacy & Update CI (T029–T041)

| Task ID Range | Description                                                                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T029          | Remove ESLint packages (8): `bun remove eslint @eslint/js typescript-eslint eslint-plugin-vue @vue/eslint-config-typescript eslint-plugin-playwright @typescript-eslint/parser @typescript-eslint/eslint-plugin` |
| T030          | Remove Prettier: `bun remove prettier`                                                                                                                                                                           |
| T031          | Delete `eslint.config.mjs` (root)                                                                                                                                                                                |
| T032          | Delete `apps/backoffice/eslint.config.js`                                                                                                                                                                        |
| T033          | Delete `apps/frontoffice/eslint.config.js`                                                                                                                                                                       |
| T034          | Delete `apps/mmc/eslint.config.js`                                                                                                                                                                               |
| T035          | Delete `prettier.config.mjs`                                                                                                                                                                                     |
| T036          | Delete `.prettierrc`                                                                                                                                                                                             |
| T037          | Update `lint-staged.config.mjs` — replace ESLint/Prettier with `bun biome check --apply-unsafe`                                                                                                                  |
| T038          | Update `.github/workflows/ci.yml` lint job — replace ESLint steps with `bun biome check .` and `bun biome format --check .`                                                                                      |
| T039          | Create/update `.vscode/extensions.json` with Biome extension recommendation                                                                                                                                      |
| T040          | Run `bun install` to regenerate lockfile with removed packages                                                                                                                                                   |
| T041          | Final verification: `bun biome check .` (exit 0) + `bun biome format --check .` (exit 0)                                                                                                                         |
| T042          | Phase 9B: Verify `apps/backoffice/src` and `apps/frontoffice/src` with `bun biome check` — expected zero violations                                                                                              |
| T043          | Phase 17: Update root `README.md` with Biome workflow commands and VSCode extension recommendation                                                                                                               |
| T044          | Phase 16: `bun run typecheck` — must exit 0                                                                                                                                                                      |
| T045          | Phase 16: `bun run test:unit` — must exit 0                                                                                                                                                                      |

---

## Dependency Graph

```
T001 → T002, T003, T004  (parallel after T001)
T004 → T005
T005 → T006
T006 → T007–T028 (all parallel, except T015–T018 depend on T014 decision)
T027 & T028 → T029–T038 (Pass 3 starts after exit gate)
T029, T030 → T040 (lockfile)
T037, T038 → T039 (all Pass 3 config changes)
T040, T039 → T041 (final verification)
```

---

## Coverage vs Functional Requirements

| FR    | Requirement                    | Covered By      |
| ----- | ------------------------------ | --------------- |
| FR-01 | Single root biome.json         | T002            |
| FR-02 | ESLint + Prettier removed      | T029–T036       |
| FR-03 | Formatter enforcement          | T002, T005      |
| FR-04 | Lint policy + logger exception | T002, T007–T026 |
| FR-05 | Import organization            | T002            |
| FR-06 | CI lint gate                   | T038            |
| FR-07 | CI format gate                 | T038            |
| FR-08 | Developer workflow scripts     | T003            |
| FR-09 | Pipeline order                 | T038            |
| FR-10 | VSCode extension               | T039            |

---

## Artifacts Produced

| File                                   | Owner   | Status                                                |
| -------------------------------------- | ------- | ----------------------------------------------------- |
| specs/runtime/infra-004-biome/tasks.md | SpecKit | ✅ Created (45 tasks, after Analyze gate remediation) |

---

**Next Step:** Proceed to Step 5 (Analyze) — drift gate required before implementation.
