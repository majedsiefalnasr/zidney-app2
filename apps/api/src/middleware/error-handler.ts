/**
 * Error handler for migration-specific errors (Task 20)
 * Maps error codes to HTTP status codes
 */

export interface StandardErrorResponse {
  success: false
  data: null
  error: {
    code: string
    message: string
  }
}

/**
 * Error code to HTTP status code mapping
 */
const ERROR_CODE_MAP: Record<string, number> = {
  MIGRATION_SYNTAX_ERROR: 400,
  MIGRATION_TAMPERING_DETECTED: 500,
  MIGRATION_SEQUENCE_GAP: 500,
  SCHEMA_VERSION_MISMATCH: 426,
  PRODUCT_VERSION_INCOMPATIBLE: 400,
  SNAPSHOT_STORAGE_UNAVAILABLE: 503,
  SNAPSHOT_STORAGE_FULL: 507,
  WORKSPACE_UPGRADE_IN_PROGRESS: 409,
  MIGRATION_LOCK_TIMEOUT: 504,
  DATABASE_UNAVAILABLE: 503,
  LICENSE_INACTIVE: 423,
  INVALID_VERSION_FORMAT: 400,
  CANNOT_DOWNGRADE: 400,
  UPGRADE_TO_OBSOLETE_VERSION: 400,
  INVALID_REQUEST: 400,
  RATE_LIMIT_EXCEEDED: 429,
  LICENSE_NOT_FOUND: 403,
  LICENSE_SOFT_LOCKED: 423,
  LICENSE_ARCHIVED: 403,
  INVALID_SNAPSHOT_FOR_WORKSPACE: 400,
  INVALID_CONFIRMATION: 400,
  UPGRADE_NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
}

/**
 * Get HTTP status code for error code
 */
export function getErrorStatusCode(errorCode: string): number {
  return ERROR_CODE_MAP[errorCode] || 500
}

/**
 * Create standard error response
 */
export function createErrorResponse(
  errorCode: string,
  message: string
): StandardErrorResponse {
  return {
    success: false,
    data: null,
    error: {
      code: errorCode,
      message,
    },
  }
}

/**
 * Error handler middleware
 * Maps custom errors to standard responses
 */
export function errorHandlerMiddleware(
  err: any,
  req: any,
  res: any,
  next: any
) {
  const correlation_id = req.headers['x-correlation-id'] || 'unknown'

  // Extract error code and message
  const errorCode = err.errorCode || err.code || 'INTERNAL_ERROR'
  const message = err.message || 'An unexpected error occurred'
  const statusCode = err.statusCode || getErrorStatusCode(errorCode)

  // Log error
  console.log(
    JSON.stringify({
      level: 'ERROR',
      service: 'api-error-handler',
      event: 'request_error',
      correlation_id,
      error_code: errorCode,
      error_message: message,
      status_code: statusCode,
      timestamp: new Date().toISOString(),
    })
  )

  // Send response
  res.status(statusCode).json(createErrorResponse(errorCode, message))
}
