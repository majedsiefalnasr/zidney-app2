/**
 * MMC Get Me Route
 *
 * File: apps/api/src/routes/auth/mmc-get-me.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Get current MMC user profile
 *
 * Context: MMC (Platform Control Layer)
 * - Returns user info from JWT + DB
 * - Used for session verification
 * - Used to populate user menu in dashboard
 *
 * Auth: Requires valid MMC JWT
 *
 * Request:
 * GET /mmc/auth/me
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
import { db } from '../../db'
import { validateJwtMiddleware } from '../../middleware/auth/validate-jwt'
import { validateTokenVersionMiddleware } from '../../middleware/auth/validate-token-version'

const router = new Hono()

/**
 * Get current MMC user
 *
 * Operation:
 * 1. Verify JWT is valid (via middleware)
 * 2. Verify token_version matches (via middleware)
 * 3. Query user from DB for latest info
 * 4. Return user profile
 */
router.get('/', validateJwtMiddleware('mmc'), validateTokenVersionMiddleware('mmc'), async (c) => {
  const authPayload = c.get('authPayload')
  const userId = authPayload.user_id

  const result = await db.master.query(
    `
      SELECT id, email, role, last_login_at, created_at
      FROM mmc_users
      WHERE id = $1
      `,
    [userId]
  )

  if (result.rows.length === 0) {
    c.status(404)
    return c.json({
      success: false,
      data: null,
      error: {
        code: 'user_not_found',
        message: 'User not found',
      },
    })
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
})

export default router
