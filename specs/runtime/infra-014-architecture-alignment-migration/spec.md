# Feature Specification: Architecture Alignment Migration

**Feature Branch**: `spec/infra-014-architecture-alignment-migration`  
**Created**: 2026-03-12  
**Status**: Draft  
**Input**: User description: "Execute Step 1 (Specify) for STAGE_INFRA_14_ARCHITECTURE_ALIGNMENT_MIGRATION in Phase 01_PLATFORM_FOUNDATION"

## Stage Status

Status: DRAFT  
Step: tasks  
Risk Level: LOW

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Establish a Trusted Alignment Baseline (Priority: P1)

As a platform governance maintainer, I need a repository-wide alignment baseline that identifies architecture, dependency, and type-governance violations, so the repository can be brought into compliance without guessing or missing high-risk issues.

**Why this priority**: A complete baseline is the prerequisite for every later migration action. Without it, violations that threaten tenant isolation, license enforcement, or module boundaries can remain hidden.

**Independent Test**: Review the baseline output for the full governed repository and confirm it classifies violations by rule family, affected module, and remediation priority.

**Acceptance Scenarios**:

1. **Given** the repository contains legacy code that predates current governance rules, **When** the alignment baseline is produced, **Then** it identifies architecture, dependency, circularity, and unsafe typing violations across governed modules.
2. **Given** multiple violations exist in the same module, **When** the baseline is reviewed, **Then** findings are grouped clearly enough to plan remediation without reinterpreting the architecture rules.

---

### User Story 2 - Prove Existing Code Already Preserves the Trust Chain (Priority: P2)

As a platform engineer, I need the current repository state to be verified and frozen as compliant when the baseline is already clean, so governance passes without unnecessary code churn and without changing Zidney's tenant isolation, license enforcement, or server-authoritative runtime guarantees.

**Why this priority**: The migration only has value if it removes or disproves governance drift while preserving the non-negotiable platform rules that protect institutions, workspaces, and attempts.

**Independent Test**: Compare the captured baseline and final verification evidence for tenant-bound routing, license enforcement, and attempt-time authority, and verify zero in-scope violations persist without changing those controls.

**Acceptance Scenarios**:

1. **Given** the canonical baseline reports zero dependency, cycle, and type-governance violations, **When** the stage is implemented, **Then** repository remediation is marked not required and no runtime code is changed.
2. **Given** the stage follows the clean-baseline path, **When** final verification completes, **Then** trust-chain invariants remain unchanged and the repository still reports zero in-scope violations.
3. **Given** existing workspace-bound runtime flows, **When** the migration is complete, **Then** database-per-tenant isolation, mandatory license checks, and server-authoritative time remain unchanged.

---

### User Story 3 - Regenerate Canonical Architecture Intelligence (Priority: P3)

As an architecture maintainer, I need the canonical architecture intelligence artifacts regenerated after alignment, so the guard, audit, and AI context layers reason from the same repository state.

**Why this priority**: Repository alignment is incomplete if governance metadata still reflects an older dependency graph or stale module boundary model.

**Independent Test**: Regenerate the canonical architecture intelligence artifacts after evidence capture and verify governance consumers can use them without reporting stale or inconsistent architecture state.

**Acceptance Scenarios**:

1. **Given** repository alignment work refreshes the canonical artifact set, **When** architecture intelligence is regenerated, **Then** the resulting artifacts reflect the current compliant structure.
2. **Given** regenerated architecture intelligence, **When** the governance toolchain runs final verification, **Then** it evaluates the repository against the refreshed architecture state without false drift caused by stale metadata.

### Edge Cases

- What happens when a legacy dependency violation can be removed in multiple ways, but only one option preserves the current ADR-backed architecture?
- How does the migration handle generated or support files that trigger governance findings but are not part of the canonical module graph?
- What happens when architecture intelligence artifacts and discovered repository structure disagree during final verification?
- How does the alignment process handle legacy scripts whose checks overlap the canonical governance toolchain only partially?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST define a repository-wide alignment baseline that identifies current violations across unified architecture guard rules, dependency boundaries, circular dependencies, and type-safety governance.
- **FR-002**: The alignment baseline MUST classify findings by affected module, violated rule family, and remediation priority so repository-wide migration work can be executed systematically.
- **FR-003**: The migration MUST convert a clean canonical baseline into explicit zero-violation evidence when no governed remediation is required.
- **FR-004**: If a future canonical baseline reports governed violations, the migration MUST reopen planning and regenerate exact file-scoped remediation tasks before repository code changes begin.
- **FR-005**: The migration MUST preserve trust-chain invariants, including authentication, tenant resolution, license enforcement, compatibility checks, and structured API error responses, throughout the clean-baseline path.
- **FR-006**: The migration MUST preserve existing transaction, idempotency, secret-handling, and structured-log guarantees on untouched runtime paths.
- **FR-007**: The migration MUST keep repository remediation out of scope for this stage instance when the captured baseline reports zero dependency, cycle, unsafe-type, and artifact-drift violations.
- **FR-008**: The migration MUST preserve Zidney's database-per-tenant model and MUST NOT introduce row-based multitenancy, shared tenant data paths, or tenant overrides outside resolver-controlled context.
- **FR-009**: The migration MUST preserve mandatory license enforcement on workspace-bound runtime surfaces and MUST NOT reduce route coverage, enforcement order, or compatibility checks.
- **FR-010**: The migration MUST preserve server-authoritative time and MUST NOT introduce client-authoritative attempt timing, grading, or submission behavior.
- **FR-011**: The migration MUST document governance toolchain ownership and prove whether duplicate governance checks require consolidation or can remain unchanged for the captured clean baseline.
- **FR-012**: The migration MUST regenerate canonical architecture intelligence artifacts after alignment so guard, audit, and AI context consumers share the same compliant repository view.
- **FR-013**: Final repository verification MUST report zero remaining violations in the governed architecture-alignment scope before this stage can be considered complete.
- **FR-014**: The migration MUST remain within the current ADR-backed architecture and MUST NOT introduce new architecture patterns, boundary exceptions, or redesign decisions without a separate ADR-approved change.

### Key Entities _(include if feature involves data)_

- **Alignment Baseline**: The authoritative inventory of current repository governance violations, grouped by rule family, module, severity, and remediation order.
- **Governance Violation**: A non-compliant condition involving dependency boundaries, module boundaries, circularity, unsafe typing, or stale architecture intelligence.
- **Zero-Violation Evidence**: Canonical proof that the current repository baseline is already compliant and that no repository code remediation is required for this stage instance.
- **Boundary Contract**: The approved module and layer relationship model that defines what imports, dependencies, and runtime responsibilities are allowed.
- **Architecture Intelligence Artifact**: Canonical machine-readable repository context used by governance and AI workflows to understand modules, layers, and dependencies.
- **Legacy Governance Script**: An existing repository check whose responsibility may overlap the canonical governance toolchain and therefore requires consolidation or retirement review.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of governed modules are evaluated in the alignment baseline with violations categorized by module and rule family.
- **SC-002**: Final governance verification reports 0 unresolved violations within the architecture-alignment scope of this stage.
- **SC-003**: 100% of workspace-bound runtime paths reviewed during the migration retain tenant resolution and mandatory license enforcement coverage after alignment or clean-baseline verification.
- **SC-004**: 0 changes introduced by this stage weaken database-per-tenant isolation, enable row-based multitenancy, or permit cross-app import paths.
- **SC-005**: 100% of required canonical architecture intelligence artifacts are regenerated successfully from the aligned repository state before stage closure.
- **SC-006**: 0 alignment changes introduce new architecture exceptions or redesign decisions outside the existing ADR-backed model.

## Assumptions & Dependencies

- This stage is an infrastructure alignment and migration effort only; it does not define new product-facing runtime behavior.
- Existing ADRs, architecture contracts, module boundary maps, and governance policies remain authoritative for all remediation decisions.
- If the baseline is clean, the stage can conclude through evidence capture, artifact regeneration, and closure verification without repository code remediation.
- Repository-wide alignment may touch multiple modules only if a future non-zero baseline reopens planning and regenerates exact file-scoped remediation tasks.
- Canonical governance outputs and architecture intelligence are the source of truth for final verification.

## In Scope

- Repository-wide detection and categorization of architecture and type-governance violations.
- Clean-baseline evidence capture showing that repository code remediation is not required for this stage instance.
- Governance toolchain ownership review and canonical artifact refresh.
- Regeneration of architecture intelligence artifacts after alignment.
- Final verification that the governed repository state is compliant.

## Out of Scope

- Redesigning Zidney architecture or introducing new boundary models.
- Changing database topology, tenant resolution semantics, or workspace identity rules.
- Changing license lifecycle behavior, middleware order, or compatibility policy.
- Changing attempt engine grading, submission, snapshot, or worker-authority semantics.
- Adding new product features for MMC, Backoffice, Frontoffice, API consumers, or workers.
- Creating ADR changes as part of this stage unless a separate architecture decision process is opened.
- Repository code remediation without a fresh non-zero baseline and regenerated file-scoped remediation tasks.
