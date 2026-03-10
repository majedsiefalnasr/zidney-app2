# Feature Specification: Module Boundary Enforcement

**Feature Branch**: `spec/infra-007-module-boundaries` **Stage**: `STAGE_INFRA_07_MODULE_BOUNDARIES`
**Phase**: `01_PLATFORM_FOUNDATION` **Stage File**:
`specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_07_MODULE_BOUNDARIES.md` **Created**: 2026-03-08
**Status**: Draft

---

## Overview

This stage formalizes **explicit module ownership and dependency boundaries** across the Zidney
monorepo. It introduces a machine-readable boundary map (`docs/architecture/module-boundaries.json`)
that is consumed by `ai-guard.ts` and `infra-audit.ts` to automatically detect and block
architecture violations.

The boundary map defines every module's architectural layer, what it is allowed to depend on, and
what it is forbidden from importing. Once this map exists, architectural integrity becomes
mechanically enforceable — no module can silently cross a boundary without a CI or pre-commit
failure.

This stage does **not** introduce runtime behavior changes, business logic, or tenant isolation
constructs. It is a pure infrastructure governance stage.

---

## Scope

### In Scope

- Classifying all 13 monorepo modules into one of four architectural layers: `infrastructure`,
  `domain`, `runtime`, `ui`
- Producing `docs/architecture/module-boundaries.json` — the canonical machine-readable boundary map
- Defining the allowed and forbidden dependency matrix for each layer
- Defining per-module allowed and forbidden dependency overrides where needed
- Extending `scripts/ai-guard.ts` to load and validate imports against `module-boundaries.json`
- Adding a `module-boundary-validation` CI step that runs `bun run ai-guard`
- Documenting a workflow for registering new modules in the boundary map
- Aligning the boundary map format with the existing `ARCHITECTURE_MAP.json` so both files
  complement each other

### Out of Scope

- Changes to business logic in any `apps/*` or `packages/*` module
- Tenant isolation, license enforcement, or attempt engine behavior
- Any new npm packages or runtime dependencies
- Modifying existing migration files
- Changing test infrastructure

---

## Developer Scenarios & Testing

> Developer = the "user" for an INFRA stage. Success is measured by developer experience and machine
> enforcement.

### Scenario 1 — Developer Adds a Forbidden Import (Priority: P1)

A developer working on `apps/mmc` accidentally imports a function directly from `apps/api`
internals. They run `bun run ai-guard` locally before committing.

**Why this priority**: Prevents the most critical class of architecture violation — cross-app
imports that couple independent runtimes.

**Independent Test**: Can be fully tested by adding a forbidden import to a test fixture and
verifying `ai-guard` exits non-zero with a descriptive error.

**Acceptance Scenarios**:

1. **Given** `apps/mmc/src/foo.ts` contains `import { bar } from 'apps/api/src/bar'`, **When**
   `bun run ai-guard` is run, **Then** the tool exits with code 1 and prints
   `ARCHITECTURE VIOLATION — cross-app import: apps/mmc → apps/api`.
2. **Given** the same file, **When** a CI pipeline runs `bun run ai-guard`, **Then** the pipeline
   stage fails and the error is visible in the CI log.
3. **Given** the developer removes the forbidden import, **When** `bun run ai-guard` is run again,
   **Then** the tool exits with code 0.

---

### Scenario 2 — Developer Introduces a Layer Violation (Priority: P1)

A developer extending `packages/ui-system` accidentally imports from `packages/domain-core`.

**Why this priority**: UI packages must remain presentation-only; coupling them to domain logic
creates hidden complexity and breaks the layering model.

**Independent Test**: Add a domain import in a `packages/ui-system` fixture file. Run
`bun run ai-guard`. Verify failure.

**Acceptance Scenarios**:

1. **Given** `packages/ui-system/src/Button.vue` contains
   `import { someRule } from 'packages/domain-core'`, **When** `bun run ai-guard` is run, **Then**
   the tool reports a layer violation with the module names, source layer, and target layer.
2. **Given** a new module is added to `packages/` without being registered in
   `module-boundaries.json`, **When** `bun run infra-audit` is run, **Then** the audit warns that
   the module is undeclared.

---

### Scenario 3 — New Module Onboarding (Priority: P2)

A developer creates a new package `packages/notifications`. They need to register it in the boundary
map before CI will pass.

**Why this priority**: Module registration is a governance gate. Without it, new code exists outside
the enforcement system.

**Independent Test**: Add a new package directory, run `bun run ai-guard`, verify the tool produces
an undeclared-module warning. Then add the module to `module-boundaries.json` and verify the warning
disappears.

**Acceptance Scenarios**:

1. **Given** `packages/notifications` exists on disk but is not in `module-boundaries.json`,
   **When** `bun run infra-audit` is run, **Then** the audit reports
   `undeclared module: packages/notifications`.
2. **Given** the developer adds `packages/notifications` to `module-boundaries.json` with
   `layer: "domain"`, **When** `bun run infra-audit` is run again, **Then** no undeclared-module
   warning is produced.
3. **Given** the module is registered, **When** `packages/notifications` imports from `apps/api`,
   **Then** `bun run ai-guard` reports a boundary violation.

---

### Edge Cases

- What happens when a module imports from an external npm package (not a monorepo module)? →
  External packages are not tracked; only monorepo paths (`packages/*`, `apps/*`, `@zidney/*`) are
  validated.
- What happens when `module-boundaries.json` is missing? → `ai-guard.ts` must fail with a clear
  error: `module-boundaries.json not found — cannot validate boundaries`.
- What happens when a module has zero allowed dependencies? → The tool must not falsely flag imports
  of external npm packages; only internal monorepo imports are subject to boundary rules.
- What if a developer uses a TypeScript path alias (`@zidney/logger`)? → `ai-guard.ts` must resolve
  aliases defined in `tsconfig.json` before evaluating boundaries.

---

## Functional Requirements

### FR-001 — Boundary Map File Exists

The file `docs/architecture/module-boundaries.json` MUST exist in the repository root. It MUST be
parseable as valid JSON. `ai-guard.ts` MUST fail with a clear error if the file is missing or
malformed.

### FR-002 — All 13 Modules Classified

The boundary map MUST classify all 13 current monorepo modules. An unclassified module MUST cause
`infra-audit.ts` to report a warning.

The 13 modules and their required layer assignments are:

| Module                 | Layer            |
| ---------------------- | ---------------- |
| `packages/logger`      | `infrastructure` |
| `packages/config`      | `infrastructure` |
| `packages/types`       | `infrastructure` |
| `packages/redis-utils` | `infrastructure` |
| `packages/domain-core` | `domain`         |
| `packages/validation`  | `domain`         |
| `packages/ui-system`   | `ui`             |
| `packages/api-client`  | `ui`             |
| `apps/api`             | `runtime`        |
| `apps/worker`          | `runtime`        |
| `apps/mmc`             | `ui`             |
| `apps/backoffice`      | `ui`             |
| `apps/frontoffice`     | `ui`             |

### FR-003 — Layer Dependency Matrix Enforced

The boundary map MUST encode the following allowed dependency flows. `ai-guard.ts` MUST enforce
these rules by inspecting import statements in all `.ts`, `.tsx`, and `.vue` files.

| Source Layer     | May Depend On                                                 | Forbidden Dependencies                                                                         |
| ---------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `infrastructure` | (nothing — no internal monorepo deps)                         | `domain`, `runtime`, `ui`, `apps/*`                                                            |
| `domain`         | `infrastructure`                                              | `runtime`, `ui`, `apps/*`                                                                      |
| `runtime`        | `domain`, `infrastructure`                                    | `ui` apps (`apps/mmc`, `apps/backoffice`, `apps/frontoffice`), `packages/ui-system`            |
| `ui`             | `packages/ui-system`, `packages/api-client`, `infrastructure` | `runtime` internals (`apps/api`, `apps/worker`), `packages/domain-core`, `packages/validation` |

### FR-004 — Cross-App Import Prohibition

No module under `apps/*` MUST import from another module under `apps/*`. This rule applies
regardless of layer. `ai-guard.ts` MUST detect and report cross-app imports independently of the
layer rules.

### FR-005 — Packages Must Not Import Apps

No module under `packages/*` MUST import from any module under `apps/*`. `ai-guard.ts` MUST enforce
this rule.

### FR-006 — TypeScript Alias Resolution

`ai-guard.ts` MUST resolve TypeScript path aliases (e.g., `@zidney/logger` → `packages/logger`)
before evaluating boundary rules. Aliases are defined in `tsconfig.json` and `tsconfig.base.json`.

### FR-007 — AI-Guard Reads module-boundaries.json

`scripts/ai-guard.ts` MUST load `docs/architecture/module-boundaries.json` at startup and use it as
the authoritative source for layer classification and allowed/forbidden dependency rules. It MUST
merge or supplement the existing `ARCHITECTURE_MAP.json` rules rather than replacing them.

### FR-008 — Undeclared Module Detection

`scripts/infra-audit.ts` MUST scan `packages/` and `apps/` directories and compare discovered
modules against the entries in `module-boundaries.json`. Any module present on disk but absent from
the boundary map MUST be reported as `undeclared`.

### FR-009 — CI Pipeline Integration

A `module-boundary-validation` step MUST run in the CI pipeline after `lint` and before `tests`. The
step runs `bun run ai-guard`. A non-zero exit code MUST fail the pipeline.

### FR-010 — Developer Local Check

Running `bun run ai-guard` from the repository root MUST perform the full boundary validation. The
command MUST be defined in the root `package.json` scripts. It MUST return exit code 0 on no
violations and exit code 1 on any violation.

### FR-011 — New Module Registration Workflow

When a new module is introduced under `packages/` or `apps/`:

1. The developer assigns it a layer
2. The developer adds it to `docs/architecture/module-boundaries.json`
3. CI validates the entry exists before accepting the PR

Until the entry is added, `infra-audit.ts` reports a blocking undeclared-module warning.

### FR-012 — Violation Error Format

Boundary violations reported by `ai-guard.ts` MUST include:

- `ARCHITECTURE VIOLATION` prefix
- Source module path
- Target module path
- Rule that was violated (e.g., `cross-app import`, `layer violation: ui → domain`,
  `packages → apps forbidden`)
- File path and line context where the import was found

---

## Non-Functional Requirements

### NFR-001 — No Runtime Impact

This stage introduces only JSON configuration files and script-level enforcement. Zero changes to
`apps/api`, `apps/worker`, or any `packages/*` runtime behavior.

### NFR-002 — No New npm Dependencies

`module-boundaries.json` is a JSON file. No new runtime or dev npm packages are required by this
stage.

### NFR-003 — Backward Compatibility

The new `module-boundaries.json` MUST complement the existing `ARCHITECTURE_MAP.json`. `ai-guard.ts`
must continue to work correctly if `module-boundaries.json` does not yet exist (graceful fallback to
`ARCHITECTURE_MAP.json` only), but issue a startup warning.

### NFR-004 — Performance

The full boundary validation (`bun run ai-guard`) MUST complete in under 30 seconds on the full
Zidney monorepo. Developers must not experience meaningful friction in local workflows.

### NFR-005 — Determinism

Given the same source files and the same `module-boundaries.json`, `ai-guard.ts` MUST always produce
the same set of violations. The tool MUST NOT produce non-deterministic results.

### NFR-006 — Alias Resolution Completeness

All path aliases currently defined in the root `tsconfig.json` and `tsconfig.base.json` MUST be
resolved before boundary checks. An unresolvable alias MUST be ignored (not flagged as a violation),
but a debug-mode flag (`--verbose`) should surface unresolved aliases.

---

## Architecture Decisions and Constraints

### Decision 1 — Four-Layer Architecture Model

Zidney uses a four-layer model: `infrastructure`, `domain`, `runtime`, `ui`. This matches the
current state in `ARCHITECTURE_MAP.json` and the stage file. The layers are ordered from lowest to
highest abstraction. Modules may only depend downward or sideways within the same allowed set —
never upward.

```
infrastructure  ←  domain  ←  runtime
                              ↑
                              ui (via ui packages)
```

### Decision 2 — packages/types Classified as Infrastructure

`packages/types` holds shared TypeScript primitives (interfaces, enums, branded types) used across
the entire codebase. It has no business logic. It is therefore classified as `infrastructure`, not
`domain`. This corrects the current `ARCHITECTURE_MAP.json` classification (where `packages/types`
is listed under `"domain"`) and aligns it with the stage definition and the task specification.

### Decision 3 — packages/api-client Classified as UI

`packages/api-client` is a typed HTTP client used exclusively by frontend applications. It MUST NOT
be imported by `apps/api` or `apps/worker`. It is classified as a `ui` layer package. This also
corrects the current `ARCHITECTURE_MAP.json` classification (where it is listed as
`"infrastructure"`).

### Decision 4 — module-boundaries.json Complements ARCHITECTURE_MAP.json

`module-boundaries.json` is the new authoritative boundary map. `ARCHITECTURE_MAP.json` contains
richer per-module metadata (description, criticality, risk). Both files coexist. `ai-guard.ts` loads
`module-boundaries.json` first; if absent, falls back to `ARCHITECTURE_MAP.json`. The intent over
time is for `module-boundaries.json` to become the single source of truth for dependency rules.

### Decision 5 — apps/api and apps/worker Must Not Import packages/ui-system

`apps/api` and `apps/worker` are backend runtime services. They MUST NOT import `packages/ui-system`
(which contains Vue components). This is already captured in `ARCHITECTURE_MAP.json`
(`forbidden_dependencies: ["apps/*", "packages/ui-system"]`) and MUST be preserved in
`module-boundaries.json`.

### Decision 6 — Enforcement by ai-guard.ts, Not ESLint

Boundary enforcement is implemented in `scripts/ai-guard.ts` rather than ESLint import rules. This
is consistent with the existing architecture governance toolchain established by
STAGE_INFRA_06_ARCHITECTURE_GUARD. ESLint handles code style; `ai-guard.ts` handles architecture
boundaries.

---

## Module Boundary Map

### Layer Classification (Authoritative)

```
infrastructure:
  - packages/logger      — structured logging utilities
  - packages/config      — centralized configuration management
  - packages/types       — shared TypeScript primitives
  - packages/redis-utils — Redis connection and caching utilities

domain:
  - packages/domain-core — core domain models and business rules
  - packages/validation  — schema and input validation utilities

runtime:
  - apps/api             — main backend API runtime
  - apps/worker          — background job processing runtime

ui:
  - apps/mmc             — master management console
  - apps/backoffice      — tenant administration application
  - apps/frontoffice     — student-facing application
  - packages/ui-system   — shared Vue component system
  - packages/api-client  — typed HTTP client for frontend applications
```

### Dependency Matrix (Authoritative)

```
Layer            | May Import From
─────────────────|─────────────────────────────────────────────────────
infrastructure   | (external npm packages only — no internal deps)
domain           | infrastructure
runtime          | domain, infrastructure
ui               | packages/ui-system, packages/api-client, infrastructure
```

### Cross-Cutting Rules (Applied in Addition to Layer Matrix)

```
Rule                            | Applies To     | Effect
────────────────────────────────|────────────────|──────────────────────────────
packages/* → apps/*             | all packages   | FORBIDDEN unconditionally
apps/* → other apps/*           | all apps       | FORBIDDEN unconditionally
runtime → packages/ui-system    | apps/api,      | FORBIDDEN — backend must not
                                | apps/worker    |   import Vue components
ui → packages/domain-core       | all UI modules | FORBIDDEN — domain logic must
                                |                |   not leak to presentation
ui → packages/validation        | all UI modules | FORBIDDEN — validation is a
                                |                |   domain concern
```

### module-boundaries.json Schema

The file at `docs/architecture/module-boundaries.json` MUST conform to the following structure:

```json
{
  "version": "1.0",
  "description": "Authoritative module boundary map for Zidney monorepo",
  "layers": {
    "infrastructure": [
      "packages/logger",
      "packages/config",
      "packages/types",
      "packages/redis-utils"
    ],
    "domain": ["packages/domain-core", "packages/validation"],
    "runtime": ["apps/api", "apps/worker"],
    "ui": [
      "apps/mmc",
      "apps/backoffice",
      "apps/frontoffice",
      "packages/ui-system",
      "packages/api-client"
    ]
  },
  "allowed_dependencies": {
    "infrastructure": [],
    "domain": ["infrastructure"],
    "runtime": ["domain", "infrastructure"],
    "ui": ["ui", "infrastructure"]
  },
  "forbidden_dependencies": {
    "infrastructure": ["domain", "runtime", "ui"],
    "domain": ["runtime", "ui"],
    "runtime": ["ui"],
    "ui": ["runtime"]
  },
  "cross_cutting_rules": [
    {
      "rule": "packages_no_apps",
      "description": "Packages must not import from apps",
      "source_pattern": "packages/*",
      "target_pattern": "apps/*",
      "action": "FORBIDDEN"
    },
    {
      "rule": "no_cross_app_imports",
      "description": "Apps must not import from other apps",
      "source_pattern": "apps/*",
      "target_pattern": "apps/*",
      "action": "FORBIDDEN"
    },
    {
      "rule": "runtime_no_ui_system",
      "description": "Runtime services must not import Vue component packages",
      "source": ["apps/api", "apps/worker"],
      "target": ["packages/ui-system"],
      "action": "FORBIDDEN"
    },
    {
      "rule": "ui_no_domain_packages",
      "description": "UI modules must not import domain logic directly",
      "source_layer": "ui",
      "target": ["packages/domain-core", "packages/validation"],
      "action": "FORBIDDEN"
    }
  ]
}
```

---

## ai-guard.ts Integration

### Loading Sequence

`scripts/ai-guard.ts` MUST load boundary data in the following order of precedence:

1. Load `docs/architecture/module-boundaries.json` (primary, established by this stage)
2. Merge with `docs/architecture/intelligence/ARCHITECTURE_MAP.json` (secondary, supplement with
   per-module `allowed_dependencies` and `forbidden_dependencies`)
3. Load `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` (tertiary, fallback rule
   supplements)

If `module-boundaries.json` is missing, `ai-guard.ts` MUST print a startup warning and fall back to
`ARCHITECTURE_MAP.json` only.

### Validation Steps Performed

For each changed `.ts`, `.tsx`, or `.vue` file:

1. Determine the module path (e.g., `apps/mmc/src/Button.vue` → `apps/mmc`)
2. Look up the module's layer from `module-boundaries.json`
3. Extract all import statements from the file
4. Resolve each import to a canonical module path, including alias resolution
5. For each resolved monorepo import, check: a. Is it allowed by the layer dependency matrix? b. Is
   it explicitly in the module's `forbidden_dependencies`? c. Does it violate any cross-cutting
   rule?
6. Report all violations before exiting
7. Exit with code 1 if any violations exist, code 0 if clean

---

## CI Pipeline Integration

### Pipeline Stage Order (Updated After This Stage)

```
1. Biome (lint + format)
2. TypeScript type-check
3. AI-Guard  ← loads module-boundaries.json + ARCHITECTURE_MAP.json
4. Architecture Guard (existing infra-audit boundary checks)
5. Module Boundary Validation  ← confirms ai-guard passed
6. Infra Audit
7. Unit tests
8. Integration tests
```

### Failure Behavior

- `ai-guard.ts` exits 1 → CI pipeline stage `module-boundary-validation` fails
- PR cannot be merged until violations are resolved
- Violation output is captured as CI artifact for developer review

---

## Success Criteria

| ID     | Criterion                                                                | How Measured                                                                               |
| ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| SC-001 | All 13 monorepo modules are assigned a layer in `module-boundaries.json` | `bun run infra-audit` reports 0 undeclared modules                                         |
| SC-002 | `module-boundaries.json` exists and is valid JSON                        | File exists at `docs/architecture/module-boundaries.json`; JSON.parse succeeds             |
| SC-003 | `bun run ai-guard` detects a cross-app import                            | Test fixture with forbidden import causes exit code 1 with violation message               |
| SC-004 | `bun run ai-guard` detects a layer violation (UI → domain)               | Test fixture with `packages/ui-system` importing `packages/domain-core` causes exit code 1 |
| SC-005 | CI pipeline blocks a PR containing a forbidden import                    | CI job `module-boundary-validation` fails on a branch with a known violation               |
| SC-006 | `bun run ai-guard` exits 0 on a clean monorepo                           | Running against the current clean codebase produces exit code 0                            |
| SC-007 | `bun run ai-guard` completes in under 30 seconds                         | Measured in CI on full monorepo scan                                                       |
| SC-008 | A new package added without registration is flagged                      | `bun run infra-audit` reports `undeclared module` for the new directory                    |
| SC-009 | TypeScript alias imports are correctly resolved                          | Importing `@zidney/logger` in an illegal location is caught as a boundary violation        |
| SC-010 | No violations exist in current codebase after this stage ships           | `bun run ai-guard` exits 0, zero violations                                                |

---

## Risk Assessment

| Risk                                                                                                           | Likelihood | Impact | Mitigation                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing codebase has undiscovered boundary violations                                                         | Medium     | High   | Run `bun run ai-guard` against current codebase during implementation to identify and fix violations before stage goes live                    |
| TypeScript alias resolution is incomplete                                                                      | Medium     | Medium | Audit all aliases in `tsconfig.json` and `tsconfig.base.json`; add test fixtures for each alias pattern used in the monorepo                   |
| packages/types classification change (infrastructure vs domain) breaks existing logic in ARCHITECTURE_MAP.json | Low        | Low    | Both files coexist; `ARCHITECTURE_MAP.json` is not modified by this stage; only `module-boundaries.json` reflects the corrected classification |
| packages/api-client classification change breaks ai-guard rules                                                | Low        | Low    | ai-guard.ts loads module-boundaries.json first; the corrected layer assignment takes precedence                                                |
| New modules added by other teams during this stage                                                             | Low        | Medium | PR gate ensures new modules must be registered before they can be merged                                                                       |
| ai-guard performance regression on large monorepos                                                             | Low        | Low    | Benchmark during implementation; introduce file scanning cache if needed                                                                       |

---

## Dependencies

| Dependency                      | Stage                             | Status           | Notes                                                                                          |
| ------------------------------- | --------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| Lint enforcement infrastructure | STAGE_INFRA_05_LINT_GOVERNANCE    | PRODUCTION READY | Provides `bun run lint` pipeline step that precedes ai-guard                                   |
| Architecture guard tooling      | STAGE_INFRA_06_ARCHITECTURE_GUARD | PRODUCTION READY | Provides `ai-guard.ts`, `infra-audit.ts`, and `ARCHITECTURE_MAP.json` which this stage extends |

This stage MUST NOT be implemented before STAGE_INFRA_05 and STAGE_INFRA_06 are PRODUCTION READY.
Both dependencies are confirmed.

---

## Assumptions

- The `ARCHITECTURE_MAP.json` file is the current reference for per-module metadata (description,
  criticality); this stage does not duplicate those fields in `module-boundaries.json`
- `packages/types` reclassification from `domain` → `infrastructure` in `module-boundaries.json`
  does not require changes to `ARCHITECTURE_MAP.json` (they are separate files with different
  authoritative roles)
- `packages/api-client` reclassification from `infrastructure` → `ui` in `module-boundaries.json`
  reflects its actual usage pattern (exclusively consumed by frontend applications)
- External npm packages (e.g., `hono`, `vue`, `drizzle-orm`) are never subject to boundary rules —
  only internal monorepo modules are validated
- The CI system uses `bun` as the JavaScript runtime, consistent with the existing monorepo
  toolchain

---

## Clarifications

### Session 2026-03-08

**Q: Is `module-boundaries.json` structurally distinct from `ARCHITECTURE_MAP.json`, or does it
extend or replace its schema?**

A: Structurally distinct. Verified by direct inspection of both files. `ARCHITECTURE_MAP.json` (at
`docs/architecture/intelligence/ARCHITECTURE_MAP.json`) uses a flat per-module format: each key is a
module path (`packages/logger`, `apps/api`, etc.) containing `layer`, `description`, `criticality`,
`allowed_dependencies`, and `forbidden_dependencies` per module. The `allowed_dependencies` arrays
are all empty (`[]`) in the current file — enforcement is entirely via `forbidden_dependencies`.
`module-boundaries.json` (at `docs/architecture/module-boundaries.json`, new file created by this
stage) uses a layer-first format: `layers` as a map of layer-name → module list,
`allowed_dependencies` and `forbidden_dependencies` keyed by layer name, and a `cross_cutting_rules`
array. The two files coexist and complement each other: `module-boundaries.json` is the primary
dependency-matrix authority; `ARCHITECTURE_MAP.json` retains per-module metadata (description,
criticality) and module-specific forbidden overrides as a supplement. Additionally,
`ARCHITECTURE_MAP.json` contains two classification discrepancies that `module-boundaries.json`
corrects: `packages/types` is listed as `domain` in `ARCHITECTURE_MAP.json` but is authoritative
`infrastructure` in `module-boundaries.json`; `packages/api-client` is listed as `infrastructure` in
`ARCHITECTURE_MAP.json` but is authoritative `ui` in `module-boundaries.json`.
`ARCHITECTURE_MAP.json` is not modified by this stage.

---

**Q: Does `ai-guard.ts` require structural changes (new functions, new validators) or only a new
config-loading path?**

A: Structural changes are required. Verified by reading `scripts/ai-guard.ts` in full. The current
implementation: (1) has no reference to `docs/architecture/module-boundaries.json` — a new
`BOUNDARIES_PATH` constant and `loadModuleBoundaries()` function must be added; (2) has no
layer-based validation function — a new `validateLayerBoundaries()` is needed to apply the layer
dependency matrix from `module-boundaries.json` (checking, for each import, whether the source
module's layer is allowed to depend on the target module's layer); (3) has no cross-cutting rules
evaluator for the structured `cross_cutting_rules` array in `module-boundaries.json`. The existing
functions — `validateArchitectureMap`, `validateCrossAppImports`, `validateRelativeLeaks`,
`validateRules`, `validateBranchNaming` — are preserved intact for backward compatibility (NFR-003).
New violations from the module-boundaries checks must use the `ARCHITECTURE VIOLATION` prefix as
specified in FR-012; the existing functions' prefixes (`Cross-app violation:`,
`ARCH_MAP forbidden dependency:`) are not changed. The loading precedence in `runGuard()` is updated
so `module-boundaries.json` is loaded first and its layer classification takes precedence over
`ARCHITECTURE_MAP.json` for any module where both files define a layer.

---

**Q: What is the complete TypeScript alias set in `tsconfig.json` and `tsconfig.base.json`, and how
should `ai-guard.ts` handle alias resolution?**

A: Verified by reading both files. `tsconfig.json` (root) defines: `@/*` → `apps/*/src`
(multi-target), `@zidney/app/*` → `apps/*/src`, `@zidney/package/*` → `packages/*/src`, `@zidney/ui`
→ `packages/ui-system/src/index.ts`, `@zidney/ui/*` → `packages/ui-system/src/*`,
`@zidney/domain-core`, `@zidney/domain-core/*`, `@zidney/domain-core/mmc-dashboard`,
`@zidney/logger`, `@zidney/logger/*`, `@zidney/types`, `@zidney/types/*`, `@zidney/validation`,
`@zidney/validation/*`, `@zidney/redis-utils`, `@zidney/redis-utils/*`, `@zidney/config`,
`@zidney/config/*`. Notably, `tsconfig.json` does NOT include `@zidney/api-client` in its paths (it
is only in `tsconfig.base.json`). The current `ai-guard.ts` `resolveModulePath()` handles
`@zidney/api-client` via direct `@zidney/` prefix stripping (`packages/api-client`), which is
correct. However, `@zidney/ui/*` wildcard does NOT resolve correctly via plain prefix stripping
alone — it would produce `packages/ui` instead of `packages/ui-system`. The implementation must
adopt the `loadTsAliases()` pattern already present in `scripts/infra-audit.ts`, which reads
`tsconfig.json` first and for each alias strips `/*` from both key and target before storing, then
resolves imports by matching prefixes. This correctly maps `@zidney/ui/Button` →
`packages/ui-system`. The new `ai-guard.ts` should call `loadTsAliases()` at startup (exactly as
`infra-audit.ts` does) and use those aliases in its import resolution step.

---

**Q: Should existing boundary violations in the codebase be treated as blocking errors or as
warnings on the first run after this stage ships?**

A: Always blocking errors (exit code 1). No warning mode exists. Confirmed by SC-006 ("bun run
ai-guard exits 0 on a clean monorepo"), SC-010 ("No violations exist in current codebase after this
stage ships"), and the Risk Assessment entry: "Run `bun run ai-guard` against current codebase
during implementation to identify and fix violations before stage goes live." The implementation
workflow for this stage is: (1) implement the new module-boundaries enforcement in `ai-guard.ts`,
(2) run `bun run ai-guard` against the full monorepo, (3) fix any violations found, (4) verify exit
code 0 before marking the stage BACKEND CLOSED. There is no phased or graceful rollout — the tool
either passes (exit 0) or fails (exit 1) upon completion of this stage.

---

**Q: What is the exact insertion point for `module-boundary-validation` in the actual CI pipeline,
and does the `bun run ai-guard` script command already exist in `package.json`?**

A: Confirmed by reading `.github/workflows/ci.yml` and root `package.json`. In `ci.yml`, the
existing `arch-guard` job (Job 3, named "AI-Guard — Architecture Boundaries") already runs
`bun scripts/ai-guard.ts` with `needs: [lint, typecheck]`. Unit tests have
`needs: [lint, typecheck, arch-guard]`. This placement already satisfies FR-009's "after lint,
before tests" requirement. The implementation change is: rename the step inside the `arch-guard` job
from `"Run AI-Guard architecture check"` to `"module-boundary-validation"` (or add a new step by
that name). No new GitHub Actions job is required — the existing job placement is correct. Regarding
`package.json`: the current scripts include `"arch:guard": "bun scripts/ai-guard.ts"` but there is
NO `"ai-guard"` script. FR-010 requires that `bun run ai-guard` works from the repository root. The
implementation must add `"ai-guard": "bun scripts/ai-guard.ts"` to the root `package.json`. The
existing `"arch:guard"` alias is preserved (no breaking changes to existing developer workflows).

---

**Clarification Status:** All ambiguities resolved. Codebase-verified findings documented above.
Ready for technical planning.
