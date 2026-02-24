/**
 * JWT Validation Middleware
 *
 * File: apps/api/src/middleware/auth/validate-jwt.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Validate JWT token signature, expiration, and basic claims.
 * Runs after tenant resolver, before token version check.
 *
 * Middleware Order (Enforced):
 * 1. tenantResolver (set workspace context)
 * 2. correlationId (set request tracing)
 * 3. ➡️ validateJwt (THIS) ← validate token signature + expiration
 * 4. validateTokenVersion (check user token_version)
 * 5. validateSchemaVersion (check schema compatibility)
 * 6. resolveRbac (fetch user permissions)
 * 7. auditLogger (log all events)
 * 8. errorHandler (standard error response)
 *
 * Validations Performed:
 * ✓ Authorization header present
 * ✓ Bearer token format correct
 * ✓ JWT signature valid (cryptographic)
 * ✓ Token not expired
 * ✓ Required claims present (scope, user_id, etc.)
 *
 * Limitations (Checked Later):
 * ✗ Token version - checked by validateTokenVersion
 * ✗ Workspace isolation - checked by validateJwt (if workspace context available)
 * ✗ Schema version - checked by validateSchemaVersion
 * ✗ Permissions - checked by resolveRbac
 *
 * Errors:
 * - 401: Missing/malformed Authorization header
 * - 401: Invalid token format
 * - 401: Invalid token signature
 * - 401: Token expired
 * - 401: Missing required claims
 *
 * Compliance:
 * - ADR-0001: Database-per-tenant (workspace context from resolver, not from token)
 * - AGENTS.md: Middleware enforcement order strictly enforced
 * - Standard error contract used for all errors
 */

import {
  AuthError,
  extractTokenFromHeader,
  validateJwtClaims,
  verifyAndDecodeToken,
} from '@zidney/domain-core/auth'
import { Context, Next } from 'hono'

type JwtScope = 'mmc' | 'backoffice' | 'frontoffice'

function normalizeScope(scope: string | undefined): JwtScope | undefined {
  if (!scope) return undefined
  return scope.toLowerCase() as JwtScope
}

async function runJwtValidation(
  c: Context,
  next: Next,
  requiredScope?: JwtScope
): Promise<Response | void> {
  try {
    // Extract token from "Bearer <token>" header
    const authHeader = c.req.header('Authorization')
    const token = extractTokenFromHeader(authHeader)

    // Verify JWT signature and expiration
    const payload = await verifyAndDecodeToken(token)

    // Validate requested scope when route is scope-specific
    if (requiredScope) {
      const tokenScope = normalizeScope(payload.scope)
      if (tokenScope !== requiredScope) {
        c.status(401 as any)
        return c.json({
          success: false,
          data: null,
          error: {
            code: 'INVALID_TOKEN_SCOPE',
            message: 'Token scope does not match required route scope',
          },
        })
      }
    }

    // Validate JWT claims
    const resolvedWorkspaceId = c.get('workspaceId')
    const masterDb = c.get('masterDb')

    // Fetch current schema version from workspace (for schema version validation)
    let expectedSchemaVersion: string | undefined
    if (masterDb && resolvedWorkspaceId) {
      try {
        const schemaResult = await masterDb.query(
          'SELECT schema_version FROM workspaces WHERE id = $1',
          [resolvedWorkspaceId]
        )
        expectedSchemaVersion = schemaResult.rows[0]?.schema_version
      } catch (err) {
        // If we can't fetch schema version, continue without it
        // (better to allow request than block on query error)
        console.warn('Failed to fetch schema version:', err)
      }
    }

    // Validate JWT claims including schema version
    await validateJwtClaims(payload, resolvedWorkspaceId, expectedSchemaVersion)

    // Add `email` for legacy route handlers that still read authPayload.email.
    const authPayload = {
      ...payload,
      email: (payload as any).email ?? payload.user_email,
    }

    // Attach to context for downstream middleware
    c.set('authPayload', authPayload)
    c.set('isAuthenticated', true)
    c.set('userId', payload.user_id)
    c.set('userRole', 'role' in payload ? payload.role : undefined)

    // Continue to next middleware
    await next()
    return
  } catch (error) {
    // Convert auth errors to standard response
    if (error instanceof AuthError) {
      c.status((error.statusCode || 401) as any)
      return c.json({
        success: false,
        data: null,
        error: {
          code: error.code,
          message: error.message,
        },
      })
    }

    // Unexpected error
    c.status(500 as any)
    return c.json({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication validation failed',
      },
    })
  }
}

/**
 * Express/Hono middleware for JWT validation
 *
 * Usage:
 * ```
 * app.use(validateJwtMiddleware)
 * app.get('/protected', (c) => {
 *   const user = c.get('user')
 *   return c.json({ authenticated: true, user_id: user.user_id })
 * })
 * ```
 *
 * Sets c.req.user (Hono context) with:
 * - payload: Full JWT payload (JwtPayload union type)
 * - isAuthenticated: true
 * - correlationId: From middleware chain
 */
export function validateJwtMiddleware(requiredScope?: JwtScope) {
  return async (c: Context, next: Next): Promise<Response | void> =>
    runJwtValidation(c, next, requiredScope)
}

/**
 * Optional middleware for public routes (no JWT required)
 * Only validates if token present, allows missing token
 */
export async function validateJwtOptionalMiddleware(c: Context, next: Next) {
  try {
    const authHeader = c.req.header('Authorization')

    if (!authHeader) {
      // No token provided, continue as unauthenticated
      c.set('isAuthenticated', false)
      c.set('userId', undefined)
      c.set('userRole', undefined)
      await next()
      return
    }

    // Token provided, validate it
    const token = extractTokenFromHeader(authHeader)
    const payload = await verifyAndDecodeToken(token)

    c.set('authPayload', payload)
    c.set('isAuthenticated', true)
    c.set('userId', payload.user_id)
    c.set('userRole', 'role' in payload ? payload.role : undefined)

    await next()
  } catch {
    // Invalid token provided, but optional so continue as unauthenticated
    c.set('isAuthenticated', false)
    c.set('userId', undefined)
    c.set('userRole', undefined)
    await next()
  }
}
