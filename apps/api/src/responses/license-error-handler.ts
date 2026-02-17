/**
 * License Error Handler
 *
 * File: apps/api/src/responses/license-error-handler.ts
 * Task: T009 – Create Error Mapping Utility
 *
 * Converts license errors to standard response contract.
 * All errors follow standard format: {success: false, data: null, error: {code, message}}
 */

import { getErrorDefinition } from './license-error-codes'

/**
 * Standard error response format (for all Zidney APIs)
 */
export interface StandardErrorResponse {
  success: false
  data: null
  error: {
    code: string
    message: string
  }
}

/**
 * Convert license error to standard response
 *
 * @param error_code - License error code (e.g., LICENSE_SOFT_LOCKED)
 * @returns Standard error response object
 */
export function toLicenseError(error_code: string): StandardErrorResponse {
  const errorDef = getErrorDefinition(error_code)

  return {
    success: false,
    data: null,
    error: {
      code: errorDef.code,
      message: errorDef.user_friendly_message,
    },
  }
}

/**
 * Create license error response with HTTP status
 *
 * @param error_code - License error code
 * @returns {response, status} tuple for use with ctx.json(response, {status})
 */
export function createLicenseErrorResponse(error_code: string): {
  response: StandardErrorResponse
  status: number
} {
  const errorDef = getErrorDefinition(error_code)

  return {
    response: toLicenseError(error_code),
    status: errorDef.http_status,
  }
}
