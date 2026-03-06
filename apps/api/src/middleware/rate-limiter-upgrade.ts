/**
 * Rate limiter middleware (Task 21)
 * Limits upgrade attempts to 5 per hour per workspace
 *
 * Purpose: Enforce rate limits on schema upgrade endpoints
 * Layer: API Middleware
 * Transactional: No (read-only check)
 * Idempotent: Yes
 */

import { createLogger } from '@zidney/logger'
import type { Context, MiddlewareHandler, Next } from 'hono'
import type { Pool } from 'pg'

const logger = createLogger('rate-limiter-upgrade')

/**
 * Rate limit configuration for upgrades
 */
const UPGRADE_RATE_LIMIT = {
  maxAttempts: 5,
  windowHours: 1,
}

/**
 * Create rate limiter middleware for upgrade endpoints
 *
 * @param masterDb - Master database pool (MMC database)
 * @returns Middleware handler function
 */
export function createRateLimiterMiddleware(masterDb: Pool): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const workspaceId = c.req.param('workspace_id')
    const correlationId = c.get('correlation_id') || crypto.randomUUID()

    if (!workspaceId) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'MISSING_WORKSPACE_ID',
            message: 'Workspace ID is required',
          },
        },
        400
      )
    }

    try {
      // Query migration_registry for attempts in last hour
      const result = await masterDb.query(
        `SELECT COUNT(*) as count FROM migration_registry 
         WHERE workspace_id = $1 AND applied_at > now() - interval '1 hour'`,
        [workspaceId]
      )

      const attemptCount = parseInt(result.rows[0].count, 10)
      const limit = UPGRADE_RATE_LIMIT.maxAttempts

      if (attemptCount >= limit) {
        logger.warn('Rate limit exceeded for upgrade attempts', {
          workspace_id: workspaceId,
          correlation_id: correlationId,
          attempts: attemptCount,
          limit,
        })

        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: `Maximum ${limit} upgrade attempts per hour. Try again later.`,
            },
          },
          429
        )
      }

      logger.debug('Rate limit check passed', {
        workspace_id: workspaceId,
        correlation_id: correlationId,
        attempts: attemptCount,
        limit,
      })

      await next()
    } catch (error) {
      // On error, allow through (fail open for availability)
      logger.error('Rate limit check error', {
        workspace_id: workspaceId,
        correlation_id: correlationId,
        error: error instanceof Error ? error.message : String(error),
      })
      await next()
    }
  }
}

export default createRateLimiterMiddleware
