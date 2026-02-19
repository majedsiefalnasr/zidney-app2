import { Hono } from 'hono'
import { logger } from '../../infrastructure/logger'
import { redis } from '../../infrastructure/redis'

/**
 * T040: Admin endpoint rate limiting middleware
 *
 * Applies stricter rate limits to admin endpoints:
 * - 10 requests per 60s per IP
 * - 20 requests per 60s per user
 * - 50 requests per 60s per workspace
 *
 * Returns 429 on violation
 */

interface AdminRateLimitLimits {
  perIp: number // 10 req/min
  perUser: number // 20 req/min
  perWorkspace: number // 50 req/min
  windowMs: number // 60 seconds
}

const DEFAULT_LIMITS: AdminRateLimitLimits = {
  perIp: 10,
  perUser: 20,
  perWorkspace: 50,
  windowMs: 60000,
}

export async function adminRateLimiting(
  c: Hono,
  next: () => Promise<void>,
  limits: AdminRateLimitLimits = DEFAULT_LIMITS
): Promise<void> {
  const correlationId = c.state.requestId || 'unknown'
  const clientIp =
    c.req.header('X-Forwarded-For')?.split(',')[0] ||
    c.req.header('X-Real-IP') ||
    'unknown'
  const userId = c.state.userId || 'anonymous'
  const workspace = c.state.workspace

  try {
    const now = Date.now()
    const windowStart = now - limits.windowMs

    // Check IP-based limit
    const ipKey = `admin:rate:ip:${clientIp}`
    const ipCount = await redis.zcount(ipKey, windowStart, now)

    if (ipCount >= limits.perIp) {
      logger.warn(`Admin rate limit exceeded: per-IP`, {
        correlation_id: correlationId,
        client_ip: clientIp,
        limit: limits.perIp,
        current_count: ipCount,
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many admin requests from your IP',
            details: {
              limit: limits.perIp,
              window_seconds: limits.windowMs / 1000,
              retry_after_seconds: Math.ceil(limits.windowMs / 1000),
            },
          },
        },
        429
      )
    }

    // Check user-based limit
    if (userId !== 'anonymous') {
      const userKey = `admin:rate:user:${userId}`
      const userCount = await redis.zcount(userKey, windowStart, now)

      if (userCount >= limits.perUser) {
        logger.warn(`Admin rate limit exceeded: per-user`, {
          correlation_id: correlationId,
          user_id: userId,
          client_ip: clientIp,
          limit: limits.perUser,
          current_count: userCount,
        })

        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many admin requests from your account',
              details: {
                limit: limits.perUser,
                window_seconds: limits.windowMs / 1000,
                retry_after_seconds: Math.ceil(limits.windowMs / 1000),
              },
            },
          },
          429
        )
      }
    }

    // Check workspace-based limit
    if (workspace && workspace.id) {
      const workspaceKey = `admin:rate:workspace:${workspace.id}`
      const workspaceCount = await redis.zcount(workspaceKey, windowStart, now)

      if (workspaceCount >= limits.perWorkspace) {
        logger.warn(`Admin rate limit exceeded: per-workspace`, {
          correlation_id: correlationId,
          workspace_id: workspace.id,
          workspace_slug: workspace.slug,
          limit: limits.perWorkspace,
          current_count: workspaceCount,
        })

        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many admin requests in workspace',
              details: {
                limit: limits.perWorkspace,
                window_seconds: limits.windowMs / 1000,
                retry_after_seconds: Math.ceil(limits.windowMs / 1000),
              },
            },
          },
          429
        )
      }
    }

    // Increment counters
    const timestamp = `${now}:${Math.random()}`

    await redis.zadd(ipKey, now, timestamp)
    await redis.expire(ipKey, Math.ceil(limits.windowMs / 1000) + 10)

    if (userId !== 'anonymous') {
      await redis.zadd(`admin:rate:user:${userId}`, now, timestamp)
      await redis.expire(
        `admin:rate:user:${userId}`,
        Math.ceil(limits.windowMs / 1000) + 10
      )
    }

    if (workspace && workspace.id) {
      await redis.zadd(`admin:rate:workspace:${workspace.id}`, now, timestamp)
      await redis.expire(
        `admin:rate:workspace:${workspace.id}`,
        Math.ceil(limits.windowMs / 1000) + 10
      )
    }

    // Add rate limit headers to response
    c.state.rateLimitHeaders = {
      'X-Rate-Limit-Limit': String(limits.perIp),
      'X-Rate-Limit-Remaining': String(Math.max(0, limits.perIp - ipCount - 1)),
      'X-Rate-Limit-Reset': String(Math.floor((now + limits.windowMs) / 1000)),
    }

    await next()
  } catch (error) {
    logger.error(`Admin rate limiting error`, {
      correlation_id: correlationId,
      user_id: userId,
      client_ip: clientIp,
      error: error instanceof Error ? error.message : String(error),
    })

    // On error, allow request but log
    await next()
  }
}
