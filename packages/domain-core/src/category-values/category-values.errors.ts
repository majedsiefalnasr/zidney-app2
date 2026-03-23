/**
 * Category Values — Error Definitions
 *
 * File: packages/domain-core/src/category-values/category-values.errors.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 *
 * Domain-specific error class, HTTP status mapping, and error messages.
 * No imports from apps/* — pure domain errors only.
 */

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

export type CategoryValueErrorCode =
  | 'FORBIDDEN'
  | 'CATEGORY_VALUE_NOT_FOUND'
  | 'CATEGORY_VALUE_SUBJECT_NOT_FOUND'
  | 'CATEGORY_VALUE_DIVISION_NOT_FOUND'
  | 'CATEGORY_NOT_FOUND'
  | 'CATEGORY_VALUE_CODE_DUPLICATE'
  | 'CATEGORY_VALUE_LOCK_CONFLICT'
  | 'CATEGORY_VALUE_IN_USE'
  | 'CATEGORY_VALUE_CATEGORY_IMMUTABLE'
  | 'CATEGORY_VALUE_NAME_REQUIRED'
  | 'CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT'
  | 'CATEGORY_DISABLED'
  | 'INVALID_STATUS_TRANSITION'
  | 'UNSUPPORTED_LANGUAGE'
  | 'VALIDATION_ERROR'

// ---------------------------------------------------------------------------
// HTTP Status Map
// ---------------------------------------------------------------------------

export const CATEGORY_VALUE_ERROR_HTTP_STATUS: Record<CategoryValueErrorCode, number> = {
  FORBIDDEN: 403,
  CATEGORY_VALUE_NOT_FOUND: 404,
  CATEGORY_VALUE_SUBJECT_NOT_FOUND: 404,
  CATEGORY_VALUE_DIVISION_NOT_FOUND: 404,
  CATEGORY_NOT_FOUND: 404,
  CATEGORY_VALUE_CODE_DUPLICATE: 409,
  CATEGORY_VALUE_LOCK_CONFLICT: 409,
  CATEGORY_VALUE_IN_USE: 422,
  CATEGORY_VALUE_CATEGORY_IMMUTABLE: 422,
  CATEGORY_VALUE_NAME_REQUIRED: 422,
  CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT: 422,
  CATEGORY_DISABLED: 422,
  INVALID_STATUS_TRANSITION: 422,
  UNSUPPORTED_LANGUAGE: 422,
  VALIDATION_ERROR: 422,
}

// ---------------------------------------------------------------------------
// Error Messages
// ---------------------------------------------------------------------------

export const CATEGORY_VALUE_ERROR_MESSAGES: Record<CategoryValueErrorCode, string> = {
  FORBIDDEN: 'You do not have permission to perform this action.',
  CATEGORY_VALUE_NOT_FOUND: 'Category value not found.',
  CATEGORY_VALUE_SUBJECT_NOT_FOUND: 'One or more subject IDs do not exist.',
  CATEGORY_VALUE_DIVISION_NOT_FOUND: 'One or more division IDs do not exist.',
  CATEGORY_NOT_FOUND: 'Parent category not found.',
  CATEGORY_VALUE_CODE_DUPLICATE: 'A category value with this code already exists in this category.',
  CATEGORY_VALUE_LOCK_CONFLICT:
    'The category value is currently being modified by another request. Please retry.',
  CATEGORY_VALUE_IN_USE: 'Category value cannot be deleted because it is in use.',
  CATEGORY_VALUE_CATEGORY_IMMUTABLE: 'The category_id of a value cannot be changed after creation.',
  CATEGORY_VALUE_NAME_REQUIRED: 'A name translation for the default language is required.',
  CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT:
    'The value scope must be a subset of the parent category scope.',
  CATEGORY_DISABLED: 'Cannot create or modify values for a disabled category.',
  INVALID_STATUS_TRANSITION: 'Invalid status transition.',
  UNSUPPORTED_LANGUAGE: 'The specified language code is not supported by this workspace.',
  VALIDATION_ERROR: 'Request validation failed.',
}

// ---------------------------------------------------------------------------
// Error Class
// ---------------------------------------------------------------------------

export class CategoryValueError extends Error {
  readonly code: CategoryValueErrorCode

  constructor(code: CategoryValueErrorCode, message?: string) {
    super(message ?? CATEGORY_VALUE_ERROR_MESSAGES[code])
    this.name = 'CategoryValueError'
    this.code = code
  }
}
