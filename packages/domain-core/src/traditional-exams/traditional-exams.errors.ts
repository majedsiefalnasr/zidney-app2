/**
 * Traditional Exams — Error Definitions
 *
 * File: packages/domain-core/src/traditional-exams/traditional-exams.errors.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

// ── Error Codes ──────────────────────────────────────────────────

export type TraditionalExamErrorCode =
  | 'TRAD_EXAM_NOT_FOUND'
  | 'TRAD_EXAM_CODE_EXISTS'
  | 'TRAD_EXAM_TEMPLATE_NOT_FOUND'
  | 'TRAD_EXAM_TEMPLATE_EMPTY'
  | 'TRAD_EXAM_SUBJECT_IMMUTABLE'
  | 'TRAD_EXAM_TEMPLATE_IMMUTABLE'
  | 'TRAD_EXAM_DELETION_BLOCKED'
  | 'TRAD_EXAM_STATUS_LOCKED'
  | 'TRAD_EXAM_INVALID_TRANSITION'
  | 'TRAD_EXAM_NO_DELIVERY_MODE'
  | 'TRAD_EXAM_CHRONO_NO_DURATION'
  | 'TRAD_EXAM_ENABLE_VALIDATION'
  | 'TRAD_EXAM_SECTION_NOT_FOUND'
  | 'TRAD_EXAM_SUBSECTION_NOT_FOUND'
  | 'TRAD_EXAM_QUESTION_SUBJECT_MISMATCH'
  | 'TRAD_EXAM_QUESTION_NOT_ENABLED'
  | 'TRAD_EXAM_QUESTION_DUPLICATE'
  | 'TRAD_EXAM_SETTINGS_NOT_FOUND'
  | 'TRAD_EXAM_RETURN_REASON_REQUIRED'

// ── HTTP Status Map ──────────────────────────────────────────────

export const TRADITIONAL_EXAM_ERROR_HTTP_STATUS: Record<TraditionalExamErrorCode, number> = {
  TRAD_EXAM_NOT_FOUND: 404,
  TRAD_EXAM_CODE_EXISTS: 409,
  TRAD_EXAM_TEMPLATE_NOT_FOUND: 404,
  TRAD_EXAM_TEMPLATE_EMPTY: 422,
  TRAD_EXAM_SUBJECT_IMMUTABLE: 400,
  TRAD_EXAM_TEMPLATE_IMMUTABLE: 400,
  TRAD_EXAM_DELETION_BLOCKED: 409,
  TRAD_EXAM_STATUS_LOCKED: 400,
  TRAD_EXAM_INVALID_TRANSITION: 400,
  TRAD_EXAM_NO_DELIVERY_MODE: 400,
  TRAD_EXAM_CHRONO_NO_DURATION: 400,
  TRAD_EXAM_ENABLE_VALIDATION: 400,
  TRAD_EXAM_SECTION_NOT_FOUND: 404,
  TRAD_EXAM_SUBSECTION_NOT_FOUND: 404,
  TRAD_EXAM_QUESTION_SUBJECT_MISMATCH: 400,
  TRAD_EXAM_QUESTION_NOT_ENABLED: 400,
  TRAD_EXAM_QUESTION_DUPLICATE: 409,
  TRAD_EXAM_SETTINGS_NOT_FOUND: 404,
  TRAD_EXAM_RETURN_REASON_REQUIRED: 400,
}

// ── Error Messages ───────────────────────────────────────────────

export const TRADITIONAL_EXAM_ERROR_MESSAGES: Record<TraditionalExamErrorCode, string> = {
  TRAD_EXAM_NOT_FOUND: 'Traditional exam not found',
  TRAD_EXAM_CODE_EXISTS: 'An exam with this code already exists',
  TRAD_EXAM_TEMPLATE_NOT_FOUND: 'Template not found',
  TRAD_EXAM_TEMPLATE_EMPTY: 'Template has no sections',
  TRAD_EXAM_SUBJECT_IMMUTABLE: 'Cannot change subject after questions have been assigned',
  TRAD_EXAM_TEMPLATE_IMMUTABLE: 'Cannot change template after creation',
  TRAD_EXAM_DELETION_BLOCKED: 'Exam cannot be deleted due to external references',
  TRAD_EXAM_STATUS_LOCKED: 'Operation not allowed in the current status',
  TRAD_EXAM_INVALID_TRANSITION: 'Invalid status transition',
  TRAD_EXAM_NO_DELIVERY_MODE: 'At least one delivery mode (relax or chrono) is required',
  TRAD_EXAM_CHRONO_NO_DURATION: 'Chrono mode requires a duration greater than 0',
  TRAD_EXAM_ENABLE_VALIDATION: 'Exam failed structural validation and cannot be enabled',
  TRAD_EXAM_SECTION_NOT_FOUND: 'Section not found',
  TRAD_EXAM_SUBSECTION_NOT_FOUND: 'Subsection not found',
  TRAD_EXAM_QUESTION_SUBJECT_MISMATCH: 'Question subject does not match exam subject',
  TRAD_EXAM_QUESTION_NOT_ENABLED: 'Only enabled questions can be assigned',
  TRAD_EXAM_QUESTION_DUPLICATE: 'Question is already assigned to this subsection',
  TRAD_EXAM_SETTINGS_NOT_FOUND: 'Settings have not been configured for this exam',
  TRAD_EXAM_RETURN_REASON_REQUIRED: 'A reason is required when returning to a previous status',
}

// ── Error Class ──────────────────────────────────────────────────

export class TraditionalExamError extends Error {
  public readonly code: TraditionalExamErrorCode
  public readonly details?: unknown

  constructor(code: TraditionalExamErrorCode, details?: unknown) {
    super(TRADITIONAL_EXAM_ERROR_MESSAGES[code])
    this.name = 'TraditionalExamError'
    this.code = code
    this.details = details
  }
}
