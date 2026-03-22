/**
 * Categories — Error Definitions
 *
 * File: packages/domain-core/src/categories/categories.errors.ts
 * Stage: STAGE_30_CATEGORIES
 *
 * Error code union, HTTP status mapping, human-readable messages,
 * and the CategoryError class used by the service layer.
 *
 * NOTE-6 from Analyze: CATEGORY_LOCK_CONFLICT is added here to map
 * PostgreSQL error 55P03 (FOR UPDATE NOWAIT lock contention) → 409.
 */

// ---------------------------------------------------------------------------
// Error Code Union
// ---------------------------------------------------------------------------

export type CategoryErrorCode =
  | 'CATEGORY_NOT_FOUND'
  | 'CATEGORY_PARENT_NOT_FOUND'
  | 'CATEGORY_NAME_DUPLICATE'
  | 'CATEGORY_CODE_DUPLICATE'
  | 'CATEGORY_CIRCULAR_REFERENCE'
  | 'CATEGORY_MAX_DEPTH_EXCEEDED'
  | 'CATEGORY_DISABLED'
  | 'CATEGORY_ALREADY_DISABLED'
  | 'CATEGORY_ALREADY_ENABLED'
  | 'CATEGORY_HAS_ENABLED_CHILDREN'
  | 'CATEGORY_HAS_DEPENDENT_CONTENT'
  | 'CATEGORY_SUBJECT_NOT_FOUND'
  | 'CATEGORY_DIVISION_NOT_FOUND'
  | 'CATEGORY_LOCK_CONFLICT'
  | 'VALIDATION_ERROR'

// ---------------------------------------------------------------------------
// HTTP Status Map
// ---------------------------------------------------------------------------

export const CATEGORY_ERROR_HTTP_STATUS: Record<CategoryErrorCode, number> = {
  CATEGORY_NOT_FOUND: 404,
  CATEGORY_PARENT_NOT_FOUND: 404,
  CATEGORY_SUBJECT_NOT_FOUND: 404,
  CATEGORY_DIVISION_NOT_FOUND: 404,
  CATEGORY_NAME_DUPLICATE: 409,
  CATEGORY_CODE_DUPLICATE: 409,
  CATEGORY_HAS_DEPENDENT_CONTENT: 409,
  CATEGORY_LOCK_CONFLICT: 409,
  CATEGORY_CIRCULAR_REFERENCE: 422,
  CATEGORY_MAX_DEPTH_EXCEEDED: 422,
  CATEGORY_DISABLED: 422,
  CATEGORY_ALREADY_DISABLED: 422,
  CATEGORY_ALREADY_ENABLED: 422,
  CATEGORY_HAS_ENABLED_CHILDREN: 422,
  VALIDATION_ERROR: 422,
}

// ---------------------------------------------------------------------------
// Error Messages
// ---------------------------------------------------------------------------

export const CATEGORY_ERROR_MESSAGES: Record<CategoryErrorCode, string> = {
  CATEGORY_NOT_FOUND: 'Category not found.',
  CATEGORY_PARENT_NOT_FOUND: 'Parent category not found.',
  CATEGORY_SUBJECT_NOT_FOUND: 'One or more specified subjects were not found.',
  CATEGORY_DIVISION_NOT_FOUND: 'One or more specified divisions were not found.',
  CATEGORY_NAME_DUPLICATE: 'A category with this name already exists.',
  CATEGORY_CODE_DUPLICATE: 'A category with this code already exists.',
  CATEGORY_HAS_DEPENDENT_CONTENT: 'Category has dependent content and cannot be deleted.',
  CATEGORY_LOCK_CONFLICT: 'Category is currently being modified by another request. Please retry.',
  CATEGORY_CIRCULAR_REFERENCE:
    'The specified parent would create a circular reference in the category hierarchy.',
  CATEGORY_MAX_DEPTH_EXCEEDED: 'Category hierarchy cannot exceed 3 levels.',
  CATEGORY_DISABLED: 'Category is disabled. Re-enable it before editing other fields.',
  CATEGORY_ALREADY_DISABLED: 'Category is already disabled.',
  CATEGORY_ALREADY_ENABLED: 'Category is already enabled.',
  CATEGORY_HAS_ENABLED_CHILDREN:
    'Category has enabled children. Disable all children before disabling this category.',
  VALIDATION_ERROR: 'Invalid request data.',
}

// ---------------------------------------------------------------------------
// CategoryError Class
// ---------------------------------------------------------------------------

export class CategoryError extends Error {
  constructor(
    public readonly code: CategoryErrorCode,
    message?: string
  ) {
    super(message ?? CATEGORY_ERROR_MESSAGES[code])
    this.name = 'CategoryError'
  }
}
