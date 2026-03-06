import { randomBytes } from 'node:crypto'
import { createLogger } from '@zidney/logger'
import type { Hono } from 'hono'
import { redis } from '../../infrastructure/redis'

const logger = createLogger('csrf')

/**
 * T065-T066: CSRF Protection
 *
 * Implements token-based CSRF protection:
 * - Generate random tokens on login
 * - Store in HttpOnly SameSite=Strict cookie
 * - Include in response body
 * - Validate on state-changing requests
 * - Return 403 on mismatch
 */

const CSRF_COOKIE_NAME = '__Host-csrf'
const CSRF_HEADER_NAME = 'X-CSRF-Token'
const CSRF_TTL = 3600 // 1 hour

/**
 * T065: CSRF token generator
 */
export function generateCSRFToken(): string {
  // Generate 32 random bytes (256 bits) and convert to hex
  return randomBytes(32).toString('hex')
}

/**
 * Store CSRF token in Redis for validation
 */
async function storeCSRFToken(token: string, userId: string, workspaceId: string): Promise<void> {
  const key = `csrf:token:${token}`
  const value = JSON.stringify({
    user_id: userId,
    workspace_id: workspaceId,
    created_at: new Date().toISOString(),
  })

  await redis.setEx(key, CSRF_TTL, value)
}

/**
 * Retrieve and validate CSRF token
 */
async function validateCSRFToken(token: string, userId: string): Promise<boolean> {
  const key = `csrf:token:${token}`
  const value = await redis.get(key)

  if (!value) {
    return false
  }

  try {
    const data = JSON.parse(value)
    return data.user_id === userId
  } catch {
    return false
  }
}

/**
 * Set CSRF token cookie and include in response body
 */
export async function setCSRFToken(c: Hono, userId: string, workspaceId: string): Promise<string> {
  const token = generateCSRFToken()

  await storeCSRFToken(token, userId, workspaceId)

  // Set HttpOnly SameSite=Strict cookie
  c.header(
    'Set-Cookie',
    `${CSRF_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${CSRF_TTL}`
  )

  return token
}

/**
 * T066: CSRF validation middleware
 */
export async function csrfValidator(c: Hono, next: () => Promise<void>): Promise<void> {
  const correlationId = c.state.requestId || 'unknown'
  const userId = c.state.userId
  const method = c.req.method

  // Skip CSRF check for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    await next()
    return
  }

  // Skip CSRF check for pure API routes (endpoints starting with /api/)
  if (c.req.path.startsWith('/api/')) {
    await next()
    return
  }

  try {
    // Extract CSRF token from header
    const headerToken = c.req.header(CSRF_HEADER_NAME)

    // Extract CSRF token from cookie
    const cookies = c.req.header('Cookie')
    let cookieToken: string | undefined

    if (cookies) {
      const match = cookies.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`))
      if (match) {
        cookieToken = match[1]
      }
    }

    // Token must be provided in header and match cookie
    if (!headerToken || !cookieToken) {
      logger.warn(`CSRF validation failed: missing token`, {
        correlation_id: correlationId,
        user_id: userId,
        has_header_token: !!headerToken,
        has_cookie_token: !!cookieToken,
        method,
        path: c.req.path,
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'CSRF_TOKEN_MISSING',
            message: 'CSRF token is required',
          },
        },
        403
      )
    }

    // Header token must match cookie token AND validate against Redis
    if (headerToken !== cookieToken) {
      logger.warn(`CSRF validation failed: token mismatch`, {
        correlation_id: correlationId,
        user_id: userId,
        method,
        path: c.req.path,
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'CSRF_TOKEN_INVALID',
            message: 'CSRF token validation failed',
          },
        },
        403
      )
    }

    // Validate token against Redis
    const isValid = await validateCSRFToken(headerToken, userId)

    if (!isValid) {
      logger.warn(`CSRF validation failed: token not found or expired`, {
        correlation_id: correlationId,
        user_id: userId,
        method,
        path: c.req.path,
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'CSRF_TOKEN_EXPIRED',
            message: 'CSRF token has expired or is invalid',
          },
        },
        403
      )
    }

    logger.debug(`CSRF validation passed`, {
      correlation_id: correlationId,
      user_id: userId,
      method,
      path: c.req.path,
    })

    await next()
  } catch (error) {
    logger.error(`CSRF validation error`, {
      correlation_id: correlationId,
      user_id: userId,
      method,
      path: c.req.path,
      error: error instanceof Error ? error.message : String(error),
    })

    throw error
  }
}

/**
 * Helper to invalidate CSRF token after logout
 */
export async function invalidateCSRFToken(token: string): Promise<void> {
  const key = `csrf:token:${token}`
  await redis.del(key)
}
