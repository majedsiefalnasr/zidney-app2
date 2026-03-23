/**
 * Workflow Engine — State Machine Definitions
 *
 * File: packages/domain-core/src/workflow/workflow.states.ts
 * Stage: STAGE_20_STATUS_WORKFLOW_ENGINE
 * Date: 2026-03-01
 *
 * Exports the canonical state enum, ordered state array,
 * all valid transition edges, and the entity type registry.
 *
 * No imports from framework or DB — pure domain definitions.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — pure domain constants
 * ✓ No DB imports
 * ✓ No framework dependencies
 */

// -------------------------------------------------------------------------
// WorkflowState Enum
// -------------------------------------------------------------------------

/**
 * Ordered lifecycle states for all workflow-enabled content entities.
 * Sequence position determines transition legality (FR-001).
 * Initial state for newly created entities is COMPLETED (FR-002, A-003).
 * DRAFT is the initial state for MCQ Baskets (STAGE_33_MCQ_BASKETS).
 */
export enum WorkflowState {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  ENABLED = 'ENABLED',
}

/**
 * Ordered array — index position is the canonical sequence number.
 * DRAFT=0, COMPLETED=1, UNDER_REVIEW=2, APPROVED=3, ENABLED=4
 */
export const WORKFLOW_STATE_ORDER: WorkflowState[] = [
  WorkflowState.DRAFT,
  WorkflowState.COMPLETED,
  WorkflowState.UNDER_REVIEW,
  WorkflowState.APPROVED,
  WorkflowState.ENABLED,
]

// -------------------------------------------------------------------------
// Transition Table
// -------------------------------------------------------------------------

/**
 * Each entry defines one allowable directed edge in the state machine.
 *
 * forward: true  → sequence index of `to` > sequence index of `from`
 * forward: false → backward transition (requires justification + backward permission)
 *
 * actionKey: the action suffix used to build the permission identifier
 *   Format: `${entityType}.${actionKey}` — validated against context.permissions
 */
export interface WorkflowTransitionDefinition {
  from: WorkflowState
  to: WorkflowState
  forward: boolean
  /** e.g. 'review' | 'approve' | 'enable' | 'return' */
  actionKey: string
}

/**
 * Complete transition table — 3 forward edges + 2 backward edges = 5 total.
 * Only edges listed here are valid transitions. All others return
 * 400 invalid_state_transition.
 */
export const WORKFLOW_TRANSITIONS: WorkflowTransitionDefinition[] = [
  // Forward transitions
  {
    from: WorkflowState.DRAFT,
    to: WorkflowState.COMPLETED,
    forward: true,
    actionKey: 'complete',
  },
  {
    from: WorkflowState.COMPLETED,
    to: WorkflowState.UNDER_REVIEW,
    forward: true,
    actionKey: 'review',
  },
  {
    from: WorkflowState.UNDER_REVIEW,
    to: WorkflowState.APPROVED,
    forward: true,
    actionKey: 'approve',
  },
  {
    from: WorkflowState.APPROVED,
    to: WorkflowState.ENABLED,
    forward: true,
    actionKey: 'enable',
  },
  // Backward transitions (one step only — A-005)
  // Requires non-empty reason AND `{entityType}.return` permission
  {
    from: WorkflowState.UNDER_REVIEW,
    to: WorkflowState.COMPLETED,
    forward: false,
    actionKey: 'return',
  },
  {
    from: WorkflowState.APPROVED,
    to: WorkflowState.UNDER_REVIEW,
    forward: false,
    actionKey: 'return',
  },
]

// -------------------------------------------------------------------------
// Entity Type Registry
// -------------------------------------------------------------------------

/**
 * Set of entity type identifiers the workflow engine accepts (FR-016).
 * Adding a new entity type requires only adding its string here and
 * the corresponding entity table — no engine code changes needed.
 *
 * Phase 3 entity types (7 total):
 */
export const WORKFLOW_ENTITY_TYPES = new Set<string>([
  'subject',
  'mcq_question',
  'traditional_question',
  'exam',
  'topic',
  'library_file',
  'template',
  'mcq_basket',
])
