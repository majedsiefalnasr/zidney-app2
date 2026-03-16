# INFRA-022 — Repository Hygiene Verification

**Phase:** 01_PLATFORM_FOUNDATION
**Stage File:** `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_22_REPOSITORY_HYGIENE_VERIFICATION.md`
**Branch:** `spec/infra-022-repository-hygiene-verification`
**Initiated:** 2026-03-15

---

## Feature Overview

This stage performs a final repository hygiene verification for the Zidney monorepo following the routing, template, and support-surface migrations performed in INFRA-16 and INFRA-21. It does not introduce new features, restructure the codebase, or generate ADRs.

**What is being built:**
A structured verification and cleanup pass that confirms all prior migration work produced a stable, clean repository state. Outputs a single hygiene report artifact.

**Phase:** 01_PLATFORM_FOUNDATION

**Stage it maps to:** STAGE_INFRA_22_REPOSITORY_HYGIENE_VERIFICATION

**Affected platform concerns:**

| Concern             | Affected |
| ------------------- | -------- |
| Isolation           | No       |
| License enforcement | No       |
| Attempt engine      | No       |
| Worker              | No       |
| Runtime             | No       |
| Frontoffice         | No       |

This stage is tooling and repository governance only. No application runtime behaviour is modified.

---

## Constitutional Compliance Declaration

| Constraint                             | Status    |
| -------------------------------------- | --------- |
| No cross-tenant access                 | Confirmed |
| No middleware bypass                   | Confirmed |
| No grading outside worker              | Confirmed |
| No direct DB instantiation             | Confirmed |
| No weakening of snapshot integrity     | Confirmed |
| No weakening of transaction boundaries | Confirmed |
| No weakening of version enforcement    | Confirmed |

This stage introduces no runtime changes. All constraints hold by design.

No ADR is required or generated for this stage.

---

## Isolation Impact Analysis

| Question                     | Answer                   |
| ---------------------------- | ------------------------ |
| Database accessed            | None                     |
| Tenant resolution involved   | No                       |
| Connection pool usage        | None                     |
| Resolver middleware required | No                       |
| New tables introduced        | None                     |
| Shared tenant data risk      | None — verification only |

No tenant isolation concern. This stage performs static analysis and file inspection only.

---

## License & Version Enforcement

| Question                         | Answer                            |
| -------------------------------- | --------------------------------- |
| License middleware required      | No — no workspace routes involved |
| License state restrictions apply | No                                |
| Limit enforcement required       | No                                |
| schema_version checked           | No runtime schema changes         |
| product_version checked          | No runtime version bumps          |

License middleware remains mandatory on all existing workspace routes. This stage does not touch those routes.

---

## Verification Scope

### T001 — Routing Authority Verification

Confirm that routing surfaces align with:

```
docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md
```

Checks required:

- No duplicate active routing roots exist (e.g., `.agents/agents/` vs `.github/agents/`)
- No legacy surfaces are marked authoritative in the registry
- No prompt or agent mirror directories remain active
- Exactly one authoritative location exists per routing surface type

Routing surface pairs to evaluate:

| Surface Type | Path A                | Path B             |
| ------------ | --------------------- | ------------------ |
| Agents       | `.agents/agents/`     | `.github/agents/`  |
| Prompts      | `.agents/prompts/`    | `.github/prompts/` |
| Templates    | `.specify/templates/` | `specs/templates/` |

Expected outcome: each pair has exactly one authoritative path confirmed in the registry.

---

### T002 — Template System Consolidation Check

Confirm only one active spec template system exists.

Checks required:

- Template scripts reference the canonical template root only
- No tooling targets legacy template paths (`.specify/templates/` if superseded)
- No duplicate template files exist across legacy and canonical paths

Expected outcome: a single canonical template root drives all spec generation.

---

### T003 — Dead Script Detection

Identify unused scripts under `scripts/`.

Reference sources for active usage:

- `package.json` scripts entries
- `.github/workflows/` job steps and run commands
- Documentation files referencing script paths
- Shell utility scripts that invoke other scripts
- Stage artifacts

A script is considered dead if it appears in none of the above sources.

Expected outcome: dead scripts are enumerated in the hygiene report under a "Scripts — Flagged for Review" section. No removal shell script is generated. Flagging is the only output; deletion is deferred to a human reviewer.

---

### T004 — Dependency Hygiene

Verify that declared npm dependencies are actively used.

Scope: both the top-level root `package.json` AND every workspace package under `packages/*` and `apps/*` must be checked independently. Report findings grouped by workspace root.

Checks required:

- `devDependencies` that no source file imports or invokes
- `dependencies` that no runtime code references
- Duplicate packages resolved by the package manager

Tools to be applied:

- Native `npm ls` / workspace resolution
- `madge` for import graph analysis where applicable
- Custom dependency audit scripts if available

Expected outcome: list of unused or duplicate packages, flagged for removal.

---

### T005 — Workspace Package Validation

Confirm all packages under `packages/` serve an active consumer.

Checks required:

- Each package under `packages/` is imported by at least one `apps/*` consumer
- No package is entirely absent from the dependency graph

Expected outcome: orphaned packages identified and flagged for removal.

---

### T006 — Skill Surface Validation

Confirm that all entries under `.agents/skills/` remain relevant.

Checks required:

- Skill directory is referenced by at least one `AGENTS.md` or skill index
- Skill content has not been superseded by updated architecture rules

Expected outcome: superseded or unused skills flagged for removal.

---

### T007 — CI Workflow Hygiene

Inspect `.github/workflows/` for redundancy.

Checks required:

- Duplicate CI validation steps across workflows
- Redundant architecture guard runs
- Redundant type-safety checks that overlap with other jobs

Expected outcome: overlapping pipelines identified; consolidation candidates listed.

---

### T008 — AI Context Integrity

Validate AI context artifacts under `docs/ai/context/`.

Validation command:

```bash
bun run ai-context:validate
```

Artifacts validated:

- `ai-dependency-graph.json`
- `ai-module-map.json`
- `ai-layer-map.json`

Exit code behaviour:

| Condition                                                                  | Treatment   | Report Entry                      |
| -------------------------------------------------------------------------- | ----------- | --------------------------------- |
| Script does not exist (command not found / exit ≠ 0 due to missing script) | **SKIP**    | "AI Context — Script Unavailable" |
| Script exists but reports structural errors about invalid artifacts        | **WARNING** | Record specific artifact errors   |
| Script exists, exits 0, all artifacts pass                                 | **PASS**    | Clean confirmation                |

Expected outcome: all artifacts structurally valid with no stale or malformed edges. If the script is absent, result is SKIP (not FAIL); stage completion is not blocked.

---

### T009 — Architecture Guard Verification

Run the full architecture governance pipeline.

```bash
bun run arch:guard
bun run arch:health
```

Checks required:

- No boundary violations
- Architecture brain is valid (zero corrupt edges)
- Architecture health score at or above established baseline

Violation classification:

| Type                                                                      | Treatment                                                                                             |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Violations introduced by this stage's own changes                         | **BLOCK** — stage completion blocked                                                                  |
| Violations pre-existing before this stage (not introduced by this branch) | **DOCUMENT ONLY** — recorded under "Architecture Guard — Pre-existing Violations Found"; do not block |

Since this stage introduces no code changes, any violations found are by definition pre-existing and must be documented only.

Expected outcome: `arch:guard` and `arch:health` are executed; results recorded in hygiene report. Pre-existing violations do not block stage completion.

---

### T010 — Repository Hygiene Report

Produce a final report artifact:

```
docs/reports/REPOSITORY_HYGIENE_REPORT.md
```

Delivery: the report **is committed to source control** as a tracked stage output artifact. It is not ephemeral. If a prior version exists, the new version replaces it.

The report must include:

- Routing surface duplication status
- Template system consolidation status
- Dead script detection results (under "Scripts — Flagged for Review")
- Dependency analysis summary (grouped by workspace root)
- Workspace package usage results
- CI workflow redundancy findings
- AI context validation outcome (including SKIP if script unavailable)
- Architecture guard outcome (including pre-existing violations if found)
- Overall repository hygiene verdict

---

## Data Model Changes

No data model changes. No migrations. No version bumps required.

---

## Transaction Boundaries

No transactional database operations are performed in this stage.

Script and file inspection operations are read-only by default. Any cleanup actions (script deletion, dependency removal) must be performed explicitly by a human reviewer after consulting the hygiene report. No automated destructive operations are initiated by this stage.

---

## Authoritative Time Usage

No time-sensitive runtime logic is involved. Stage uses current system timestamp for report generation only (no server time dependency, no client time trust concern).

---

## Idempotency Strategy

All verification tasks are read-only and inherently idempotent. Re-running any task against an unchanged repository produces the same findings. No state mutations require idempotency keys.

---

## Observability Requirements

The hygiene report (`docs/reports/REPOSITORY_HYGIENE_REPORT.md`) is the only required output artifact. No structured log fields, metrics, or runtime observability are required for this stage.

---

## Rate Limiting & Abuse Protection

Not applicable. This stage involves no HTTP endpoints or user-facing surfaces.

---

## Layer Separation Confirmation

| Constraint                                 | Status    |
| ------------------------------------------ | --------- |
| Frontend contains no business logic        | Unchanged |
| API contains no grading logic              | Unchanged |
| Worker contains no HTTP logic              | Unchanged |
| MMC does not access tenant DB              | Unchanged |
| No direct DB creation outside provisioning | Unchanged |

This stage performs no layer modifications. All layer separation constraints are preserved as prior INFRA stages left them.

---

## Failure Modes & Recovery

| Failure Scenario                             | Handling                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Verification command fails to run            | Log failure in hygiene report; do not auto-apply remediations                                    |
| AI context validation produces errors        | Record in report; do not auto-regenerate context files                                           |
| `arch:guard` reports pre-existing violations | Record under "Architecture Guard — Pre-existing Violations Found"; do not block stage completion |
| Dead script list is empty                    | Record as clean; proceed to next task                                                            |
| Unused dependency detection times out        | Mark as inconclusive in report; surface as manual review item                                    |

No automated rollback is required. All outputs are additive report artifacts.

---

## User Scenarios & Acceptance Criteria

### Scenario 1 — Routing surfaces are fully consolidated

**Given** the routing authority registry is present and authoritative
**When** T001 routing verification is executed
**Then** each routing surface type has exactly one active authoritative path and no duplicates are found

### Scenario 2 — Template system is single-source

**Given** at most one canonical template root is declared authoritative
**When** T002 template consolidation check is executed
**Then** no tooling references a legacy template path and no duplicate template files coexist

### Scenario 3 — Dead scripts are identified

**Given** `scripts/` contains scripts not referenced in any active surface
**When** T003 dead script detection is executed
**Then** flagged scripts appear in the hygiene report under "Scripts — Flagged for Review" with their last-known reference source listed; no removal shell script is generated

### Scenario 4 — Dependency hygiene passes

**Given** all workspace apps and packages declare their npm dependencies
**When** T004 dependency hygiene analysis is executed against the root `package.json` and every `packages/*` and `apps/*` workspace independently
**Then** unused `devDependencies` and duplicate packages are listed per-workspace (including root) in the hygiene report

### Scenario 5 — No orphaned workspace packages

**Given** all packages under `packages/` are intended to have active consumers
**When** T005 workspace package validation is executed
**Then** packages with no consumers appear in the report flagged for removal review

### Scenario 6 — Skills surface is clean

**Given** `.agents/skills/` entries exist
**When** T006 skill surface validation is executed
**Then** superseded or unreferenced skill directories are listed in the hygiene report

### Scenario 7 — CI workflows are non-redundant

**Given** `.github/workflows/` contains multiple workflow files
**When** T007 CI workflow hygiene is executed
**Then** any duplicate validation steps are identified and listed as consolidation candidates

### Scenario 8 — AI context artifacts are valid

**Given** `docs/ai/context/` contains generated intelligence artifacts
**When** T008 AI context integrity validation is executed
**Then** if the validation script exists and passes, all artifacts are confirmed structurally valid with no stale or malformed edges; if the script is absent, the result is recorded as SKIP (not FAIL) under "AI Context — Script Unavailable"

### Scenario 9 — Architecture guard is executed

**Given** the architecture brain and module map are current
**When** T009 architecture guard is executed
**Then** results are recorded in the hygiene report; any violations found are classified as pre-existing (since this stage introduces no code changes) and are documented under "Architecture Guard — Pre-existing Violations Found" without blocking stage completion

### Scenario 10 — Hygiene report is produced and committed

**Given** all ten verification tasks have been executed
**When** T010 report generation is completed
**Then** `docs/reports/REPOSITORY_HYGIENE_REPORT.md` exists, contains a result entry for every task in this stage, and is committed to source control as a tracked stage artifact

---

## Functional Requirements

| ID   | Requirement                                                                                                                        | Acceptance Criterion                                                                                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| FR01 | Routing authority registry must be read and all active surfaces validated against it                                               | T001 produces a pass/flag list per surface pair                                                                                                 |
| FR02 | Template system must have a single active canonical root                                                                           | T002 produces a clean confirmation or flags legacy paths                                                                                        |
| FR03 | Dead scripts under `scripts/` must be detected using active reference scanning                                                     | T003 produces a list of unreferenced scripts in the hygiene report under "Scripts — Flagged for Review"; no removal shell script is generated   |
| FR04 | Unused npm dependencies must be detected per workspace, including the monorepo root                                                | T004 produces per-workspace unused dependency lists for root, all `packages/*`, and all `apps/*` workspaces independently                       |
| FR05 | Orphaned workspace packages must be detected                                                                                       | T005 produces list of packages absent from all consumer dependency graphs                                                                       |
| FR06 | Unreferenced or superseded skill directories must be detected                                                                      | T006 produces a list of skill directories flagged for removal                                                                                   |
| FR07 | Duplicate CI validation jobs must be detected across workflow files                                                                | T007 lists overlapping pipeline steps as consolidation candidates                                                                               |
| FR08 | AI context artifacts must be validated; missing validation script is a SKIP, not a FAIL                                            | T008 result recorded as PASS, WARNING, or SKIP per exit condition; hygiene report updated accordingly                                           |
| FR09 | Architecture guard pipeline must be executed; pre-existing violations must be documented but do not block completion               | T009 `arch:guard` and `arch:health` results recorded; pre-existing violations logged under "Architecture Guard — Pre-existing Violations Found" |
| FR10 | A single repository hygiene report must be produced at `docs/reports/REPOSITORY_HYGIENE_REPORT.md` and committed to source control | T010 report file is committed as a tracked artifact with a summary section per task                                                             |
| FR11 | No architecture rules, governance documents, or routing registry must be modified during this stage                                | Post-execution diff confirms no writes to `docs/architecture/` governance paths                                                                 |
| FR12 | No new repository structure must be introduced                                                                                     | Post-execution diff confirms no new directories outside the stage output paths                                                                  |

---

## Success Criteria

| Criterion                                                                                               | Measure                                                                                                     |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| All routing surfaces are consolidated to a single authoritative location                                | Zero duplicate active routing roots remain after T001                                                       |
| Template system has no legacy duplication                                                               | Zero legacy template consumers remain after T002                                                            |
| Dead script inventory is complete                                                                       | Every script under `scripts/` appears in T003 output (used or dead)                                         |
| Dependency audit covers every workspace                                                                 | T004 reports results for all workspaces in the monorepo                                                     |
| No orphaned packages remain unreported                                                                  | T005 identifies all packages absent from consumer graphs                                                    |
| Skill surface is clean                                                                                  | T006 flags any superseded skills for human review                                                           |
| CI pipeline has no overlapping validation steps                                                         | T007 shows zero identical jobs across distinct workflow files                                               |
| AI context passes integrity check or is recorded as SKIP if script unavailable                          | T008 result is PASS, WARNING, or SKIP; no unknown exit states remain unrecorded                             |
| Architecture guard results are recorded; pre-existing violations documented without blocking completion | T009 produces a recorded outcome; no violations attributable to this stage                                  |
| Hygiene report is complete, published, and committed to source control                                  | `docs/reports/REPOSITORY_HYGIENE_REPORT.md` is a committed tracked artifact containing all ten task results |
| No governance documents were modified                                                                   | Git diff on governance paths shows zero changes upon stage completion                                       |

---

## Assumptions

1. INFRA-16 (repository sanitization) and INFRA-21 (support surface routing and template migration) are already merged and stable on the base branch before this stage begins.
2. `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md` exists and is populated with authoritative surface declarations from INFRA-21.
3. `bun run ai-context:validate`, `bun run arch:guard`, and `bun run arch:health` are available and functioning as of the base branch state.
4. Dead script detection begins from `scripts/` only; generated build outputs are excluded.
5. Cleanup actions (deletion of dead scripts, removal of unused dependencies) are deferred to a human reviewer after consulting the hygiene report. This stage produces the report but does not perform destructive operations autonomously.
6. The hygiene report is an additive artifact; if a prior version exists, the new version replaces it.

---

## Out of Scope

- No ADR generation
- No new routing authority decisions
- No template system redesign
- No migration files
- No changes to architecture rules or governance documents
- No changes to `ROUTING_AUTHORITY_REGISTRY.md`
- No runtime feature changes
- No schema or data model modifications
- No CI workflow restructuring (detection only)
- No automatic deletion of flagged scripts or dependencies

---

## Clarifications

### Session 2026-03-15

- Q: T003 — What action should be taken when dead scripts are identified: generate a removal shell script, flag in hygiene report only, or flag and auto-delete? → A: Flag-in-report-only. Dead scripts are enumerated in the hygiene report under a "Scripts — Flagged for Review" section. No removal shell script is generated. This is consistent with the verification-only constraint and the "additive report artifacts only" pattern across all other tasks.

- Q: T004 — Should dependency hygiene check only the root `package.json`, or should it also check all workspace packages under `packages/*` and `apps/*`? → A: Check both top-level root `package.json` AND all workspace package dependencies (`packages/*` and `apps/*`). Each workspace package is checked independently. The report groups findings by workspace root.

- Q: T008 — If `bun run ai-context:validate` exits with a non-zero code because the script itself does not exist, should this be treated as SKIP, WARNING, or FAIL? → A: If the script does not exist (command not found or exit ≠ 0 due to missing script), treat as SKIP and document under "AI Context — Script Unavailable." If the script exists but returns errors about actual invalid artifacts, treat as WARNING. Only structural script execution errors (exit code 1 from actual validation failures) are FAIL. Stage completion is not blocked by a SKIP result.

- Q: T009 — If `arch:guard` reports pre-existing violations that were introduced before this stage, should they block stage completion or be documented only? → A: Pre-existing violations (introduced before this stage, not by any change in this branch) do NOT block stage completion. They are documented in the hygiene report under "Architecture Guard — Pre-existing Violations Found." Only violations introduced by this stage's own changes would block. Since this stage introduces no code changes, any violations found are pre-existing and are documented only.

- Q: T010 — Is the hygiene report committed to source control as a tracked artifact, or is it an ephemeral build output only? → A: The hygiene report IS committed to source control at `docs/reports/REPOSITORY_HYGIENE_REPORT.md` as part of this stage's implementation output. It is a tracked artifact, not an ephemeral deliverable.
