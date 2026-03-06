/**
 * License Domain Constants & Error Codes
 *
 * File: packages/domain-core/src/licenses/constants.ts
 * Task: T003
 *
 * Defines error codes, status constants, and validation rules.
 */

import { LicenseStatus } from './types'

/**
 * Error Code Categories
 */
export enum ErrorCode {
  // Validation Errors (400)
  INVALID_SLUG_FORMAT = 'INVALID_SLUG_FORMAT',
  SLUG_NOT_UNIQUE = 'SLUG_NOT_UNIQUE',
  INVALID_PRODUCT_ID = 'INVALID_PRODUCT_ID',
  INVALID_LIMIT = 'INVALID_LIMIT',
  INVALID_LANGUAGE = 'INVALID_LANGUAGE',
  INVALID_FIELD_EDIT = 'INVALID_FIELD_EDIT',
  INVALID_COMMISSION = 'INVALID_COMMISSION',

  // State Transition Errors (400)
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  RETRY_LIMIT_EXCEEDED = 'RETRY_LIMIT_EXCEEDED',
  RATE_LIMITED = 'RATE_LIMITED',

  // Authentication Errors (401)
  AUTH_MISSING = 'AUTH_MISSING',
  AUTH_INVALID = 'AUTH_INVALID',

  // Authorization Errors (403)
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  LICENSE_SOFT_LOCKED = 'LICENSE_SOFT_LOCKED',
  LICENSE_ARCHIVED = 'LICENSE_ARCHIVED',

  // Not Found Errors (404)
  LICENSE_NOT_FOUND = 'LICENSE_NOT_FOUND',
  WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',

  // Upgrade Required (426)
  SCHEMA_VERSION_MISMATCH = 'SCHEMA_VERSION_MISMATCH',
  PRODUCT_VERSION_MISMATCH = 'PRODUCT_VERSION_MISMATCH',

  // Service Unavailable (503)
  PROVISIONING_QUEUE_UNAVAILABLE = 'PROVISIONING_QUEUE_UNAVAILABLE',
  PROVISIONING_FAILED = 'PROVISIONING_FAILED',
  LICENSE_PENDING_PROVISION = 'LICENSE_PENDING_PROVISION',
  DATABASE_ERROR = 'DATABASE_ERROR',

  // Generic
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * HTTP Status Code Mapping
 */
export const ErrorCodeToHttpStatus: Record<ErrorCode, number> = {
  // 400 Bad Request
  [ErrorCode.INVALID_SLUG_FORMAT]: 400,
  [ErrorCode.SLUG_NOT_UNIQUE]: 400,
  [ErrorCode.INVALID_PRODUCT_ID]: 400,
  [ErrorCode.INVALID_LIMIT]: 400,
  [ErrorCode.INVALID_LANGUAGE]: 400,
  [ErrorCode.INVALID_FIELD_EDIT]: 400,
  [ErrorCode.INVALID_COMMISSION]: 400,
  [ErrorCode.INVALID_STATE_TRANSITION]: 400,
  [ErrorCode.RETRY_LIMIT_EXCEEDED]: 400,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.VALIDATION_ERROR]: 400,

  // 401 Unauthorized
  [ErrorCode.AUTH_MISSING]: 401,
  [ErrorCode.AUTH_INVALID]: 401,

  // 403 Forbidden
  [ErrorCode.PERMISSION_DENIED]: 403,
  [ErrorCode.LICENSE_SOFT_LOCKED]: 403,
  [ErrorCode.LICENSE_ARCHIVED]: 403,

  // 404 Not Found
  [ErrorCode.LICENSE_NOT_FOUND]: 404,
  [ErrorCode.WORKSPACE_NOT_FOUND]: 404,

  // 426 Upgrade Required
  [ErrorCode.SCHEMA_VERSION_MISMATCH]: 426,
  [ErrorCode.PRODUCT_VERSION_MISMATCH]: 426,

  // 503 Service Unavailable
  [ErrorCode.PROVISIONING_QUEUE_UNAVAILABLE]: 503,
  [ErrorCode.PROVISIONING_FAILED]: 503,
  [ErrorCode.LICENSE_PENDING_PROVISION]: 503,
  [ErrorCode.DATABASE_ERROR]: 500,

  // Generic
  [ErrorCode.INTERNAL_ERROR]: 500,
}

/**
 * Error Code to Message Mapping
 */
export const ErrorCodeToMessage: Record<ErrorCode, string> = {
  [ErrorCode.INVALID_SLUG_FORMAT]:
    'Workspace slug must be 3-64 characters, lowercase letters, numbers, and dashes only',
  [ErrorCode.SLUG_NOT_UNIQUE]: 'Workspace slug already exists',
  [ErrorCode.INVALID_PRODUCT_ID]: 'Product not found or not active',
  [ErrorCode.INVALID_LIMIT]: 'Student and staff limits must be >= 0 or null',
  [ErrorCode.INVALID_LANGUAGE]: 'Invalid language code',
  [ErrorCode.INVALID_FIELD_EDIT]:
    'Cannot edit immutable fields (product_id, workspace_slug, schema_version, product_version)',
  [ErrorCode.INVALID_COMMISSION]: 'Commission per user must be >= 0',
  [ErrorCode.INVALID_STATE_TRANSITION]: 'Invalid license state transition',
  [ErrorCode.RETRY_LIMIT_EXCEEDED]: 'Maximum retry limit exceeded',
  [ErrorCode.RATE_LIMITED]: 'Too many requests. Please try again later',
  [ErrorCode.AUTH_MISSING]: 'Missing authentication credentials',
  [ErrorCode.AUTH_INVALID]: 'Invalid authentication credentials',
  [ErrorCode.PERMISSION_DENIED]: 'Insufficient permissions',
  [ErrorCode.LICENSE_SOFT_LOCKED]: 'License is soft-locked. Access denied',
  [ErrorCode.LICENSE_ARCHIVED]: 'License is archived. Access denied',
  [ErrorCode.LICENSE_NOT_FOUND]: 'License not found',
  [ErrorCode.WORKSPACE_NOT_FOUND]: 'Workspace not found',
  [ErrorCode.SCHEMA_VERSION_MISMATCH]: 'Schema version mismatch. Upgrade required',
  [ErrorCode.PRODUCT_VERSION_MISMATCH]: 'Product version mismatch. Upgrade required',
  [ErrorCode.PROVISIONING_QUEUE_UNAVAILABLE]: 'Provisioning service unavailable',
  [ErrorCode.PROVISIONING_FAILED]: 'Provisioning failed',
  [ErrorCode.LICENSE_PENDING_PROVISION]: 'License provisioning in progress',
  [ErrorCode.DATABASE_ERROR]: 'Database error',
  [ErrorCode.VALIDATION_ERROR]: 'Validation error',
  [ErrorCode.INTERNAL_ERROR]: 'Internal server error',
}

/**
 * Valid ISO 639-1 Language Codes
 */
export const SUPPORTED_LANGUAGES = [
  'en', // English
  'ar', // Arabic
  'fr', // French
  'de', // German
  'es', // Spanish
  'pt', // Portuguese
  'ru', // Russian
  'zh', // Chinese
  'ja', // Japanese
  'ko', // Korean
]

/**
 * Workspace Slug Validation Rules
 */
export const WORKSPACE_SLUG_REGEX = /^[a-z0-9-]+$/
export const WORKSPACE_SLUG_MIN_LENGTH = 3
export const WORKSPACE_SLUG_MAX_LENGTH = 64

/**
 * License Status Transition Validation
 *
 * Define which status transitions are allowed
 */
export const ALLOWED_STATE_TRANSITIONS: Record<LicenseStatus, LicenseStatus[]> = {
  [LicenseStatus.PENDING_PROVISION]: [LicenseStatus.ACTIVE, LicenseStatus.PROVISION_FAILED],
  [LicenseStatus.ACTIVE]: [LicenseStatus.SOFT_LOCKED, LicenseStatus.DELETED],
  [LicenseStatus.SOFT_LOCKED]: [LicenseStatus.ACTIVE, LicenseStatus.ARCHIVED],
  [LicenseStatus.PROVISION_FAILED]: [LicenseStatus.PENDING_PROVISION],
  [LicenseStatus.ARCHIVED]: [LicenseStatus.ACTIVE, LicenseStatus.DELETED],
  [LicenseStatus.DELETED]: [],
}

/**
 * License Status with Accessible Workspace
 *
 * Statuses that allow workspace access
 */
export const ACCESSIBLE_STATUSES = [LicenseStatus.ACTIVE]

/**
 * License Status with Blocked Workspace
 *
 * Statuses that block workspace access
 */
export const BLOCKED_STATUSES = [
  LicenseStatus.SOFT_LOCKED,
  LicenseStatus.ARCHIVED,
  LicenseStatus.DELETED,
]

/**
 * Provisioning Retry Configuration
 */
export const PROVISIONING_MAX_RETRIES = 5
export const PROVISIONING_BASE_DELAY_MS = 2000 // 2 seconds
export const PROVISIONING_TIMEOUT_MS = 1800000 // 30 minutes
export const PROVISIONING_BACKOFF_MULTIPLIER = 2

/**
 * Soft Lock Configuration
 */
export const SOFT_LOCK_DEFAULT_DAYS = 90
export const SOFT_LOCK_MIN_DAYS = 1
export const SOFT_LOCK_MAX_DAYS = 365

/**
 * Pagination Defaults
 */
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100
export const DEFAULT_PAGE = 1

/**
 * API Response Format Constants
 */
export const HTTP_STATUS_CREATED = 201
export const HTTP_STATUS_OK = 200
export const HTTP_STATUS_NO_CONTENT = 204

/**
 * Correlation ID Header Names
 */
export const CORRELATION_ID_HEADERS = ['x-correlation-id', 'x-request-id', 'correlation-id']
