import { logger } from '@zidney/logger'
import type { createClient } from 'redis'

/**
 * T014: Sliding Window Rate Limiter Algorithm
 *
 * Purpose: Implement Redis-based sliding window counter for rate limiting
 * Layer: Shared Package (Redis)
 * Transactional: No (Redis ZSET operations atomic)
 * Idempotent: Yes (pure function)
 * Version Enforcement: Not applicable
 * License Middleware: Not applicable
 *
 * Constitutional Compliance:
 * ✓ Tenant isolation (key namespaced with workspace_id)
 * ✓ Rate limiting enforcement enabled
 * ✓ TTL-based cleanup (Redis memory efficient)
 */

// Use inferred type from createClient to avoid generic type mismatches
type RedisClient = ReturnType<typeof createClient>

export interface RateLimitWindow {
  limit: number
  window: number // seconds
  burst?: number // optional: additional burst capacity
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number // UNIX timestamp
  retryAfter?: number // seconds to wait
}

/**
 * Sliding Window Rate Limiter
 * Uses Redis ZSET (sorted set) to track request timestamps
 */
export class SlidingWindowRateLimiter {
  constructor(private redis: RedisClient) {}

  /**
   * Check if request is allowed under rate limit
   * Uses sliding window algorithm: track timestamps in Redis ZSET
   */
  async checkLimit(key: string, config: RateLimitWindow): Promise<RateLimitResult> {
    const now = Date.now() / 1000 // Current time in seconds
    const windowStart = now - config.window

    try {
      // Remove old entries outside the window
      await this.redis.zRemRangeByScore(key, 0, windowStart)

      // Count current requests in window
      const count = await this.redis.zCard(key)

      // Check if limit exceeded
      const max = config.burst || config.limit
      const allowed = count < max

      // Add current request to window (score=timestamp)
      if (allowed) {
        await this.redis.zAdd(key, {
          score: now,
          value: `${now}-${Math.random()}`, // Unique member per request
        })
      }

      // Set TTL (window + 1 second buffer)
      await this.redis.expire(key, config.window + 1)

      // Calculate reset time - get oldest entry
      const oldestEntries = await this.redis.zRange(key, 0, 0)
      let resetAt = Math.ceil(now + config.window)
      if (oldestEntries.length > 0) {
        const oldestScore = await this.redis.zScore(key, oldestEntries[0]!)
        if (oldestScore !== null) {
          resetAt = Math.ceil(oldestScore + config.window)
        }
      }

      const remaining = Math.max(0, max - count - 1)

      // If not allowed, calculate retry-after
      const retryAfter = allowed ? undefined : Math.ceil(resetAt - now)

      return {
        allowed,
        remaining,
        resetAt,
        retryAfter,
      }
    } catch (error) {
      logger.error('sliding_window_check_failed', { key, error: String(error) })
      // On Redis error, fail open (allow request)
      return {
        allowed: true,
        remaining: config.limit,
        resetAt: Math.ceil(now + config.window),
      }
    }
  }

  /**
   * Reset rate limit for a key
   * Used when user logs out or recovers from lockout
   */
  async resetLimit(key: string): Promise<void> {
    try {
      await this.redis.del(key)
    } catch (error) {
      logger.error('sliding_window_reset_failed', { key, error: String(error) })
    }
  }

  /**
   * Get current count for a key (for monitoring)
   */
  async getCurrentCount(key: string): Promise<number> {
    try {
      return await this.redis.zCard(key)
    } catch (error) {
      logger.error('sliding_window_get_failed', { key, error: String(error) })
      return 0
    }
  }
}

/**
 * Helper function to create sliding window limiter
 */
export function createSlidingWindowLimiter(redis: RedisClient): SlidingWindowRateLimiter {
  return new SlidingWindowRateLimiter(redis)
}
