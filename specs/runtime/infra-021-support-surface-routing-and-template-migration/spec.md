# Feature Specification: Support Surface Routing and Template Migration

**Feature Branch**: `spec/infra-021-support-surface-routing-and-template-migration`  
**Created**: 2026-03-14  
**Status**: Draft  
**Input**: User description: "Execute Step 1 Specify for stage STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION in phase 01_PLATFORM_FOUNDATION inside the Zidney repository. Use the current branch spec/infra-021-support-surface-routing-and-template-migration and generate the standard SpecKit artifacts in specs/runtime/infra-021-support-surface-routing-and-template-migration/. Constraints: architecture-safe only, no architecture redesign, preserve Hard Mode workflow integrity, preserve contributor-routing safety, no tenant/runtime redesign, and align with the stage file specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION.md."

## Stage Context

- **Stage**: STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION
- **Phase**: 01_PLATFORM_FOUNDATION
- **Stage File**: `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION.md`
- **Feature Directory**: `specs/runtime/infra-021-support-surface-routing-and-template-migration`
- **Stage Status**: DRAFT
- **Workflow Step**: Tasks

## Scope Boundaries

This stage is limited to repository support surfaces that influence contributor routing, template authority, and support-artifact hygiene. The primary governed surfaces are:

- `coverage/`
- `tsconfig.base.json.backup`
- `.github/agents/`
- `.github/prompts/`
- `.agents/agents/`
- `.agents/prompts/`
- `.specify/templates/`
- `specs/templates/`
- `.specify/scripts/bash/`
- `docs/type-safety/`
- `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md`
- `package.json`
- related validation, routing, contributor-guidance, and compatibility surfaces required to keep those paths consistent

This stage may document and rationalize those surfaces, but it must not redesign Zidney architecture, tenant isolation, runtime responsibilities, attempt behavior, or the Hard Mode governance chain.

## Constitutional Compliance

This stage remains inside repository-governance scope.

- Database-per-tenant remains unchanged.
- No tenant-resolution, license-enforcement, or runtime-authority behavior is altered.
- No app-to-app or package-to-app dependency exceptions are introduced.
- Hard Mode workflow integrity remains authoritative.
- Contributor-routing safety is preserved through explicit authority and compatibility rules rather than ad hoc deletion.

## Clarifications

### Session 2026-03-14

No interactive clarification questions were required for this specification. The stage file, current repository references, and Hard Mode governance guidance already constrain the authority model tightly enough to lock the canonical routing roots without widening scope.

This clarify pass locks the canonical routing authority model for the stage as follows:

- Agents: `.agents/agents/` is the authoritative root; `.github/agents/` remains a legacy compatibility surface only until all affected contributor-loading paths are migrated in the same batch.
- Prompts: `.agents/prompts/` is the authoritative root; `.github/prompts/` remains a legacy compatibility surface only until all affected contributor-loading paths are migrated in the same batch.
- Templates: `specs/templates/` is the authoritative root; `.specify/templates/` remains a legacy execution-compatibility surface only until `.specify/scripts/bash/*` and any other live consumers are migrated in the same batch.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Establish a Single Routing Authority (Priority: P1)

As a repository maintainer, I want every prompt, agent, and template surface to have one declared authoritative source, so contributors and automation stop following conflicting routing paths.

**Why this priority**: Routing ambiguity is the core blocker this stage was opened to resolve. Without a single authority model, cleanup remains unsafe and future contributors can keep writing to the wrong surface.

**Independent Test**: Review the specification and confirm each governed routing surface has one authoritative root, any legacy surface has an explicit compatibility policy, and the registry is defined as the single source of truth for later stages.

**Acceptance Scenarios**:

1. **Given** duplicated routing surfaces for agents, prompts, or templates, **When** the stage defines the target state, **Then** exactly one authoritative root is declared for each routing category.
2. **Given** a retained legacy or mirrored routing surface, **When** the stage documents its role, **Then** the spec explains why it still exists and what compatibility or migration policy governs it.

---

### User Story 2 - Resolve Widened Support Artifacts Safely (Priority: P2)

As a platform governance maintainer, I want each widened-scope support artifact to receive an explicit disposition backed by evidence, so cleanup can proceed without deleting files that still matter to workflows, docs, hooks, or contributor guidance.

**Why this priority**: INFRA-16 deferred these surfaces because they could not be treated as ordinary dead-code cleanup. This follow-up stage only succeeds if it replaces ambiguity with explicit evidence-backed decisions.

**Independent Test**: Inspect the specification and confirm every root artifact candidate and duplicated support surface must be classified as removed, retained, migrated, mirrored for compatibility, or escalated, with blast-radius evidence before any deletion occurs.

**Acceptance Scenarios**:

1. **Given** a root support artifact that appears stale, **When** the stage evaluates it, **Then** the artifact receives a documented final disposition supported by repository evidence.
2. **Given** a support surface with unresolved references or uncertain ownership, **When** the stage reaches a decision point, **Then** the surface is retained or migrated with compatibility coverage instead of being deleted silently.

---

### User Story 3 - Keep Hard Mode and Contributor Workflows Intact (Priority: P3)

As a contributor using SpecKit and repository governance tooling, I want routing and template migration to preserve existing workflow entrypoints or update them losslessly in one batch, so specification, planning, and validation continue to work without hidden regressions.

**Why this priority**: This stage affects contributor-facing surfaces and shell entrypoints. A technically correct cleanup still fails if it strands contributors on orphaned templates or stale routing paths.

**Independent Test**: Review the specification and confirm it requires every affected shell entrypoint, guidance surface, and compatibility path to be updated consistently when authority changes, with validation expectations captured for the same batch.

**Acceptance Scenarios**:

1. **Given** a template or routing authority change, **When** the migration is applied, **Then** all affected contributor entrypoints and guidance references are updated together.
2. **Given** overlapping governance or contributor guidance, **When** consolidation is specified, **Then** the resulting guidance retains all necessary instructions through consolidation, redirect references, or documented role separation.

### Edge Cases

- A file appears unused in source code but is still referenced by Git hooks, workflow validation, agent-routing instructions, or shell scripts.
- A legacy routing surface must remain temporarily for contributor compatibility even after a new authority root is declared.
- The authoritative template tree changes, but one shell entrypoint still resolves an older path and would silently diverge without same-batch updates.
- A generated artifact under `coverage/` looks removable, but repository policy still requires either ignore handling or a documented regeneration path.
- Two guidance documents overlap heavily, but each contains distinct instructions that would be lost if one were removed without lossless consolidation.
- A protected governance file becomes adjacent to the migration path but still defaults to no change unless the migration cannot remain consistent without a minimal update.

## Assumptions

- INFRA-21 is a follow-up governance stage for widened support surfaces only; it does not reopen runtime or product behavior design.
- Safety outweighs cleanup speed: if routing, template, or artifact evidence is incomplete, the stage retains the surface or applies an explicit compatibility policy.
- The stage file is authoritative for required validation, migration boundaries, and protected governance surfaces.
- The authoritative routing registry becomes the single reference point for later cleanup, contributor guidance, and audit decisions.
- Any legacy surface retained after migration must have a documented reason to exist and a defined migration or compatibility policy.

## In Scope

- Classifying widened support artifacts deferred by INFRA-16.
- Declaring one authoritative model for agent, prompt, and template routing.
- Defining the routing authority registry and the rules it enforces.
- Defining how contributor-facing shell entrypoints and guidance surfaces remain aligned during migration.
- Requiring blast-radius evidence and validation coverage for every changed support surface.
- Lossless consolidation or explicit separation of overlapping contributor and governance guidance.

## Out of Scope

- Redesigning runtime architecture, tenant isolation, attempt handling, or license-enforcement behavior.
- Introducing new architecture patterns, dependency exceptions, or module-boundary changes.
- Relaxing Hard Mode workflow checks, architecture governance, Git hook enforcement, or contributor safety rules.
- Performing broad repository cleanup outside the widened support surfaces named by this stage.
- Silent deletion of duplicated guidance, routing surfaces, or templates without a replacement or documented compatibility path.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The stage MUST inventory every widened-scope support surface named in the stage file and classify each item as retained, migrated, mirrored for compatibility, removed, regenerated-and-ignored, or escalated.
- **FR-002**: The stage MUST require blast-radius evidence for every root support artifact candidate, routing surface, template bootstrap entrypoint, and contributor-facing or governance-facing document changed by the migration.
- **FR-003**: The stage MUST classify a root support artifact as removable only when there are zero unresolved references or a complete documented replacement path.
- **FR-004**: The stage MUST define one authoritative routing root for each of the following categories: agents, prompts, and templates. For this stage, the authoritative roots are `.agents/agents/`, `.agents/prompts/`, and `specs/templates/` respectively.
- **FR-005**: The stage MUST create `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md` as the single source of truth for routing authority decisions.
- **FR-006**: The routing authority registry MUST record the authoritative root, any legacy surface, and the migration or compatibility policy for each routing category, including `.github/agents/`, `.github/prompts/`, and `.specify/templates/` as legacy compatibility surfaces until same-batch consumer migration is complete. For prompts, the compatibility policy MUST distinguish the overlapping Speckit prompt subset that is mirrored into `.github/prompts/*` from any intentional Zidney-only prompts that remain authoritative-only under `.agents/prompts/*`.
- **FR-007**: The stage MUST preserve contributor-routing safety by updating all affected contributor entrypoints, shell entrypoints, documentation references, and automation references in the same migration batch whenever authority changes.
- **FR-008**: The stage MUST require the template migration outcome to align shell entrypoints, governance guidance, and contributor documentation to the same authoritative template system.
- **FR-009**: The stage MUST prevent silent divergence between `.specify/templates/` and `specs/templates/` by treating `specs/templates/` as the canonical template root and `.specify/templates/` as a temporary compatibility surface only until all live shell and automation consumers are migrated in the same batch.
- **FR-010**: The stage MUST preserve Hard Mode workflow integrity and MUST NOT weaken `.github/workflows/hard-mode-guard.yml`, `.github/workflows/architecture-governance.yml`, `.husky/pre-commit`, `.husky/pre-push`, `AGENTS.md`, `docs/AGENT_GOVERNANCE.md`, `docs/PROJECT_CONTEXT_PRIMER.md`, or `specs/STAGE_LIFECYCLE_POLICY.md` unless a minimal, explicitly justified migration update is required.
- **FR-011**: The stage MUST consolidate overlapping governance or contributor guidance losslessly through consolidation, redirect references, or documented purpose separation.
- **FR-012**: The stage MUST pair generated-output cleanup decisions with ignore-policy or regeneration-policy review when the artifact is not intended to remain committed.
- **FR-013**: The stage MUST preserve architecture safety by remaining within existing ADR-backed boundaries and MUST NOT introduce runtime redesign, tenant-model changes, or contributor workflow redesign outside the stage's support-surface scope.
- **FR-014**: The stage MUST define the minimum validation evidence required after migration as `bun run lint`, `bun run typecheck`, `bun run test`, `bun run arch:guard`, `bun scripts/ai-guard.ts`, `bun scripts/architecture-diff.ts`, `bun scripts/infra-audit.ts`, `bun scripts/validate-architecture-brain.ts`, `bun run type-safety-guard`, `bun run ai-context:refresh`, and `bun run validate:workflows`.
- **FR-015**: If routing or template entrypoints change, the stage MUST additionally validate `.specify/scripts/bash/create-new-feature.sh`, `.specify/scripts/bash/setup-plan.sh`, `.specify/scripts/bash/update-agent-context.sh`, and any other affected loading path in the same batch.
- **FR-016**: The stage MUST prefer retention, mirroring, or explicit migration over deletion whenever contributor impact, workflow impact, or governance impact is ambiguous.
- **FR-017**: The stage MUST produce a migration-ready specification that keeps the widened support-surface cleanup bounded to repository governance and contributor-routing concerns rather than runtime or platform redesign.

### Key Entities _(include if feature involves data)_

- **Support Surface**: Any repository path, document, script entrypoint, template root, or guidance surface under INFRA-21 review.
- **Root Support Artifact Candidate**: A root-level file or generated artifact that appears stale, duplicated, or ambiguously owned and requires a final disposition.
- **Routing Surface**: A repository location that contributors or automation use to discover agents, prompts, or related guidance.
- **Template Authority**: The declared canonical template system that contributor entrypoints and governance docs must resolve to.
- **Legacy Compatibility Surface**: A non-authoritative path temporarily retained to keep contributor tooling or automation functioning during migration.
- **Routing Authority Registry**: The authoritative record that declares canonical roots, legacy surfaces, and migration policy for routing categories.
- **Blast-Radius Evidence**: The collected proof of direct references, entrypoints, workflows, hooks, documentation links, and generators affected by a proposed routing or artifact change.
- **Validation Evidence**: The explicit post-migration proof that governance, routing, and contributor workflows remain intact.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of widened-scope artifacts and routing surfaces named by the stage receive an explicit disposition with supporting rationale before implementation begins.
- **SC-002**: 100% of routing categories covered by this stage have exactly one declared authoritative root and a documented compatibility or retirement policy for every retained legacy surface.
- **SC-003**: 100% of template-related contributor entrypoints and governance references covered by the migration resolve to the same documented authority model without silent divergence.
- **SC-004**: 0 widened-scope deletions proceed without blast-radius evidence showing either zero unresolved references or a complete replacement path.
- **SC-005**: 100% of overlapping contributor or governance guidance surfaces affected by this stage are accounted for through lossless consolidation, explicit redirects, or documented role separation.
- **SC-006**: The specified validation set fully covers governance, architecture, workflow, and contributor-routing checks needed to detect regressions introduced by the migration.
- **SC-007**: 0 requirements in this specification weaken tenant isolation, runtime authority, license enforcement, Hard Mode governance integrity, or existing architecture boundaries.
