/**
 * T057-T062: Error Handling & Response Formatting
 *
 * Standardized error response system for all API endpoints
 * - Consistent response format across all endpoints
 * - Error codes mapped to HTTP status codes
 * - Correlation IDs for tracing
 * - No stack traces exposed to client
 */

/**
 * T058: Error code enumeration
 */
export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  INVALID_JSON = 'INVALID_JSON',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  GONE = 'GONE',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Multi-tenancy & licensing
  WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',
  WORKSPACE_MISMATCH = 'WORKSPACE_MISMATCH',
  WORKSPACE_SOFT_LOCKED = 'WORKSPACE_SOFT_LOCKED',
  WORKSPACE_ARCHIVED = 'WORKSPACE_ARCHIVED',

  // Schema & versioning
  SCHEMA_VERSION_INCOMPATIBLE = 'SCHEMA_VERSION_INCOMPATIBLE',
  UPGRADE_REQUIRED = 'UPGRADE_REQUIRED',

  // Attempt-specific
  ATTEMPT_NOT_FOUND = 'ATTEMPT_NOT_FOUND',
  ATTEMPT_ALREADY_STARTED = 'ATTEMPT_ALREADY_STARTED',
  ATTEMPT_ALREADY_COMPLETED = 'ATTEMPT_ALREADY_COMPLETED',
  ATTEMPT_EXPIRED = 'ATTEMPT_EXPIRED',
  ATTEMPT_NOT_IN_PROGRESS = 'ATTEMPT_NOT_IN_PROGRESS',
  MISSING_IDEMPOTENCY_KEY = 'MISSING_IDEMPOTENCY_KEY',

  // WebSocket
  WEBSOCKET_AUTH_FAILED = 'WEBSOCKET_AUTH_FAILED',
  WEBSOCKET_CONNECTION_LIMIT = 'WEBSOCKET_CONNECTION_LIMIT',

  // Server errors (5xx)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GRADING_TIMEOUT = 'GRADING_TIMEOUT',
  DATABASE_ERROR = 'DATABASE_ERROR',
  REDIS_ERROR = 'REDIS_ERROR',
}

/**
 * T059: HTTP status code mapping
 */
export const ERROR_STATUS_CODES: Record<ErrorCode, number> = {
  // 400 Bad Request
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.INVALID_JSON]: 400,
  [ErrorCode.INVALID_PAYLOAD]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.PAYLOAD_TOO_LARGE]: 400,
  [ErrorCode.UNPROCESSABLE_ENTITY]: 422,

  // 401 Unauthorized
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.WEBSOCKET_AUTH_FAILED]: 401,

  // 403 Forbidden
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.WORKSPACE_MISMATCH]: 403,
  [ErrorCode.WORKSPACE_ARCHIVED]: 403,

  // 404 Not Found
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.WORKSPACE_NOT_FOUND]: 404,
  [ErrorCode.ATTEMPT_NOT_FOUND]: 404,

  // 409 Conflict
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.ATTEMPT_ALREADY_STARTED]: 409,
  [ErrorCode.ATTEMPT_ALREADY_COMPLETED]: 409,
  [ErrorCode.ATTEMPT_NOT_IN_PROGRESS]: 409,

  // 410 Gone
  [ErrorCode.GONE]: 410,
  [ErrorCode.ATTEMPT_EXPIRED]: 410,

  // 423 Locked (SOFT_LOCKED status)
  [ErrorCode.WORKSPACE_SOFT_LOCKED]: 423,

  // 426 Upgrade Required
  [ErrorCode.SCHEMA_VERSION_INCOMPATIBLE]: 426,
  [ErrorCode.UPGRADE_REQUIRED]: 426,

  // 429 Too Many Requests
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.WEBSOCKET_CONNECTION_LIMIT]: 429,

  // 500 Internal Server Error
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.REDIS_ERROR]: 500,
  [ErrorCode.MISSING_IDEMPOTENCY_KEY]: 400, // Actually client error

  // 503 Service Unavailable
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,

  // 504 Gateway Timeout
  [ErrorCode.GRADING_TIMEOUT]: 504,
}

/**
 * T057: Standardized error response
 */
export interface ErrorResponse {
  success: false
  data: null
  error: {
    code: ErrorCode
    message: string
    details?: Record<string, unknown>
  }
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
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
 * Get HTTP status code for error
 */
export function getStatusCode(code: ErrorCode): number {
  return ERROR_STATUS_CODES[code] || 500
}

/**
 * Format error message (remove sensitive info)
 */
export function formatErrorMessage(code: ErrorCode, message: string): string {
  // Remove any paths, IDs, or sensitive info
  const sensitivePattern = /\/[\w/-]+\.|:\d+/g
  const formatted = message.replace(sensitivePattern, '[redacted]')

  // For some errors, use generic messages
  if (code === ErrorCode.DATABASE_ERROR) {
    return 'Database error occurred. Please try again.'
  }

  if (code === ErrorCode.REDIS_ERROR) {
    return 'Service temporarily unavailable. Please try again.'
  }

  return formatted
}

/**
 * T060: Rate limit specific error with headers
 */
export interface RateLimitErrorDetails {
  limit: number
  window_seconds: number
  retry_after_seconds: number
}

export function createRateLimitError(
  limit: number,
  windowSeconds: number,
  retryAfterSeconds: number
): ErrorResponse {
  return {
    success: false,
    data: null,
    error: {
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Too many requests. Please try again later.',
      details: {
        limit,
        window_seconds: windowSeconds,
        retry_after_seconds: retryAfterSeconds,
      },
    },
  }
}

/**
 * T061: Schema version specific error
 */
export interface SchemaVersionErrorDetails {
  tenant_version: string
  app_version: string
  action: string
}

export function createSchemaVersionError(tenantVersion: string, appVersion: string): ErrorResponse {
  return {
    success: false,
    data: null,
    error: {
      code: ErrorCode.SCHEMA_VERSION_INCOMPATIBLE,
      message: 'Database schema version incompatible with application. Please upgrade.',
      details: {
        tenant_version: tenantVersion,
        app_version: appVersion,
        action: 'upgrade_database_schema',
      },
    },
  }
}

/**
 * Workspace soft-locked error
 */
export function createWorkspaceSoftLockedError(): ErrorResponse {
  return {
    success: false,
    data: null,
    error: {
      code: ErrorCode.WORKSPACE_SOFT_LOCKED,
      message: 'Workspace is temporarily locked. Please try again later.',
    },
  }
}

/**
 * Workspace archived error
 */
export function createWorkspaceArchivedError(): ErrorResponse {
  return {
    success: false,
    data: null,
    error: {
      code: ErrorCode.WORKSPACE_ARCHIVED,
      message: 'Workspace has been archived and is no longer accessible.',
    },
  }
}
