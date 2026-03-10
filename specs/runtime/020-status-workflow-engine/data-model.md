# Data Model: Status Workflow Engine

**Stage**: STAGE_20_STATUS_WORKFLOW_ENGINE  
**Branch**: `020-status-workflow-engine`  
**Date**: 2026-03-01  
**Source**: research.md (R-001 through R-008)

---

## 1. TypeScript Enumerations and Value Objects

### 1.1 `WorkflowState` Enum

Defined in `packages/domain-core/src/workflow/workflow.states.ts`.

```typescript
/**
 * Ordered lifecycle states for all workflow-enabled content entities.
 * Sequence position determines transition legality (FR-001).
 * Initial state for newly created entities is COMPLETED (FR-002, A-003).
 */
export enum WorkflowState {
  COMPLETED = "COMPLETED",
  UNDER_REVIEW = "UNDER_REVIEW",
  APPROVED = "APPROVED",
  ENABLED = "ENABLED",
}

/**
 * Ordered array — index position is the canonical sequence number.
 * COMPLETED=0, UNDER_REVIEW=1, APPROVED=2, ENABLED=3
 */
export const WORKFLOW_STATE_ORDER: WorkflowState[] = [
  WorkflowState.COMPLETED,
  WorkflowState.UNDER_REVIEW,
  WorkflowState.APPROVED,
  WorkflowState.ENABLED,
];
```

### 1.2 Transition Table

```typescript
/**
 * Each entry defines one allowable directed edge in the state machine.
 *
 * forward: true  → sequence index of `to` > sequence index of `from`
 * forward: false → backward transition (requires justification + backward permission)
 *
 * permission: the exact identifier the route handler must include in
 *             WorkflowContext.permissions for the transition to be authorised.
 *
 * Format: "{entity_type}.{action}" — resolved by the route handler from the
 * actor's permission set before calling executeTransition().
 *
 * Entity-type placeholders are not encoded here; the engine validates that
 * the entity_type is registered and that the required permission string exists
 * in context.permissions (FR-014).
 */
export interface WorkflowTransitionDefinition {
  from: WorkflowState;
  to: WorkflowState;
  forward: boolean;
  actionKey: string; // e.g. 'review' | 'approve' | 'enable' | 'return'
}

export const WORKFLOW_TRANSITIONS: WorkflowTransitionDefinition[] = [
  // Forward transitions
  {
    from: WorkflowState.COMPLETED,
    to: WorkflowState.UNDER_REVIEW,
    forward: true,
    actionKey: "review",
  },
  {
    from: WorkflowState.UNDER_REVIEW,
    to: WorkflowState.APPROVED,
    forward: true,
    actionKey: "approve",
  },
  {
    from: WorkflowState.APPROVED,
    to: WorkflowState.ENABLED,
    forward: true,
    actionKey: "enable",
  },
  // Backward transitions (one step only — A-005)
  {
    from: WorkflowState.UNDER_REVIEW,
    to: WorkflowState.COMPLETED,
    forward: false,
    actionKey: "return",
  },
  {
    from: WorkflowState.APPROVED,
    to: WorkflowState.UNDER_REVIEW,
    forward: false,
    actionKey: "return",
  },
];
```

### 1.3 `WorkflowContext` Value Object

```typescript
/**
 * Runtime input to the workflow engine (FR-015, clarification session).
 *
 * - db is NOT embedded here. It is the explicit first parameter of executeTransition().
 * - permissions[] is fully resolved by the API route handler from auth context
 *   BEFORE calling the engine (A-001, A-002).
 * - reason is nullable for forward transitions, required for backward (FR-005).
 */
export interface WorkflowContext {
  entityType: string; // e.g. 'subject' | 'question' | 'exam' | 'topic' | 'library_file' | 'template'
  entityId: string; // UUID of the target entity
  targetState: WorkflowState;
  actorId: string; // UUID of the authenticated user (from JWT)
  permissions: string[]; // All permission identifiers held by actor for this tenant
  reason?: string; // Justification (nullable for forward, required for backward)
  correlationId: string; // Propagated from request headers (for structured logs)
  workspaceSlug: string; // Tenant slug — from tenant resolver context (required for logs: AGENTS.md)
  workspaceId: string; // Tenant UUID — from tenant resolver context (required for logs: AGENTS.md)
}
```

### 1.4 `WorkflowTransitionResult` Value Object

```typescript
export interface WorkflowTransitionResult {
  entityType: string;
  entityId: string;
  previousState: WorkflowState;
  newState: WorkflowState;
  changedBy: string; // actorId
  changedAt: Date; // server-authoritative timestamp from DB (NOW())
  logId: string; // UUID of the inserted workflow_logs row
}
```

---

## 2. Database Tables (Tenant Schema)

### 2.1 `workflow_logs` Table

**Purpose**: Immutable append-only audit trail for every state transition across all entity types
(FR-007, FR-008).

**Lives in**: tenant database only — never in master_db.

```sql
CREATE TABLE IF NOT EXISTS workflow_logs (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type    VARCHAR(100)  NOT NULL,
  entity_id      UUID          NOT NULL,
  previous_state VARCHAR(50)   NOT NULL
    CHECK (previous_state IN ('COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED')),
  new_state      VARCHAR(50)   NOT NULL
    CHECK (new_state IN ('COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED')),
  changed_by     UUID          NOT NULL,
  changed_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  reason         TEXT
);
```

**Constraints**:

- `PRIMARY KEY` on `id` — unique per log entry.
- `CHECK` on `previous_state` and `new_state` — enforces valid state values at DB level (Research
  R-007).
- `NOT NULL` on all fields except `reason` (nullable for forward transitions).
- No `UPDATE` or `DELETE` allowed — enforced via `prevent_audit_modification()` trigger (Research
  R-006).

**Immutability trigger** (created in migration):

```sql
CREATE TRIGGER prevent_workflow_log_modification
  BEFORE UPDATE OR DELETE ON workflow_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();
```

---

### 2.2 Required Indexes on `workflow_logs`

| Index name                    | Columns                                              | Query served                                               |
| ----------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| `idx_wfl_entity_created`      | `(entity_type, entity_id, changed_at DESC, id DESC)` | Paginated audit history per entity — User Story 5 (FR-007) |
| `idx_wfl_actor_created`       | `(changed_by, changed_at DESC)`                      | Actor activity query (admin audit support)                 |
| `idx_wfl_entity_type_created` | `(entity_type, changed_at DESC)`                     | Bulk type-level reporting                                  |

---

### 2.3 Workflow-Enabled Entity Fields (FR-006)

Every workflow-enabled entity table (subjects, MCQ questions, traditional questions, exams, topics,
library files, templates) **MUST** carry these three columns:

| Column name         | Type          | Constraint                                                                           | Default       | Notes                                                                             |
| ------------------- | ------------- | ------------------------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------- |
| `status`            | `VARCHAR(50)` | `NOT NULL`, `CHECK (status IN ('COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED'))` | `'COMPLETED'` | Set at entity creation — no log entry (A-003)                                     |
| `status_updated_at` | `TIMESTAMPTZ` | `NOT NULL`                                                                           | `NOW()`       | Must be updated by the engine via `NOW()` — never client timestamp (FR-013)       |
| `status_updated_by` | `UUID`        | `NULLABLE initially, NOT NULL after first transition`                                | `NULL`        | NULL only while entity remains in initial COMPLETED state before first transition |

**Note**: The `status_updated_by` column is nullable at creation (entity may be created without an
explicit actor for the initial state assignment, per A-003). It becomes non-null after the first
workflow transition is recorded.

---

### 2.4 Generic Entity Row Shape (TypeScript Interface)

The workflow engine accesses entity rows by a generic interface. Each entity table that integrates
with the engine must satisfy:

```typescript
/**
 * Minimal shape the engine reads/writes on any workflow-enabled entity table.
 * The engine SELECT FOR UPDATE fetches these fields; UPDATE writes back after validation.
 */
export interface WorkflowEnabledEntityRow {
  id: string; // UUID
  status: WorkflowState; // current lifecycle state
  status_updated_at: Date; // last transition timestamp
  status_updated_by: string | null; // UUID of actor who made last transition
}
```

---

### 2.5 Entity Type Registry

The engine must reject calls with unregistered entity types before any DB access (Error contract:
`400 unknown_entity_type`). The registry is defined as a plain set in `workflow.states.ts`:

```typescript
/**
 * Set of entity type identifiers the workflow engine accepts (FR-016).
 * Adding a new entity type requires only adding its string here and
 * the corresponding entity table (no engine code changes).
 */
export const WORKFLOW_ENTITY_TYPES = new Set<string>([
  "subject",
  "mcq_question",
  "traditional_question",
  "exam",
  "topic",
  "library_file",
  "template",
]);
```

---

## 3. Permission Identifier Convention (FR-014)

Permissions follow the format `{entity_type}.{action_key}`:

| Entity type                           | action_key | Permission identifier | Transition                 |
| ------------------------------------- | ---------- | --------------------- | -------------------------- |
| `subject`                             | `review`   | `subject.review`      | `COMPLETED → UNDER_REVIEW` |
| `subject`                             | `approve`  | `subject.approve`     | `UNDER_REVIEW → APPROVED`  |
| `subject`                             | `enable`   | `subject.enable`      | `APPROVED → ENABLED`       |
| `subject`                             | `return`   | `subject.return`      | Any backward transition    |
| `mcq_question`                        | `review`   | `mcq_question.review` | `COMPLETED → UNDER_REVIEW` |
| _(same pattern for all entity types)_ |            |                       |                            |

The engine constructs the required permission identifier as:

```typescript
const requiredPermission = `${context.entityType}.${transitionDef.actionKey}`;
```

It then checks: `context.permissions.includes(requiredPermission)`.

---

## 4. Error Code Mapping

```typescript
export const WORKFLOW_ERROR_CODES = {
  INVALID_STATE_TRANSITION: "invalid_state_transition", // 400
  JUSTIFICATION_REQUIRED: "justification_required", // 400
  UNKNOWN_ENTITY_TYPE: "unknown_entity_type", // 400
  WORKFLOW_PERMISSION_DENIED: "workflow_permission_denied", // 403
  ENTITY_NOT_FOUND: "entity_not_found", // 404
  WORKFLOW_CONFLICT: "workflow_conflict", // 409
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded", // 429 (API layer only)
} as const;

export const WORKFLOW_ERROR_HTTP_STATUS: Record<string, number> = {
  invalid_state_transition: 400,
  justification_required: 400,
  unknown_entity_type: 400,
  workflow_permission_denied: 403,
  entity_not_found: 404,
  workflow_conflict: 409,
  rate_limit_exceeded: 429,
};
```

---

## 5. State Machine Diagram

```
              ┌──────────────┐
   [create]   │  COMPLETED   │ ◄── initial state (no log written)
  ──────────► │              │
              └──────┬───────┘
                     │ subject.review (forward)
                     ▼
              ┌──────────────┐
              │ UNDER_REVIEW │
              └──────┬───────┘
                     │ subject.approve (forward)
        ◄────────────┘ subject.return  (backward, justification required)
                     ▼
              ┌──────────────┐
              │   APPROVED   │
              └──────┬───────┘
                     │ subject.enable (forward)
        ◄────────────┘ subject.return  (backward, justification required)
                     ▼
              ┌──────────────┐
              │   ENABLED    │  (terminal — no outbound transitions in Phase 3)
              └──────────────┘
```

All transitions not shown in the diagram are illegal and return `400 invalid_state_transition`.

---

## 6. Validation Rules

| Rule                                                         | Source                 | Enforcement point                 |
| ------------------------------------------------------------ | ---------------------- | --------------------------------- |
| Entity type must be in `WORKFLOW_ENTITY_TYPES`               | FR-016                 | Engine, before any DB access      |
| Source state must match current entity state                 | FR-003                 | Engine, after `SELECT FOR UPDATE` |
| Only defined transition edges are valid                      | FR-001, FR-003         | Engine, transition table lookup   |
| Backward transition requires `reason` (non-empty)            | FR-005                 | Engine, before DB write           |
| Actor must hold required permission                          | FR-004, FR-010, FR-014 | Engine, after transition lookup   |
| `status_updated_at` set via `NOW()` — never client timestamp | FR-013                 | SQL `UPDATE` clause               |
| `changed_at` set via `NOW()` — never client timestamp        | FR-013                 | SQL `INSERT` clause               |
| Idempotency: same-state re-attempt returns 400               | FR-017                 | Engine, state legality check      |
