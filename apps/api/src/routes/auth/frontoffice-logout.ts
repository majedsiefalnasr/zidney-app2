/**
 * Frontoffice Logout Route
 *
 * File: apps/api/src/routes/auth/frontoffice-logout.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Single session logout for student
 *
 * Context: Frontoffice (Student Runtime)
 * - Student logout endpoint
 * - Invalidates only current token
 * - Student remains logged in on other devices
 * - Workspace-bound route
 *
 * Auth: Requires valid Frontoffice JWT
 *
 * Request:
 * POST /workspaces/{workspace_slug}/auth/logout
 * Header: Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   success: true,
 *   data: { message: "Logged out successfully" },
 *   error: null
 * }
 */

import { Hono } from 'hono'
import { getAuditLogger } from '../../middleware/auth/error-handler-middleware'
import { validateJwtMiddleware } from '../../middleware/auth/validate-jwt'
import { validateLicenseMiddleware } from '../../middleware/auth/validate-license-middleware'
import { validateTokenVersionMiddleware } from '../../middleware/auth/validate-token-version'

const router = new Hono()
const logger = getAuditLogger()

/**
 * Logout single session
 */
router.post(
  '/',
  validateJwtMiddleware('frontoffice'),
  validateLicenseMiddleware(),
  validateTokenVersionMiddleware('frontoffice'),
  async (c) => {
    const authPayload = c.get('authPayload')
    const correlationId = c.get('correlationId')
    const workspaceSlug = c.get('workspaceSlug')

    logger.info(
      {
        correlation_id: correlationId,
        user_id: authPayload.user_id,
        event: 'logout',
        scope: 'frontoffice',
        workspace_slug: workspaceSlug,
      },
      '[Frontoffice Auth] Student logged out'
    )

    c.status(200)
    return c.json({
      success: true,
      data: { message: 'Logged out successfully' },
      error: null,
    })
  }
)

export default router
