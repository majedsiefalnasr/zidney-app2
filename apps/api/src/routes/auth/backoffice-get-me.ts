/**
 * Backoffice Get Me Route
 *
 * File: apps/api/src/routes/auth/backoffice-get-me.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Get current backoffice user profile
 *
 * Context: Backoffice (Institution Control Panel)
 * - Returns user info from JWT + tenant DB
 * - Used for session verification
 * - Used to populate user menu in dashboard
 * - Workspace-bound route
 *
 * Auth: Requires valid Backoffice JWT for workspace
 *
 * Request:
 * GET /workspaces/{workspace_slug}/auth/me
 * Header: Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   success: true,
 *   data: {
 *     user_id: string,
 *     email: string,
 *     role: string,
 *     last_login_at: ISO8601
 *   },
 *   error: null
 * }
 */

import { Hono } from 'hono'
import { getTenantPool } from '../../db'
import {
  AuthErrorCodes,
  throwAuthError,
} from '../../middleware/auth/error-handler-middleware'
import { validateJwtMiddleware } from '../../middleware/auth/validate-jwt'
import { validateLicenseMiddleware } from '../../middleware/auth/validate-license-middleware'
import { validateTokenVersionMiddleware } from '../../middleware/auth/validate-token-version'

const router = new Hono()

/**
 * Get current backoffice user
 *
 * Middleware order:
 * 1. validateJwt (backoffice scope)
 * 2. validateLicense
 * 3. validateTokenVersion
 * 4. auditLogger (after handler)
 *
 * Operation:
 * 1. Verify JWT is valid (via middleware)
 * 2. Verify license is active (via middleware)
 * 3. Verify token_version matches (via middleware)
 * 4. Query user from tenant DB
 * 5. Return user profile
 */
router.get(
  '/',
  validateJwtMiddleware('backoffice'),
  validateLicenseMiddleware(),
  validateTokenVersionMiddleware('backoffice'),
  async (c) => {
    const authPayload = c.get('authPayload')
    const userId = authPayload.user_id
    const workspaceId = c.get('workspaceId')

    // Get tenant pool
    const pool = getTenantPool(workspaceId)

    if (!pool) {
      throwAuthError(
        AuthErrorCodes.WORKSPACE_INVALID,
        'Workspace not found',
        404
      )
    }

    const result = await pool.query(
      `
      SELECT id, email, role, last_login_at, created_at
      FROM users
      WHERE id = $1 AND role in ('admin', 'instructor')
      `,
      [userId]
    )

    if (result.rows.length === 0) {
      throwAuthError(AuthErrorCodes.NOT_FOUND, 'User not found', 404)
    }

    const user = result.rows[0]

    c.status(200)
    return c.json({
      success: true,
      data: {
        user_id: user.id,
        email: user.email,
        role: user.role,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
      },
      error: null,
    })
  }
)

export default router
