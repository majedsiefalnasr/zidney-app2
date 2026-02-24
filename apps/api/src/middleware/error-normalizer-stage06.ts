/**
 * Error Normalizer Middleware — STAGE_06 Attempt Engine
 *
 * Purpose: Normalize all error responses to RFC 7807 standard format
 * Middleware Priority: Late in stack (after business logic errors are caught)
 *
 * Task: T015 (Enhanced) – Error normalizer middleware (RFC 7807)
 * Phase: B – Middleware Integration
 * Stage: STAGE_06_ATTEMPT_ENGINE_FOUNDATION
 *
 * RFC 7807 Format:
 * {
 *   "type": "string (URI)",
 *   "title": "string (title)",
 *   "status": number,
 *   "detail": "string (human-readable)",
 *   "instance": "string (path)"
 * }
 *
 * But we use:
 * {
 *   "success": false,
 *   "data": null,
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "Human-readable message",
 *     "status": 400,
 *     "correlation_id": ""
 *   }
 * }
 *
 * Constitutional Compliance:
 * - Correlation ID always included
 * - No sensitive data leaked in errors
 * - Consistent error format across all endpoints
 * - Proper HTTP status codes
 */

import { Logger } from '@zidney/logger'
import { Context } from 'hono'

export interface NormalizedErrorResponse {
  success: false
  data: null
  error: {
    code: string
    message: string
    status: number
    correlation_id: string
    path?: string
    timestamp?: string
  }
}

/**
 * HTTP Status Code Mapping for Common Error Codes
 */
const ERROR_CODE_TO_HTTP_STATUS: Record<string, number> = {
  // 4xx Client Errors
  INVALID_REQUEST: 400,
  VALIDATION_ERROR: 422,
  MISSING_FIELD: 400,
  INVALID_FORMAT: 400,
  INVALID_UUID: 400,
  INVALID_ENUM: 400,

  // 401 Unauthorized
  UNAUTHORIZED: 401,
  MISSING_TOKEN: 401,
  INVALID_TOKEN: 401,
  TOKEN_EXPIRED: 401,

  // 403 Forbidden
  FORBIDDEN: 403,
  LICENSE_INACTIVE: 403,
  LICENSE_NOT_FOUND: 403,
  LICENSE_ARCHIVED: 403,
  WORKSPACE_ARCHIVED: 403,
  PERMISSION_DENIED: 403,
  RBAC_DENIED: 403,

  // 404 Not Found
  NOT_FOUND: 404,
  ATTEMPT_NOT_FOUND: 404,
  EXAM_NOT_FOUND: 404,
  QUESTION_NOT_FOUND: 404,
  WORKSPACE_NOT_FOUND: 404,
  UPGRADE_NOT_FOUND: 404,

  // 409 Conflict
  CONFLICT: 409,
  ATTEMPT_ALREADY_SUBMITTED: 409,
  ATTEMPT_INVALID_STATUS: 409,
  DUPLICATE_ATTEMPT: 409,
  WORKSPACE_UPGRADE_IN_PROGRESS: 409,

  // 410 Gone
  ATTEMPT_EXPIRED: 410,

  // 423 Locked
  WORKSPACE_SOFT_LOCKED: 423,
  LICENSE_SOFT_LOCKED: 423,

  // 426 Upgrade Required
  SCHEMA_VERSION_INCOMPATIBLE: 426,
  PRODUCT_VERSION_INCOMPATIBLE: 426,

  // 429 Too Many Requests
  RATE_LIMIT_EXCEEDED: 429,

  // 5xx Server Errors
  INTERNAL_ERROR: 500,
  DATABASE_ERROR: 500,
  DATABASE_UNAVAILABLE: 503,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 504,
  ATTEMPT_CONCURRENCY_VIOLATION: 503,
  MIGRATION_LOCK_TIMEOUT: 504,

  // Generic
  SYSTEM_ERROR: 500,
}

/**
 * Get HTTP status code for error code
 */
export function getHttpStatusForErrorCode(errorCode: string): number {
  return ERROR_CODE_TO_HTTP_STATUS[errorCode] || 500
}

/**
 * Create normalized error response
 */
export function createNormalizedError(
  errorCode: string,
  message: string,
  correlation_id?: string,
  path?: string
): NormalizedErrorResponse {
  return {
    success: false,
    data: null,
    error: {
      code: errorCode,
      message,
      status: getHttpStatusForErrorCode(errorCode),
      correlation_id: correlation_id || 'unknown',
      path,
      timestamp: new Date().toISOString(),
    },
  }
}

/**
 * Error normalizer middleware for STAGE_06
 *
 * Catches errors from downstream handlers and normalizes to standard format
 * Should be applied LAST (as error handler) using app.onError()
 */
export function createErrorNormalizerStage06(
  logger: Logger
): (error: Error, c: Context) => Response | Promise<Response> {
  return async (error: Error, c: Context) => {
    const correlation_id = c.get('correlationId') || 'unknown'
    const path = c.req.path
    const method = c.req.method

    // Extract error details
    let errorCode = 'INTERNAL_ERROR'
    let message = 'An unexpected error occurred'
    let http_status = 500

    // Handle known error types
    if (error instanceof ValidationError) {
      errorCode = 'VALIDATION_ERROR'
      message = error.message
      http_status = 422
    } else if (error instanceof NotFoundError) {
      errorCode = error.code
      message = error.message
      http_status = 404
    } else if (error instanceof ConflictError) {
      errorCode = error.code
      message = error.message
      http_status = 409
    } else if (error instanceof ForbiddenError) {
      errorCode = 'FORBIDDEN'
      message = error.message
      http_status = 403
    } else if (error instanceof UnauthorizedError) {
      errorCode = 'UNAUTHORIZED'
      message = error.message
      http_status = 401
    } else if (error instanceof DatabaseError) {
      errorCode = 'DATABASE_ERROR'
      message = 'Database operation failed'
      http_status = 500
    } else {
      // Generic error
      message = error.message || 'An unexpected error occurred'
    }

    const normalized_error = createNormalizedError(
      errorCode,
      message,
      correlation_id,
      path
    )

    // Ensure HTTP status matches error definition
    normalized_error.error.status = http_status

    // Log error with context
    if (http_status >= 500) {
      logger.error(`Error: ${method} ${path}`, {
        correlation_id,
        error_code: errorCode,
        http_status,
        error_message: message,
        stack: error.stack,
      })
    } else {
      logger.warn(`Client Error: ${method} ${path}`, {
        correlation_id,
        error_code: errorCode,
        http_status,
        error_message: message,
      })
    }

    c.status(http_status as any)
    return c.json(normalized_error)
  }
}

// ============================================================================
// Custom Error Classes
// ============================================================================

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'NotFoundError'
    this.code = code
  }
}

export class ConflictError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ConflictError'
    this.code = code
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export default createErrorNormalizerStage06
