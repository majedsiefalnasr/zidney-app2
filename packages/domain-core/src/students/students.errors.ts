/**
 * Students Domain — Error Types
 *
 * File: packages/domain-core/src/students/students.errors.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 *
 * Standard Zidney error contract for the students domain.
 * All codes are unique per ZIDNEY_ERROR_REGISTRY.
 */

// ---------------------------------------------------------------------------
// Error code union
// ---------------------------------------------------------------------------

export type StudentErrorCode =
  | 'STUDENT_NOT_FOUND'
  | 'STUDENT_EMAIL_CONFLICT'
  | 'STUDENT_LIMIT_EXCEEDED'
  | 'STUDENT_ALREADY_ACTIVE'
  | 'STUDENT_ALREADY_DISABLED'
  | 'STUDENT_HAS_ATTEMPTS'
  | 'STUDENT_INVALID_PASSWORD'
  | 'STUDENT_DIVISION_NOT_FOUND'
  | 'STUDENT_DIVISION_INACTIVE'
  | 'STUDENT_DEPARTMENT_MISMATCH'
  | 'STUDENT_GROUP_MISMATCH'
  | 'STUDENT_INVALID_SUBSCRIPTION_STATUS'
  | 'STUDENT_BATCH_FAILED'

// ---------------------------------------------------------------------------
// HTTP status map
// ---------------------------------------------------------------------------

export const STUDENT_ERROR_HTTP: Record<StudentErrorCode, number> = {
  STUDENT_NOT_FOUND: 404,
  STUDENT_EMAIL_CONFLICT: 409,
  STUDENT_LIMIT_EXCEEDED: 422,
  STUDENT_ALREADY_ACTIVE: 409,
  STUDENT_ALREADY_DISABLED: 409,
  STUDENT_HAS_ATTEMPTS: 409,
  STUDENT_INVALID_PASSWORD: 422,
  STUDENT_DIVISION_NOT_FOUND: 404,
  STUDENT_DIVISION_INACTIVE: 422,
  STUDENT_DEPARTMENT_MISMATCH: 422,
  STUDENT_GROUP_MISMATCH: 422,
  STUDENT_INVALID_SUBSCRIPTION_STATUS: 422,
  STUDENT_BATCH_FAILED: 422,
}

// ---------------------------------------------------------------------------
// Typed error class
// ---------------------------------------------------------------------------

export class StudentError extends Error {
  readonly code: StudentErrorCode
  readonly httpStatus: number
  readonly limit_value?: number
  readonly current_value?: number

  constructor(
    code: StudentErrorCode,
    options?: string | { message?: string; limit_value?: number; current_value?: number }
  ) {
    const msg = typeof options === 'string' ? options : (options?.message ?? code)
    super(msg)
    this.name = 'StudentError'
    this.code = code
    this.httpStatus = STUDENT_ERROR_HTTP[code]
    if (typeof options !== 'string') {
      this.limit_value = options?.limit_value
      this.current_value = options?.current_value
    }
  }
}
