/**
 * Error Codes Constants
 *
 * Centralized error code registry for Products Management (STAGE_09_PRODUCTS)
 * Maps error codes to HTTP status codes and human-readable messages
 *
 * Stage: STAGE_09_PRODUCTS
 * Reference: PLAN_REPORT.md Section 7: Error Code Mapping
 */

/**
 * Error code definitions
 */
export const ErrorCodes = {
  // Validation errors (400 Bad Request)
  INVALID_MODULE_ENUM: 'INVALID_MODULE_ENUM',
  INVALID_NAME_LOCALIZATION: 'INVALID_NAME_LOCALIZATION',
  SLUG_NOT_MUTABLE: 'SLUG_NOT_MUTABLE',

  // Conflict errors (409 Conflict)
  DUPLICATE_SLUG: 'DUPLICATE_SLUG',
  PRODUCT_HAS_LICENSES: 'PRODUCT_HAS_LICENSES',

  // Not found errors (404 Not Found)
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  LICENSE_NOT_FOUND: 'LICENSE_NOT_FOUND',

  // Authentication/Authorization (401/403)
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // License/Workspace status (423/403/404)
  WORKSPACE_LOCKED: 'WORKSPACE_LOCKED',
  WORKSPACE_ARCHIVED: 'WORKSPACE_ARCHIVED',

  // Version compatibility (426)
  VERSION_MISMATCH: 'VERSION_MISMATCH',

  // Server errors (500)
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const

/**
 * Error code to HTTP status mapping
 */
export const ErrorCodeToStatusMap: Record<string, number> = {
  [ErrorCodes.INVALID_MODULE_ENUM]: 400,
  [ErrorCodes.INVALID_NAME_LOCALIZATION]: 400,
  [ErrorCodes.SLUG_NOT_MUTABLE]: 400,
  [ErrorCodes.DUPLICATE_SLUG]: 409,
  [ErrorCodes.PRODUCT_HAS_LICENSES]: 409,
  [ErrorCodes.PRODUCT_NOT_FOUND]: 404,
  [ErrorCodes.LICENSE_NOT_FOUND]: 404,
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.WORKSPACE_LOCKED]: 423,
  [ErrorCodes.WORKSPACE_ARCHIVED]: 403,
  [ErrorCodes.VERSION_MISMATCH]: 426,
  [ErrorCodes.INTERNAL_SERVER_ERROR]: 500,
}

/**
 * Error code to human-readable message mapping
 */
export const ErrorCodeToMessageMap: Record<string, string> = {
  [ErrorCodes.INVALID_MODULE_ENUM]:
    'Invalid module. Allowed: MCQ, TRADITIONAL_EXAMS, EXERCISES, LIBRARY, LIVES, FORUM',
  [ErrorCodes.INVALID_NAME_LOCALIZATION]: 'Product name must include English translation',
  [ErrorCodes.SLUG_NOT_MUTABLE]: 'Slug cannot be changed after creation',
  [ErrorCodes.DUPLICATE_SLUG]: 'Product slug already exists',
  [ErrorCodes.PRODUCT_HAS_LICENSES]: 'Cannot delete product with active licenses',
  [ErrorCodes.PRODUCT_NOT_FOUND]: 'Product not found',
  [ErrorCodes.LICENSE_NOT_FOUND]: 'License not found',
  [ErrorCodes.UNAUTHORIZED]: 'Authentication required',
  [ErrorCodes.FORBIDDEN]: 'Access denied',
  [ErrorCodes.WORKSPACE_LOCKED]: 'Workspace is locked',
  [ErrorCodes.WORKSPACE_ARCHIVED]: 'Workspace is archived',
  [ErrorCodes.VERSION_MISMATCH]: 'Schema or product version incompatible',
  [ErrorCodes.INTERNAL_SERVER_ERROR]: 'Internal server error. Please try again.',
}

/**
 * Get HTTP status code for error code
 */
export function getHttpStatus(errorCode: string): number {
  return ErrorCodeToStatusMap[errorCode] || 500
}

/**
 * Get error message for error code
 */
export function getErrorMessage(errorCode: string): string {
  return ErrorCodeToMessageMap[errorCode] || 'Unknown error'
}

/**
 * Custom error class for typed errors
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message?: string,
    public details?: Record<string, unknown>
  ) {
    super(message || getErrorMessage(code))
    this.name = 'AppError'
    Object.setPrototypeOf(this, AppError.prototype)
  }
}

/**
 * Type for all valid error codes
 */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]
