/**
 * Traditional Questions — Error Definitions
 *
 * File: packages/domain-core/src/traditional-questions/traditional-questions.errors.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 *
 * Domain error codes, HTTP status mapping, and TraditionalQuestionError class.
 */

// ── Error Codes ──────────────────────────────────────────────────────────────

export type TraditionalQuestionErrorCode =
  // Prefixed codes (canonical registry)
  | 'TRAD_QUESTION_NOT_FOUND'
  | 'TRAD_QUESTION_DELETED'
  | 'TRAD_QUESTION_HAS_DEPENDENCIES'
  | 'TRAD_QUESTION_INVALID_TYPE'
  | 'TRAD_QUESTION_SUBJECT_NOT_FOUND'
  | 'TRAD_QUESTION_DIVISION_NOT_FOUND'
  | 'TRAD_QUESTION_LESSON_NOT_FOUND'
  | 'TRAD_QUESTION_CATEGORY_NOT_FOUND'
  | 'TRAD_QUESTION_TAG_NOT_FOUND'
  | 'TRAD_QUESTION_CATEGORY_ALREADY_LINKED'
  | 'TRAD_QUESTION_TAG_ALREADY_LINKED'
  | 'TRAD_QUESTION_CATEGORY_NOT_LINKED'
  | 'TRAD_QUESTION_TAG_NOT_LINKED'
  | 'TRAD_QUESTION_WORKFLOW_TRANSITION_FAILED'
  | 'TRAD_QUESTION_CONTENT_SANITIZATION_FAILED'
  | 'TRAD_QUESTION_SCORE_INVALID'
  | 'TRAD_QUESTION_UPDATE_CONFLICT'
  | 'TRAD_QUESTION_TYPE_IMMUTABLE'
  | 'TRAD_QUESTION_SUBJECT_IMMUTABLE'
  | 'TRAD_QUESTION_SUBSECTION_IMMUTABLE'
  | 'TRAD_QUESTION_CORRECT_ANSWER_REQUIRED'
  | 'TRAD_QUESTION_SUBSECTION_SUBJECT_MISMATCH'
  | 'TRAD_QUESTION_LESSON_SUBJECT_MISMATCH'
  | 'TRAD_QUESTION_DIVISION_SCOPE_VIOLATION'
  // Short-form codes used by the service layer
  | 'QUESTION_NOT_FOUND'
  | 'QUESTION_TYPE_IMMUTABLE'
  | 'SUBJECT_NOT_FOUND'
  | 'DIVISION_SCOPE_VIOLATION'
  | 'LESSON_SUBJECT_MISMATCH'
  | 'CONCURRENT_UPDATE_CONFLICT'
  | 'QUESTION_REFERENCED_IN_ACTIVE_ATTEMPT'
  | 'CATEGORY_VALUE_NOT_FOUND'
  | 'QUESTION_CATEGORY_ALREADY_LINKED'
  | 'QUESTION_CATEGORY_NOT_FOUND'
  | 'TAG_NOT_FOUND'
  | 'QUESTION_TAG_ALREADY_LINKED'
  | 'QUESTION_TAG_NOT_FOUND'

// ── HTTP Status Mapping ──────────────────────────────────────────────────────

export const TRAD_QUESTION_ERROR_HTTP_STATUS: Record<TraditionalQuestionErrorCode, number> = {
  // Prefixed codes
  TRAD_QUESTION_NOT_FOUND: 404,
  TRAD_QUESTION_DELETED: 404,
  TRAD_QUESTION_HAS_DEPENDENCIES: 409,
  TRAD_QUESTION_INVALID_TYPE: 422,
  TRAD_QUESTION_SUBJECT_NOT_FOUND: 404,
  TRAD_QUESTION_DIVISION_NOT_FOUND: 404,
  TRAD_QUESTION_LESSON_NOT_FOUND: 404,
  TRAD_QUESTION_CATEGORY_NOT_FOUND: 422,
  TRAD_QUESTION_TAG_NOT_FOUND: 422,
  TRAD_QUESTION_CATEGORY_ALREADY_LINKED: 409,
  TRAD_QUESTION_TAG_ALREADY_LINKED: 409,
  TRAD_QUESTION_CATEGORY_NOT_LINKED: 404,
  TRAD_QUESTION_TAG_NOT_LINKED: 404,
  TRAD_QUESTION_WORKFLOW_TRANSITION_FAILED: 422,
  TRAD_QUESTION_CONTENT_SANITIZATION_FAILED: 422,
  TRAD_QUESTION_SCORE_INVALID: 400,
  TRAD_QUESTION_UPDATE_CONFLICT: 409,
  TRAD_QUESTION_TYPE_IMMUTABLE: 400,
  TRAD_QUESTION_SUBJECT_IMMUTABLE: 400,
  TRAD_QUESTION_SUBSECTION_IMMUTABLE: 400,
  TRAD_QUESTION_CORRECT_ANSWER_REQUIRED: 422,
  TRAD_QUESTION_SUBSECTION_SUBJECT_MISMATCH: 422,
  TRAD_QUESTION_LESSON_SUBJECT_MISMATCH: 422,
  TRAD_QUESTION_DIVISION_SCOPE_VIOLATION: 422,
  // Short-form codes
  QUESTION_NOT_FOUND: 404,
  QUESTION_TYPE_IMMUTABLE: 422,
  SUBJECT_NOT_FOUND: 404,
  DIVISION_SCOPE_VIOLATION: 422,
  LESSON_SUBJECT_MISMATCH: 422,
  CONCURRENT_UPDATE_CONFLICT: 409,
  QUESTION_REFERENCED_IN_ACTIVE_ATTEMPT: 409,
  CATEGORY_VALUE_NOT_FOUND: 422,
  QUESTION_CATEGORY_ALREADY_LINKED: 409,
  QUESTION_CATEGORY_NOT_FOUND: 422,
  TAG_NOT_FOUND: 422,
  QUESTION_TAG_ALREADY_LINKED: 409,
  QUESTION_TAG_NOT_FOUND: 422,
}

// ── Error Messages ───────────────────────────────────────────────────────────

export const TRAD_QUESTION_ERROR_MESSAGES: Record<TraditionalQuestionErrorCode, string> = {
  // Prefixed codes
  TRAD_QUESTION_NOT_FOUND: 'Traditional question not found',
  TRAD_QUESTION_DELETED: 'Traditional question has been deleted',
  TRAD_QUESTION_HAS_DEPENDENCIES:
    'Traditional question cannot be deleted because it has dependencies',
  TRAD_QUESTION_INVALID_TYPE: 'Invalid question type',
  TRAD_QUESTION_SUBJECT_NOT_FOUND: 'Referenced subject does not exist',
  TRAD_QUESTION_DIVISION_NOT_FOUND: 'Referenced division does not exist',
  TRAD_QUESTION_LESSON_NOT_FOUND: 'Referenced lesson does not exist',
  TRAD_QUESTION_CATEGORY_NOT_FOUND: 'Referenced category value does not exist',
  TRAD_QUESTION_TAG_NOT_FOUND: 'Referenced tag does not exist',
  TRAD_QUESTION_CATEGORY_ALREADY_LINKED: 'Category value is already linked to this question',
  TRAD_QUESTION_TAG_ALREADY_LINKED: 'Tag is already linked to this question',
  TRAD_QUESTION_CATEGORY_NOT_LINKED: 'Category value is not linked to this question',
  TRAD_QUESTION_TAG_NOT_LINKED: 'Tag is not linked to this question',
  TRAD_QUESTION_WORKFLOW_TRANSITION_FAILED: 'Workflow status transition is not allowed',
  TRAD_QUESTION_CONTENT_SANITIZATION_FAILED: 'Content sanitization failed',
  TRAD_QUESTION_SCORE_INVALID: 'Score must be greater than 0',
  TRAD_QUESTION_UPDATE_CONFLICT: 'Question was modified by another request',
  TRAD_QUESTION_TYPE_IMMUTABLE: 'Question type cannot be changed after creation',
  TRAD_QUESTION_SUBJECT_IMMUTABLE: 'Subject cannot be changed after creation',
  TRAD_QUESTION_SUBSECTION_IMMUTABLE: 'Subsection cannot be changed after creation',
  TRAD_QUESTION_CORRECT_ANSWER_REQUIRED:
    'correct_answer is required for TRUE_FALSE and FILL_BLANK question types',
  TRAD_QUESTION_SUBSECTION_SUBJECT_MISMATCH: 'Subsection does not belong to the specified subject',
  TRAD_QUESTION_LESSON_SUBJECT_MISMATCH: 'Lesson does not belong to the specified subject',
  TRAD_QUESTION_DIVISION_SCOPE_VIOLATION: 'Referenced division does not exist or is out of scope',
  // Short-form codes
  QUESTION_NOT_FOUND: 'Traditional question not found',
  QUESTION_TYPE_IMMUTABLE: 'Question type cannot be changed after creation',
  SUBJECT_NOT_FOUND: 'Referenced subject does not exist',
  DIVISION_SCOPE_VIOLATION: 'Referenced division does not exist or is out of scope',
  LESSON_SUBJECT_MISMATCH: 'Lesson does not belong to the specified subject',
  CONCURRENT_UPDATE_CONFLICT: 'Question was modified by another request',
  QUESTION_REFERENCED_IN_ACTIVE_ATTEMPT:
    'Question is referenced in an active attempt and cannot be deleted',
  CATEGORY_VALUE_NOT_FOUND: 'Referenced category value does not exist',
  QUESTION_CATEGORY_ALREADY_LINKED: 'Category value is already linked to this question',
  QUESTION_CATEGORY_NOT_FOUND: 'Category value is not linked to this question',
  TAG_NOT_FOUND: 'Referenced tag does not exist',
  QUESTION_TAG_ALREADY_LINKED: 'Tag is already linked to this question',
  QUESTION_TAG_NOT_FOUND: 'Tag is not linked to this question',
}

// ── Error Class ──────────────────────────────────────────────────────────────

export class TraditionalQuestionError extends Error {
  public readonly code: TraditionalQuestionErrorCode

  constructor(code: TraditionalQuestionErrorCode, message?: string) {
    super(message ?? TRAD_QUESTION_ERROR_MESSAGES[code])
    this.code = code
    this.name = 'TraditionalQuestionError'
  }
}
