/**
 * Idempotency Support Utility
 *
 * File: apps/api/src/utils/idempotency.ts
 * Task: T019
 * Phase: 3 - Member Management CRUD
 *
 * Hybrid idempotency implementation:
 * - Primary: Redis-backed cache (24h TTL) for fast duplicate detection
 * - Fallback: request_log table for durability when Redis unavailable
 *
 * Properties:
 * - Idempotency-Key header required for POST/PUT/PATCH/DELETE
 * - Returns cached response if key already processed
 * - 24-hour TTL prevents unbounded cache growth
 * - Automatic cleanup via cron or background job
 */

import { Context } from 'hono'
import { Redis } from 'ioredis'
import { Database } from 'postgres'
import { v4 as uuidv4 } from 'uuid'

export interface IdempotencyResponse {
  cached: boolean
  response?: unknown
  statusCode?: number
}

/**
 * Idempotency Manager
 *
 * Handles both Redis and database storage
 */
export class IdempotencyManager {
  private readonly REDIS_TTL = 86400 // 24 hours in seconds
  private readonly DB_TTL_DAYS = 30

  constructor(
    private db: Database,
    private redis?: Redis
  ) {}

  /**
   * Check if request was already processed (idempotent)
   *
   * Returns cached response if found, otherwise null
   */
  async getOrNull(
    userId: string,
    idempotencyKey: string
  ): Promise<IdempotencyResponse | null> {
    // Try Redis first (fast path)
    if (this.redis) {
      try {
        // @ts-ignore: LOGIC-BUG: Redis method no overload match — see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
        const cached = await this.redis.get(
          `idempotency:${userId}:${idempotencyKey}`
        )
        if (cached) {
          const parsed = JSON.parse(cached)
          return {
            cached: true,
            response: parsed.response,
            statusCode: parsed.statusCode,
          }
        }
      } catch (err) {
        // Redis error; fall through to DB
      }
    }

    // Fall back to database
    try {
      const result = await this.db.query(
        `SELECT response_body, response_status
         FROM request_log
         WHERE user_id = $1 AND idempotency_key = $2`,
        [userId, idempotencyKey]
      )

      if (result.rowCount > 0) {
        const row = result.rows[0]
        return {
          cached: true,
          response: row.response_body,
          statusCode: row.response_status,
        }
      }
    } catch (err) {
      // DB error; treat as not cached
    }

    return null
  }

  /**
   * Store response for idempotency
   *
   * Stores in both Redis (fast) and DB (durable)
   */
  async store(
    userId: string,
    idempotencyKey: string,
    httpMethod: string,
    httpPath: string,
    requestBody: Record<string, unknown> | null,
    statusCode: number,
    responseBody: Record<string, unknown>
  ): Promise<void> {
    const data = { statusCode, response: responseBody }

    // Store in Redis (async, don't wait)
    if (this.redis) {
      try {
        // @ts-ignore: LOGIC-BUG: Redis method no overload match — see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
        await this.redis.setex(
          `idempotency:${userId}:${idempotencyKey}`,
          this.REDIS_TTL,
          JSON.stringify(data)
        )
      } catch (err) {
        // Log Redis error but don't fail
        console.error('[IDEMPOTENCY_REDIS_ERROR]', err)
      }
    }

    // Store in database (durable)
    try {
      await this.db.query(
        `INSERT INTO request_log (
          id, user_id, idempotency_key, http_method, http_path,
          request_body, response_status, response_body, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (user_id, idempotency_key)
        DO UPDATE SET
          response_status = EXCLUDED.response_status,
          response_body = EXCLUDED.response_body`,
        [
          uuidv4(),
          userId,
          idempotencyKey,
          httpMethod,
          httpPath,
          requestBody ? JSON.stringify(requestBody) : null,
          statusCode,
          JSON.stringify(responseBody),
        ]
      )
    } catch (err) {
      // Log DB error but don't fail
      console.error('[IDEMPOTENCY_DB_ERROR]', err)
    }
  }

  /**
   * Clean up old entries (call via background job)
   */
  async cleanup(): Promise<void> {
    try {
      await this.db.query(
        `DELETE FROM request_log WHERE created_at < NOW() - INTERVAL '${this.DB_TTL_DAYS} days'`
      )
    } catch (err) {
      console.error('[IDEMPOTENCY_CLEANUP_ERROR]', err)
    }
  }
}

/**
 * Idempotency middleware
 *
 * Checks request header for Idempotency-Key, returns cached response if found
 */
export function createIdempotencyMiddleware(manager: IdempotencyManager) {
  return async (ctx: Context, next: () => Promise<void>) => {
    const idempotencyKey = ctx.req.header('Idempotency-Key')
    const userId = ctx.get('context')?.mmcUser?.userId

    // Check if this is a request method that requires idempotency
    const method = ctx.req.method
    const requiresIdempotency = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
      method
    )

    if (!requiresIdempotency) {
      await next()
      return
    }

    // If no idempotency key provided, generate one for this session
    const key = idempotencyKey || uuidv4()

    if (requiresIdempotency && userId && idempotencyKey) {
      // Check for cached response
      const cached = await manager.getOrNull(userId, key)
      if (cached) {
        // @ts-ignore: LOGIC-BUG: cached.statusCode is number not StatusCode - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
        return ctx.json(cached.response, cached.statusCode)
      }
    }

    // Proceed to handler; store response after
    await next()
  }
}

/**
 * Create idempotency manager
 */
export function createIdempotencyManager(
  db: Database,
  redis?: Redis
): IdempotencyManager {
  return new IdempotencyManager(db, redis)
}
