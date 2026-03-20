/**
 * Semesters — Domain Errors
 *
 * File: packages/domain-core/src/semesters/semesters.errors.ts
 * Stage: STAGE_27_SEMESTERS
 */

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

export type SemestersErrorCode =
  | 'SEMESTER_NOT_FOUND'
  | 'SEMESTER_NAME_DUPLICATE'
  | 'SEMESTER_DATE_RANGE_INVALID'
  | 'SEMESTER_DISABLED'
  | 'SEMESTER_HAS_STUDENTS'
  | 'SEMESTER_HAS_SUBJECTS'
  | 'VALIDATION_ERROR'

// ---------------------------------------------------------------------------
// HTTP Status Map
// ---------------------------------------------------------------------------

export const SEMESTERS_ERROR_HTTP_STATUS: Record<SemestersErrorCode, number> = {
  SEMESTER_NOT_FOUND: 404,
  SEMESTER_NAME_DUPLICATE: 409,
  SEMESTER_DATE_RANGE_INVALID: 422,
  SEMESTER_DISABLED: 422,
  SEMESTER_HAS_STUDENTS: 422,
  SEMESTER_HAS_SUBJECTS: 422,
  VALIDATION_ERROR: 422,
}

// ---------------------------------------------------------------------------
// Error Messages
// ---------------------------------------------------------------------------

export const SEMESTERS_ERROR_MESSAGES: Record<SemestersErrorCode, string> = {
  SEMESTER_NOT_FOUND: 'Semester not found.',
  SEMESTER_NAME_DUPLICATE: 'A semester with this name already exists.',
  SEMESTER_DATE_RANGE_INVALID: 'end_date must be on or after start_date.',
  SEMESTER_DISABLED: 'Semester is disabled.',
  SEMESTER_HAS_STUDENTS: 'Semester has enrolled students and cannot be deleted.',
  SEMESTER_HAS_SUBJECTS: 'Semester has subjects and cannot be deleted.',
  VALIDATION_ERROR: 'Invalid request data.',
}

// ---------------------------------------------------------------------------
// Error Class
// ---------------------------------------------------------------------------

export class SemestersError extends Error {
  public readonly code: SemestersErrorCode
  public readonly httpStatus: number

  constructor(
    code: SemestersErrorCode,
    message: string = SEMESTERS_ERROR_MESSAGES[code],
    httpStatus: number = SEMESTERS_ERROR_HTTP_STATUS[code]
  ) {
    super(message)
    this.name = 'SemestersError'
    this.code = code
    this.httpStatus = httpStatus
  }
}
