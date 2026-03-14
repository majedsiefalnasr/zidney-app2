# STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION

## Stage Status

Status: BACKEND CLOSED
Step: implement
Risk Level: LOW
Last Updated: 2026-03-14T14:30:21Z

Scope Defined:

- Canonical routing roots remain `.agents/agents/`, `.agents/prompts/`, and `specs/templates/`
- Atomic task graph generated for evidence collection, registry authoring, parity creation, consumer rewiring, compatibility hardening, and validation
- Full governance validation and routing-entrypoint verification captured as required task work

Deferred Scope:

- Runtime, tenant, license, and attempt-engine redesign

Drift Analysis: PASSED (all criteria)
Implementation: AUTHORIZED

Scope Authorized:

- Canonical routing roots remain `.agents/agents/`, `.agents/prompts/`, and `specs/templates/`
- Task graph includes explicit parity gating, recurring validation cadence, retirement decisions, authorized cleanup, and final reconciliation controls
- Analyze coverage now spans routing registry consultation, prompt/template compatibility, support artifacts, protected surfaces, and final-state validation

Constitutional Compliance:

- Implementation completed across the authorized support surfaces
- Local environment prerequisites, repository-wide tests, lint, typecheck, and type-safety validation now pass
- No additional structural backend work remains inside the approved scope

Notes:
Implementation work is complete and the mandatory validation gate passed. The stage is ready for pre-closure review and closure artifact generation.

## Purpose

This stage opens the follow-up remediation path that INFRA-16 explicitly deferred.

Its job is to widen scope in a controlled way for repository surfaces that were discovered to be likely removable or consolidatable, but were not safe to touch inside the stricter INFRA-16 cleanup boundary.

This stage exists because INFRA-16 proved:

- some root support artifacts look stale but sit outside the approved cleanup roots
- prompt and agent routing surfaces are duplicated across `.github/*` and `.agents/*`
- the current template system is split between runtime shell execution under `.specify/templates/*` and governance/operator guidance under `specs/templates/*`

This stage must convert those findings into an explicit migration plan rather than relying on ad hoc cleanup.

## Predecessor Reference

This stage follows:

`STAGE_INFRA_16_REPOSITORY_SANITIZATION_AND_DEAD_CODE_ELIMINATION`

INFRA-16 remains responsible only for the conservative repository sanitization pass.

This stage supersedes the deferred boundary from INFRA-16 for:

- `tsconfig.base.json.backup`
- `coverage/.tmp/coverage-*.json`
- `.github/agents/*` vs `.agents/agents/*`
- `.github/prompts/*` vs `.agents/prompts/*`
- `.specify/templates/*` vs `specs/templates/*`
- any related wiring changes needed in scripts, docs, or protected-adjacent routing surfaces

## Scope

This stage may analyze and, where proven safe, modify the following repository surfaces:

```
coverage/
tsconfig.base.json.backup
.github/agents/
.github/prompts/
.agents/agents/
.agents/prompts/
.specify/templates/
specs/templates/
.specify/scripts/bash/
docs/type-safety/
docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md
package.json
related validation, routing, and contributor-guidance surfaces
```

The stage must remain architecture-safe and may not weaken:

- `.github/workflows/hard-mode-guard.yml`
- `.github/workflows/architecture-governance.yml`
- `.husky/pre-commit`
- `.husky/pre-push`
- `AGENTS.md`
- `docs/AGENT_GOVERNANCE.md`
- `docs/PROJECT_CONTEXT_PRIMER.md`
- `specs/STAGE_LIFECYCLE_POLICY.md`

Any mutation to protected governance authority files must be explicitly justified, minimal, and validated.

## Objectives

### 1. Root Support Artifact Resolution

Resolve root-level support artifacts that INFRA-16 identified but deferred.

Examples include:

```
tsconfig.base.json.backup
coverage/.tmp/coverage-*.json
```

This stage must determine whether each artifact should be:

- removed
- regenerated and ignored
- retained with a documented owner

### 2. Prompt And Agent Routing Consolidation

Evaluate and migrate duplicate prompt and agent routing surfaces across:

```
.github/agents/
.agents/agents/
.github/prompts/
.agents/prompts/
```

The outcome must identify one authoritative routing model and preserve contributor tooling compatibility.

### 3. Template System Migration

Unify the current template split between:

```
.specify/templates/*
specs/templates/*
```

The migration must ensure:

- shell entrypoints resolve the intended authoritative templates
- governance docs point to the same authoritative template system
- no hidden runtime dependency continues pointing at an orphaned template tree

### 4. Lossless Guidance Consolidation

Where overlapping governance or contributor guidance exists, the stage must either:

- consolidate documents losslessly
- introduce explicit redirects or references
- retain both surfaces with documented purpose separation

Silent deletion is forbidden.

## Required Analysis

Before implementation, this stage must produce explicit blast-radius evidence for:

- every root support artifact candidate
- every prompt and agent routing path
- every template bootstrap entrypoint
- every contributor-facing or governance-facing document changed as part of migration

The analysis must include:

- direct file references
- script entrypoints
- workflow and hook consumers
- doc links
- runtime or tooling generators that write or read the affected surfaces

## Safety Rules

- No deletion is allowed unless the stage proves either zero unresolved references or a complete replacement path.
- If a routing surface is changed, all affected contributors, scripts, and automation paths must be updated in the same batch.
- If templates are migrated, the old and new template roots must not diverge silently.
- Generated-output cleanup must be paired with ignore-policy or regeneration-policy review where applicable.
- Protected governance authority files default to no-change unless required for consistent migration.

## Routing And Template Authority Registry (Preventive Control)

To prevent future repository-sanitization stages from being blocked by ambiguous routing surfaces, this stage must establish a single authoritative registry that declares the canonical locations for agents, prompts, and templates.

The registry must be created at:

```
docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md
```

The registry must explicitly declare the authoritative source for each routing surface.

Example structure:

```
Agents
Authoritative Root: .agents/agents/
Legacy Surface: .github/agents/
Migration Policy: legacy mirror retained only for compatibility until fully retired

Prompts
Authoritative Root: .agents/prompts/
Legacy Surface: .github/prompts/
Migration Policy: legacy mirror removed after contributor tooling migration

Templates
Authoritative Root: specs/templates/
Legacy Surface: .specify/templates/
Migration Policy: shell entrypoints updated to canonical templates
```

Rules enforced by this registry:

- Every routing surface must have exactly one declared authoritative root.
- Any legacy or mirrored surface must include a documented migration or compatibility policy.
- Future cleanup stages may delete a legacy surface only if it is declared non-authoritative in this registry and no active tooling depends on it.

This registry becomes the **single source of truth** for routing decisions and must be consulted by:

- future sanitization stages
- architecture audits
- repository cleanup scripts

By introducing this registry, the repository prevents future cleanup stages from being blocked by routing ambiguity between duplicate surfaces.

## Validation Requirements

At minimum this stage must re-run and record:

```
bun run lint
bun run typecheck
bun run test
bun run arch:guard
bun scripts/ai-guard.ts
bun scripts/architecture-diff.ts
bun scripts/infra-audit.ts
bun scripts/validate-architecture-brain.ts
bun run type-safety-guard
bun run ai-context:refresh
bun run validate:workflows
```

If routing or template entrypoints change, this stage must also validate:

- `.specify/scripts/bash/create-new-feature.sh`
- `.specify/scripts/bash/setup-plan.sh`
- `.specify/scripts/bash/update-agent-context.sh`
- any affected agent/prompt loading path

## Exit Criteria

This stage may close only when:

- every widened-scope artifact from INFRA-16 has a final disposition
- one authoritative routing model is documented for prompts and agents
- one authoritative template system is documented and enforced
- any retained duplicate surface has a documented reason to exist
- validation evidence proves no new governance or routing regressions

## Non-Goals

This stage does not reopen INFRA-16’s conservative Finder-noise cleanup.

This stage does not authorize unrelated runtime redesign, tenant logic changes, or attempt-engine changes.

This stage does not weaken the constitutional governance chain for the sake of cleanup convenience.
