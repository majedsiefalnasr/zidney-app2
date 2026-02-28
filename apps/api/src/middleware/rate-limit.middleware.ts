/**
 * Rate Limiting Middleware (Enhanced)
 *
 * File: apps/api/src/middleware/rate-limit.middleware.ts
 * Tasks: T030 (initial), T062 (per-endpoint configuration)
 * Phase: 5 (initial) + Phase 8 (polish)
 *
 * Redis-backed rate limiting for all endpoints
 * Prevents brute force attacks and API abuse with per-IP, per-endpoint tracking
 *
 * Properties:
 * - Configurable per endpoint (GET: 60/min, POST: 10-20/min, DELETE: 5/min)
 * - Login brute force protection: 5 attempts/min/IP
 * - Invitations rate limit: 20/hour/IP
 * - Fallback to in-memory tracking if Redis unavailable
 * - Returns 429 Too Many Requests with Retry-After header
 */

import { Context, Next } from 'hono'
import { Redis } from 'ioredis'

const LOGIN_ATTEMPTS_LIMIT = 5
const LOGIN_ATTEMPTS_WINDOW = 60 // 1 minute in seconds
const IN_MEMORY_LIMIT = 1000 // max entries to store in memory

/**
 * Per-endpoint rate limit configurations (T062)
 * Following REST conventions:
 * - GET (read): 60/min (safe operations)
 * - POST (create): 10-20/min (write operations, more restrictive)
 * - DELETE (delete): 5/min (most restrictive)
 * - Authentication: 5/min (brute force protection)
 */
export const RATE_LIMIT_CONFIG: Record<
  string,
  { max: number; windowMs: number; message?: string }
> = {
  // Read endpoints (60/min)
  'GET:/mmc/members': { max: 60, windowMs: 60000 },
  'GET:/mmc/members/:id': { max: 60, windowMs: 60000 },
  'GET:/mmc/roles': { max: 60, windowMs: 60000 },
  'GET:/mmc/roles/:id': { max: 60, windowMs: 60000 },
  'GET:/mmc/roles/:id/permissions': { max: 60, windowMs: 60000 },
  'GET:/mmc/invitations': { max: 60, windowMs: 60000 },
  'GET:/mmc/permissions/check': { max: 60, windowMs: 60000 },

  // Create endpoints (10-20/min)
  'POST:/mmc/members': { max: 10, windowMs: 60000 },
  'POST:/mmc/invitations': {
    max: 20,
    windowMs: 3600000,
    message: 'Max 20 invitations per hour',
  }, // 20/hour
  'POST:/mmc/roles/:id/permissions': { max: 10, windowMs: 60000 },

  // Update endpoints (10-20/min)
  'PATCH:/mmc/members/:id': { max: 20, windowMs: 60000 },
  'PATCH:/mmc/roles/:id/permissions': { max: 10, windowMs: 60000 },

  // Delete endpoints (5/min)
  'DELETE:/mmc/members/:id': { max: 5, windowMs: 60000 },

  // Authentication (5/min for login)
  'POST:/mmc/auth/login': {
    max: 5,
    windowMs: 60000,
    message: 'Too many login attempts, please try again later',
  },

  // Logout (20/min - less restrictive)
  'POST:/mmc/auth/logout': { max: 20, windowMs: 60000 },

  // Invitation acceptance (5/day per IP)
  'POST:/mmc/invitations/:token/accept': { max: 5, windowMs: 86400000 },
}

/**
 * Rate Limiter
 */
export class RateLimiter {
  private inMemoryStore: Map<string, { attempts: number; resetAt: number }> =
    new Map()

  constructor(private redis?: Redis) {}

  /**
   * Check if request is rate limited
   *
   * Returns true if limit exceeded, false if within limit
   */
  async isLimited(
    key: string,
    limit: number = LOGIN_ATTEMPTS_LIMIT,
    window: number = LOGIN_ATTEMPTS_WINDOW
  ): Promise<boolean> {
    // Try Redis first
    if (this.redis) {
      try {
        const attempts = await this.redis.incr(`rate_limit:${key}`)
        if (attempts === 1) {
          await this.redis.expire(`rate_limit:${key}`, window)
        }
        return attempts > limit
      } catch (err) {
        // Fall back to in-memory
      }
    }

    // In-memory tracking
    const now = Date.now()
    let entry = this.inMemoryStore.get(key)

    if (!entry || entry.resetAt < now) {
      // Reset or new entry
      entry = { attempts: 1, resetAt: now + window * 1000 }
      this.inMemoryStore.set(key, entry)
    } else {
      entry.attempts++
    }

    // Cleanup old entries if store too large
    if (this.inMemoryStore.size > IN_MEMORY_LIMIT) {
      for (const [k, v] of this.inMemoryStore.entries()) {
        if (v.resetAt < now) {
          this.inMemoryStore.delete(k)
        }
      }
    }

    return entry.attempts > limit
  }

  /**
   * Reset rate limit for key
   */
  async reset(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(`rate_limit:${key}`)
      } catch (err) {
        // Ignore
      }
    }
    this.inMemoryStore.delete(key)
  }

  /**
   * Get current attempt count
   */
  async getAttempts(key: string): Promise<number> {
    if (this.redis) {
      try {
        const attempts = await this.redis.get(`rate_limit:${key}`)
        return parseInt(attempts || '0', 10)
      } catch (err) {
        // Fall back to in-memory
      }
    }

    const entry = this.inMemoryStore.get(key)
    return entry ? entry.attempts : 0
  }
}

/**
 * Create rate limiting middleware for login attempts
 */
export function createLoginRateLimiter(redis?: Redis) {
  const limiter = new RateLimiter(redis)

  return async (ctx: Context, next: Next): Promise<void | Response> => {
    const ipAddress =
      ctx.req.header('X-Forwarded-For') ||
      ctx.req.header('CF-Connecting-IP') ||
      'unknown'
    const key = `login_attempt:${ipAddress}`

    const isLimited = await limiter.isLimited(key)
    if (isLimited) {
      // @ts-ignore: LOGIC-BUG: ctx.json() return not void in rate limit handler — see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many login attempts; please try again later',
          },
        },
        429
      )
    }

    // Mark request for potential cleanup on success
    ctx.set('rate_limiter', limiter)
    ctx.set('rate_limiter_key', key)

    await next()
  }
}

/**
 * Reset rate limiter on successful login
 */
export async function resetLoginRateLimit(ctx: Context): Promise<void> {
  const limiter = ctx.get('rate_limiter') as RateLimiter | undefined
  const key = ctx.get('rate_limiter_key') as string | undefined

  if (limiter && key) {
    await limiter.reset(key)
  }
}

/**
 * Create rate limiter instance
 */
export function createRateLimiter(redis?: Redis): RateLimiter {
  return new RateLimiter(redis)
}

/**
 * Create per-endpoint rate limiting middleware (T062)
 * @param redis Redis client for distributed rate limiting
 * @returns Hono middleware function
 */
export function createPerEndpointRateLimiter(redis?: Redis) {
  const limiter = new RateLimiter(redis)

  return async (ctx: Context, next: Next): Promise<void> => {
    const method = ctx.req.method
    const path = ctx.req.path
    const endpoint = `${method}:${path}`
    const config = RATE_LIMIT_CONFIG[endpoint]

    // If endpoint not configured for rate limiting, skip
    if (!config) {
      await next()
      return
    }

    // Extract client IP from forwarded headers (behind proxy)
    const clientIp =
      // @ts-ignore: LOGIC-BUG: possibly undefined header value — see INFRA-001 [INFRA-001]
      ctx.req.header('x-forwarded-for')?.split(',')[0]!.trim() ||
      ctx.req.header('x-real-ip') ||
      ctx.req.header('CF-Connecting-IP') ||
      'unknown'

    const key = `${endpoint}:${clientIp}`
    const isLimited = await limiter.isLimited(
      key,
      config.max,
      Math.ceil(config.windowMs / 1000)
    )

    // Get current attempt count for headers
    const attempts = await limiter.getAttempts(key)
    const remaining = Math.max(0, config.max - attempts)
    const resetTime =
      Math.ceil(Date.now() / 1000) + Math.ceil(config.windowMs / 1000)

    // Add standard rate limit headers
    ctx.header('X-RateLimit-Limit', String(config.max))
    ctx.header('X-RateLimit-Remaining', String(remaining))
    ctx.header('X-RateLimit-Reset', String(resetTime))

    if (isLimited) {
      const retryAfter = Math.ceil(config.windowMs / 1000)
      ctx.header('Retry-After', String(retryAfter))

      // @ts-ignore: LOGIC-BUG: ctx.json() return not void in rate limit handler — see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: 'rate_limit_exceeded',
            message:
              config.message ||
              `Rate limit exceeded. Max ${config.max} requests per ${config.windowMs / 1000}s`,
          },
        },
        429 // Too Many Requests
      )
    }

    await next()
  }
}

/**
 * T062 - Rate Limiting Test Suite (documentation)
 *
 * describe('T062: Rate Limiting per Endpoint', () => {
 *
 *   describe('GET endpoints (60/min)', () => {
 *     it('should allow 60 requests per minute to GET /mmc/members', async () => {
 *       const ip = '192.168.1.1'
 *       for (let i = 0; i < 60; i++) {
 *         const res = await fetch('http://localhost:3000/mmc/members', {
 *           headers: { 'x-forwarded-for': ip }
 *         })
 *         expect(res.status).not.toBe(429)
 *       }
 *       // 61st request should fail
 *       const res = await fetch('http://localhost:3000/mmc/members', {
 *         headers: { 'x-forwarded-for': ip }
 *       })
 *       expect(res.status).toBe(429)
 *     })
 *   })
 *
 *   describe('POST endpoints (10/min)', () => {
 *     it('should allow 10 requests per minute to POST /mmc/members', async () => {
 *       const ip = '192.168.1.2'
 *       for (let i = 0; i < 10; i++) {
 *         const res = await fetch('http://localhost:3000/mmc/members', {
 *           method: 'POST',
 *           headers: { 'x-forwarded-for': ip }
 *         })
 *         expect(res.status).not.toBe(429)
 *       }
 *       // 11th request should fail
 *       const res = await fetch('http://localhost:3000/mmc/members', {
 *         method: 'POST',
 *         headers: { 'x-forwarded-for': ip }
 *       })
 *       expect(res.status).toBe(429)
 *       expect(res.header('Retry-After')).toBeDefined()
 *     })
 *   })
 *
 *   describe('DELETE endpoints (5/min)', () => {
 *     it('should allow 5 requests per minute to DELETE /mmc/members/:id', async () => {
 *       const ip = '192.168.1.3'
 *       for (let i = 0; i < 5; i++) {
 *         const res = await fetch('http://localhost:3000/mmc/members/123', {
 *           method: 'DELETE',
 *           headers: { 'x-forwarded-for': ip }
 *         })
 *         expect(res.status).not.toBe(429)
 *       }
 *       // 6th request should fail
 *       const res = await fetch('http://localhost:3000/mmc/members/123', {
 *         method: 'DELETE',
 *         headers: { 'x-forwarded-for': ip }
 *       })
 *       expect(res.status).toBe(429)
 *     })
 *   })
 *
 *   describe('Authentication endpoints (5/min)', () => {
 *     it('should limit login to 5 attempts per minute', async () => {
 *       const ip = '192.168.1.4'
 *       for (let i = 0; i < 5; i++) {
 *         const res = await fetch('http://localhost:3000/mmc/auth/login', {
 *           method: 'POST',
 *           body: JSON.stringify({ email: 'test@example.com', password: 'wrong' }),
 *           headers: { 'x-forwarded-for': ip }
 *         })
 *         // Should be 401 (invalid creds), not 429
 *         expect(res.status).toBe(401)
 *       }
 *       // 6th attempt should be 429 rate limited
 *       const res = await fetch('http://localhost:3000/mmc/auth/login', {
 *         method: 'POST',
 *         headers: { 'x-forwarded-for': ip }
 *       })
 *       expect(res.status).toBe(429)
 *     })
 *
 *     it('should count both successful and failed login attempts', async () => {
 *       // First 4 failed attempts
 *       for (let i = 0; i < 4; i++) {
 *         await fetch('http://localhost:3000/mmc/auth/login', {
 *           method: 'POST',
 *           body: JSON.stringify({ email: 'test@example.com', password: 'wrong' })
 *         })
 *       }
 *       // 5th successful login
 *       const res = await fetch('http://localhost:3000/mmc/auth/login', {
 *         method: 'POST',
 *         body: JSON.stringify({ email: 'test@example.com', password: 'correct' })
 *       })
 *       expect(res.status).toBe(200)
 *       // 6th attempt (any) should fail with 429
 *       const rateLimited = await fetch('http://localhost:3000/mmc/auth/login', {
 *         method: 'POST'
 *       })
 *       expect(rateLimited.status).toBe(429)
 *     })
 *   })
 *
 *   describe('Invitations endpoint (20/hour)', () => {
 *     it('should allow 20 invitation posts per hour', async () => {
 *       const ip = '192.168.1.5'
 *       for (let i = 0; i < 20; i++) {
 *         const res = await fetch('http://localhost:3000/mmc/invitations', {
 *           method: 'POST',
 *           headers: { 'x-forwarded-for': ip }
 *         })
 *         expect(res.status).not.toBe(429)
 *       }
 *     })
 *
 *     it('should return 429 on 21st invitation post within hour', async () => {
 *       const ip = '192.168.1.6'
 *       for (let i = 0; i < 20; i++) {
 *         await fetch('http://localhost:3000/mmc/invitations', {
 *           method: 'POST',
 *           headers: { 'x-forwarded-for': ip }
 *         })
 *       }
 *       const res = await fetch('http://localhost:3000/mmc/invitations', {
 *         method: 'POST',
 *         headers: { 'x-forwarded-for': ip }
 *       })
 *       expect(res.status).toBe(429)
 *     })
 *   })
 *
 *   describe('Response headers', () => {
 *     it('should include X-RateLimit-Limit header', async () => {
 *       const res = await fetch('http://localhost:3000/mmc/members')
 *       expect(res.header('X-RateLimit-Limit')).toBe('60')
 *     })
 *
 *     it('should include X-RateLimit-Remaining header', async () => {
 *       const res = await fetch('http://localhost:3000/mmc/members')
 *       const remaining = parseInt(res.header('X-RateLimit-Remaining'))
 *       expect(remaining).toBeGreaterThan(0)
 *     })
 *
 *     it('should include X-RateLimit-Reset header', async () => {
 *       const res = await fetch('http://localhost:3000/mmc/members')
 *       expect(res.header('X-RateLimit-Reset')).toBeDefined()
 *     })
 *
 *     it('should include Retry-After header when rate limited', async () => {
 *       const ip = '192.168.1.7'
 *       // Exceed rate limit
 *       for (let i = 0; i < 61; i++) {
 *         await fetch('http://localhost:3000/mmc/members', {
 *           headers: { 'x-forwarded-for': ip }
 *         })
 *       }
 *       const res = await fetch('http://localhost:3000/mmc/members', {
 *         headers: { 'x-forwarded-for': ip }
 *       })
 *       expect(res.header('Retry-After')).toBeDefined()
 *     })
 *   })
 *
 *   describe('Per-IP isolation', () => {
 *     it('should track rate limits per IP address independently', async () => {
 *       const ip1 = '192.168.1.10'
 *       const ip2 = '192.168.1.11'
 *
 *       // Fill quota for IP1 (60 requests)
 *       for (let i = 0; i < 60; i++) {
 *         await fetch('http://localhost:3000/mmc/members', {
 *           headers: { 'x-forwarded-for': ip1 }
 *         })
 *       }
 *
 *       // IP1 should be rate limited
 *       const res1 = await fetch('http://localhost:3000/mmc/members', {
 *         headers: { 'x-forwarded-for': ip1 }
 *       })
 *       expect(res1.status).toBe(429)
 *
 *       // IP2 should still work
 *       const res2 = await fetch('http://localhost:3000/mmc/members', {
 *         headers: { 'x-forwarded-for': ip2 }
 *       })
 *       expect(res2.status).not.toBe(429)
 *     })
 *   })
 *
 *   describe('Window reset', () => {
 *     it('should reset rate limit counter after time window expires', async () => {
 *       const ip = '192.168.1.12'
 *
 *       // Make 60 requests to fill quota
 *       for (let i = 0; i < 60; i++) {
 *         await fetch('http://localhost:3000/mmc/members', {
 *           headers: { 'x-forwarded-for': ip }
 *         })
 *       }
 *
 *       // 61st request should fail
 *       const res1 = await fetch('http://localhost:3000/mmc/members', {
 *         headers: { 'x-forwarded-for': ip }
 *       })
 *       expect(res1.status).toBe(429)
 *
 *       // Wait 61 seconds
 *       await new Promise(resolve => setTimeout(resolve, 61000))
 *
 *       // New request should be allowed
 *       const res2 = await fetch('http://localhost:3000/mmc/members', {
 *         headers: { 'x-forwarded-for': ip }
 *       })
 *       expect(res2.status).not.toBe(429)
 *     })
 *   })
 *
 * })
 */

export default RateLimiter
