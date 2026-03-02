/**
 * Workflow Engine — Error Classes and Constants
 *
 * File: packages/domain-core/src/workflow/workflow.errors.ts
 * Stage: STAGE_20_STATUS_WORKFLOW_ENGINE
 * Date: 2026-03-01
 *
 * WorkflowError class and typed error code constants.
 * All errors produce the platform-standard response shape:
 *   { success: false, data: null, error: { code, message, details, correlationId } }
 *
 * Pattern mirrors translation.errors.ts exactly for consistency.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — pure error definitions
 * ✓ No DB imports
 * ✓ No framework dependencies
 */

// -------------------------------------------------------------------------
// Error Code Constants
// -------------------------------------------------------------------------

/**
 * Error codes keyed by logical name.
 * Values are lowercase snake_case per the API error contract.
 */
export const WORKFLOW_ERROR_CODES = {
  INVALID_STATE_TRANSITION: 'invalid_state_transition',
  JUSTIFICATION_REQUIRED: 'justification_required',
  UNKNOWN_ENTITY_TYPE: 'unknown_entity_type',
  WORKFLOW_PERMISSION_DENIED: 'workflow_permission_denied',
  ENTITY_NOT_FOUND: 'entity_not_found',
  WORKFLOW_CONFLICT: 'workflow_conflict',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
} as const

/** Union of all valid workflow error code strings */
export type WorkflowErrorCode =
  (typeof WORKFLOW_ERROR_CODES)[keyof typeof WORKFLOW_ERROR_CODES]

/** HTTP status code mapping per error code */
export const WORKFLOW_ERROR_HTTP_STATUS: Record<WorkflowErrorCode, number> = {
  invalid_state_transition: 400,
  justification_required: 400,
  unknown_entity_type: 400,
  workflow_permission_denied: 403,
  entity_not_found: 404,
  workflow_conflict: 409,
  rate_limit_exceeded: 429,
}

// -------------------------------------------------------------------------
// WorkflowError Class
// -------------------------------------------------------------------------

/**
 * Domain error class for all workflow engine operation failures.
 *
 * Usage:
 *   throw new WorkflowError('invalid_state_transition', "Cannot transition
 *     from COMPLETED to ENABLED directly.")
 *
 * Route handlers catch this and return the appropriate HTTP status + error body.
 */
export class WorkflowError extends Error {
  /** Machine-readable error code */
  readonly code: WorkflowErrorCode
  /** HTTP status code associated with this error */
  readonly httpStatus: number

  constructor(code: WorkflowErrorCode, message: string) {
    super(message)
    this.name = 'WorkflowError'
    this.code = code
    this.httpStatus = WORKFLOW_ERROR_HTTP_STATUS[code]
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, WorkflowError.prototype)
  }

  /**
   * Returns the platform-standard error response shape.
   * correlationId is injected by the route handler, not stored here.
   */
  toResponseBody(): {
    success: false
    data: null
    error: { code: string; message: string }
  } {
    return {
      success: false,
      data: null,
      error: {
        code: this.code,
        message: this.message,
      },
    }
  }
}

// -------------------------------------------------------------------------
// Convenience Factory Functions
// -------------------------------------------------------------------------

/** Attempted transition is not a valid state machine edge (400) */
export function invalidStateTransition(
  from: string,
  to: string
): WorkflowError {
  return new WorkflowError(
    'invalid_state_transition',
    `Transition from '${from}' to '${to}' is not allowed.`
  )
}

/** Backward transition attempted without required justification (400) */
export function justificationRequired(): WorkflowError {
  return new WorkflowError(
    'justification_required',
    'A non-empty justification reason is required for backward transitions.'
  )
}

/** Entity type not registered in WORKFLOW_ENTITY_TYPES (400) */
export function unknownEntityType(entityType: string): WorkflowError {
  return new WorkflowError(
    'unknown_entity_type',
    `Entity type '${entityType}' is not a registered workflow-enabled entity type.`
  )
}

/** Actor lacks the required permission for this transition (403) */
export function workflowPermissionDenied(
  permission: string,
  actorId: string
): WorkflowError {
  return new WorkflowError(
    'workflow_permission_denied',
    `Actor '${actorId}' does not have the required permission '${permission}'.`
  )
}

/** Entity row not found in tenant database (404) */
export function entityNotFound(
  entityType: string,
  entityId: string
): WorkflowError {
  return new WorkflowError(
    'entity_not_found',
    `Entity of type '${entityType}' with id '${entityId}' was not found.`
  )
}

/** Concurrent transition conflict — serialisation failure (409) */
export function workflowConflict(entityId: string): WorkflowError {
  return new WorkflowError(
    'workflow_conflict',
    `A concurrent transition is already in progress for entity '${entityId}'.`
  )
}
