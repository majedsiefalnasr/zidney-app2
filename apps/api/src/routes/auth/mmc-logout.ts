/**
 * MMC Logout Route
 *
 * File: apps/api/src/routes/auth/mmc-logout.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Single session logout
 *
 * Context: MMC (Platform Control Layer)
 * - Invalidates only current token
 * - Increments token_version by 1
 * - User remains logged in on other devices
 *
 * Auth: Requires valid MMC JWT
 *
 * Request:
 * POST /mmc/auth/logout
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
import { validateTokenVersionMiddleware } from '../../middleware/auth/validate-token-version'

const router = new Hono()
const logger = getAuditLogger()

/**
 * Logout current session
 *
 * Operation:
 * 1. Verify JWT is valid (via middleware)
 * 2. Verify token_version matches (no concurrent logout)
 * 3. Return success (current token is now invalid on next request)
 *
 * Note: Client must delete token from client-side storage
 * Token remains valid until token_version is incremented (via logout-all)
 */
router.post('/', validateJwtMiddleware('mmc'), validateTokenVersionMiddleware('mmc'), async (c) => {
  const authPayload = c.get('authPayload')
  const correlationId = c.get('correlationId')

  logger.info(
    {
      correlation_id: correlationId,
      user_id: authPayload.user_id,
      event: 'logout',
      scope: 'mmc',
    },
    '[MMC Auth] User logged out'
  )

  c.status(200)
  return c.json({
    success: true,
    data: { message: 'Logged out successfully' },
    error: null,
  })
})

export default router
