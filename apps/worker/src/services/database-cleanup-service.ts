/**
 * Database Cleanup Service
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Handles database cleanup and orphan detection.
 * Safely drops databases on provisioning failure.
 * Detects and cleans orphaned databases (registry missing).
 */

import { Pool } from 'pg'

/**
 * Cleanup result interface
 */
export interface DatabaseCleanupResult {
  success: boolean
  databaseDropped?: boolean
  orphanDetected?: boolean
  errorMessage?: string
  durationMs?: number
}

/**
 * Database Cleanup Service
 */
export class DatabaseCleanupService {
  private masterDb: Pool
  private logger?: any

  constructor(masterDb: Pool, logger?: any) {
    this.masterDb = masterDb
    this.logger = logger
  }

  /**
   * Drop database for failed provisioning
   */
  async dropDatabase(dbName: string): Promise<DatabaseCleanupResult> {
    const startTime = Date.now()

    try {
      // Terminate all existing connections to the database
      await this.masterDb.query(
        `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
         WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [dbName]
      )

      // Small delay to allow connections to close
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Drop the database
      await this.masterDb.query(`DROP DATABASE IF EXISTS "${dbName}"`)

      this.logger?.logDatabaseOperation('Database dropped', {
        database: dbName,
        durationMs: Date.now() - startTime,
      })

      return {
        success: true,
        databaseDropped: true,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.logger?.logError(
        'Database cleanup failed',
        error instanceof Error ? error : new Error(errorMsg),
        { database: dbName }
      )

      return {
        success: false,
        databaseDropped: false,
        errorMessage: errorMsg,
        durationMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Check for orphan databases - database exists but no registry entry
   */
  async detectOrphanedDatabases(): Promise<string[]> {
    try {
      // Get all databases matching workspace_* pattern
      const dbResult = await this.masterDb.query(
        `SELECT datname FROM pg_database
         WHERE datname LIKE 'workspace_%'`
      )

      const allWorkspaceDbs: string[] = dbResult.rows.map((row) => row.datname)

      // Get all registered databases from tenant_registry
      const regResult = await this.masterDb.query(
        `SELECT DISTINCT db_name FROM tenant_registry`
      )

      const registeredDbs = new Set(regResult.rows.map((row) => row.db_name))

      // Find orphans
      const orphans = allWorkspaceDbs.filter((db) => !registeredDbs.has(db))

      if (orphans.length > 0) {
        this.logger?.logWarn('Orphaned databases detected', {
          count: orphans.length,
          databases: orphans,
        })
      }

      return orphans
    } catch (error) {
      this.logger?.logError(
        'Orphan detection failed',
        error instanceof Error ? error : new Error(String(error))
      )
      return []
    }
  }

  /**
   * Clean up an orphaned database
   */
  async cleanupOrphan(dbName: string): Promise<DatabaseCleanupResult> {
    this.logger?.logStep('cleanup-orphan', 'Cleaning up orphaned database', {
      database: dbName,
    })

    return this.dropDatabase(dbName)
  }

  /**
   * Batch cleanup for multiple orphans
   */
  async cleanupMultipleOrphans(
    orphanDbs: string[]
  ): Promise<DatabaseCleanupResult> {
    const startTime = Date.now()
    const results: DatabaseCleanupResult[] = []

    for (const dbName of orphanDbs) {
      const result = await this.cleanupOrphan(dbName)
      results.push(result)
    }

    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    this.logger?.logStep(
      'cleanup-batch-complete',
      'Batch orphan cleanup completed',
      {
        total: orphanDbs.length,
        successful,
        failed,
        durationMs: Date.now() - startTime,
      }
    )

    return {
      success: failed === 0,
      databaseDropped: successful > 0,
      durationMs: Date.now() - startTime,
      errorMessage:
        failed > 0 ? `${failed} databases failed to clean` : undefined,
    }
  }
}

/**
 * Factory to create database cleanup service
 */
export function createDatabaseCleanupService(
  masterDb: Pool,
  logger?: any
): DatabaseCleanupService {
  return new DatabaseCleanupService(masterDb, logger)
}
