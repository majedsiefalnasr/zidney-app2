/**
 * Backoffice Logout Route
 *
 * File: apps/api/src/routes/auth/backoffice-logout.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Single session logout for backoffice user
 *
 * Context: Backoffice (Institution Control Panel)
 * - Institution administrator logout
 * - Invalidates only current token
 * - User remains logged in on other devices
 * - Workspace-bound route
 *
 * Auth: Requires valid Backoffice JWT for workspace
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
 * Logout current backoffice session
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
 * 4. Return success
 */
router.post(
  '/',
  validateJwtMiddleware('backoffice'),
  validateLicenseMiddleware(),
  validateTokenVersionMiddleware('backoffice'),
  async (c) => {
    const authPayload = c.get('authPayload')
    const correlationId = c.get('correlationId')
    const workspaceSlug = c.get('workspaceSlug')

    logger.info(
      {
        correlation_id: correlationId,
        user_id: authPayload.user_id,
        event: 'logout',
        scope: 'backoffice',
        workspace_slug: workspaceSlug,
      },
      '[Backoffice Auth] User logged out'
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
