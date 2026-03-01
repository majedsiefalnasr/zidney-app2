# STAGE 20 – Status Workflow Engine

Phase: 03_BACKOFFICE_CORE  
Domain: 01_FOUNDATION  
Scope: Reusable workflow state machine  
Database: Tenant DB only

---

## Stage Status

Status: DRAFT
Risk Level: MEDIUM
Last Updated: 2026-03-01T00:03:00.000Z

Scope Planned:

- Domain engine package: `packages/domain-core/src/workflow/` (states, types, errors, engine)
- Tenant migration: `20260301_002_workflow_engine.ts` — `workflow_logs` table, schema_version 1.2.0 → 1.3.0
- API module: `apps/api/src/modules/workflow/` — route, validation, context builder
- 5-step SELECT FOR UPDATE atomic transaction pattern
- WorkflowContext with workspaceSlug/workspaceId for structured log compliance
- Zidney error envelope with details/correlationId compliance

Deferred Scope:

- Per-entity custom workflow states or custom transition graphs
- Automatic/scheduled workflow transitions
- Notification or event emission triggered by transitions
- Bulk batch state transitions
- UI components for workflow visualization
- Workflow delegation or multi-approver flows
- Status columns on entity tables (added per-entity in Stage 21+)

Constitutional Compliance:

- Technical plan compliant — task generation authorized

Notes:
Technical plan complete. Guardian audit passed (post-fix). Task breakdown in progress.

---

## Objective

Implement a reusable, deterministic workflow engine that manages lifecycle states for tenant content entities.

This workflow must be:

- Strictly validated
- Role-permission enforced
- Fully audited
- Reusable across modules
- Immutable in history

The workflow engine must be generic and not entity-specific.

---

## Applicable Entities

Workflow applies to:

- Subjects
- MCQ Questions
- Traditional Questions
- Exams
- Topics
- Library files
- Templates
- Any future content entity

No entity may implement its own custom workflow logic outside this engine.

---

## Standard Workflow States

States (ordered):

1. COMPLETED
2. UNDER_REVIEW
3. APPROVED
4. ENABLED

Default state on creation:
COMPLETED

State progression is strictly linear unless explicitly reversed with permission.

---

## Transition Rules

Allowed forward transitions:

COMPLETED → UNDER_REVIEW  
UNDER_REVIEW → APPROVED  
APPROVED → ENABLED

Backward transitions:

- Allowed only with explicit permission
- Must be logged
- Must require justification

Illegal transitions must return 400 (invalid_state_transition).

Skipping states is not allowed.

Example (invalid):
COMPLETED → APPROVED

---

## Entity Storage Model

Each workflow-enabled entity must include:

- status (enum)
- status_updated_at
- status_updated_by

Status must not be stored in separate workflow table.

Workflow log stored separately.

---

## Workflow Log Table

Table: workflow_logs

Columns:

- id (UUID, PK)
- entity_type (varchar)
- entity_id (UUID)
- previous_state (varchar)
- new_state (varchar)
- changed_by (UUID)
- changed_at (timestamp)
- reason (text, nullable)

Logs must be immutable.

No update or delete allowed on workflow_logs.

---

## Permission Enforcement

Each transition must validate:

1. User authenticated
2. User role has permission to transition from X to Y
3. Module permission allowed

Permission model must allow:

- Granular transition control
- Future expansion without schema redesign

Permissions example:

- subject.review
- subject.approve
- subject.enable
- question.review
- question.approve
- exam.enable

Transition authorization must be validated before DB update.

---

## Transaction Rules

State transition must be atomic:

1. Validate transition
2. Update entity status
3. Insert workflow_log row
4. Commit transaction

No partial update allowed.

If log insert fails → entire transaction rolls back.

---

## Enforcement Scope

Workflow engine must be called:

- On manual status change
- On publish action
- On enable action
- On any content activation flow

No direct status update allowed in repositories.

All status changes must pass through workflow service.

---

## Extensibility Rules

Workflow engine must support:

- Adding new states later
- Custom workflow for specific entity types (future)
- Conditional transition validation (future)

But in Phase 3:

- Only standard workflow allowed
- No per-entity custom states

---

## Validation Criteria

Stage complete when:

- Illegal transitions blocked
- Backward transitions permission-gated
- Status stored in entity table
- workflow_logs table created
- Logs immutable
- All transitions atomic
- Shared across at least two modules
- No entity contains hardcoded status logic

---

## Not Allowed

- Hardcoded workflow inside entity services
- Silent status update
- Direct DB update bypassing workflow engine
- Skipping states
- Enabling without approval (unless explicitly configured later)
- Deleting workflow logs
- Cross-tenant workflow operations
