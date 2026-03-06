# Specification: Biome — Unified Linting and Formatting Engine

**Feature ID:** `infra-004-biome`
**Phase:** `01_PLATFORM_FOUNDATION`
**Stage File:** `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_04_BIOME.md`
**Stage Status:** DRAFT → IN PROGRESS
**Type:** Infrastructure Tooling Replacement (non-feature)
**Branch:** `spec/infra-004-biome`
**Initiated:** 2026-03-06T00:00:00Z
**Spec Author:** SpecKit (speckit.specify)

---

## Feature Overview

### What Is Being Replaced

This stage replaces ESLint and Prettier with **Biome** as the single unified linting and formatting engine for the entire Zidney monorepo. It does **not** introduce any new user-facing features and does not change any runtime behavior.

The work covers:

- Removing ESLint, Prettier, and all associated plugins from the repository
- Installing Biome and establishing a single root-level `biome.json` configuration
- Enforcing deterministic formatting and linting rules across all supported file types
- Integrating Biome checks into the CI pipeline as a blocking gate
- Establishing import hygiene rules that complement AI-Guard architecture enforcement

### Phase Mapping

- Phase: `01_PLATFORM_FOUNDATION`
- This stage is a prerequisite for:
  - Establishing the final CI quality gate sequence (Biome → AI-Guard → Vitest)
  - Declaring the toolchain production-ready
  - Eliminating toolchain fragmentation in the developer environment

### Impact on Existing Systems

| Area                | Impact                                                                  |
| ------------------- | ----------------------------------------------------------------------- |
| Isolation           | None — no data access model changes                                     |
| License enforcement | None — middleware untouched                                             |
| Attempt engine      | None — no behavioral changes                                            |
| Worker              | None — logic untouched; only code style enforcement changes             |
| Runtime             | None — no operational behavior changes                                  |
| Frontoffice         | Included in scope; only formatting/lint rules applied to .ts/.vue files |
| Database            | None — no schema or migration changes                                   |

---

## Constitutional Compliance Declaration

This stage reinforces — and does not weaken — the Zidney Constitution v1.2.0.

Confirmed explicitly:

| Rule                                   | Status       |
| -------------------------------------- | ------------ |
| No cross-tenant access introduced      | ✅ Confirmed |
| No middleware bypass introduced        | ✅ Confirmed |
| No grading logic moved outside worker  | ✅ Confirmed |
| No direct DB instantiation introduced  | ✅ Confirmed |
| No weakening of snapshot integrity     | ✅ Confirmed |
| No weakening of transaction boundaries | ✅ Confirmed |
| No weakening of version enforcement    | ✅ Confirmed |

This is a developer toolchain change only. No runtime behavior is modified. No architectural invariant is altered. Biome operates exclusively on source files during the development and CI build phases — it has no presence in any deployed artifact.

---

## Purpose

The Zidney monorepo currently uses multiple overlapping tools — ESLint, Prettier, and their associated plugin ecosystem — to enforce code quality. This creates:

- Conflicting rule sets that require manual reconciliation between ESLint and Prettier formatting opinions
- Slower CI pipelines due to running multiple sequential tools
- Configuration drift between applications and packages as each can override shared configs
- A complex dependency surface (ESLint plugins, parser packages, Prettier plugins) that must be kept in sync

This stage eliminates that fragmentation. Biome is a single, Rust-based tool that provides linting, formatting, and import organization in one fast pass. A single `biome.json` at the repository root governs all packages and applications — no per-package override is permitted.

**Core Philosophy Alignment:**

| Principle                                  | How This Stage Upholds It                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| Stability over speed                       | Deterministic formatting eliminates style-related noise in diffs and reviews |
| Determinism over magic                     | Single config produces identical output on every machine and in CI           |
| Explicit governance over implicit behavior | One enforced rule set replaces implicit plugin priority resolution           |
| Isolation over convenience                 | No per-package exceptions — monorepo-wide uniformity enforced                |

---

## Objectives

1. Replace ESLint + Prettier (and all associated plugins) with a single `@biomejs/biome` dependency.
2. Provide a **single formatting and linting engine** for the entire monorepo via `biome.json` at the repository root.
3. Integrate Biome lint and format checks into the CI pipeline as a blocking gate.
4. Enforce deterministic formatting across all applications and packages — identical output on every machine.
5. Provide import hygiene rules (automatic import sorting) that work alongside AI-Guard architecture validation.
6. Improve lint/format pipeline performance in local development and CI.
7. Establish lint policy (noUnusedImports, noDebugger, noConsole, noDuplicateImports, useConst) as the enforced baseline.
8. Ensure developer tooling (VSCode extension) is documented for onboarding.

---

## Scope

### Included

| Target             | Description                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `apps/api`         | All TypeScript source files                                                                             |
| `apps/worker`      | All TypeScript source files                                                                             |
| `apps/mmc`         | TypeScript, JavaScript, TSX — Vue embedded script blocks analyzed                                       |
| `apps/backoffice`  | TypeScript, JavaScript, TSX — Vue embedded script blocks analyzed                                       |
| `apps/frontoffice` | TypeScript, JavaScript, TSX — Vue embedded script blocks analyzed                                       |
| `packages/*`       | All shared packages: domain-core, types, logger, config, validation, ui-system, api-client, redis-utils |
| `tests/*`          | All test files including unit, integration, e2e, and helper utilities                                   |
| `scripts/*`        | All TypeScript and JavaScript tooling scripts                                                           |
| JSON files         | `package.json`, `tsconfig.json`, and other workspace JSON files (format enforcement)                    |

### Excluded

| Target          | Reason                                           |
| --------------- | ------------------------------------------------ |
| `node_modules`  | Third-party code outside project control         |
| Generated files | Auto-generated artifacts must not be reformatted |
| `.specify/`     | SpecKit tooling governed by its own convention   |
| Binary assets   | Non-text files are not applicable                |

### Languages Supported by Biome

```
TypeScript (.ts)
JavaScript (.js, .mjs, .cjs)
TSX (.tsx)
JSX (.jsx)
JSON (.json, .jsonc)
Vue (.vue) — embedded script blocks only
```

---

## Functional Requirements

### FR-01: Single Root Configuration

A single `biome.json` file must exist at the repository root. This file is the sole source of formatting and linting configuration for the entire monorepo. No per-package Biome configuration files are permitted.

**Acceptance Criterion:** Only one `biome.json` exists in the repository; no sub-directory overrides exist.

---

### FR-02: ESLint and Prettier Removal

All ESLint packages (`eslint`, `@typescript-eslint/*`, `eslint-plugin-*`), Prettier packages (`prettier`, `prettier-plugin-*`), and their associated configuration files (`eslint.config.*`, `.prettierrc`, `prettier.config.*`) must be removed from the repository.

**Acceptance Criterion:** No ESLint or Prettier dependency appears in any `package.json` across the monorepo; no ESLint or Prettier configuration files remain.

---

### FR-03: Formatter Enforcement

Biome's formatter must be enabled with the following settings applied monorepo-wide:

- Indent style: spaces
- Indent width: 2
- Line width: 100

All source files within scope must be formatted to comply with these settings.

**Acceptance Criterion:** `biome format --check .` exits with code `0` after the migration is applied and formatting has been run.

---

### FR-04: Linter Enforcement

Biome's linter must be enabled with the `recommended` rule set as the baseline. The following rules must be explicitly enforced:

| Rule                 | Purpose                               |
| -------------------- | ------------------------------------- |
| `noUnusedImports`    | Eliminate dead import statements      |
| `noDebugger`         | Prevent debugger statements in code   |
| `noConsole`          | Enforce structured logging discipline |
| `noDuplicateImports` | Prevent redundant import entries      |
| `useConst`           | Prefer const over let where possible  |

**Acceptance Criterion:** `biome check .` exits with code `0` across the full codebase after rules are applied and violations are resolved.

---

### FR-05: Import Organization

Biome's import organizer must be enabled. Imports must be sorted automatically on format. This ensures diff clarity and prevents manual import ordering inconsistency.

**Acceptance Criterion:** Running `biome format --write .` results in consistently sorted imports across all files; no manual import order maintenance is required.

---

### FR-06: CI Integration — Lint Gate

The CI pipeline must include a `biome check .` step that runs before AI-Guard and before any test execution. This step must fail the pipeline with a non-zero exit code if any lint violation exists.

**Acceptance Criterion:** CI pipeline configuration includes a blocking `biome check .` job; no PR can be merged if this job fails.

---

### FR-07: CI Integration — Format Gate

The CI pipeline must include a `biome format --check .` step that runs as a blocking gate. Unformatted code must prevent merge.

**Acceptance Criterion:** CI pipeline configuration includes a blocking `biome format --check .` job; any unformatted code fails the pipeline.

---

### FR-08: Developer Workflow Commands

The following root-level commands must be documented and functional:

| Command                      | Purpose                                       |
| ---------------------------- | --------------------------------------------- |
| `bun biome check .`          | Run lint and format check across the monorepo |
| `bun biome format --write .` | Apply formatting and import sorting in place  |
| `bun biome check --apply .`  | Apply safe lint fixes across the monorepo     |

**Acceptance Criterion:** All three commands execute successfully from the repository root against the full codebase.

---

### FR-09: AI-Guard Pipeline Position

Biome must execute **before** AI-Guard in the CI quality gate sequence. This ensures that architecture validation operates on clean, consistently formatted code.

**Pipeline order:**

```
biome check .
↓
biome format --check .
↓
AI-Guard (scripts/ai-guard.ts)
↓
Vitest
↓
Playwright (when applicable)
```

**Acceptance Criterion:** CI pipeline step ordering reflects this sequence; AI-Guard is not triggered before Biome passes.

---

### FR-10: VSCode Extension Recommendation

The Biome VSCode extension must be added to the workspace extension recommendations (`.vscode/extensions.json`). This enables automatic format-on-save for all developers using VSCode.

**Acceptance Criterion:** `.vscode/extensions.json` includes the Biome extension ID; the recommendation is documented in the developer onboarding guide.

---

## User Scenarios & Testing

> Note: This is an infrastructure tooling stage. The "users" are engineers, CI systems, and future AI agents operating in the codebase. Scenarios are framed accordingly.

### Scenario 1: Engineer Runs Lint Check Locally

**Given** an engineer has the repository cloned and dependencies installed
**When** they run `bun biome check .` from the repository root
**Then** the command completes with exit code `0` and reports zero lint violations

### Scenario 2: Engineer Formats the Codebase

**Given** a developer has made code changes
**When** they run `bun biome format --write .`
**Then** all modified files are reformatted in place and imports are sorted; the subsequent `biome format --check .` passes

### Scenario 3: CI Blocks an Unformatted Pull Request

**Given** a developer submits a PR with unformatted code
**When** CI runs the `biome format --check .` job
**Then** the job fails, the PR is blocked from merging, and the formatting error is reported in the CI log

### Scenario 4: CI Blocks a Lint Violation

**Given** a developer submits a PR that introduces a `console.log` statement or unused import
**When** CI runs the `biome check .` job
**Then** the job fails with the relevant rule violation listed, and the PR cannot be merged until resolved

### Scenario 5: Biome Runs Before AI-Guard

**Given** a PR fails Biome lint or format checks
**When** CI runs the quality gate sequence
**Then** AI-Guard does not execute; the pipeline stops and reports the Biome failure first

### Scenario 6: New File Added to Monorepo

**Given** a developer adds a new TypeScript file under `apps/` or `packages/`
**When** they run `bun biome check .`
**Then** the new file is automatically covered by the root-level `biome.json` with no additional configuration required

### Scenario 7: Vue File Linting

**Given** a Vue single-file component contains TypeScript code in its `<script setup>` block
**When** Biome processes the file
**Then** the embedded TypeScript is linted and formatted according to the same rules as standalone `.ts` files

---

## Success Criteria

The stage is complete when all of the following are met:

| #     | Criterion                                                                                       | Verification Method                                                       |
| ----- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| SC-01 | All source files pass Biome lint checks with zero violations                                    | `bun biome check .` exits with code `0`                                   |
| SC-02 | All source files are correctly formatted per the root Biome configuration                       | `bun biome format --check .` exits with code `0`                          |
| SC-03 | ESLint and Prettier are fully removed from the repository                                       | No ESLint or Prettier entry in any `package.json`; no config files remain |
| SC-04 | CI pipeline includes blocking Biome check and format gates before other quality steps           | CI configuration inspection; pipeline run history                         |
| SC-05 | Import sorting is enforced — no manually ordered imports remain that conflict with Biome output | `biome format --write .` produces no diff on the formatted codebase       |
| SC-06 | Single `biome.json` governs all packages — no per-package Biome configuration exists            | File search confirms one `biome.json` at root only                        |
| SC-07 | Biome gate runs before AI-Guard in CI — pipeline order is enforced                              | CI pipeline step inspection                                               |
| SC-08 | Developer documentation for Biome commands is present                                           | README or developer guide updated; VSCode extension recommended           |

---

## Migration Strategy

The migration is structured in three sequential passes. Each pass must be committed independently to preserve reviewability.

### Pass 1 — Biome Installation and Configuration

**Goal:** Introduce Biome and establish the root configuration without removing ESLint and Prettier.

**Activities:**

- Install `@biomejs/biome` as a dev dependency at the root
- Create `biome.json` at the repository root with formatter, linter, and import organizer settings
- Verify Biome can scan the full monorepo without critical errors
- Document any files that require temporary exclusion

**Exit Gate:** `bun biome check .` runs successfully (violations may still exist; full compliance not required yet).

---

### Pass 2 — Violation Resolution

**Goal:** Eliminate all lint and format violations flagged by Biome so that both `biome check .` and `biome format --check .` return exit code `0`.

**Activities:**

- Run `bun biome format --write .` to auto-apply formatting and import sorting
- Run `bun biome check --apply .` to auto-fix safe lint violations
- Manually resolve remaining violations that cannot be auto-fixed (primarily `noConsole` usages that must be replaced with structured logger calls)
- Review and resolve any formatting conflicts introduced by the switch from Prettier to Biome line width/indentation rules

**Exit Gate:** Both `bun biome check .` and `bun biome format --check .` exit with code `0`.

---

### Pass 3 — ESLint and Prettier Removal and CI Update

**Goal:** Remove the legacy toolchain and update CI to use Biome gates.

**Activities:**

- Remove ESLint, Prettier, and all associated plugins from all `package.json` files
- Delete ESLint configuration files (`eslint.config.mjs`, per-package `.eslintrc.*` files)
- Delete Prettier configuration files (`prettier.config.mjs`, `.prettierrc` files)
- Update CI pipeline configuration to replace ESLint/Prettier steps with Biome check and format gates
- Add `.vscode/extensions.json` Biome extension recommendation
- Update developer documentation with new commands

**Exit Gate:** No ESLint or Prettier references remain; CI pipeline reflects the new Biome-first gate order; all CI jobs pass.

---

## Isolation Impact Analysis

| Item                        | Assessment                 |
| --------------------------- | -------------------------- |
| Database accessed           | None — tooling change only |
| Tenant resolver involvement | None                       |
| Connection pool involvement | None                       |
| New tables introduced       | None                       |
| Shared tenant data risk     | None                       |
| Cross-tenant join risk      | None                       |

This stage introduces no changes to data access, tenant isolation, or runtime behavior. It operates exclusively at the developer toolchain layer.

---

## License & Version Enforcement

| Item                           | Assessment                                        |
| ------------------------------ | ------------------------------------------------- |
| License middleware required    | No — tooling change has no workspace-bound routes |
| License state validation       | Not applicable                                    |
| Limit enforcement              | Not applicable                                    |
| Schema version check required  | No                                                |
| Product version check required | No                                                |

This stage does not touch any licensed workspace functionality.

---

## Layer Separation Confirmation

| Rule                                       | Status        |
| ------------------------------------------ | ------------- |
| Frontend contains no business logic        | ✅ Unaffected |
| API contains no grading logic              | ✅ Unaffected |
| Worker contains no HTTP logic              | ✅ Unaffected |
| MMC does not access tenant DB              | ✅ Unaffected |
| No direct DB creation outside provisioning | ✅ Unaffected |

Biome enforces import hygiene at the toolchain level. The import organization it enforces does not alter the import boundary rules governed by AI-Guard. Both tools operate on distinct validation concerns.

---

## Test Strategy

Since this is a tooling migration with no runtime behavior changes, the test strategy focuses on verifying the toolchain itself.

### Required Checks

| Check                                 | Method                                                 |
| ------------------------------------- | ------------------------------------------------------ |
| Biome lint passes on full codebase    | `bun biome check .` exit code `0`                      |
| Biome format passes on full codebase  | `bun biome format --check .` exit code `0`             |
| ESLint removed — no residual config   | File search + `package.json` dependency audit          |
| Prettier removed — no residual config | File search + `package.json` dependency audit          |
| CI gate order verified                | CI pipeline step inspection                            |
| Existing unit tests still pass        | `bun run test` — no regressions from code reformatting |
| Existing type checks still pass       | `bun run type-check` — no regressions                  |

### Regression Safety

All existing Vitest unit and integration tests must pass after reformatting. Biome format changes must not introduce functional regressions. Since Biome only modifies whitespace, import order, and auto-fixable lint patterns, regression risk is low — but CI must confirm.

---

## Assumptions

1. **Biome version**: The `@biomejs/biome` package is installed without a version pin (`bun add -D @biomejs/biome`), as resolved in CL-03 during clarification. The registry resolves the latest stable version at install time. The resolved version is recorded in `biome.json`'s `$schema` URL (e.g., `"https://biomejs.dev/schemas/X.Y.Z/schema.json"`). CI uses `bun install --frozen-lockfile` to ensure deterministic builds. ADR-0008 governs platform SemVer (product_version, schema_version) — it does not mandate pinning of tooling devDependencies.
2. **`noConsole` violations**: Existing `console.log` calls are assumed to exist in source files (not test files). All must be replaced with the structured logger from `packages/logger`. Test files may use `console` sparingly via a Biome override if necessary.
3. **Vue file support**: Biome's Vue embedded script analysis covers `<script>` and `<script setup>` blocks. Template blocks and CSS blocks are not processed by Biome and remain outside scope.
4. **No per-package config**: No application or package in the monorepo has a legitimate need for a Biome configuration that differs from the root. Any discovered exception requires an ADR-level justification before it can be introduced.
5. **lint-staged compatibility**: The existing `lint-staged.config.mjs` will be updated to invoke Biome instead of ESLint/Prettier for pre-commit hooks.
6. **CI runner**: CI runs Biome via `bun biome` using the project's standard Bun runtime — no separate Node.js invocation is required.

---

## ADR References

| ADR      | Relevance                                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-0001 | Monorepo structure — Biome operates from the root consistent with this decision                                                                          |
| ADR-0008 | Versioning strategy — governs platform SemVer (product_version, schema_version); does not mandate npm devDependency pinning (see Assumption 1 and CL-03) |

No new ADR is required for this stage. The toolchain replacement does not alter any architectural boundary or governance contract.

---

## Constitutional Alignment Summary

| Constitutional Principle                      | Alignment                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Trust chain: Isolation → License → Auth → ... | Unaffected; tooling has no presence in the trust chain                                           |
| Database-per-tenant isolation                 | Unaffected                                                                                       |
| License middleware on all workspace routes    | Unaffected                                                                                       |
| Attempt configuration snapshot immutability   | Unaffected                                                                                       |
| Server-authoritative time                     | Unaffected                                                                                       |
| No row-based multi-tenancy                    | Unaffected                                                                                       |
| Structured logging (no console.log)           | ✅ Enforced — `noConsole` rule enforces this architectural rule at linting layer                 |
| Import boundary rules                         | ✅ Reinforced — import organizer normalizes import style; AI-Guard enforces boundary correctness |

---

## Exit Conditions

This stage is complete when all of the following are true:

- [ ] `bun biome check .` exits with code `0` on the full repository
- [ ] `bun biome format --check .` exits with code `0` on the full repository
- [ ] No ESLint or Prettier dependency exists in any `package.json`
- [ ] No ESLint or Prettier configuration file exists in the repository
- [ ] CI pipeline includes blocking Biome check and format gates positioned before AI-Guard
- [ ] `.vscode/extensions.json` recommends the Biome extension
- [ ] `lint-staged.config.mjs` uses Biome hooks in place of ESLint/Prettier
- [ ] All existing Vitest tests continue to pass after the migration
- [ ] Developer documentation reflects the new `bun biome` commands

---

## Clarifications

### Session 2026-03-06

- Q: Which CI workflow files should receive Biome gates? → A: Add Biome gates to `ci.yml` **only**. The `architecture-governance.yml` and `hard-mode-guard.yml` workflows operate on architecture/spec governance concerns and must **not** be modified to include code-style enforcement.

- Q: Should the `packages/logger` package be exempt from the `noConsole` lint rule given it wraps `console.*` internally? → A: Yes. `packages/logger` requires a `biome.json` override to disable `noConsole` for its own source files — the rule `packages/logger/**/*.ts` must have `noConsole: "off"`. All **other** packages must replace `console.log` usages with `@zidney/logger` structured logging calls before running `biome check` with `noConsole` enabled. A migration pass addressing existing violations must be completed first.

- Q: Should Biome be installed with a pinned version or as latest-stable, and how should the version be recorded? → A: Install `@biomejs/biome` **without** a version pin (`bun add -D @biomejs/biome`). The resolved version is recorded in the `$schema` URL inside `biome.json` (e.g., `"https://biomejs.dev/schemas/X.Y.Z/schema.json"`). No hardcoded version string in `package.json` — the registry resolves latest stable at install time.

- Q: How should `lint-staged` be updated as part of this migration? → A: Update `lint-staged.config.mjs` to use `bun biome check --apply` (safe fixes only) for `.ts`, `.js`, `.tsx`, `.jsx`, `.mjs`, `.vue`, and `.json` files. Remove all ESLint and Prettier lint-staged entries entirely. **NOTE (corrected at Analyze Gate):** `--apply` prevents silent staged-code mutation in pre-commit; `--apply-unsafe` is reserved for explicit developer invocation (`bun biome check --apply-unsafe .`) and must NOT be the default pre-commit hook behavior.

- Q: The stage specification sets line width to 100, but current Prettier configuration uses 80. How should this discrepancy be handled? → A: Line width 100 is intentional per the stage specification. A full reformatting pass (`bun biome format --write .`) is executed as part of the migration. This will produce a large diff on the initial commit, which is expected and acceptable. The change must be documented explicitly in the PR description.

### Session 2026-03-06 (Analyze Gate Remediation)

- Q: FR-09 acceptance criterion states "AI-Guard is not triggered before Biome passes" and implies AI-Guard runs as a dedicated CI job after the Biome lint gate. However, the codebase shows AI-Guard runs only via `lint-staged` pre-commit hooks and the `architecture-governance.yml` workflow — there is no `ai-guard` step inside `ci.yml`. How should the ordering contract be enforced? → A: **Clarification — enforcement model is pre-commit + architecture governance, not inline `ci.yml` step.** The CI pipeline sequence `Biome → AI-Guard → Vitest` is enforced as follows: (1) Biome runs in `ci.yml` as the `lint` job; (2) AI-Guard enforcement runs via `lint-staged` pre-commit hooks (blocking developer pushes) and via `architecture-governance.yml` (which has `needs: [lint]` dependency on the Biome lint job, satisfying the ordering constraint); (3) Vitest runs in the `test` job which also `needs: [lint]`. The ordering contract is therefore met through the existing workflow dependency graph. No new `ai-guard` step should be added to `ci.yml` — doing so would duplicate enforcement and conflict with the existing architecture governance workflow design. FR-09 acceptance criterion "AI-Guard is not triggered before Biome passes" is satisfied because `architecture-governance.yml` already declares `needs: [lint]`.
