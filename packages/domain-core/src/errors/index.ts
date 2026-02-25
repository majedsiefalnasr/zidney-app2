/**
 * Error Response Standardization Utility
 *
 * File: packages/domain-core/src/errors/index.ts
 * Task: T010
 * Phase: 2 - Infrastructure & Middleware
 *
 * Standard error response structure for all API endpoints.
 * All API responses follow: { success: boolean, data: T | null, error: { code: string, message: string } | null }
 *
 * Properties:
 * - Consistent structure across all endpoints
 * - Machine-readable error codes for client handling
 * - Optional additional context
 * - Type-safe via generics
 */

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
  timestamp?: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data: T | null
  error: ApiError | null
}

/**
 * Create a successful API response
 */
export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
  }
}

/**
 * Create an error API response
 */
export function errorResponse<T = never>(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  data?: T | null
): ApiResponse<T> {
  return {
    success: false,
    data: data ?? null,
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    },
  }
}

/**
 * Predefined error codes
 */
export enum ErrorCode {
  // Client errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  SESSION_INVALID = 'SESSION_INVALID',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_VERSION_MISMATCH = 'TOKEN_VERSION_MISMATCH',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Business logic errors
  DUPLICATE_USERNAME = 'DUPLICATE_USERNAME',
  DUPLICATE_EMAIL = 'DUPLICATE_EMAIL',
  INVALID_ROLE = 'INVALID_ROLE',
  ROLE_HAS_MEMBERS = 'ROLE_HAS_MEMBERS',
  MEMBER_DISABLED = 'MEMBER_DISABLED',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  INVITATION_EXPIRED = 'INVITATION_EXPIRED',
  INVITATION_NOT_FOUND = 'INVITATION_NOT_FOUND',
  INVITATION_ALREADY_USED = 'INVITATION_ALREADY_USED',
}

/**
 * HTTP status code mapping for error codes
 */
export function getStatusCodeForError(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.INVALID_REQUEST:
    case ErrorCode.INVALID_PASSWORD:
    case ErrorCode.INVALID_ROLE:
      return 400
    case ErrorCode.AUTHENTICATION_FAILED:
    case ErrorCode.SESSION_INVALID:
    case ErrorCode.TOKEN_EXPIRED:
    case ErrorCode.TOKEN_VERSION_MISMATCH:
    case ErrorCode.MEMBER_DISABLED:
      return 401
    case ErrorCode.PERMISSION_DENIED:
      return 403
    case ErrorCode.NOT_FOUND:
    case ErrorCode.INVITATION_NOT_FOUND:
      return 404
    case ErrorCode.CONFLICT:
    case ErrorCode.DUPLICATE_USERNAME:
    case ErrorCode.DUPLICATE_EMAIL:
    case ErrorCode.ROLE_HAS_MEMBERS:
    case ErrorCode.INVITATION_ALREADY_USED:
      return 409
    case ErrorCode.RATE_LIMITED:
      return 429
    case ErrorCode.INTERNAL_ERROR:
    case ErrorCode.DATABASE_ERROR:
    case ErrorCode.SERVICE_UNAVAILABLE:
      return 500
    case ErrorCode.INVITATION_EXPIRED:
      return 401 // Expired invitations require re-sending
    default:
      return 500
  }
}

/**
 * Application-level error class
 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }

  toResponse<T = never>(): ApiResponse<T> {
    return errorResponse(this.code, this.message, this.details)
  }
}
