# Specify Report — STAGE_20_STATUS_WORKFLOW_ENGINE

**Step:** 1 — Specify
**Timestamp:** 2026-03-01T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

Specification for the Status Workflow Engine is complete. The engine is a reusable, deterministic, permission-gated state machine managing lifecycle states for all tenant content entities in Phase 3 Backoffice. 6 user stories, 17 functional requirements, 8 success criteria, 7 assumptions, and all edge cases are fully defined. The checklist passed on first validation run with all 12 items passing.

---

## Inputs Reviewed

- `specs/runtime/020-status-workflow-engine/spec.md`
- `specs/runtime/020-status-workflow-engine/checklists/requirements.md`
- `specs/phases/03_BACKOFFICE_CORE/01_FOUNDATION/STAGE_20_STATUS_WORKFLOW_ENGINE.md`

---

## Key Decisions

| #   | Decision                                                                   | Rationale                                                                                                   |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Initial `COMPLETED` state set at creation — not a transition               | Avoids noise in audit trail for every new entity; aligns with stage spec "default state on creation"        |
| 2   | Backward transitions are one-step only                                     | "Strictly linear" language in stage file implies ordinal adjacency; multi-step backward = illegal           |
| 3   | Justification required only for backward transitions                       | Forward transitions accept nullable reason; backward transitions enforce non-empty to preserve audit trail  |
| 4   | No events emitted on transition in Phase 3                                 | No notification system exists yet; avoids premature coupling                                                |
| 5   | Concurrency handling mechanism deferred to planning step                   | Atomicity outcome defined (SC-006); mechanism (optimistic lock vs. serializable) is an ADR/planning concern |
| 6   | Engine lives in domain package layer, not API layer                        | Matches import boundary rules; API handlers call engine after auth/tenant context is established            |
| 7   | Permission-check interface call — engine does not own the permission store | Keeps engine generic and avoids circular dependency with role/permission system                             |

---

## Functional Requirements Captured

- **FR-001**: Enforce state sequence `COMPLETED → UNDER_REVIEW → APPROVED → ENABLED` as the only valid forward path
- **FR-002**: Assign `COMPLETED` as default state on entity creation
- **FR-003**: Reject any state-skipping transition with `400 invalid_state_transition`
- **FR-004**: Reject backward transitions without explicit backward-transition permission (authorization error)
- **FR-005**: Require non-empty justification for every backward transition
- **FR-006**: Entity records must carry `status`, `status_updated_at`, `status_updated_by`
- **FR-007**: `workflow_logs` records every transition: entity type, entity id, previous state, new state, actor, server timestamp, reason (nullable forward / required backward)
- **FR-008**: `workflow_logs` is append-only — no UPDATE or DELETE permitted
- **FR-009**: Every transition is a single atomic transaction (validate → update entity → insert log → commit)
- **FR-010**: Permission validated before any DB write
- **FR-011**: All status changes must pass through the workflow engine; direct repo-level updates are forbidden
- **FR-012**: Engine is a shared generic service — no entity-specific hardcoded workflow logic
- **FR-013**: All timestamps use server-authoritative time; client timestamps are rejected
- **FR-014**: Granular per-transition, per-entity-type permission identifiers (e.g., `subject.review`, `exam.enable`)
- **FR-015**: Engine operates within tenant DB resolved by tenant resolver; no cross-tenant operations
- **FR-016**: Phase 3 entity types: subjects, MCQ questions, traditional questions, exams, topics, library files, templates
- **FR-017**: Idempotency: transitioning an entity already in target state returns `400 invalid_state_transition`

---

## Clarifications Required

None — all ambiguities resolved inline from stage file and constitutional constraints.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                                     |
| --------------------------------------- | ------ | ------------------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | FR-015 explicitly enforces tenant-db isolation via resolver               |
| License middleware requirement captured | ✅     | A-002 confirms middleware chain prerequisite                              |
| Snapshot integrity requirement captured | ✅     | N/A for workflow engine (no attempt logic); entity immutability preserved |
| Idempotency strategy defined            | ✅     | FR-017 defines idempotency behavior for duplicate transition calls        |
| Transaction boundaries identified       | ✅     | FR-009 defines complete atomic transaction boundaries                     |
| Server-authoritative time enforced      | ✅     | FR-013 and SC-008 explicitly prohibit client-supplied timestamps          |

**Overall:** COMPLIANT

---

## Open Risks

- Concurrency mechanism not yet specified (optimistic lock vs. serializable isolation) — to be resolved in Plan step.
- Permission system (STAGE_21) must be co-implemented or available as an interface; engine depends on it.

---

## Next Step

Proceed to Step 2 — Clarify.
