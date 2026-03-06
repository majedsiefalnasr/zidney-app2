/**
 * License Error Code Registry
 *
 * File: apps/api/src/responses/license-error-codes.ts
 * Task: T009 – Create Error Mapping Utility & T032 – Create Error Code Registry
 *
 * All license-related error codes and their mappings.
 * Implements Clarification Q5: Granular error codes (10 total).
 *
 * Error codes:
 * - LICENSE_SOFT_LOCKED (423)
 * - LICENSE_ARCHIVED (403)
 * - LICENSE_DELETED (404)
 * - LICENSE_NOT_FOUND (404)
 * - LIMIT_EXCEEDED (402)
 * - SCHEMA_VERSION_MISMATCH (426)
 * - UPGRADE_REQUIRED (426)
 * - INVALID_STATE_TRANSITION (409)
 * - WORKSPACE_ALREADY_EXISTS (409)
 * - IDEMPOTENCY_CONFLICT (409)
 */

export interface LicenseErrorDefinition {
  code: string
  http_status: number
  message: string
  user_friendly_message: string
}

export const LICENSE_ERROR_CODES: Record<string, LicenseErrorDefinition> = {
  LICENSE_SOFT_LOCKED: {
    code: 'LICENSE_SOFT_LOCKED',
    http_status: 423,
    message: 'Workspace temporarily locked due to payment or compliance issue',
    user_friendly_message:
      'Workspace temporarily locked. Please renew your subscription to restore access.',
  },

  LICENSE_ARCHIVED: {
    code: 'LICENSE_ARCHIVED',
    http_status: 403,
    message: 'Workspace is archived and no longer accessible',
    user_friendly_message: 'Workspace is archived. Contact support to restore it.',
  },

  LICENSE_DELETED: {
    code: 'LICENSE_DELETED',
    http_status: 404,
    message: 'Workspace license has been deleted',
    user_friendly_message: 'Workspace no longer exists.',
  },

  LICENSE_NOT_FOUND: {
    code: 'LICENSE_NOT_FOUND',
    http_status: 404,
    message: 'No active license found for this workspace',
    user_friendly_message: 'Workspace license not found. Contact administrator.',
  },

  LIMIT_EXCEEDED: {
    code: 'LIMIT_EXCEEDED',
    http_status: 402,
    message: 'Student or staff enrollment limit has been reached',
    user_friendly_message: 'Enrollment limit reached. Upgrade your plan to add more users.',
  },

  SCHEMA_VERSION_MISMATCH: {
    code: 'SCHEMA_VERSION_MISMATCH',
    http_status: 426,
    message: 'Workspace schema version is incompatible with license',
    user_friendly_message: 'Workspace requires a schema upgrade. Contact administrator.',
  },

  UPGRADE_REQUIRED: {
    code: 'UPGRADE_REQUIRED',
    http_status: 426,
    message: 'Workspace license requires product upgrade',
    user_friendly_message: 'Workspace requires a product upgrade. Contact support.',
  },

  INVALID_STATE_TRANSITION: {
    code: 'INVALID_STATE_TRANSITION',
    http_status: 409,
    message: 'Invalid license state transition',
    user_friendly_message: 'Cannot transition license to requested state.',
  },

  WORKSPACE_ALREADY_EXISTS: {
    code: 'WORKSPACE_ALREADY_EXISTS',
    http_status: 409,
    message: 'Workspace with this slug already exists',
    user_friendly_message: 'Workspace slug is already in use. Please choose another.',
  },

  IDEMPOTENCY_CONFLICT: {
    code: 'IDEMPOTENCY_CONFLICT',
    http_status: 409,
    message: 'Retried request with different parameters',
    user_friendly_message: 'Request parameters do not match previous submission.',
  },
}

/**
 * Get error definition by code
 *
 * @param code - Error code
 * @returns Error definition or default if not found
 */
export function getErrorDefinition(code: string): LicenseErrorDefinition {
  return (
    LICENSE_ERROR_CODES[code] || {
      code: 'UNKNOWN_ERROR',
      http_status: 500,
      message: 'Unknown error occurred',
      user_friendly_message: 'An unexpected error occurred. Please try again.',
    }
  )
}

/**
 * Get HTTP status for error code
 *
 * @param code - Error code
 * @returns HTTP status number
 */
export function getHttpStatus(code: string): number {
  return getErrorDefinition(code).http_status
}

/**
 * Get user-friendly message for error code
 *
 * @param code - Error code
 * @returns User-friendly message
 */
export function getUserFriendlyMessage(code: string): string {
  return getErrorDefinition(code).user_friendly_message
}
