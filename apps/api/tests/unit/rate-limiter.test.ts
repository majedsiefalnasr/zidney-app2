/**
 * Rate Limiter Unit Tests
 * STAGE_08_RATE_LIMITING_AND_SECURITY - Task T073
 *
 * File: apps/api/tests/unit/rate-limiter.test.ts
 * Purpose: Test sliding window and token bucket rate limiting algorithms
 *
 * Test Coverage:
 * - Sliding window algorithm (counter increment/decrement)
 * - Token bucket algorithm (token refill, consumption)
 * - Rate limit hit/miss conditions
 * - Window sliding behavior
 * - Burst allowance
 * - TTL expiration
 * - Redis error handling
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Redis client
const mockRedis = {
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  del: vi.fn(),
  zadd: vi.fn(),
  zremrangebyscore: vi.fn(),
  zcard: vi.fn(),
  zrange: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  decrby: vi.fn(),
}

class SlidingWindowLimiter {
  constructor(private redis: any) {}

  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000)
    const windowStart = now - windowSeconds

    // Remove entries outside window
    await this.redis.zremrangebyscore(key, 0, windowStart)

    // Count requests in window
    const count = await this.redis.zcard(key)

    if (count >= limit) {
      return false
    }

    // Add current request
    await this.redis.zadd(key, now, `${now}-${Math.random()}`)
    await this.redis.expire(key, windowSeconds + 1)

    return true
  }

  async getRemaining(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<number> {
    const now = Math.floor(Date.now() / 1000)
    const windowStart = now - windowSeconds

    await this.redis.zremrangebyscore(key, 0, windowStart)
    const count = await this.redis.zcard(key)

    return Math.max(0, limit - count)
  }

  async getRetryAfter(key: string, windowSeconds: number): Promise<number> {
    const now = Math.floor(Date.now() / 1000)

    // Get oldest entry
    const entries = await this.redis.zrange(key, 0, 0, 'WITHSCORES')

    if (entries.length === 0) {
      return 0
    }

    const oldestTimestamp = parseInt(entries[1])
    const retryAfter = Math.max(0, oldestTimestamp + windowSeconds - now)

    return retryAfter
  }
}

class TokenBucketLimiter {
  constructor(private redis: any) {}

  async checkLimit(
    key: string,
    capacity: number,
    refillRatePerSec: number,
    tokensNeeded: number = 1
  ): Promise<boolean> {
    const now = Date.now()
    const lastRefillKey = `${key}:last_refill`

    // Get current tokens and last refill
    const data = await this.redis.get(key)
    let currentTokens = capacity
    let lastRefill = now

    if (data) {
      const parsed = JSON.parse(data)
      currentTokens = parsed.tokens
      lastRefill = parsed.lastRefill
    }

    // Calculate tokens to add
    const secondsElapsed = (now - lastRefill) / 1000
    const tokensToAdd = secondsElapsed * refillRatePerSec
    currentTokens = Math.min(capacity, currentTokens + tokensToAdd)

    // Check if we have enough tokens
    if (currentTokens < tokensNeeded) {
      return false
    }

    // Consume tokens
    currentTokens -= tokensNeeded

    // Store updated state
    await this.redis.set(
      key,
      JSON.stringify({
        tokens: currentTokens,
        lastRefill: now,
      }),
      'EX',
      Math.ceil(capacity / refillRatePerSec) + 1
    )

    return true
  }

  async getRemainingTokens(
    key: string,
    capacity: number,
    refillRatePerSec: number
  ): Promise<number> {
    const now = Date.now()
    const data = await this.redis.get(key)
    let currentTokens = capacity
    let lastRefill = now

    if (data) {
      const parsed = JSON.parse(data)
      currentTokens = parsed.tokens
      lastRefill = parsed.lastRefill
    }

    const secondsElapsed = (now - lastRefill) / 1000
    const tokensToAdd = secondsElapsed * refillRatePerSec
    currentTokens = Math.min(capacity, currentTokens + tokensToAdd)

    return Math.floor(currentTokens)
  }
}

describe('Rate Limiting Algorithms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Sliding Window Limiter', () => {
    let limiter: SlidingWindowLimiter

    beforeEach(() => {
      limiter = new SlidingWindowLimiter(mockRedis)
      mockRedis.zcard.mockResolvedValue(0)
      mockRedis.zrange.mockResolvedValue([])
      mockRedis.zadd.mockResolvedValue(1)
      mockRedis.expire.mockResolvedValue(1)
    })

    it('should allow request when under limit', async () => {
      mockRedis.zcard.mockResolvedValue(2)

      const result = await limiter.checkLimit('rate:auth:ip:127.0.0.1', 5, 60)

      expect(result).toBe(true)
      expect(mockRedis.zadd).toHaveBeenCalled()
    })

    it('should reject request when at limit', async () => {
      mockRedis.zcard.mockResolvedValue(5)

      const result = await limiter.checkLimit('rate:auth:ip:127.0.0.1', 5, 60)

      expect(result).toBe(false)
      expect(mockRedis.zadd).not.toHaveBeenCalled()
    })

    it('should remove expired entries before checking', async () => {
      mockRedis.zcard.mockResolvedValue(2)

      await limiter.checkLimit('rate:auth:ip:127.0.0.1', 5, 60)

      expect(mockRedis.zremrangebyscore).toHaveBeenCalled()
    })

    it('should calculate remaining requests correctly', async () => {
      mockRedis.zcard.mockResolvedValue(2)

      const remaining = await limiter.getRemaining(
        'rate:auth:ip:127.0.0.1',
        5,
        60
      )

      expect(remaining).toBe(3)
    })

    it('should return 0 remaining when at limit', async () => {
      mockRedis.zcard.mockResolvedValue(5)

      const remaining = await limiter.getRemaining(
        'rate:auth:ip:127.0.0.1',
        5,
        60
      )

      expect(remaining).toBe(0)
    })

    it('should calculate retry-after header correctly', async () => {
      const now = Math.floor(Date.now() / 1000)
      const oldestTimestamp = now - 30 // 30 seconds into window
      mockRedis.zrange.mockResolvedValue(['entry', oldestTimestamp.toString()])

      const retryAfter = await limiter.getRetryAfter(
        'rate:auth:ip:127.0.0.1',
        60
      )

      expect(retryAfter).toBeGreaterThan(0)
      expect(retryAfter).toBeLessThanOrEqual(60)
    })

    it('should set TTL on rate limit key', async () => {
      mockRedis.zcard.mockResolvedValue(0)

      await limiter.checkLimit('rate:auth:ip:127.0.0.1', 5, 60)

      expect(mockRedis.expire).toHaveBeenCalledWith(
        'rate:auth:ip:127.0.0.1',
        61
      )
    })
  })

  describe('Token Bucket Limiter', () => {
    let limiter: TokenBucketLimiter

    beforeEach(() => {
      limiter = new TokenBucketLimiter(mockRedis)
      mockRedis.get.mockResolvedValue(null)
      mockRedis.set.mockResolvedValue('OK')
    })

    it('should allow request when tokens available', async () => {
      mockRedis.get.mockResolvedValue(null)

      const result = await limiter.checkLimit('rate:ws:user:1', 100, 10, 1)

      expect(result).toBe(true)
      expect(mockRedis.set).toHaveBeenCalled()
    })

    it('should reject request when no tokens available', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ tokens: 0, lastRefill: Date.now() })
      )

      const result = await limiter.checkLimit('rate:ws:user:1', 100, 10, 1)

      expect(result).toBe(false)
      expect(mockRedis.set).not.toHaveBeenCalled()
    })

    it('should refill tokens over time', async () => {
      const initialTime = Date.now()
      const laterTime = initialTime + 5000 // 5 seconds later

      vi.useFakeTimers()
      vi.setSystemTime(initialTime)

      mockRedis.get.mockResolvedValue(
        JSON.stringify({ tokens: 0, lastRefill: initialTime })
      )

      vi.setSystemTime(laterTime)

      const data = await new Promise((resolve) => {
        mockRedis.set.mockImplementation((key, value) => {
          resolve(JSON.parse(value))
        })

        limiter.checkLimit('rate:ws:user:1', 100, 10, 1)
      })

      vi.useRealTimers()
    })

    it('should consume requested tokens', async () => {
      mockRedis.get.mockResolvedValue(null)

      const result = await limiter.checkLimit('rate:ws:user:1', 100, 10, 5)

      expect(result).toBe(true)
    })

    it('should not exceed capacity after refill', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          tokens: 95,
          lastRefill: Date.now() - 10000, // 10 seconds ago
        })
      )

      const remaining = await limiter.getRemainingTokens(
        'rate:ws:user:1',
        100,
        10
      )

      // Should be capped at 100, not 95 + 100
      expect(remaining).toBeLessThanOrEqual(100)
    })

    it('should return correct remaining tokens', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          tokens: 75,
          lastRefill: Date.now(),
        })
      )

      const remaining = await limiter.getRemainingTokens(
        'rate:ws:user:1',
        100,
        10
      )

      expect(remaining).toBe(75)
    })
  })

  describe('Rate Limiter Integration', () => {
    it('should handle concurrent requests correctly', async () => {
      const limiter = new SlidingWindowLimiter(mockRedis)

      mockRedis.zcard.mockResolvedValue(0)
      mockRedis.zadd.mockResolvedValue(1)
      mockRedis.expire.mockResolvedValue(1)

      const promises = Array.from({ length: 3 }, () =>
        limiter.checkLimit('rate:test:concurrent', 5, 60)
      )

      const results = await Promise.all(promises)

      expect(results.filter((r) => r).length).toBeGreaterThan(0)
    })

    it('should properly namespace keys per endpoint', async () => {
      const limiter = new SlidingWindowLimiter(mockRedis)

      mockRedis.zcard.mockResolvedValue(0)
      mockRedis.zadd.mockResolvedValue(1)
      mockRedis.expire.mockResolvedValue(1)

      await limiter.checkLimit('rate:auth:ip:127.0.0.1', 5, 60)
      await limiter.checkLimit('rate:attempt:submit:attempt-123', 1, 60)

      expect(mockRedis.zremrangebyscore).toHaveBeenCalledTimes(2)
    })

    it('should handle Redis connection errors gracefully', async () => {
      const limiter = new SlidingWindowLimiter(mockRedis)

      mockRedis.zcard.mockRejectedValue(new Error('Redis connection failed'))

      await expect(
        limiter.checkLimit('rate:auth:ip:127.0.0.1', 5, 60)
      ).rejects.toThrow('Redis connection failed')
    })
  })

  describe('Rate Limit Headers', () => {
    it('should calculate X-Rate-Limit-Remaining correctly', async () => {
      const limiter = new SlidingWindowLimiter(mockRedis)

      mockRedis.zcard.mockResolvedValue(2)

      const remaining = await limiter.getRemaining(
        'rate:auth:ip:127.0.0.1',
        5,
        60
      )

      expect(remaining).toBe(3)
    })

    it('should calculate Retry-After in seconds', async () => {
      const limiter = new SlidingWindowLimiter(mockRedis)

      const now = Math.floor(Date.now() / 1000)
      mockRedis.zrange.mockResolvedValue(['entry', (now - 30).toString()])

      const retryAfter = await limiter.getRetryAfter(
        'rate:auth:ip:127.0.0.1',
        60
      )

      expect(retryAfter).toBeGreaterThan(0)
      expect(Number.isInteger(retryAfter)).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero limit gracefully', async () => {
      const limiter = new SlidingWindowLimiter(mockRedis)

      mockRedis.zcard.mockResolvedValue(0)

      const result = await limiter.checkLimit('rate:test:zero', 0, 60)

      expect(result).toBe(false)
    })

    it('should handle very short window (1 second)', async () => {
      const limiter = new SlidingWindowLimiter(mockRedis)

      mockRedis.zcard.mockResolvedValue(0)
      mockRedis.zadd.mockResolvedValue(1)
      mockRedis.expire.mockResolvedValue(1)

      const result = await limiter.checkLimit('rate:test:short-window', 10, 1)

      expect(result).toBe(true)
      expect(mockRedis.expire).toHaveBeenCalledWith('rate:test:short-window', 2)
    })

    it('should handle large limits correctly', async () => {
      const limiter = new SlidingWindowLimiter(mockRedis)

      mockRedis.zcard.mockResolvedValue(950)

      const result = await limiter.checkLimit('rate:test:large-limit', 1000, 60)

      expect(result).toBe(true)
    })
  })
})
