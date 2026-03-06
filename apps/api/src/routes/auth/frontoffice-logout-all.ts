/**
 * Frontoffice Logout All Route
 *
 * File: apps/api/src/routes/auth/frontoffice-logout-all.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Invalidate ALL student sessions
 *
 * Context: Frontoffice (Student Runtime)
 * - Student logout all devices
 * - Stateless revocation via token_version increment
 * - All existing tokens become invalid immediately
 * - Workspace-bound route
 *
 * Auth: Requires valid Frontoffice JWT
 *
 * Request:
 * POST /workspaces/{workspace_slug}/auth/logout-all
 * Header: Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   success: true,
 *   data: { message: "All sessions invalidated" },
 *   error: null
 * }
 */

import { Hono } from 'hono'
import { getTenantPool } from '../../db'
import {
  AuthErrorCodes,
  getAuditLogger,
  throwAuthError,
} from '../../middleware/auth/error-handler-middleware'
import { validateJwtMiddleware } from '../../middleware/auth/validate-jwt'
import { validateLicenseMiddleware } from '../../middleware/auth/validate-license-middleware'

const router = new Hono()
const logger = getAuditLogger()

/**
 * Invalidate all sessions
 *
 * Operation:
 * 1. Verify JWT is valid (via middleware)
 * 2. Verify license is active (via middleware)
 * 3. Increment user.token_version atomically
 * 4. All old tokens become invalid on next use
 *
 * Transaction: SERIALIZABLE
 */
router.post('/', validateJwtMiddleware('frontoffice'), validateLicenseMiddleware(), async (c) => {
  const authPayload = c.get('authPayload')
  const correlationId = c.get('correlationId')
  const workspaceId = c.get('workspaceId')
  const workspaceSlug = c.get('workspaceSlug')
  const userId = authPayload.user_id

  try {
    if (!workspaceId) {
      throwAuthError(AuthErrorCodes.WORKSPACE_INVALID, 'Workspace not found', 404)
    }

    const pool = getTenantPool(workspaceId)

    if (!pool) {
      throwAuthError(AuthErrorCodes.WORKSPACE_INVALID, 'Workspace not found', 404)
    }

    const client = await pool.connect()

    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

      const result = await client.query(
        `
          UPDATE users
          SET token_version = token_version + 1,
              updated_at = NOW()
          WHERE id = $1
          RETURNING token_version
          `,
        [userId]
      )

      if (result.rows.length === 0) {
        throw new Error('User not found')
      }

      const newVersion = result.rows[0].token_version

      await client.query('COMMIT')

      logger.info(
        {
          correlation_id: correlationId,
          user_id: userId,
          event: 'logout_all',
          scope: 'frontoffice',
          workspace_slug: workspaceSlug,
          new_token_version: newVersion,
        },
        '[Frontoffice Auth] All sessions invalidated'
      )

      c.status(200)
      return c.json({
        success: true,
        data: { message: 'All sessions invalidated' },
        error: null,
      })
    } finally {
      client.release()
    }
  } catch (err) {
    logger.error(
      {
        correlation_id: correlationId,
        user_id: userId,
        error: err instanceof Error ? err.message : 'unknown',
      },
      '[Frontoffice Auth] Logout all failed'
    )

    throwAuthError(AuthErrorCodes.INTERNAL_ERROR, 'Failed to logout from all sessions', 500)
  }
})

export default router
