/**
 * Rate limiter middleware (Task 21)
 * Limits upgrade attempts to 5 per hour per workspace
 */

import { NextFunction, Request, Response } from 'express'
import { Database } from 'pg'

/**
 * Create rate limiter middleware for upgrade endpoints
 */
export function createRateLimiterMiddleware(masterDb: Database) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { workspace_id } = req.params
    const correlation_id =
      req.headers['x-correlation-id'] || crypto.randomUUID()

    try {
      // Query migration_registry for attempts in last hour
      const result = await masterDb.query(
        `SELECT COUNT(*) as count FROM migration_registry 
         WHERE workspace_id = $1 AND applied_at > now() - interval '1 hour'`,
        [workspace_id]
      )

      const attemptCount = parseInt(result.rows[0].count, 10)
      const limit = 5

      if (attemptCount >= limit) {
        console.log(
          JSON.stringify({
            level: 'WARN',
            service: 'rate-limiter',
            event: 'rate_limit_exceeded',
            workspace_id,
            correlation_id,
            attempts: attemptCount,
            limit,
            timestamp: new Date().toISOString(),
          })
        )

        return res.status(429).json({
          success: false,
          data: null,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Maximum ${limit} upgrade attempts per hour. Try again later.`,
          },
        })
      }

      console.log(
        JSON.stringify({
          level: 'DEBUG',
          service: 'rate-limiter',
          event: 'rate_limit_check_passed',
          workspace_id,
          correlation_id,
          attempts: attemptCount,
          limit,
          timestamp: new Date().toISOString(),
        })
      )

      next()
    } catch (err: any) {
      // On error, allow through (fail open for availability)
      next()
    }
  }
}

import crypto from 'crypto'
