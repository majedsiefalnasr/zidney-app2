/**
 * License Domain Package Exports
 *
 * File: packages/domain-core/src/licenses/index.ts
 * Task: T001 (barrel export index)
 *
 * Centralizes all license domain exports for clean imports throughout the application.
 */

// Types
export * from './types'
export type {
  ArchiveRequest,
  AuditLogEntry,
  CreateLicenseRequest,
  DeleteRequest,
  EditLicenseRequest,
  License,
  LicenseStatus,
  ProvisioningJobPayload,
  RestoreRequest,
  RetryProvisioningRequest,
  SoftLockRequest,
  UnlockRequest,
} from './types'

// Constants
export * from './constants'
export {
  ACCESSIBLE_STATUSES,
  ALLOWED_STATE_TRANSITIONS,
  BLOCKED_STATUSES,
  DEFAULT_PAGE_SIZE,
  ErrorCode,
  ErrorCodeToHttpStatus,
  ErrorCodeToMessage,
  MAX_PAGE_SIZE,
  PROVISIONING_BACKOFF_MULTIPLIER,
  PROVISIONING_BASE_DELAY_MS,
  PROVISIONING_MAX_RETRIES,
  PROVISIONING_TIMEOUT_MS,
  SOFT_LOCK_DEFAULT_DAYS,
  SOFT_LOCK_MAX_DAYS,
  SOFT_LOCK_MIN_DAYS,
  SUPPORTED_LANGUAGES,
  WORKSPACE_SLUG_MAX_LENGTH,
  WORKSPACE_SLUG_MIN_LENGTH,
  WORKSPACE_SLUG_REGEX,
} from './constants'

// Errors
export * from './errors'
export {
  AuthenticationError,
  AuthorizationError,
  InvalidStateTransitionError,
  LicenseError,
  LicenseNotFoundError,
  LicenseValidationError,
  ProvisioningError,
  VersionMismatchError,
} from './errors'
