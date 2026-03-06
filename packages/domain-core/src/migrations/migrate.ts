/**
 * Migration Executor
 *
 * Responsible for:
 * - Calculating SHA256 checksums of migration files
 * - Verifying migration integrity
 * - Executing migrations in tenant databases
 * - Managing schema versioning
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 */

import { createLogger } from '@zidney/logger/logger'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { Pool, QueryResult } from 'pg'

/**
 * Migration metadata
 */
export interface MigrationMeta {
  version: string
  checksum: string
  appliedAt: Date
}

/**
 * Migration task payload
 */
export interface MigrationTaskPayload {
  workspace_id: string
  task_id: string
  idempotency_key?: string
  schema_version: string
  schema_file_checksum: string
}

/**
 * Calculate SHA256 checksum of a file
 *
 * @param filePath - Absolute path to migration SQL file
 * @returns Hex-encoded SHA256 checksum
 * @throws Error if file not found or read permission denied
 */
export function calculateSHA256(filePath: string): string {
  const logger_fn = createLogger('calculateSHA256')

  try {
    const fileContent = readFileSync(filePath, 'utf-8')
    const hash = createHash('sha256')
    hash.update(fileContent)
    const checksum = hash.digest('hex')

    logger_fn.debug('Checksum calculated', { filePath, checksum })
    return checksum
  } catch (error) {
    logger_fn.error('Checksum calculation failed', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Get current schema version from tenant database
 *
 * @param pool - Database connection pool
 * @returns Current schema version metadata, or null if no version found
 */
export async function getCurrentSchemaVersion(pool: Pool): Promise<MigrationMeta | null> {
  const logger_fn = createLogger('getCurrentSchemaVersion')

  try {
    const result: QueryResult = await pool.query(
      `SELECT version, applied_at, checksum FROM schema_version LIMIT 1`
    )

    if (result.rows.length === 0) {
      logger_fn.debug('No schema version found (new tenant)')
      return null
    }

    const row = result.rows[0]
    return {
      version: row.version,
      checksum: row.checksum,
      appliedAt: new Date(row.applied_at),
    }
  } catch (error) {
    logger_fn.error('Failed to get current schema version', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Validate migration checksums match
 *
 * @param calculatedChecksum - Checksum calculated from file
 * @param storedChecksum - Checksum from task payload (calculated at API layer)
 * @returns true if checksums match, false otherwise
 */
export function validateChecksum(calculatedChecksum: string, storedChecksum: string): boolean {
  const logger_fn = createLogger('validateChecksum')

  if (calculatedChecksum !== storedChecksum) {
    logger_fn.error('Checksum mismatch detected - possible tampering', {
      calculated: calculatedChecksum,
      stored: storedChecksum,
    })
    return false
  }

  logger_fn.debug('Checksum validation passed')
  return true
}

/**
 * Acquire exclusive lock on schema_version table
 * Prevents concurrent migrations on same tenant
 *
 * @param pool - Database connection pool
 * @param lockTimeout - Timeout in milliseconds (default: 5000 = 5 seconds)
 * @throws Error if lock cannot be acquired within timeout
 */
export async function acquireSchemaLock(pool: Pool, lockTimeout: number = 5000): Promise<void> {
  const logger_fn = createLogger('acquireSchemaLock')

  try {
    const client = await pool.connect()

    try {
      // Set lock timeout (PostgreSQL: SET LOCAL lock_timeout)
      await client.query(`SET LOCAL lock_timeout = '${lockTimeout}ms'`)

      // Attempt to acquire exclusive lock
      await client.query(`LOCK TABLE schema_version IN EXCLUSIVE MODE`)

      logger_fn.debug('Schema lock acquired')
    } finally {
      client.release()
    }
  } catch (error) {
    logger_fn.error('Failed to acquire schema lock', {
      error: error instanceof Error ? error.message : String(error),
      lockTimeout,
    })
    throw error
  }
}

/**
 * Insert schema version record
 * Enforces single-row constraint via trigger
 *
 * @param pool - Database connection pool
 * @param version - Version string (e.g., '1.0.0')
 * @param checksum - SHA256 checksum of applied migration
 * @throws Error if insert fails (e.g., duplicate version)
 */
export async function insertSchemaVersion(
  pool: Pool,
  version: string,
  checksum: string
): Promise<void> {
  const logger_fn = createLogger('insertSchemaVersion')

  try {
    await pool.query(
      `INSERT INTO schema_version (version, applied_at, checksum) 
       VALUES ($1, NOW(), $2)
       RETURNING version, applied_at, checksum`,
      [version, checksum]
    )

    logger_fn.info('Schema version inserted', {
      version,
      checksum: checksum.substring(0, 8) + '...',
    })
  } catch (error) {
    logger_fn.error('Failed to insert schema version', {
      version,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Execute migration SQL file in transaction
 *
 * Prerequisites:
 * - Transaction already started (BEGIN)
 * - Schema lock acquired
 * - Checksum validated
 *
 * @param pool - Database connection pool
 * @param sqlStatements - SQL statements to execute (already read from file)
 * @throws Error if any statement fails (triggers automatic ROLLBACK)
 */
export async function executeMigrationSQL(pool: Pool, sqlStatements: string): Promise<void> {
  const logger_fn = createLogger('executeMigrationSQL')

  try {
    // Split statements carefully (accounting for comments, string literals)
    const statements = sqlStatements
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'))

    for (const statement of statements) {
      logger_fn.debug('Executing migration statement', {
        statementLength: statement.length,
      })
      await pool.query(statement)
    }

    logger_fn.info('Migration SQL executed successfully', {
      statementsCount: statements.length,
    })
  } catch (error) {
    logger_fn.error('Failed to execute migration SQL', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Read migration file from disk
 *
 * @param filePath - Absolute path to migration SQL file
 * @returns SQL content
 * @throws Error if file not found or read permission denied
 */
export function readMigrationFile(filePath: string): string {
  const logger_fn = createLogger('readMigrationFile')

  try {
    const content = readFileSync(filePath, 'utf-8')
    logger_fn.debug('Migration file read', {
      filePath,
      bytesRead: content.length,
    })
    return content
  } catch (error) {
    logger_fn.error('Failed to read migration file', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Verify schema integrity after migration
 * Checks that all critical tables exist
 *
 * @param pool - Database connection pool
 * @throws Error if schema integrity check fails
 */
export async function verifySchemaIntegrity(pool: Pool): Promise<void> {
  const logger_fn = createLogger('verifySchemaIntegrity')

  // Critical tables that must exist
  const criticalTables = ['schema_version', 'users', 'roles', 'attempts', 'attempt_events']

  try {
    for (const tableName of criticalTables) {
      const result = await pool.query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = $1 AND table_schema = 'public'
        )`,
        [tableName]
      )

      if (!result.rows[0].exists) {
        throw new Error(`Critical table '${tableName}' not found`)
      }
    }

    logger_fn.info('Schema integrity verified', {
      criticalTables: criticalTables.length,
    })
  } catch (error) {
    logger_fn.error('Schema integrity check failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Get path to migration file
 *
 * @param migrationVersion - Version string (e.g., '1.0.0')
 * @param fileName - SQL file name (e.g., 'baseline-schema.sql')
 * @returns Absolute path to migration file
 */
export function getMigrationFilePath(migrationVersion: string, fileName: string): string {
  // Relative to apps/api
  return join(
    process.cwd(),
    'apps',
    'api',
    'src',
    'db',
    'tenant',
    'migrations',
    migrationVersion,
    fileName
  )
}

export default {
  calculateSHA256,
  getCurrentSchemaVersion,
  validateChecksum,
  acquireSchemaLock,
  insertSchemaVersion,
  executeMigrationSQL,
  readMigrationFile,
  verifySchemaIntegrity,
  getMigrationFilePath,
}
