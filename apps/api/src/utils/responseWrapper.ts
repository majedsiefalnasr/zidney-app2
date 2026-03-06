/**
 * API Response Wrapper Utility
 *
 * Provides standardized response formatting for all API endpoints.
 * Success: {success: true, data: {...}}
 * Error: {success: false, data: null, error: {...}}
 *
 * Stage: STAGE_09_PRODUCTS
 * Task: T032
 * Reference: docs/01_ENGINEERING_GOVERNANCE/09_ERROR_HANDLING_STANDARD.md
 */

import type { Context } from 'hono'

/**
 * Success API response
 */
export interface SuccessResponse<T = unknown> {
  success: true
  data: T
}

/**
 * Error API response
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
 * Generic API response union type
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number
  limit: number
  offset: number
  has_more: boolean
}

/**
 * List response with pagination
 */
export interface ListResponse<T> extends PaginationMeta {
  items: T[]
}

/**
 * Create success response
 */
export function successResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
  }
}

/**
 * Create error response
 */
export function errorResponse(
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
 * Create list response with pagination
 */
export function listResponse<T>(
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

/**
 * Send success response from Hono context
 */
export function sendSuccess<T>(c: Context, data: T, status: number = 200): Response {
  return c.json(successResponse(data), status as any)
}

/**
 * Send created response (201)
 */
export function sendCreated<T>(c: Context, data: T): Response {
  return c.json(successResponse(data), 201 as any)
}

/**
 * Send no content response (204)
 */
export function sendNoContent(c: Context): Response {
  return c.text('', 204 as any)
}

/**
 * Send error response from Hono context
 */
export function sendError(
  c: Context,
  code: string,
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
): Response {
  return c.json(errorResponse(code, message, details), status as any)
}

/**
 * Send list response with pagination
 */
export function sendList<T>(
  c: Context,
  items: T[],
  total: number,
  limit: number,
  offset: number,
  status: number = 200
): Response {
  const response = {
    success: true,
    data: listResponse(items, total, limit, offset),
  }
  return c.json(response, status as any)
}

/**
 * Type guards
 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is SuccessResponse<T> {
  return response.success === true && 'data' in response
}

export function isErrorResponse(response: ApiResponse): response is ErrorResponse {
  return response.success === false && 'error' in response
}
