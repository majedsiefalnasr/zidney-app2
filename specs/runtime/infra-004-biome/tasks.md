# Tasks: infra-004-biome — Biome Toolchain Migration

**Feature ID:** `infra-004-biome`
**Phase:** `01_PLATFORM_FOUNDATION`
**Stage:** `STAGE_INFRA_04_BIOME`
**Plan:** `specs/runtime/infra-004-biome/plan.md`
**Spec:** `specs/runtime/infra-004-biome/spec.md`
**Research:** `specs/runtime/infra-004-biome/research.md`
**Stage Status:** IN PROGRESS — implementation authorised
**Generated:** 2026-03-06

---

## Stage Context

- **Phase:** 01_PLATFORM_FOUNDATION
- **Stage:** STAGE_INFRA_04_BIOME
- **Related Plan:** specs/runtime/infra-004-biome/plan.md
- **Related Spec:** specs/runtime/infra-004-biome/spec.md
- **Related ADR:** None (toolchain-only change — no architectural boundary modified)

---

## Constitution Alignment

| Rule                           | Status                       |
| ------------------------------ | ---------------------------- |
| No runtime behavior changed    | ✅ Confirmed                 |
| No tenant isolation touched    | ✅ Confirmed                 |
| No license middleware modified | ✅ Confirmed                 |
| No attempt engine modified     | ✅ Confirmed                 |
| No database schema touched     | ✅ Confirmed                 |
| Stage status IN PROGRESS       | ✅ Implementation authorised |

---

## Task Legend

- `[P]` — Parallelizable: task operates on distinct files from all sibling tasks; has no dependency on an incomplete parallel sibling
- Tasks without `[P]` must complete sequentially before the next task in the same phase begins

---

## Phase 1 — PASS 1: Install & Configure

**Goal:** Install Biome, create the single root configuration, and add the new `lint:fix` script to `package.json`. Violations are expected and acceptable at this stage.

**Exit criterion:** `bun biome check . 2>&1 | tail -20` executes and produces lint output. The command must NOT fail with a configuration error or unrecognised option. Non-zero exit code from violations is acceptable.

---

- [ ] T001 Install `@biomejs/biome` as a devDependency by running `bun add -D @biomejs/biome` from the repo root; note the resolved version and verify the `$schema` URL in the next task matches `https://biomejs.dev/schemas/<resolved-version>/schema.json`
- [ ] T002 [P] Create `biome.json` at the repo root with the exact configuration defined in plan.md Step 1.2: `$schema` (2.4.6 or resolved version), `vcs.useIgnoreFile: true`, `formatter` (space/2/100), `javascript.formatter` (single/es5/asNeeded), `linter.rules` (recommended + noUnusedImports + noDuplicateImports + noDebugger + noConsole:error + useConst), `organizeImports.enabled: true`, and three `overrides` for `packages/logger/**/*.ts`, `scripts/**`, and `tests/**` / `**/*.test.ts` / `**/*.spec.ts` setting `noConsole: "off"`; also add `node_modules`, `dist`, `**/*.d.ts`, `.specify/**`, `coverage/**` to `files.ignore`
- [ ] T003 Add `"lint:fix": "bun biome check --apply ."` to the `scripts` section of root `package.json` (new key — does not replace existing lint/format scripts at this stage)
- [ ] T004 Verify Biome runs without configuration error: execute `bun biome check . 2>&1 | tail -20` and confirm output shows lint violations (not a config/parse failure)

---

## Phase 2 — PASS 2: Auto-Fix (Format + Lint)

**Goal:** Apply Biome's automated formatting and safe lint corrections across the entire monorepo in two sequential steps. Produces a large formatting diff — this is expected behaviour documented in the PR.

**Exit criterion:** `git diff --stat` after T006 shows formatting changes across the majority of source files; `noConsole` violations remain (cannot be auto-fixed).

**Dependency:** Requires Phase 1 completion.

---

- [ ] T005 Run `bun biome format --write .` from the repo root to apply the full formatting pass (indent normalisation, line width 100, single quotes, no semicolons, es5 trailing commas, import sorting); commit the result as `chore(toolchain): apply Biome formatter`
- [ ] T006 Run `bun biome check --apply-unsafe .` from the repo root to auto-fix `noUnusedImports`, `noDuplicateImports`, and `useConst` violations; inspect the diff before committing; `noConsole` violations will remain after this step

---

## Phase 3 — PASS 2: Manual console.\* Remediation — Group A (apps/api/src)

**Goal:** Replace all `console.*` calls in production API source code with structured `@zidney/logger` calls. Each task covers a logical file group and can execute in parallel.

**Exit criterion:** `grep -rn "console\." apps/api/src/` (excluding `db/` subdirs and biome-ignore lines) returns zero results.

**Dependency:** Requires Phase 2 completion. All tasks T007-T013 may run in parallel.

---

- [ ] T007 [P] Replace `console.*` with `import { logger } from '@zidney/logger'` calls in apps/api/src/index.ts, apps/api/src/boot/migration-registry.ts, apps/api/src/infrastructure/redis.ts
- [ ] T008 [P] Replace `console.*` with `@zidney/logger` calls in apps/api/src/middleware/auth/resolve-rbac.ts, apps/api/src/middleware/auth/validate-jwt.ts, apps/api/src/middleware/auth/validate-license-middleware.ts, apps/api/src/middleware/auth/validate-license.ts, apps/api/src/middleware/auth/validate-token-version.ts
- [ ] T009 [P] Replace `console.*` with `@zidney/logger` calls in apps/api/src/middleware/backoffice-module-guard.ts, apps/api/src/middleware/backoffice-permission-guard-v2.ts, apps/api/src/middleware/backoffice-rbac-guard.ts, apps/api/src/middleware/correlation-id.ts, apps/api/src/middleware/error-handler.ts, apps/api/src/middleware/middleware-chain.ts, apps/api/src/middleware/rate-limit-provisioning.ts, apps/api/src/middleware/rate-limiting.ts, apps/api/src/middleware/request-logger.middleware.ts, apps/api/src/middleware/tenant-resolver.ts
- [ ] T010 [P] Replace `console.*` with `@zidney/logger` calls in apps/api/src/handlers/licenses/create-license.ts, apps/api/src/modules/attempt/submit.ts, apps/api/src/modules/errors/error-formatter.ts, apps/api/src/modules/schema/migration-enqueue.ts, apps/api/src/modules/workspace-settings/workspace-settings.service.ts
- [ ] T011 [P] Replace `console.*` with `@zidney/logger` calls in apps/api/src/routes/auth/backoffice-login.ts, apps/api/src/routes/auth/logout-all.ts, apps/api/src/routes/backoffice/context.ts, apps/api/src/routes/backoffice/roles.ts, apps/api/src/routes/backoffice/workflow/post-transition.ts, apps/api/src/routes/backoffice/ws.ts, apps/api/src/routes/health.ts
- [ ] T012 [P] Replace `console.*` with `@zidney/logger` calls in apps/api/src/routes/mmc/affiliates/create.ts, apps/api/src/routes/mmc/affiliates/disable.ts, apps/api/src/routes/mmc/affiliates/edit.ts, apps/api/src/routes/mmc/affiliates/list.ts, apps/api/src/routes/mmc/affiliates/usages.ts
- [ ] T013 [P] Replace `console.*` with `@zidney/logger` calls in apps/api/src/services/audit.service.ts, apps/api/src/utils/idempotency.ts

---

## Phase 4 — PASS 2: Worker Logger Bridge Evaluation

**Goal:** Determine whether `structured-logger.ts` is a logger bridge that intentionally wraps `console.*`, and handle accordingly before migrating the remaining worker files.

**Exit criterion:** apps/worker/src/observability/structured-logger.ts either has no `noConsole` violation (biome.json override applied) or has no `console.*` calls (migrated to `@zidney/logger`).

**Dependency:** Requires Phase 2 completion. Can run in parallel with Phase 3.

---

- [ ] T014 Read apps/worker/src/observability/structured-logger.ts — if it wraps `console.*` internally as a logger bridge (similar to `packages/logger/src/logger.ts`), add `"apps/worker/src/observability/structured-logger.ts"` to the `noConsole: "off"` override include list in `biome.json`; if it is not a bridge, replace its `console.*` calls with `@zidney/logger`

---

## Phase 5 — PASS 2: Manual console.\* Remediation — apps/worker/src

**Goal:** Replace all `console.*` calls in Worker job, queue, and provisioning source files with `@zidney/logger` calls.

**Exit criterion:** `grep -rn "console\." apps/worker/src/` excluding structured-logger.ts and biome-ignore lines returns zero results.

**Dependency:** Requires T014 completion. Tasks T015-T018 may run in parallel with each other.

---

- [ ] T015 [P] Replace `console.*` with `@zidney/logger` calls in apps/worker/src/config/queues.ts, apps/worker/src/config/worker-config.ts
- [ ] T016 [P] Replace `console.*` with `@zidney/logger` calls in apps/worker/src/jobs/drain-language-translations.ts, apps/worker/src/jobs/grade-attempt.ts, apps/worker/src/jobs/lock-manager.ts, apps/worker/src/jobs/migration-phase.ts, apps/worker/src/jobs/retry-strategy.ts, apps/worker/src/jobs/snapshot-phase.ts
- [ ] T017 [P] Replace `console.*` with `@zidney/logger` calls in apps/worker/src/modules/queue/job-queue.ts, apps/worker/src/processor.ts, apps/worker/src/queue.ts
- [ ] T018 [P] Replace `console.*` with `@zidney/logger` calls in apps/worker/src/services/provisioning/BaselineSeeder.ts, apps/worker/src/services/provisioning/CheckpointManager.ts, apps/worker/src/services/provisioning/DistributedLock.ts, apps/worker/src/services/provisioning/ErrorHandling.ts, apps/worker/src/services/provisioning/JobQueue.ts, apps/worker/src/services/provisioning/MigrationExecutor.ts, apps/worker/src/services/provisioning/ProvisioningOrchestrator.ts

---

## Phase 6 — PASS 2: Manual console.\* Remediation — Group B (Migration Runners)

**Goal:** Apply `// biome-ignore lint/suspicious/noConsole: migration runner output` suppressions on all DB migration runner files. These execute outside the HTTP request lifecycle without access to a request-scoped logger instance.

**Exit criterion:** `grep -rn "console\." apps/api/src/db/` shows only lines immediately preceded by a biome-ignore comment.

**Dependency:** Requires Phase 2 completion. T019 and T020 may run in parallel with each other and with Phases 3-5.

---

- [ ] T019 [P] Add `// biome-ignore lint/suspicious/noConsole: migration runner output` inline suppression comments to all `console.*` calls in apps/api/src/db/master/migrations/0005_schema_version_increment.ts, apps/api/src/db/master/migrations/0006_create_dead_letter_queue.ts, apps/api/src/db/master/migrations/0007_create_dlq_resolutions.ts, apps/api/src/db/master/migrations/20260225_006_seed_roles_and_permissions.ts, apps/api/src/db/master/migrations/20260226_001_dashboard_indexes.ts, apps/api/src/db/master/migrations/runner.ts
- [ ] T020 [P] Add `// biome-ignore lint/suspicious/noConsole: migration runner output` inline suppression comments to all `console.*` calls in apps/api/src/db/tenant/migrations/0008_add_idempotent_submission.ts, apps/api/src/db/tenant/migrations/0009_add_idempotent_indexes.ts, apps/api/src/db/tenant/migrations/0010_add_audit_indexes.ts

---

## Phase 7 — PASS 2: Manual console.\* Remediation — packages/domain-core

**Goal:** Replace production `console.*` calls with `@zidney/logger` in domain-core; apply biome-ignore suppressions in migration-context files; evaluate the DB logger bridge.

**Exit criterion:** `grep -rn "console\." packages/domain-core/src/` returns only biome-ignore annotated lines.

**Dependency:** Requires Phase 2 completion. T021 runs sequentially (it may modify `biome.json` based on bridge evaluation; T022 may run in parallel with Phases 3-6 after T021 settles the biome.json override question).

---

- [ ] T021 Replace `console.*` with `@zidney/logger` calls in packages/domain-core/src/auth/password.ts, packages/domain-core/src/auth/audit.ts, packages/domain-core/src/utils/email.ts, packages/domain-core/src/services/audit.service.ts, packages/domain-core/src/tenant-resolver/version-check.ts; additionally, read packages/domain-core/src/logging/master-db-logger.ts — if it is a DB logger bridge wrapping `console.*` intentionally, add it to the `noConsole: "off"` override in `biome.json`; otherwise migrate its calls (**NOTE**: T021 is sequential — if biome.json is modified, T022 must start after T021 completes)
- [ ] T022 [P] Add `// biome-ignore lint/suspicious/noConsole: migration runner output` inline suppression comments to all `console.*` calls in packages/domain-core/src/migration/master-migration-runner.ts, packages/domain-core/src/migration/snapshot-manager.ts, packages/domain-core/src/migration/tenant-migration-runner.ts

---

## Phase 8 — PASS 2: Manual console.\* Remediation — packages/redis-utils

**Goal:** Replace `console.*` calls in redis-utils rate-limiting algorithm implementations with `@zidney/logger`.

**Exit criterion:** `grep -rn "console\." packages/redis-utils/src/` returns zero results.

**Dependency:** Requires Phase 2 completion. Can run in parallel with Phases 3-7.

---

- [ ] T023 [P] Replace `console.*` with `@zidney/logger` calls in packages/redis-utils/src/algorithms/token-bucket.ts (3x console.error), packages/redis-utils/src/algorithms/sliding-window.ts (3x console.error)

---

## Phase 9 — PASS 2: Group C Test Files — noConsole Override Verification

**Goal:** Confirm that the `biome.json` overrides silence `noConsole` for all test files. No source file modifications are required if the override patterns are correct.

**Exit criterion:** `bun biome check tests/ apps/mmc/tests/ apps/api/tests/` reports zero `noConsole` violations.

**Dependency:** Requires T002 (biome.json) to be complete. Can run at any point during Pass 2.

---

- [ ] T024 Run `bun biome check tests/ apps/*/tests/` and confirm zero `noConsole` violations are reported across all apps and packages; if violations appear, extend the `noConsole: "off"` override include patterns in `biome.json` to cover the missing paths (e.g., `apps/backoffice/tests/**`, `apps/frontoffice/tests/**`, `apps/worker/tests/**`)

---

## Phase 9B — PASS 2: Group E Verification — apps/backoffice and apps/frontoffice

**Goal:** Confirm that apps/backoffice and apps/frontoffice contain no `console.*` violations. Both apps are in-scope per spec.md Scope table. Pre-scan confirmed these apps reference `console` only in JSDoc comments (not executable code), so this phase is a verification gate only — no source modification expected.

**Exit criterion:** `bun biome check apps/backoffice/src/ apps/frontoffice/src/` reports zero `noConsole` violations.

**Dependency:** Requires T002 (biome.json) to be complete. Can run in parallel with Phase 9.

---

- [ ] T042 [P] Run `bun biome check apps/backoffice/src/ apps/frontoffice/src/` and confirm zero `noConsole` violations; if any violations are reported, apply the same Group D strategy (biome-ignore suppression for error boundaries, remove debug calls) in the respective file

---

## Phase 10 — PASS 2: Manual console.\* Remediation — Group D (apps/mmc Vue Frontend)

**Goal:** Suppress or remove `console.*` calls in Vue frontend components. `@zidney/logger` is a backend-only package and cannot be imported in Vue apps. Remove debug artifacts; apply biome-ignore suppressions on critical error boundaries.

**Exit criterion:** `grep -rn "console\." apps/mmc/src/` returns only biome-ignore annotated lines.

**Dependency:** Requires Phase 2 completion. T025 and T026 may run in parallel.

---

- [ ] T025 [P] In apps/mmc/src/shared/components/AuditTrailViewer.vue: add `// biome-ignore lint/suspicious/noConsole: frontend error boundary` on each of the 2x `console.error` calls; in apps/mmc/src/modules/dashboard/views/DashboardView.vue: add same suppression on each of the 3x `console.error` calls
- [ ] T026 [P] In apps/mmc/src/modules/licenses/views/LicenseList.vue: remove the 1x debug `console.log` call entirely; in apps/mmc/src/modules/dashboard/api.ts: add `// biome-ignore lint/suspicious/noConsole: frontend error boundary` on each of the 6x `console.error` calls; in apps/mmc/src/modules/dashboard/store.ts: add same suppression on each of the 6x `console.error` calls

---

## Phase 11 — PASS 2: Exit Gate

**Goal:** Verify all violations are resolved before beginning Pass 3. Both commands must exit with code 0.

**Exit criterion:** `bun biome check .` exits 0 and `bun biome format --check .` exits 0.

**Dependency:** Requires completion of all Phase 3-10 tasks.

---

- [ ] T027 Run `bun biome check .` — must exit with code 0; if violations remain, fix before proceeding to Pass 3
- [ ] T028 Run `bun biome format --check .` — must exit with code 0; if formatting issues remain, run `bun biome format --write .` to resolve, then re-run check

---

## Phase 12 — PASS 3: Remove ESLint & Prettier Packages

**Goal:** Remove all ESLint and Prettier package entries from root `package.json` devDependencies.

**Exit criterion:** root `package.json` contains no `eslint`, `prettier`, `globals`, or `typescript-eslint` entries in `devDependencies`.

**Dependency:** Requires Phase 11 (Pass 2 exit gate) completion.

---

- [ ] T029 Remove the following 8 ESLint entries from `devDependencies` in root `package.json`: `@eslint/js`, `eslint`, `eslint-config-prettier`, `eslint-import-resolver-typescript`, `eslint-plugin-import-x`, `eslint-plugin-vue`, `globals`, `typescript-eslint`
- [ ] T030 Remove `prettier` from `devDependencies` in root `package.json`

---

## Phase 13 — PASS 3: Delete Legacy Config Files

**Goal:** Delete the 4 ESLint config files and 2 Prettier config files identified in research.md Finding 04 and Finding 05.

**Exit criterion:** `find . \( -name "eslint.config*" -o -name ".prettierrc*" -o -name "prettier.config*" \) -not -name "*.md" -not -path "*/node_modules/*"` returns zero results.

**Dependency:** Requires Phase 11 completion. T031-T033 may run in parallel.

---

- [ ] T031 [P] Delete `eslint.config.mjs` at the repo root
- [ ] T032 [P] Delete `apps/backoffice/eslint.config.js`, `apps/frontoffice/eslint.config.js`, `apps/mmc/eslint.config.js`; do NOT delete `packages/ui-system/.eslintrc-ui-guard.md` — that file is Markdown documentation, not an ESLint config
- [ ] T033 [P] Delete `prettier.config.mjs` and `.prettierrc` at the repo root

---

## Phase 14 — PASS 3: Update Tooling & CI

**Goal:** Replace all ESLint/Prettier invocations in lint-staged, CI, and package.json scripts with Biome. Create the VS Code extension recommendation.

**Exit criterion:** `bun run lint` invokes `bun biome check .`; `bun run format:check` invokes `bun biome format --check .`; CI `lint` job runs two Biome steps; lint-staged hook invokes `bun biome check --apply`; `.vscode/extensions.json` exists recommending `biomejs.biome`.

**Dependency:** Requires Phase 12-13 completion. T037 and T038 may run in parallel with T034-T036.

---

- [ ] T034 Replace the entire contents of `lint-staged.config.mjs` with: `/** @type {import('lint-staged').Config} */\nexport default {\n  '*.{ts,tsx,js,jsx,mjs,vue,json}': ['bun biome check --apply'],\n}` — removes `eslint --fix` and `prettier --write`; drops `.md` files; adds `json`/`js`/`jsx`/`mjs` extensions. **NOTE**: `--apply` (safe fixes only) is used in pre-commit to prevent silent staged-code mutation; `--apply-unsafe` is available via direct invocation: `bun biome check --apply-unsafe .` (`lint:fix` script uses `--apply` for safe fixes only).
- [ ] T035 Update `.github/workflows/ci.yml` lint job: change the display `name:` to `'Biome — Lint & Format'`; replace the `Run ESLint` step (`bun run lint -- --debug`) with `- name: Run Biome lint check\n  run: bun biome check .`; replace the `Check Prettier formatting` step (`bun run format:check`) with `- name: Run Biome format check\n  run: bun biome format --check .`; keep the YAML key `lint:` unchanged to preserve all downstream `needs: [lint]` references
- [ ] T036 Update the `scripts` section of root `package.json`: replace `"lint": "eslint ."` with `"lint": "bun biome check ."`; replace `"format": "prettier --write ."` with `"format": "bun biome format --write ."`; replace `"format:check": "prettier --check ."` with `"format:check": "bun biome format --check ."`; verify no remaining `eslint` or `prettier` invocations remain in the scripts section
- [ ] T037 [P] Create `.vscode/extensions.json` with content: `{\n  "recommendations": ["biomejs.biome"]\n}`
- [ ] T038 [P] Update `.vscode/settings.json` — append the following keys without overwriting any existing entries: `"[typescript]": { "editor.defaultFormatter": "biomejs.biome" }`, `"[typescriptreact]": { "editor.defaultFormatter": "biomejs.biome" }`, `"[javascript]": { "editor.defaultFormatter": "biomejs.biome" }`, `"[vue]": { "editor.defaultFormatter": "biomejs.biome" }`, `"[json]": { "editor.defaultFormatter": "biomejs.biome" }`, `"editor.formatOnSave": true`

---

## Phase 15 — PASS 3: Regenerate Lockfile

**Goal:** Remove ESLint/Prettier metadata from `bun.lock` and finalise the `@biomejs/biome` installation.

**Exit criterion:** `bun install` exits 0; `bun.lock` no longer references `eslint` or `prettier` package entries.

**Dependency:** Requires Phase 12-14 completion.

---

- [ ] T039 Run `bun install` from the repo root to regenerate `bun.lock` after all `package.json` devDependency removals

---

## Phase 16 — PASS 3: Final Verification

**Goal:** Confirm the migration is fully complete and both Biome gates pass cleanly end-to-end.

**Exit criterion:** `bun biome check .` exits 0 and `bun biome format --check .` exits 0; additionally `bun run lint` and `bun run format:check` both succeed; `bun run typecheck` exits 0 (T044); `bun run test:unit` exits 0 (T045).

**Dependency:** Requires Phase 15 completion.

---

- [ ] T040 Run `bun biome check .` — must exit with code 0 (final gate; any failure indicates a violation missed in Pass 2)
- [ ] T041 Run `bun biome format --check .` — must exit with code 0 (final gate; any failure indicates uncommitted formatting changes)
- [ ] T044 Run `bun run typecheck` (or `bunx tsc --noEmit`) — must exit with code 0; confirms that the toolchain migration introduced no TypeScript regressions
- [ ] T045 Run `bun run test:unit` (or matching unit test script) — must exit with code 0; confirms no unit test regressions were introduced by the console.\* migrations or config file removals

---

## Phase 17 — Documentation Update

**Goal:** Update developer-facing documentation to reflect the new `bun biome` workflow. Required by SC-08 and FR-08/FR-10 acceptance criteria.

**Exit criterion:** Root README.md or `docs/` developer guide references `bun biome check .`, `bun biome format --write .`, and the VSCode extension recommendation.

**Dependency:** Requires Phase 16 (all verification gates pass).

---

- [ ] T043 Update root `README.md` (or `docs/` developer setup guide if it exists) to document the new toolchain: add a "Linting & Formatting" section with commands `bun run lint` (check), `bun run format` (auto-fix), `bun run format:check` (CI check), and recommend the `biomejs.biome` VSCode extension (already configured in `.vscode/extensions.json`)

---

## Dependency Graph

```
T001 (install @biomejs/biome)
  └─ T002 [P] (create biome.json)
  └─ T003     (add lint:fix script to package.json)
                └─ T004 (verify bun biome check . runs)
                           └─ T005 (biome format --write .)
                                    └─ T006 (biome check --apply-unsafe .)
                                               └─ [all parallel — different files]
                           ┌─ T007 [P]  Group A: api index + boot + infra
                           ├─ T008 [P]  Group A: middleware/auth (5 files)
                           ├─ T009 [P]  Group A: middleware non-auth (10 files)
                           ├─ T010 [P]  Group A: handlers + modules (5 files)
                           ├─ T011 [P]  Group A: routes auth + backoffice (7 files)
                           ├─ T012 [P]  Group A: routes mmc/affiliates (5 files)
                           ├─ T013 [P]  Group A: services + utils (2 files)
                           ├─ T014      worker structured-logger.ts evaluation
                           │    ├─ T015 [P]  worker config (2 files)
                           │    ├─ T016 [P]  worker jobs (6 files)
                           │    ├─ T017 [P]  worker queue + processor (3 files)
                           │    └─ T018 [P]  worker provisioning (7 files)
                           ├─ T019 [P]  Group B: master migrations + runner (6 files)
                           ├─ T020 [P]  Group B: tenant migrations (3 files)
                           ├─ T021      domain-core source (5 files + bridge eval, SEQUENTIAL)
                           ├─ T022 [P]  domain-core migration runners (3 files)
                           ├─ T023 [P]  redis-utils algorithms (2 files)
                           ├─ T024      test file override verification
                           ├─ T025 [P]  Group D: mmc AuditTrailViewer + DashboardView
                           └─ T026 [P]  Group D: mmc LicenseList + dashboard/api + store
                                               └─ T027 (biome check . → exit 0)
                                                         └─ T028 (biome format --check . → exit 0)
                                                                   └─ T029 (remove ESLint pkgs)
                                                                   └─ T030 (remove prettier pkg)
                                                                   └─ T031 [P] (delete root eslint.config.mjs)
                                                                   └─ T032 [P] (delete per-app eslint configs)
                                                                   └─ T033 [P] (delete prettier configs)
                                                                   └─ T034     (update lint-staged.config.mjs)
                                                                   └─ T035     (update ci.yml lint job)
                                                                   └─ T036     (update package.json scripts)
                                                                   └─ T037 [P] (create .vscode/extensions.json)
                                                                   └─ T038 [P] (update .vscode/settings.json)
                                                                             └─ T039 (bun install)
                                                                                       └─ T040 (final biome check .)
                                                                                       └─ T041 (final biome format --check .)
```

---

## Parallel Execution Opportunities

| Batch                  | Tasks      | Files targeted                 | Can run simultaneously with                           |
| ---------------------- | ---------- | ------------------------------ | ----------------------------------------------------- |
| Auto-fix               | T005, T006 | All source files (sequential)  | —                                                     |
| Group A — API source   | T007-T013  | apps/api/src/ subgroups        | Each other                                            |
| Worker bridge eval     | T014       | apps/worker/src/observability/ | T007-T013                                             |
| Worker source          | T015-T018  | apps/worker/src/ subgroups     | Each other + T007-T013                                |
| Group B migrations     | T019-T020  | apps/api/src/db/ subgroups     | T007-T018                                             |
| domain-core            | T021, T022 | packages/domain-core/src/      | T007-T020 (T021 sequential; T022 parallel after T021) |
| redis-utils            | T023       | packages/redis-utils/src/      | T007-T022                                             |
| Group D Vue            | T025-T026  | apps/mmc/src/ subgroups        | T007-T023                                             |
| Pass 3 config deletion | T031-T033  | distinct config files          | Each other                                            |
| Pass 3 tooling         | T037-T038  | .vscode/ files                 | T034-T036                                             |

---

## Commit Sequence (Recommended)

| Commit | After tasks          | Message                                                                                                |
| ------ | -------------------- | ------------------------------------------------------------------------------------------------------ |
| 1      | T001-T004            | `feat(toolchain): install Biome and add root biome.json`                                               |
| 2      | T005                 | `chore(toolchain): apply Biome formatting pass (lineWidth 100, single quotes)`                         |
| 3      | T006                 | `chore(toolchain): auto-fix unused imports and useConst via Biome`                                     |
| 4      | T007-T013            | `chore(toolchain): replace console.* with @zidney/logger in apps/api/src`                              |
| 5      | T014-T023            | `chore(toolchain): migrate console.* in worker, packages; suppress migration runners`                  |
| 6      | T024-T026, T042      | `chore(toolchain): suppress console.* in Vue frontend error boundaries; verify backoffice/frontoffice` |
| 7      | T027-T028            | `chore(toolchain): Pass 2 complete — biome check and format exit 0`                                    |
| 8      | T029-T038            | `chore(toolchain): remove ESLint + Prettier, update CI, lint-staged, scripts`                          |
| 9      | T039-T041, T044-T045 | `chore(toolchain): regenerate lockfile, final Biome gate + typecheck + test verification`              |
| 10     | T043                 | `docs(toolchain): update README with Biome workflow and VSCode extension recommendation`               |

---

## Task Count Summary

| Phase     | Description                              | Tasks  | Parallelizable |
| --------- | ---------------------------------------- | ------ | -------------- |
| Phase 1   | PASS 1: Install & Configure              | 4      | 1 (T002)       |
| Phase 2   | PASS 2: Auto-Fix                         | 2      | 0              |
| Phase 3   | PASS 2: Group A — apps/api/src           | 7      | 7 (T007-T013)  |
| Phase 4   | PASS 2: Worker Logger Bridge Eval        | 1      | 0              |
| Phase 5   | PASS 2: apps/worker/src                  | 4      | 4 (T015-T018)  |
| Phase 6   | PASS 2: Group B — Migration Runners      | 2      | 2 (T019-T020)  |
| Phase 7   | PASS 2: packages/domain-core             | 2      | 1 (T022)       |
| Phase 8   | PASS 2: packages/redis-utils             | 1      | 1 (T023)       |
| Phase 9   | PASS 2: Group C Test Files (verify)      | 1      | 0              |
| Phase 9B  | PASS 2: Group E — backoffice/frontoffice | 1      | 1 (T042)       |
| Phase 10  | PASS 2: Group D — apps/mmc Vue           | 2      | 2 (T025-T026)  |
| Phase 11  | PASS 2: Exit Gate                        | 2      | 0              |
| Phase 12  | PASS 3: Remove ESLint & Prettier Pkgs    | 2      | 0              |
| Phase 13  | PASS 3: Delete Config Files              | 3      | 3 (T031-T033)  |
| Phase 14  | PASS 3: Update Tooling & CI              | 5      | 2 (T037-T038)  |
| Phase 15  | PASS 3: Regenerate Lockfile              | 1      | 0              |
| Phase 16  | PASS 3: Final Verification               | 4      | 0              |
| Phase 17  | Documentation Update                     | 1      | 0              |
| **Total** |                                          | **45** | **29**         |
