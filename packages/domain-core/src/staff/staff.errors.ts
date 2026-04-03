/**
 * Staff Domain — Error Types
 *
 * File: packages/domain-core/src/staff/staff.errors.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 *
 * Standard Zidney error contract for the staff domain.
 * All codes are unique per ZIDNEY_ERROR_REGISTRY.
 */

// ---------------------------------------------------------------------------
// Error code union
// ---------------------------------------------------------------------------

export type StaffErrorCode =
  | 'STAFF_NOT_FOUND'
  | 'STAFF_EMAIL_CONFLICT'
  | 'STAFF_LIMIT_EXCEEDED'
  | 'STAFF_ALREADY_ACTIVE'
  | 'STAFF_ALREADY_DISABLED'
  | 'STAFF_HAS_AUTHORED_CONTENT'

// ---------------------------------------------------------------------------
// HTTP status map
// ---------------------------------------------------------------------------

export const STAFF_ERROR_HTTP: Record<StaffErrorCode, number> = {
  STAFF_NOT_FOUND: 404,
  STAFF_EMAIL_CONFLICT: 409,
  STAFF_LIMIT_EXCEEDED: 403,
  STAFF_ALREADY_ACTIVE: 409,
  STAFF_ALREADY_DISABLED: 409,
  STAFF_HAS_AUTHORED_CONTENT: 409,
}

// ---------------------------------------------------------------------------
// Typed error class
// ---------------------------------------------------------------------------

export class StaffError extends Error {
  readonly code: StaffErrorCode
  readonly httpStatus: number

  constructor(code: StaffErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'StaffError'
    this.code = code
    this.httpStatus = STAFF_ERROR_HTTP[code]
  }
}
