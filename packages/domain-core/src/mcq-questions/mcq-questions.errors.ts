/**
 * MCQ Questions — Error Definitions
 *
 * File: packages/domain-core/src/mcq-questions/mcq-questions.errors.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 *
 * Domain error codes, HTTP status mapping, and McqQuestionError class.
 */

// ── Error Codes ──────────────────────────────────────────────────────────────

export type McqQuestionErrorCode =
  // Prefixed codes (canonical registry)
  | 'MCQ_QUESTION_NOT_FOUND'
  | 'MCQ_QUESTION_DELETED'
  | 'MCQ_QUESTION_HAS_DEPENDENCIES'
  | 'MCQ_QUESTION_INVALID_TYPE'
  | 'MCQ_QUESTION_INVALID_OPTIONS'
  | 'MCQ_QUESTION_DUPLICATE_ORDER_INDEX'
  | 'MCQ_QUESTION_SUBJECT_NOT_FOUND'
  | 'MCQ_QUESTION_DIVISION_NOT_FOUND'
  | 'MCQ_QUESTION_LESSON_NOT_FOUND'
  | 'MCQ_QUESTION_CATEGORY_NOT_FOUND'
  | 'MCQ_QUESTION_TAG_NOT_FOUND'
  | 'MCQ_QUESTION_BASKET_NOT_FOUND'
  | 'MCQ_QUESTION_CATEGORY_ALREADY_LINKED'
  | 'MCQ_QUESTION_TAG_ALREADY_LINKED'
  | 'MCQ_QUESTION_BASKET_ALREADY_LINKED'
  | 'MCQ_QUESTION_CATEGORY_NOT_LINKED'
  | 'MCQ_QUESTION_TAG_NOT_LINKED'
  | 'MCQ_QUESTION_BASKET_NOT_LINKED'
  | 'MCQ_QUESTION_WORKFLOW_TRANSITION_FAILED'
  | 'MCQ_QUESTION_CONTENT_SANITIZATION_FAILED'
  | 'MCQ_QUESTION_UPDATE_CONFLICT'
  // Short-form codes used by the service layer
  | 'QUESTION_NOT_FOUND'
  | 'QUESTION_TYPE_IMMUTABLE'
  | 'SUBJECT_NOT_FOUND'
  | 'DIVISION_SCOPE_VIOLATION'
  | 'LESSON_SUBJECT_MISMATCH'
  | 'INVALID_OPTION_CONFIGURATION'
  | 'CONCURRENT_UPDATE_CONFLICT'
  | 'QUESTION_REFERENCED_IN_ACTIVE_ATTEMPT'
  | 'QUESTION_HAS_NO_OPTIONS'
  | 'CATEGORY_VALUE_NOT_FOUND'
  | 'QUESTION_CATEGORY_ALREADY_LINKED'
  | 'QUESTION_CATEGORY_NOT_FOUND'
  | 'TAG_NOT_FOUND'
  | 'QUESTION_TAG_ALREADY_LINKED'
  | 'QUESTION_TAG_NOT_FOUND'
  | 'BASKET_NOT_FOUND'
  | 'BASKET_MAX_QUESTIONS_REACHED'
  | 'QUESTION_BASKET_ALREADY_LINKED'
  | 'QUESTION_BASKET_NOT_FOUND'

// ── HTTP Status Mapping ──────────────────────────────────────────────────────

export const MCQ_QUESTION_ERROR_HTTP_STATUS: Record<McqQuestionErrorCode, number> = {
  // Prefixed codes
  MCQ_QUESTION_NOT_FOUND: 404,
  MCQ_QUESTION_DELETED: 404,
  MCQ_QUESTION_HAS_DEPENDENCIES: 409,
  MCQ_QUESTION_INVALID_TYPE: 422,
  MCQ_QUESTION_INVALID_OPTIONS: 422,
  MCQ_QUESTION_DUPLICATE_ORDER_INDEX: 422,
  MCQ_QUESTION_SUBJECT_NOT_FOUND: 404,
  MCQ_QUESTION_DIVISION_NOT_FOUND: 404,
  MCQ_QUESTION_LESSON_NOT_FOUND: 404,
  MCQ_QUESTION_CATEGORY_NOT_FOUND: 422,
  MCQ_QUESTION_TAG_NOT_FOUND: 422,
  MCQ_QUESTION_BASKET_NOT_FOUND: 422,
  MCQ_QUESTION_CATEGORY_ALREADY_LINKED: 409,
  MCQ_QUESTION_TAG_ALREADY_LINKED: 409,
  MCQ_QUESTION_BASKET_ALREADY_LINKED: 409,
  MCQ_QUESTION_CATEGORY_NOT_LINKED: 404,
  MCQ_QUESTION_TAG_NOT_LINKED: 404,
  MCQ_QUESTION_BASKET_NOT_LINKED: 404,
  MCQ_QUESTION_WORKFLOW_TRANSITION_FAILED: 422,
  MCQ_QUESTION_CONTENT_SANITIZATION_FAILED: 422,
  MCQ_QUESTION_UPDATE_CONFLICT: 409,
  // Short-form codes
  QUESTION_NOT_FOUND: 404,
  QUESTION_TYPE_IMMUTABLE: 422,
  SUBJECT_NOT_FOUND: 404,
  DIVISION_SCOPE_VIOLATION: 422,
  LESSON_SUBJECT_MISMATCH: 422,
  INVALID_OPTION_CONFIGURATION: 422,
  CONCURRENT_UPDATE_CONFLICT: 409,
  QUESTION_REFERENCED_IN_ACTIVE_ATTEMPT: 409,
  QUESTION_HAS_NO_OPTIONS: 422,
  CATEGORY_VALUE_NOT_FOUND: 422,
  QUESTION_CATEGORY_ALREADY_LINKED: 409,
  QUESTION_CATEGORY_NOT_FOUND: 422,
  TAG_NOT_FOUND: 422,
  QUESTION_TAG_ALREADY_LINKED: 409,
  QUESTION_TAG_NOT_FOUND: 422,
  BASKET_NOT_FOUND: 422,
  BASKET_MAX_QUESTIONS_REACHED: 422,
  QUESTION_BASKET_ALREADY_LINKED: 409,
  QUESTION_BASKET_NOT_FOUND: 404,
}

// ── Error Messages ───────────────────────────────────────────────────────────

export const MCQ_QUESTION_ERROR_MESSAGES: Record<McqQuestionErrorCode, string> = {
  // Prefixed codes
  MCQ_QUESTION_NOT_FOUND: 'MCQ question not found',
  MCQ_QUESTION_DELETED: 'MCQ question has been deleted',
  MCQ_QUESTION_HAS_DEPENDENCIES:
    'MCQ question cannot be deleted because it has linked baskets or other dependencies',
  MCQ_QUESTION_INVALID_TYPE: 'Invalid question type',
  MCQ_QUESTION_INVALID_OPTIONS: 'Options do not satisfy the validation rules for the question type',
  MCQ_QUESTION_DUPLICATE_ORDER_INDEX: 'Duplicate order_index values in options',
  MCQ_QUESTION_SUBJECT_NOT_FOUND: 'Referenced subject does not exist',
  MCQ_QUESTION_DIVISION_NOT_FOUND: 'Referenced division does not exist',
  MCQ_QUESTION_LESSON_NOT_FOUND: 'Referenced lesson does not exist',
  MCQ_QUESTION_CATEGORY_NOT_FOUND: 'Referenced category value does not exist',
  MCQ_QUESTION_TAG_NOT_FOUND: 'Referenced tag does not exist',
  MCQ_QUESTION_BASKET_NOT_FOUND: 'Referenced basket does not exist',
  MCQ_QUESTION_CATEGORY_ALREADY_LINKED: 'Category value is already linked to this question',
  MCQ_QUESTION_TAG_ALREADY_LINKED: 'Tag is already linked to this question',
  MCQ_QUESTION_BASKET_ALREADY_LINKED: 'Basket is already linked to this question',
  MCQ_QUESTION_CATEGORY_NOT_LINKED: 'Category value is not linked to this question',
  MCQ_QUESTION_TAG_NOT_LINKED: 'Tag is not linked to this question',
  MCQ_QUESTION_BASKET_NOT_LINKED: 'Basket is not linked to this question',
  MCQ_QUESTION_WORKFLOW_TRANSITION_FAILED: 'Workflow status transition is not allowed',
  MCQ_QUESTION_CONTENT_SANITIZATION_FAILED: 'Content sanitization failed',
  MCQ_QUESTION_UPDATE_CONFLICT: 'Question was modified by another request',
  // Short-form codes
  QUESTION_NOT_FOUND: 'MCQ question not found',
  QUESTION_TYPE_IMMUTABLE: 'Question type cannot be changed after creation',
  SUBJECT_NOT_FOUND: 'Referenced subject does not exist',
  DIVISION_SCOPE_VIOLATION: 'Referenced division does not exist or is out of scope',
  LESSON_SUBJECT_MISMATCH: 'Referenced lesson does not belong to the specified subject',
  INVALID_OPTION_CONFIGURATION: 'Options do not satisfy the validation rules for the question type',
  CONCURRENT_UPDATE_CONFLICT: 'Question was modified by another request',
  QUESTION_REFERENCED_IN_ACTIVE_ATTEMPT:
    'Question is referenced in an active attempt and cannot be deleted',
  QUESTION_HAS_NO_OPTIONS: 'Question must have at least one option before transitioning',
  CATEGORY_VALUE_NOT_FOUND: 'Referenced category value does not exist',
  QUESTION_CATEGORY_ALREADY_LINKED: 'Category value is already linked to this question',
  QUESTION_CATEGORY_NOT_FOUND: 'Category value is not linked to this question',
  TAG_NOT_FOUND: 'Referenced tag does not exist',
  QUESTION_TAG_ALREADY_LINKED: 'Tag is already linked to this question',
  QUESTION_TAG_NOT_FOUND: 'Tag is not linked to this question',
  BASKET_NOT_FOUND: 'Referenced basket does not exist',
  BASKET_MAX_QUESTIONS_REACHED: 'Basket has reached its maximum question limit',
  QUESTION_BASKET_ALREADY_LINKED: 'Basket is already linked to this question',
  QUESTION_BASKET_NOT_FOUND: 'Basket is not linked to this question',
}

// ── Error Class ──────────────────────────────────────────────────────────────

export class McqQuestionError extends Error {
  public readonly code: McqQuestionErrorCode

  constructor(code: McqQuestionErrorCode, message?: string) {
    super(message ?? MCQ_QUESTION_ERROR_MESSAGES[code])
    this.code = code
    this.name = 'McqQuestionError'
  }
}
