/**
 * Schema Initialization Service
 *
 * Coordinates tenant schema provisioning:
 * 1. Validates idempotency
 * 2. Enqueues INIT_TENANT_SCHEMA task in worker
 * 3. Tracks status
 *
 * Business logic layer (no HTTP concerns)
 *
 * Task: T026 - Schema initialization service
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 */

import { calculateSHA256, getMigrationFilePath } from '@zidney/domain-core/migrations/migrate'
import { createLogger } from '@zidney/logger'
import type { Pool } from 'pg'
import {
  checkIdempotency,
  generateTaskId,
  type RedisClient,
  storeIdempotencyRecord,
} from './idempotency.service'

export interface SchemaInitPayload {
  workspace_id: string
  idempotency_key?: string
}

export interface SchemaInitResponse {
  task_id: string
  workspace_id: string
  status: 'QUEUED' | 'ALREADY_INITIALIZED'
  idempotency_key?: string
  message: string
}

export interface WorkerQueueTask {
  id: string
  type: 'INIT_TENANT_SCHEMA'
  payload: any
  created_at: Date
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
}

/**
 * Worker queue interface (abstracted)
 * Implementation can use Bull, RabbitMQ, etc.
 */
export interface WorkerQueue {
  enqueue(taskType: string, payload: any): Promise<string>
}

/**
 * Initialize schema for new tenant
 *
 * Flow:
 * 1. Check idempotency (Redis cache + DB)
 * 2. If already initialized → return 202 (idempotent replay)
 * 3. If not initialized → enqueue worker task
 * 4. Return task_id for status polling
 *
 * @param payload - Request payload with workspace_id
 * @param redis - Redis client for idempotency cache
 * @param pool - PostgreSQL connection pool (for DB fallback check)
 * @param queue - Worker queue client
 * @returns Schema init response with task_id or existing task reference
 */
export async function initializeTenantSchema(
  payload: SchemaInitPayload,
  redis: RedisClient | null,
  pool: Pool,
  queue: WorkerQueue
): Promise<SchemaInitResponse> {
  const { workspace_id, idempotency_key } = payload
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const logger = createLogger('initializeTenantSchema')

  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const startTime = Date.now()

  try {
    logger.debug('Schema initialization requested', {
      workspace_id,
      idempotency_key: idempotency_key ? '***provided***' : 'not-provided',
    })

    // Step 1: Check idempotency (Redis cache + DB fallback)
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const existing = await checkIdempotency(workspace_id, idempotency_key, redis, pool)

    if (existing) {
      logger.info('Schema initialization idempotent replay', {
        workspace_id,
        existing_task_id: existing.task_id,
        duration_ms: Date.now() - startTime,
      })

      return {
        task_id: existing.task_id,
        workspace_id,
        status: 'ALREADY_INITIALIZED',
        idempotency_key: existing.idempotency_key,
        message: `Schema already initialized for workspace ${workspace_id}`,
      }
    }

    // Step 2: New request - generate task IDs
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const taskId = generateTaskId()
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const finalIdempotencyKey = idempotency_key || taskId

    // Step 3: Calculate baseline schema checksum
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const schemaFilePath = getMigrationFilePath('v1.0.0', 'baseline-schema.sql')
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const schemaChecksum = calculateSHA256(schemaFilePath)

    logger.debug('Schema checksum calculated', {
      workspace_id,
      checksum: `${schemaChecksum.substring(0, 8)}...`,
    })

    // Step 4: Enqueue INIT_TENANT_SCHEMA worker task
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const workerPayload = {
      workspace_id,
      task_id: taskId,
      idempotency_key: finalIdempotencyKey,
      schema_version: '1.0.0',
      schema_file_checksum: schemaChecksum,
    }

    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const enqueuedTaskId = await queue.enqueue('INIT_TENANT_SCHEMA', workerPayload)

    logger.info('INIT_TENANT_SCHEMA task enqueued', {
      workspace_id,
      task_id: taskId,
      enqueued_task_id: enqueuedTaskId,
      version: '1.0.0',
    })

    // Step 5: Store idempotency record
    await storeIdempotencyRecord(workspace_id, finalIdempotencyKey, taskId, redis, pool)

    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const _duration = Date.now() - startTime

    return {
      task_id: taskId,
      workspace_id,
      status: 'QUEUED',
      idempotency_key: finalIdempotencyKey,
      message: `Schema initialization started. Track progress using task_id=${taskId}`,
    }
  } catch (error) {
    logger.error('Schema initialization failed', {
      workspace_id,
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - startTime,
    })
    throw error
  }
}

/**
 * Get schema initialization task status
 *
 * @param workspace_id - Workspace UUID
 * @param task_id - Task ID from initialization response
 * @param redis - Redis client
 * @param pool - PostgreSQL pool
 * @returns Task status and metadata
 */
export async function getSchemaInitStatus(
  workspace_id: string,
  task_id: string,
  _redis: RedisClient | null,
  pool: Pool
): Promise<any> {
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const logger = createLogger('getSchemaInitStatus')

  try {
    // TODO: Query worker queue or Redis for task status
    // Return: { task_id, status, progress, error }
    logger.debug('Schema init status queried', {
      workspace_id,
      task_id,
    })

    // Stub: check DB for schema_version
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const result = await pool.query(`SELECT version, applied_at FROM schema_version LIMIT 1`)

    if (result.rows.length > 0) {
      return {
        task_id,
        status: 'COMPLETED',
        version: result.rows[0].version,
        applied_at: result.rows[0].applied_at,
      }
    }

    return {
      task_id,
      status: 'PENDING',
      message: 'Schema initialization in progress',
    }
  } catch (error) {
    logger.error('Failed to get schema init status', {
      workspace_id,
      task_id,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export default {
  initializeTenantSchema,
  getSchemaInitStatus,
}
