/**
 * Rate limiting Middleware for Provisioning
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Implements rate limiting for license creation endpoint.
 * Limit: 5 license creations per minute per IP address
 *
 * Uses Redis for distributed rate limiting across multiple API instances.
 * Returns 429 Too Many Requests if limit exceeded.
 *
 * Headers included:
 * - X-RateLimit-Limit: Max requests in window
 * - X-RateLimit-Remaining: Requests remaining
 * - X-RateLimit-Reset: Unix timestamp when limit resets
 * - Retry-After: Seconds to wait before retry (on 429)
 */

import {
  ProvisioningErrorCode,
  getErrorDetails,
} from '@zidney/types/errors/provisioning-errors'
import { Context, Next } from 'hono'
import { Redis } from 'ioredis'
import { createErrorResponse } from '../routes/licenses/license-response'

/**
 * Rate Limit Configuration
 */
export interface RateLimitConfig {
  maxRequests: number // Max requests per window
  windowSeconds: number // Time window in seconds
  keyPrefix: string // Redis key prefix
}

/**
 * Default rate limit config: 5 requests per 60 seconds
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequests: 5,
  windowSeconds: 60,
  keyPrefix: 'ratelimit:provision:',
}

/**
 * Get client IP address
 */
function getClientIP(c: Context): string {
  // Check for proxy headers first
  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const xRealIP = c.req.header('x-real-ip')
  if (xRealIP) {
    return xRealIP
  }

  // Fallback to socket address (less reliable in proxy scenarios)
  return c.req.header('remote-addr') || 'unknown'
}

/**
 * Rate Limit Middleware Factory
 */
export function rateLimitProvisioningMiddleware(
  redis: Redis,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG
) {
  return async (c: Context, next: Next): Promise<void> => {
    const clientIP = getClientIP(c)
    const key = `${config.keyPrefix}${clientIP}`

    try {
      // Increment counter and set expiration
      const [current, setExResult] = await Promise.all([
        redis.incr(key),
        redis.expire(key, config.windowSeconds),
      ])

      // Get TTL (seconds until reset)
      const ttl = await redis.ttl(key)
      const resetTime = new Date(Date.now() + ttl * 1000)

      // Set rate limit response headers
      c.set('rateLimitHeaders', {
        'X-RateLimit-Limit': String(config.maxRequests),
        'X-RateLimit-Remaining': String(
          Math.max(0, config.maxRequests - current)
        ),
        'X-RateLimit-Reset': String(Math.floor(resetTime.getTime() / 1000)),
      })

      // Check if limit exceeded
      if (current > config.maxRequests) {
        const error = getErrorDetails(ProvisioningErrorCode.RATE_LIMIT_EXCEEDED)

        c.status(error.httpStatus)
        c.header('Retry-After', String(Math.ceil(ttl)))
        c.header('X-RateLimit-Limit', String(config.maxRequests))
        c.header('X-RateLimit-Remaining', '0')
        c.header(
          'X-RateLimit-Reset',
          String(Math.floor(resetTime.getTime() / 1000))
        )

        return c.json(
          createErrorResponse(
            ProvisioningErrorCode.RATE_LIMIT_EXCEEDED,
            `Rate limit exceeded: ${config.maxRequests} requests per ${config.windowSeconds} seconds`,
            {
              limit: config.maxRequests,
              window_seconds: config.windowSeconds,
              retry_after: Math.ceil(ttl),
            }
          ),
          { status: error.httpStatus }
        )
      }

      // Attach rate limit info to context
      c.set('rateLimitInfo', {
        current,
        limit: config.maxRequests,
        remaining: config.maxRequests - current,
        resetAt: resetTime,
        clientIP,
      })

      await next()
    } catch (error) {
      // On Redis error, log but don't block request
      console.error('Rate limit check failed:', error)
      c.set('rateLimitFailed', true)
      await next()
    }
  }
}

/**
 * In-memory rate limiter (for development/testing)
 * Note: Not suitable for distributed deployments
 */
export function inMemoryRateLimitMiddleware(
  config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG
) {
  // Map to store: { key: [count, expiresAt] }
  const store = new Map<string, [number, number]>()

  // Cleanup expired entries periodically
  setInterval(() => {
    const now = Date.now()
    for (const [key, [, expiresAt]] of store.entries()) {
      if (expiresAt < now) {
        store.delete(key)
      }
    }
  }, config.windowSeconds * 1000)

  return async (c: Context, next: Next): Promise<void> => {
    const clientIP = getClientIP(c)
    const key = `${config.keyPrefix}${clientIP}`
    const now = Date.now()

    // Get or create entry
    let [count, expiresAt] = store.get(key) || [0, now]

    // Reset counter if window expired
    if (expiresAt < now) {
      count = 0
      expiresAt = now + config.windowSeconds * 1000
    }

    count++
    store.set(key, [count, expiresAt])

    const resetTime = new Date(expiresAt)
    const remaining = Math.max(0, config.maxRequests - count)

    // Set rate limit headers
    c.set('rateLimitHeaders', {
      'X-RateLimit-Limit': String(config.maxRequests),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(Math.floor(resetTime.getTime() / 1000)),
    })

    // Check if limit exceeded
    if (count > config.maxRequests) {
      const error = getErrorDetails(ProvisioningErrorCode.RATE_LIMIT_EXCEEDED)

      const secondsRemaining = Math.ceil((expiresAt - now) / 1000)

      c.status(error.httpStatus)
      c.header('Retry-After', String(secondsRemaining))
      c.header('X-RateLimit-Limit', String(config.maxRequests))
      c.header('X-RateLimit-Remaining', '0')
      c.header(
        'X-RateLimit-Reset',
        String(Math.floor(resetTime.getTime() / 1000))
      )

      return c.json(
        createErrorResponse(
          ProvisioningErrorCode.RATE_LIMIT_EXCEEDED,
          `Rate limit exceeded: ${config.maxRequests} requests per ${config.windowSeconds} seconds`
        ),
        { status: error.httpStatus }
      )
    }

    await next()
  }
}

/**
 * Get rate limit info from context
 */
export function getRateLimitInfo(
  c: Context
): Record<string, unknown> | undefined {
  return c.get('rateLimitInfo')
}
