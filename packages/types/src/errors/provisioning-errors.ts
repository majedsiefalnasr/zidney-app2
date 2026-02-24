/**
 * Provisioning Error Codes
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Centralized error code registry for all provisioning operations.
 * All errors follow RFC 7807 Problem Details format.
 *
 * Error codes are mapped to HTTP status codes:
 * - 4xx for client errors (validation, conflicts, auth)
 * - 5xx for server errors (database, worker, infrastructure)
 *
 * Correlation ID included in all error responses for debugging.
 */

export enum ProvisioningErrorCode {
  // Validation Errors (400)
  INVALID_WORKSPACE_SLUG = 'INVALID_WORKSPACE_SLUG',
  INVALID_ADMIN_EMAIL = 'INVALID_ADMIN_EMAIL',
  INVALID_LIMIT = 'INVALID_LIMIT',
  INVALID_PRODUCT_ID = 'INVALID_PRODUCT_ID',
  INVALID_LICENSE_CONFIG = 'INVALID_LICENSE_CONFIG',

  // Conflict Errors (409)
  WORKSPACE_SLUG_EXISTS = 'WORKSPACE_SLUG_EXISTS',
  LICENSE_ALREADY_ACTIVE = 'LICENSE_ALREADY_ACTIVE',

  // Authentication/Authorization Errors (401, 403)
  UNAUTHORIZED_SERVICE = 'UNAUTHORIZED_SERVICE',
  INVALID_LICENSE_STATE_FOR_OPERATION = 'INVALID_LICENSE_STATE_FOR_OPERATION',

  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Not Found (404)
  LICENSE_NOT_FOUND = 'LICENSE_NOT_FOUND',
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',

  // Lock/Concurrency Errors (503)
  LOCK_TIMEOUT = 'LOCK_TIMEOUT',
  LOCK_ACQUISITION_FAILED = 'LOCK_ACQUISITION_FAILED',

  // License Validation Errors (400, 500)
  LICENSE_VALIDATION_FAILED = 'LICENSE_VALIDATION_FAILED',

  // Database Errors (500, 503)
  DB_CREATE_FAILED = 'DB_CREATE_FAILED',
  DB_CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
  REGISTRY_INSERT_FAILED = 'REGISTRY_INSERT_FAILED',
  PROVIDER_REQUEST_FAILED = 'PROVIDER_REQUEST_FAILED',

  // Migration Errors (500, 503)
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  MIGRATION_ROLLBACK_FAILED = 'MIGRATION_ROLLBACK_FAILED',

  // Provisioning Logic Errors (500, 503)
  SEED_FAILED = 'SEED_FAILED',
  ADMIN_ACCOUNT_CREATION_FAILED = 'ADMIN_ACCOUNT_CREATION_FAILED',
  LICENSE_ACTIVATION_FAILED = 'LICENSE_ACTIVATION_FAILED',

  // Operational Errors (503)
  PROVISION_FAILED = 'PROVISION_FAILED',
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',
  DATABASE_CLEANUP_FAILED = 'DATABASE_CLEANUP_FAILED',

  // Worker/Queue Errors (503)
  JOB_ENQUEUE_FAILED = 'JOB_ENQUEUE_FAILED',
  WORKER_UNAVAILABLE = 'WORKER_UNAVAILABLE',

  // Idempotency/State Errors (409, 503)
  DUPLICATE_PROVISION_REQUEST = 'DUPLICATE_PROVISION_REQUEST',
  ORPHAN_DATABASE_DETECTED = 'ORPHAN_DATABASE_DETECTED',
  INCONSISTENT_STATE = 'INCONSISTENT_STATE',
}

/**
 * Error Details Interface
 */
export interface ProvisioningError {
  code: ProvisioningErrorCode
  message: string
  httpStatus: number
  retryable: boolean
  details?: Record<string, string | number | boolean>
}

/**
 * Error Registry Mapping Error Code → HTTP Status + Metadata
 */
export const PROVISIONING_ERROR_REGISTRY: Record<
  ProvisioningErrorCode,
  ProvisioningError
> = {
  // Validation Errors (400 Bad Request)
  [ProvisioningErrorCode.INVALID_WORKSPACE_SLUG]: {
    code: ProvisioningErrorCode.INVALID_WORKSPACE_SLUG,
    message: 'Workspace slug does not match pattern or is too long/short',
    httpStatus: 400,
    retryable: false,
  },
  [ProvisioningErrorCode.INVALID_ADMIN_EMAIL]: {
    code: ProvisioningErrorCode.INVALID_ADMIN_EMAIL,
    message: 'Admin email does not match valid email format',
    httpStatus: 400,
    retryable: false,
  },
  [ProvisioningErrorCode.INVALID_LIMIT]: {
    code: ProvisioningErrorCode.INVALID_LIMIT,
    message: 'Student/staff limits must be positive integers',
    httpStatus: 400,
    retryable: false,
  },
  [ProvisioningErrorCode.INVALID_PRODUCT_ID]: {
    code: ProvisioningErrorCode.INVALID_PRODUCT_ID,
    message: 'Product ID does not reference existing product',
    httpStatus: 400,
    retryable: false,
  },

  // Conflict Errors (409 Conflict)
  [ProvisioningErrorCode.WORKSPACE_SLUG_EXISTS]: {
    code: ProvisioningErrorCode.WORKSPACE_SLUG_EXISTS,
    message: 'Workspace slug is already registered',
    httpStatus: 409,
    retryable: false,
  },
  [ProvisioningErrorCode.LICENSE_ALREADY_ACTIVE]: {
    code: ProvisioningErrorCode.LICENSE_ALREADY_ACTIVE,
    message: 'License is already provisioned and active',
    httpStatus: 409,
    retryable: false,
  },

  // Authentication/Authorization (401, 403)
  [ProvisioningErrorCode.UNAUTHORIZED_SERVICE]: {
    code: ProvisioningErrorCode.UNAUTHORIZED_SERVICE,
    message: 'Service token is invalid or expired',
    httpStatus: 401,
    retryable: false,
  },
  [ProvisioningErrorCode.INVALID_LICENSE_STATE_FOR_OPERATION]: {
    code: ProvisioningErrorCode.INVALID_LICENSE_STATE_FOR_OPERATION,
    message: 'License is not in a state that permits this operation',
    httpStatus: 403,
    retryable: false,
  },

  // Rate Limiting (429)
  [ProvisioningErrorCode.RATE_LIMIT_EXCEEDED]: {
    code: ProvisioningErrorCode.RATE_LIMIT_EXCEEDED,
    message: 'Too many requests; retry after delay',
    httpStatus: 429,
    retryable: true,
  },

  // Not Found (404)
  [ProvisioningErrorCode.LICENSE_NOT_FOUND]: {
    code: ProvisioningErrorCode.LICENSE_NOT_FOUND,
    message: 'License not found',
    httpStatus: 404,
    retryable: false,
  },
  [ProvisioningErrorCode.PRODUCT_NOT_FOUND]: {
    code: ProvisioningErrorCode.PRODUCT_NOT_FOUND,
    message: 'Product not found',
    httpStatus: 404,
    retryable: false,
  },

  // Lock/Concurrency (503)
  [ProvisioningErrorCode.LOCK_TIMEOUT]: {
    code: ProvisioningErrorCode.LOCK_TIMEOUT,
    message:
      'Provisioning lock acquisition timed out; another operation may be in progress',
    httpStatus: 503,
    retryable: true,
  },
  [ProvisioningErrorCode.LOCK_ACQUISITION_FAILED]: {
    code: ProvisioningErrorCode.LOCK_ACQUISITION_FAILED,
    message: 'Failed to acquire distributed provisioning lock',
    httpStatus: 503,
    retryable: true,
  },

  // Database Errors (500, 503)
  [ProvisioningErrorCode.DB_CREATE_FAILED]: {
    code: ProvisioningErrorCode.DB_CREATE_FAILED,
    message: 'Failed to create tenant database',
    httpStatus: 503,
    retryable: true,
  },
  [ProvisioningErrorCode.DB_CONNECTION_FAILED]: {
    code: ProvisioningErrorCode.DB_CONNECTION_FAILED,
    message: 'Failed to connect to database',
    httpStatus: 503,
    retryable: true,
  },
  [ProvisioningErrorCode.REGISTRY_INSERT_FAILED]: {
    code: ProvisioningErrorCode.REGISTRY_INSERT_FAILED,
    message: 'Failed to insert registry entry for workspace',
    httpStatus: 503,
    retryable: true,
  },

  // Migration Errors (500, 503)
  [ProvisioningErrorCode.MIGRATION_FAILED]: {
    code: ProvisioningErrorCode.MIGRATION_FAILED,
    message: 'Database migration failed; check migration SQL syntax',
    httpStatus: 503,
    retryable: true,
  },
  [ProvisioningErrorCode.MIGRATION_ROLLBACK_FAILED]: {
    code: ProvisioningErrorCode.MIGRATION_ROLLBACK_FAILED,
    message:
      'Migration failed and rollback also failed; manual intervention required',
    httpStatus: 500,
    retryable: false,
  },

  // Provisioning Logic (500, 503)
  [ProvisioningErrorCode.SEED_FAILED]: {
    code: ProvisioningErrorCode.SEED_FAILED,
    message: 'Seed data insertion failed',
    httpStatus: 503,
    retryable: true,
  },
  [ProvisioningErrorCode.ADMIN_ACCOUNT_CREATION_FAILED]: {
    code: ProvisioningErrorCode.ADMIN_ACCOUNT_CREATION_FAILED,
    message: 'Failed to create initial admin account',
    httpStatus: 503,
    retryable: true,
  },
  [ProvisioningErrorCode.LICENSE_ACTIVATION_FAILED]: {
    code: ProvisioningErrorCode.LICENSE_ACTIVATION_FAILED,
    message: 'Failed to activate license after provisioning',
    httpStatus: 503,
    retryable: true,
  },

  // Operational Errors (503)
  [ProvisioningErrorCode.PROVISION_FAILED]: {
    code: ProvisioningErrorCode.PROVISION_FAILED,
    message: 'Provisioning failed; check logs for details',
    httpStatus: 503,
    retryable: true,
  },
  [ProvisioningErrorCode.RETRY_EXHAUSTED]: {
    code: ProvisioningErrorCode.RETRY_EXHAUSTED,
    message:
      'Provisioning failed after max retries; operator intervention required',
    httpStatus: 503,
    retryable: false,
  },
  [ProvisioningErrorCode.DATABASE_CLEANUP_FAILED]: {
    code: ProvisioningErrorCode.DATABASE_CLEANUP_FAILED,
    message: 'Failed to clean up database after provisioning failure',
    httpStatus: 500,
    retryable: false,
  },

  // Worker/Queue (503)
  [ProvisioningErrorCode.JOB_ENQUEUE_FAILED]: {
    code: ProvisioningErrorCode.JOB_ENQUEUE_FAILED,
    message: 'Failed to enqueue provisioning job; queue may be unavailable',
    httpStatus: 503,
    retryable: true,
  },
  [ProvisioningErrorCode.WORKER_UNAVAILABLE]: {
    code: ProvisioningErrorCode.WORKER_UNAVAILABLE,
    message: 'Provisioning worker is unavailable',
    httpStatus: 503,
    retryable: true,
  },

  // Idempotency/State (409, 503)
  [ProvisioningErrorCode.DUPLICATE_PROVISION_REQUEST]: {
    code: ProvisioningErrorCode.DUPLICATE_PROVISION_REQUEST,
    message: 'Duplicate provision request detected; returning cached response',
    httpStatus: 409,
    retryable: false,
  },
  [ProvisioningErrorCode.ORPHAN_DATABASE_DETECTED]: {
    code: ProvisioningErrorCode.ORPHAN_DATABASE_DETECTED,
    message: 'Orphan database detected; operator intervention required',
    httpStatus: 500,
    retryable: false,
  },
  [ProvisioningErrorCode.INCONSISTENT_STATE]: {
    code: ProvisioningErrorCode.INCONSISTENT_STATE,
    message: 'Workspace state is inconsistent; operator intervention required',
    httpStatus: 500,
    retryable: false,
  },
}

/**
 * Helper: Get error details by code
 */
export function getErrorDetails(
  code: ProvisioningErrorCode
): ProvisioningError {
  return (
    PROVISIONING_ERROR_REGISTRY[code] || {
      code: ProvisioningErrorCode.PROVISION_FAILED,
      message: 'Unknown provisioning error',
      httpStatus: 500,
      retryable: true,
    }
  )
}

/**
 * Helper: Create error with correlation ID
 */
export function createProvisioningError(
  code: ProvisioningErrorCode,
  details?: Record<string, string | number | boolean>,
  correlationId?: string
) {
  return {
    ...getErrorDetails(code),
    details: {
      ...details,
      correlationId: correlationId || 'unknown',
    },
  }
}
