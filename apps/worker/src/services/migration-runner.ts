/**
 * Migration Runner Service
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Executes baseline migrations on tenant database.
 * Migrations are applied in transaction: all-or-nothing.
 * Tracks applied versions to prevent re-application.
 *
 * Migration files:
 * - baseline_001_schema_versions.sql
 * - baseline_002_roles.sql
 * - baseline_003_permissions.sql
 * - baseline_004_workspace_settings.sql
 * - baseline_005_divisions.sql (conditional: if uses_divisions=true)
 * - baseline_006_init_admin_user.sql
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Pool, PoolClient } from 'pg'

/**
 * Migration File Interface
 */
interface MigrationFile {
  version: string
  filename: string
  sql: string
  checksum: string
}

/**
 * Migration Runner Result
 */
export interface MigrationRunResult {
  success: boolean
  appliedCount: number
  skippedCount: number
  errorMessage?: string
  durationMs?: number
}

/**
 * Migration Runner Service
 */
export class MigrationRunnerService {
  private migrationsDir: string
  private logger?: any

  constructor(
    migrationsDir: string = path.join(__dirname, '../../db/tenant/migrations'),
    logger?: any
  ) {
    this.migrationsDir = migrationsDir
    this.logger = logger
  }

  /**
   * Run all baseline migrations on tenant database
   */
  async runBaseline(pool: Pool, usesDivisions: boolean = false): Promise<MigrationRunResult> {
    const startTime = Date.now()
    const client = await pool.connect()

    try {
      // Load migration files
      const migrations = this.loadMigrations(usesDivisions)

      if (migrations.length === 0) {
        return {
          success: false,
          appliedCount: 0,
          skippedCount: 0,
          errorMessage: 'No migration files found',
          durationMs: Date.now() - startTime,
        }
      }

      let appliedCount = 0
      let skippedCount = 0

      // Execute in transaction
      await client.query('BEGIN')

      try {
        for (const migration of migrations) {
          const alreadyApplied = await this.checkApplied(client, migration.version)

          if (alreadyApplied) {
            this.logger?.logStep('migration-skip', `Skipping already-applied migration`, {
              version: migration.version,
              filename: migration.filename,
            })
            skippedCount++
            continue
          }

          try {
            // Execute migration SQL
            await client.query(migration.sql)

            // Record in schema_versions table
            await client.query(
              `INSERT INTO schema_versions (version, checksum, description)
               VALUES ($1, $2, $3)
               ON CONFLICT DO NOTHING`,
              [migration.version, migration.checksum, migration.filename]
            )

            this.logger?.logStep('migration-apply', 'Migration applied', {
              version: migration.version,
              filename: migration.filename,
            })

            appliedCount++
          } catch (error) {
            await client.query('ROLLBACK')
            throw new Error(
              `Migration ${migration.filename} failed: ${error instanceof Error ? error.message : String(error)}`
            )
          }
        }

        // Commit transaction
        await client.query('COMMIT')

        this.logger?.logSuccess(
          'All baseline migrations applied successfully',
          Date.now() - startTime,
          {
            applied: appliedCount,
            skipped: skippedCount,
            total: migrations.length,
          }
        )

        return {
          success: true,
          appliedCount,
          skippedCount,
          durationMs: Date.now() - startTime,
        }
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.logger?.logError(
        'Baseline migration failed',
        error instanceof Error ? error : new Error(errorMsg)
      )

      return {
        success: false,
        appliedCount: 0,
        skippedCount: 0,
        errorMessage: errorMsg,
        durationMs: Date.now() - startTime,
      }
    } finally {
      client.release()
    }
  }

  /**
   * Load migration files in correct order
   */
  private loadMigrations(usesDivisions: boolean): MigrationFile[] {
    const files = [
      'baseline_001_schema_versions.sql',
      'baseline_002_roles.sql',
      'baseline_003_permissions.sql',
      'baseline_004_workspace_settings.sql',
    ]

    // Include divisions migration only if enabled
    if (usesDivisions) {
      files.push('baseline_005_divisions.sql')
    }

    files.push('baseline_006_init_admin_user.sql')

    const migrations: MigrationFile[] = []

    for (let i = 0; i < files.length; i++) {
      const filename = files[i]!
      const filePath = path.join(this.migrationsDir, filename)

      if (!fs.existsSync(filePath)) {
        throw new Error(`Migration file not found: ${filePath}`)
      }

      const sql = fs.readFileSync(filePath, 'utf-8')
      const checksum = this.calculateChecksum(sql)

      migrations.push({
        version: `1.0.${i}`,
        filename,
        sql,
        checksum,
      })
    }

    return migrations
  }

  /**
   * Check if migration already applied
   */
  private async checkApplied(client: PoolClient, version: string): Promise<boolean> {
    try {
      const result = await client.query(`SELECT 1 FROM schema_versions WHERE version = $1`, [
        version,
      ])
      return result.rows.length > 0
    } catch {
      // schema_versions table might not exist yet (first migration)
      return false
    }
  }

  /**
   * Calculate SHA256 checksum of SQL
   */
  private calculateChecksum(sql: string): string {
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(sql).digest('hex')
  }
}

/**
 * Factory to create migration runner
 */
export function createMigrationRunnerService(logger?: any): MigrationRunnerService {
  return new MigrationRunnerService(undefined, logger)
}
