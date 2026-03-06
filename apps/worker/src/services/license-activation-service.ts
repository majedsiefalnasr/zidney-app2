/**
 * License Activation Service
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Transitions license from PENDING_PROVISION to ACTIVE status.
 * Sets provisioned_at timestamp.
 * Marks workspace as ready for use.
 *
 * This is the final success marker for provisioning.
 */

import type { Pool } from 'pg'

/**
 * License Activation Result
 */
export interface LicenseActivationResult {
  success: boolean
  timestamp?: string
  errorMessage?: string
  durationMs?: number
}

/**
 * License Activation Service
 */
export class LicenseActivationService {
  private masterDb: Pool
  private logger?: any

  constructor(masterDb: Pool, logger?: any) {
    this.masterDb = masterDb
    this.logger = logger
  }

  /**
   * Activate license (transition to ACTIVE)
   */
  async activateLicense(licenseId: string): Promise<LicenseActivationResult> {
    const startTime = Date.now()

    try {
      const provisioned_at = new Date().toISOString()

      const result = await this.masterDb.query(
        `UPDATE licenses
         SET status = 'ACTIVE',
             provisioned_at = $1,
             failed_at = NULL,
             last_provision_error = NULL
         WHERE id = $2
         RETURNING id, status, provisioned_at`,
        [provisioned_at, licenseId]
      )

      if (result.rowCount === 0) {
        throw new Error(`License ${licenseId} not found`)
      }

      this.logger?.logSuccess('License activated', Date.now() - startTime, {
        license_id: licenseId,
        status: 'ACTIVE',
        provisioned_at,
      })

      return {
        success: true,
        timestamp: provisioned_at,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.logger?.logError(
        'License activation failed',
        error instanceof Error ? error : new Error(errorMsg),
        {
          license_id: licenseId,
        }
      )

      return {
        success: false,
        errorMessage: errorMsg,
        durationMs: Date.now() - startTime,
      }
    }
  }
}

/**
 * Factory to create license activation service
 */
export function createLicenseActivationService(
  masterDb: Pool,
  logger?: any
): LicenseActivationService {
  return new LicenseActivationService(masterDb, logger)
}

/**
 * Failure Handler Service
 * Handles provisioning failures, marks license as PROVISION_FAILED.
 */
export class FailureHandlerService {
  private masterDb: Pool
  private logger?: any

  constructor(masterDb: Pool, logger?: any) {
    this.masterDb = masterDb
    this.logger = logger
  }

  /**
   * Mark license as provisioning failed
   */
  async markFailed(licenseId: string, errorCode: string, errorMessage: string): Promise<boolean> {
    try {
      const failed_at = new Date().toISOString()

      const result = await this.masterDb.query(
        `UPDATE licenses
         SET status = 'PROVISION_FAILED',
             failed_at = $1,
             last_provision_error = $2,
             retry_count = retry_count + 1
         WHERE id = $3
         RETURNING id, status, retry_count`,
        [failed_at, `${errorCode}: ${errorMessage}`.substring(0, 1024), licenseId]
      )

      if (result.rowCount === 0) {
        this.logger?.logWarn('License not found for failure update', {
          license_id: licenseId,
        })
        return false
      }

      this.logger?.logStep('license-failed', 'License marked as provisioning failed', {
        license_id: licenseId,
        error_code: errorCode,
        status: 'PROVISION_FAILED',
        retry_count: result.rows[0].retry_count,
      })

      return true
    } catch (error) {
      this.logger?.logError(
        'Failure handler failed',
        error instanceof Error ? error : new Error(String(error))
      )
      return false
    }
  }
}

/**
 * Factory to create failure handler
 */
export function createFailureHandlerService(masterDb: Pool, logger?: any): FailureHandlerService {
  return new FailureHandlerService(masterDb, logger)
}
