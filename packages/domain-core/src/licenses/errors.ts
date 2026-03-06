/**
 * License Domain Custom Error Classes
 *
 * File: packages/domain-core/src/licenses/errors.ts
 * Task: T004
 *
 * Extends base error classes with license-specific context.
 */

import { ErrorCode, ErrorCodeToHttpStatus, ErrorCodeToMessage } from './constants'

/**
 * Base class for all license-related errors
 */
export class LicenseError extends Error {
  constructor(
    public code: ErrorCode,
    public httpStatus: number,
    message?: string
  ) {
    super(message || ErrorCodeToMessage[code])
    this.name = 'LicenseError'
  }

  /**
   * Get sanitized message for API response
   * (no internal implementation details)
   */
  public getSanitizedMessage(): string {
    return ErrorCodeToMessage[this.code]
  }

  /**
   * Convert to API error response format (RFC 7807)
   */
  public toResponse() {
    return {
      success: false,
      data: null,
      error: {
        code: this.code,
        message: this.getSanitizedMessage(),
        status: this.httpStatus,
      },
    }
  }
}

/**
 * Validation Error
 *
 * Thrown when license data fails validation
 * (slug format, limits, etc.)
 */
export class LicenseValidationError extends LicenseError {
  constructor(code: ErrorCode, message?: string) {
    const httpStatus = ErrorCodeToHttpStatus[code] || 400
    super(code, httpStatus, message)
    this.name = 'LicenseValidationError'
  }

  static invalidSlugFormat(): LicenseValidationError {
    return new LicenseValidationError(
      ErrorCode.INVALID_SLUG_FORMAT,
      'Workspace slug must be 3-64 characters, lowercase letters, numbers, and dashes only'
    )
  }

  static slugNotUnique(): LicenseValidationError {
    return new LicenseValidationError(ErrorCode.SLUG_NOT_UNIQUE, 'Workspace slug already exists')
  }

  static invalidProductId(): LicenseValidationError {
    return new LicenseValidationError(
      ErrorCode.INVALID_PRODUCT_ID,
      'Product not found or not active'
    )
  }

  static invalidLimit(): LicenseValidationError {
    return new LicenseValidationError(
      ErrorCode.INVALID_LIMIT,
      'Student and staff limits must be >= 0 or null'
    )
  }

  static invalidLanguage(): LicenseValidationError {
    return new LicenseValidationError(ErrorCode.INVALID_LANGUAGE, 'Invalid language code')
  }

  static invalidCommission(): LicenseValidationError {
    return new LicenseValidationError(
      ErrorCode.INVALID_COMMISSION,
      'Commission per user must be >= 0'
    )
  }

  static invalidFieldEdit(): LicenseValidationError {
    return new LicenseValidationError(
      ErrorCode.INVALID_FIELD_EDIT,
      'Cannot edit immutable fields (product_id, workspace_slug, schema_version, product_version)'
    )
  }
}

/**
 * License Not Found Error
 *
 * Thrown when requesting a license that doesn't exist
 */
export class LicenseNotFoundError extends LicenseError {
  constructor(licenseId?: string) {
    super(
      ErrorCode.LICENSE_NOT_FOUND,
      404,
      licenseId ? `License ${licenseId} not found` : 'License not found'
    )
    this.name = 'LicenseNotFoundError'
  }
}

/**
 * Invalid State Transition Error
 *
 * Thrown when attempting an invalid license status transition
 * (e.g., trying to unlock a license that's not soft-locked)
 */
export class InvalidStateTransitionError extends LicenseError {
  constructor(fromStatus: string, toStatus: string) {
    super(
      ErrorCode.INVALID_STATE_TRANSITION,
      400,
      `Cannot transition from ${fromStatus} to ${toStatus}`
    )
    this.name = 'InvalidStateTransitionError'
  }

  static softLockFromNonActive(): InvalidStateTransitionError {
    return new InvalidStateTransitionError('non-ACTIVE', 'SOFT_LOCKED')
  }

  static unlockFromNonSoftLocked(): InvalidStateTransitionError {
    return new InvalidStateTransitionError('non-SOFT_LOCKED', 'ACTIVE')
  }

  static archiveFromNonSoftLocked(): InvalidStateTransitionError {
    return new InvalidStateTransitionError('non-SOFT_LOCKED', 'ARCHIVED')
  }

  static restoreFromNonArchived(): InvalidStateTransitionError {
    return new InvalidStateTransitionError('non-ARCHIVED', 'ACTIVE')
  }

  static retryFromNonProvisionFailed(): InvalidStateTransitionError {
    return new InvalidStateTransitionError('non-PROVISION_FAILED', 'PENDING_PROVISION')
  }
}

/**
 * Provisioning Error
 *
 * Thrown when provisioning operations fail
 */
export class ProvisioningError extends LicenseError {
  constructor(message: string, code: ErrorCode = ErrorCode.PROVISIONING_FAILED) {
    const httpStatus = ErrorCodeToHttpStatus[code] || 503
    super(code, httpStatus, message)
    this.name = 'ProvisioningError'
  }

  static queueUnavailable(): ProvisioningError {
    return new ProvisioningError(
      'Provisioning queue unavailable',
      ErrorCode.PROVISIONING_QUEUE_UNAVAILABLE
    )
  }

  static licensePendingProvisioning(): ProvisioningError {
    return new ProvisioningError(
      'License provisioning in progress',
      ErrorCode.LICENSE_PENDING_PROVISION
    )
  }

  static retryLimitExceeded(): ProvisioningError {
    const error = new ProvisioningError(
      'Maximum retry limit exceeded',
      ErrorCode.RETRY_LIMIT_EXCEEDED
    )
    error.httpStatus = 400
    return error
  }

  static rateLimited(): ProvisioningError {
    const error = new ProvisioningError(
      'Too many requests. Please try again later',
      ErrorCode.RATE_LIMITED
    )
    error.httpStatus = 429
    return error
  }
}

/**
 * Authorization Error
 *
 * Thrown when user lacks permission for operation
 */
export class AuthorizationError extends LicenseError {
  constructor(message: string = 'Insufficient permissions') {
    super(ErrorCode.PERMISSION_DENIED, 403, message)
    this.name = 'AuthorizationError'
  }

  static licenseSoftLocked(): AuthorizationError {
    return new AuthorizationError('License is soft-locked. Access denied')
  }

  static licenseArchived(): AuthorizationError {
    return new AuthorizationError('License is archived. Access denied')
  }
}

/**
 * Authentication Error
 *
 * Thrown when authentication fails
 */
export class AuthenticationError extends LicenseError {
  constructor(code: ErrorCode = ErrorCode.AUTH_MISSING, message?: string) {
    const httpStatus = ErrorCodeToHttpStatus[code]
    super(code, httpStatus, message)
    this.name = 'AuthenticationError'
  }

  static missing(): AuthenticationError {
    return new AuthenticationError(ErrorCode.AUTH_MISSING, 'Missing authentication credentials')
  }

  static invalid(): AuthenticationError {
    return new AuthenticationError(ErrorCode.AUTH_INVALID, 'Invalid authentication credentials')
  }
}

/**
 * Version Mismatch Error
 *
 * Thrown when schema or product versions are incompatible
 */
export class VersionMismatchError extends LicenseError {
  constructor(code: ErrorCode, message: string) {
    super(code, 426, message)
    this.name = 'VersionMismatchError'
  }

  static schema(): VersionMismatchError {
    return new VersionMismatchError(
      ErrorCode.SCHEMA_VERSION_MISMATCH,
      'Schema version mismatch. Upgrade required'
    )
  }

  static product(): VersionMismatchError {
    return new VersionMismatchError(
      ErrorCode.PRODUCT_VERSION_MISMATCH,
      'Product version mismatch. Upgrade required'
    )
  }
}
