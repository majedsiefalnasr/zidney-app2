/**
 * Error Handler Utility
 *
 * Maps domain errors to HTTP status codes and response format.
 * Implements all 13 error codes with correct HTTP status codes.
 * Follows error handling standard: {success: false, data: null, error: {code, message}}
 *
 * Stage: STAGE_09_PRODUCTS
 * Task: T031
 * Reference: docs/01_ENGINEERING_GOVERNANCE/09_ERROR_HANDLING_STANDARD.md
 */

import { createLogger } from '@zidney/logger'
import {
  AppError,
  ErrorCodes,
  getErrorMessage,
  getHttpStatus,
} from '@zidney/types/errors/ErrorCodes'
import type { Context } from 'hono'

const logger = createLogger('api')

/**
 * Error response interface
 */
export interface ErrorResponse {
  success: false
  data: null
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

/**
 * Handle error in API context
 *
 * Maps error to HTTP status code and structured response.
 * Logs error with correlation ID for tracing.
 */
export function handleError(c: Context, error: Error | AppError): Response {
  const correlationId = c.get('correlationId') || 'unknown'
  const workspaceId = c.get('workspaceId')
  const userId = c.get('userId')

  let errorCode: string = ErrorCodes.INTERNAL_SERVER_ERROR
  let statusCode = 500
  let details: Record<string, unknown> | undefined

  // Handle AppError specifically
  if (error instanceof AppError) {
    errorCode = error.code
    statusCode = getHttpStatus(error.code)
    details = error.details

    // Log error
    logger.error('api_error', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      user_id: userId,
      error_code: errorCode,
      error_message: error.message,
      ...(details && { details }),
    })
  } else {
    // Generic error
    errorCode = ErrorCodes.INTERNAL_SERVER_ERROR
    statusCode = 500

    logger.error('api_error_unexpected', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      user_id: userId,
      error_message: error.message,
      stack: error.stack,
    })
  }

  const response: ErrorResponse = {
    success: false,
    data: null,
    error: {
      code: errorCode,
      message: getErrorMessage(errorCode),
      ...(details && { details }),
    },
  }

  return c.json(response, statusCode as any)
}

/**
 * Create error response
 *
 * Useful for manual error creation in handlers.
 */
export function createErrorResponse(
  code: string,
  message?: string
): ErrorResponse {
  return {
    success: false,
    data: null,
    error: {
      code,
      message: message || getErrorMessage(code),
    },
  }
}

/**
 * Map common error types to AppError
 */
export function mapToAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof Error) {
    const message = error.message

    // Detect error type from message
    if (message.includes('duplicate')) {
      return new AppError(
        ErrorCodes.DUPLICATE_SLUG,
        'Product slug already exists'
      )
    }

    if (message.includes('not found') || message.includes('NOT_FOUND')) {
      return new AppError(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found')
    }

    if (message.includes('unauthorized') || message.includes('UNAUTHORIZED')) {
      return new AppError(ErrorCodes.UNAUTHORIZED, 'Authentication required')
    }

    if (message.includes('forbidden') || message.includes('FORBIDDEN')) {
      return new AppError(ErrorCodes.FORBIDDEN, 'Access denied')
    }

    return new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, message)
  }

  return new AppError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Unknown error')
}

/**
 * Async error handler wrapper
 *
 * Wraps async route handlers to catch errors.
 */
export function asyncHandler(
  handler: (c: Context) => Promise<Response>
): (c: Context) => Promise<Response> {
  return async (c: Context) => {
    try {
      return await handler(c)
    } catch (error) {
      const appError = mapToAppError(error)
      return handleError(c, appError)
    }
  }
}
