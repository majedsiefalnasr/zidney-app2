/**
 * Idempotency Service
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Ensures provisioning is idempotent: same job_id always returns same result.
 * Handles retry scenarios without creating duplicate workspaces.
 *
 * Checks:
 * 1. Is there already a registry entry for this license?
 * 2. Is the license already ACTIVE?
 * 3. Are we reprocessing a failed job?
 */

import type { Logger } from '@zidney/logger'
import { ProvisioningErrorCode } from '@zidney/types/errors/provisioning-errors'
import type { Pool } from 'pg'

/**
 * Idempotency Check Result
 */
export interface IdempotencyCheckResult {
  isIdempotent: boolean
  alreadyProvisioned: boolean
  dbName?: string
  error?: ProvisioningErrorCode
  message?: string
}

/**
 * Idempotency Service
 */
export class IdempotencyService {
  private masterDb: Pool
  private logger?: Logger

  constructor(masterDb: Pool, logger?: Logger) {
    this.masterDb = masterDb
    this.logger = logger
  }

  /**
   * Check if workspace is already provisioned
   */
  async checkIdempotency(
    licenseId: string,
    workspaceSlug: string
  ): Promise<IdempotencyCheckResult> {
    try {
      // Query registry for existing entry
      const registryResult = await this.masterDb.query(
        `SELECT id, db_name FROM tenant_registry WHERE license_id = $1`,
        [licenseId]
      )

      if (registryResult.rows.length > 0) {
        const entry = registryResult.rows[0]
        this.logger?.logWarn('Idempotent retry detected', {
          license_id: licenseId,
          workspace_slug: workspaceSlug,
          existing_db_name: entry.db_name,
        })

        return {
          isIdempotent: true,
          alreadyProvisioned: true,
          dbName: entry.db_name,
        }
      }

      // Check license status
      const licenseResult = await this.masterDb.query(`SELECT status FROM licenses WHERE id = $1`, [
        licenseId,
      ])

      if (licenseResult.rows.length === 0) {
        return {
          isIdempotent: false,
          alreadyProvisioned: false,
          error: ProvisioningErrorCode.LICENSE_NOT_FOUND,
          message: `License ${licenseId} not found`,
        }
      }

      const license = licenseResult.rows[0]

      if (license.status === 'ACTIVE') {
        this.logger?.logWarn('License already active but no registry entry', {
          license_id: licenseId,
          status: license.status,
        })

        return {
          isIdempotent: true,
          alreadyProvisioned: true,
          error: ProvisioningErrorCode.ORPHAN_DATABASE_DETECTED,
          message: 'License is active but registry entry is missing (orphan database)',
        }
      }

      // Safe to proceed
      return {
        isIdempotent: false,
        alreadyProvisioned: false,
      }
    } catch (error) {
      this.logger?.logError(
        'Idempotency check failed',
        error instanceof Error ? error : new Error(String(error))
      )

      return {
        isIdempotent: false,
        alreadyProvisioned: false,
        error: ProvisioningErrorCode.INCONSISTENT_STATE,
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Check for orphan database (database exists but no registry entry)
   */
  async checkOrphanDatabase(dbName: string): Promise<boolean> {
    try {
      const result = await this.masterDb.query(`SELECT 1 FROM tenant_registry WHERE db_name = $1`, [
        dbName,
      ])

      return result.rows.length === 0
    } catch (_error) {
      this.logger?.logWarn('Failed to check for orphan database', {
        db_name: dbName,
      })
      return false
    }
  }
}

/**
 * Factory to create idempotency service
 */
export function createIdempotencyService(masterDb: Pool, logger?: Logger): IdempotencyService {
  return new IdempotencyService(masterDb, logger)
}
