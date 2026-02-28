/**
 * Workspace Settings — Custom Error Classes
 *
 * File: apps/api/src/modules/workspace-settings/workspace-settings.errors.ts
 * Stage: 018_WORKSPACE_SETTINGS
 * Date: 2026-02-28
 *
 * Domain-specific errors for workspace settings operations.
 * All errors produce the standard Zidney response shape:
 * { success: false, data: null, error: { code, message } }
 *
 * Constitutional Compliance:
 * ✓ Consistent error format per AGENTS.md
 * ✓ HTTP status mapped per error type
 * ✓ No sensitive data in error messages
 */

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

export const WorkspaceSettingsErrorCode = {
  SETTINGS_VALIDATION_FAILED: 'SETTINGS_VALIDATION_FAILED',
  SETTINGS_VERSION_CONFLICT: 'SETTINGS_VERSION_CONFLICT',
  SETTINGS_NOT_FOUND: 'SETTINGS_NOT_FOUND',
  ENCRYPTION_SERVICE_UNAVAILABLE: 'ENCRYPTION_SERVICE_UNAVAILABLE',
  INVALID_SETTINGS_GROUP: 'INVALID_SETTINGS_GROUP',
} as const

export type WorkspaceSettingsErrorCode =
  (typeof WorkspaceSettingsErrorCode)[keyof typeof WorkspaceSettingsErrorCode]

// ---------------------------------------------------------------------------
// HTTP Status Code Mapping
// ---------------------------------------------------------------------------

export const SETTINGS_ERROR_STATUS: Record<WorkspaceSettingsErrorCode, number> =
  {
    [WorkspaceSettingsErrorCode.SETTINGS_VALIDATION_FAILED]: 422,
    [WorkspaceSettingsErrorCode.SETTINGS_VERSION_CONFLICT]: 409,
    [WorkspaceSettingsErrorCode.SETTINGS_NOT_FOUND]: 404,
    [WorkspaceSettingsErrorCode.ENCRYPTION_SERVICE_UNAVAILABLE]: 503,
    [WorkspaceSettingsErrorCode.INVALID_SETTINGS_GROUP]: 400,
  }

// ---------------------------------------------------------------------------
// Base Error
// ---------------------------------------------------------------------------

export class WorkspaceSettingsError extends Error {
  public readonly code: WorkspaceSettingsErrorCode
  public readonly statusCode: number
  public readonly details?: Record<string, unknown>

  constructor(
    code: WorkspaceSettingsErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'WorkspaceSettingsError'
    this.code = code
    this.statusCode = SETTINGS_ERROR_STATUS[code]
    this.details = details
  }

  /** Format error as standard API response shape */
  toResponse() {
    return {
      success: false as const,
      data: null,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    }
  }
}

// ---------------------------------------------------------------------------
// Specific Error Classes
// ---------------------------------------------------------------------------

/** HTTP 422 — Validation failure with field-level details */
export class SettingsValidationError extends WorkspaceSettingsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      WorkspaceSettingsErrorCode.SETTINGS_VALIDATION_FAILED,
      message,
      details
    )
    this.name = 'SettingsValidationError'
  }
}

/** HTTP 409 — Optimistic locking conflict (stale config_version) */
export class SettingsVersionConflictError extends WorkspaceSettingsError {
  public readonly currentVersion: number

  constructor(currentVersion: number) {
    super(
      WorkspaceSettingsErrorCode.SETTINGS_VERSION_CONFLICT,
      `Settings have been modified by another user. Current version: ${currentVersion}. Please refresh and retry.`,
      { current_version: currentVersion }
    )
    this.name = 'SettingsVersionConflictError'
    this.currentVersion = currentVersion
  }
}

/** HTTP 404 — No settings row exists */
export class SettingsNotFoundError extends WorkspaceSettingsError {
  constructor() {
    super(
      WorkspaceSettingsErrorCode.SETTINGS_NOT_FOUND,
      'Workspace settings have not been initialized.'
    )
    this.name = 'SettingsNotFoundError'
  }
}

/** HTTP 503 — Encryption key missing or crypto module failure */
export class EncryptionServiceUnavailableError extends WorkspaceSettingsError {
  constructor(
    message = 'Unable to process payment credentials. Please try again later.'
  ) {
    super(WorkspaceSettingsErrorCode.ENCRYPTION_SERVICE_UNAVAILABLE, message)
    this.name = 'EncryptionServiceUnavailableError'
  }
}

/** HTTP 400 — Unknown group in path parameter */
export class InvalidSettingsGroupError extends WorkspaceSettingsError {
  constructor(group: string) {
    super(
      WorkspaceSettingsErrorCode.INVALID_SETTINGS_GROUP,
      `Invalid settings group: '${group}'. Allowed: general, language, branding, payment, security.`
    )
    this.name = 'InvalidSettingsGroupError'
  }
}
