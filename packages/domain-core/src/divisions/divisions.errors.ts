/**
 * Divisions Domain — Error Classes and Constants
 *
 * File: packages/domain-core/src/divisions/divisions.errors.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * DivisionsError class and typed error code constants.
 * All errors produce the platform-standard response shape:
 *   { success: false, data: null, error: { code, message, correlationId } }
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — pure error definitions
 * ✓ No DB imports
 * ✓ No framework dependencies
 */

// ---------------------------------------------------------------------------
// Error Code Type
// ---------------------------------------------------------------------------

/**
 * All valid divisions error codes.
 * HTTP status codes are defined in DIVISIONS_ERROR_HTTP_STATUS below.
 */
export type DivisionsErrorCode =
  | 'DIVISION_NOT_FOUND' // 404
  | 'DIV_STAFF_ASSIGNMENT_NOT_FOUND' // 404
  | 'DIVISION_NAME_CONFLICT' // 409
  | 'DEFAULT_DIVISION_IMMUTABLE' // 422
  | 'DIVISION_IN_USE' // 422
  | 'DIVISION_DISABLED' // 422
  | 'DIVISION_REQUIRED' // 422
  | 'STAFF_MINIMUM_DIVISION_REQUIRED' // 422
  | 'DESTRUCTIVE_CONFIRMATION_REQUIRED' // 422
  | 'DIVISIONS_FEATURE_DISABLED' // 423
  | 'DIVISIONS_FEATURE_LOCKED' // 423
  | 'VALIDATION_ERROR' // 422

// ---------------------------------------------------------------------------
// HTTP Status Mapping
// ---------------------------------------------------------------------------

/** HTTP status code for each DivisionsErrorCode. */
export const DIVISIONS_ERROR_HTTP_STATUS: Record<DivisionsErrorCode, number> = {
  DIVISION_NOT_FOUND: 404,
  DIV_STAFF_ASSIGNMENT_NOT_FOUND: 404,
  DIVISION_NAME_CONFLICT: 409,
  DEFAULT_DIVISION_IMMUTABLE: 422,
  DIVISION_IN_USE: 422,
  DIVISION_DISABLED: 422,
  DIVISION_REQUIRED: 422,
  STAFF_MINIMUM_DIVISION_REQUIRED: 422,
  DESTRUCTIVE_CONFIRMATION_REQUIRED: 422,
  DIVISIONS_FEATURE_DISABLED: 423,
  DIVISIONS_FEATURE_LOCKED: 423,
  VALIDATION_ERROR: 422,
}

// ---------------------------------------------------------------------------
// Default Messages
// ---------------------------------------------------------------------------

/** Human-readable default message for each DivisionsErrorCode. */
export const DIVISIONS_ERROR_MESSAGES: Record<DivisionsErrorCode, string> = {
  DIVISION_NOT_FOUND: 'Division not found.',
  DIV_STAFF_ASSIGNMENT_NOT_FOUND: 'Staff division assignment not found.',
  DIVISION_NAME_CONFLICT: 'A division with this name already exists.',
  DEFAULT_DIVISION_IMMUTABLE: 'The default division cannot be modified or deleted.',
  DIVISION_IN_USE: 'Division is in use and cannot be deleted.',
  DIVISION_DISABLED: 'Division is disabled and not accepting new assignments.',
  DIVISION_REQUIRED: 'A division assignment is required.',
  STAFF_MINIMUM_DIVISION_REQUIRED: 'Staff member must remain in at least one division.',
  DESTRUCTIVE_CONFIRMATION_REQUIRED:
    "Confirmation value 'DISABLE_DIVISIONS' is required for this destructive operation.",
  DIVISIONS_FEATURE_DISABLED: 'The divisions feature is disabled for this workspace.',
  DIVISIONS_FEATURE_LOCKED: 'The divisions feature is locked during an ongoing operation.',
  VALIDATION_ERROR: 'Validation failed.',
}

// ---------------------------------------------------------------------------
// DivisionsError Class
// ---------------------------------------------------------------------------

/**
 * Domain error class for all divisions operation failures.
 *
 * Usage:
 *   throw new DivisionsError('DIVISION_NOT_FOUND')
 *   throw new DivisionsError('DIVISION_NAME_CONFLICT', 'A division named "Alpha" already exists.')
 *
 * Route handlers catch this, look up the HTTP status from DIVISIONS_ERROR_HTTP_STATUS,
 * and return the platform-standard error body.
 */
export class DivisionsError extends Error {
  /** Machine-readable error code */
  readonly code: DivisionsErrorCode
  /** HTTP status code associated with this error */
  readonly httpStatus: number

  constructor(code: DivisionsErrorCode, message?: string) {
    super(message ?? DIVISIONS_ERROR_MESSAGES[code])
    this.name = 'DivisionsError'
    this.code = code
    this.httpStatus = DIVISIONS_ERROR_HTTP_STATUS[code]
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, DivisionsError.prototype)
  }
}
