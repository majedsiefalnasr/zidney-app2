# Data Model: Support Surface Routing and Template Migration

## Entity: Support Surface

**Purpose**: Represents any in-scope repository path, file tree, shell entrypoint, document, or generated artifact governed by INFRA-21.

**Fields**:

- `surface_id`: Stable identifier derived from repository path
- `surface_type`: `routing_root | compatibility_root | shell_entrypoint | guidance_surface | root_artifact | generated_output | validation_surface`
- `path`: Repository-relative path
- `category`: `agents | prompts | templates | support_artifact | guidance | validation`
- `current_role`: `authoritative | legacy | duplicated | deferred | protected`
- `proposed_disposition`: `retain | migrate | mirror_for_compatibility | remove | regenerate_and_ignore | escalate`

**Relationships**:

- Has many `Blast-Radius Evidence Record` entries
- May be governed by one `Routing Authority Record`
- May participate in one or more `Migration Batch` entries

## Entity: Routing Authority Record

**Purpose**: Defines the single routing authority for a routing category and records its compatibility surfaces.

**Fields**:

- `routing_category`: `agents | prompts | templates`
- `authoritative_root`: Canonical repository path
- `legacy_surfaces`: List of compatibility paths
- `consumer_classes`: `shell_scripts | contributor_docs | agent_loaders | prompt_loaders | governance_docs | generated_indexes`
- `migration_policy`: Short description of how consumers move to the authority
- `retirement_criteria`: Explicit proof required before legacy removal

**Validation rules**:

- Each routing category must have exactly one `authoritative_root`.
- A legacy surface cannot be marked removable until all retirement criteria are satisfied.

## Entity: Blast-Radius Evidence Record

**Purpose**: Captures evidence that a support surface is still read, written, mirrored, or documented.

**Fields**:

- `evidence_id`: Unique identifier
- `surface_id`: Parent support surface
- `evidence_type`: `live_consumer | guidance_reference | deferred_scope_baseline | structural_inventory | validation_dependency | risk_signal`
- `source_location`: Path, report, or command result that produced the evidence
- `summary`: Human-readable explanation of the evidence
- `confidence`: `high | medium | low`
- `impact_level`: `direct | indirect | advisory`

**Validation rules**:

- `remove` is invalid if any unresolved `direct` evidence remains.
- Conflicting `high` confidence evidence forces `escalate` until resolved.

## Entity: Support Surface Decision

**Purpose**: Records the final planning decision for a governed support surface.

**Fields**:

- `decision_id`: Unique identifier
- `surface_id`: Target support surface
- `disposition`: `retain | migrate | mirror_for_compatibility | remove | regenerate_and_ignore | escalate`
- `reason`: Why this disposition was selected
- `blocking_evidence_ids`: Evidence that prevents retirement or removal
- `follow_up_condition`: `none | same_batch_migration | ignore_policy | replacement_path | human_review`

**State transitions**:

- `mirror_for_compatibility -> remove` only after same-batch migration and validation are complete
- `escalate -> retain` when ambiguity remains after evidence review
- `regenerate_and_ignore -> remove` only when ignore handling is in place and regeneration remains documented

## Entity: Migration Batch

**Purpose**: Represents a bounded, reversible change set used to migrate routing authority safely.

**Fields**:

- `batch_id`: Unique identifier
- `batch_type`: `authority_declaration | consumer_rewiring | compatibility_hardening | retirement_decision | artifact_cleanup`
- `touched_surfaces`: List of support surface identifiers
- `preconditions`: Required evidence and registry state before execution
- `validation_scope`: Commands and direct entrypoints that must pass before the batch is accepted
- `rollback_strategy`: `revert_batch | restore_compatibility_surface | reclassify_surface`
- `status`: `planned | applied | validated | deferred | rolled_back`

## Entity: Validation Gate Set

**Purpose**: Captures the required governance and routing checks for a migration batch.

**Fields**:

- `gate_set_id`: Unique identifier
- `commands`: Ordered list of validation commands
- `entrypoint_checks`: Touched shell scripts or loading paths that must be exercised directly
- `result`: `pass | fail | baseline_failure`
- `notes`: Baseline failure or remediation notes

**Validation rules**:

- Routing batches must include direct checks for touched `.specify/scripts/bash/*` entrypoints.
- A legacy surface cannot retire on a `baseline_failure` result unless the failure is proven unrelated and documented.

## Entity: Guidance Surface

**Purpose**: Represents documentation or agent instructions that describe where contributors should look for agents, prompts, or templates.

**Examples**:

- `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md`
- `.agents/agents/zidney-orchestrator.agent.md`
- `.github/agents/speckit.*`
- `.agents/agents/speckit.*`

**Rules**:

- Guidance surfaces may have distinct audiences, but they must agree on the same authoritative routing model.
- If two guidance surfaces remain, their role separation must be explicit and lossless.

## Entity: Root Support Artifact Candidate

**Purpose**: Represents deferred support artifacts outside the routing roots that still require an explicit INFRA-21 disposition.

**Examples**:

- `tsconfig.base.json.backup`
- `coverage/.tmp/coverage-*.json`

**Rules**:

- Root artifact candidates require blast-radius evidence before deletion.
- Generated artifacts must include ignore-policy or regeneration-policy review.

## Relationships Overview

- A `Support Surface` has many `Blast-Radius Evidence Record` entries.
- A `Routing Authority Record` governs one routing category and references one or more `Support Surface` entries.
- A `Support Surface Decision` records the planned outcome for one `Support Surface`.
- A `Migration Batch` executes changes for many `Support Surface` entries and requires one `Validation Gate Set`.
- `Guidance Surface` entries are specialized `Support Surface` records that must stay aligned with the `Routing Authority Record`.
- `Root Support Artifact Candidate` entries are specialized `Support Surface` records with stricter deletion conditions.
