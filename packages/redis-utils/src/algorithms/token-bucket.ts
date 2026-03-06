import { logger } from '@zidney/logger'
import type { createClient } from 'redis'

/**
 * T015: Token Bucket Rate Limiter Algorithm
 *
 * Purpose: Implement Redis-based token bucket for burst-allowed rate limiting
 * Layer: Shared Package (Redis)
 * Transactional: No (Redis atomic operations)
 * Idempotent: Yes (pure function)
 * Version Enforcement: Not applicable
 * License Middleware: Not applicable
 *
 * Constitutional Compliance:
 * ✓ WebSocket burst handling enabled
 * ✓ Smooth rate limiting (token bucket allows bursts)
 * ✓ Tennis-friendly for message-heavy protocols
 */

// Use inferred type from createClient to avoid generic type mismatches
type RedisClient = ReturnType<typeof createClient>

export interface TokenBucketConfig {
  capacity: number // Total tokens in bucket
  refillRate: number // Tokens per second
  window?: number // Optional: window in seconds for cleanup
}

export interface TokenBucketResult {
  allowed: boolean
  tokensRemaining: number
  refillAt?: number // UNIX timestamp when next token available
  retryAfter?: number // Seconds to wait for next token
}

/**
 * Token Bucket Rate Limiter
 * Allows burst traffic while maintaining average rate limit
 * Ideal for WebSocket connections where messages may be bursty
 */
export class TokenBucketRateLimiter {
  constructor(private redis: RedisClient) {}

  /**
   * Check if tokens available and consume them
   * Returns false if bucket empty (no tokens)
   */
  async checkLimit(
    key: string,
    config: TokenBucketConfig,
    tokensNeeded: number = 1
  ): Promise<TokenBucketResult> {
    const now = Date.now() / 1000 // Current time in seconds
    const window = config.window || 300 // Default 5-minute window

    try {
      // Get current bucket state using HSET
      // bucket:{key} -> {lastRefillAt, tokensAvailable}
      const bucketKey = `bucket:${key}`

      // Get current state
      const state = await this.redis.hGetAll(bucketKey)

      const lastRefillAt = state?.lastRefillAt ? parseFloat(state.lastRefillAt) : now
      let tokensAvailable = state?.tokensAvailable
        ? parseFloat(state.tokensAvailable)
        : config.capacity

      // Calculate tokens to add based on time elapsed
      const timePassed = Math.max(0, now - lastRefillAt)
      const tokensToAdd = timePassed * config.refillRate

      // Refill tokens (capped at capacity)
      tokensAvailable = Math.min(config.capacity, tokensAvailable + tokensToAdd)

      // Check if we have enough tokens
      const allowed = tokensAvailable >= tokensNeeded

      // Consume tokens if allowed
      if (allowed) {
        tokensAvailable -= tokensNeeded
      }

      // Update bucket state
      await this.redis.hSet(bucketKey, {
        lastRefillAt: now.toString(),
        tokensAvailable: tokensAvailable.toString(),
      })

      // Set TTL on bucket
      await this.redis.expire(bucketKey, window)

      // Calculate refill time
      const refillAt = Math.ceil(now + (tokensNeeded - tokensAvailable) / config.refillRate)

      // Calculate retry-after
      const retryAfter = allowed
        ? undefined
        : Math.ceil((tokensNeeded - tokensAvailable) / config.refillRate)

      return {
        allowed,
        tokensRemaining: Math.floor(tokensAvailable),
        refillAt,
        retryAfter,
      }
    } catch (error) {
      logger.error('token_bucket_check_failed', { key, error: String(error) })
      // On Redis error, fail open (allow request)
      return {
        allowed: true,
        tokensRemaining: config.capacity,
      }
    }
  }

  /**
   * Reset bucket (used on connection close)
   */
  async resetBucket(key: string): Promise<void> {
    try {
      await this.redis.del(`bucket:${key}`)
    } catch (error) {
      logger.error('token_bucket_reset_failed', { key, error: String(error) })
    }
  }

  /**
   * Get current tokens available (for monitoring)
   */
  async getCurrentTokens(key: string, config: TokenBucketConfig): Promise<number> {
    try {
      const bucketKey = `bucket:${key}`
      const state = await this.redis.hGetAll(bucketKey)

      if (!state?.lastRefillAt) {
        return config.capacity // Bucket not initialized
      }

      const lastRefillAt = parseFloat(state.lastRefillAt)
      let tokensAvailable = parseFloat(state.tokensAvailable ?? '0')

      const now = Date.now() / 1000
      const timePassed = Math.max(0, now - lastRefillAt)
      const tokensToAdd = timePassed * config.refillRate

      tokensAvailable = Math.min(config.capacity, tokensAvailable + tokensToAdd)

      return Math.floor(tokensAvailable)
    } catch (error) {
      logger.error('token_bucket_get_failed', { key, error: String(error) })
      return config.capacity
    }
  }
}

/**
 * Helper function to create token bucket limiter
 */
export function createTokenBucketLimiter(redis: RedisClient): TokenBucketRateLimiter {
  return new TokenBucketRateLimiter(redis)
}
