/**
 * MMC Logout All Routes
 *
 * File: apps/api/src/routes/auth/mmc-logout-all.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Invalidate ALL sessions at once
 *
 * Context: MMC (Platform Control Layer)
 * - Stateless revocation via token_version increment
 * - All existing tokens become invalid immediately
 * - No blocklist needed (token_version checked on every request)
 *
 * Auth: Requires valid MMC JWT
 *
 * Request:
 * POST /mmc/auth/logout-all
 * Header: Authorization: Bearer <token>
 *
 * Response (200):
 * {
 *   success: true,
 *   data: { message: "All sessions invalidated" },
 *   error: null
 * }
 *
 * Security:
 * - Atomic UPDATE (SERIALIZABLE transaction)
 * - Prevents concurrent logout-all race conditions
 * - Immediate invalidation across all devices
 */

import { Hono } from 'hono'
import { db } from '../../db'
import {
  AuthErrorCodes,
  getAuditLogger,
  throwAuthError,
} from '../../middleware/auth/error-handler-middleware'
import { validateJwtMiddleware } from '../../middleware/auth/validate-jwt'

const router = new Hono()
const logger = getAuditLogger()

/**
 * Invalidate all sessions
 *
 * Operation:
 * 1. Verify JWT is valid (via middleware)
 * 2. Increment user.token_version atomically
 * 3. All old tokens become invalid on next use
 * 4. User must log in again on all devices
 *
 * Transaction: SERIALIZABLE
 * Ensures no concurrent logout-all attempts
 */
router.post('/', validateJwtMiddleware('mmc'), async (c) => {
  const authPayload = c.get('authPayload')
  const correlationId = c.get('correlationId')
  const userId = authPayload.user_id

  try {
    const client = await db.master.connect()

    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

      // Increment token_version
      const result = await client.query(
        `
          UPDATE mmc_users
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
          scope: 'mmc',
          new_token_version: newVersion,
        },
        '[MMC Auth] All sessions invalidated'
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
      '[MMC Auth] Logout all failed'
    )

    throwAuthError(
      AuthErrorCodes.INTERNAL_ERROR,
      'Failed to logout from all sessions',
      500
    )
  }
})

export default router
