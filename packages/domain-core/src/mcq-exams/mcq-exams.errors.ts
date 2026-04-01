/**
 * MCQ Exams — Error Definitions
 *
 * File: packages/domain-core/src/mcq-exams/mcq-exams.errors.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 *
 * Domain error codes, HTTP status mapping, and McqExamError class.
 */

// ── Error Codes ──────────────────────────────────────────────────────────────

export type McqExamErrorCode =
  | 'MCQ_EXAM_NOT_FOUND'
  | 'MCQ_EXAM_CODE_EXISTS'
  | 'MCQ_EXAM_SUBJECT_IMMUTABLE'
  | 'MCQ_EXAM_SELECTION_LOCKED'
  | 'MCQ_EXAM_DELETION_BLOCKED'
  | 'MCQ_EXAM_INVALID_PASS_VALUE'
  | 'MCQ_EXAM_NO_DELIVERY_MODE'
  | 'MCQ_EXAM_CHRONO_NO_DURATION'
  | 'MCQ_EXAM_MANUAL_COUNT_MISMATCH'
  | 'MCQ_EXAM_AUTO_SUM_INVALID'
  | 'MCQ_EXAM_QUESTION_SUBJECT_MISMATCH'
  | 'MCQ_EXAM_QUESTION_DIVISION_MISMATCH'
  | 'MCQ_EXAM_QUESTION_NOT_ENABLED'
  | 'MCQ_EXAM_QUESTION_DUPLICATE'
  | 'MCQ_EXAM_SETTINGS_NOT_FOUND'
  | 'MCQ_EXAM_ENABLE_VALIDATION'
  | 'MCQ_EXAM_STATUS_LOCKED'

// ── HTTP Status Mapping ──────────────────────────────────────────────────────

export const MCQ_EXAM_ERROR_HTTP_STATUS: Record<McqExamErrorCode, number> = {
  MCQ_EXAM_NOT_FOUND: 404,
  MCQ_EXAM_CODE_EXISTS: 409,
  MCQ_EXAM_SUBJECT_IMMUTABLE: 400,
  MCQ_EXAM_SELECTION_LOCKED: 400,
  MCQ_EXAM_DELETION_BLOCKED: 409,
  MCQ_EXAM_INVALID_PASS_VALUE: 400,
  MCQ_EXAM_NO_DELIVERY_MODE: 400,
  MCQ_EXAM_CHRONO_NO_DURATION: 400,
  MCQ_EXAM_MANUAL_COUNT_MISMATCH: 400,
  MCQ_EXAM_AUTO_SUM_INVALID: 400,
  MCQ_EXAM_QUESTION_SUBJECT_MISMATCH: 400,
  MCQ_EXAM_QUESTION_DIVISION_MISMATCH: 400,
  MCQ_EXAM_QUESTION_NOT_ENABLED: 400,
  MCQ_EXAM_QUESTION_DUPLICATE: 409,
  MCQ_EXAM_SETTINGS_NOT_FOUND: 404,
  MCQ_EXAM_ENABLE_VALIDATION: 400,
  MCQ_EXAM_STATUS_LOCKED: 400,
}

// ── Error Messages ───────────────────────────────────────────────────────────

export const MCQ_EXAM_ERROR_MESSAGES: Record<McqExamErrorCode, string> = {
  MCQ_EXAM_NOT_FOUND: 'MCQ exam not found',
  MCQ_EXAM_CODE_EXISTS: 'An exam with this code already exists',
  MCQ_EXAM_SUBJECT_IMMUTABLE: 'Subject cannot be changed after exam creation',
  MCQ_EXAM_SELECTION_LOCKED:
    'Selection mode cannot be changed after the exam is enabled or has attempts',
  MCQ_EXAM_DELETION_BLOCKED: 'Exam cannot be deleted because it has active dependencies',
  MCQ_EXAM_INVALID_PASS_VALUE: 'Pass value is out of the allowed range',
  MCQ_EXAM_NO_DELIVERY_MODE: 'At least one delivery mode must be enabled',
  MCQ_EXAM_CHRONO_NO_DURATION: 'Duration is required when chrono mode is enabled',
  MCQ_EXAM_MANUAL_COUNT_MISMATCH: 'Number of linked questions does not match total_questions',
  MCQ_EXAM_AUTO_SUM_INVALID: 'Auto criteria percentages must sum to 100',
  MCQ_EXAM_QUESTION_SUBJECT_MISMATCH: 'Question does not belong to the exam subject',
  MCQ_EXAM_QUESTION_DIVISION_MISMATCH: 'Question does not belong to the exam division',
  MCQ_EXAM_QUESTION_NOT_ENABLED: 'Only enabled questions can be linked to an exam',
  MCQ_EXAM_QUESTION_DUPLICATE: 'Question is already linked to this exam',
  MCQ_EXAM_SETTINGS_NOT_FOUND: 'Exam settings not found — create settings first',
  MCQ_EXAM_ENABLE_VALIDATION: 'Exam does not meet all requirements to be enabled',
  MCQ_EXAM_STATUS_LOCKED: 'Cannot delete an enabled exam',
}

// ── Error Class ──────────────────────────────────────────────────────────────

export class McqExamError extends Error {
  public readonly code: McqExamErrorCode

  constructor(code: McqExamErrorCode, message?: string) {
    super(message ?? MCQ_EXAM_ERROR_MESSAGES[code])
    this.code = code
    this.name = 'McqExamError'
  }
}
