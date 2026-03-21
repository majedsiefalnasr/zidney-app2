# Contract: Migration Batch

## Purpose

Define the minimum contents for any INFRA-21 implementation batch that changes routing or template authority consumers.

## Required Batch Types

- `authority_declaration`
- `template_parity`
- `consumer_rewiring`
- `compatibility_hardening`
- `retirement_decision`
- `artifact_cleanup`

## Required Fields Per Batch

- `Batch ID`
- `Batch Type`
- `Touched Surfaces`
- `Preconditions`
- `Consumer Classes Affected`
- `Compatibility Behavior`
- `Validation Scope`
- `Rollback Strategy`
- `Exit Condition`

## Batch Rules

### Authority Declaration Batch

- Must create or update the routing authority registry.
- Must not remove any legacy surface.

### Template Parity Batch

- Must establish the canonical target or explicit alias for every live `.specify/templates/*` consumer before rewiring begins.
- Must remove or rewrite stale guidance references to nonexistent template trees instead of inventing parity for them.
- Must record parity proof in the routing authority registry and the stage parity matrix.

### Consumer Rewiring Batch

- Must update all touched first-party consumers in the same batch.
- Must include `.specify/scripts/bash/create-new-feature.sh`, `.specify/scripts/bash/setup-plan.sh`, or `.specify/scripts/bash/update-agent-context.sh` whenever those paths are affected.
- Must not leave a touched consumer pointing at conflicting authority models.
- Must not rewire a template consumer to `specs/templates/` unless the exact canonical target file exists or an explicit file-level mapping is documented in the routing authority registry.

### Compatibility Hardening Batch

- Must keep legacy surfaces explicit and non-authoritative.
- Must prevent silent divergence through redirects, mirroring, or documented role separation.
- Must keep `.agents/*` and `.github/*` guidance synchronized wherever both surfaces remain active compatibility consumers.

### Retirement Decision Batch

- May remove a compatibility surface only when the registry retirement criteria are satisfied.
- Must include blast-radius evidence showing no unresolved direct consumers remain.
- Must treat missing template parity or unresolved file-level consumer mappings as a hard stop.

### Artifact Cleanup Batch

- For generated output, must pair cleanup with ignore-policy or regeneration-policy confirmation.
- For root support artifacts, must include a replacement path or proof of inactivity.

## Validation Scope

Every routing-affecting batch must run direct smoke validation for touched consumers and capture the results in the validation ledger.

Required per-batch checks:

- direct verification of touched `.specify/scripts/bash/*` entrypoints
- direct path-resolution checks for touched `.agents/*`, `.github/*`, `.agents/prompts/*`, and `.github/prompts/*` surfaces
- registry and compatibility checks proving touched consumers still resolve one authority model

The full governance suite must run after `consumer_rewiring` and `compatibility_hardening` are complete, again before any `retirement_decision` or `artifact_cleanup` batch that removes or mutates a legacy surface, and again after the final cleanup state is applied:

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run arch:guard`
- `bun scripts/ai-guard.ts`
- `bun scripts/architecture-diff.ts`
- `bun scripts/infra-audit.ts`
- `bun scripts/validate-architecture-brain.ts`
- `bun run arch:type-safety-guard`
- `bun run ai:context:refresh`
- `bun run validate:workflows`

## Rollback Rules

- Roll back the current batch only.
- Reclassify the affected surface to `mirror_for_compatibility`, `retain`, or `escalate` if validation fails.
- Do not use destructive repository reset commands as the batch rollback strategy.

## Exit Condition

A batch is complete only when:

- all planned touched consumers resolve the same authority model
- required compatibility behavior is present
- validation passes or unrelated baseline failures are documented
- no runtime, tenant, or architecture redesign was introduced
