# Feature Specification: Status Workflow Engine

**Feature Branch**: `020-status-workflow-engine`
**Created**: 2026-03-01
**Status**: Draft
**Phase**: 03_BACKOFFICE_CORE / 01_FOUNDATION
**Stage**: STAGE_20_STATUS_WORKFLOW_ENGINE

---

## Overview

Implement a reusable, deterministic workflow engine that manages lifecycle states for all tenant content entities inside the Backoffice. The engine enforces a strictly ordered, permission-gated state machine with a complete, immutable audit trail.

The engine is generic — it contains no entity-specific logic. Any content entity (subjects, questions, exams, topics, library files, templates, and future entities) registers with the engine and inherits the full workflow guarantee without duplicating logic.

---

## User Scenarios & Testing

### User Story 1 — Content Author Submits Content for Review (Priority: P1)

A content author has finished creating or editing a content item (e.g., a subject or question). The item is currently in the `COMPLETED` state. The author wants to send it forward so a reviewer can evaluate it before it goes live.

**Why this priority**: This is the entry point to the entire workflow. Without the first transition, no content can ever reach a published/enabled state. It validates the foundational transition rule and permission model.

**Independent Test**: Can be fully tested by transitioning any single entity of any supported type from `COMPLETED` to `UNDER_REVIEW`, verifying the entity record updates, and confirming a log entry is created — all without implementing downstream transitions.

**Acceptance Scenarios**:

1. **Given** a content item in `COMPLETED` state, **When** an authenticated user with the appropriate review-submission permission triggers the transition, **Then** the item status updates to `UNDER_REVIEW`, `status_updated_at` records the server timestamp, `status_updated_by` records the user identifier, and a single immutable log entry is inserted into `workflow_logs`.

2. **Given** a content item in `COMPLETED` state, **When** an authenticated user **without** the required permission attempts the transition, **Then** the request is rejected with an authorization error, the entity status remains `COMPLETED`, and no log entry is created.

3. **Given** a content item in `UNDER_REVIEW` state, **When** any user attempts to transition it to `UNDER_REVIEW` again, **Then** the request is rejected with a `400 invalid_state_transition` error and no state change occurs.

---

### User Story 2 — Reviewer Approves Content (Priority: P1)

A reviewer has examined content that is `UNDER_REVIEW` state and determines it is acceptable. The reviewer wants to advance it to `APPROVED` so it can be enabled later.

**Why this priority**: Approval is the critical gate before content can be made available to students. This transition validates the middle-tier permission model and the continuation of the linear chain.

**Independent Test**: Can be fully tested by transitioning an item from `UNDER_REVIEW` to `APPROVED`, verifying the update, and confirming a log entry — independent of whether the `ENABLED` transition is implemented.

**Acceptance Scenarios**:

1. **Given** a content item in `UNDER_REVIEW` state, **When** an authenticated user with the approval permission triggers the transition, **Then** the status updates to `APPROVED`, server timestamps and user identifier are recorded, and an immutable log entry is created.

2. **Given** a content item in `COMPLETED` state (not yet under review), **When** any user attempts to transition it directly to `APPROVED`, **Then** the request is rejected with `400 invalid_state_transition`.

3. **Given** a content item in `APPROVED` state, **When** any user attempts to transition it backwards to `UNDER_REVIEW` **without** backward-transition permission, **Then** the request is rejected with an authorization error and no state change occurs.

---

### User Story 3 — Administrator Enables Approved Content (Priority: P1)

An administrator wants to make an `APPROVED` content item live and available for use in exams or curricula. Enabling is the final step in the linear workflow.

**Why this priority**: Enabling content is the business outcome of the entire workflow. Validating this transition closes the full forward chain and confirms end-to-end workflow integrity.

**Independent Test**: Can be fully tested by transitioning an item from `APPROVED` to `ENABLED`, verifying entity update, and confirming log entry.

**Acceptance Scenarios**:

1. **Given** a content item in `APPROVED` state, **When** an authenticated administrator with enable permission triggers the transition, **Then** the status updates to `ENABLED`, timestamps and user identifier are recorded, and an immutable log entry is created.

2. **Given** a content item in `COMPLETED` or `UNDER_REVIEW` state, **When** any user attempts to transition it to `ENABLED`, **Then** the request is rejected with `400 invalid_state_transition`.

3. **Given** an `ENABLED` content item, **When** any user attempts to re-enable it, **Then** the request is rejected with `400 invalid_state_transition`.

---

### User Story 4 — Reviewer Returns Content for Revision (Priority: P2)

A reviewer or approver determines that a content item requires additional work. They need to move it backward in the workflow so the author can revise it.

**Why this priority**: Backward transitions are a necessary real-world scenario. They require explicit permission and a justification to prevent silent downgrades and maintain audit integrity. This is secondary because forward flow must be solid first.

**Independent Test**: Can be fully tested by attempting a backward transition (e.g., `UNDER_REVIEW → COMPLETED`) with and without backward permission, and verifying that justification is required.

**Acceptance Scenarios**:

1. **Given** a content item in `UNDER_REVIEW` state, **When** an authorized user with backward-transition permission provides a non-empty justification and triggers the backward transition, **Then** the status moves to `COMPLETED`, timestamps and user identifier are recorded, and a log entry is created with the provided reason.

2. **Given** a user with backward-transition permission, **When** they attempt a backward transition without providing a justification, **Then** the request is rejected with a validation error.

3. **Given** a user **without** backward-transition permission, **When** they attempt any backward transition, **Then** the request is rejected with an authorization error regardless of whether a justification was provided.

---

### User Story 5 — Auditor Reviews Transition History (Priority: P2)

A compliance auditor or administrator needs to see the complete, tamper-proof history of all status changes for a content entity to verify governance compliance.

**Why this priority**: The audit trail is a governance requirement. It must be queryable but is secondary to the core transition mechanics.

**Independent Test**: Can be fully tested by performing several transitions on a single entity and then reading the `workflow_logs` to confirm all entries are present, correctly ordered, and immutable (no UPDATE or DELETE possible).

**Acceptance Scenarios**:

1. **Given** a content entity with several recorded transitions, **When** an authorized user queries the workflow log for that entity, **Then** all past transitions are returned in chronological order with entity type, entity identifier, previous state, new state, actor, timestamp, and reason.

2. **Given** an attempt to modify or delete a workflow log entry via any supported interface, **Then** the operation is rejected; the record remains intact.

---

### User Story 6 — Engine Applied Across Multiple Entity Types (Priority: P3)

A platform developer registers a new content entity type (e.g., "library file") with the workflow engine. The entity should immediately inherit all workflow guarantees without any engine code changes.

**Why this priority**: This validates the engine's reusability contract — the core reason it exists as a shared service rather than per-entity logic.

**Independent Test**: Can be tested by verifying that two distinct entity types (e.g., a subject and a question) both use the same engine code path and both produce correct audit logs.

**Acceptance Scenarios**:

1. **Given** two different entity types both registered with the workflow engine, **When** a transition is performed on each, **Then** both produce correct state updates and immutable log entries using the same engine code path.

2. **Given** a new entity type is registered, **When** an illegal transition is attempted on it, **Then** the same shared rejection behavior applies without any new engine code.

---

### Edge Cases

- What happens when the entity record no longer exists at commit time (concurrent deletion)? → Transaction rolls back; caller receives a not-found or conflict error.
- What happens if the `workflow_logs` insert fails after the entity update? → The entire transaction rolls back; entity status reverts; no partial update persists.
- What happens if the same transition is requested simultaneously by two users (concurrent transition race)? → Only one succeeds; the other receives a conflict or invalid-state error.
- What happens when an entity is newly created? → It is assigned `COMPLETED` state automatically; no transition log is written at creation (initial state is not a transition).
- What happens if a user provides a justification for a forward transition? → The reason field is accepted as nullable and stored, but is not required for forward transitions.
- What happens when a non-existent entity type is submitted to the workflow engine? → The engine rejects the call with a validation error before any DB access.

---

## Requirements

### Functional Requirements

- **FR-001**: The workflow engine MUST enforce the state sequence: `COMPLETED → UNDER_REVIEW → APPROVED → ENABLED` as the only valid forward path.
- **FR-002**: The workflow engine MUST assign `COMPLETED` as the default state for any newly created workflow-enabled entity.
- **FR-003**: The workflow engine MUST reject any transition that skips one or more states, returning a `400 invalid_state_transition` error.
- **FR-004**: The workflow engine MUST reject any backward transition attempted by a user who lacks the explicit backward-transition permission, returning an authorization error.
- **FR-005**: The workflow engine MUST require a non-empty justification for every backward transition; requests without justification MUST be rejected.
- **FR-006**: Each workflow-enabled entity record MUST store `status` (enum), `status_updated_at` (server-authoritative timestamp), and `status_updated_by` (actor identifier) directly on the entity table.
- **FR-007**: The `workflow_logs` table MUST record every state transition with: entity type, entity identifier, previous state, new state, actor identifier, server-authoritative timestamp, and reason (nullable for forward, required for backward).
- **FR-008**: The `workflow_logs` table MUST be append-only; no UPDATE or DELETE operations are permitted on any log row.
- **FR-009**: Every state transition MUST execute as a single atomic transaction: (1) validate transition, (2) update entity status, (3) insert log row, (4) commit. Any failure in any step MUST roll back the entire operation.
- **FR-010**: The workflow engine MUST validate the actor's permission for the specific transition before performing any database write.
- **FR-011**: All status changes for any entity MUST pass through the workflow engine; direct repository-level status updates are forbidden.
- **FR-012**: The workflow engine MUST be implemented as a shared, generic service; no entity type may contain hardcoded workflow logic.
- **FR-013**: The workflow engine MUST use server-authoritative time for all `status_updated_at` and `changed_at` values; client-supplied timestamps are rejected.
- **FR-014**: The workflow engine MUST support granular per-transition, per-entity-type permission identifiers (e.g., `subject.review`, `question.approve`, `exam.enable`).
- **FR-015**: The workflow engine MUST operate strictly within the tenant database resolved by the tenant resolver; cross-tenant workflow operations are forbidden.
- **FR-016**: The workflow engine MUST support the following entity types in Phase 3: subjects, MCQ questions, traditional questions, exams, topics, library files, and templates.
- **FR-017**: Transition invocation MUST be idempotent in the sense that a caller submitting the exact same transition for the same entity when the entity is already in the target state receives a `400 invalid_state_transition` (not a silent success).

### Key Entities

- **WorkflowState**: An ordered enumeration of content lifecycle states — `COMPLETED`, `UNDER_REVIEW`, `APPROVED`, `ENABLED`. The sequence position determines transition legality.
- **WorkflowTransition**: A value object representing a directed edge in the state machine — source state, target state, required permission identifier, and whether the transition is forward or backward.
- **WorkflowContext**: The runtime input to the engine — entity type, entity identifier, target state, actor identifier, and optional reason. Fully resolved before any DB operation.
- **workflow_logs row**: An immutable audit record inserted for every completed transition. Fields: `id` (UUID), `entity_type`, `entity_id` (UUID), `previous_state`, `new_state`, `changed_by` (UUID), `changed_at` (server timestamp), `reason` (text, nullable).
- **WorkflowEnabled Entity**: Any content entity (subject, question, exam, topic, library file, template) that carries the `status`, `status_updated_at`, and `status_updated_by` fields and delegates all status mutations to the workflow engine.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of illegal forward transition attempts (state-skipping or invalid edge) are rejected with the correct error code; zero illegal state changes reach the database.
- **SC-002**: 100% of successfully completed transitions produce exactly one immutable audit log entry with no missing fields.
- **SC-003**: 100% of attempted backward transitions without the required permission are rejected; no unauthorized state regressions occur.
- **SC-004**: 100% of attempted backward transitions without a justification string are rejected; justification enforcement has no bypass path.
- **SC-005**: All status changes on all supported entity types are routed through the shared workflow engine — zero entity types implement independent status mutation logic.
- **SC-006**: Under simulated concurrent transition attempts on the same entity, no partial state or split audit entries are persisted; atomicity holds in all tested scenarios.
- **SC-007**: The workflow engine is reused without modification across at least two distinct entity types, demonstrated by passing integration tests for each.
- **SC-008**: All timestamp fields in entity records and workflow logs reflect server-authoritative time; no client-supplied timestamp influences any persisted value.

---

## Assumptions

- **A-001**: The permission system (roles + permissions) is already implemented or co-implemented in this phase; the workflow engine calls a permission-check interface and does not own the permission store.
- **A-002**: Tenant resolution and license middleware are already in place for all routes that invoke the workflow engine, in accordance with the mandatory middleware chain.
- **A-003**: The `COMPLETED` initial state is set directly during entity creation (not via a workflow transition), so no log entry is generated at creation time.
- **A-004**: In Phase 3, only the four standard states are used. Per-entity custom states are explicitly out of scope.
- **A-005**: Backward transitions move strictly one step at a time (e.g., `APPROVED → UNDER_REVIEW`); multi-step backward jumps are treated as illegal transitions.
- **A-006**: The reason/justification field for forward transitions is nullable and stored when provided, with no validation of its content beyond non-emptiness for backward transitions.
- **A-007**: The workflow engine is a domain package (not an API layer concept); it is called by API route handlers after authentication and authorization context has been established.

---

## Out of Scope (Phase 3)

- Per-entity custom workflow states or custom transition graphs.
- Automatic/scheduled workflow transitions driven by time or external events.
- Notification or event emission triggered by workflow transitions (may be added in a later phase).
- Bulk batch state transitions across multiple entities in a single request.
- UI components for workflow visualization.
- Workflow delegation or multi-approver flows.
