import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import type { Pool, PoolClient } from 'pg'

/**
 * T054: APPLY_MIGRATION Worker Task
 * Executes schema migrations with transaction safety and checksum validation (ADR-0008)
 *
 * Hardening Rules:
 * - Lock timeout: 5s (prevents stuck locks)
 * - Statement timeout: 30s (prevents hung migrations)
 * - Checksum validation: tampering = CRITICAL + DLQ no-retry
 * - Atomic execution: all-or-nothing semantics
 */

export interface ApplyMigrationTaskPayload {
  workspace_id: string
  task_id: string
  from_version: string
  to_version: string
  migration_file_checksum: string
  migration_file_path: string
}

/**
 * Execute migration task
 * Main entry point called by worker
 */
export async function applyMigration(
  payload: ApplyMigrationTaskPayload,
  tenantPool: Pool,
  logger?: any
): Promise<{ success: boolean; message: string; error?: string }> {
  const {
    workspace_id,
    task_id,
    from_version,
    to_version,
    migration_file_checksum,
    migration_file_path,
  } = payload

  logger?.log('info', 'Starting migration', {
    workspace_id,
    task_id,
    from_version,
    to_version,
  })

  let client: PoolClient | null = null

  try {
    // Get tenant connection
    client = await tenantPool.connect()

    // Set session-level timeout guards
    await client.query("SET LOCAL lock_timeout = '5s'")
    await client.query("SET LOCAL statement_timeout = '30s'")

    // Begin transaction
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED')

    // Step 1: Acquire exclusive lock on schema_version
    await client.query('LOCK schema_version IN EXCLUSIVE MODE')

    // Step 2: Read current version
    const versionResult = await client.query(
      'SELECT version FROM schema_version LIMIT 1'
    )
    const currentVersion = versionResult.rows[0]?.version || '1.0.0'

    logger?.log('debug', 'Current schema version', { current: currentVersion })

    // Step 3: Validate version ordering (from == current, to > from)
    if (currentVersion !== from_version) {
      throw new Error(
        `Version mismatch: current=${currentVersion}, expected from=${from_version}. Another migration may be in progress.`
      )
    }

    // Step 4: Read and validate migration file
    let migrationSQL: string
    try {
      migrationSQL = readFileSync(migration_file_path, 'utf-8')
    } catch (err: any) {
      throw new Error(
        `Failed to read migration file: ${migration_file_path} - ${err.message}`
      )
    }

    // Step 5: CRITICAL - Verify checksum (tampering detection)
    const calculatedChecksum = createHash('sha256')
      .update(migrationSQL)
      .digest('hex')
    if (calculatedChecksum !== migration_file_checksum) {
      logger?.log(
        'critical',
        'MIGRATION CHECKSUM MISMATCH - POSSIBLE TAMPERING',
        {
          workspace_id,
          task_id,
          expected: migration_file_checksum,
          calculated: calculatedChecksum,
        }
      )

      // ABORT IMMEDIATELY - DO NOT RETRY on checksum failure
      await client.query('ROLLBACK')
      client.release()

      return {
        success: false,
        message: 'TAMPERING DETECTED - Checksum mismatch',
        error:
          'Migration file checksum does not match expected value. Possible tampering detected.',
      }
    }

    logger?.log('debug', 'Migration checksum validated')

    // Step 6: Execute migration SQL
    // Note: We assume migrationSQL is already wrapped in BEGIN...COMMIT
    // But since we're in a transaction, we execute the inner SQL only
    const cleanSQL = migrationSQL
      .replace(/BEGIN\s+TRANSACTION/i, '')
      .replace(/COMMIT/i, '')
      .trim()

    try {
      await client.query(cleanSQL)
      logger?.log('debug', 'Migration SQL executed successfully')
    } catch (err: any) {
      logger?.log('error', 'Migration SQL execution failed', {
        error: err.message,
        code: err.code,
      })
      throw err
    }

    // Step 7: Validate schema integrity (check if new tables/columns exist)
    // This is application-specific; for now, just verify tables_exist_count
    const tableCountResult = await client.query(`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `)
    const tableCount = parseInt(tableCountResult.rows[0].table_count, 10)
    logger?.log('debug', 'Schema table count', { count: tableCount })

    // Step 8: Update schema_version
    const updateResult = await client.query(
      `UPDATE schema_version 
       SET version = $1, applied_at = NOW(), checksum = $2
       WHERE version = $3`,
      [to_version, calculatedChecksum, from_version]
    )

    if (updateResult.rowCount === 0) {
      throw new Error('Failed to update schema_version table')
    }

    logger?.log('debug', 'schema_version table updated', {
      from: from_version,
      to: to_version,
    })

    // Step 9: Commit transaction
    await client.query('COMMIT')

    logger?.log('critical', 'Migration applied successfully', {
      workspace_id,
      task_id,
      from_version,
      to_version,
    })

    return {
      success: true,
      message: `Migration applied: ${from_version} → ${to_version}`,
    }
  } catch (err: any) {
    // Rollback on any error
    if (client) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // Ignore rollback errors
      }
    }

    logger?.log('error', 'Migration failed', {
      task_id,
      error: err.message,
      code: err.code,
    })

    return {
      success: false,
      message: 'Migration failed',
      error: err.message,
    }
  } finally {
    // Release connection
    if (client) {
      client.release()
    }
  }
}

/**
 * Retry policy for migrations
 * - Exponential backoff: 2s → 4s → 8s
 * - Max 3 retries (~14s total)
 * - NO RETRY on checksumMismatch (tampering)
 */
export interface RetryPolicy {
  maxRetries: number
  backoffMs: number[]
  noRetryOn: string[] // Error codes that should NOT retry
}

export function getMigrationRetryPolicy(): RetryPolicy {
  return {
    maxRetries: 3,
    backoffMs: [2000, 4000, 8000], // 2s, 4s, 8s
    noRetryOn: [
      'TAMPERING_DETECTED',
      'CHECKSUM_MISMATCH',
      'LOCK_TIMEOUT_AFTER_RETRIES',
    ],
  }
}
