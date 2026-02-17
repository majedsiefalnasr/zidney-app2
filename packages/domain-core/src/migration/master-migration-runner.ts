/**
 * Master migration runner
 * Executes migrations on master database during application startup
 * Platform bootstrap (executed once at app boot)
 */

import { MigrationResult } from '@zidney/types'
import {
  calculateChecksum,
  detectMigrationGap,
  validateMigrationFile,
} from '@zidney/validation'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Database } from 'pg'

/**
 * Load all migration files from migrations directory
 */
async function loadMigrationFiles(migrationsDir: string): Promise<string[]> {
  const fs = require('fs').promises
  const files = await fs.readdir(migrationsDir)
  return files.filter((f: string) => f.endsWith('.sql')).sort()
}

/**
 * Run all master database migrations as single atomic transaction
 * This is called at application bootstrap
 * @throws Error if any migration fails (app refuses to boot)
 */
export async function runMasterMigrations(
  masterDb: Database,
  migrationsDir: string = join(__dirname, '../db/master/migrations')
): Promise<MigrationResult> {
  const correlationId = crypto.randomUUID()
  const startTime = Date.now()
  let migrationsApplied = 0

  try {
    // Load migration files
    const migrationFiles = await loadMigrationFiles(migrationsDir)

    // Validate sequence (no gaps)
    const gapError = detectMigrationGap(migrationFiles)
    if (gapError) {
      throw gapError
    }

    // Begin transaction
    const client = await masterDb.connect()
    await client.query('BEGIN TRANSACTION')

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

        // Calculate checksum
        const checksum = calculateChecksum(sqlContent)

        // Execute SQL
        try {
          await client.query(sqlContent)
          migrationsApplied++
        } catch (err: any) {
          throw new Error(
            `Syntax error in migration ${filename}: ${err.message}`
          )
        }
      }

      // Update platform_settings.current_schema_version
      // Extract latest version from last migration
      const lastMigrationFile = migrationFiles[migrationFiles.length - 1]
      const lastSqlContent = readFileSync(
        join(migrationsDir, lastMigrationFile),
        'utf-8'
      )
      const lastValidation = validateMigrationFile(
        lastMigrationFile,
        lastSqlContent
      )

      if (!lastValidation.header?.targetVersion) {
        throw new Error('Unable to determine latest schema version')
      }

      await client.query(
        `UPDATE platform_settings 
         SET current_schema_version = $1, updated_at = now()
         WHERE id = '00000000-0000-0000-0000-000000000001'::uuid`,
        [lastValidation.header.targetVersion]
      )

      // Commit transaction
      await client.query('COMMIT')

      // Log success
      console.log(
        JSON.stringify({
          level: 'INFO',
          service: 'master-migration-runner',
          event: 'master_migrations_completed',
          correlation_id: correlationId,
          migrations_applied: migrationsApplied,
          execution_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        })
      )

      return {
        success: true,
        workspace_id: 'MASTER',
        previousVersion: '0.0.0',
        newVersion: lastValidation.header.targetVersion,
        executionTimeMs: Date.now() - startTime,
        migrationsApplied,
      }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err: any) {
    const errorCode = err.message.includes('Syntax error')
      ? 'MIGRATION_SYNTAX_ERROR'
      : err.message.includes('gap')
        ? 'MIGRATION_SEQUENCE_GAP'
        : 'MIGRATION_EXECUTION_FAILED'

    console.log(
      JSON.stringify({
        level: 'ERROR',
        service: 'master-migration-runner',
        event: 'master_migrations_failed',
        correlation_id: correlationId,
        error_code: errorCode,
        error_message: err.message,
        migrations_applied: migrationsApplied,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      })
    )

    return {
      success: false,
      workspace_id: 'MASTER',
      previousVersion: '0.0.0',
      newVersion: '0.0.0',
      executionTimeMs: Date.now() - startTime,
      migrationsApplied,
      error: {
        code: errorCode,
        message: err.message,
      },
    }
  }
}

import crypto from 'crypto'
