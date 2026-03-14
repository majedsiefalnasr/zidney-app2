# Feature Specification: Repository Sanitization and Dead Code Elimination

**Feature Branch**: `spec/infra-016-repository-sanitization-and-dead-code-elimination`  
**Created**: 2026-03-14  
**Status**: Draft  
**Input**: User description: "Execute Step 1 (Specify) for STAGE_INFRA_16_REPOSITORY_SANITIZATION_AND_DEAD_CODE_ELIMINATION in Phase 01_PLATFORM_FOUNDATION"

## Stage Context

- **Stage**: STAGE_INFRA_16_REPOSITORY_SANITIZATION_AND_DEAD_CODE_ELIMINATION
- **Phase**: 01_PLATFORM_FOUNDATION
- **Stage File**: `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_16_REPOSITORY_SANITIZATION_AND_DEAD_CODE_ELIMINATION.md`
- **Feature Directory**: `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination`

## Scope Boundaries

This stage defines a repository-wide sanitization effort for the following governed areas:

- `apps/`
- `packages/`
- `scripts/`
- `.agents/skills/`
- `docs/`
- `.github/workflows/`
- `.husky/`
- `package.json`

The stage may also read supporting evidence and validation surfaces such as `tests/`, `bun.lock`,
`vitest.config.ts`, `vitest.workspace.ts`, and `lint-staged.config.mjs`, and it may update those
support surfaces only when required to preserve reference integrity after an approved cleanup.
Those files are not primary sanitization targets.

This stage is limited to repository hygiene and governance maintenance. It does **not** redesign runtime architecture, alter tenant isolation, bypass license enforcement, instantiate databases directly, or modify the attempt engine lifecycle.

## Constitutional Compliance

This stage remains within Zidney's infrastructure-governance boundary.

- Database-per-tenant remains unchanged.
- No cross-tenant logic is introduced.
- No direct database instantiation is introduced.
- No license middleware behavior is weakened or bypassed.
- No attempt snapshot, grading, or runtime authority rules are changed.
- No app-to-app or package-to-app architectural violations are introduced as part of repository cleanup.

## Clarifications

### Session 2026-03-14

- Q: Which repository assets are protected from sanitization even if they appear low-frequency or duplicated? → A: Governance and safety assets remain non-removable, including `docs/ai/`, `docs/architecture/`, `.github/workflows/`, `.husky/`, `AGENTS.md`, `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md`, `docs/AGENT_GOVERNANCE.md`, `docs/PROJECT_CONTEXT_PRIMER.md`, `specs/STAGE_LIFECYCLE_POLICY.md`, `specs/phases/MASTER_EXECUTION_ROADMAP.md`, the core governance scripts (`scripts/ai-guard.ts`, `scripts/architecture-diff.ts`, `scripts/infra-audit.ts`, `scripts/type-safety-guard.ts`, `scripts/generate-ai-context.ts`, `scripts/gitnexus-context.ts`, `scripts/validate-architecture-brain.ts`), and the `package.json` script entries that wire architecture, AI-context, typecheck, and hook validation flows.
- Q: What evidence is required before an asset can be classified as dead or removable? → A: Removal requires zero unresolved evidence of active use across source imports, tests, package scripts, CI workflows, Git hooks, AGENTS and skill references, AI-context and architecture-intelligence generation paths, and committed governance reports; otherwise the asset is retained or escalated for manual review.
- Q: Which validation gates define successful post-sanitization verification for this stage? → A: Post-cleanup verification must preserve the existing governance chain by running `bun run lint`, `bun run typecheck`, `bun run test`, `bun run arch:guard`, `bun scripts/ai-guard.ts`, `bun scripts/architecture-diff.ts`, `bun scripts/infra-audit.ts`, `bun scripts/validate-architecture-brain.ts`, and `bun run ai-context:refresh`, plus `bun run validate:workflows` when workflow files are touched, with protected governance authority files and Git hooks remaining present and wired.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Remove Inactive Repository Assets Safely (Priority: P1)

As a platform maintainer, I want inactive, duplicate, obsolete, and accidental repository artifacts identified and cleaned up safely, so that the monorepo stays lean without removing governance-critical assets.

**Why this priority**: Unsafe cleanup can break architecture validation, AI context generation, CI enforcement, or critical repository workflows.

**Independent Test**: Review the sanitization inventory for all in-scope repository areas and confirm each removal candidate has a clear rationale while protected governance assets remain explicitly excluded from deletion.

**Acceptance Scenarios**:

1. **Given** a script, package, skill, workflow, dependency, or document with no active repository role, **When** the sanitization review is completed, **Then** it is classified for removal with an explicit reason.
2. **Given** a governance-critical artifact that is still required for architecture, AI, CI, or hook enforcement, **When** repository sanitization is specified, **Then** it is preserved even if it is infrequently invoked.

---

### User Story 2 - Reduce Repository Noise and Duplication (Priority: P2)

As a developer working in the monorepo, I want only one authoritative version of active repository tooling and documentation, so that I can trust the repo layout and avoid following stale or duplicate assets.

**Why this priority**: Duplicate scripts, workflows, docs, and dependencies create confusion, increase maintenance cost, and raise the risk of AI or human contributors using the wrong artifact.

**Independent Test**: Inspect the post-review scope definition and confirm that duplicate assets are grouped by purpose, one authoritative artifact is retained for each governed purpose, and obsolete duplicates are marked for removal or consolidation.

**Acceptance Scenarios**:

1. **Given** multiple artifacts serving the same repository-governance purpose, **When** the stage outcomes are defined, **Then** one authoritative artifact is retained and redundant duplicates are identified for removal or consolidation.
2. **Given** unused dependencies or packages that no longer support active code, tests, CI, or governance flows, **When** the sanitization review is completed, **Then** they are identified as dead repository weight.

---

### User Story 3 - Prove Governance Still Holds After Cleanup (Priority: P3)

As a release or governance maintainer, I want repository sanitization to include explicit validation expectations, so that cleanup can be completed without weakening quality gates or platform safety rules.

**Why this priority**: A lighter repository only has value if governance, validation, and platform guardrails still hold after cleanup.

**Independent Test**: Review the specification and confirm it requires validation evidence that governance tooling, quality checks, and AI context workflows still succeed after sanitization.

**Acceptance Scenarios**:

1. **Given** a completed sanitization pass, **When** the repository is verified, **Then** the stage requires confirmation that governance and quality gates still succeed.
2. **Given** a cleanup candidate whose removal would weaken governance or platform safety guarantees, **When** that candidate is reviewed, **Then** the stage requires the item to be retained or escalated for manual review instead of being deleted silently.

### Edge Cases

- A dependency or script appears unused in source files but is required by CI, Git hooks, validation workflows, or governance tooling.
- Two documents or workflows overlap heavily but each still contains distinct authoritative guidance that must not be lost during consolidation.
- A generated artifact is committed intentionally as a test fixture or baseline rather than accidental build output.
- An empty directory exists for contractual repository structure and should not be removed unless its absence is confirmed to be harmless.
- A package or skill has no current application consumer but is still referenced by governance, architecture intelligence, or active repository workflows.
- A file has no code importers but is still referenced by AGENTS instructions, skill routing, package scripts, CI YAML, hook scripts, or AI-context generation and therefore cannot be classified as dead.
- A protected governance root contains apparent duplicates; those candidates must be audited and marked for manual review in this stage rather than consolidated automatically.

## Assumptions

- The scope of this stage is limited to repository sanitization in the explicitly listed directories and root governance files.
- Governance-critical assets remain protected even when they are low-frequency execution paths.
- Removal decisions favor safety: if active use cannot be ruled out confidently, the item is retained or escalated for review.
- Consolidation is permitted only when repository intent becomes clearer and no constitutional or governance rule is weakened.
- This stage may remove dead repository weight, but it must not change Zidney's trust chain, multi-tenancy model, or module-boundary model.

## Out of Scope

- Redesigning runtime architecture or changing application responsibilities.
- Modifying tenant resolution, license enforcement, or attempt engine behavior.
- Introducing new module boundaries, data flows, or shared-runtime patterns.
- Rewriting closed or hardened specifications outside normal documentation clarification rules.
- Changing business behavior in `apps/` or `packages/` beyond dead-code and dead-asset elimination.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The stage MUST evaluate repository assets within `apps/`, `packages/`, `scripts/`, `.agents/skills/`, `docs/`, `.github/workflows/`, `.husky/`, and `package.json` for active use, duplication, obsolescence, generated-artifact status, and protected status.
- **FR-001a**: The stage MAY read or minimally update `tests/`, `bun.lock`, `vitest.config.ts`, `vitest.workspace.ts`, and `lint-staged.config.mjs` only as supporting evidence or reference-integrity surfaces after approved cleanup; those files are not primary sanitization candidates.
- **FR-002**: The stage MUST produce a repository sanitization inventory that records each removal, retention, consolidation, or manual-review decision with a clear rationale.
- **FR-003**: The stage MUST classify an asset as removable only when it is confirmed to be unused, superseded by an authoritative duplicate, accidental generated output, or empty scaffolding with no required repository role.
- **FR-004**: The stage MUST preserve governance-critical assets and directories required for architecture validation, AI context generation, repository governance, CI enforcement, and Git hook enforcement, even when they are not part of day-to-day development flows.
- **FR-005**: The stage MUST verify active usage across code, tests, scripts, CI workflows, Git hooks, governance workflows, and architecture-intelligence flows before classifying a script, package, dependency, skill, or workflow as unused.
- **FR-005a**: The stage MUST treat `docs/ai/`, `docs/architecture/`, `.github/workflows/`, `.husky/`, `AGENTS.md`, `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md`, `docs/AGENT_GOVERNANCE.md`, `docs/PROJECT_CONTEXT_PRIMER.md`, `specs/STAGE_LIFECYCLE_POLICY.md`, `specs/phases/MASTER_EXECUTION_ROADMAP.md`, `scripts/ai-guard.ts`, `scripts/architecture-diff.ts`, `scripts/infra-audit.ts`, `scripts/type-safety-guard.ts`, `scripts/generate-ai-context.ts`, `scripts/gitnexus-context.ts`, `scripts/validate-architecture-brain.ts`, and the `package.json` script wiring for governance checks as protected assets that cannot be removed by sanitization unless a separate stage explicitly supersedes them.
- **FR-005b**: The stage MUST consider an asset inactive only when repository scanning finds zero unresolved references across source code, tests, package scripts, CI workflows, Git hooks, AGENTS and skill instructions, AI-context generation, architecture-intelligence generation, and committed governance reports.
- **FR-006**: The stage MUST identify duplicate scripts, documents, workflows, and skills by governed purpose and retain one authoritative artifact for each purpose.
- **FR-006a**: Duplicate groups inside protected governance roots may be inventoried and classified in this stage, but they MUST remain `protect` or `manual_review` unless a separate approved stage explicitly supersedes the protected path.
- **FR-007**: The stage MUST identify dependencies in `package.json` that no longer support any active application, package, test, toolchain, CI, or hook workflow.
- **FR-008**: The stage MUST identify packages or skills that no longer serve any active repository consumer or governance workflow and treat them as cleanup candidates only after dependency and governance references are resolved.
- **FR-009**: The stage MUST generate a repository sanitization report summarizing removed items, retained protected items, consolidated duplicates, and any candidates deferred for manual review.
- **FR-010**: The stage MUST define validation expectations proving that repository sanitization does not weaken governance, type safety, testing, architecture validation, or AI-context refresh workflows.
- **FR-010a**: The stage MUST treat `bun run lint`, `bun run typecheck`, `bun run test`, `bun run arch:guard`, `bun scripts/ai-guard.ts`, `bun scripts/architecture-diff.ts`, `bun scripts/infra-audit.ts`, `bun scripts/validate-architecture-brain.ts`, `bun run type-safety-guard`, and `bun run ai-context:refresh` as the minimum post-sanitization validation set, and it MUST preserve the repository's CI and Git-hook execution paths for those checks.
- **FR-010b**: The stage MUST validate each meaningful cleanup batch before the next batch begins, and it MUST reclassify or roll back only the failing batch when a gate fails.
- **FR-010c**: When workflow files are touched, the stage MUST run `bun run validate:workflows`; when hook wiring is touched, the stage MUST confirm the referenced commands and files still resolve from `.husky/`, `package.json`, and `lint-staged.config.mjs`.
- **FR-010d**: The stage MUST explicitly verify that protected governance authority files remain present and unmodified by cleanup, including `AGENTS.md`, `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md`, `docs/AGENT_GOVERNANCE.md`, `docs/PROJECT_CONTEXT_PRIMER.md`, `specs/STAGE_LIFECYCLE_POLICY.md`, `specs/phases/MASTER_EXECUTION_ROADMAP.md`, `.github/workflows/architecture-governance.yml`, `.husky/pre-commit`, and `.husky/pre-push`; the only approved exception is the explicit governance-remediation change to `.github/workflows/hard-mode-guard.yml` performed by this stage to enforce the wider authority set.
- **FR-011**: The stage MUST leave tenant isolation, license enforcement, attempt integrity, direct-database-instantiation rules, and architectural layer boundaries unchanged.
- **FR-012**: The stage MUST prefer retention and escalation over deletion when evidence of active usage is ambiguous or conflicting.
- **FR-013**: The stage MUST keep the specification and later implementation scoped to repository sanitation and dead-code elimination rather than runtime redesign or feature expansion.

### Key Entities _(include if feature involves data)_

- **Sanitization Candidate**: Any repository asset under stage scope that is evaluated for removal, consolidation, retention, or manual review.
- **Protected Asset**: A repository asset that must be retained because it preserves architecture governance, AI context, CI enforcement, hook enforcement, or constitutional safety.
- **Duplicate Group**: A set of two or more artifacts that appear to serve the same repository-governance or documentation purpose and require a single authoritative outcome.
- **Sanitization Inventory**: The stage-owned record of every in-scope asset classification and the rationale for its final status.
- **Sanitization Report**: The final human-readable outcome summary of what was removed, retained, consolidated, or deferred.
- **Validation Evidence**: The explicit proof that cleanup did not weaken governance, testing, or repository safety gates.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of in-scope repository areas are reviewed and every removal or retention decision is captured in the sanitization inventory with an explicit rationale.
- **SC-002**: Every removed script, dependency, package, skill, workflow, or document has zero unresolved evidence of active use at stage sign-off.
- **SC-003**: Each governed repository purpose within the scanned scope has no more than one authoritative active artifact after sanitization decisions are applied, except for protected or `manual_review` duplicate groups that this stage is required to retain for safety.
- **SC-004**: Post-sanitization verification confirms that all required governance, quality, and validation gates for this repository still pass without new blocking regressions.
- **SC-004a**: Post-sanitization verification records successful execution of `bun run lint`, `bun run typecheck`, `bun run test`, `bun run arch:guard`, `bun scripts/ai-guard.ts`, `bun scripts/architecture-diff.ts`, `bun scripts/infra-audit.ts`, `bun scripts/validate-architecture-brain.ts`, `bun run type-safety-guard`, and `bun run ai-context:refresh`, or explicitly documents a pre-existing out-of-scope baseline failure for follow-up.
- **SC-005**: The stage introduces zero regressions to tenant isolation, license enforcement, attempt integrity, or architectural boundary guarantees.
- **SC-006**: The final sanitization report fully accounts for protected assets, removed assets, consolidated duplicates, and manual-review exceptions so maintainers can audit decisions without inspecting the entire repository history.
