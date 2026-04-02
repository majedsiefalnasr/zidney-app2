/**
 * Error Code Definitions
 *
 * File: packages/types/src/error-codes.ts
 * Task: T017
 * Phase: 3 - TypeScript Type Definitions
 *
 * Exports:
 * - MasterDBErrorCode - All possible error codes from master database layer
 * - ErrorResponse - Standard error response structure
 */

/**
 * Master Database Error Codes
 *
 * Organized by HTTP status code for REST API mapping
 */
export enum MasterDBErrorCode {
  // 400 Bad Request - Client error in request
  INVALID_REQUEST_BODY = 'INVALID_REQUEST_BODY',
  INVALID_VERSION_FORMAT = 'INVALID_VERSION_FORMAT',
  INVALID_WORKSPACE_SLUG_FORMAT = 'INVALID_WORKSPACE_SLUG_FORMAT',
  INVALID_EMAIL_FORMAT = 'INVALID_EMAIL_FORMAT',
  INVALID_DATABASE_HOST = 'INVALID_DATABASE_HOST',
  INVALID_DATABASE_PORT = 'INVALID_DATABASE_PORT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // 403 Forbidden - Insufficient permissions
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RBAC_DENIED = 'RBAC_DENIED',
  LICENSE_REQUIRED = 'LICENSE_REQUIRED',

  // 404 Not Found - Resource not found
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  LICENSE_NOT_FOUND = 'LICENSE_NOT_FOUND',
  TENANT_REGISTRY_NOT_FOUND = 'TENANT_REGISTRY_NOT_FOUND',
  MMC_USER_NOT_FOUND = 'MMC_USER_NOT_FOUND',
  WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',

  // 409 Conflict - Resource already exists or state conflict
  PRODUCT_SLUG_ALREADY_EXISTS = 'PRODUCT_SLUG_ALREADY_EXISTS',
  WORKSPACE_ALREADY_LICENSED = 'WORKSPACE_ALREADY_LICENSED',
  TENANT_ALREADY_EXISTS = 'TENANT_ALREADY_EXISTS',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  LICENSE_STATE_CONFLICT = 'LICENSE_STATE_CONFLICT',

  // 423 Locked - License is soft-locked
  LICENSE_SOFT_LOCKED = 'LICENSE_SOFT_LOCKED',
  WORKSPACE_SOFT_LOCKED = 'WORKSPACE_SOFT_LOCKED',

  // 426 Upgrade Required - Schema version mismatch
  SCHEMA_VERSION_MISMATCH = 'SCHEMA_VERSION_MISMATCH',
  SCHEMA_VERSION_TOO_OLD = 'SCHEMA_VERSION_TOO_OLD',
  PRODUCT_VERSION_INCOMPATIBLE = 'PRODUCT_VERSION_INCOMPATIBLE',

  // 500 Internal Server Error
  DATABASE_ERROR = 'DATABASE_ERROR',
  MIGRATION_FAILURE = 'MIGRATION_FAILURE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Auto-Selection Engine Error Codes (Stage 39)
 *
 * Tenant-scoped errors for the automatic question selection engine.
 * Used by auto-selection.service.ts and attempt start route.
 */
export enum AutoSelectionErrorCode {
  // 422 Unprocessable Entity — criteria configuration is invalid/insufficient
  INSUFFICIENT_POOL = 'AUTO_SELECTION_INSUFFICIENT_POOL',
  INVALID_CRITERIA = 'AUTO_SELECTION_INVALID_CRITERIA',
  OVERLAP_UNDERSIZED = 'AUTO_SELECTION_OVERLAP_UNDERSIZED',

  // 409 Conflict — duplicate or concurrency issue
  DUPLICATE_CONFLICT = 'AUTO_SELECTION_DUPLICATE_CONFLICT',

  // 500 Internal Server Error — unexpected failure during selection
  SELECTION_ABORTED = 'AUTO_SELECTION_SELECTION_ABORTED',

  // 409 Conflict — idempotency key already claimed with different payload
  IDEMPOTENCY_CONFLICT = 'ATTEMPT_START_IDEMPOTENCY_CONFLICT',
}

/**
 * HTTP status code mapping for AutoSelectionErrorCode
 */
export const AUTO_SELECTION_ERROR_HTTP_CODES: Record<AutoSelectionErrorCode, number> = {
  [AutoSelectionErrorCode.INSUFFICIENT_POOL]: 422,
  [AutoSelectionErrorCode.INVALID_CRITERIA]: 422,
  [AutoSelectionErrorCode.OVERLAP_UNDERSIZED]: 422,
  [AutoSelectionErrorCode.DUPLICATE_CONFLICT]: 409,
  [AutoSelectionErrorCode.SELECTION_ABORTED]: 500,
  [AutoSelectionErrorCode.IDEMPOTENCY_CONFLICT]: 409,
}

/**
 * Get HTTP status for auto-selection error code
 */
export function getAutoSelectionHTTPStatus(code: AutoSelectionErrorCode): number {
  return AUTO_SELECTION_ERROR_HTTP_CODES[code] ?? 500
}

/**
 * Standard error response structure
 *
 * Matches API envelope format:
 * {
 *   success: false,
 *   data: null,
 *   error: {
 *     code: MasterDBErrorCode,
 *     message: string
 *   }
 * }
 */
export interface ErrorResponse {
  code: MasterDBErrorCode
  message: string
  details?: Record<string, unknown> // Optional additional context
}

/**
 * HTTP status code for each error
 *
 * Maps error codes to HTTP response codes for REST API
 */
export const ERROR_HTTP_CODES: Record<MasterDBErrorCode, number> = {
  // 400 Bad Request
  [MasterDBErrorCode.INVALID_REQUEST_BODY]: 400,
  [MasterDBErrorCode.INVALID_VERSION_FORMAT]: 400,
  [MasterDBErrorCode.INVALID_WORKSPACE_SLUG_FORMAT]: 400,
  [MasterDBErrorCode.INVALID_EMAIL_FORMAT]: 400,
  [MasterDBErrorCode.INVALID_DATABASE_HOST]: 400,
  [MasterDBErrorCode.INVALID_DATABASE_PORT]: 400,
  [MasterDBErrorCode.MISSING_REQUIRED_FIELD]: 400,

  // 403 Forbidden
  [MasterDBErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [MasterDBErrorCode.RBAC_DENIED]: 403,
  [MasterDBErrorCode.LICENSE_REQUIRED]: 403,

  // 404 Not Found
  [MasterDBErrorCode.PRODUCT_NOT_FOUND]: 404,
  [MasterDBErrorCode.LICENSE_NOT_FOUND]: 404,
  [MasterDBErrorCode.TENANT_REGISTRY_NOT_FOUND]: 404,
  [MasterDBErrorCode.MMC_USER_NOT_FOUND]: 404,
  [MasterDBErrorCode.WORKSPACE_NOT_FOUND]: 404,

  // 409 Conflict
  [MasterDBErrorCode.PRODUCT_SLUG_ALREADY_EXISTS]: 409,
  [MasterDBErrorCode.WORKSPACE_ALREADY_LICENSED]: 409,
  [MasterDBErrorCode.TENANT_ALREADY_EXISTS]: 409,
  [MasterDBErrorCode.EMAIL_ALREADY_EXISTS]: 409,
  [MasterDBErrorCode.LICENSE_STATE_CONFLICT]: 409,

  // 423 Locked
  [MasterDBErrorCode.LICENSE_SOFT_LOCKED]: 423,
  [MasterDBErrorCode.WORKSPACE_SOFT_LOCKED]: 423,

  // 426 Upgrade Required
  [MasterDBErrorCode.SCHEMA_VERSION_MISMATCH]: 426,
  [MasterDBErrorCode.SCHEMA_VERSION_TOO_OLD]: 426,
  [MasterDBErrorCode.PRODUCT_VERSION_INCOMPATIBLE]: 426,

  // 500 Internal Server Error
  [MasterDBErrorCode.DATABASE_ERROR]: 500,
  [MasterDBErrorCode.MIGRATION_FAILURE]: 500,
  [MasterDBErrorCode.INTERNAL_ERROR]: 500,
}

/**
 * Get HTTP status code for error
 *
 * @example
 * getHTTPStatus(MasterDBErrorCode.LICENSE_NOT_FOUND) // 404
 */
export function getHTTPStatus(code: MasterDBErrorCode): number {
  return ERROR_HTTP_CODES[code] || 500
}

export default {
  MasterDBErrorCode,
  ERROR_HTTP_CODES,
  getHTTPStatus,
}
