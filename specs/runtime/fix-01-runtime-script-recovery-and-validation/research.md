# Research — Runtime Script Recovery and Validation

**Stage:** STAGE_FIX_01_RUNTIME_SCRIPT_RECOVERY_AND_VALIDATION  
**Phase:** 0X_FIXES  
**Date:** 2026-03-17  
**Status:** COMPLETE — All NEEDS CLARIFICATION resolved

---

## 1. Repository Structure

### 1.1 scripts/ Domain Directories (Existing)

```
scripts/
├── ai-context/        — AI context artifact generation
├── ai-engine/         — AI task orchestration engine
├── ai-guard.ts        — Architecture guard (root-level, unregistered as `ai-guard`)
├── ai-runtime/        — AI runtime status scripts
├── architecture/      — Architecture map generation and diff
├── architecture-diff.ts
├── architecture-guard/ — Architecture guard suite
├── architecture-health/ — Architecture health metrics
├── build/             — Build helper shell scripts (duplicates of scripts/*.sh at root)
├── check-store-cycles.ts
├── check-tsconfig-strict.sh
├── ci/                — CI shell scripts (deploy-*, run-all-tests, validate-skill-sizes)
├── cleanup-test-env.sh
├── core/              — Shared script utilities (logger-factory, graph-analyzer, cache-manager)
├── db/                — EMPTY (domain exists, no files)
├── deploy-production.sh
├── deploy-staging.sh
├── dev/               — Developer utility scripts (repo-doctor, repo-fix, repo-status, seed-*)
├── generate/          — EMPTY (domain exists, no files)
├── generate-ai-context.ts
├── gitnexus-context.ts
├── governance/        — Architecture brain validator, type-safety-guard
├── infra/             — EMPTY (domain exists, no files)
├── infra-audit.ts
├── init-test-db.sh
├── maintenance/       — EMPTY (domain exists, no files) [to be confirmed]
├── monitor/           — EMPTY (domain exists, no files) [to be confirmed]
├── reset-test-redis.sh
├── run-all-tests.sh
├── run-staging-smoke-tests.sh
├── seed/              — EMPTY (domain exists, no files)
├── seed-dashboard-test-data.ts  — ROOT DUPLICATE (see §2.2)
├── templates/         — Spec templates
├── type-safety-guard.ts
├── utils/             — EMPTY (domain exists, no files)
├── validate/          — EMPTY (domain exists, no files)
└── verify-test-env.sh
```

**Key finding:** Domains `db/`, `seed/`, `validate/`, `generate/`, `infra/`, `maintenance/` all exist as directories but contain zero TypeScript files.

### 1.2 Shared Packages (Used by Scripts)

| Package           | Import Name      | Entry          |
| ----------------- | ---------------- | -------------- |
| `packages/logger` | `@zidney/logger` | `src/index.ts` |
| `packages/config` | `@zidney/config` | `src/index.ts` |
| `packages/types`  | `@zidney/types`  | `src/index.ts` |

**Important:** Most existing scripts in `scripts/` do NOT use `@zidney/logger` directly. They use `scripts/core/logger-factory.ts`, an internal logger factory that provides a `StructuredLogger` class with identical structured log fields. Both patterns are valid; `scripts/core/logger-factory.ts` is the de facto scripts-tier logger.

### 1.3 docs/ Directory

`docs/scripts/` does **not exist**. No Script Knowledge Base exists anywhere.

---

## 2. T001 — Runtime Spec Scan Results

**Scan method:** `grep -rh "bun run " specs/runtime/ --include="*.md" | grep -oE "bun run [a-zA-Z][a-zA-Z0-9:_-]*"`  
**Spec directories scanned:** 60 directories under `specs/runtime/`  
**Total unique script references extracted:** 83

### 2.1 Full Reference List vs Root package.json Status

| Script Reference              | Root package.json | Implementation File                                          | Classification      |
| ----------------------------- | ----------------- | ------------------------------------------------------------ | ------------------- | ----- |
| `ai-context:generate`         | ✅ EXISTS         | `scripts/generate-ai-context.ts`                             | VALID               |
| `ai-context:refresh`          | ✅ EXISTS         | `scripts/generate-ai-context.ts --force`                     | VALID               |
| `ai-context:status`           | ❌ MISSING        | None identified                                              | MISSING             |
| `ai-context:validate`         | ✅ EXISTS         | `scripts/generate-ai-context.ts --validate`                  | VALID               |
| `ai-guard`                    | ❌ MISSING        | `scripts/ai-guard.ts` ✅                                     | UNREGISTERED        |
| `ai-runtime:status`           | ✅ EXISTS         | `scripts/ai-runtime/runtime-status.ts`                       | VALID               |
| `ai:plan`                     | ✅ EXISTS         | `scripts/ai-engine/plan-task.ts`                             | VALID               |
| `ai:run`                      | ✅ EXISTS         | `scripts/ai-engine/run-task.ts`                              | VALID               |
| `ai:validate`                 | ✅ EXISTS         | `scripts/ai-engine/validate-execution.ts`                    | VALID               |
| `arch:add-module`             | ✅ EXISTS         | `scripts/architecture/add-module.ts`                         | VALID               |
| `arch:audit`                  | ✅ EXISTS         | `scripts/infra-audit.ts`                                     | VALID               |
| `arch:fix`                    | ✅ EXISTS         | `scripts/infra-audit.ts --fix-map`                           | VALID               |
| `arch:generate`               | ✅ EXISTS         | `scripts/architecture/generate-architecture-map.ts`          | VALID               |
| `arch:guard`                  | ✅ EXISTS         | `scripts/architecture-guard/architecture-guard.ts`           | VALID               |
| `arch:guard:changed`          | ✅ EXISTS         | `scripts/architecture-guard/architecture-guard.ts --changed` | VALID               |
| `arch:guard:ci`               | ✅ EXISTS         | `scripts/architecture-guard/architecture-guard.ts --ci`      | VALID               |
| `arch:health`                 | ✅ EXISTS         | `scripts/architecture-health/architecture-health.ts`         | VALID               |
| `arch:health:ci`              | ✅ EXISTS         | `scripts/architecture-health/architecture-health.ts --ci`    | VALID               |
| `arch:refresh`                | ✅ EXISTS         | `scripts/infra-audit.ts && scripts/gitnexus-context.ts`      | VALID               |
| `arch:validate-brain`         | ✅ EXISTS         | `scripts/governance/validate-architecture-brain.ts`          | VALID               |
| `arch:visualize`              | ✅ EXISTS         | `scripts/architecture/visualize.ts`                          | VALID               |
| `biome`                       | ❌ MISSING        | Binary (`biome`) — no impl file                              | ALIAS-NEEDED        |
| `build`                       | ✅ EXISTS         | `bun run --workspaces build`                                 | VALID               |
| `build:api`                   | ❌ MISSING        | No registration; `bun --cwd apps/api build`                  | ALIAS-NEEDED        |
| `build:packages`              | ❌ MISSING        | No registration; per-package builds                          | ALIAS-NEEDED        |
| `cache-clean`                 | ❌ MISSING        | None                                                         | MISSING             |
| `check:store-cycles`          | ✅ EXISTS         | `scripts/check-store-cycles.ts`                              | VALID               |
| `ci:test`                     | ❌ MISSING        | No registration; vitest --ci                                 | ALIAS-NEEDED        |
| `db:console`                  | ❌ MISSING        | No implementation                                            | MISSING (infra-dep) |
| `db:migrate`                  | ❌ MISSING        | No implementation                                            | MISSING (infra-dep) |
| `db:pool-status`              | ❌ MISSING        | No implementation                                            | MISSING (infra-dep) |
| `db:validate-licenses`        | ❌ MISSING        | No implementation                                            | MISSING (infra-dep) |
| `dev`                         | ❌ MISSING        | Ambiguous; `dev:all` already exists                          | ALIAS-NEEDED        |
| `dev:all`                     | ✅ EXISTS         | `concurrently …`                                             | VALID               |
| `dev:api`                     | ✅ EXISTS         | `bun --cwd apps/api dev`                                     | VALID               |
| `dev:backoffice`              | ✅ EXISTS         | `bun --cwd apps/backoffice dev`                              | VALID               |
| `dev:frontoffice`             | ✅ EXISTS         | `bun --cwd apps/frontoffice dev`                             | VALID               |
| `dev:mmc`                     | ✅ EXISTS         | `bun --cwd apps/mmc dev`                                     | VALID               |
| `dev:worker`                  | ✅ EXISTS         | `bun --cwd apps/worker dev`                                  | VALID               |
| `format`                      | ✅ EXISTS         | `bun run format:write && bun run format:md`                  | VALID               |
| `format:check`                | ✅ EXISTS         | Chained format checks                                        | VALID               |
| `format:check:md`             | ✅ EXISTS         | prettier check                                               | VALID               |
| `generate-script-docs`        | ❌ MISSING        | No implementation                                            | MISSING             |
| `generate:ai-context`         | ❌ MISSING        | Variant alias for `ai-context:generate`                      | ALIAS-NEEDED        |
| `hygiene:report`              | ✅ EXISTS         | `scripts/dev/hygiene-report-generator.ts`                    | VALID               |
| `infra-audit`                 | ❌ MISSING        | `scripts/infra-audit.ts` ✅ (registered as `arch:audit`)     | ALIAS-NEEDED        |
| `infra-audit:check`           | ❌ MISSING        | `scripts/infra-audit.ts --check` form                        | ALIAS-NEEDED        |
| `json`                        | ❌ MISSING        | CLI tool alias (`bun x json`)                                | ALIAS-NEEDED        |
| `lint`                        | ✅ EXISTS         | `biome check .`                                              | VALID               |
| `lint:fix`                    | ✅ EXISTS         | `biome check --write .`                                      | VALID               |
| `lint:staged`                 | ❌ MISSING        | Invoked by lint-staged config, not standalone runner         | INFRA-INTERNAL      |
| `migrate`                     | ❌ MISSING        | Alias for `db:migrate`                                       | ALIAS-NEEDED        |
| `my-new-script`               | ❌ MISSING        | Spec example only — pedagogical placeholder                  | EXCLUDED            |
| `prepare`                     | ✅ EXISTS         | `husky`                                                      | VALID               |
| `repo:doctor`                 | ✅ EXISTS         | `scripts/dev/repo-doctor.ts`                                 | VALID               |
| `run-staging-smoke-tests`     | ❌ MISSING        | `scripts/ci/run-staging-smoke-tests.sh` ✅                   | UNREGISTERED        |
| `scripts`                     | ❌ MISSING        | Ambiguous — possibly `bun run scripts/…`                     | EXCLUDED            |
| `seed-dashboard-test-data`    | ❌ MISSING        | Two implementations (DUPLICATE — see §2.2)                   | DUPLICATE           |
| `test`                        | ✅ EXISTS         | `vitest run`                                                 | VALID               |
| `test:ci`                     | ❌ MISSING        | Variant alias for `test`                                     | ALIAS-NEEDED        |
| `test:coverage`               | ✅ EXISTS         | `vitest run --coverage`                                      | VALID               |
| `test:e2e`                    | ✅ EXISTS         | Playwright chain                                             | VALID               |
| `test:e2e:backoffice`         | ✅ EXISTS         | Playwright backoffice                                        | VALID               |
| `test:e2e:frontoffice`        | ✅ EXISTS         | Playwright frontoffice                                       | VALID               |
| `test:e2e:mmc`                | ✅ EXISTS         | Playwright mmc                                               | VALID               |
| `test:integration`            | ✅ EXISTS         | `vitest run --dir tests/integration`                         | VALID               |
| `test:static`                 | ✅ EXISTS         | `vitest run --dir tests/static`                              | VALID               |
| `test:unit`                   | ✅ EXISTS         | vitest unit projects                                         | VALID               |
| `test:unit:boundaries`        | ✅ EXISTS         | vitest specific test files                                   | VALID               |
| `tsc`                         | ❌ MISSING        | Alias for `typecheck:src`                                    | ALIAS-NEEDED        |
| `type-check`                  | ❌ MISSING        | Alias for `typecheck`                                        | ALIAS-NEEDED        |
| `type-coverage`               | ❌ MISSING        | type-coverage tool or `validate:types`                       | ALIAS-NEEDED        |
| `type-safety-guard`           | ✅ EXISTS         | `scripts/type-safety-guard.ts`                               | VALID               |
| `typecheck`                   | ✅ EXISTS         | `bun typecheck:src && bun typecheck:tests`                   | VALID               |
| `typecheck:src`               | ✅ EXISTS         | `tsc --noEmit`                                               | VALID               |
| `typecheck:tests`             | ✅ EXISTS         | `tsc --noEmit -p tsconfig.test.json`                         | VALID               |
| `validate-runtime-scripts`    | ❌ MISSING        | No implementation (THIS STAGE delivers it)                   | MISSING             |
| `validate:ai-context-fresh`   | ❌ MISSING        | No implementation                                            | MISSING             |
| `validate:ai-context-schemas` | ❌ MISSING        | No implementation                                            | MISSING             |
| `validate:architecture`       | ❌ MISSING        | Alias for `arch:audit`                                       | ALIAS-NEEDED        |
| `validate:types`              | ✅ EXISTS         | `bun typecheck && bun type-safety-guard --json`              | VALID               |
| `validate:workflows`          | ✅ EXISTS         | `find .github/workflows …                                    | xargs actionlint`   | VALID |
| `validate:yaml`               | ✅ EXISTS         | `yamllint .`                                                 | VALID               |
| `vitest`                      | ❌ MISSING        | Alias for `test`                                             | ALIAS-NEEDED        |
| `worker`                      | ❌ MISSING        | Alias for `dev:worker`                                       | ALIAS-NEEDED        |
| `wrapper`                     | ❌ MISSING        | CI-context internal tool (not a public script)               | EXCLUDED            |

**Total valid (already registered):** 51  
**Total needing action:** 32

---

## 3. T003 — Script Classifications

### 3.1 Classification Summary

| Classification                       | Count | Scripts                                                                                                                                                                                                                              |
| ------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MISSING (need implementation)        | 7     | `db:pool-status`, `db:validate-licenses`, `db:console`, `db:migrate`, `validate-runtime-scripts`, `generate-script-docs`, `cache-clean`                                                                                              |
| MISSING (validate/\*)                | 2     | `validate:ai-context-fresh`, `validate:ai-context-schemas`                                                                                                                                                                           |
| UNREGISTERED (impl exists)           | 3     | `ai-guard`, `seed-dashboard-test-data` (after dedup), `run-staging-smoke-tests`                                                                                                                                                      |
| ALIAS-NEEDED (no impl, just mapping) | 15    | `biome`, `build:api`, `build:packages`, `ci:test`, `dev`, `generate:ai-context`, `infra-audit`, `infra-audit:check`, `json`, `migrate`, `test:ci`, `tsc`, `type-check`, `type-coverage`, `validate:architecture`, `vitest`, `worker` |
| DUPLICATE (two impls)                | 1     | `seed-dashboard-test-data`                                                                                                                                                                                                           |
| EXCLUDED (examples/infra-internal)   | 3     | `my-new-script`, `scripts`, `wrapper`, `lint:staged`                                                                                                                                                                                 |

### 3.2 Duplicate Analysis — seed-dashboard-test-data

Two implementations exist:

| Location                                  | Content                                                      | Status               |
| ----------------------------------------- | ------------------------------------------------------------ | -------------------- |
| `scripts/seed-dashboard-test-data.ts`     | Full MMC dashboard seed (1000 licenses, revenue, affiliates) | Root-level duplicate |
| `scripts/dev/seed-dashboard-test-data.ts` | Same content, `Task: T005 / T038 moved to scripts/dev/`      | Sub-domain version   |

**Decision:** Per T004 canonical selection algorithm:

- `scripts/dev/seed-dashboard-test-data.ts` is later and more traceable (explicitly moved there per Task T038)
- Canonical = `scripts/dev/seed-dashboard-test-data.ts` (superset wins; both are functionally identical, but `dev/` is the intentional destination per the commit note)
- **Canonical target path:** `scripts/seed/dashboard-test-data.ts` (per `scripts/<domain>/<script>.ts` rule)
- Action: Move `scripts/dev/seed-dashboard-test-data.ts` → `scripts/seed/dashboard-test-data.ts`, then remove `scripts/seed-dashboard-test-data.ts`

### 3.3 Sub-Package Scripts (Duplication Check)

No operational cross-domain scripts are defined in any sub-package `package.json`. All sub-packages define only workspace-local lifecycle scripts (`dev`, `build`, `test`, `start`, `preview`, `typecheck`, `lint`). These are per-workspace scoped and do not conflict with root operational scripts.

**Finding: Zero sub-package duplication to resolve.**

---

## 4. Existing Logger Pattern for Scripts

Scripts-tier code uses `scripts/core/logger-factory.ts` — NOT `@zidney/logger` directly. This is the established pattern across `scripts/ai-engine/`, `scripts/architecture/`, `scripts/governance/`, and `scripts/architecture-health/`.

```typescript
import { createLogger } from "../core/logger-factory";
const logger = createLogger("db:pool-status");
```

The factory provides:

- `logger.info(message, metadata?)` — structured JSON output
- `logger.error(message, metadata?)` — structured JSON output
- `logger.warn(message, metadata?)` — structured JSON output
- Log fields: `timestamp`, `level`, `message`, `context.correlationId`

New scripts under `scripts/<domain>/` must use the same factory via relative import path `../core/logger-factory` (one level up from domain subdirectory).

---

## 5. DB Script Behavior (Infra-Dependent)

T007 clarification locks: DB scripts must NOT require live infrastructure. Each `db:*` script must:

1. Attempt to import config and validate env variables
2. If config is missing or DB unreachable → emit structured log `{ level: "error", message: "Infrastructure dependency unavailable: DATABASE_URL not set" }` and **exit 0** (infra-dependent = not broken)
3. If config present and DB available → execute the domain operation and exit 0

Implementation approach:

- Import `@zidney/config` to load `DATABASE_URL`
- Wrap the main DB operation in try/catch
- On error: log structured error, exit 0 (graceful infra-dependent pass)

**Note on `db:pool-status` and `db:validate-licenses`:** These are only referenced in the fix spec itself as illustrative problem examples. They do NOT appear in any other runtime spec. They must still be implemented per the spec's T005 directive, but their originating feature context is the fix spec only.

**Note on `db:migrate` and `db:console`:** These are referenced in 16+ runtime specs across staging, testing, and developer guides. They are the most impactful missing scripts in terms of developer experience.

---

## 6. Shell Script Registry Gap

Several referenced scripts map to existing shell scripts that are not registered in root `package.json`:

| Script Key                | Shell File                              | Status       |
| ------------------------- | --------------------------------------- | ------------ |
| `run-staging-smoke-tests` | `scripts/ci/run-staging-smoke-tests.sh` | Unregistered |

Registration form: `"run-staging-smoke-tests": "bash scripts/ci/run-staging-smoke-tests.sh"`

Note: Shell scripts do not need to be converted to TypeScript. They can be registered directly via `bash scripts/…`.

---

## 7. validate-runtime-scripts.ts Design Research

### 7.1 Scan Algorithm

The scan must:

1. Walk all `*.md` files under `specs/runtime/` recursively
2. Apply regex `/bun run ([a-zA-Z][a-zA-Z0-9:_-]*)/g` per line
3. Exclude CLI flag forms: matches where capture group starts with `--`
4. Deduplicate by exact string match
5. Load root `package.json` and extract `scripts` keys
6. Diff: `referencedScripts - registeredScripts = missingScripts`
7. If `missingScripts.length > 0` → log each as structured error → `process.exit(1)`
8. Else → log summary → `process.exit(0)`

### 7.2 Implementation Location

- **File:** `scripts/validate/runtime-scripts.ts`
- **Registration:** `"validate-runtime-scripts": "bun run scripts/validate/runtime-scripts.ts"`
- **Exit behavior:** Always `exit(1)` on first missing script (hard-block per locked clarification)

### 7.3 Unit Test Requirement

The spec requires unit tests for "non-trivial parsing logic." The scan regex and miss-detection logic qualify. Tests live at:

- `scripts/validate/__tests__/runtime-scripts.test.ts`

---

## 8. generate-script-docs.ts Design Research

### 8.1 Metadata Header Standard

New JSDoc metadata format (per FR-06):

```typescript
/**
 * @script db:pool-status
 * @domain db
 * @description Check PostgreSQL connection pool health
 * @mode manual,ci
 * @dependencies postgres,packages/config,packages/logger
 */
```

All scripts under `scripts/<domain>/*.ts` must include this header. The generator parses it.

### 8.2 Implementation Location

- **File:** `scripts/generate/script-docs.ts`
- **Registration:** `"generate-script-docs": "bun run scripts/generate/script-docs.ts"`

### 8.3 Naming Convention Validation (FR-07)

The `<domain>:<action>` naming rule applies to DB, seed, validate, and generate domains. Exceptions exist for legacy scripts like `hygiene:report`, `repo:doctor`, `check:store-cycles`. The generator must only validate scripts it finds via `@script` metadata tags — not all root package.json scripts.

---

## 9. Decisions Locked

| #   | Decision                                                                                                          | Rationale                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| D1  | Logger: use `scripts/core/logger-factory.ts`                                                                      | Consistent with all existing scripts in scripts/; @zidney/logger is for app code                  |
| D2  | DB scripts: graceful infra-dependent exit (exit 0 + structured log)                                               | Per T007 clarification — crash = fail, structured log = pass                                      |
| D3  | seed dedup: canonical = `scripts/dev/seed-dashboard-test-data.ts` → move to `scripts/seed/dashboard-test-data.ts` | Task comment `T038 moved to scripts/dev/` shows intentional placement; merge-then-remove          |
| D4  | Shell scripts registered via `bash scripts/ci/…` (not converted to TS)                                            | No TS conversion required per spec scope                                                          |
| D5  | Aliases: add as inline commands in package.json `scripts`, no new implementation files                            | Minimal footprint for pure pass-through aliases                                                   |
| D6  | `my-new-script`, `scripts`, `wrapper`, `lint:staged` excluded from registry                                       | Pedagogical examples or infra-internal lifecycle hooks — not operational scripts                  |
| D7  | Unit tests required for validate-runtime-scripts.ts scan logic only                                               | Spec: "Any non-trivial parsing logic (e.g., in validate-runtime-scripts.ts) must have unit tests" |
| D8  | `validate:ai-context-fresh` and `validate:ai-context-schemas` → new scripts in `scripts/validate/`                | Referenced in runtime specs as validation gates; similar pattern to existing ai-context check     |

---

## 10. Open Risks

None. All clarifications are locked. Planning is unblocked.
