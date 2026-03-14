# Data Model: Repository Sanitization and Dead Code Elimination

## Entity: Repository Asset

**Purpose**: Represents any in-scope file, directory, dependency entry, package, workflow, hook, or documentation artifact examined during sanitization.

**Fields**:

- `asset_id`: Stable identifier derived from repository path or manifest key
- `asset_type`: `source_file | directory | package | dependency | script | workflow | hook | skill | document | generated_artifact | report`
- `path_or_key`: Repository path or `package.json` dependency/script key
- `scope_root`: `apps | packages | scripts | .agents/skills | docs | .github/workflows | .husky | package.json`
- `owner_surface`: module or governance surface primarily responsible for the asset
- `current_state`: `active | inactive | duplicate | protected | ambiguous`

**Relationships**:

- Has many `Evidence Record`
- May belong to one `Duplicate Group`
- May be covered by one or more `Protection Rules`

## Entity: Evidence Record

**Purpose**: Captures a single piece of evidence used to support retention, protection, consolidation, or removal.

**Fields**:

- `evidence_id`: Unique record identifier
- `asset_id`: Parent repository asset
- `evidence_type`: `code_reference | governance_reference | execution_reference | structural_role | duplication_evidence | risk_evidence`
- `source_location`: Path, manifest entry, or command result that produced the evidence
- `summary`: Human-readable explanation of the evidence
- `confidence`: `high | medium | low`
- `status`: `supports_active_use | supports_protection | supports_duplicate | supports_removal | conflicts`

**Validation rules**:

- `supports_removal` is insufficient on its own if any unresolved active or protected evidence exists.
- `conflicts` forces escalation to manual review until resolved.

## Entity: Protection Rule

**Purpose**: Describes why an asset is protected from sanitization.

**Fields**:

- `rule_id`: Unique rule identifier
- `rule_type`: `hard_allowlist | derived_governance_protection`
- `matcher`: Path, directory, manifest key, or predicate
- `reason`: Governance, architecture, AI-context, CI, or hook preservation reason
- `supersession_requirement`: What must exist before the protection can be lifted

## Entity: Duplicate Group

**Purpose**: Represents a set of artifacts serving the same governed purpose.

**Fields**:

- `group_id`: Unique group identifier
- `purpose`: Repository-governance purpose such as validation, documentation, deployment, or contributor routing
- `member_assets`: List of asset identifiers
- `authoritative_asset_id`: Selected survivor, if known
- `merge_required`: Boolean indicating whether unique behavior must be consolidated before removal
- `status`: `pending | resolved | manual_review`

**State transitions**:

- `pending -> resolved` when one authoritative artifact is selected and any unique content is preserved
- `pending -> manual_review` when survivor selection would materially alter behavior or workflow

## Entity: Sanitization Decision

**Purpose**: Records the final proposed outcome for each asset.

**Fields**:

- `decision_id`: Unique identifier
- `asset_id`: Target asset
- `decision`: `retain | protect | consolidate | remove | manual_review`
- `rationale`: Summary of the decision logic
- `blocking_evidence_ids`: Evidence preventing removal, if any
- `expected_follow_up`: `none | merge | validate | human_review`

**Validation rules**:

- `remove` requires no unresolved blocking evidence.
- `consolidate` requires a defined authoritative artifact or a manual-review escalation.
- `protect` takes precedence over low-frequency usage concerns.

## Entity: Validation Run

**Purpose**: Captures the acceptance-gate outcome for a sanitization batch.

**Fields**:

- `validation_run_id`: Unique identifier
- `batch_id`: Cleanup batch under validation
- `commands`: Ordered list of required validation commands
- `result`: `pass | fail | baseline_failure`
- `failed_gate`: Gate name if the run fails
- `notes`: Baseline exception or remediation notes

## Entity: Support Surface

**Purpose**: Captures repository files that provide evidence or require reference-integrity updates after approved cleanup but are not primary sanitization candidates.

**Examples**:

- `tests/`
- `bun.lock`
- `vitest.config.ts`
- `vitest.workspace.ts`
- `lint-staged.config.mjs`

**Rules**:

- Support surfaces may be read as evidence sources during classification.
- Support surfaces may be updated only to preserve reference integrity after an approved cleanup batch.
- Support surfaces must not be treated as independent cleanup targets in this stage.

## Entity: Rollback Batch

**Purpose**: Defines a reversible unit of cleanup work.

**Fields**:

- `batch_id`: Unique identifier
- `asset_ids`: Assets changed in the batch
- `change_class`: `generated_artifact_cleanup | duplicate_consolidation | dependency_prune | dead_asset_removal`
- `rollback_strategy`: `revert_batch | reclassify_candidate | restore_survivor`
- `status`: `planned | applied | rolled_back | accepted`

## Entity: Sanitization Report

**Purpose**: Human-readable summary of repository sanitization results.

**Fields**:

- `report_id`: Unique identifier
- `decision_summary`: Counts by decision type
- `protected_assets`: Explicit list or grouped summary of protected assets
- `removed_assets`: Explicit list of removed items
- `consolidated_groups`: Duplicate groups resolved through consolidation
- `manual_review_items`: Unresolved candidates requiring follow-up
- `validation_runs`: Linked validation evidence

## Relationships Overview

- A `Repository Asset` has many `Evidence Record` entries.
- A `Repository Asset` can have one `Sanitization Decision`.
- A `Repository Asset` can be covered by many `Protection Rule` entries.
- Many `Repository Asset` entries can belong to one `Duplicate Group`.
- Many `Sanitization Decision` entries can be executed in one `Rollback Batch`.
- A `Rollback Batch` must have at least one `Validation Run` before it is accepted.
- The `Sanitization Report` aggregates decisions, duplicate groups, and validation runs.
