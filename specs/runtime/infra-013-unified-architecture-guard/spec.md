# Feature Specification: Unified Architecture Guard

**Feature Branch**: `spec/infra-013-unified-architecture-guard`  
**Created**: 2026-03-12  
**Status**: Draft  
**Input**: User description: "Execute Step 1 (Specify) for STAGE_INFRA_13_UNIFIED_ARCHITECTURE_GUARD in Phase 01_PLATFORM_FOUNDATION"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Block Architecture Violations Early (Priority: P1)

As a platform engineer, I need one governance entrypoint that checks architecture boundaries before changes are merged, so that prohibited dependencies and drift are blocked consistently.

**Why this priority**: Architecture violations can silently compromise tenant isolation, trust-chain enforcement, and long-term maintainability.

**Independent Test**: Introduce a known boundary violation in a test change set and verify the governance entrypoint reports the violation and fails strict validation mode.

**Acceptance Scenarios**:

1. **Given** a proposed change that introduces a forbidden dependency across modules, **When** the unified guard is run in strict validation mode, **Then** the change is rejected with a clear rule violation.
2. **Given** a proposed change that keeps dependencies within approved boundaries, **When** the unified guard is run in strict validation mode, **Then** no boundary violation is reported.

---

### User Story 2 - Validate Changed Files Quickly (Priority: P2)

As a developer, I need a fast changed-files validation mode before push, so that I can get governance feedback without waiting for full-repository scans.

**Why this priority**: Fast feedback improves compliance and developer adoption while preserving enforcement quality.

**Independent Test**: Run changed-files mode on a branch with a small set of modified files and confirm only changed files are evaluated while violations are still detected.

**Acceptance Scenarios**:

1. **Given** a branch with modified files, **When** changed-files mode is executed, **Then** only modified files are scanned and violations are reported if present.
2. **Given** a branch with no changed files, **When** changed-files mode is executed, **Then** the run completes without false violations.

---

### User Story 3 - Keep AI and Governance Context Current (Priority: P3)

As an architecture/governance maintainer, I need machine-readable architecture context artifacts generated from current repository structure, so AI and governance tooling can reason from up-to-date architecture state.

**Why this priority**: Outdated context increases false positives, false negatives, and risky AI suggestions.

**Independent Test**: Trigger architecture context generation and verify required artifacts are produced and readable by governance workflows.

**Acceptance Scenarios**:

1. **Given** a repository state with current modules and dependencies, **When** the architecture context generation workflow runs, **Then** the required architecture artifacts are regenerated successfully.
2. **Given** regenerated architecture context, **When** governance workflows consume it, **Then** architecture validation uses the updated module and dependency metadata.

### Edge Cases

- What happens when the architecture map and discovered dependency graph disagree for a module relation?
- How does the system handle generated context that is incomplete, malformed, or missing required artifacts?
- What happens when changed-files validation is requested but the diff baseline is unavailable?
- How does the unified guard report multiple violations in a single run while remaining deterministic?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide one unified governance entrypoint that executes architecture and code-governance validation rules through a consistent runner.
- **FR-002**: The system MUST enforce repository import boundaries, including no cross-app imports and no package-to-app imports.
- **FR-003**: The system MUST detect and report circular dependency violations in governed modules.
- **FR-004**: The system MUST detect unsafe TypeScript suppression/escape patterns governed by Zidney policy and report them as violations.
- **FR-005**: The system MUST support a changed-files validation mode for pre-push workflows that preserves rule consistency with strict mode.
- **FR-006**: The system MUST support a strict CI validation mode that fails when violations exist.
- **FR-007**: The system MUST generate and refresh architecture intelligence artifacts required by governance and AI context workflows.
- **FR-008**: Violation output MUST identify the violated rule, affected file/module, and remediation direction in a structured, actionable format.
- **FR-009**: Governance rules MUST include enforcement of Zidney non-negotiables: database-per-tenant model, prohibition of cross-tenant joins, mandatory license enforcement in workspace-bound flows, and no architecture drift.
- **FR-010**: The unified governance workflow MUST remain stage-scoped to infrastructure governance and MUST NOT alter runtime business behavior, tenant data flow, or license/attempt logic.

### Key Entities _(include if feature involves data)_

- **Unified Guard Run**: A single governance execution instance with mode, scope, result summary, and deterministic outcome.
- **Guard Rule**: A named enforceable policy with scope, severity, and pass/fail evaluation behavior.
- **Violation Record**: A structured finding that includes violated rule, location, impacted module, and remediation guidance.
- **Architecture Context Artifact**: Machine-readable metadata describing modules, dependencies, and architecture layer relationships for governance/AI consumers.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of architecture boundary violations introduced in controlled test cases are detected by strict validation mode.
- **SC-002**: Changed-files mode completes in less time than full validation mode for equivalent branches while returning consistent pass/fail outcomes for changed files.
- **SC-003**: Governance output includes actionable violation metadata (rule, location, remediation guidance) for 100% of reported violations.
- **SC-004**: Required architecture context artifacts are regenerated successfully in 100% of successful generation runs.
- **SC-005**: No new architecture drift is introduced by this stage’s governance workflow changes.
- **SC-006**: The specified governance scope introduces zero behavioral changes to tenant isolation runtime, license state enforcement behavior, or attempt engine behavior.

## Assumptions & Dependencies

- The feature is infrastructure governance only and does not introduce runtime feature behavior for end users.
- Existing architecture contracts, ADRs, and stage governance documents remain authoritative over this spec.
- Existing project workflows provide a changed-files baseline for incremental validation in normal pre-push flows.
- Architecture context consumers (governance and AI tooling) rely on generated artifacts and do not manually edit generated files.

## In Scope

- Unified governance entrypoint behavior and rule orchestration.
- Dependency boundary, module boundary, circular dependency, and type-safety governance checks.
- Strict mode and changed-files mode validation behavior.
- Architecture intelligence/context artifact generation and governance consumption readiness.
- Structured violation reporting requirements.

## Out of Scope

- Changes to tenant data model, database schema, or migration logic.
- Changes to license lifecycle semantics or route-level license middleware behavior.
- Changes to attempt engine grading, snapshot, submission, or worker finalization logic.
- UI behavior changes in MMC, Backoffice, Frontoffice, or shared UI components.
- Introduction of new cross-module architecture patterns not already authorized by ADR/contract.

## Clarifications

### Session 2026-03-12

- Q: Should this stage move lifecycle status out of DRAFT during Clarify?
  A: No. Keep stage lifecycle in DRAFT until Analyze and implementation authorization gates are reached.
- Q: Are additional runtime policy clarifications needed for license/attempt flows?
  A: No. Existing constraints are explicit and remain unchanged; this stage is governance-only.
