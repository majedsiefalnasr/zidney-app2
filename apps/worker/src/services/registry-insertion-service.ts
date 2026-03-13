/**
 * Registry Insertion Service
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Inserts workspace entry into master DB tenant registry.
 * Creates linkage: license_id → workspace_slug → db_name → schema_version
 *
 * This is the final confirmation that a workspace is provisioned.
 * If this fails, the workspace is orphaned (DB exists but not registered).
 */

import type { Pool } from 'pg'

/**
 * Registry Insertion Result
 */
export interface RegistryInsertionResult {
  success: boolean
  registryId?: string
  errorMessage?: string
  durationMs?: number
}

/**
 * Registry Insertion Service
 */
export class RegistryInsertionService {
  private masterDb: Pool
  private logger?: {
    logStep?: (step: string, msg: string, meta?: Record<string, unknown>) => void
    logError?: (msg: string, err?: Error, meta?: Record<string, unknown>) => void
  }

  constructor(
    masterDb: Pool,
    logger?: {
      logStep?: (step: string, msg: string, meta?: Record<string, unknown>) => void
      logError?: (msg: string, err?: Error, meta?: Record<string, unknown>) => void
    }
  ) {
    this.masterDb = masterDb
    this.logger = logger
  }

  /**
   * Insert workspace into registry
   */
  async insertRegistry(
    licenseId: string,
    workspaceSlug: string,
    dbName: string,
    schemaVersion: string
  ): Promise<RegistryInsertionResult> {
    const startTime = Date.now()

    try {
      const result = await this.masterDb.query(
        `INSERT INTO tenant_registry (license_id, workspace_slug, db_name, schema_version)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [licenseId, workspaceSlug, dbName, schemaVersion]
      )

      if (result.rows.length === 0) {
        throw new Error('Registry insertion returned no rows')
      }

      const registryId = result.rows[0].id

      this.logger?.logStep('registry-insert', 'Workspace registered', {
        registry_id: registryId,
        license_id: licenseId,
        workspace_slug: workspaceSlug,
        db_name: dbName,
      })

      return {
        success: true,
        registryId,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.logger?.logError(
        'Registry insertion failed',
        error instanceof Error ? error : new Error(errorMsg),
        {
          license_id: licenseId,
          workspace_slug: workspaceSlug,
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
 * Factory to create registry insertion service
 */
export function createRegistryInsertionService(
  masterDb: Pool,
  logger?: {
    logStep?: (step: string, msg: string, meta?: Record<string, unknown>) => void
    logError?: (msg: string, err?: Error, meta?: Record<string, unknown>) => void
  }
): RegistryInsertionService {
  return new RegistryInsertionService(masterDb, logger)
}
