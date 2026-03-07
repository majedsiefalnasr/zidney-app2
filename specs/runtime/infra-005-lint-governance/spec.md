# Specification: Lint Governance — Architecture Enforcement and Pre-Commit Pipeline

**Feature ID:** `infra-005-lint-governance`
**Phase:** `01_PLATFORM_FOUNDATION`
**Stage File:** `specs/phases/01_platform_foundation/STAGE_INFRA_05_LINT_GOVERNANCE.md`
**Stage Status:** DRAFT → IN PROGRESS
**Type:** Infrastructure Governance (non-feature)
**Branch:** `spec/infra-005-lint-governance`
**Initiated:** 2026-03-07T00:00:00Z
**Spec Author:** SpecKit (speckit.specify)
**Depends On:** `infra-004-biome` (STAGE_INFRA_04_BIOME — must be complete)

---

## Feature Overview

### What Is Being Established

This stage establishes a strict **lint governance layer** over the Zidney monorepo. Where `infra-004-biome` replaced ESLint and Prettier with Biome as the unified linting engine, this stage activates and hardens the full governance pipeline that sits on top of Biome.

The work covers:

- Hardening the Biome lint rule set (configuring error-level rules for correctness and style violations)
- Configuring and activating AI-Guard (`scripts/ai-guard.ts`) as an architectural boundary enforcer
- Establishing explicit import order governance enforced by Biome's import organizer
- Activating and verifying lint-staged pre-commit hooks to run Biome and AI-Guard before every commit
- Verifying and enforcing the CI quality-gate sequence: `bun run lint` → `bun run type-check` → `bun scripts/ai-guard.ts`
- Documenting the multi-layer governance model for developers and AI agents
- Defining module ownership rules and critical module protection policy
- Establishing a drift prevention strategy anchored to the architecture intelligence layer

### Phase Mapping

- Phase: `01_PLATFORM_FOUNDATION`
- This stage directly follows `infra-004-biome` and completes the developer governance toolchain.
- It is a prerequisite for all subsequent feature development stages — no feature may start until lint governance is enforced.

### Governance Layers (Authoritative)

```
Layer 1: Biome
  → Formatting, lint rules, import hygiene
  → Runs: pre-commit (lint-staged), CI gate

Layer 2: AI-Guard (scripts/ai-guard.ts)
  → Architecture boundaries, dependency graph, module ownership
  → Runs: pre-commit hook, CI gate

Layer 3: Infra Audit (scripts/infra-audit.ts)
  → Repository health, dependency graph integrity, architecture drift
  → Runs: manually, CI (full audit)

Layer 4: Tests (Vitest, Playwright)
  → Behavioral correctness
  → Runs: CI, developer local
```

Each layer is additive. A violation in any layer blocks the commit or CI run.

### Impact on Existing Systems

| Area                | Impact                                                                                |
| ------------------- | ------------------------------------------------------------------------------------- |
| Isolation           | None — no data access model changes                                                   |
| License enforcement | None — middleware untouched                                                           |
| Attempt engine      | None — no behavioral changes                                                          |
| Worker              | None — logic untouched; only code style/architecture enforcement applied              |
| Runtime             | None — no operational behavior changes                                                |
| Frontoffice         | Included in scope; lint governance applies to `.ts`/`.vue` files                      |
| Database            | None — no schema or migration changes                                                 |
| CI Pipeline         | **Affected** — lint gate, AI-Guard gate, and type-check gate all enforced as blocking |
| Pre-commit hooks    | **Affected** — lint-staged hook upgraded; AI-Guard hook activated                     |

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

This is a developer toolchain governance change only. No runtime behavior, no API logic, and no database schema is modified. All governance tooling operates exclusively on source files during development and CI — nothing is deployed to production artifacts.

**Architecture impact:** Architectural governance artifacts (`ARCHITECTURE_CONTRACT.json`, `ARCHITECTURE_MAP.json`, `ai-architecture-brain.json`) are read by AI-Guard. This stage validates and activates their use. If any of these files are missing or stale, the governance pipeline will emit warnings and fail CI. Regenerating them with `bun run arch:audit` is the resolution path.

---

## Purpose

The Biome stage (`infra-004`) established formatting and basic linting. However, governance is incomplete without:

1. **Architecture boundary enforcement at commit time** — AI-Guard must actively block code that violates module boundaries before it enters the repository.
2. **A documented and verified pre-commit hook sequence** — developers must get instant, actionable feedback before code reaches CI.
3. **Import order governance** — consistent import ordering across the monorepo prevents noisy diffs and signals intent clearly.
4. **Critical module protection** — changes to core packages (`packages/domain-core`, `packages/logger`, `packages/types`) must be flagged for stricter review.
5. **CI gate completion** — the CI pipeline must enforce all three gates (`lint`, `type-check`, `ai-guard`) as blocking conditions.

Without this stage, architecture drift can enter the repository undetected. With it, drift becomes immediately visible at the point of authorship.

**Core Philosophy Alignment:**

| Principle                                  | How This Stage Upholds It                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| Stability over speed                       | Blocking violations at commit time is slower than no check, but prevents regressions |
| Determinism over magic                     | Every commit passes through an identical, documented validation pipeline             |
| Explicit governance over implicit behavior | Boundary rules are declared in `ARCHITECTURE_CONTRACT.json`, not inferred            |
| Isolation over convenience                 | Cross-app imports are forbidden by an automated check, not a developer convention    |

---

## Objectives

1. Activate AI-Guard as a **mandatory pre-commit gate** that blocks architecture violations at the point of authorship.
2. Harden Biome's lint rule set to `error` level for all critical correctness and style violations.
3. Verify and document the import ordering convention enforced by Biome's import organizer.
4. Ensure the pre-commit hook runs both `lint-staged` (Biome) and AI-Guard in sequence.
5. Enforce a CI quality-gate sequence: Biome lint → TypeScript type-check → AI-Guard — all blocking.
6. Document the four-layer governance model for developers and AI agents.
7. Define module ownership policy for critical platform infrastructure packages.
8. Establish `bun run arch:audit` as the drift-recovery command.

---

## User Stories

### US-01 — Developer: Catch Violations Before Commit

> As a developer, I want lint violations, import errors, and architecture boundary violations to be caught and reported automatically before my commit is recorded, so that I never accidentally push broken or non-compliant code.

**Acceptance Criteria:**

- When I run `git commit`, lint-staged runs Biome checks on staged files first.
- If Biome finds a lint error or formatting deviation, the commit is blocked with a clear error message.
- After Biome passes, AI-Guard runs against staged files.
- If AI-Guard detects an architecture boundary violation, the commit is blocked with the violated rule reported.
- All feedback is displayed in the terminal within seconds — no web UI required.

---

### US-02 — Developer: Catch Violations in CI Before Merge

> As a developer, I want the CI pipeline to enforce the same lint, type-check, and architecture checks that run locally, so that a passing CI run guarantees no governance violations have been merged.

**Acceptance Criteria:**

- CI runs `bun run lint` and fails if any Biome violation is found.
- CI runs `bun run type-check` and fails if any TypeScript error is found.
- CI runs `bun scripts/ai-guard.ts` and fails if any architecture boundary violation is found.
- All three gates are **blocking** — a failing gate prevents merge.
- Each gate reports failures with sufficient detail to diagnose without local reproduction.

---

### US-03 — Developer: Understand Import Order Requirements

> As a developer, I want a documented and automatically enforced import ordering convention, so that I do not have to manually manage import order and reviews are not cluttered with import ordering noise.

**Acceptance Criteria:**

- Running `bun run lint:fix` on any file automatically sorts imports into the correct order.
- The import order convention is documented in this spec.
- No PR review comment about import order is required — the tool enforces it.

---

### US-04 — Developer: Know Which Modules Are Critically Protected

> As a developer (or AI agent generating code), I want to know which packages are considered critical infrastructure, so that I understand why changes to those modules require extra care and architectural review.

**Acceptance Criteria:**

- Critical infrastructure modules are listed in this spec.
- The module ownership policy is documented — including what additional checks apply.
- The policy is machine-readable in `ARCHITECTURE_MAP.json`.

---

### US-05 — Developer: Recover from Architecture Drift

> As a developer, I want a single, documented command that detects and reports architecture drift, so that I can verify the codebase health at any time and recover from a stale architecture intelligence index.

**Acceptance Criteria:**

- `bun run arch:audit` runs the infra audit and reports any drift.
- The output identifies drifted modules and violated dependencies.
- If the architecture intelligence layer is stale, the output instructs the developer how to regenerate it.

---

## Functional Requirements

### FR-01: Biome Lint Rule Hardening

All critical Biome lint rules must be set to `error` severity (not `warn`) in `biome.json`. The following rules must be enforced at error level:

| Rule              | Category    | Rationale                                            |
| ----------------- | ----------- | ---------------------------------------------------- |
| `noUnusedImports` | correctness | Dead imports pollute the module graph                |
| `noDebugger`      | suspicious  | Debugger statements must never appear in production  |
| `noConsole`       | suspicious  | Structured logging via Pino is mandatory; no console |
| `useConst`        | style       | Prevents accidental mutation via `let`               |
| `noUnreachable`   | correctness | Unreachable code signals logic errors                |

Rules currently configured at `warn` level that should remain at `warn` (not promoted to error in this stage):

| Rule                        | Category    | Rationale for keeping as warn                                |
| --------------------------- | ----------- | ------------------------------------------------------------ |
| `noPrecisionLoss`           | correctness | Precision issues may be intentional in some numeric contexts |
| `noImplicitAnyLet`          | suspicious  | TypeScript strict mode handles this at type level            |
| `useIterableCallbackReturn` | suspicious  | Low-impact; TypeScript covers most cases                     |

**Acceptance Criterion:** `bun run lint` exits code `0`; violations of error-level rules fail the run with a non-zero exit code and print the violated rule and file location.

**Exceptions:** Files listed in `biome.json` overrides retain their overridden rule set. Specifically:

- `packages/logger`, `apps/worker/src/observability/structured-logger.ts`, and migration files are exempt from `noConsole` (they provide the console-replacement or require it for migration tooling).
- Test files (`tests/**`, `**/*.test.ts`, `**/*.spec.ts`) are exempt from `noConsole` for debugging convenience.

---

### FR-02: Import Order Convention Enforcement

Biome's import organizer must be enabled (it is already enabled via `biome.json`). The canonical import order for all TypeScript and Vue files in the monorepo is:

```
1. Node.js built-ins          (e.g., import fs from 'node:fs')
2. External dependencies      (e.g., import { z } from 'zod')
3. Internal monorepo packages (e.g., import { Logger } from '@zidney/logger')
4. App-local modules          (e.g., import { tenantResolver } from './core/tenant')
5. Relative imports           (e.g., import { helper } from './utils')
```

Each group must be separated by a blank line. Biome's formatter enforces this separation automatically when `biome format --write` is run.

**Acceptance Criterion:** Running `bun run lint:fix` on any file in scope produces correctly ordered imports with group separators; `bun run lint` on the same file exits `0` with no import-order violations.

---

### FR-03: AI-Guard Pre-Commit Activation

The `.husky/pre-commit` hook must invoke `bun scripts/ai-guard.ts` after `lint-staged` completes. The hook execution order is:

```sh
# Step 1: Biome (via lint-staged)
bunx lint-staged

# Step 2: AI-Guard architecture boundary validation
bun scripts/ai-guard.ts
```

AI-Guard enforces the following rules on **staged files only** (not the full repository):

| Rule Type              | Description                                                            |
| ---------------------- | ---------------------------------------------------------------------- |
| Cross-app imports      | `apps/*` must not import from other `apps/*`                           |
| Package-to-app imports | `packages/*` must not import from `apps/*`                             |
| Architecture map       | Module dependencies must comply with `ARCHITECTURE_MAP.json`           |
| Dependency contract    | Forbidden dependencies in `ARCHITECTURE_CONTRACT.json` must not appear |
| Relative path leaks    | Relative paths must not reference other packages or apps directly      |

If any violation is detected, the commit is blocked and the violated rule is printed to the terminal.

**Acceptance Criterion:** A commit that introduces a cross-app import is blocked by AI-Guard with a printed violation message; a clean commit passes through without intervention.

---

### FR-04: lint-staged Configuration Verification

The `lint-staged.config.mjs` must configure Biome to run on all staged JavaScript, TypeScript, Vue, and JSON files:

```js
export default {
  '*.{ts,tsx,js,jsx,mjs,vue,json}': ['bun biome check --write'],
}
```

`--write` enables auto-fix for formatting and safe lint fixes. If a violation cannot be auto-fixed, lint-staged exits non-zero and the commit is blocked.

**Acceptance Criterion:** Staging a file with a lint violation and running `git commit` causes the commit to be blocked at the lint-staged step with the violation reported.

---

### FR-05: CI Gate — Lint, Type-Check, AI-Guard (All Blocking)

The CI pipeline must run all three quality gates as blocking steps for every pull request and merge:

| Step | Command                   | Failure Behavior                     |
| ---- | ------------------------- | ------------------------------------ |
| 1    | `bun run lint`            | Fail CI run; print Biome violations  |
| 2    | `bun run type-check`      | Fail CI run; print TypeScript errors |
| 3    | `bun scripts/ai-guard.ts` | Fail CI run; print arch violations   |

All three steps must pass before any merge is allowed. No gate may be skipped or marked as non-blocking.

**Acceptance Criterion:** Introducing a lint violation, a type error, or an architecture boundary violation in a PR causes CI to fail at the corresponding gate; a clean PR passes all three gates.

---

### FR-06: Architecture Intelligence Layer Validation

The architecture intelligence layer (`docs/ai/context/ai-architecture-brain.json`, `docs/architecture/intelligence/ARCHITECTURE_MAP.json`, `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json`) must exist and be current.

If these files are absent or stale, AI-Guard will fall back to reading `ARCHITECTURE_CONTRACT.json` directly without brain enrichment. This is accepted as a degraded-mode fallback.

The recommended regeneration command is:

```sh
bun run arch:audit
```

This command is an alias for `bun scripts/infra-audit.ts` and regenerates all architecture intelligence artifacts.

[NEEDS CLARIFICATION: Should `bun run arch:audit` be added as a mandatory CI step that checks for staleness, or should AI-Guard's fallback to direct contract reading be considered sufficient for CI?]

**Acceptance Criterion:** `docs/architecture/intelligence/ARCHITECTURE_MAP.json` and `ARCHITECTURE_CONTRACT.json` exist in the repository. AI-Guard runs without fatal errors in both brain-enriched and fallback modes.

---

### FR-07: Module Ownership Policy — Critical Infrastructure Packages

The following packages are designated **critical infrastructure** and require elevated review for any structural change:

| Package                | Why Critical                                                            |
| ---------------------- | ----------------------------------------------------------------------- |
| `packages/domain-core` | Contains all business logic, tenant resolution, and migration execution |
| `packages/logger`      | Platform-wide structured logging dependency — all services use it       |
| `packages/types`       | Shared TypeScript types — changes break across all apps and packages    |

For changes to these packages, the following protections apply:

1. AI-Guard architecture validation runs as normal (already enforced).
2. `bun run arch:audit` must pass (manually or in CI) after changes.
3. A human architecture reviewer must approve the PR — AI-generated changes to these modules must be flagged.

[NEEDS CLARIFICATION: Should CODEOWNERS entries be created for `packages/domain-core`, `packages/logger`, and `packages/types` to enforce mandatory human review via GitHub's branch protection rules? If yes, this becomes a Git governance task in addition to tooling governance.]

This policy is documentation-level in this spec. Machine-readable enforcement is tracked in `ARCHITECTURE_MAP.json` — any module defined there with an `owner` field is subject to extended review policy.

**Acceptance Criterion:** The three critical packages are identified in this spec and their protections documented. `ARCHITECTURE_MAP.json` reflects their criticality via the `owner` or `critical` field if supported by the schema.

---

### FR-08: Pre-Push Hook — Non-Blocking Informational Gate

The `.husky/pre-push` hook currently runs informational checks only. This stage validates that the hook does not block push by default, but documents the recommended developer workflow:

- Before pushing, run `bun run lint && bun run type-check` locally.
- CI enforces the full gate; the pre-push hook is advisory only.

If the pre-push hook already has lint/type-check gates enabled, this requirement is a no-op.

**Acceptance Criterion:** The pre-push hook exists and does not prevent pushing; its purpose and non-blocking nature are documented for developers.

---

### FR-09: Drift Prevention Strategy Documentation

The drift prevention strategy must be documented for all contributors (human and AI). The canonical strategy is:

```
1. Author writes code.
2. git commit triggers:
   a. lint-staged → Biome check --write (auto-fix formatting, block on lint errors)
   b. AI-Guard → checks staged files against architecture boundaries
3. CI checks:
   a. bun run lint (full codebase)
   b. bun run type-check
   c. bun scripts/ai-guard.ts (full staged set in CI context)
4. Merge gated on all CI checks passing.
5. Post-merge: bun run arch:audit runs on schedule to detect any drift
   that slipped through (e.g., generated files outside the commit hook).
```

**Acceptance Criterion:** The strategy is documented in this spec (this section is the documentation). A developer or AI agent reading this spec can understand the complete validation pipeline.

---

## Non-Functional Requirements

### NFR-01: Pre-Commit Latency

The combined lint-staged + AI-Guard pre-commit hook must complete within **15 seconds** for a typical commit of 1–10 files. Biome's Rust-based execution makes this achievable; AI-Guard operates on staged files only (not the full repository).

### NFR-02: No New Runtime Dependencies

This stage must not introduce any runtime dependency. All tooling (Biome, AI-Guard, Husky, lint-staged) is `devDependency`-scoped.

### NFR-03: No Business Logic Changes

This is an INFRA stage. No changes to any API route handler, domain logic, migration, or tenant resolver are permitted.

### NFR-04: Idempotent Governance Tooling

Running `bun run lint` repeatedly on a clean codebase must always exit `0`. Running `bun scripts/ai-guard.ts` on a clean staged set must always exit `0`. Governance tooling must not have side effects that cause subsequent runs to fail.

### NFR-05: Monorepo-Wide Scope

All lint and architecture governance applies to the full monorepo. No package or app is exempt from the Biome rule set, except where explicit overrides appear in `biome.json` (already defined in `infra-004-biome`). No app-level Biome config file may override the root config.

### NFR-06: `bun` as Exclusive Package Manager

All commands must use `bun` (not `npm`, `yarn`, or `pnpm`). This is a project-wide Hard Rule. Scripts, CI steps, and hooks must all call `bun` directly.

---

## Isolation Impact Analysis

This stage has **no tenant isolation impact**. Confirmed:

- No database is accessed by any governance tooling.
- Tenant resolver is not involved.
- Connection pool is not instantiated.
- No shared tenant data is introduced or referenced.
- No new tables are created.

Governance tooling operates entirely at the source code level and has no presence in deployed artifacts.

---

## License & Version Enforcement

This stage has **no license enforcement requirements**. Confirmed:

- License middleware is not involved.
- No license state affects governance tooling behavior.
- No `schema_version` or `product_version` check applies.
- Governance tooling is not workspace-bound.

---

## Data Model Changes

**None.** This stage introduces no database tables, no migration files, and no schema changes. No version bump is required.

---

## Layer Separation Confirmation

| Rule                                    | Status       |
| --------------------------------------- | ------------ |
| Frontend contains no business logic     | ✅ Confirmed |
| API contains no grading logic           | ✅ Confirmed |
| Worker contains no HTTP logic           | ✅ Confirmed |
| MMC does not access tenant DB           | ✅ Confirmed |
| No direct DB creation outside provision | ✅ Confirmed |

This stage modifies only developer toolchain configuration files and documentation. No layer separation is violated or affected.

---

## Out of Scope

The following items are explicitly excluded from this stage:

| Item                                             | Reason                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| CODEOWNERS file creation                         | Requires Git governance decision outside this stage scope                                |
| ESLint re-introduction                           | ESLint was removed in `infra-004-biome`; this stage does not revisit that                |
| Biome rule additions beyond what is defined here | Additional rules are a separate governance decision                                      |
| Any new Biome plugin or external rule set        | No new dependencies allowed                                                              |
| Custom CI runner or workflow changes             | CI workflow file changes are out of this spec's scope unless needed for gate enforcement |
| Branch protection rules in GitHub                | External Git governance, not monorepo toolchain governance                               |
| Vitest configuration changes                     | Testing governance is a separate stage                                                   |
| Performance profiling of pre-commit hooks        | Out of scope; latency NFR is the only performance concern                                |

---

## Assumptions

1. `infra-004-biome` is complete: `biome.json` exists at the repository root, `@biomejs/biome` is installed, and `bun run lint` / `bun run lint:fix` are operational.
2. Husky is installed and `prepare` script is registered in `package.json` (confirmed in root `package.json`).
3. `lint-staged` is installed as a `devDependency` (confirmed in root `package.json`).
4. The architecture intelligence files (`ARCHITECTURE_CONTRACT.json`, `ARCHITECTURE_MAP.json`) exist in `docs/architecture/intelligence/`. If absent, they must be generated with `bun run arch:generate` before this stage completes.
5. `scripts/ai-guard.ts` is the authoritative architecture boundary enforcement script. It reads `ARCHITECTURE_CONTRACT.json` and optionally `ai-architecture-brain.json`. No modifications to the script are required in this stage — only its activation in the pre-commit hook is in scope.
6. The current `biome.json` overrides (logger, migrations, test files exempted from `noConsole`) are preserved without change.
7. The pre-push hook is advisory only — its role does not change in this stage.

---

## Dependencies

| Dependency                         | Type     | Status Required                                 |
| ---------------------------------- | -------- | ----------------------------------------------- |
| `infra-004-biome` (STAGE_INFRA_04) | Stage    | **Must be COMPLETE** before this stage begins   |
| `@biomejs/biome` (devDependency)   | Package  | Must be installed at `^2.4.6` or compatible     |
| `husky` (devDependency)            | Package  | Must be installed at `^9.0.0` or compatible     |
| `lint-staged` (devDependency)      | Package  | Must be installed at `^15.0.0` or compatible    |
| `ARCHITECTURE_CONTRACT.json`       | Artifact | Must exist at `docs/architecture/intelligence/` |
| `ARCHITECTURE_MAP.json`            | Artifact | Must exist at `docs/architecture/intelligence/` |

---

## Risk Assessment

| Risk                                                   | Probability | Impact | Mitigation                                                                      |
| ------------------------------------------------------ | ----------- | ------ | ------------------------------------------------------------------------------- |
| Existing baseline lint violations stall activation     | Medium      | High   | Run `bun run lint:fix` first to auto-fix; manually resolve remaining errors     |
| AI-Guard false positive blocks legitimate commits      | Low         | Medium | Review `ARCHITECTURE_MAP.json` allowed dependencies; update if a rule is wrong  |
| Architecture intelligence files absent or stale        | Medium      | Medium | Run `bun run arch:audit` to regenerate; AI-Guard has a documented fallback mode |
| Large commits (many files) cause slow pre-commit hook  | Low         | Low    | lint-staged operates on staged files only; AI-Guard scope is similarly limited  |
| Biome version incompatibility with `biome.json` schema | Low         | Medium | Pin `@biomejs/biome` version in `package.json`; test after any upgrade          |
| Developer bypasses hooks with `--no-verify`            | Low         | High   | CI gates enforce the same rules; bypass locally still fails at PR check         |
| Critical package change not caught without CODEOWNERS  | Medium      | High   | Document module ownership policy; CODEOWNERS is a follow-up governance task     |

---

## Test Strategy

This is an infrastructure tooling stage. The test strategy focuses on verifying governance tooling itself rather than business logic.

### Pre-Commit Hook Tests (Manual Verification)

- **TC-01:** Stage a file with a Biome lint error (e.g., unused import). Run `git commit`. Verify commit is blocked and error is reported.
- **TC-02:** Stage a file with correct code. Run `git commit`. Verify commit succeeds after hooks pass.
- **TC-03:** Stage a file that imports across app boundaries (e.g., `apps/api` importing `apps/frontoffice`). Run `git commit`. Verify AI-Guard blocks the commit with the violation message.
- **TC-04:** Stage a clean file with correct architecture. Run `git commit`. Verify AI-Guard passes without error.

### CI Gate Tests

- **TC-05:** Introduce a Biome lint violation (e.g., `noDebugger`) in a test branch. Verify `bun run lint` exits non-zero and CI fails at the lint gate.
- **TC-06:** Introduce a TypeScript type error in a test branch. Verify `bun run type-check` exits non-zero and CI fails at the type-check gate.
- **TC-07:** Introduce an architecture boundary violation in a test branch. Verify `bun scripts/ai-guard.ts` exits non-zero and CI fails at the AI-Guard gate.
- **TC-08:** Submit a clean branch. Verify all three CI gates pass.

### Import Order Tests

- **TC-09:** Run `bun run lint:fix` on a file with out-of-order imports. Verify imports are reordered into the documented canonical order.
- **TC-10:** Run `bun run lint` on a correctly ordered file. Verify exit code `0`.

### Drift Recovery Test

- **TC-11:** Run `bun run arch:audit`. Verify it completes without fatal errors and regenerates architecture intelligence artifacts.
- **TC-12:** Delete `docs/ai/context/ai-architecture-brain.json`. Run `bun scripts/ai-guard.ts` with staged files. Verify AI-Guard falls back to reading `ARCHITECTURE_CONTRACT.json` directly and still validates boundaries.

---

## Success Criteria

All of the following must be true for this stage to be considered complete:

1. Every developer commit runs Biome and AI-Guard automatically — no manual invocation required.
2. A commit containing a lint violation is blocked before it is recorded.
3. A commit containing an architecture boundary violation is blocked before it is recorded.
4. CI fails (non-zero exit) when a PR introduces a Biome violation, a TypeScript error, or an architecture boundary violation.
5. Import order is automatically enforced across the monorepo — no manual import ordering is needed.
6. The module ownership policy for critical infrastructure packages is documented and discoverable.
7. `bun run arch:audit` runs and produces a valid architecture intelligence report without fatal errors.
8. A developer reading this spec can understand the complete governance pipeline without additional context.

---

## Glossary

| Term                                | Definition                                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Biome**                           | The unified linting, formatting, and import organization tool used in the Zidney monorepo (`@biomejs/biome`)                                         |
| **AI-Guard**                        | `scripts/ai-guard.ts` — validates architecture boundaries by analyzing staged file imports against the architecture contract and map                 |
| **lint-staged**                     | A tool that runs configured checks only on Git-staged files, enabling fast pre-commit validation                                                     |
| **Husky**                           | Git hooks manager that installs `.husky/pre-commit` and `.husky/pre-push` hooks                                                                      |
| **Architecture Contract**           | `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` — machine-readable declaration of forbidden dependency and layer rules                   |
| **Architecture Map**                | `docs/architecture/intelligence/ARCHITECTURE_MAP.json` — mapping of modules to their declared allowed and forbidden dependencies                     |
| **Architecture Brain**              | `docs/ai/context/ai-architecture-brain.json` — enriched architecture intelligence produced by `infra-audit.ts`; preferred by AI-Guard when available |
| **Infra Audit**                     | `scripts/infra-audit.ts` — regenerates all architecture intelligence artifacts and produces `infra-audit-report.json`                                |
| **Drift**                           | The state where the live codebase diverges from the declared architecture contract in `ARCHITECTURE_MAP.json`                                        |
| **Critical Infrastructure Package** | A shared package whose changes have platform-wide blast radius: `packages/domain-core`, `packages/logger`, `packages/types`                          |
| **Import Organizer**                | Biome's built-in feature that automatically sorts and groups imports according to the canonical import order                                         |
| **CI Gate**                         | A blocking step in the continuous integration pipeline that must pass before a merge is allowed                                                      |
| **Pre-commit Hook**                 | A script executed by Git before recording a commit; managed by Husky in this project                                                                 |
| **`bun`**                           | The JavaScript runtime and package manager used across the entire Zidney monorepo                                                                    |
