import { createLogger } from '@zidney/logger'
import { redis } from '../../infrastructure/redis'

const logger = createLogger('ws-rate-limiter')

/**
 * T034: WebSocket message rate limiting using sliding window algorithm
 *
 * Enforces per-connection rate limiting:
 * - Max 100 messages per 60 seconds
 * - Max 10 messages per second (burst limit)
 * - Uses Redis ZSET for efficient sliding window management
 */

interface RateLimitStatus {
  allowed: boolean
  messagesIn60s: number
  messagesIn1s: number
  retryAfterMs?: number
}

export class WebSocketRateLimiter {
  private readonly maxMessagesPerWindow = 100
  private readonly windowSizeMs = 60000 // 60 seconds
  private readonly maxBurstRate = 10 // messages per second
  private readonly burstWindowMs = 1000 // 1 second

  /**
   * Check if message is allowed under rate limit
   * Returns { allowed, messagesIn60s, messagesIn1s, retryAfterMs }
   */
  async checkRateLimit(
    userId: string,
    attemptId: string
  ): Promise<RateLimitStatus> {
    const now = Date.now()
    const windowStart = now - this.windowSizeMs
    const burstWindowStart = now - this.burstWindowMs

    const key = `ws:msg:${userId}:${attemptId}`

    try {
      // Remove old messages outside the 60-second window
      await redis.zRemRangeByScore(key, 0, windowStart)

      // Count messages in current 60-second window
      const messagesIn60s = await redis.zCard(key)

      // Count messages in last 1 second (burst window)
      const messagesIn1s = await redis.zCount(key, burstWindowStart, now)

      // Check burst limit first (stricter)
      if (messagesIn1s >= this.maxBurstRate) {
        logger.warn(`WebSocket rate limit: burst exceeded`, {
          user_id: userId,
          attempt_id: attemptId,
          messages_in_1s: messagesIn1s,
          max_burst_rate: this.maxBurstRate,
        })

        return {
          allowed: false,
          messagesIn60s,
          messagesIn1s,
          retryAfterMs: this.burstWindowMs,
        }
      }

      // Check 60-second window limit
      if (messagesIn60s >= this.maxMessagesPerWindow) {
        logger.warn(`WebSocket rate limit: window exceeded`, {
          user_id: userId,
          attempt_id: attemptId,
          messages_in_60s: messagesIn60s,
          max_messages_per_window: this.maxMessagesPerWindow,
        })

        // Calculate retry-after: when oldest message expires
        // Get the oldest message (lowest score) using zRange with index
        const oldestMessage = await redis.zRange(key, 0, 0)
        // If we have messages, get the score of the oldest one
        let retryAfterMs = this.windowSizeMs
        if (oldestMessage.length >= 1) {
          // Get the score of the oldest message
          const score = await redis.zScore(key, oldestMessage[0])
          if (score !== null) {
            retryAfterMs = Number(score) + this.windowSizeMs - now
          }
        }

        return {
          allowed: false,
          messagesIn60s,
          messagesIn1s,
          retryAfterMs: Math.max(0, retryAfterMs),
        }
      }

      // Add message to window
      await redis.zAdd(key, { score: now, value: `${now}:${Math.random()}` })

      // Set key expiration (60 seconds past last message)
      await redis.expire(key, 70)

      return {
        allowed: true,
        messagesIn60s: messagesIn60s + 1,
        messagesIn1s: messagesIn1s + 1,
      }
    } catch (error) {
      logger.error(`WebSocket rate limiter error`, {
        user_id: userId,
        attempt_id: attemptId,
        error: error instanceof Error ? error.message : String(error),
      })

      // On error, allow message but log
      return {
        allowed: true,
        messagesIn60s: -1,
        messagesIn1s: -1,
      }
    }
  }

  /**
   * Reset rate limiting for a user/attempt connection
   * Called when connection is established
   */
  async resetLimit(userId: string, attemptId: string): Promise<void> {
    const key = `ws:msg:${userId}:${attemptId}`
    try {
      await redis.del(key)
      logger.debug(`WebSocket rate limit reset`, {
        user_id: userId,
        attempt_id: attemptId,
      })
    } catch (error) {
      logger.warn(`WebSocket rate limit reset error`, {
        user_id: userId,
        attempt_id: attemptId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getStatus(userId: string, attemptId: string): Promise<RateLimitStatus> {
    const now = Date.now()
    const windowStart = now - this.windowSizeMs
    const burstWindowStart = now - this.burstWindowMs

    const key = `ws:msg:${userId}:${attemptId}`

    try {
      const messagesIn60s = await redis.zCount(key, windowStart, now)
      const messagesIn1s = await redis.zCount(key, burstWindowStart, now)

      return {
        allowed:
          messagesIn60s < this.maxMessagesPerWindow &&
          messagesIn1s < this.maxBurstRate,
        messagesIn60s,
        messagesIn1s,
      }
    } catch (error) {
      logger.warn(`WebSocket rate limit status check error`, {
        user_id: userId,
        attempt_id: attemptId,
        error: error instanceof Error ? error.message : String(error),
      })

      return {
        allowed: true,
        messagesIn60s: -1,
        messagesIn1s: -1,
      }
    }
  }
}

export const wsRateLimiter = new WebSocketRateLimiter()
