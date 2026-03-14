# Implementation Plan: Support Surface Routing and Template Migration

**Branch**: `spec/infra-021-support-surface-routing-and-template-migration` | **Date**: 2026-03-14 | **Spec**: `/Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2/specs/runtime/infra-021-support-surface-routing-and-template-migration/spec.md`
**Input**: Feature specification from `/Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2/specs/runtime/infra-021-support-surface-routing-and-template-migration/spec.md`

## Summary

This stage plans a repository-governance migration that establishes one routing authority for agents, prompts, and templates; classifies widened support surfaces with auditable blast-radius evidence; and sequences compatibility-preserving consumer updates before any legacy retirement. The technical approach is intentionally bounded: create a routing authority registry, inventory and classify each governed support surface, migrate live shell and contributor entrypoints in the same batch, preserve `.github/*` and `.specify/templates/*` as compatibility surfaces until evidence proves they can retire, and validate through the existing Zidney governance chain without redesigning runtime, tenant, or contributor architecture.

## Technical Context

**Language/Version**: TypeScript 5.x, Bun workspace scripts, Bash shell tooling, Markdown/YAML/JSON governance assets  
**Primary Dependencies**: Bun, Vitest, Biome, Husky, actionlint/workflow validation, SpecKit shell scripts, architecture guard tooling, infra audit tooling, AI context refresh tooling  
**Storage**: Repository filesystem artifacts only; no database or tenant schema changes  
**Testing**: `bun run lint`, `bun run typecheck`, `bun run test`, `bun run arch:guard`, `bun scripts/ai-guard.ts`, `bun scripts/architecture-diff.ts`, `bun scripts/infra-audit.ts`, `bun scripts/validate-architecture-brain.ts`, `bun run type-safety-guard`, `bun run ai-context:refresh`, `bun run validate:workflows`, plus direct validation of `.specify/scripts/bash/create-new-feature.sh`, `.specify/scripts/bash/setup-plan.sh`, and `.specify/scripts/bash/update-agent-context.sh` when touched  
**Target Platform**: macOS/Linux developer environments and CI runners  
**Project Type**: Monorepo infrastructure-governance stage  
**Performance Goals**: Deterministic evidence collection for all governed support surfaces; zero silent routing divergence across canonical and compatibility roots; no broken contributor entrypoints after the migration batch  
**Constraints**: No runtime, tenant, license, attempt-engine, or module-boundary redesign; no deletion with unresolved references; `.github/*` and `.specify/templates/*` stay compatibility-only until same-batch consumer migration is complete; protected governance files default to no change  
**Scale/Scope**: `coverage/`, `tsconfig.base.json.backup`, `.agents/agents/`, `.agents/prompts/`, `.github/agents/`, `.github/prompts/`, `.specify/templates/`, `specs/templates/`, `.specify/scripts/bash/`, `docs/type-safety/`, `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md`, `package.json`, and adjacent contributor-routing, validation, and documentation surfaces required to keep those paths coherent

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Pre-Research Gate

- PASS: The stage is repository-governance-only and does not touch database-per-tenant isolation, tenant resolution, or license middleware ordering. ADR-0001 and ADR-0007 remain unchanged.
- PASS: The stage does not alter attempt snapshotting, grading authority, worker responsibility, or server-authoritative time. ADR-0002 and ADR-0006 remain unchanged.
- PASS: The stage does not introduce new app/package imports, dependency exceptions, or layer changes. Existing architecture contracts remain authoritative.
- PASS: The stage file is `DRAFT` but explicitly marks planning as authorized after clarification, so SpecKit planning is allowed without implementation drift.

### Post-Design Re-Check

- PASS: The design centers on support-surface classification, registry creation, and same-batch migration sequencing only; no runtime or tenant redesign appears in the plan.
- PASS: Compatibility-first sequencing preserves contributor entrypoints and governance safety instead of forcing same-day legacy deletion.
- PASS: Validation coverage remains the existing Zidney governance chain, extended only by direct shell-entrypoint verification for touched routing consumers.

## Project Structure

### Documentation (this feature)

```text
specs/runtime/infra-021-support-surface-routing-and-template-migration/
├── README.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── routing-authority-registry-contract.md
│   └── migration-batch-contract.md
├── reports/
└── tasks.md
```

### Source Code (repository root)

```text
.agents/
.github/
.specify/
docs/
specs/
package.json
coverage/
tsconfig.base.json.backup
```

### First-Party Consumer And Evidence Surfaces

```text
.specify/scripts/bash/create-new-feature.sh
.specify/scripts/bash/setup-plan.sh
.specify/scripts/bash/update-agent-context.sh
docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md
specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/
```

**Structure Decision**: This is a documentation-first infrastructure-governance stage. The implementation surface is repository support-surface routing, template authority, and migration safety across existing contributor entrypoints rather than a new application or package.

## Phase 0 Research Outcomes

Research resolves the stage decisions required to keep routing and template migration safe:

- Canonical routing roots are fixed to `.agents/agents/`, `.agents/prompts/`, and `specs/templates/`, with `.github/*` and `.specify/templates/*` retained only as compatibility surfaces.
- Blast-radius evidence must combine current repository consumers and INFRA-16 deferred-scope evidence, not rely on a fresh scan alone.
- Support-surface decisions use explicit states: `retain`, `migrate`, `mirror_for_compatibility`, `remove`, `regenerate_and_ignore`, and `escalate`.
- The routing authority registry at `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md` becomes the single source of truth for routing categories, legacy surfaces, consumer classes, and retirement criteria.
- Migration sequencing must update live shell entrypoints and contributor-routing references in the same batch before any compatibility surface is retired.
- Validation remains the existing governance pipeline plus direct shell-entrypoint checks for touched loading paths.

See `research.md` for rationale and alternatives.

## Phase 1 Design

### Blast-Radius Evidence Collection Model

Each governed support surface must be backed by evidence from four sources before a migration decision is accepted:

1. Live consumer evidence

- `.specify/scripts/bash/setup-plan.sh` copies `.specify/templates/plan-template.md`.
- `.specify/scripts/bash/create-new-feature.sh` copies `.specify/templates/spec-template.md`.
- `.specify/scripts/bash/update-agent-context.sh` writes `.github/agents/copilot-instructions.md` and reads `.specify/templates/agent-file-template.md`.

1. Template parity and direct consumer evidence

- `specs/templates/plan-template.md` already exists and is the canonical target for `.specify/scripts/bash/setup-plan.sh`.
- `specs/templates/specify-template.md` exists, but `.specify/scripts/bash/create-new-feature.sh` currently consumes `.specify/templates/spec-template.md`, so the consumer rewiring batch must either add a canonical `specs/templates/spec-template.md` equivalent or update the script and compatibility layer to map `specify-template.md` explicitly without ambiguity.
- `specs/templates/tasks-template.md` exists, but active agent guidance still references `.specify/templates/tasks-template.md` in `.agents/agents/speckit.tasks.agent.md` and `.agents/agents/speckit.constitution.agent.md`, plus their `.github/agents/*` compatibility mirrors.
- `specs/templates/` does not yet contain canonical equivalents for `.specify/templates/checklist-template.md`, `.specify/templates/constitution-template.md`, or `.specify/templates/agent-file-template.md`, so the migration plan must treat those as parity-gated consumers: either add canonical equivalents under `specs/templates/` first or keep `.specify/templates/` mirrored as an explicit compatibility implementation until parity is created.

### Direct Consumer Map

The migration cannot rely on routing-category summaries alone. The following file-level consumers must be treated as first-class migration targets:

| Consumer Path                                   | Current Dependency                                                                                     | Canonical Target                                                                                          | Required Batch Behavior                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `.specify/scripts/bash/create-new-feature.sh`   | `.specify/templates/spec-template.md`                                                                  | `specs/templates/spec-template.md` or explicit canonical mapping to `specs/templates/specify-template.md` | Rewire only after canonical parity is created and verified                       |
| `.specify/scripts/bash/setup-plan.sh`           | `.specify/templates/plan-template.md`                                                                  | `specs/templates/plan-template.md`                                                                        | Update in `consumer_rewiring` batch                                              |
| `.specify/scripts/bash/update-agent-context.sh` | `.specify/templates/agent-file-template.md`                                                            | `specs/templates/agent-file-template.md` after parity creation                                            | Keep compatibility behavior until canonical equivalent exists                    |
| `.agents/agents/speckit.specify.agent.md`       | `.specify/templates/spec-template.md`                                                                  | canonical spec template location declared in registry                                                     | Rewrite guidance in the same batch as script rewiring                            |
| `.github/agents/speckit.specify.agent.md`       | `.specify/templates/spec-template.md`                                                                  | compatibility mirror of canonical guidance                                                                | Update alongside `.agents/agents/*`                                              |
| `.agents/agents/speckit.tasks.agent.md`         | `.specify/templates/tasks-template.md`                                                                 | `specs/templates/tasks-template.md`                                                                       | Rewrite guidance in the same batch as authority declaration or consumer rewiring |
| `.github/agents/speckit.tasks.agent.md`         | `.specify/templates/tasks-template.md`                                                                 | compatibility mirror of canonical guidance                                                                | Update alongside `.agents/agents/*`                                              |
| `.agents/agents/speckit.checklist.agent.md`     | `.specify/templates/checklist-template.md`                                                             | `specs/templates/checklist-template.md` after parity creation                                             | Parity-gated; do not retire legacy path first                                    |
| `.github/agents/speckit.checklist.agent.md`     | `.specify/templates/checklist-template.md`                                                             | compatibility mirror of canonical guidance                                                                | Update alongside `.agents/agents/*`                                              |
| `.agents/agents/speckit.constitution.agent.md`  | `.specify/templates/{constitution,plan,spec,tasks}-template.md` and `.specify/templates/commands/*.md` | canonical `specs/templates/*` set after parity creation                                                   | Requires file-by-file mapping and staged guidance rewrite                        |
| `.github/agents/speckit.constitution.agent.md`  | `.specify/templates/{constitution,plan,spec,tasks}-template.md` and `.specify/templates/commands/*.md` | compatibility mirror of canonical guidance                                                                | Update alongside `.agents/agents/*`                                              |

1. Contributor and governance guidance evidence

- `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md` directs operators to `specs/templates/*`.
- `.agents/agents/zidney-orchestrator.agent.md` already treats `specs/templates/*` as the canonical template source for reporting and commit guidance.

1. Deferred-scope baseline evidence

- INFRA-16 reports already classify `.github/*`, `.agents/*`, `.specify/templates/*`, `coverage/.tmp/coverage-*.json`, and `tsconfig.base.json.backup` as unresolved support surfaces requiring manual review.

1. Structural inventory evidence

- `.agents/agents/` and `.agents/prompts/` contain the full Zidney-local agent and prompt surface.
- `.github/agents/` and `.github/prompts/` still contain active Speckit compatibility assets.
- `coverage/.tmp/` contains a large numbered JSON set consistent with generated temporary coverage output.

### Support-Surface Classification Model

Every in-scope path is classified using one final disposition:

- `retain`: Keep as-is because it remains authoritative or required.
- `migrate`: Move the active consumer or source of truth to the authoritative root in the same batch.
- `mirror_for_compatibility`: Keep a legacy surface temporarily, but record it as non-authoritative with explicit retirement criteria.
- `remove`: Delete only after zero unresolved references or a complete replacement path is proven.
- `regenerate_and_ignore`: For generated artifacts such as temporary coverage output when regeneration is intentional and ignore handling is defined.
- `escalate`: Use when evidence conflicts or when retirement would touch protected governance authority beyond the stage boundary.

Initial planning baseline:

- `.agents/agents/` and `.agents/prompts/`: `retain` as authoritative routing roots.
- `.github/agents/` and `.github/prompts/`: `mirror_for_compatibility` until all affected loading paths and contributor expectations are migrated in the same batch.
- `specs/templates/`: `retain` as authoritative template root.
- `.specify/templates/`: `mirror_for_compatibility` until `.specify/scripts/bash/*` and any remaining automation consumers are migrated.
- `coverage/.tmp/coverage-*.json`: `regenerate_and_ignore` candidate pending ignore-policy confirmation.
- `tsconfig.base.json.backup`: `remove` candidate only if no non-text consumer is found during implementation evidence collection.

### Routing Authority Registry Design

The stage introduces `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md` as the repository routing control plane.

Each routing category entry must record:

- routing category: `agents | prompts | templates`
- authoritative root
- legacy compatibility surfaces
- consumer classes affected by a change
- migration policy
- retirement criteria
- validation evidence required before legacy retirement

The registry is a preventive governance control, not just migration documentation. Future cleanup stages may only retire a legacy routing surface when the registry marks it non-authoritative and the recorded retirement criteria are satisfied.

### Compatibility-Preserving Migration Sequence

The migration should execute in bounded batches:

1. Authority declaration batch

- Create the routing authority registry.
- Publish the support-surface inventory and dispositions.
- Do not retire any legacy surface in this batch.

1. Consumer rewiring batch

- Update `.specify/scripts/bash/setup-plan.sh` and `.specify/scripts/bash/create-new-feature.sh` to resolve canonical templates from `specs/templates/`.
- Update `.specify/scripts/bash/update-agent-context.sh` to align agent output and template loading with the authoritative routing model while preserving compatibility behavior.
- Update affected Speckit agent/prompt guidance that still hardcodes legacy template roots.
- Do not rewire a consumer until the exact canonical target file exists in `specs/templates/` and the registry records the compatibility rule for any remaining legacy path.

1. Template parity batch

- Create or formally map canonical equivalents for `.specify/templates/spec-template.md`, `.specify/templates/checklist-template.md`, `.specify/templates/constitution-template.md`, and `.specify/templates/agent-file-template.md` under `specs/templates/`.
- Record a file-by-file parity matrix in the routing authority registry so each legacy template has one canonical target.
- If any template family still lacks canonical parity after analysis, keep `.specify/templates/` as an explicit compatibility implementation for that family and mark retirement as blocked.

1. Compatibility hardening batch

- Keep `.github/*` and `.specify/templates/*` present as compatibility surfaces.
- Add explicit redirect or mirroring rules so legacy consumers cannot silently diverge from the canonical roots.
- Confirm contributor docs and governance docs point to the same authority model.
- Keep `.agents/*` and `.github/*` Speckit guidance synchronized for any file whose instructions mention template paths until `.github/*` retirement criteria are satisfied.

1. Retirement decision batch

- Only after the previous batches validate cleanly, assess whether any compatibility surface can move from `mirror_for_compatibility` to `remove`.
- If evidence is incomplete, retain the compatibility surface and record deferred retirement criteria rather than forcing cleanup.

### Validation Coverage

The minimum post-migration gate set is:

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run arch:guard`
- `bun scripts/ai-guard.ts`
- `bun scripts/architecture-diff.ts`
- `bun scripts/infra-audit.ts`
- `bun scripts/validate-architecture-brain.ts`
- `bun run type-safety-guard`
- `bun run ai-context:refresh`
- `bun run validate:workflows`

If routing or template entrypoints change, also verify:

- `.specify/scripts/bash/create-new-feature.sh`
- `.specify/scripts/bash/setup-plan.sh`
- `.specify/scripts/bash/update-agent-context.sh`
- the affected `.github/*` and `.agents/*` loading paths

Validation is considered complete only when both the governance chain and the touched contributor entrypoints resolve the same authority model.

### Risk Controls And Boundaries

- No batch may introduce a runtime, tenant, license, or attempt-engine behavior change.
- No batch may alter app/package module boundaries or add cross-layer dependencies.
- Protected governance authority files remain no-change unless a minimal migration update is required to preserve routing consistency.
- Ambiguous deletions default to retention or compatibility mirroring.
- Generated-output cleanup must pair deletion with ignore-policy or regeneration-path confirmation.
- Missing canonical template parity is a hard blocker for retiring or silently demoting `.specify/templates/*` consumers.

## Deliverables

- `plan.md`: bounded migration strategy, constitution checks, sequencing, and validation design
- `research.md`: routing authority, evidence, classification, and migration decisions with rationale
- `data-model.md`: support-surface, registry, evidence, and validation entities
- `quickstart.md`: operator workflow for executing the migration safely
- `contracts/routing-authority-registry-contract.md`: contract for the registry contents and retirement criteria
- `contracts/migration-batch-contract.md`: contract for same-batch migration sequencing, validation, and rollback

## Complexity Tracking

No constitution violations or justified exceptions are required for this plan.
