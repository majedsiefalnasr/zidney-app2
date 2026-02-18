/**
 * Error Handler Middleware - Standardized API error responses.
 *
 * Responsibilities:
 * - Catch all thrown errors (try-catch wrapper)
 * - Map errors to standard error codes
 * - Format responses according to contract: { success, data, error }
 * - Log full error context internally
 * - Return safe error info to client (no stack traces)
 * - Include request_id for support correlation
 *
 * Response shape:
 * {
 *   success: false,
 *   data: null,
 *   error: {
 *     code: string,
 *     message: string,
 *     request_id: string
 *   }
 * }
 *
 * Stack traces logged internally only, never sent to client.
 */

import { Context, Next } from 'hono'
import { ErrorCodes } from '../config/errors'

export interface StandardErrorResponse {
  success: false
  data: null
  error: {
    code: string
    message: string
    request_id?: string
  }
}

/**
 * Backward compatible error code to HTTP status mapping.
 * Includes both new and legacy error codes.
 */
const ERROR_CODE_MAP: Record<string, number> = {
  // New standardized codes
  VALIDATION_ERROR: 400,
  AUTHENTICATION_FAILED: 401,
  PERMISSION_DENIED: 403,
  RESOURCE_NOT_FOUND: 404,
  CONFLICT_ERROR: 409,
  VERSION_MISMATCH: 409,
  RATE_LIMITED: 429,
  LICENSE_SOFT_LOCKED: 423,
  WORKSPACE_LOCKED: 423,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,

  // Legacy codes (from existing implementation)
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
  LICENSE_ARCHIVED: 403,
  INVALID_SNAPSHOT_FOR_WORKSPACE: 400,
  INVALID_CONFIRMATION: 400,
  UPGRADE_NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
}

/**
 * Get HTTP status code for error code (backward compatible)
 */
export function getErrorStatusCode(errorCode: string): number {
  return ERROR_CODE_MAP[errorCode] || 500
}

/**
 * Error handler middleware - catches and formats all errors.
 *
 * Wraps route handlers in try-catch, formats errors consistently.
 * Middleware must be registered last (after all other middleware).
 *
 * Error mapping strategy:
 * 1. Check if error is known type (ValidationError, AuthError, etc.)
 * 2. Map to corresponding ErrorCode
 * 3. Extract safe message
 * 4. Log full error internally
 * 5. Return standardized response to client
 */
export function errorHandlerMiddleware() {
  return async (c: Context, next: Next): Promise<void> => {
    try {
      await next()

      // If we reach here with no response yet, check status
      if (!c.res.status || c.res.status < 400) {
        return // Success or non-error response
      }

      // Response was set with error status but no body; let it pass through
    } catch (error) {
      // Caught an error during route processing
      const requestId = c.get('request_id') as string
      const logger = c.get('logger') as any

      // Determine error code and HTTP status
      let errorCode: string = ErrorCodes.INTERNAL_SERVER_ERROR
      let statusCode: number = 500
      let errorMessage: string = 'An internal server error occurred'

      // Map error type to error code
      if (error instanceof Error) {
        const errorName = error.name

        // Map common error types
        if (
          errorName === 'ValidationError' ||
          errorName === 'JoiValidationError'
        ) {
          errorCode = ErrorCodes.VALIDATION_ERROR
          statusCode = 400
          errorMessage = error.message || 'Request validation failed'
        } else if (
          errorName === 'UnauthorizedError' ||
          errorName === 'AuthenticationError'
        ) {
          errorCode = ErrorCodes.AUTHENTICATION_FAILED
          statusCode = 401
          errorMessage = 'Authentication failed'
        } else if (
          errorName === 'ForbiddenError' ||
          errorName === 'PermissionError'
        ) {
          errorCode = ErrorCodes.PERMISSION_DENIED
          statusCode = 403
          errorMessage = 'You do not have permission to perform this action'
        } else if (errorName === 'NotFoundError') {
          errorCode = ErrorCodes.RESOURCE_NOT_FOUND
          statusCode = 404
          errorMessage = 'The requested resource was not found'
        } else if (errorName === 'ConflictError') {
          errorCode = ErrorCodes.CONFLICT_ERROR
          statusCode = 409
          errorMessage = 'The request conflicts with the current state'
        } else if (errorName === 'RateLimitError') {
          errorCode = ErrorCodes.RATE_LIMITED
          statusCode = 429
          errorMessage = 'Too many requests. Please try again later'
        } else if (error.message?.includes('license')) {
          errorCode = ErrorCodes.LICENSE_SOFT_LOCKED
          statusCode = 423
          errorMessage = 'Workspace is temporarily locked'
        }

        // Log full error internally with stack trace
        if (logger) {
          logger.error({
            event: 'request_error',
            error_code: errorCode,
            error_type: errorName,
            error_message: error.message,
            stack_trace: error.stack,
            status_code: statusCode,
          })
        } else {
          console.error('Request error', {
            event: 'request_error',
            error_code: errorCode,
            status_code: statusCode,
            stack: error.stack,
          })
        }
      } else {
        // Non-Error object thrown
        const errorStr = String(error)
        console.error('Unknown error thrown', { error: errorStr })

        if (logger) {
          logger.error({
            event: 'request_error_unknown',
            error_type: typeof error,
            error_value: errorStr,
          })
        }
      }

      // Return standardized error response (no stack trace to client)
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: errorCode,
            message: errorMessage,
            request_id: requestId,
          },
        },
        statusCode
      )
    }
  }
}

/**
 * Utility: Create properly typed error from code.
 * Can be thrown and caught by error handler.
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = getErrorStatusCode(code)
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Validation error class.
 * Thrown when request validation fails.
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public fields?: Record<string, string[]>
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Authentication error class.
 * Thrown when authentication fails.
 */
export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication failed') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

/**
 * Authorization error class.
 * Thrown when user lacks permissions.
 */
export class AuthorizationError extends Error {
  constructor(message: string = 'Permission denied') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

/**
 * Not found error class.
 * Thrown when resource doesn't exist.
 */
export class NotFoundError extends Error {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`)
    this.name = 'NotFoundError'
  }
}

/**
 * Conflict error class.
 * Thrown when request conflicts with current state.
 */
export class ConflictError extends Error {
  constructor(message: string = 'Resource conflict') {
    super(message)
    this.name = 'ConflictError'
  }
}

/**
 * Rate limit error class.
 * Thrown when rate limit exceeded.
 */
export class RateLimitError extends Error {
  constructor(public retryAfter?: number) {
    super('Rate limit exceeded')
    this.name = 'RateLimitError'
  }
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
