/**
 * Tenant migration runner
 * Executes migrations on tenant database within single atomic transaction
 * Called by Worker job processor with write lock already acquired
 * Per-workspace schema upgrades (executed by Worker)
 */

import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { MigrationResult, UpgradeJob } from '@zidney/types'
import { calculateChecksum, detectMigrationGap, validateMigrationFile } from '@zidney/validation'
import type { Pool } from 'pg'

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const m = (e as { message?: unknown }).message
    return typeof m === 'string' ? m : String(m)
  }
  return String(e)
}

/**
 * Tenant context passed by Worker after resolver validation
 */
export interface TenantMigrationContext {
  workspace_id: string
  workspace_slug: string
  connection_pool: Pool
  masterDb: Pool
  correlationId: string
}

/**
 * Run tenant migrations within single transaction
 * Preconditions:
 *   - Write lock already acquired (by Worker)
 *   - License already validated as ACTIVE (by Worker)
 *   - Snapshot already created (by Worker)
 * @throws Error if any migration fails (full ROLLBACK)
 */
export async function runTenantMigrations(
  tenantContext: TenantMigrationContext,
  upgradeJob: UpgradeJob,
  migrationsDir: string = join(__dirname, '../db/tenant/migrations')
): Promise<MigrationResult> {
  const startTime = Date.now()
  let migrationsApplied = 0

  const { workspace_id, workspace_slug, correlationId, connection_pool, masterDb } = tenantContext

  try {
    // Load migration files
    const fs = require('node:fs').promises
    const files = await fs.readdir(migrationsDir)
    const migrationFiles = files.filter((f: string) => f.endsWith('.sql')).sort()

    // Validate sequence
    const gapError = detectMigrationGap(migrationFiles)
    if (gapError) {
      throw gapError
    }

    // Begin transaction on tenant database
    const tenantClient = await connection_pool.connect()
    let currentVersion = '1.0.0' // Will query before BEGIN

    try {
      // Pre-transaction: Re-validate license (in case status changed)
      const licenseCheckResult = await masterDb.query(
        `SELECT status, product_version FROM licenses WHERE workspace_id = $1`,
        [workspace_id]
      )

      if (licenseCheckResult.rows.length === 0) {
        throw new Error('License not found for workspace')
      }

      const license = licenseCheckResult.rows[0]

      // If SOFT_LOCKED: Skip migration (graceful degradation, return SUCCESS)
      if (license.status === 'SOFT_LOCKED') {
        console.log(
          JSON.stringify({
            level: 'WARN',
            service: 'tenant-migration-runner',
            event: 'license_soft_locked_skip_migration',
            workspace_id,
            workspace_slug,
            correlation_id: correlationId,
            severity: 'INFORMATIONAL',
            timestamp: new Date().toISOString(),
          })
        )

        return {
          success: true,
          workspace_id,
          previousVersion: '1.0.0',
          newVersion: upgradeJob.targetSchemaVersion,
          executionTimeMs: Date.now() - startTime,
          migrationsApplied: 0, // No migrations executed
        }
      }

      // If ARCHIVED: Throw error (fatal)
      if (license.status === 'ARCHIVED') {
        throw new Error('Cannot upgrade archived workspace')
      }

      // Query current schema version
      const versionResult = await tenantClient.query(
        `SELECT version FROM schema_version WHERE id = '00000000-0000-0000-0000-000000000001'::uuid`
      )

      if (versionResult.rows.length > 0) {
        currentVersion = versionResult.rows[0].version
      }

      // BEGIN transaction
      await tenantClient.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE')

      try {
        // Execute each migration
        for (const filename of migrationFiles) {
          const filePath = join(migrationsDir, filename)
          const sqlContent = readFileSync(filePath, 'utf-8')

          // Validate migration file
          const validation = validateMigrationFile(filename, sqlContent)
          if (!validation.isValid) {
            throw new Error(
              `Migration validation failed for ${filename}: ${validation.errors.join('; ')}`
            )
          }

          const checksum = calculateChecksum(sqlContent)

          // Check migration_registry for duplicate (idempotency via UNIQUE constraint)
          const registryCheck = await masterDb.query(
            `SELECT status FROM migration_registry 
             WHERE workspace_id = $1 AND migration_file = $2`,
            [workspace_id, filename]
          )

          // If already SUCCESS: Skip SQL execution (idempotent)
          if (registryCheck.rows.length > 0 && registryCheck.rows[0].status === 'SUCCESS') {
            console.log(
              JSON.stringify({
                level: 'DEBUG',
                service: 'tenant-migration-runner',
                event: 'migration_skipped_already_applied',
                workspace_id,
                migration_file: filename,
                correlation_id: correlationId,
                timestamp: new Date().toISOString(),
              })
            )
            continue // Skip to next migration
          }

          // Validate product version compatibility
          if (validation.header?.targetProductVersion) {
            const requiredProductVersion = validation.header.targetProductVersion
            const currentProductVersion = license.product_version

            if (!isProductVersionCompatible(currentProductVersion, requiredProductVersion)) {
              throw new Error(
                `Migration ${filename} requires product version ${requiredProductVersion}, current: ${currentProductVersion}`
              )
            }
          }

          // Execute migration SQL
          try {
            await tenantClient.query(sqlContent)
          } catch (err: unknown) {
            throw new Error(`Syntax error in migration ${filename}: ${getErrorMessage(err)}`)
          }

          // Record in migration_registry
          try {
            await masterDb.query(
              `INSERT INTO migration_registry (
                id, workspace_id, migration_file, target_schema_version, checksum, 
                applied_at, execution_time_ms, status, operator_id, snapshot_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (workspace_id, migration_file) DO NOTHING`,
              [
                crypto.randomUUID(),
                workspace_id,
                filename,
                validation.header?.targetVersion || upgradeJob.targetSchemaVersion,
                checksum,
                new Date(),
                Date.now() - startTime,
                'SUCCESS',
                upgradeJob.operatorId || null,
                upgradeJob.snapshotId || null,
              ]
            )
          } catch (err: unknown) {
            throw new Error(`Failed to record migration in registry: ${getErrorMessage(err)}`)
          }

          migrationsApplied++
        }

        // After all migrations: Update schema_version tables
        const targetVersion = upgradeJob.targetSchemaVersion

        // Update tenant_db.schema_version (source of truth)
        await tenantClient.query(
          `UPDATE schema_version SET version = $1, applied_at = now()
           WHERE id = '00000000-0000-0000-0000-000000000001'::uuid`,
          [targetVersion]
        )

        // Update master_db.tenants_registry.schema_version (cache)
        await masterDb.query(
          `UPDATE tenants_registry SET schema_version = $1, updated_at = now()
           WHERE id = $2`,
          [targetVersion, workspace_id]
        )

        // Commit transaction
        await tenantClient.query('COMMIT')

        // Log success
        console.log(
          JSON.stringify({
            level: 'INFO',
            service: 'tenant-migration-runner',
            event: 'tenant_migrations_completed',
            workspace_id,
            workspace_slug,
            correlation_id: correlationId,
            previous_version: currentVersion,
            new_version: targetVersion,
            migrations_applied: migrationsApplied,
            execution_time_ms: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          })
        )

        return {
          success: true,
          workspace_id,
          previousVersion: currentVersion,
          newVersion: targetVersion,
          executionTimeMs: Date.now() - startTime,
          migrationsApplied,
        }
      } catch (err) {
        await tenantClient.query('ROLLBACK')
        throw err
      }
    } finally {
      tenantClient.release()
    }
  } catch (err: unknown) {
    const msg = getErrorMessage(err)
    const errorCode = msg.includes('Syntax error')
      ? 'MIGRATION_SYNTAX_ERROR'
      : msg.includes('gap')
        ? 'MIGRATION_SEQUENCE_GAP'
        : msg.includes('product version')
          ? 'PRODUCT_VERSION_INCOMPATIBLE'
          : 'MIGRATION_EXECUTION_FAILED'

    console.log(
      JSON.stringify({
        level: 'ERROR',
        service: 'tenant-migration-runner',
        event: 'tenant_migrations_failed',
        workspace_id,
        workspace_slug,
        correlation_id: correlationId,
        error_code: errorCode,
        error_message: msg,
        migrations_applied: migrationsApplied,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      })
    )

    return {
      success: false,
      workspace_id,
      previousVersion: '1.0.0',
      newVersion: upgradeJob.targetSchemaVersion,
      executionTimeMs: Date.now() - startTime,
      migrationsApplied,
      error: {
        code: errorCode,
        message: msg,
      },
    }
  }
}

/**
 * Helper: Check product version compatibility (X.Y.Z format)
 */
function isProductVersionCompatible(current: string, required: string): boolean {
  try {
    const [currMajor, currMinor, currPatch] = current.split('.').map(Number) as [
      number,
      number,
      number,
    ]
    const [reqMajor, reqMinor, reqPatch] = required.split('.').map(Number) as [
      number,
      number,
      number,
    ]

    if (currMajor !== reqMajor) return currMajor > reqMajor
    if (currMinor !== reqMinor) return currMinor > reqMinor
    return currPatch >= reqPatch
  } catch {
    return false
  }
}
