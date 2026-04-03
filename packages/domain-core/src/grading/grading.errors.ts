/**
 * Grading Errors
 *
 * File: packages/domain-core/src/grading/grading.errors.ts
 * Stage: STAGE_40_GRADING_CORE
 *
 * Error codes, mappings, and error class for grading failures.
 * Based on error-handling-patterns skill.
 */

import type { APIErrorResponse } from '@zidney/types'
import { MasterDBErrorCode } from '@zidney/types'

/**
 * Grading-specific error codes
 */
export const GRADING_ERROR_CODES = {
  ATTEMPT_NOT_FOUND: 'GRADING_ATTEMPT_NOT_FOUND',
  ATTEMPT_ALREADY_GRADED: 'GRADING_ATTEMPT_ALREADY_GRADED',
  INVALID_QUESTION_RESPONSE: 'GRADING_INVALID_QUESTION_RESPONSE',
  CONFIG_SNAPSHOT_CORRUPTED: 'GRADING_CONFIG_SNAPSHOT_CORRUPTED',
  QUESTION_SNAPSHOT_MISSING: 'GRADING_QUESTION_SNAPSHOT_MISSING',
  GRADING_ENGINE_ERROR: 'GRADING_ENGINE_ERROR',
  WORKSPACE_ISOLATION_VIOLATION: 'GRADING_WORKSPACE_ISOLATION_VIOLATION',
} as const

export type GradingErrorCode = (typeof GRADING_ERROR_CODES)[keyof typeof GRADING_ERROR_CODES]

/**
 * HTTP status code mapping for grading errors
 */
export const GRADING_ERROR_HTTP_STATUS_MAP: Record<GradingErrorCode, number> = {
  [GRADING_ERROR_CODES.ATTEMPT_NOT_FOUND]: 404,
  [GRADING_ERROR_CODES.ATTEMPT_ALREADY_GRADED]: 409,
  [GRADING_ERROR_CODES.INVALID_QUESTION_RESPONSE]: 400,
  [GRADING_ERROR_CODES.CONFIG_SNAPSHOT_CORRUPTED]: 422,
  [GRADING_ERROR_CODES.QUESTION_SNAPSHOT_MISSING]: 500,
  [GRADING_ERROR_CODES.GRADING_ENGINE_ERROR]: 500,
  [GRADING_ERROR_CODES.WORKSPACE_ISOLATION_VIOLATION]: 403,
}

/**
 * Human-readable error messages for grading errors
 */
export const GRADING_ERROR_MESSAGES: Record<GradingErrorCode, string> = {
  [GRADING_ERROR_CODES.ATTEMPT_NOT_FOUND]: 'Attempt not found.',
  [GRADING_ERROR_CODES.ATTEMPT_ALREADY_GRADED]: 'Attempt has already been graded.',
  [GRADING_ERROR_CODES.INVALID_QUESTION_RESPONSE]: 'Invalid response provided for question.',
  [GRADING_ERROR_CODES.CONFIG_SNAPSHOT_CORRUPTED]:
    'Grading configuration snapshot is invalid or corrupted.',
  [GRADING_ERROR_CODES.QUESTION_SNAPSHOT_MISSING]:
    'Required question snapshot is missing from attempt.',
  [GRADING_ERROR_CODES.GRADING_ENGINE_ERROR]: 'An internal grading engine error occurred.',
  [GRADING_ERROR_CODES.WORKSPACE_ISOLATION_VIOLATION]: 'Workspace isolation violation detected.',
}

/**
 * Map grading-specific error codes to master database error codes.
 * Translates domain-layer error codes to platform-wide error codes.
 */
export function mapGradingErrorToMasterCode(code: GradingErrorCode): MasterDBErrorCode {
  // Map grading errors to closest matching master error codes by HTTP status
  switch (code) {
    case GRADING_ERROR_CODES.ATTEMPT_NOT_FOUND:
      return MasterDBErrorCode.PRODUCT_NOT_FOUND // 404
    case GRADING_ERROR_CODES.ATTEMPT_ALREADY_GRADED:
      return MasterDBErrorCode.LICENSE_STATE_CONFLICT // 409 Conflict
    case GRADING_ERROR_CODES.INVALID_QUESTION_RESPONSE:
      return MasterDBErrorCode.INVALID_REQUEST_BODY // 400
    case GRADING_ERROR_CODES.CONFIG_SNAPSHOT_CORRUPTED:
      return MasterDBErrorCode.DATABASE_ERROR // 500
    case GRADING_ERROR_CODES.QUESTION_SNAPSHOT_MISSING:
      return MasterDBErrorCode.DATABASE_ERROR // 500
    case GRADING_ERROR_CODES.GRADING_ENGINE_ERROR:
      return MasterDBErrorCode.INTERNAL_ERROR // 500
    case GRADING_ERROR_CODES.WORKSPACE_ISOLATION_VIOLATION:
      return MasterDBErrorCode.RBAC_DENIED // 403
    default:
      return MasterDBErrorCode.INTERNAL_ERROR
  }
}

/**
 * GradingError class extending platform error contract
 */
export class GradingError extends Error {
  code: GradingErrorCode
  httpStatus: number
  details?: Record<string, unknown>

  constructor(code: GradingErrorCode, message?: string, details?: Record<string, unknown>) {
    const finalMessage = message || GRADING_ERROR_MESSAGES[code]
    super(finalMessage)
    this.name = 'GradingError'
    this.code = code
    this.httpStatus = GRADING_ERROR_HTTP_STATUS_MAP[code]
    this.details = details
  }

  /**
   * Convert to API error response format
   */
  toErrorResponse(): APIErrorResponse {
    return {
      success: false,
      data: null,
      error: {
        code: mapGradingErrorToMasterCode(this.code),
        message: this.message,
      },
    }
  }
}
