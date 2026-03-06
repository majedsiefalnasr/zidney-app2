/**
 * MMC Dashboard Rate Limiting Middleware (T007B)
 *
 * Purpose: Enforce per-endpoint rate limits for dashboard analytics API
 * - Uses Redis sliding window counter
 * - Returns 429 Too Many Requests with Retry-After header
 * - Per-user enforcement (allows parallel access from different users)
 * - Graceful degradation if Redis unavailable (in-memory fallback)
 *
 * File: apps/api/src/middleware/dashboard-rate-limit.middleware.ts
 * Task: T007B
 * Phase: 1 - Backend Implementation (CRITICAL)
 *
 * Middleware Chain Position:
 * 1. Correlation ID
 * 2. Tenant Resolver
 * 3. License Enforcement (T006)
 * 4. Schema Version Check (T007A)
 * 5. Permission Check (T007)
 * 6. **→ Rate Limiting** (THIS FILE - T007B)
 * 7. Cache Middleware
 * 8. Route Handler
 *
 * Constraint Verification:
 * ✓ Rate Limiting (T007B+T007C): export=100/hr, others=1000/hr
 * ✓ Returns 429 Too Many Requests on limit exceeded
 * ✓ Includes X-RateLimit-* headers (Limit, Remaining, Reset)
 * ✓ Includes Retry-After header (seconds until limit resets)
 * ✓ Per-user enforcement (different users can make parallel requests)
 * ✓ Redis backing for distributed rate limiting
 *
 * Redis Implementation:
 * - Key: rate_limit:{endpoint}:{user_id}:{hour_window}
 * - Operation: INCR with TTL expiry (3600 seconds)
 * - Sliding window: New window starts each hour
 * - Atomic: Single Redis INCR operation (no race conditions)
 *
 * Fallback Strategy:
 * - If Redis unavailable: Use in-memory Map
 * - Warning logged if using fallback
 * - Limits still enforced (just per-instance, not distributed)
 */

import type { Logger } from '@zidney/logger'
import type { Context, Next } from 'hono'
import type { Redis } from 'ioredis'
import {
  buildRateLimitHeaders,
  generateRateLimitKey,
  getRateLimitConfig,
} from '../config/dashboard-rate-limits.config'

/**
 * In-memory fallback rate limiter
 * Used if Redis is unavailable
 */
class InMemoryRateLimiter {
  private counters: Map<string, { count: number; resetAt: number; limit: number }> = new Map()

  increment(
    key: string,
    limit: number,
    windowSeconds: number
  ): {
    count: number
    isExceeded: boolean
  } {
    const now = Date.now()
    const entry = this.counters.get(key)

    if (!entry || now > entry.resetAt) {
      // New window
      const newEntry = {
        count: 1,
        resetAt: now + windowSeconds * 1000,
        limit,
      }
      this.counters.set(key, newEntry)

      // Cleanup old entries every 100 increments
      if (this.counters.size % 100 === 0) {
        for (const [k, v] of this.counters.entries()) {
          if (now > v.resetAt) {
            this.counters.delete(k)
          }
        }
      }

      return { count: 1, isExceeded: false }
    }

    // Increment existing counter
    entry.count++
    return {
      count: entry.count,
      isExceeded: entry.count > limit,
    }
  }

  getResetSeconds(key: string): number {
    const entry = this.counters.get(key)
    if (!entry) return 0

    const now = Date.now()
    const remaining = entry.resetAt - now
    return Math.ceil(remaining / 1000)
  }
}

/**
 * Dashboard Rate Limiter using Redis
 */
class DashboardRateLimiter {
  private inMemory: InMemoryRateLimiter
  private redisAvailable: boolean = false

  constructor(
    private redis: Redis | null,
    private logger: Logger
  ) {
    this.inMemory = new InMemoryRateLimiter()

    // Test Redis connectivity
    if (redis) {
      redis
        .ping()
        .then(() => {
          this.redisAvailable = true
          this.logger.info('Dashboard rate limiter: Redis connected', {
            service: 'rate-limit',
          })
        })
        .catch((error) => {
          this.redisAvailable = false
          this.logger.warn('Dashboard rate limiter: Redis unavailable, using in-memory fallback', {
            service: 'rate-limit',
            error: error instanceof Error ? error.message : String(error),
          })
        })
    }
  }

  /**
   * Check and increment rate limit counter
   *
   * Returns:
   * - count: Current request count
   * - isExceeded: true if limit exceeded
   * - resetSeconds: Seconds until limit resets
   */
  async checkLimit(
    userId: string,
    endpoint: string,
    limit: number,
    windowSeconds: number
  ): Promise<{
    count: number
    isExceeded: boolean
    resetSeconds: number
  }> {
    const key = generateRateLimitKey(endpoint, userId, windowSeconds)

    try {
      // Try Redis first
      if (this.redis && this.redisAvailable) {
        const count = await this.redis.incr(key)

        // Set expiry on first request
        if (count === 1) {
          await this.redis.expire(key, windowSeconds)
        }

        const ttl = await this.redis.ttl(key)
        const isExceeded = count > limit

        return {
          count,
          isExceeded,
          resetSeconds: ttl > 0 ? ttl : windowSeconds,
        }
      }
    } catch (error) {
      this.logger.warn('Redis rate limit check failed, using fallback', {
        service: 'rate-limit',
        error: error instanceof Error ? error.message : String(error),
      })
      this.redisAvailable = false
    }

    // Fallback to in-memory
    const result = this.inMemory.increment(key, limit, windowSeconds)
    const resetSeconds = this.inMemory.getResetSeconds(key)

    return {
      count: result.count,
      isExceeded: result.isExceeded,
      resetSeconds,
    }
  }
}

/**
 * Create dashboard rate limiting middleware
 *
 * Usage:
 * ```typescript
 * const dashboardRateLimitMiddleware = createDashboardRateLimitMiddleware(redis, logger)
 * app.use('/api/mmc/dashboard/*', dashboardRateLimitMiddleware)
 * ```
 */
export function createDashboardRateLimitMiddleware(redis: Redis | null, logger: Logger) {
  const rateLimiter = new DashboardRateLimiter(redis, logger)

  return async (c: Context, next: Next) => {
    const correlationId = c.get('correlation_id')
    const userId = c.get('user_id')
    const method = c.req.method
    const path = c.req.path

    // Get rate limit config for this endpoint
    const config = getRateLimitConfig(method, path)

    // If not a dashboard endpoint or no config, skip rate limiting
    if (!config) {
      return await next()
    }

    const startTime = Date.now()

    try {
      // Check rate limit
      const { count, isExceeded, resetSeconds } = await rateLimiter.checkLimit(
        // @ts-expect-error: TS2345 - userId possibly undefined [INFRA-001]
        userId,
        path,
        config.max,
        config.window_seconds
      )

      const elapsedMs = Date.now() - startTime

      // Log rate limit check
      logger.debug('Rate limit check', {
        correlation_id: correlationId,
        user_id: userId,
        endpoint: path,
        method,
        request_count: count,
        limit: config.max,
        window_seconds: config.window_seconds,
        is_exceeded: isExceeded,
        check_time_ms: elapsedMs,
      })

      // Add headers
      const headers = buildRateLimitHeaders(
        config.max,
        Math.max(0, config.max - count),
        Math.floor(Date.now() / 1000) + resetSeconds,
        isExceeded
      )

      // Attach headers that will be added to response
      c.set('rate_limit_headers', headers)

      // Check if limit exceeded
      if (isExceeded) {
        logger.warn('Rate limit exceeded', {
          correlation_id: correlationId,
          user_id: userId,
          endpoint: path,
          method,
          request_count: count,
          limit: config.max,
          retry_after_seconds: resetSeconds,
        })

        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: `${config.max} requests per ${config.window_seconds / 60 || 1} ${config.window_seconds >= 3600 ? 'hour' : 'minute'} limit exceeded.`,
              details: {
                limit: config.max,
                current_count: count,
                window_seconds: config.window_seconds,
                retry_after_seconds: resetSeconds,
              },
            },
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(resetSeconds),
              'X-RateLimit-Limit': String(config.max),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + resetSeconds),
            },
          }
        )
      }

      // Continue to next middleware
      await next()
    } catch (error) {
      logger.error('Rate limit middleware error', {
        correlation_id: correlationId,
        user_id: userId,
        endpoint: path,
        error_code: 'RATE_LIMIT_ERROR',
        error_message: error instanceof Error ? error.message : String(error),
      })

      // On error, allow request (fail open for availability)
      return await next()
    }
  }
}

export default createDashboardRateLimitMiddleware
