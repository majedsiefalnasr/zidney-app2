/**
 * License State Types
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Defines all license states and transitions during provisioning lifecycle.
 *
 * State Machine:
 *
 * PENDING_PROVISION (initial)
 *        ↓
 *     [Worker processing]
 *        ↓
 *     ACTIVE (success)
 *     or
 *     PROVISION_FAILED (failure)
 *        ↓
 *     [Operator retry or manual intervention]
 *        ↓
 *     ACTIVE or SOFT_LOCKED (if broken)
 */

/**
 * License Status Enum
 *
 * PENDING_PROVISION:
 *   - Initial state when license is created
 *   - Job enqueued to provisioning queue
 *   - API access blocked (423 Locked response)
 *   - Workspace database does not yet exist
 *
 * ACTIVE:
 *   - Provisioning completed successfully
 *   - Workspace database created and initialized
 *   - Registry entry exists
 *   - API access allowed (200 OK)
 *   - All tenant operations proceed normally
 *
 * PROVISION_FAILED:
 *   - Provisioning failed after retries exhausted
 *   - Worker set last_provision_error with details
 *   - Workspace database may be partially created
 *   - API access blocked (503 Service Unavailable)
 *   - Operator must investigate and retry or fix
 *   - Can transition back to PENDING_PROVISION if cleared
 *   - Can transition to SOFT_LOCKED if unrecoverable
 *
 * SOFT_LOCKED: (not part of provisioning, but mentioned for completeness)
 *   - License is valid but not accessible
 *   - Indicates operator intervention required
 *   - API access blocked (423 Locked)
 */
export enum LicenseStatus {
  // Provisioning workflow states
  PENDING_PROVISION = 'PENDING_PROVISION',
  ACTIVE = 'ACTIVE',
  PROVISION_FAILED = 'PROVISION_FAILED',

  // Other states (from broader platform model)
  SOFT_LOCKED = 'SOFT_LOCKED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

/**
 * License Metadata
 * Complete snapshot of license at creation time.
 */
export interface LicenseMetadata {
  licenseId: string
  workspaceSlug: string
  organizationName: string
  status: LicenseStatus
  schemaVersion: string
  productVersion: string
  createdAt: string // ISO 8601
  provisioned_at: string | null
  failedAt: string | null
  retryCount: number
  lastProvisionError: string | null
}

/**
 * State Transition validator
 * Ensures only valid license state transitions occur.
 */
export const VALID_TRANSITIONS: Record<LicenseStatus, LicenseStatus[]> = {
  [LicenseStatus.PENDING_PROVISION]: [
    LicenseStatus.ACTIVE,
    LicenseStatus.PROVISION_FAILED,
    LicenseStatus.SOFT_LOCKED,
  ],
  [LicenseStatus.ACTIVE]: [LicenseStatus.SOFT_LOCKED, LicenseStatus.ARCHIVED],
  [LicenseStatus.PROVISION_FAILED]: [
    LicenseStatus.PENDING_PROVISION, // Retry
    LicenseStatus.SOFT_LOCKED,
  ],
  [LicenseStatus.SOFT_LOCKED]: [LicenseStatus.ACTIVE, LicenseStatus.ARCHIVED],
  [LicenseStatus.ARCHIVED]: [LicenseStatus.DELETED],
  [LicenseStatus.DELETED]: [], // Terminal state
}

/**
 * HTTP Response Status for License State
 * Mapping license state to appropriate HTTP status code.
 */
export function getLicenseHttpStatus(status: LicenseStatus): number {
  switch (status) {
    case LicenseStatus.ACTIVE:
      return 200 // OK
    case LicenseStatus.PENDING_PROVISION:
      return 423 // Locked - workspace not ready
    case LicenseStatus.PROVISION_FAILED:
      return 503 // Service Unavailable - provisioning failed
    case LicenseStatus.SOFT_LOCKED:
      return 423 // Locked - operator intervention required
    case LicenseStatus.ARCHIVED:
      return 403 // Forbidden - workspace archived
    case LicenseStatus.DELETED:
      return 404 // Not Found - workspace deleted
    default:
      return 500 // Internal Server Error - unknown state
  }
}

/**
 * Helper: Check if status allows API access
 */
export function isLicenseAccessible(status: LicenseStatus): boolean {
  return status === LicenseStatus.ACTIVE
}

/**
 * Helper: Check if status allows retry
 */
export function isLicenseRetryable(status: LicenseStatus): boolean {
  return status === LicenseStatus.PROVISION_FAILED
}

/**
 * Helper: Check if status is terminal (no further transitions)
 */
export function isLicenseTerminal(status: LicenseStatus): boolean {
  return status === LicenseStatus.DELETED
}

/**
 * Helper: Check if transition is valid
 */
export function isValidTransition(
  from: LicenseStatus,
  to: LicenseStatus
): boolean {
  const validTargets = VALID_TRANSITIONS[from]
  return validTargets.includes(to)
}

/**
 * Helper: Get user-friendly message for license status
 */
export function getLicenseStatusMessage(status: LicenseStatus): string {
  const messages: Record<LicenseStatus, string> = {
    [LicenseStatus.PENDING_PROVISION]:
      'Workspace is being provisioned. Please wait a few moments and refresh.',
    [LicenseStatus.ACTIVE]: 'Workspace is active and ready to use.',
    [LicenseStatus.PROVISION_FAILED]:
      'Workspace provisioning failed. Please contact support.',
    [LicenseStatus.SOFT_LOCKED]:
      'Workspace is temporarily locked. Please contact support.',
    [LicenseStatus.ARCHIVED]: 'Workspace has been archived.',
    [LicenseStatus.DELETED]: 'Workspace has been deleted.',
  }
  return messages[status] || 'Unknown workspace status.'
}

/**
 * Helper: Get retry guidance for license errors
 */
export function getRetryGuidance(
  status: LicenseStatus,
  _errorCode?: string
): {
  shouldRetry: boolean
  delaySeconds: number
  message: string
} {
  switch (status) {
    case LicenseStatus.PENDING_PROVISION:
      return {
        shouldRetry: true,
        delaySeconds: 5,
        message: 'Workspace is still provisioning. Retry in 5 seconds.',
      }
    case LicenseStatus.PROVISION_FAILED:
      return {
        shouldRetry: true,
        delaySeconds: 30,
        message: 'Provisioning failed. Retrying in 30 seconds...',
      }
    case LicenseStatus.SOFT_LOCKED:
      return {
        shouldRetry: false,
        delaySeconds: 0,
        message: 'Workspace is locked. Contact administrator to unlock.',
      }
    default:
      return {
        shouldRetry: false,
        delaySeconds: 0,
        message: 'Workspace cannot be accessed.',
      }
  }
}
