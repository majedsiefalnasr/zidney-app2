import type { Context } from 'hono'
import { getCorrelationId } from '../middleware/correlation-id'
import { ERROR_CODE_TO_STATUS, ErrorCode } from '../types/error-codes'

/**
 * T057: Standardized Error Response Formatter
 *
 * Purpose: Format all errors with consistent structure
 * Constitutional Compliance: Standardized error responses with correlationId
 */

export interface ErrorResponse {
  success: false
  data: null
  error: {
    code: string
    message: string
    details?: Record<string, any>
  }
}

export interface SuccessResponse<T = any> {
  success: true
  data: T
  error: null
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse

/**
 * Format error for API response
 */
export function formatError(
  code: ErrorCode,
  message: string,
  details?: Record<string, any>
): ErrorResponse {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  }
}

/**
 * Format success response
 */
export function formatSuccess<T = any>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
    error: null,
  }
}

/**
 * Error handler with structured response
 */
export async function handleError(
  c: Context,
  error: unknown,
  context?: Partial<{ code: ErrorCode; details: Record<string, any> }>
) {
  const correlationId = getCorrelationId(c)
  const code = context?.code || ErrorCode.INTERNAL_ERROR
  const statusCode = ERROR_CODE_TO_STATUS[code] || 500

  let message = 'An unexpected error occurred'
  if (error instanceof Error) {
    message = error.message
  }

  // Log error with correlation ID (never expose stack trace to client)
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      service: 'api',
      event: 'error_handler_invoked',
      correlation_id: correlationId,
      error_code: code,
      error_message: message,
      status_code: statusCode,
      // Stack trace logged internally only, never sent to client
      stack: error instanceof Error ? error.stack : undefined,
    })
  )

  // Return standardized error response
  return c.json(formatError(code, message, context?.details), {
    status: statusCode,
    headers: {
      'x-correlation-id': correlationId,
    },
  })
}

/**
 * Helper to throw error with context
 */
export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Middleware to catch unhandled errors
 */
export async function errorHandlerMiddleware(
  c: Context,
  next: () => Promise<void>
) {
  try {
    await next()
  } catch (error) {
    if (error instanceof ApiError) {
      return handleError(c, error, { code: error.code, details: error.details })
    }
    return handleError(c, error, { code: ErrorCode.INTERNAL_ERROR })
  }
}
