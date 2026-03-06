/**
 * RollbackManager - Handle cleanup on provisioning failures
 * Task: T020 – Implement rollback procedures (database cleanup)
 * Phase: 01 – Platform Foundation
 * Stage: STAGE_05_TENANT_PROVISIONING_SERVICE
 */

import type { Pool } from 'pg'
import { LogLevel, StructuredLogger } from './ErrorHandling'

export interface RollbackContext {
  job_id: string
  license_id: number
  workspace_slug: string
  correlation_id: string
  failed_step: number
  error: Error | string
}

/**
 * RollbackManager: Handles safe cleanup on provisioning failures
 */
export class RollbackManager {
  private master_pool: Pool
  private logger: StructuredLogger

  constructor(master_pool: Pool, logger?: StructuredLogger) {
    this.master_pool = master_pool
    this.logger = logger || new StructuredLogger('provisioning-rollback', '1.0.0', LogLevel.INFO)
  }

  /**
   * Execute full rollback for failed provisioning
   */
  async rollbackProvisioning(context: RollbackContext): Promise<{
    success: boolean
    actions_taken: string[]
    errors: string[]
  }> {
    const actions_taken: string[] = []
    const errors: string[] = []

    this.logger.warn('Provisioning rollback initiated', {
      correlation_id: context.correlation_id,
      workspace_slug: context.workspace_slug,
      details: { failed_step: context.failed_step, job_id: context.job_id },
    })

    try {
      // Step 1: Drop tenant database (if created)
      if (context.failed_step >= 3) {
        try {
          await this.dropTenantDatabase(context.workspace_slug)
          actions_taken.push('Database dropped')
        } catch (error) {
          errors.push(`Failed to drop database: ${error}`)
          this.logger.error(
            'Database drop failed',
            error instanceof Error ? error : String(error),
            {
              correlation_id: context.correlation_id,
              workspace_slug: context.workspace_slug,
            }
          )
        }
      }

      // Step 2: Delete registry entry (if created)
      if (context.failed_step >= 6) {
        try {
          await this.cleanupRegistry(context.license_id)
          actions_taken.push('Registry entry deleted')
        } catch (error) {
          errors.push(`Failed to delete registry entry: ${error}`)
          this.logger.error(
            'Registry cleanup failed',
            error instanceof Error ? error : String(error),
            {
              correlation_id: context.correlation_id,
              workspace_slug: context.workspace_slug,
            }
          )
        }
      }

      // Step 3: Mark license as FAILED
      try {
        await this.resetLicenseToFailed(context.license_id, context.error)
        actions_taken.push('License marked as FAILED')
      } catch (error) {
        errors.push(`Failed to mark license as FAILED: ${error}`)
        this.logger.error('License reset failed', error instanceof Error ? error : String(error), {
          correlation_id: context.correlation_id,
        })
      }

      // Log completion
      this.logger.info('Provisioning rollback completed', {
        correlation_id: context.correlation_id,
        workspace_slug: context.workspace_slug,
        details: {
          actions_taken,
          errors: errors.length,
        },
      })

      return {
        success: errors.length === 0,
        actions_taken,
        errors,
      }
    } catch (error) {
      this.logger.error(
        'Rollback process failed critically',
        error instanceof Error ? error : String(error),
        {
          correlation_id: context.correlation_id,
          workspace_slug: context.workspace_slug,
        }
      )

      return {
        success: false,
        actions_taken,
        errors: [
          ...errors,
          `Rollback process failed: ${typeof error === 'string' ? error : (error as Error).message}`,
        ],
      }
    }
  }

  /**
   * Drop tenant database
   */
  private async dropTenantDatabase(workspace_slug: string): Promise<void> {
    const client = await this.master_pool.connect()
    try {
      const db_name = `workspace_${workspace_slug}`

      // Terminate all connections to the database
      await client.query(
        `
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE datname = $1
      `,
        [db_name]
      )

      // Drop the database
      await client.query(`DROP DATABASE IF EXISTS ${db_name}`)

      this.logger.debug('Database dropped', {
        workspace_slug,
        details: { db_name },
      })
    } catch (error) {
      throw new Error(`Failed to drop database workspace_${workspace_slug}: ${error}`)
    } finally {
      client.release()
    }
  }

  /**
   * Delete registry entry
   */
  private async cleanupRegistry(license_id: number): Promise<void> {
    const client = await this.master_pool.connect()
    try {
      await client.query(`DELETE FROM tenants_registry WHERE license_id = $1`, [license_id])

      this.logger.debug('Registry entry deleted', {
        details: { license_id },
      })
    } catch (error) {
      throw new Error(`Failed to delete registry entry for license ${license_id}: ${error}`)
    } finally {
      client.release()
    }
  }

  /**
   * Mark license as FAILED
   */
  private async resetLicenseToFailed(license_id: number, error: Error | string): Promise<void> {
    const client = await this.master_pool.connect()
    try {
      const error_str = typeof error === 'string' ? error : error.message

      await client.query(
        `
        UPDATE licenses
        SET status = 'FAILED', updated_at = NOW()
        WHERE id = $1
        `,
        [license_id]
      )

      this.logger.debug('License marked as FAILED', {
        details: {
          license_id,
          error: error_str.substring(0, 100), // Truncate error for logging
        },
      })
    } catch (error) {
      throw new Error(`Failed to mark license ${license_id} as FAILED: ${error}`)
    } finally {
      client.release()
    }
  }

  /**
   * Safe force-cleanup (for manual intervention)
   */
  async forceCleanup(workspace_slug: string, license_id: number): Promise<void> {
    const client = await this.master_pool.connect()
    try {
      // Force delete from registry
      await client.query(`DELETE FROM tenants_registry WHERE license_id = $1`, [license_id])

      // Force mark license as FAILED
      await client.query(
        `UPDATE licenses SET status = 'FAILED', updated_at = NOW() WHERE id = $1`,
        [license_id]
      )

      this.logger.warn('Force cleanup executed', {
        workspace_slug,
        details: { license_id },
      })
    } catch (error) {
      this.logger.error('Force cleanup failed', error instanceof Error ? error : String(error), {
        workspace_slug,
        details: { license_id },
      })
      throw error
    } finally {
      client.release()
    }
  }
}

export default RollbackManager
