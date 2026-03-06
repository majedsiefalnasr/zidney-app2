/**
 * Frontoffice Get Me Route
 *
 * File: apps/api/src/routes/auth/frontoffice-get-me.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Get current student profile
 *
 * Context: Frontoffice (Student Runtime)
 * - Returns student info from JWT + tenant DB
 * - Used for session verification
 * - Used to populate student profile in dashboard
 * - Workspace-bound route
 *
 * Auth: Requires valid Frontoffice JWT
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
import { AuthErrorCodes, throwAuthError } from '../../middleware/auth/error-handler-middleware'
import { validateJwtMiddleware } from '../../middleware/auth/validate-jwt'
import { validateLicenseMiddleware } from '../../middleware/auth/validate-license-middleware'
import { validateTokenVersionMiddleware } from '../../middleware/auth/validate-token-version'

const router = new Hono()

/**
 * Get current student profile
 *
 * Operation:
 * 1. Verify JWT is valid (via middleware)
 * 2. Verify license is active (via middleware)
 * 3. Verify token_version matches (via middleware)
 * 4. Query user from tenant DB
 * 5. Return student profile
 */
router.get(
  '/',
  validateJwtMiddleware('frontoffice'),
  validateLicenseMiddleware(),
  validateTokenVersionMiddleware('frontoffice'),
  async (c) => {
    const authPayload = c.get('authPayload')
    const userId = authPayload.user_id
    const workspaceId = c.get('workspaceId')

    if (!workspaceId) {
      throwAuthError(AuthErrorCodes.WORKSPACE_INVALID, 'Workspace not found', 404)
    }

    const pool = getTenantPool(workspaceId)

    if (!pool) {
      throwAuthError(AuthErrorCodes.WORKSPACE_INVALID, 'Workspace not found', 404)
    }

    const result = await pool.query(
      `
      SELECT id, email, role, last_login_at, created_at
      FROM users
      WHERE id = $1 AND role = 'student'
      `,
      [userId]
    )

    if (result.rows.length === 0) {
      throwAuthError(AuthErrorCodes.NOT_FOUND, 'Student not found', 404)
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
