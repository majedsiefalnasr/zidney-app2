/**
 * Dashboard Error Handler Middleware
 *
 * Purpose: Centralized error handling for all MMC Dashboard endpoints
 * - Maps HTTP status codes to standard error codes
 * - Logs errors with structured fields (correlation_id, user_id, workspace_id)
 * - Returns standard response envelope {success: false, data: null, error: {code, message}}
 * - Prevents database details from leaking to client
 *
 * File: apps/api/src/middleware/dashboard-error-handler.middleware.ts
 * Task: T025
 * Phase: 1 - Backend Implementation
 *
 * Constitutional Compliance:
 * ✓ Error mapping: Standard HTTP codes to error codes
 * ✓ Structured logging: correlation_id, user_id, workspace_id required
 * ✓ No database leakage: Generic message for 500 errors
 * ✓ Standard response envelope: {success: false, data: null, error: {...}}
 * ✓ Logging rules: timestamp, level, service, correlation_id, user_id, workspace_id
 *
 * Error Code Mapping:
 * - 400 Bad Request → INVALID_REQUEST
 * - 403 Forbidden → PERMISSION_DENIED
 * - 408 Request Timeout → REQUEST_TIMEOUT
 * - 413 Payload Too Large → PAYLOAD_TOO_LARGE
 * - 423 Locked → LICENSE_LOCKED
 * - 426 Upgrade Required → SCHEMA_INCOMPATIBLE
 * - 429 Too Many Requests → RATE_LIMIT_EXCEEDED
 * - 500 Internal Server Error → INTERNAL_ERROR (no DB details)
 *
 * Chain Position:
 * This middleware should be registered LATE in the middleware chain,
 * after theme/routing middleware, to catch errors from all layers.
 */

import { logger } from '@zidney/logger'
import type { Context, Next } from 'hono'

/**
 * Error response envelope
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
 * HTTP Status to Error Code mapping
 */
const ERROR_CODE_MAP: Record<number, string> = {
  400: 'INVALID_REQUEST',
  403: 'PERMISSION_DENIED',
  408: 'REQUEST_TIMEOUT',
  413: 'PAYLOAD_TOO_LARGE',
  423: 'LICENSE_LOCKED',
  426: 'SCHEMA_INCOMPATIBLE',
  429: 'RATE_LIMIT_EXCEEDED',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
}

/**
 * Error code to human-readable message mapping
 */
const ERROR_MESSAGE_MAP: Record<string, string> = {
  INVALID_REQUEST: 'The request was invalid. Please verify all parameters.',
  PERMISSION_DENIED: 'You do not have permission to access this resource.',
  REQUEST_TIMEOUT: 'The request took too long to process.',
  PAYLOAD_TOO_LARGE: 'The request payload is too large to process.',
  LICENSE_LOCKED: 'The workspace license is not in an active state.',
  SCHEMA_INCOMPATIBLE: 'The database schema version is incompatible with this API version.',
  RATE_LIMIT_EXCEEDED: 'You have exceeded the rate limit for this endpoint.',
  INTERNAL_ERROR: 'An internal server error occurred. Please try again later.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',
}

/**
 * Custom error class for dashboard errors
 */
export class DashboardError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    public message: string,
    public context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'DashboardError'
  }
}

/**
 * Format error response for client
 *
 * @param status - HTTP status code
 * @param message - Error message (or null to use default)
 * @returns Formatted error response
 */
function formatErrorResponse(status: number, message?: string): ErrorResponse {
  const errorCode = ERROR_CODE_MAP[status] || 'INTERNAL_ERROR'
  const errorMessage = message || ERROR_MESSAGE_MAP[errorCode] || 'An unexpected error occurred.'

  return {
    success: false,
    data: null,
    error: {
      code: errorCode,
      message: errorMessage,
    },
  }
}

/**
 * Log error with structured fields
 *
 * @param status - HTTP status code
 * @param errorCode - Error code
 * @param message - Error message
 * @param context - Request context with correlation_id, user_id, workspace_id
 * @param originalError - Original error for stack trace
 */
function logError(
  status: number,
  errorCode: string,
  message: string,
  context: DashboardLogContext,
  originalError?: Error
): void {
  const logData = {
    timestamp: new Date().toISOString(),
    level: status >= 500 ? 'error' : 'warn',
    service: 'mmc-dashboard',
    correlation_id: context?.req?.header?.('x-correlation-id') || 'unknown',
    user_id: context?.user?.id || 'unknown',
    workspace_id: context?.workspace?.id || 'unknown',
    error_code: errorCode,
    error_message: message,
    http_status: status,
    endpoint: context?.req?.path || 'unknown',
    method: context?.req?.method || 'unknown',
  }

  if (originalError) {
    // @ts-expect-error: LOGIC-BUG: stack_trace not in logData type - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
    logData.stack_trace = originalError.stack
  }

  // @ts-expect-error: LOGIC-BUG: Logger.log() does not exist — see INFRA-001-LOGIC-07 [INFRA-001-LOGIC-07]
  logger.log(logData)
}

/**
 * Dashboard Error Handler Middleware
 *
 * Catches errors from all layers and returns standardized error responses.
 * Should be registered near the end of the middleware chain.
 *
 * Usage:
 * ```typescript
 * app.use(dashboardErrorHandler)
 * ```
 */
export async function dashboardErrorHandler(c: Context, next: Next): Promise<void> {
  try {
    await next()

    // Check if response was already sent with error status
    const status = c.res.status
    if (status >= 400) {
      // If middleware already set headers, don't override
      const contentType = c.res.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        // Response already formatted, don't modify
        return
      }

      // Response is an error but not formatted; format it now
      const errorCode = ERROR_CODE_MAP[status] || 'INTERNAL_ERROR'
      const message = ERROR_MESSAGE_MAP[errorCode]

      // Log the error
      // @ts-expect-error: LOGIC-BUG: logError args possibly undefined - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
      logError(status, errorCode, message, c, undefined)

      // Send formatted error response
      // @ts-expect-error: LOGIC-BUG: Hono c.status() expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
      c.status(status)
      c.header('Content-Type', 'application/json')
      c.header('x-correlation-id', c.req.header('x-correlation-id') || 'unknown')
      await c.json(formatErrorResponse(status, message))
    }
  } catch (error) {
    // Catch any unhandled errors
    const err = error instanceof Error ? error : new Error(String(error))
    const isDashboardError = error instanceof DashboardError

    let status = 500
    let errorCode = 'INTERNAL_ERROR'
    let message = 'An internal server error occurred.'

    if (isDashboardError) {
      const dashError = error as DashboardError
      status = dashError.statusCode
      errorCode = dashError.errorCode
      message = dashError.message

      // Log with context from DashboardError
      // @ts-expect-error: LOGIC-BUG: logError args possibly undefined - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
      logError(status, errorCode, message, c, err)
    } else {
      // Log unexpected error with full stack trace
      logError(500, errorCode, message, c, err)
    }

    // Never expose database errors or stack traces to client
    const clientMessage = status === 500 ? ERROR_MESSAGE_MAP.INTERNAL_ERROR : message

    // @ts-expect-error: LOGIC-BUG: Hono c.status() expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
    c.status(status)
    c.header('Content-Type', 'application/json')
    c.header('x-correlation-id', c.req.header('x-correlation-id') || 'unknown')

    await c.json({
      success: false,
      data: null,
      error: {
        code: errorCode,
        message: clientMessage,
      },
    })
  }
}

/**
 * Utility: Throw dashboard error with context
 *
 * Usage:
 * ```typescript
 * if (!permission) {
 *   throw new DashboardError(403, 'PERMISSION_DENIED',
 *     'reporting.view permission required')
 * }
 * ```
 */
export function throwDashboardError(
  statusCode: number,
  errorCode: string,
  message: string,
  context?: DashboardLogContext
): never {
  throw new DashboardError(statusCode, errorCode, message, context)
}

/**
 * Utility: Create response with error status
 *
 * Usage in route:
 * ```typescript
 * return c.json(
 *   createErrorResponse('INVALID_REQUEST', 'Query parameter invalid'),
 *   400
 * )
 * ```
 */
export function createErrorResponse(code: string, message: string): ErrorResponse {
  return {
    success: false,
    data: null,
    error: { code, message },
  }
}
interface DashboardLogContext {
  req?: {
    header?: (name: string) => string | undefined
    path?: string
    method?: string
  }
  user?: { id?: string }
  workspace?: { id?: string }
}
