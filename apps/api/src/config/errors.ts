/**
 * Error Code Registry - Standardized API error codes and HTTP status mappings.
 *
 * Provides centralized error code management for all API responses.
 * Each error code includes:
 * - HTTP status code
 * - Error message template
 * - Suggested client action
 *
 * Response format: { success: false, error: { code, message, request_id } }
 * Stack traces NEVER included in client response (only in internal logs).
 */

export const ErrorCodes = {
  // 400 - Bad Request Errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  MALFORMED_JSON: 'MALFORMED_JSON',

  // 401 - Authentication Errors
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // 403 - Permission/Authorization Errors
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ACCESS_DENIED: 'ACCESS_DENIED',

  // 423 - Workspace Locked (Custom)
  LICENSE_SOFT_LOCKED: 'LICENSE_SOFT_LOCKED',
  WORKSPACE_LOCKED: 'WORKSPACE_LOCKED',

  // 404 - Not Found Errors
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  ATTEMPT_NOT_FOUND: 'ATTEMPT_NOT_FOUND',
  EXAM_NOT_FOUND: 'EXAM_NOT_FOUND',

  // 409 - Conflict Errors
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',

  // 429 - Rate Limiting
  RATE_LIMITED: 'RATE_LIMITED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // 500 - Server Errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',

  // 503 - Service Unavailable
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
} as const

export type ErrorCodeKey = keyof typeof ErrorCodes
export type ErrorCodeValue = (typeof ErrorCodes)[ErrorCodeKey]

/**
 * HTTP status codes for each error code.
 * Maps ErrorCode → HTTP Status Code
 */
export const ErrorStatusMap: Record<ErrorCodeValue, number> = {
  // 400 - Bad Request
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.INVALID_REQUEST]: 400,
  [ErrorCodes.MALFORMED_JSON]: 400,

  // 401 - Unauthorized
  [ErrorCodes.AUTHENTICATION_FAILED]: 401,
  [ErrorCodes.AUTHENTICATION_REQUIRED]: 401,
  [ErrorCodes.INVALID_CREDENTIALS]: 401,

  // 403 - Forbidden
  [ErrorCodes.PERMISSION_DENIED]: 403,
  [ErrorCodes.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCodes.ACCESS_DENIED]: 403,

  // 423 - Locked (workspace locked/soft-locked)
  [ErrorCodes.LICENSE_SOFT_LOCKED]: 423,
  [ErrorCodes.WORKSPACE_LOCKED]: 423,

  // 404 - Not Found
  [ErrorCodes.WORKSPACE_NOT_FOUND]: 404,
  [ErrorCodes.RESOURCE_NOT_FOUND]: 404,
  [ErrorCodes.ATTEMPT_NOT_FOUND]: 404,
  [ErrorCodes.EXAM_NOT_FOUND]: 404,

  // 409 - Conflict
  [ErrorCodes.CONFLICT_ERROR]: 409,
  [ErrorCodes.VERSION_MISMATCH]: 409,
  [ErrorCodes.RESOURCE_ALREADY_EXISTS]: 409,

  // 429 - Too Many Requests
  [ErrorCodes.RATE_LIMITED]: 429,
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 429,

  // 500 - Internal Server Error
  [ErrorCodes.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCodes.UNEXPECTED_ERROR]: 500,

  // 503 - Service Unavailable
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
  [ErrorCodes.DATABASE_CONNECTION_ERROR]: 503,
}

/**
 * Error message templates.
 * Used as default messages if not overridden by handler.
 */
export const ErrorMessages: Record<ErrorCodeValue, string> = {
  // 400 - Bad Request
  [ErrorCodes.VALIDATION_ERROR]: 'Request validation failed',
  [ErrorCodes.INVALID_REQUEST]: 'The request is invalid or malformed',
  [ErrorCodes.MALFORMED_JSON]: 'Request body must be valid JSON',

  // 401 - Unauthorized
  [ErrorCodes.AUTHENTICATION_FAILED]: 'Authentication failed. Please check your credentials',
  [ErrorCodes.AUTHENTICATION_REQUIRED]: 'Authentication is required for this resource',
  [ErrorCodes.INVALID_CREDENTIALS]: 'Invalid username or password',

  // 403 - Forbidden
  [ErrorCodes.PERMISSION_DENIED]: 'You do not have permission to access this resource',
  [ErrorCodes.INSUFFICIENT_PERMISSIONS]: 'Your role lacks the required permissions',
  [ErrorCodes.ACCESS_DENIED]: 'Access denied',

  // 423 - Locked
  [ErrorCodes.LICENSE_SOFT_LOCKED]: 'Workspace is temporarily locked. Please contact support',
  [ErrorCodes.WORKSPACE_LOCKED]: 'Workspace is currently locked',

  // 404 - Not Found
  [ErrorCodes.WORKSPACE_NOT_FOUND]: 'Workspace not found',
  [ErrorCodes.RESOURCE_NOT_FOUND]: 'The requested resource was not found',
  [ErrorCodes.ATTEMPT_NOT_FOUND]: 'Attempt not found',
  [ErrorCodes.EXAM_NOT_FOUND]: 'Exam not found',

  // 409 - Conflict
  [ErrorCodes.CONFLICT_ERROR]: 'The request conflicts with the current state',
  [ErrorCodes.VERSION_MISMATCH]: 'Version mismatch. Please refresh and try again',
  [ErrorCodes.RESOURCE_ALREADY_EXISTS]: 'The resource already exists',

  // 429 - Too Many Requests
  [ErrorCodes.RATE_LIMITED]: 'Too many requests. Please try again later',
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',

  // 500 - Internal Server Error
  [ErrorCodes.INTERNAL_SERVER_ERROR]: 'An internal server error occurred. Please try again later',
  [ErrorCodes.UNEXPECTED_ERROR]: 'An unexpected error occurred',

  // 503 - Service Unavailable
  [ErrorCodes.SERVICE_UNAVAILABLE]: 'Service is currently unavailable. Please try again later',
  [ErrorCodes.DATABASE_CONNECTION_ERROR]: 'Database connection error. Please try again later',
}

/**
 * Create an API error response object.
 *
 * Used by error handler middleware to format error responses.
 *
 * @param code - Error code from ErrorCodes
 * @param message - Override message (optional, uses template if not provided)
 * @param context - Additional context data fields
 * @returns Error response object
 */
export function createError(
  code: ErrorCodeValue,
  message?: string,
  context?: Record<string, unknown>
) {
  return {
    code,
    message: message || ErrorMessages[code],
    ...(context && { context }),
  }
}

/**
 * Get HTTP status code for error code.
 *
 * @param code - Error code
 * @returns HTTP status code (defaults to 500 if not found)
 */
export function getStatusCode(code: ErrorCodeValue): number {
  return ErrorStatusMap[code] || 500
}

/**
 * Check if error code represents a client error (4xx).
 *
 * @param code - Error code
 * @returns true if 4xx, false otherwise
 */
export function isClientError(code: ErrorCodeValue): boolean {
  const status = getStatusCode(code)
  return status >= 400 && status < 500
}

/**
 * Check if error code represents a server error (5xx).
 *
 * @param code - Error code
 * @returns true if 5xx, false otherwise
 */
export function isServerError(code: ErrorCodeValue): boolean {
  const status = getStatusCode(code)
  return status >= 500
}
