/**
 * Token Version Validation Middleware
 *
 * File: apps/api/src/middleware/auth/validate-token-version.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Validate that JWT token_version matches user.token_version in database.
 * Enables stateless token revocation without maintaining a blocklist.
 *
 * When is token_version incremented?
 * - User logs out all sessions (logout-all endpoint)
 * - User password changes
 * - User role changes
 * - Admin revokes all sessions for user
 * - Security incident detected
 *
 * Mechanism:
 * When token_version changes in database, all existing tokens with old version become invalid.
 * No token blocklist needed (just check version match).
 *
 * Errors:
 * - 401: Token version mismatch (token invalidated after issuance)
 *
 * Compliance:
 * - ADR-0001: Database-per-tenant (uses tenant pool to fetch user)
 * - AGENTS.md: Stateless token revocation mechanism
 * - Standard error contract
 */

import { logTokenVersionMismatch } from '@zidney/domain-core/auth'
import { Context, Next } from 'hono'

/**
 * Validate that token version matches current user version in database
 *
 * Middleware execution (assumes validateJwtMiddleware already ran):
 * 1. Get user ID from JWT payload (c.get('userId'))
 * 2. Fetch user from database (uses tenant resolver context)
 * 3. Compare:
 *    - token.token_version (from JWT)
 *    - user.token_version (from database)
 * 4. If mismatch → 401 Unauthorized (token invalidated)
 */
export async function validateTokenVersionMiddleware(c: Context, next: Next) {
  const correlationId = c.get('correlationId') || 'unknown'

  try {
    // Check if authenticated (skip if not)
    const isAuthenticated = c.get('isAuthenticated')
    if (!isAuthenticated) {
      await next()
      return
    }

    const authPayload = c.get('authPayload')
    if (!authPayload) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'AUTH_CONTEXT_MISSING',
            message: 'Authentication context not found',
          },
        },
        401
      )
    }

    const userId = c.get('userId')
    const workspaceSlug = c.get('workspaceSlug')
    const tenantDb = c.get('tenantDb')

    if (!tenantDb) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'DB_CONTEXT_MISSING',
            message: 'Database context not found',
          },
        },
        500
      )
    }

    // Fetch current user.token_version from database
    const result = await tenantDb.query(
      'SELECT id, token_version, email FROM users WHERE id = $1 AND is_active = true',
      [userId]
    )

    if (result.rows.length === 0) {
      // User not found or inactive
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found or inactive',
          },
        },
        401
      )
    }

    const user = result.rows[0]
    const currentUserTokenVersion = user.token_version
    const tokenTokenVersion = authPayload.token_version

    // Check version match
    if (tokenTokenVersion !== currentUserTokenVersion) {
      // Version mismatch - token has been invalidated
      await logTokenVersionMismatch(
        correlationId,
        userId,
        user.email,
        workspaceSlug,
        tokenTokenVersion,
        currentUserTokenVersion,
        c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP')
      )

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'TOKEN_VERSION_MISMATCH',
            message: 'Your session has been invalidated. Please login again.',
          },
        },
        401
      )
    }

    // Version match - continue
    await next()
  } catch (error) {
    console.error('Token version validation error:', error)
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Token version validation failed',
        },
      },
      500
    )
  }
}
