/**
 * API Response Envelope Types
 *
 * File: packages/types/src/api-response.ts
 * Task: T018
 * Phase: 3 - TypeScript Type Definitions
 *
 * Exports:
 * - APIResponse<T> - Generic API response envelope
 * - APISuccessResponse<T> - Success response
 * - APIErrorResponse - Error response
 *
 * All API endpoints must return this structure
 */

import type { MasterDBErrorCode } from './error-codes'

/**
 * Standard error object in response
 */
export interface APIError {
  code: MasterDBErrorCode
  message: string
}

/**
 * Generic API response envelope
 *
 * All HTTP responses from APIs must follow this structure:
 * {
 *   success: true,
 *   data: { ... },
 *   error: null
 * }
 * OR
 * {
 *   success: false,
 *   data: null,
 *   error: {
 *     code: "ERROR_CODE",
 *     message: "Human readable message"
 *   }
 * }
 */
export interface APIResponse<T = unknown> {
  success: boolean
  data: T | null
  error: APIError | null
}

/**
 * Success response (convenience type)
 *
 * @example
 * const response: APISuccessResponse<User> = {
 *   success: true,
 *   data: { id: '123', email: 'user@example.com' },
 *   error: null
 * };
 */
export interface APISuccessResponse<T = unknown> extends APIResponse<T> {
  success: true
  data: T
  error: null
}

/**
 * Error response (convenience type)
 *
 * @example
 * const response: APIErrorResponse = {
 *   success: false,
 *   data: null,
 *   error: {
 *     code: MasterDBErrorCode.USER_NOT_FOUND,
 *     message: 'User not found'
 *   }
 * };
 */
export interface APIErrorResponse extends APIResponse<null> {
  success: false
  data: null
  error: APIError
}

/**
 * Factory function to create success response
 *
 * @example
 * return createSuccessResponse({ id: '123', name: 'Product' });
 */
export function createSuccessResponse<T>(data: T): APISuccessResponse<T> {
  return {
    success: true,
    data,
    error: null,
  }
}

/**
 * Factory function to create error response
 *
 * @example
 * return createErrorResponse(
 *   MasterDBErrorCode.PRODUCT_NOT_FOUND,
 *   'Product with ID 123 not found'
 * );
 */
export function createErrorResponse(code: MasterDBErrorCode, message: string): APIErrorResponse {
  return {
    success: false,
    data: null,
    error: { code, message },
  }
}

/**
 * Type guard to check if response is success
 *
 * @example
 * if (isSuccessResponse(response)) {
 *   console.log(response.data); // TypeScript knows this is T, not null
 * }
 */
export function isSuccessResponse<T>(response: APIResponse<T>): response is APISuccessResponse<T> {
  return response.success === true && response.data !== null && response.error === null
}

/**
 * Type guard to check if response is error
 *
 * @example
 * if (isErrorResponse(response)) {
 *   console.log(response.error.code); // TypeScript knows this is APIError
 * }
 */
export function isErrorResponse(response: APIResponse): response is APIErrorResponse {
  return response.success === false && response.data === null && response.error !== null
}

export default {
  createSuccessResponse,
  createErrorResponse,
  isSuccessResponse,
  isErrorResponse,
}
