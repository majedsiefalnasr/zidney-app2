/**
 * Worker Task: INIT_TENANT_SCHEMA (Full Implementation)
 *
 * Initializes the baseline schema for a new tenant database.
 * Executes baseline 38-40 tables, triggers, and indexes in a single transaction.
 *
 * Hardening (STAGE_02B):
 * - Lock timeout 5s: Prevents worker threads hanging on stuck migrations
 * - Statement timeout 30s: Prevents hung transactions blocking other tenants
 * - Checksum validation: Detects tampering + storage corruption
 * - NO RETRY on tampering: Security incident enforcement
 * - Exponential backoff: 2s, 4s, 8s (max 3 retries)
 * - DLQ escalation: After 3 failures
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 * Task: T027
 */

import {
  calculateSHA256,
  executeMigrationSQL,
  getMigrationFilePath,
  insertSchemaVersion,
  readMigrationFile,
  verifySchemaIntegrity,
} from '@zidney/domain-core/migrations/migrate'
import { createLogger } from '@zidney/logger'
import type { Pool, PoolClient } from 'pg'

const logger = createLogger('INIT_TENANT_SCHEMA')

/**
 * Task Payload
 */
export interface InitTenantSchemaPayload {
  workspace_id: string
  task_id: string
  idempotency_key?: string
  schema_version: string
  schema_file_checksum: string
}

/**
 * Task Result
 */
export interface InitTenantSchemaResult {
  task_id: string
  workspace_id: string
  status: 'SUCCESS' | 'FAILED' | 'RETRY' | 'DLQ_ESCALATED'
  version: string
  appliedAt?: string
  error?: string
  tampering_detected?: boolean
}

/**
 * Execute INIT_TENANT_SCHEMA worker task
 *
 * This is the critical transactional flow for tenant provisioning.
 *
 * Execution:
 * 1. Validate payload integrity
 * 2. Get tenant connection from pool (resolver context)
 * 3. Set timeouts: lock_timeout=5s, statement_timeout=30s
 * 4. BEGIN TRANSACTION (READ COMMITTED)
 * 5. Acquire schema lock
 * 6. Read baseline-schema.sql + triggers.sql
 * 7. Validate checksums match payload (detect tampering)
 * 8. Execute schema initialization SQL
 * 9. Verify schema integrity (critical tables exist)
 * 10. INSERT schema_version record
 * 11. COMMIT
 * 12. Return SUCCESS
 *
 * On failure: ROLLBACK → retry with exponential backoff (3 max) → DLQ
 * On checksum mismatch: ABORT → DLQ with tampering_detected=true → NO RETRY
 *
 * @param payload - Task payload with schema metadata
 * @param pool - Tenant database connection pool (from resolver context)
 * @param redisClient - For idempotency tracking (optional)
 * @returns Task result
 */
export async function executeInitTenantSchema(
  payload: InitTenantSchemaPayload,
  pool: Pool,
  _redisClient?: unknown
): Promise<InitTenantSchemaResult> {
  const { workspace_id, task_id, idempotency_key, schema_version, schema_file_checksum } = payload

  const logger = createLogger(`INIT_TENANT_SCHEMA[${task_id}]`)
  const startTime = Date.now()

  let client: PoolClient | null = null

  try {
    logger.info('Task started', {
      workspace_id,
      schema_version,
      idempotency_key,
    })

    // Get client from pool
    client = await pool.connect()

    try {
      // ======================================================================
      // HARDENING: Set transaction timeouts (ISOLATED to this connection)
      // ======================================================================

      // Lock timeout: 5 seconds (prevents hanging on stuck migrations)
      await client.query(`SET LOCAL lock_timeout = '5s'`)

      // Statement timeout: 30 seconds (prevents hung transactions)
      await client.query(`SET LOCAL statement_timeout = '30000'`)

      logger.debug('Timeouts configured', {
        lock_timeout: '5s',
        statement_timeout: '30s',
      })

      // ======================================================================
      // CRITICAL: IDEMPOTENCY CHECK (DLQ recovery safety)
      // ======================================================================
      // Check if schema_version already exists (allows safe re-run)
      // EDGE CASE: Verify baseline tables exist (partial init detection)
      // If schema_version exists but tables missing → retry (partial crash)
      // ======================================================================

      const existingVersionResult = await client.query(
        `SELECT version, applied_at FROM schema_version LIMIT 1`
      )

      if (existingVersionResult.rows.length > 0) {
        // Schema version record exists - VERIFY baseline tables exist
        const existingVersion = existingVersionResult.rows[0]

        logger.debug('Schema version record found - verifying baseline tables', {
          existing_version: existingVersion.version,
        })

        // CRITICAL EDGE CASE: If schema_version exists but tables missing,
        // the previous worker crashed mid-transaction. Retry to recover.
        try {
          await verifySchemaIntegrity(client as unknown as PoolClient)

          logger.info('IDEMPOTENT: Schema fully initialized (all baseline tables verified)', {
            existing_version: existingVersion.version,
            existing_applied_at: existingVersion.applied_at,
            requested_version: schema_version,
          })

          // Return SUCCESS (graceful exit for re-runs)
          return {
            task_id,
            workspace_id,
            status: 'SUCCESS',
            version: existingVersion.version,
            appliedAt: existingVersion.applied_at,
            error: `Idempotent: Schema already initialized (version: ${existingVersion.version})`,
          }
        } catch (integrityError) {
          // CRITICAL: Partial initialization detected
          logger.error(
            'PARTIAL INITIALIZATION: schema_version exists but baseline tables incomplete',
            {
              existing_version: existingVersion.version,
              requested_version: schema_version,
              error:
                integrityError instanceof Error ? integrityError.message : String(integrityError),
            }
          )

          // Return RETRY - worker crashed mid-init, retry will detect and handle
          return {
            task_id,
            workspace_id,
            status: 'RETRY',
            version: schema_version,
            error: `Partial initialization: schema_version exists but baseline tables incomplete (worker crash detected)`,
          }
        }
      }

      logger.debug('Idempotency check passed - no existing schema_version')

      // ======================================================================
      // BEGIN TRANSACTION (READ COMMITTED isolation)
      // ======================================================================

      await client.query('BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED')

      logger.debug('Transaction started')

      // ======================================================================
      // ACQUIRE SCHEMA LOCK (exclusive, prevents concurrent migrations)
      // ======================================================================

      await client.query(`LOCK TABLE schema_version IN ACCESS EXCLUSIVE MODE`)

      logger.debug('Schema lock acquired')

      // ======================================================================
      // READ MIGRATION FILES
      // ======================================================================

      const schemaFilePath = getMigrationFilePath(schema_version, 'baseline-schema.sql')
      const triggersFilePath = getMigrationFilePath(schema_version, 'triggers.sql')

      const schemaSQL = readMigrationFile(schemaFilePath)
      const triggersSQL = readMigrationFile(triggersFilePath)

      logger.debug('Migration files read', {
        schema_bytes: schemaSQL.length,
        triggers_bytes: triggersSQL.length,
      })

      // ======================================================================
      // VALIDATE CHECKSUMS (detect tampering + storage corruption)
      // ======================================================================

      const calculatedChecksum = calculateSHA256(schemaFilePath)

      if (calculatedChecksum !== schema_file_checksum) {
        // CRITICAL: Checksum mismatch = possible tampering or corruption
        logger.error('CHECKSUM MISMATCH DETECTED', {
          workspace_id,
          expected: schema_file_checksum,
          calculated: calculatedChecksum,
          tampering_detected: true,
        })

        // ABORT transaction
        await client.query('ROLLBACK')

        // ESCALATE TO DLQ with tampering flag
        return {
          task_id,
          workspace_id,
          status: 'DLQ_ESCALATED',
          version: schema_version,
          error: 'Checksum mismatch - possible tampering or corruption',
          tampering_detected: true,
        }
      }

      logger.debug('Checksum validation passed', {
        checksum: `${calculatedChecksum.substring(0, 8)}...`,
      })

      // ======================================================================
      // EXECUTE BASELINE SCHEMA INITIALIZATION
      // ======================================================================

      // Execute baseline schema SQL
      await executeMigrationSQL(client as unknown as PoolClient, schemaSQL)
      logger.debug('Baseline schema SQL executed')

      // Execute trigger functions
      await executeMigrationSQL(client as unknown as PoolClient, triggersSQL)
      logger.debug('Trigger functions created')

      // ======================================================================
      // VERIFY SCHEMA INTEGRITY (critical tables exist)
      // ======================================================================

      await verifySchemaIntegrity(client as unknown as PoolClient)
      logger.debug('Schema integrity verified')

      // ======================================================================
      // INSERT SCHEMA_VERSION RECORD (marks initialization complete)
      // ======================================================================

      await insertSchemaVersion(client as unknown as PoolClient, schema_version, calculatedChecksum)
      logger.info('Schema version record inserted', {
        version: schema_version,
        checksum: `${calculatedChecksum.substring(0, 8)}...`,
      })

      // ======================================================================
      // COMMIT TRANSACTION (all-or-nothing)
      // ======================================================================

      await client.query('COMMIT')
      logger.info('Transaction committed')

      // ======================================================================
      // SUCCESS: Return result
      // ======================================================================

      const duration = Date.now() - startTime

      logger.info('TENANT SCHEMA INITIALIZED', {
        workspace_id,
        version: schema_version,
        duration_ms: duration,
      })

      return {
        task_id,
        workspace_id,
        status: 'SUCCESS',
        version: schema_version,
        appliedAt: new Date().toISOString(),
      }
    } catch (txnError) {
      // Transaction error - ROLLBACK
      logger.error('Transaction error encountered', {
        error: txnError instanceof Error ? txnError.message : String(txnError),
      })

      try {
        await client.query('ROLLBACK')
        logger.debug('Transaction rolled back')
      } catch (rollbackError) {
        logger.error('Rollback failed', {
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        })
      }

      // Return RETRY status (exponential backoff will be handled by queue)
      return {
        task_id,
        workspace_id,
        status: 'RETRY',
        version: schema_version,
        error: txnError instanceof Error ? txnError.message : String(txnError),
      }
    }
  } catch (error) {
    logger.error('Task execution failed', {
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - startTime,
    })

    return {
      task_id,
      workspace_id,
      status: 'FAILED',
      version: schema_version,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    // Release client back to pool
    if (client) {
      try {
        client.release()
        logger.debug('Client released to pool')
      } catch (releaseError) {
        logger.error('Failed to release client', {
          error: releaseError instanceof Error ? releaseError.message : String(releaseError),
        })
      }
    }
  }
}

/**
 * Worker Task Handler Entry Point
 *
 * Called by: Worker queue (Bull, RabbitMQ, etc.)
 * Input: Serialized InitTenantSchemaPayload
 * Output: InitTenantSchemaResult
 *
 * Retry Policy:
 * - On RETRY: Exponential backoff (2s, 4s, 8s) - max 3 retries
 * - On DLQ_ESCALATED: Send to DLQ, DO NOT RETRY
 * - On FAILED: Send to DLQ after retries exhausted
 */
export async function handleInitTenantSchema(
  taskData: unknown,
  dependencies: { pool: Pool; redis?: unknown }
): Promise<InitTenantSchemaResult> {
  const payload = taskData as InitTenantSchemaPayload

  // Execute with full transaction context
  const result = await executeInitTenantSchema(payload, dependencies.pool, dependencies.redis)

  // Handle result routing
  if (result.status === 'SUCCESS') {
    logger.info('Schema initialization successful', {
      workspace_id: result.workspace_id,
      version: result.version,
    })
  } else if (result.status === 'DLQ_ESCALATED') {
    logger.critical('SECURITY: Schema initialization escalated to DLQ (tampering detected)', {
      workspace_id: result.workspace_id,
      tampering_detected: result.tampering_detected,
    })
    // Queue should: Send to DLQ, Alert admin, DO NOT RETRY
  } else if (result.status === 'RETRY') {
    logger.warn('Schema initialization will retry', {
      workspace_id: result.workspace_id,
      attempt: taskData._attempt || 1,
    })
    // Queue should: Retry with exponential backoff
  }

  return result
}

export default {
  executeInitTenantSchema,
  handleInitTenantSchema,
}
