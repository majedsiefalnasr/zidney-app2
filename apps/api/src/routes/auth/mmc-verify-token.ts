/**
 * MMC Verify Token Route
 *
 * File: apps/api/src/routes/auth/mmc-verify-token.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Internal token verification endpoint
 *
 * Context: MMC (Platform Control Layer)
 * - Used by internal services to verify MMC tokens
 * - Used for inter-service authentication
 * - Used by API gateway / service mesh
 *
 * Auth: Requires valid MMC JWT
 *
 * Request:
 * POST /mmc/auth/verify-token
 * Header: Authorization: Bearer <token>
 * Body:
 * {
 *   token: string (optional - verify external token)
 * }
 *
 * Response (200):
 * {
 *   success: true,
 *   data: {
 *     valid: boolean,
 *     user_id: string,
 *     email: string,
 *     expires_at: ISO8601
 *   },
 *   error: null
 * }
 */

import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import * as auth from '../../auth'
import { db } from '../../db'
import { validateJwtMiddleware } from '../../middleware/auth/validate-jwt'
import { validateTokenVersionMiddleware } from '../../middleware/auth/validate-token-version'

const router = new Hono()

const verifySchema = z.object({
  token: z.string().optional(),
})

/**
 * Verify MMC token
 *
 * Two modes:
 * 1. Verify current session (no body) → uses Authorization header
 * 2. Verify external token (with body) → uses provided token
 *
 * Operation:
 * 1. Extract token (from header or body)
 * 2. Verify JWT signature
 * 3. Check token_version in DB
 * 4. Return validity + user info
 */
router.post(
  '/',
  validateJwtMiddleware('mmc'),
  validateTokenVersionMiddleware('mmc'),
  zValidator('json', verifySchema, (result, c) => {
    // Validation errors are non-fatal for this endpoint
  }),
  async (c) => {
    const body = c.req.valid('json')
    const authPayload = c.get('authPayload')

    // If token provided in body, verify it separately
    if (body.token && body.token !== '') {
      try {
        const payload = auth.jwt.verifyToken(body.token, 'mmc')

        // Check token_version
        if (payload.type !== 'access') {
          return c.json({
            success: true,
            data: {
              valid: false,
              reason: 'invalid_token_type',
            },
            error: null,
          })
        }

        const userResult = await db.master.query(
          `
          SELECT id, email, token_version FROM mmc_users WHERE id = $1
          `,
          [payload.user_id]
        )

        if (userResult.rows.length === 0) {
          return c.json({
            success: true,
            data: {
              valid: false,
              reason: 'user_not_found',
            },
            error: null,
          })
        }

        const user = userResult.rows[0]

        if (user.token_version !== payload.token_version) {
          return c.json({
            success: true,
            data: {
              valid: false,
              reason: 'token_version_mismatch',
            },
            error: null,
          })
        }

        // Token is valid
        return c.json({
          success: true,
          data: {
            valid: true,
            user_id: payload.user_id,
            email: payload.email,
            expires_at: new Date((payload.exp ?? 0) * 1000).toISOString(),
          },
          error: null,
        })
      } catch (err) {
        return c.json({
          success: true,
          data: {
            valid: false,
            reason: 'invalid_signature',
          },
          error: null,
        })
      }
    }

    // Verify current session token
    c.status(200)
    return c.json({
      success: true,
      data: {
        valid: true,
        user_id: authPayload.user_id,
        email: authPayload.email,
        expires_at: new Date(authPayload.exp * 1000).toISOString(),
      },
      error: null,
    })
  }
)

export default router
