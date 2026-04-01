# Feature Specification: Auto Selection Engine

**Feature Branch**: `spec/039-auto-selection-engine`  
**Created**: 2026-04-02  
**Status**: Draft  
**Input**: User description: "Stage: Auto Selection Engine, Phase: 03_BACKOFFICE_CORE/04_EXAM_ENGINE_CORE, Step 1 Specify from STAGE_39_AUTO_SELECTION_ENGINE.md"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Start Fair Attempt with Auto Selection (Priority: P1)

As an exam taker, I need my attempt to start only when the system can assemble a valid question set that matches the exam rules, so my exam is fair and complete.

**Why this priority**: Attempt start is blocked without reliable selection, and this directly affects exam fairness and trust.

**Independent Test**: Can be fully tested by starting an attempt on an auto-selection exam and verifying the attempt starts only when the required number of valid questions is selected and locked.

**Acceptance Scenarios**:

1. **Given** an exam with valid selection criteria and enough eligible questions, **When** a learner starts an attempt, **Then** the system creates exactly the required number of questions and starts the attempt.
2. **Given** an exam with insufficient eligible questions for one or more criteria, **When** a learner starts an attempt, **Then** the system rejects attempt creation and returns a clear failure reason.
3. **Given** two audit replays with the same seed and same eligible pool, **When** the system re-evaluates the selection outcome, **Then** the selected question set matches exactly.

---

### User Story 2 - Prevent Misconfiguration Before Live Use (Priority: P2)

As an exam manager, I need exam selection rules validated before learners start attempts, so invalid setups are caught early and do not fail during live sessions.

**Why this priority**: Pre-runtime validation reduces operational incidents and protects exam windows.

**Independent Test**: Can be fully tested by creating/editing exam criteria configurations and confirming invalid rule sets are blocked with actionable messages.

**Acceptance Scenarios**:

1. **Given** criteria blocks whose totals do not match the configured total question count, **When** configuration is saved or published, **Then** the system rejects the configuration.
2. **Given** a criteria block with neither percentage nor fixed count, **When** configuration is saved or published, **Then** the system rejects the configuration.
3. **Given** criteria that can create overlaps causing duplicates, **When** configuration is saved or published, **Then** the system warns or blocks according to policy and prevents invalid publication.

---

### User Story 3 - Run Hybrid Manual + Auto Selection Safely (Priority: P3)

As an exam manager, I need to combine manually selected questions with automatically selected questions, so I can control key questions while still scaling selection.

**Why this priority**: Hybrid mode is high-value for controlled assessments but depends on the core P1 behavior.

**Independent Test**: Can be fully tested by configuring manual and auto sections together and verifying no duplicates and correct final count.

**Acceptance Scenarios**:

1. **Given** an exam with manual questions and auto criteria, **When** an attempt starts, **Then** manual questions are retained and auto selection excludes manual IDs.
2. **Given** hybrid mode with valid counts, **When** an attempt starts, **Then** the final question set has no duplicates and matches the expected total.

### Edge Cases

- What happens when the eligible pool size equals the required count exactly for one or more criteria blocks?
- How does the system handle two overlapping criteria blocks that independently appear valid but collide on the same candidate questions?
- What happens when visibility rules remove questions after criteria are defined but before attempt start?
- How does the system behave when mixed manual + auto configuration already consumes the full total question count?
- What happens when high concurrent attempt starts target the same exam definition?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST perform automatic question selection exactly once per attempt start flow for supported exam types.
- **FR-002**: System MUST complete selection and persistence atomically; if any selection rule fails, attempt creation MUST be aborted.
- **FR-003**: System MUST apply mandatory eligibility constraints for subject membership, active workflow status, division visibility, and exam type compatibility.
- **FR-004**: System MUST support optional filtering criteria including lessons, categories, category values, tags, baskets, semester, and optional manual inclusion constraints where configured.
- **FR-005**: System MUST support criteria blocks that define either percentage-based or fixed-count selection; each block MUST define one method.
- **FR-006**: System MUST validate configuration before runtime so total selected questions across criteria are consistent with configured exam total.
- **FR-007**: System MUST prevent duplicate questions across criteria blocks and across manual + auto modes in the final set.
- **FR-008**: System MUST generate and store a reproducibility seed per attempt so selection outcomes are auditable and replayable under the same conditions.
- **FR-009**: System MUST persist selected questions and selection summary in immutable attempt snapshot data at attempt start.
- **FR-010**: System MUST support manual-only, auto-only, and hybrid manual + auto question assembly.
- **FR-011**: System MUST fail fast with structured errors when candidate pools are insufficient, criteria are invalid, visibility constraints cannot be satisfied, or runtime constraints prevent safe selection.
- **FR-012**: System MUST handle concurrent attempt starts without creating duplicate question assignments within the same attempt.
- **FR-013**: System MUST provide selection diagnostics for audit and operations, including tenant/workspace context, exam identity, and correlation metadata.

### Key Entities _(include if feature involves data)_

- **Selection Criteria Block**: Defines a scoped rule set for question picking, including counting mode (percentage or fixed count) and optional filters.
- **Eligible Question Pool**: The set of questions that satisfy mandatory and optional constraints for a criteria block at selection time.
- **Attempt Selection Snapshot**: Immutable record of selected question IDs, deterministic seed, and selection summary tied to an attempt.
- **Hybrid Selection Set**: Final merged question set combining manual and auto-selected questions under no-duplicate and total-count constraints.
- **Selection Failure Event**: Structured failure result containing reason, context, and correlation data when attempt start cannot proceed.

## Assumptions

- Auto selection applies to MCQ exams and MCQ assessments by default; traditional exams may opt in to the same engine.
- Selection fairness requires deterministic reproducibility for audit when seed and candidate pool are unchanged.
- Attempt start remains blocked unless a complete valid question set is produced.
- Visibility and enablement rules are authoritative and can reduce candidate pools at runtime.
- Operational observability for selection outcomes is required in institutional environments.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of successful auto-selection attempt starts produce exactly the configured total number of questions with zero duplicates.
- **SC-002**: 100% of failed selection attempts are blocked before attempt activation and return a categorized, actionable error.
- **SC-003**: For audited samples, replaying selection with the same seed and unchanged candidate pool reproduces the identical question set in at least 99.9% of cases.
- **SC-004**: During peak registration windows, the platform supports 500 concurrent attempt-start requests for eligible exams without integrity violations.
- **SC-005**: At least 95% of valid auto-selection attempt starts complete question assembly within 200 ms under agreed performance test conditions.
- **SC-006**: Configuration validation prevents publication of invalid criteria sets in 100% of tested misconfiguration scenarios.
