/**
 * Error Handler Middleware
 *
 * File: apps/api/src/middleware/auth/error-handler-middleware.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Catch and standardize all authentication-related errors.
 * Implements standard error contract across all endpoints.
 *
 * Standard Error Contract:
 * {
 *   success: false,
 *   data: null,
 *   error: {
 *     code: string,
 *     message: string
 *   }
 * }
 *
 * HTTP Status Mapping:
 * - 400: Invalid input (validation_error)
 * - 401: Invalid credentials (invalid_credentials)
 * - 403: Permission denied (permission_denied)
 * - 404: Resource not found (not_found)
 * - 409: Conflict (conflict)
 * - 423: Account locked (account_locked)
 * - 426: Schema version mismatch (version_mismatch)
 * - 500: Server error (internal_error)
 *
 * Security:
 * - Does NOT expose sensitive details
 * - Logs full error to server for debugging
 * - Client sees sanitized message only
 */

import { createLogger } from '@zidney/logger'
import type { Context, Next } from 'hono'

const logger = createLogger('api-errors')

export function getAuditLogger() {
  return logger
}

/**
 * Known error codes for authentication domain
 */
export const AuthErrorCodes = {
  // Authentication
  INVALID_CREDENTIALS: 'invalid_credentials',
  INVALID_TOKEN: 'invalid_token',
  EXPIRED_TOKEN: 'expired_token',
  MALFORMED_TOKEN: 'malformed_token',
  TOKEN_VERSION_MISMATCH: 'token_version_mismatch',

  // Validation
  VALIDATION_ERROR: 'validation_error',
  MISSING_FIELD: 'missing_field',
  INVALID_EMAIL: 'invalid_email',
  INVALID_PASSWORD: 'invalid_password',
  PASSWORD_TOO_WEAK: 'password_too_weak',

  // Authorization
  PERMISSION_DENIED: 'permission_denied',
  INSUFFICIENT_PERMISSIONS: 'insufficient_permissions',
  NOT_FOUND: 'not_found',

  // Account State
  ACCOUNT_LOCKED: 'account_locked',
  ACCOUNT_DISABLED: 'account_disabled',
  ACCOUNT_NOT_FOUND: 'account_not_found',

  // Concurrency
  CONFLICT: 'conflict',
  CONCURRENT_MODIFICATION: 'concurrent_modification',

  // Versioning
  SCHEMA_VERSION_MISMATCH: 'schema_version_mismatch',
  PRODUCT_VERSION_INCOMPATIBLE: 'product_version_incompatible',

  // License
  LICENSE_INVALID: 'license_invalid',
  LICENSE_SOFT_LOCKED: 'license_soft_locked',
  LICENSE_ARCHIVED: 'license_archived',

  // Workspace
  WORKSPACE_NOT_FOUND: 'workspace_not_found',
  WORKSPACE_INVALID: 'workspace_invalid',

  // Server
  INTERNAL_ERROR: 'internal_error',
  SERVICE_UNAVAILABLE: 'service_unavailable',
}

/**
 * Auth-specific error class
 */
export class AuthError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * Error response structure
 */
interface ErrorResponse {
  success: false
  data: null
  error: {
    code: string
    message: string
  }
}

/**
 * Map error codes to HTTP status
 */
function getHttpStatus(code: string): number {
  const statusMap: Record<string, number> = {
    [AuthErrorCodes.VALIDATION_ERROR]: 400,
    [AuthErrorCodes.MISSING_FIELD]: 400,
    [AuthErrorCodes.INVALID_EMAIL]: 400,
    [AuthErrorCodes.INVALID_PASSWORD]: 400,
    [AuthErrorCodes.PASSWORD_TOO_WEAK]: 400,

    [AuthErrorCodes.INVALID_CREDENTIALS]: 401,
    [AuthErrorCodes.INVALID_TOKEN]: 401,
    [AuthErrorCodes.EXPIRED_TOKEN]: 401,
    [AuthErrorCodes.MALFORMED_TOKEN]: 401,
    [AuthErrorCodes.TOKEN_VERSION_MISMATCH]: 401,

    [AuthErrorCodes.PERMISSION_DENIED]: 403,
    [AuthErrorCodes.INSUFFICIENT_PERMISSIONS]: 403,

    [AuthErrorCodes.NOT_FOUND]: 404,
    [AuthErrorCodes.ACCOUNT_NOT_FOUND]: 404,
    [AuthErrorCodes.WORKSPACE_NOT_FOUND]: 404,

    [AuthErrorCodes.ACCOUNT_LOCKED]: 423,

    [AuthErrorCodes.SCHEMA_VERSION_MISMATCH]: 426,
    [AuthErrorCodes.PRODUCT_VERSION_INCOMPATIBLE]: 426,

    [AuthErrorCodes.LICENSE_SOFT_LOCKED]: 423,
    [AuthErrorCodes.LICENSE_ARCHIVED]: 403,
    [AuthErrorCodes.LICENSE_INVALID]: 403,

    [AuthErrorCodes.CONFLICT]: 409,
    [AuthErrorCodes.CONCURRENT_MODIFICATION]: 409,
    [AuthErrorCodes.WORKSPACE_INVALID]: 409,

    [AuthErrorCodes.INTERNAL_ERROR]: 500,
    [AuthErrorCodes.SERVICE_UNAVAILABLE]: 503,
  }

  return statusMap[code] || 500
}

/**
 * Sanitize error message for client
 * Never expose internal details, stack traces, database info
 */
function sanitizeMessage(code: string, originalMessage: string): string {
  const publicMessages: Record<string, string> = {
    [AuthErrorCodes.INVALID_CREDENTIALS]: 'Invalid email or password. Please try again.',
    [AuthErrorCodes.INVALID_TOKEN]: 'Your session has expired. Please log in again.',
    [AuthErrorCodes.EXPIRED_TOKEN]: 'Your session has expired. Please log in again.',
    [AuthErrorCodes.MALFORMED_TOKEN]: 'Invalid session token. Please log in again.',
    [AuthErrorCodes.TOKEN_VERSION_MISMATCH]:
      'Your session has been invalidated. Please log in again.',

    [AuthErrorCodes.PERMISSION_DENIED]: 'You do not have permission to access this resource.',
    [AuthErrorCodes.INSUFFICIENT_PERMISSIONS]:
      'You do not have the required permissions for this action.',

    [AuthErrorCodes.ACCOUNT_LOCKED]:
      'Your account is locked due to too many login attempts. Please try again later.',
    [AuthErrorCodes.ACCOUNT_DISABLED]: 'Your account has been disabled. Please contact support.',

    [AuthErrorCodes.SCHEMA_VERSION_MISMATCH]:
      'System upgrade required. Please refresh and try again.',
    [AuthErrorCodes.PRODUCT_VERSION_INCOMPATIBLE]:
      'System compatibility issue. Please contact support.',

    [AuthErrorCodes.LICENSE_SOFT_LOCKED]:
      'Service temporarily unavailable. Please try again shortly.',
    [AuthErrorCodes.LICENSE_ARCHIVED]:
      'This workspace is no longer active. Please contact support.',

    [AuthErrorCodes.WORKSPACE_NOT_FOUND]:
      'Workspace not found. Please check the URL and try again.',
    [AuthErrorCodes.WORKSPACE_INVALID]:
      'Invalid workspace context. Please check the URL and try again.',

    [AuthErrorCodes.INTERNAL_ERROR]:
      'An error occurred while processing your request. Please try again.',
    [AuthErrorCodes.SERVICE_UNAVAILABLE]:
      'Service is temporarily unavailable. Please try again shortly.',
  }

  return publicMessages[code] || originalMessage
}

/**
 * Error handler middleware
 * Catches all errors and returns standard response
 */
export async function errorHandlerMiddleware(c: Context, next: Next) {
  try {
    await next()
  } catch (err) {
    const correlationId = c.get('correlationId') || 'unknown'

    // Handle known AuthError
    if (err instanceof AuthError) {
      const statusCode = err.statusCode || getHttpStatus(err.code)
      const sanitizedMessage = sanitizeMessage(err.code, err.message)

      // Log error server-side (full details)
      logger.error(
        {
          correlation_id: correlationId,
          error_code: err.code,
          error_message: err.message,
          status_code: statusCode,
        },
        '[Auth Error] Authentication failed'
      )

      // Send error response (sanitized)
      c.status(statusCode as 400 | 401 | 403 | 404 | 409 | 422 | 423 | 426 | 429 | 500)
      return c.json({
        success: false,
        data: null,
        error: {
          code: err.code,
          message: sanitizedMessage,
        },
      } as ErrorResponse)
    }

    // Handle generic errors
    if (err instanceof Error) {
      const statusCode = 500
      const errorCode = AuthErrorCodes.INTERNAL_ERROR

      // Log full error (stack trace, etc.) for debugging
      logger.error(
        {
          correlation_id: correlationId,
          error_type: err.constructor.name,
          error_message: err.message,
          stack: err.stack,
        },
        '[Unhandled Error] Exception during request processing'
      )

      // Send sanitized response
      c.status(statusCode as 400 | 401 | 403 | 404 | 409 | 422 | 423 | 426 | 429 | 500)
      return c.json({
        success: false,
        data: null,
        error: {
          code: errorCode,
          message: sanitizeMessage(errorCode, err.message),
        },
      } as ErrorResponse)
    }

    // Handle unknown errors
    logger.error(
      {
        correlation_id: correlationId,
        error_type: typeof err,
        error_value: JSON.stringify(err),
      },
      '[Unhandled Error] Unknown error type'
    )

    c.status(500)
    return c.json({
      success: false,
      data: null,
      error: {
        code: AuthErrorCodes.INTERNAL_ERROR,
        message: sanitizeMessage(AuthErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred'),
      },
    } as ErrorResponse)
  }
}

/**
 * Helper to throw auth error from routes
 */
export function throwAuthError(code: string, message: string, statusCode?: number): never {
  throw new AuthError(code, statusCode || getHttpStatus(code), message)
}
