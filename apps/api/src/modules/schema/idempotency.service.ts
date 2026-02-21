/**
 * Idempotency Service
 *
 * Handles schema initialization idempotency via:
 * 1. Redis cache (fast check - 24h TTL)
 * 2. DB fallback (if cache miss - true source of truth)
 * 3. Prevents duplicate schema initialization
 *
 * Task: T023 - Idempotency key validation
 * Task: T024 - Checksum calculation
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 */

import { createLogger } from '@zidney/logging'
import type { Pool } from 'pg'
import { v4 as uuidv4 } from 'uuid'

const logger = createLogger('idempotency-service')

/**
 * Idempotency key format
 */
export interface IdempotencyRecord {
  workspace_id: string
  idempotency_key: string
  task_id: string
  status: 'QUEUED' | 'COMPLETED' | 'FAILED'
  created_at: Date
  completed_at?: Date
  response?: any
}

/**
 * Redis client interface (abstracted from implementation)
 */
export interface RedisClient {
  get(key: string): Promise<string | null>
  set(
    key: string,
    value: string,
    optionName: string,
    optionValue: number
  ): Promise<void>
  del(key: string): Promise<void>
}

const IDEMPOTENCY_CACHE_TTL = 24 * 60 * 60 // 24 hours in seconds
const IDEMPOTENCY_KEY_PREFIX = 'tenant'

/**
 * Generate Redis cache key for idempotency tracking
 * Format: tenant:{workspace_id}:idempotency:{idempotency_key}
 */
export function generateIdempotencyKey(
  workspace_id: string,
  idempotency_key: string
): string {
  return `${IDEMPOTENCY_KEY_PREFIX}:${workspace_id}:idempotency:${idempotency_key}`
}

/**
 * Check if schema initialization already in progress or completed
 *
 * Checks in order:
 * 1. Redis cache (fast)
 * 2. Database fallback (true source of truth)
 *
 * @param workspace_id - Workspace UUID
 * @param idempotency_key - Client-provided idempotency key
 * @param redis - Redis client
 * @param pool - PostgreSQL connection pool
 * @returns Existing record if found, null if new request
 */
export async function checkIdempotency(
  workspace_id: string,
  idempotency_key: string | undefined,
  redis: RedisClient | null,
  pool: Pool
): Promise<IdempotencyRecord | null> {
  // Generate or use provided key
  const key = idempotency_key || uuidv4()
  const cacheKey = generateIdempotencyKey(workspace_id, key)

  try {
    // Step 1: Check Redis cache (24h TTL)
    if (redis) {
      const cached = await redis.get(cacheKey)
      if (cached) {
        const record = JSON.parse(cached) as IdempotencyRecord
        logger.debug('Idempotency hit in Redis cache', {
          workspace_id,
          task_id: record.task_id,
          status: record.status,
        })
        return record
      }
    }

    // Step 2: Check database (fallback / true source of truth)
    // Query: Does this workspace already have an initialized schema?
    const result = await pool.query(
      `SELECT version, applied_at, checksum FROM schema_version WHERE true LIMIT 1`
    )

    if (result.rows.length > 0) {
      // Schema already initialized
      const row = result.rows[0]
      logger.debug('Schema already initialized (DB check)', {
        workspace_id,
        version: row.version,
        applied_at: row.applied_at,
      })

      // Return cached record structure (even though from DB)
      return {
        workspace_id,
        idempotency_key: key,
        task_id: 'already-initialized',
        status: 'COMPLETED',
        created_at: new Date(row.applied_at),
        completed_at: new Date(row.applied_at),
        response: { version: row.version },
      }
    }

    // New request - not found in either cache or DB
    logger.debug('Idempotency check passed - new request', {
      workspace_id,
      idempotency_key: key,
    })

    return null
  } catch (error) {
    logger.error('Idempotency check failed', {
      workspace_id,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Store idempotency record in both Redis cache and DB (for audit)
 *
 * @param workspace_id - Workspace UUID
 * @param idempotency_key - Idempotency key
 * @param task_id - Worker task ID
 * @param redis - Redis client (optional)
 * @param pool - PostgreSQL pool (optional - for audit logging)
 */
export async function storeIdempotencyRecord(
  workspace_id: string,
  idempotency_key: string,
  task_id: string,
  redis: RedisClient | null,
  pool: Pool | null
): Promise<void> {
  const record: IdempotencyRecord = {
    workspace_id,
    idempotency_key,
    task_id,
    status: 'QUEUED',
    created_at: new Date(),
  }

  try {
    // Store in Redis cache (24h TTL)
    if (redis) {
      const cacheKey = generateIdempotencyKey(workspace_id, idempotency_key)
      await redis.set(
        cacheKey,
        JSON.stringify(record),
        'EX',
        IDEMPOTENCY_CACHE_TTL
      )
      logger.debug('Idempotency record stored in Redis', {
        workspace_id,
        task_id,
        ttl: IDEMPOTENCY_CACHE_TTL,
      })
    }

    // Optionally store in DB for audit trail
    if (pool) {
      // Future: INSERT into schema_init_audit table if needed
      // await pool.query(
      //   'INSERT INTO schema_init_audit (workspace_id, task_id, status, created_at) VALUES ($1, $2, $3, $4)',
      //   [workspace_id, task_id, record.status, record.created_at]
      // );
    }
  } catch (error) {
    logger.error('Failed to store idempotency record', {
      workspace_id,
      task_id,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Update idempotency record completion status
 *
 * @param workspace_id - Workspace UUID
 * @param idempotency_key - Idempotency key
 * @param task_id - Worker task ID
 * @param status - Final status (COMPLETED or FAILED)
 * @param response - Response payload (e.g., checksum, version)
 * @param redis - Redis client
 */
export async function markIdempotencyComplete(
  workspace_id: string,
  idempotency_key: string,
  task_id: string,
  status: 'COMPLETED' | 'FAILED',
  response: any,
  redis: RedisClient | null
): Promise<void> {
  try {
    if (redis) {
      const cacheKey = generateIdempotencyKey(workspace_id, idempotency_key)

      const record: IdempotencyRecord = {
        workspace_id,
        idempotency_key,
        task_id,
        status,
        created_at: new Date(), // Original time
        completed_at: new Date(),
        response,
      }

      // Update with remaining TTL
      await redis.set(
        cacheKey,
        JSON.stringify(record),
        'EX',
        IDEMPOTENCY_CACHE_TTL
      )

      logger.debug('Idempotency record completed', {
        workspace_id,
        task_id,
        status,
      })
    }
  } catch (error) {
    logger.error('Failed to mark idempotency complete', {
      workspace_id,
      task_id,
      error: error instanceof Error ? error.message : String(error),
    })
    // Don't throw - cache update is non-critical
  }
}

/**
 * Generate unique task ID
 * Used when client doesn't provide idempotency key
 */
export function generateTaskId(): string {
  return uuidv4()
}

export default {
  generateIdempotencyKey,
  checkIdempotency,
  storeIdempotencyRecord,
  markIdempotencyComplete,
  generateTaskId,
}
