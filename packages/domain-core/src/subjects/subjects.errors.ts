/**
 * Subjects — Domain Errors
 *
 * File: packages/domain-core/src/subjects/subjects.errors.ts
 * Stage: STAGE_28_SUBJECTS
 *
 * Error codes include the 3 OBS-1 additions from the drift analysis:
 *   - SUBJECT_DIVISION_DISABLED
 *   - SUBJECT_MISSING_TRANSLATIONS
 *   - SUBJECT_INVALID_DEFAULT_LANGUAGE
 */

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

export type SubjectsErrorCode =
  | 'SUBJECT_NOT_FOUND'
  | 'SUBJECT_NAME_DUPLICATE'
  | 'SUBJECT_CODE_DUPLICATE'
  | 'SUBJECT_DIVISION_NOT_FOUND'
  | 'SUBJECT_SEMESTER_NOT_FOUND'
  | 'SUBJECT_SEMESTER_DIVISION_MISMATCH'
  | 'SUBJECT_INVALID_TRANSITION'
  | 'SUBJECT_TRANSITION_CONFLICT'
  | 'SUBJECT_ARCHIVED'
  | 'SUBJECT_HAS_DEPENDENT_CONTENT'
  | 'SUBJECT_DIVISION_DISABLED'
  | 'SUBJECT_MISSING_TRANSLATIONS'
  | 'SUBJECT_INVALID_DEFAULT_LANGUAGE'
  | 'VALIDATION_ERROR'

// ---------------------------------------------------------------------------
// HTTP Status Map
// ---------------------------------------------------------------------------

export const SUBJECTS_ERROR_HTTP_STATUS: Record<SubjectsErrorCode, number> = {
  SUBJECT_NOT_FOUND: 404,
  SUBJECT_NAME_DUPLICATE: 409,
  SUBJECT_CODE_DUPLICATE: 409,
  SUBJECT_DIVISION_NOT_FOUND: 404,
  SUBJECT_SEMESTER_NOT_FOUND: 404,
  SUBJECT_SEMESTER_DIVISION_MISMATCH: 422,
  SUBJECT_INVALID_TRANSITION: 422,
  SUBJECT_TRANSITION_CONFLICT: 409,
  SUBJECT_ARCHIVED: 422,
  SUBJECT_HAS_DEPENDENT_CONTENT: 422,
  SUBJECT_DIVISION_DISABLED: 422,
  SUBJECT_MISSING_TRANSLATIONS: 422,
  SUBJECT_INVALID_DEFAULT_LANGUAGE: 422,
  VALIDATION_ERROR: 422,
}

// ---------------------------------------------------------------------------
// Error Messages
// ---------------------------------------------------------------------------

export const SUBJECTS_ERROR_MESSAGES: Record<SubjectsErrorCode, string> = {
  SUBJECT_NOT_FOUND: 'Subject not found.',
  SUBJECT_NAME_DUPLICATE: 'A subject with this name already exists.',
  SUBJECT_CODE_DUPLICATE: 'A subject with this code already exists.',
  SUBJECT_DIVISION_NOT_FOUND: 'Division not found.',
  SUBJECT_SEMESTER_NOT_FOUND: 'Semester not found.',
  SUBJECT_SEMESTER_DIVISION_MISMATCH: 'Semester does not belong to the specified division.',
  SUBJECT_INVALID_TRANSITION: 'Invalid status transition.',
  SUBJECT_TRANSITION_CONFLICT: 'Subject status was updated concurrently. Refresh and retry.',
  SUBJECT_ARCHIVED: 'Subject is archived and cannot be modified.',
  SUBJECT_HAS_DEPENDENT_CONTENT: 'Subject has dependent content and cannot be deleted.',
  SUBJECT_DIVISION_DISABLED: 'Divisions are disabled for this workspace.',
  SUBJECT_MISSING_TRANSLATIONS: 'Subject is missing required translations.',
  SUBJECT_INVALID_DEFAULT_LANGUAGE: 'The specified default language is not valid.',
  VALIDATION_ERROR: 'Invalid request data.',
}

// ---------------------------------------------------------------------------
// Error Class
// ---------------------------------------------------------------------------

export class SubjectsError extends Error {
  public readonly code: SubjectsErrorCode
  public readonly httpStatus: number

  constructor(
    code: SubjectsErrorCode,
    message: string = SUBJECTS_ERROR_MESSAGES[code],
    httpStatus: number = SUBJECTS_ERROR_HTTP_STATUS[code]
  ) {
    super(message)
    this.name = 'SubjectsError'
    this.code = code
    this.httpStatus = httpStatus
  }
}
