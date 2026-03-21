# Specification: Script System Standardization and Governance

**Stage:** INFRA-25 — Script System Standardization and Governance
**Phase:** 01_PLATFORM_FOUNDATION
**Stage File:** `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_25_SCRIPT_SYSTEM_STANDARDIZATION_AND_GOVERNANCE.md`
**Status:** DRAFT
**Date:** 2026-03-21

---

## Feature Overview

The Zidney repository accumulates scripts organically across multiple packages, apps, and CI configurations. Over time, this has produced inconsistent naming patterns, ambiguous invocation styles, undocumented entry points, and no enforcement preventing broken references when scripts are renamed.

This stage establishes a **first-class governed script system** for the entire monorepo. It covers:

- Naming convention enforcement across all packages and apps
- A canonical script inventory with name-to-file mapping
- Invocation standardization
- Full usage refactoring so no old references remain
- An auto-generated script registry
- Validation scripts that block regressions in CI
- An orchestrator gate that enforces integrity before closure
- An AI skill that allows agents to create, rename, and validate scripts safely

**Phase:** 01_PLATFORM_FOUNDATION
**Stage:** INFRA-25

**Affected systems:**

| System          | Affected? | Notes                                    |
| --------------- | --------- | ---------------------------------------- |
| Isolation       | No        | No tenant data involved                  |
| License engine  | No        | No license enforcement logic changed     |
| Attempt engine  | No        | No grading or submission logic changed   |
| Worker          | No        | No background job logic changed          |
| Runtime         | No        | No runtime session logic changed         |
| Frontoffice     | No        | No UI or user-facing behavior changed    |
| CI / DevOps     | Yes       | Validation scripts added to CI pipeline  |
| Developer tools | Yes       | Script naming, registry, refactor engine |
| AI agents       | Yes       | Script governance skill created          |

---

## Clarifications

### Session 2026-03-21

- Q: Does the refactor engine (FR-004) include `.sh` files in its scan-and-replace scope, given the engine skeleton in the stage file only matches `md|json|ts|yml|yaml|js`? → A: Yes — `.sh` files are explicitly in scope. Stage T003 and FR-004 both list shell scripts. The skeleton is illustrative; the implementation file-match regex must include `\.sh$` in addition to the other extensions.
- Q: Should `validate:script:naming` and `validate:script:usage` (FR-008) operate in fail-fast mode or report-all mode? → A: Report-all. Both scripts must collect and emit the complete list of all violations before exiting non-zero, enabling developers to fix every issue in a single pass.
- Q: Which existing CI workflow file receives the four script validation steps from FR-009 — `ci.yml`, `architecture-governance.yml`, or a new dedicated file? → A: `.github/workflows/architecture-governance.yml`. Script governance is a governance concern matching the purpose of that workflow, which already houses `arch:guard`, `infra-audit.ts`, and `arch:health:ci`. No new workflow file is created.
- Q: Does the "no duplicate script names across `package.json` files" rule in FR-002 apply to all script names (including universal lifecycle names like `build`, `test`) or only to governed `<domain>:<action>[:<scope>]` names? → A: Governed scripts only. The duplicate-name prohibition applies exclusively to scripts conforming to `<domain>:<action>[:<scope>]`. Standard lifecycle scripts (`build`, `test`, `lint`, `typecheck`, `dev`, `clean`, `check`) that exist across all workspaces are explicitly exempt.
- Q: Does the new `script-system-governance` AI skill (FR-011) supersede or supplement existing script guidance in `AGENTS.md` and other documentation? → A: Supplements. The skill is additive — it becomes the canonical agent-facing interface for script governance operations. Existing `AGENTS.md` entries, README references, and CI comments are not removed. Agents must load the skill whenever creating, renaming, or validating scripts.

---

## Constitutional Compliance Declaration

This stage modifies only developer tooling and build-time governance. No runtime behavior, data model, or trust chain component is altered.

| Constraint                          | Status    | Notes                           |
| ----------------------------------- | --------- | ------------------------------- |
| No cross-tenant access              | Confirmed | No tenant DB touched            |
| No middleware bypass                | Confirmed | No HTTP layer modified          |
| No grading outside worker           | Confirmed | No grading logic involved       |
| No direct DB instantiation          | Confirmed | No database connections created |
| No weakening of snapshot integrity  | Confirmed | Attempt engine unchanged        |
| No weakening of transaction bounds  | Confirmed | No transactions involved        |
| No weakening of version enforcement | Confirmed | Schema versioning unchanged     |

No ADR is required. No constitutional exception is needed.

---

## Isolation Impact Analysis

- **Database accessed:** None
- **Tenant resolution:** Not applicable
- **Connection pool:** Not applicable
- **Resolver middleware:** Not applicable
- **New tables introduced:** None

This stage is infrastructure-only. No shared or tenant data is processed.

---

## License & Version Enforcement

- **License middleware required:** No — this stage contains no workspace routes
- **License states checked:** Not applicable
- **Limit enforcement:** Not applicable
- **Schema version checked:** Not applicable
- **Product version checked:** Not applicable

No license enforcement surface is introduced or modified.

---

## Data Model Changes

None. This stage introduces no database changes, no new tables, no modified tables, and requires no migration.

---

## Naming Convention

All scripts across the monorepo must follow this structure:

```
<domain>:<action>[:<scope>]
```

**Allowed domains:**

| Domain     | Responsibility                                      |
| ---------- | --------------------------------------------------- |
| `db`       | Database operations (pool, migrate, seed, validate) |
| `arch`     | Architecture governance and validation              |
| `validate` | Cross-cutting validation checks                     |
| `ai`       | AI context generation and validation                |
| `ci`       | CI pipeline scripts                                 |
| `repo`     | Repository hygiene and auditing                     |
| `dev`      | Developer experience utilities                      |
| `infra`    | Infrastructure and environment scripts              |
| `test`     | Test execution and setup scripts                    |

**Examples of correctly normalized names:**

| Old name (non-compliant)   | New name (compliant)       |
| -------------------------- | -------------------------- |
| `db:pool-status`           | `db:status:pool`           |
| `db:validate-licenses`     | `db:validate:licenses`     |
| `validate-runtime-scripts` | `validate:runtime:scripts` |
| `arch:validate-brain`      | `arch:validate:brain`      |

---

## Functional Requirements

### FR-001: Script Inventory

The system must produce a complete inventory of every script defined across the monorepo:

- Root `package.json`
- All `apps/*/package.json`
- All `packages/*/package.json`

Each inventory entry must capture:

- Script name
- Declared command (invocation string)
- Source file path (the `.ts` or shell file being invoked)
- All locations where the script name is referenced across the repository

Inventory must be regenerable on demand and kept up to date.

---

### FR-002: Naming Convention Enforcement

Every script name defined anywhere in the repository must conform to `<domain>:<action>[:<scope>]`.

- Only the domains listed in the Domain Map are permitted
- Separator must be `:` (not `-` between domain segments)
- Action and scope segments may contain `-` internally (e.g., `db:validate:tenant-schema`)
- Duplicate script names across different package.json files are forbidden **for scripts conforming to the `<domain>:<action>[:<scope>]` convention only**. Standard lifecycle scripts (`build`, `test`, `lint`, `typecheck`, `dev`, `clean`, `check`) that exist across all workspaces are exempt from the deduplication rule.

A validation script must check and fail if any non-conforming name exists.

---

### FR-003: Migration Map

A human-readable migration map must be created that declares every script rename:

```
<old-name> → <new-name>
```

- Stored at `docs/scripts/SCRIPT_MIGRATION_MAP.md`
- Serves as the canonical input to the refactor engine (FR-004)
- Must list all renames identified during inventory

---

### FR-004: Automated Refactor Engine

An automated refactor engine must update all script references across the repository using the migration map as input.

**Scan scope:**

- All `package.json` files (root and workspace)
- GitHub Actions workflow files (`.github/workflows/*`)
- All TypeScript scripts (`scripts/**/*.ts`)
- All Markdown documentation (`docs/**/*.md`, `specs/**/*.md`)
- All agent files (`.agents/**/*.md`)
- Shell scripts (`.sh` files) — the file-match regex **must** include `\.sh$`; the engine skeleton in the stage file omits this extension and must be updated during implementation

**Behavior:**

- Replace every occurrence of `bun run <old>` with `bun run <new>`
- Support dry-run mode (`--dry-run`) that shows changes without writing
- Emit a refactor report at `reports/SCRIPT_REFACTOR_REPORT.md` listing total replacements and any unresolved references
- Must be idempotent — safe to run multiple times

**Completion gate:** If any old script reference remains after the refactor engine runs, the stage is incomplete.

---

### FR-005: Invocation Standardization

All **new** script invocations added to `package.json` in this stage must resolve to:

```
bun scripts/<domain>/<file>.ts
```

Invocation patterns that must be eliminated for new entries:

- `bun run scripts/...` (use `bun scripts/...`)
- Direct `ts-node` or `npx tsx` invocations not going through `bun`
- Inline shell commands that duplicate what a named script does

**Scope note:** FR-005 applies to the 5 new entries introduced in this stage. Auditing and correcting the command-string values of all existing `package.json` entries (e.g., migrating existing `bun run scripts/foo.ts` values to `bun scripts/foo.ts`) is explicitly deferred as tech debt to a future INFRA stage. Success Criterion 1 (naming compliance) does not require retroactive command-value correction.

---

### FR-006: Script Metadata Headers

Every script file under `scripts/` must include a standardized metadata header comment:

```ts
/**
 * @script <domain>:<action>[:<scope>]
 * @domain <domain>
 * @category <runtime|governance|dev|ci|infra|test>
 * @description <Single-line summary of what this script does>
 * @usage bun run <domain>:<action>[:<scope>]
 */
```

A validation script must detect scripts missing this header and fail.

---

### FR-007: Script Registry

An auto-generated registry document must be produced at `docs/scripts/SCRIPT_REGISTRY.md` containing:

- Script name
- Domain
- Source file path
- Category
- Description (from metadata header)

The registry must be regenerable on demand via a dedicated script. CI must fail if the registry is stale relative to the current script inventory.

---

### FR-008: Validation Scripts

Two validation scripts must be created:

**`scripts/validate/script-naming.ts`**

- Checks all script names across all `package.json` files for convention compliance
- Reports violating names with domain, file, and remediation hint

**`scripts/validate/script-usage.ts`**

- Checks all usages of script names in the scan scope
- Detects orphan references (calls to scripts that do not exist)
- Detects broken references (old names that were renamed but not updated)

Both scripts must operate in **report-all mode**: collect and emit the complete list of all violations before exiting with a non-zero code. Fail-fast (early exit on first violation) is prohibited; every invocation must surface the full violation set to enable single-pass remediation.

---

### FR-009: CI Integration

The following script validation steps must be added to the CI pipeline.

**Target workflow file:** `.github/workflows/architecture-governance.yml`. Script governance is a governance concern; these steps are added as a new `# Script System Governance` block inside the existing `architecture-governance` job. No new workflow file is created.

| CI Check                         | What it validates                             |
| -------------------------------- | --------------------------------------------- |
| `validate:script:naming`         | All script names follow convention            |
| `validate:script:usage`          | No broken or orphan references                |
| `validate:script:infrastructure` | Registry is current; metadata headers present |
| `dev:generate:script-docs`       | Registry can be regenerated without errors    |

CI must fail if any check fails. No bypass is permitted.

---

### FR-010: Orchestrator Gate

Before the stage can be closed, the orchestrator must verify:

- Script naming validation passes
- Script usage validation passes
- No broken references remain

Failure of any gate blocks closure.

---

### FR-011: AI Governance Skill

A skill file must be created at `.agents/skills/script-system-governance/SKILL.md` covering:

- Naming rules and domain map
- How to create a new script (step-by-step)
- How to rename an existing script safely
- How to update all usages after a rename
- Anti-patterns to avoid (inline commands, missing registry, wrong domain, broken references)

**Relationship to existing documentation:** The skill is **additive (supplements, does not supersede)** existing script guidance in `AGENTS.md`, README references, and CI comments. Those sources remain as human-readable context. The skill becomes the canonical agent-facing interface for script governance operations. Any AI agent creating, renaming, or validating scripts must load this skill.

The skill must be loaded by any AI agent that creates, renames, or validates scripts.

---

## User Scenarios and Acceptance Criteria

### Scenario 1: Developer adds a new script

**Given** a developer needs a new validation script for tenant schema integrity
**When** they follow the governed workflow
**Then:**

- The script file is placed at `scripts/validate/<name>.ts` with a metadata header
- A `validate:<action>:<scope>` entry is added to `package.json`
- Running `bun run validate:script:naming` passes
- Running `bun run validate:script:usage` passes

---

### Scenario 2: Developer renames an existing script

**Given** a script named `db:pool-status` must be renamed to `db:status:pool`
**When** the developer follows the governed rename workflow
**Then:**

- The migration map is updated
- The refactor engine is run and all usages are updated
- No old reference to `db:pool-status` remains in any scanned file
- The refactor report shows zero unresolved references
- CI validation passes

---

### Scenario 3: CI catches a non-compliant script name

**Given** a developer adds a script named `validate-runtime-scripts` without using `:` separators
**When** CI runs
**Then:**

- `validate:script:naming` fails with a clear message identifying the non-compliant name
- The CI pipeline blocks the merge

---

### Scenario 4: CI catches a broken script reference

**Given** a developer renames a script in `package.json` but does not update a CI workflow file
**When** CI runs
**Then:**

- `validate:script:usage` fails identifying the broken reference and its location
- The pipeline blocks the merge

---

### Scenario 5: Developer discovers all available scripts

**Given** a developer wants to find the right script for a task
**When** they view `docs/scripts/SCRIPT_REGISTRY.md`
**Then:**

- Every script is listed with its name, domain, description, and invocation
- The registry is consistent with actual `package.json` definitions

---

### Scenario 6: AI agent creates a compliant script

**Given** an AI agent is instructed to add a new dev utility script
**When** the agent follows the script governance skill
**Then:**

- The script is placed in the correct domain folder
- Naming convention is respected
- Metadata header is present
- Registry and validation scripts are updated

---

## Success Criteria

| #   | Criterion                                                                                      | Measurable Outcome                                                |
| --- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | All scripts across the monorepo conform to the `<domain>:<action>[:<scope>]` naming convention | `validate:script:naming` passes with zero violations              |
| 2   | No broken script references exist anywhere in the repository                                   | `validate:script:usage` passes with zero unresolved references    |
| 3   | Every script file has a complete metadata header                                               | `validate:script:infrastructure` passes with zero missing headers |
| 4   | The script registry is complete and accurate                                                   | Registry regenerates without errors; CI staleness check passes    |
| 5   | CI prevents future regressions                                                                 | All four CI checks integrated and blocking on failure             |
| 6   | The refactor engine produces a report with zero unresolved references                          | `reports/SCRIPT_REFACTOR_REPORT.md` shows 0 unresolved            |
| 7   | AI agents can create or rename scripts without breaking the system                             | Governance skill is present and covers all required workflows     |
| 8   | Orchestrator gate blocks closure if any validation fails                                       | Gate is defined and enforced in stage closure procedure           |

---

## Key Entities

| Entity            | Description                                                       |
| ----------------- | ----------------------------------------------------------------- |
| Script name       | The canonical colon-separated identifier (e.g., `db:status:pool`) |
| Script file       | The TypeScript file under `scripts/` that implements the script   |
| Migration map     | Document declaring all old-name → new-name renames                |
| Script registry   | Auto-generated document listing all scripts with metadata         |
| Refactor engine   | Tool that propagates renames across all repository surfaces       |
| Validation script | Tool that checks naming and usage conformance                     |
| Governance skill  | AI agent skill for creating and renaming scripts safely           |

---

## Explicit Non-Goals

- This stage does not change the **behavior** of any existing script
- This stage does not add new business-logic scripts — only governance infrastructure
- This stage does not modify any database schema, migration, or tenant model
- This stage does not change any HTTP routes or API behavior
- This stage does not modify any license, authentication, or attempt engine logic
- This stage does not restructure `apps/` or `packages/` directories
- This stage does not introduce a runtime dependency (all tooling is dev/CI only)
- This stage does not establish a new package under `packages/` for script utilities

---

## Assumptions

- The root and all workspace `package.json` files are the authoritative source of script definitions
- GitHub Actions is the primary CI platform for enforcement
- `bun` is the canonical script runner; no fallback to `npm run` or `pnpm run` is needed for new scripts
- Only scripts under `scripts/` (TypeScript) are governed by the metadata header requirement — shell scripts in `scripts/` follow the same naming convention but are exempt from the TS metadata block
- The refactor engine operates on text patterns, not AST, for the initial implementation
- Dry-run mode is sufficient for the first refactor pass; subsequent runs write changes in place

---

## Final Constitutional Compliance Statement

Compliant with Zidney Constitution v1.2.0 — No violations detected.
