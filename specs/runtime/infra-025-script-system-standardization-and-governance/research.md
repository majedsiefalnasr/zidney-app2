# Research: Script System Standardization and Governance

**Stage:** INFRA-25
**Phase:** 01_PLATFORM_FOUNDATION
**Date:** 2026-03-21
**Status:** COMPLETE — All unknowns resolved

---

## Purpose

This document captures empirical findings from scanning the current repository state. It resolves the "NEEDS CLARIFICATION" items for the implementation plan and provides a ground-truth baseline for the migration.

---

## 1. Scripts Directory Structure

### Root-Level Scripts (Outside Domain Subdirectories)

The following `.ts` scripts exist directly at `scripts/` root — **not** under a `scripts/<domain>/` subfolder. They lack the required `@script`, `@domain`, `@category`, `@usage` metadata headers and are flagged for header additions.

| File                                 | Current Package.json Name                               |
| ------------------------------------ | ------------------------------------------------------- |
| `scripts/ai-guard.ts`                | `ai-guard` (non-compliant)                              |
| `scripts/architecture-diff.ts`       | (invoked directly, no governed name)                    |
| `scripts/check-store-cycles.ts`      | `check:store-cycles` (non-compliant domain)             |
| `scripts/check-tsconfig-strict.sh`   | (shell, exempt from TS header requirement)              |
| `scripts/generate-ai-context.ts`     | `ai-context:generate` (non-compliant)                   |
| `scripts/gitnexus-context.ts`        | `gitnexus:context` (non-compliant domain)               |
| `scripts/infra-audit.ts`             | `arch:audit` (compliant), also aliased as `infra-audit` |
| `scripts/prompt-qa.ts`               | (no package.json entry found)                           |
| `scripts/run-local-ci.ts`            | `ci:run-local` (compliant format)                       |
| `scripts/run-staging-smoke-tests.sh` | `run-staging-smoke-tests` (non-compliant)               |
| `scripts/type-safety-guard.ts`       | `type-safety-guard` (non-compliant)                     |
| `scripts/architecture-diff.ts`       | (called directly from CI, no package.json wrapper)      |

### Domain Subdirectory Contents

| Subdirectory                   | Files                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `scripts/ai-context/`          | `artifact-builders/`, `generators/`, `orchestrator.ts`, `source-loader.ts`, etc.         |
| `scripts/ai-engine/`           | `run-task.ts`, `plan-task.ts`, `validate-execution.ts`, etc.                             |
| `scripts/ai-runtime/`          | `runtime-status.ts`                                                                      |
| `scripts/architecture/`        | `add-module.ts`, `generate-architecture-map.ts`, `visualize.ts`, `core/`                 |
| `scripts/architecture-guard/`  | `architecture-guard.ts`, `rules/`, `reporters/`, `utils/`                                |
| `scripts/architecture-health/` | `architecture-health.ts`, `collectors/`, `formatters.ts`, etc.                           |
| `scripts/build/`               | `.sh` files only                                                                         |
| `scripts/ci/`                  | `.sh` files only                                                                         |
| `scripts/core/`                | Shared utilities (logger-factory, cache-manager, etc.)                                   |
| `scripts/db/`                  | `console.ts`, `migrate.ts`, `pool-status.ts`, `validate-licenses.ts`                     |
| `scripts/dev/`                 | Developer utilities (hygiene checks, benchmarks, analyzers)                              |
| `scripts/generate/`            | `script-docs.ts`                                                                         |
| `scripts/governance/`          | `validate-architecture-brain.ts`, `type-safety-guard.ts`, `core/governance-validator.ts` |
| `scripts/maintenance/`         | `cache-clean.ts`                                                                         |
| `scripts/seed/`                | `dashboard-test-data.ts`                                                                 |
| `scripts/validate/`            | `runtime-scripts.ts`, `detect-broken-scripts.ts`, `scan-package-scripts.ts`, etc.        |

**Key finding:** The `scripts/architecture/`, `scripts/architecture-guard/`, and `scripts/architecture-health/` subdirectories all map to the `arch` domain. This multi-folder-to-single-domain mapping is an existing convention that is **not** changed by this stage.

---

## 2. Current Metadata Header Format

### Finding: Two Formats in Use

**Format A (newer, partial)** — used in `scripts/db/`, `scripts/validate/`, `scripts/generate/`:

```ts
/**
 * @script db:pool-status
 * @domain db
 * @description Check PostgreSQL connection pool health and report status
 * @mode manual,ci
 * @dependencies pg,node:crypto
 */
```

**Format B (narrative, no structured tags)** — used in `scripts/ai-guard.ts`, `scripts/infra-audit.ts`, `scripts/architecture-diff.ts`:

```ts
/**
 * Zidney AI Guard
 *
 * Purpose:
 * ...long narrative...
 */
```

### Missing Fields

The **canonical format** required by this stage adds two fields that neither format currently has:

| Field          | Required By This Stage | Present in Format A | Present in Format B |
| -------------- | ---------------------- | ------------------- | ------------------- |
| `@script`      | Yes                    | Yes                 | No                  |
| `@domain`      | Yes                    | Yes                 | No                  |
| `@category`    | Yes                    | **No**              | No                  |
| `@description` | Yes                    | Yes                 | No                  |
| `@usage`       | Yes                    | **No**              | No                  |

**Decision:** Format A scripts need `@category` and `@usage` added. Format B scripts need a complete new metadata header prepended (keeping existing narrative as additional context).

---

## 3. Root Package.json Script Inventory

### Total Script Count

The root `package.json` defines **113 script entries** as of the research scan.

### Compliance Analysis

| Category                                            | Count   |
| --------------------------------------------------- | ------- |
| Lifecycle-exempt (no action required)               | 37      |
| Already-compliant governed scripts                  | 33      |
| Non-compliant governed scripts (Type A–D)           | 24      |
| Redundant aliases to remove (Type E)                | 9       |
| Unclassified (no package.json entry, or edge cases) | 10      |
| **Total**                                           | **113** |

### Non-Compliant Scripts — Detailed Findings

#### `db:pool-status`

- **Current command:** `bun run scripts/db/pool-status.ts`
- **Issue:** Action segment `pool-status` should be restructured to `status:pool` per spec §Naming Convention example
- **Current header `@script`:** `db:pool-status` — must be updated to `db:status:pool` after rename
- **New name:** `db:status:pool`

#### `db:validate-licenses`

- **Current command:** `bun run scripts/db/validate-licenses.ts`
- **Issue:** Action `validate-licenses` uses hyphen between what should be `:` segments
- **Current header `@script`:** `db:validate-licenses` — must be updated
- **New name:** `db:validate:licenses`

#### `arch:validate-brain`

- **Current command:** `bun scripts/governance/validate-architecture-brain.ts`
- **Issue:** Action segment `validate-brain` should be `validate:brain`
- **Also aliased as:** `ai-runtime:validate` → `bun arch:validate-brain`
- **New name:** `arch:validate:brain`

#### `ai-context:generate`

- **Current command:** `bun scripts/generate-ai-context.ts`
- **Issue:** Domain `ai-context` uses hyphen — should be `ai:context`
- **Duplicate entry:** `generate:ai-context` points to same command (`bun run ai-context:generate`)
- **New name:** `ai:context:generate`; `generate:ai-context` alias removed

#### `ai-context:refresh` / `ai-context:validate` / `ai-context:status`

- Same domain hyphen issue as `ai-context:generate`
- New names: `ai:context:refresh`, `ai:context:validate`, `ai:context:status`

#### `ai-runtime:status` / `ai-runtime:refresh` / `ai-runtime:validate`

- Domain `ai-runtime` uses hyphen
- Note: `ai-runtime:validate` maps to `bun arch:validate-brain` — after rename becomes `bun run arch:validate:brain`
- New names: `ai:runtime:status`, `ai:runtime:refresh`, `ai:runtime:validate`

#### `ai-guard`

- **Current command:** `bun run scripts/ai-guard.ts`
- **Issue:** No domain prefix, uses hyphen
- **New name:** `ai:guard`
- **Note:** This is distinct from `arch:guard` (which points to `scripts/architecture-guard/architecture-guard.ts`). Both are valid once renamed.

#### `type-safety-guard`

- **Current command:** `bun scripts/type-safety-guard.ts`
- **Note:** `scripts/type-safety-guard.ts` at root is a legacy file; `scripts/governance/type-safety-guard.ts` also exists and is the canonical implementation. The root file is the entry that needs renaming/redirecting.
- **New name:** `arch:type-safety-guard`

#### `generate-script-docs`

- **Current command:** `bun run scripts/generate/script-docs.ts`
- **Issue:** No domain, uses hyphen
- **New name:** `dev:generate:script-docs`

#### `seed-dashboard-test-data`

- **Current command:** `bun run scripts/seed/dashboard-test-data.ts`
- **New name:** `dev:seed:dashboard-test-data`

#### `validate-runtime-scripts`

- **Current command:** `bun run scripts/validate/runtime-scripts.ts`
- **Issue:** No domain format, uses hyphen
- **New name:** `validate:runtime:scripts`
- **Note:** The script header currently has `@script validate-runtime-scripts` — must be updated to `@script validate:runtime:scripts`

#### `run-staging-smoke-tests`

- **Current command:** `bash scripts/ci/run-staging-smoke-tests.sh`
- **New name:** `ci:smoke:staging`

#### `gitnexus:context`

- **Current command:** `bun scripts/gitnexus-context.ts`
- **Issue:** `gitnexus` is not in the 9 allowed domains
- **New name:** `arch:gitnexus:context`
- **Note:** `arch:context` (existing compliant script) points to `bun scripts/gitnexus-context.ts` for the same purpose. The `gitnexus:context` entry is the duplicate — make it an alias of `arch:gitnexus:context` or remove after refactor.

#### `gitnexus:validate`

- **Current command:** `bun scripts/validate/validate-gitnexus.ts`
- **New name:** `arch:validate:gitnexus`

#### `hygiene:report`

- **Current command:** `bun scripts/dev/hygiene-report-generator.ts`
- **Issue:** `hygiene` not in allowed domains
- **New name:** `dev:hygiene:report`

#### `maintenance:cache-clean`

- **Current command:** `bun run scripts/maintenance/cache-clean.ts`
- **Issue:** `maintenance` not in allowed domains
- **New name:** `infra:cache:clean`

#### `check:tsconfig`

- **Current command:** `bash scripts/check-tsconfig-strict.sh`
- **Issue:** `check` not in allowed domains
- **New name:** `validate:tsconfig`

#### `check:store-cycles`

- **Current command:** `bun scripts/check-store-cycles.ts`
- **Issue:** `check` not in allowed domains
- **New name:** `arch:check:store-cycles`

#### `infra-audit:check`

- **Current command:** `bun run arch:audit --check`
- **Issue:** `infra-audit` uses hyphen in domain part
- **New name:** `arch:audit:check`

### Redundant Aliases Confirmed

Confirmed by inspecting command values in `package.json`:

| Alias                   | Command                           | Canonical                          |
| ----------------------- | --------------------------------- | ---------------------------------- |
| `infra-audit`           | `bun run arch:audit`              | `arch:audit`                       |
| `migrate`               | `bun run db:migrate`              | `db:migrate`                       |
| `validate:architecture` | `bun run arch:audit`              | `arch:audit`                       |
| `type-coverage`         | `bun run validate:types`          | `validate:types`                   |
| `cache-clean`           | `bun run maintenance:cache-clean` | `infra:cache:clean` (after rename) |
| `biome`                 | `biome check .`                   | `lint`                             |
| `tsc`                   | `bun run typecheck:src`           | `typecheck:src`                    |
| `vitest`                | `vitest run`                      | `test`                             |
| `worker`                | `bun run dev:worker`              | `dev:worker`                       |

---

## 4. Workspace Package.json Scripts

**Finding:** All workspace `package.json` files (`apps/*/`, `packages/*/`) contain only standard lifecycle scripts:

- `apps/*`: `dev`, `build`, `start`, `preview`
- `packages/*`: `build`, `test`, `test:watch`, `typecheck`, `lint`, `type-check`, `build:watch`, `build:analyze`, `test:ui`, `test:coverage`, `preview`

These are all lifecycle-exempt. **Zero non-compliant governed scripts found in workspaces.** The governance scope is entirely in the root `package.json` and `scripts/` directory.

---

## 5. Existing Validation Infrastructure

### `scripts/validate/detect-broken-scripts.ts`

- **Current `@script`:** `validate:detect-broken`
- **Purpose:** Detects TypeScript script files referenced in root `package.json` that do not exist on disk
- **Status:** Partially functional, different scope from the new `validate:script:usage` (which also checks non-package.json invocation sites)
- **Action:** Superseded by `validate:script:usage` but can remain as a utility; its `@script` name needs to be updated to comply

### `scripts/validate/runtime-scripts.ts`

- **Current `@script`:** `validate-runtime-scripts`
- **Purpose:** CI guard verifying that all `bun run <script>` references in `specs/runtime/**` exist in root `package.json`
- **Status:** Name non-compliant; different scope than new validators (it checks specs directory, not all scan surfaces)
- **Action:** Rename to `validate:runtime:scripts`; update header

### `scripts/validate/scan-package-scripts.ts`

- **Purpose:** Scans and reports package.json scripts
- **Status:** Utility used by other scripts; no direct package.json entry
- **Action:** May be incorporated into the new validators as a shared utility module

### `scripts/validate/diff-script-registry.ts`

- **Purpose:** Diffs script registry
- **Status:** Exists but no active package.json entry
- **Action:** Can be absorbed into `validate:script:infrastructure`

---

## 6. CI Workflow Current State

### `.github/workflows/architecture-governance.yml`

- **Total lines:** 146
- **Total steps:** 13
- **Trigger:** `pull_request` (main, develop), `push` (main, develop), `schedule` (daily 02:00)
- **Current steps 1–13:**
  1. Checkout repository
  2. Setup Bun
  3. Install dependencies
  4. Verify AI Bootstrap Exists
  5. Run Zidney AI Guard (`bun scripts/ai-guard.ts`)
  6. Run Infrastructure Audit (`bun scripts/infra-audit.ts --ci`)
  7. Run Architecture Diff (`bun scripts/architecture-diff.ts`)
  8. Run Architecture Health (`bun run arch:health:ci`)
  9. Upload Architecture Health Artifacts
  10. Publish Architecture Summary
  11. Run AI Execution Validation (`bun ai:validate --ci`)
  12. Upload AI Execution Artifact
  13. Publish AI Execution Summary

**Finding:** Steps 14–17 for script governance will append cleanly after the last existing step (13).

**Note:** Step 11 calls `bun ai:validate --ci`. After the rename `ai-runtime:validate` → `ai:runtime:validate`, and since `ai:validate` is already a valid compliant governed script (`bun scripts/ai-engine/validate-execution.ts`), this step is unaffected.

---

## 7. Scan Scope Gap Analysis

### Finding: `.sh` Files Were Missing from Engine Skeleton

The spec clarification explicitly confirms: `.sh` files MUST be in the scan scope. The skeleton in the stage file omits `\.sh$`. The refactor engine implementation MUST include shell scripts in the glob pattern:

```ts
const SCAN_EXTENSIONS = /\.(json|ts|yml|yaml|md|sh)$/;
```

Shell scripts confirmed in scope that reference governed script names:

- `scripts/ci/run-staging-smoke-tests.sh` (maps to `run-staging-smoke-tests` → `ci:smoke:staging`)
- Various CI shell wrappers in `scripts/ci/`

### Finding: `.agents/**/*.md` Must Be in Scope

The `.agents/skills/script-system-governance/SKILL.md` itself contains `bun run` references in workflow examples. The refactor engine must scan `.agents/**/*.md` to update these references after renames.

---

## 8. Idempotency Verification Strategy

The refactor engine uses plain string `replaceAll` — not regex. This means:

- Re-running after completion: `replaceAll("bun run db:pool-status", "bun run db:status:pool")` on a file that already contains `bun run db:status:pool` produces zero replacements ✓
- No risk of double-replacement: old names never appear in replacement values ✓
- Safe to chain multiple runs: each is a no-op once migration is complete ✓

---

## 9. `generate:ai-context` Duplicate Resolution

**Finding:** Two package.json entries point to functionally equivalent behavior:

```json
"ai-context:generate": "bun scripts/generate-ai-context.ts",
"generate:ai-context": "bun run ai-context:generate"
```

`generate:ai-context` is an indirect alias calling `ai-context:generate`. After renaming `ai-context:generate` → `ai:context:generate`, the `generate:ai-context` entry becomes a call to a non-existent script. Both entries must be resolved:

- `ai-context:generate` → renamed to `ai:context:generate` (Type B rename)
- `generate:ai-context` → removed (Type D, duplicate alias)

The canonical entry becomes: `"ai:context:generate": "bun scripts/generate-ai-context.ts"`

---

## 10. `arch:context` vs `arch:gitnexus:context` Overlap

**Finding:** Both `arch:context` and `gitnexus:context` map to the same script:

```json
"arch:context": "bun scripts/gitnexus-context.ts",
"gitnexus:context": "bun scripts/gitnexus-context.ts"
```

**Resolution:**

- `arch:context` is compliant — keep as-is
- `gitnexus:context` is non-compliant — rename to `arch:gitnexus:context` as a more specific alias for the same script. This maintains backwards discoverability while achieving compliance.

---

## 11. Decisions Recorded

| Decision                                                                    | Rationale                                                                                                        |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `type-safety-guard` → `arch:type-safety-guard` (not `validate:type-safety`) | The script is an architecture enforcement tool and belongs in `arch` domain alongside `arch:guard`               |
| `check:tsconfig` → `validate:tsconfig`                                      | Tsconfig validation is a `validate` domain concern                                                               |
| `check:store-cycles` → `arch:check:store-cycles`                            | Store cycle detection is architectural validation; `arch` domain is appropriate                                  |
| `generate-script-docs` → `dev:generate:script-docs`                         | Code generation is a `dev` domain utility                                                                        |
| `seed-dashboard-test-data` → `dev:seed:dashboard-test-data`                 | Seeding is a developer utility; `dev` domain is correct                                                          |
| `maintenance:cache-clean` → `infra:cache:clean`                             | Cache management is infrastructure-level; `infra` domain is appropriate                                          |
| `run-staging-smoke-tests` → `ci:smoke:staging`                              | CI-only script; `ci` domain is correct                                                                           |
| Metadata `@mode` and `@dependencies` preserved                              | Additive policy — existing fields not removed, only missing fields added                                         |
| Shell scripts exempt from TS header requirement                             | Per spec §Assumptions — `.sh` files follow naming convention only                                                |
| Type E aliases removed (not migrated)                                       | After refactor engine updates all references, these aliases are obsolete duplicates. Removing reduces confusion. |

---

## Summary: All Unknowns Resolved

| Unknown from Technical Context                 | Resolution                                                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Does refactor engine cover `.sh`?              | Yes — `\.sh$` must be in scan scope (spec clarification confirmed)                                  |
| Report-all or fail-fast for validators?        | Report-all — validators collect all violations before exit(1) (spec clarification confirmed)        |
| Which CI workflow receives script validation?  | `architecture-governance.yml` — append as steps 14–17 (spec clarification confirmed)                |
| Duplicate name rule scope?                     | Governed scripts only (`<domain>:<action>[:<scope>]`) — lifecycle scripts exempt from deduplication |
| Skill supersedes or supplements?               | Supplements — additive to existing AGENTS.md and README guidance                                    |
| Current metadata format?                       | Two formats in use; both missing `@category` and `@usage`; all scripts need these fields added      |
| Number of non-compliant scripts?               | 33 total (24 renames + 9 alias removals)                                                            |
| Workspace packages have non-compliant scripts? | No — all lifecycle-exempt; root package.json is the only affected source                            |
