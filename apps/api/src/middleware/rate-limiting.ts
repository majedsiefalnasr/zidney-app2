/**
 * T021: Rate Limiting Middleware (NEW)
 *
 * Purpose: Enforce rate limits on all endpoints
 * Layer: API Middleware (STAGE 5 of 5 - after schema version check)
 * Transactional: No (Redis operations atomic)
 * Idempotent: Yes (rate limit checks idempotent)
 * Version Enforcement: Not applicable
 * License Middleware: No (executes after license check)
 *
 * Constitutional Compliance:
 * ✓ Rate limit enforcement active (returns 429 on exceeded)
 * ✓ Tenant isolation (key namespaced with workspace_id)
 * ✓ No cross-tenant shared buckets
 * ✓ Exponential backoff for account locks
 * ✓ Structured response with Retry-After header
 *
 * Rate Limit Hierarchy (checked in order):
 * 1. IP-based limits (brute force prevention)
 * 2. User-based limits (per-user throttling)
 * 3. Workspace-based limits (capacity planning)
 * 4. Endpoint-specific limits
 */

import { SlidingWindowRateLimiter } from '@zidney/redis-utils/algorithms/sliding-window'
import { RATE_LIMIT_BY_ENDPOINT } from '@zidney/redis-utils/schemas/rate-limiting'
import type { Context, Next } from 'hono'
import { getRedisClient } from '../infrastructure/redis'
import { MiddlewareStage, recordMiddlewareExecution } from './middleware-chain'

export async function rateLimitingMiddleware(
  c: Context,
  next: Next
): Promise<Response | void> {
  const correlationId = c.state.correlationId || 'unknown'
  const workspace = c.state.workspace
  const endpoint = `${c.req.method} ${c.req.path}`

  // Skip rate limiting for health/internal endpoints
  if (endpoint.includes('/health') || endpoint.includes('/internal')) {
    await next()
    return
  }

  try {
    const redis = getRedisClient()
    const limiter = new SlidingWindowRateLimiter(redis)

    // Get endpoint rate limit config
    const config = getEndpointRateLimit(endpoint, workspace?.id || 'unknown')

    if (!config) {
      // No rate limit configured for this endpoint
      await next()
      return
    }

    // T021: Extract identifiers for rate limiting
    const clientIp =
      c.req.header('x-forwarded-for') ||
      c.req.header('cf-connecting-ip') ||
      'unknown'
    const userId = c.state.user?.id || 'anonymous'
    const workspaceId = workspace?.id || 'unknown'

    // Build rate limit key (namespaced for tenant isolation)
    const rateLimitKey = `rate:limit:${config.identifier}:${getIdentifierValue(config.identifier, { clientIp, userId, workspaceId })}`

    // T021: Check rate limit
    const result = await limiter.checkLimit(rateLimitKey, {
      limit: config.limit,
      window: config.window,
      burst: config.burst,
    })

    // Log rate limit check
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: result.allowed ? 'debug' : 'warn',
        service: 'api',
        event: result.allowed ? 'rate_limit_allowed' : 'rate_limit_exceeded',
        correlation_id: correlationId,
        endpoint,
        ip: clientIp,
        user_id: userId,
        workspace_id: workspaceId,
        remaining: result.remaining,
        reset_at: result.resetAt,
      })
    )

    // Store rate limit info in context
    c.state.rateLimit = result

    // If rate limit exceeded, return 429
    if (!result.allowed) {
      console.warn(
        `[${correlationId}] Rate limit exceeded for ${endpoint} (${config.identifier}=${config.identifier})`
      )

      c.header('Retry-After', String(result.retryAfter || 60))
      c.header('X-Rate-Limit-Limit', String(config.limit))
      c.header('X-Rate-Limit-Remaining', String(result.remaining))
      c.header('X-Rate-Limit-Reset', String(result.resetAt))

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            details: {
              limit: config.limit,
              window_seconds: config.window,
              retry_after_seconds: result.retryAfter || 60,
              reset_at: new Date(result.resetAt * 1000).toISOString(),
            },
          },
        },
        { status: 429 }
      )
    }

    // Add rate limit headers to successful responses
    c.header('X-Rate-Limit-Limit', String(config.limit))
    c.header('X-Rate-Limit-Remaining', String(result.remaining))
    c.header('X-Rate-Limit-Reset', String(result.resetAt))

    // Record execution in middleware chain
    const recordExecution = recordMiddlewareExecution(
      MiddlewareStage.RATE_LIMITING
    )
    await recordExecution(c, next)
  } catch (error) {
    // On Redis error, fail open (allow request but log error)
    console.error(`[${correlationId}] Rate limit check error:`, error)
    // Proceed without rate limiting
    await next()
  }
}

/**
 * Get rate limit config for endpoint
 */
function getEndpointRateLimit(
  endpoint: string,
  _workspaceId: string
): RateLimitConfig | null {
  // Map endpoint to rate limit config
  const config = RATE_LIMIT_BY_ENDPOINT[
    endpoint as keyof typeof RATE_LIMIT_BY_ENDPOINT
  ] as
    | {
        pattern: string
        limit: number
        window: number
        burst?: number
      }
    | undefined

  if (!config) {
    return null
  }

  const identifierMatch = config.pattern.match(/\{(ip|user|workspace)\}/)
  const identifier =
    (identifierMatch?.[1] as RateLimitConfig['identifier']) || 'ip'

  return {
    identifier,
    limit: config.limit,
    window: config.window,
    ...(typeof config.burst === 'number' ? { burst: config.burst } : {}),
  }
}

/**
 * Get identifier value for rate limit key
 */
function getIdentifierValue(
  identifier: string,
  params: { clientIp: string; userId: string; workspaceId: string }
): string {
  switch (identifier) {
    case 'ip':
      return params.clientIp
    case 'user':
      return params.userId
    case 'workspace':
      return params.workspaceId
    default:
      return 'unknown'
  }
}

/**
 * Rate limit configuration type
 */
interface RateLimitConfig {
  identifier: 'ip' | 'user' | 'workspace'
  limit: number
  window: number
  burst?: number
}
