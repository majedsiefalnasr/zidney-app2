/**
 * Baskets — Error Definitions
 *
 * File: packages/domain-core/src/baskets/baskets.errors.ts
 * Stage: STAGE_33_MCQ_BASKETS
 *
 * Domain-specific error class, HTTP status mapping, and error messages.
 * No imports from apps/* — pure domain errors only.
 */

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

export type BasketErrorCode =
  | 'FORBIDDEN'
  | 'BASKET_NOT_FOUND'
  | 'BASKET_CODE_DUPLICATE'
  | 'BASKET_QUESTION_DUPLICATE'
  | 'BASKET_QUESTION_NOT_FOUND'
  | 'BASKET_MAX_QUESTIONS_REACHED'
  | 'BASKET_EMPTY_CANNOT_ENABLE'
  | 'BASKET_EXCEEDS_MAX_QUESTIONS'
  | 'BASKET_REFERENCED_IN_EXAM_CONFIG'
  | 'BASKET_REFERENCED_IN_AUTO_SELECTION'
  | 'QUESTION_NOT_FOUND'
  | 'INVALID_STATE_TRANSITION'
  | 'VALIDATION_ERROR'

// ---------------------------------------------------------------------------
// HTTP Status Map
// ---------------------------------------------------------------------------

export const BASKET_ERROR_HTTP_STATUS: Record<BasketErrorCode, number> = {
  FORBIDDEN: 403,
  BASKET_NOT_FOUND: 404,
  QUESTION_NOT_FOUND: 404,
  BASKET_QUESTION_NOT_FOUND: 404,
  BASKET_CODE_DUPLICATE: 409,
  BASKET_QUESTION_DUPLICATE: 409,
  INVALID_STATE_TRANSITION: 400,
  BASKET_MAX_QUESTIONS_REACHED: 422,
  BASKET_EMPTY_CANNOT_ENABLE: 422,
  BASKET_EXCEEDS_MAX_QUESTIONS: 422,
  BASKET_REFERENCED_IN_EXAM_CONFIG: 422,
  BASKET_REFERENCED_IN_AUTO_SELECTION: 422,
  VALIDATION_ERROR: 422,
}

// ---------------------------------------------------------------------------
// Error Messages
// ---------------------------------------------------------------------------

export const BASKET_ERROR_MESSAGES: Record<BasketErrorCode, string> = {
  FORBIDDEN: 'You do not have permission to perform this action.',
  BASKET_NOT_FOUND: 'Basket not found.',
  BASKET_CODE_DUPLICATE: 'A basket with this code already exists in this workspace.',
  BASKET_QUESTION_DUPLICATE: 'This question is already linked to the basket.',
  BASKET_QUESTION_NOT_FOUND: 'This question is not linked to the basket.',
  BASKET_MAX_QUESTIONS_REACHED:
    'Adding this question would exceed the basket maximum question limit.',
  BASKET_EMPTY_CANNOT_ENABLE: 'Basket cannot be enabled when it contains no questions.',
  BASKET_EXCEEDS_MAX_QUESTIONS:
    'Basket cannot be enabled because it exceeds the maximum question count.',
  BASKET_REFERENCED_IN_EXAM_CONFIG:
    'Basket cannot be deleted because it is referenced in an exam configuration.',
  BASKET_REFERENCED_IN_AUTO_SELECTION:
    'Basket cannot be deleted because it is referenced in an auto-selection rule.',
  QUESTION_NOT_FOUND: 'The specified question does not exist in this workspace.',
  INVALID_STATE_TRANSITION: 'The requested workflow transition is not valid.',
  VALIDATION_ERROR: 'Request validation failed.',
}

// ---------------------------------------------------------------------------
// Error Class
// ---------------------------------------------------------------------------

export class BasketError extends Error {
  readonly code: BasketErrorCode

  constructor(code: BasketErrorCode, message?: string) {
    super(message ?? BASKET_ERROR_MESSAGES[code])
    this.name = 'BasketError'
    this.code = code
  }
}
