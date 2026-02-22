/**
 * API Response Types
 *
 * Standard response format for all Zidney API endpoints.
 * Follows error handling standard defined in docs/01_ENGINEERING_GOVERNANCE/09_ERROR_HANDLING_STANDARD.md
 *
 * Format:
 * Success: {success: true, data: {...}}
 * Error: {success: false, data: null, error: {code, message}}
 */

/**
 * Success API response
 * Used for successful operations
 */
export interface SuccessResponse<T = unknown> {
  success: true
  data: T
}

/**
 * Error details
 */
export interface ErrorDetails {
  code: string // Machine-readable error code (e.g., 'DUPLICATE_SLUG', 'UNAUTHORIZED')
  message: string // Human-readable error message
  details?: Record<string, unknown> // Optional additional details
}

/**
 * Error API response
 * Used for failed operations
 */
export interface ErrorResponse {
  success: false
  data: null
  error: ErrorDetails
}

/**
 * Generic API response union type
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse

/**
 * Type guard to check if response is success
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is SuccessResponse<T> {
  return response.success === true && 'data' in response
}

/**
 * Type guard to check if response is error
 */
export function isErrorResponse(
  response: ApiResponse
): response is ErrorResponse {
  return response.success === false && 'error' in response
}

/**
 * Create a success response
 */
export function createSuccessResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
  }
}

/**
 * Create an error response
 */
export function createErrorResponse(
  code: string,
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
 * Paginated list response
 */
export interface ListResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

/**
 * Create a paginated list response
 */
export function createListResponse<T>(
  items: T[],
  total: number,
  limit: number,
  offset: number
): ListResponse<T> {
  return {
    items,
    total,
    limit,
    offset,
    has_more: offset + items.length < total,
  }
}
