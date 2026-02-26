/**
 * Verify Token Route (Internal)
 *
 * File: apps/api/src/routes/auth/verify-token.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Internal token verification endpoint
 *
 * Context: Internal API
 * - Used by internal services to verify tokens
 * - Used by API gateway / service mesh
 * - Used for inter-service authentication
 * - Works for all token types (MMC, backoffice, frontoffice)
 *
 * Auth: Optional (checks Authorization header if present)
 *
 * Request (Mode 1 - Verify current session):
 * POST /auth/verify-token
 * Header: Authorization: Bearer <token>
 *
 * Request (Mode 2 - Verify external token):
 * POST /auth/verify-token
 * Body:
 * {
 *   token: string,
 *   scope: "mmc" | "backoffice" | "frontoffice"
 * }
 *
 * Response (200):
 * {
 *   success: true,
 *   data: {
 *     valid: boolean,
 *     user_id?: string,
 *     email?: string,
 *     scope?: string,
 *     workspace_id?: string,
 *     expires_at?: ISO8601,
 *     reason?: string (if invalid)
 *   },
 *   error: null
 * }
 */

import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import * as auth from '../../auth'
import { db, getTenantPool } from '../../db'

const router = new Hono()

const verifySchema = z.object({
  token: z.string(),
  scope: z.enum(['mmc', 'backoffice', 'frontoffice']),
})

type VerifyRequest = z.infer<typeof verifySchema>

/**
 * Verify token validity
 *
 * Two modes:
 * 1. Automatic detection (from Authorization header)
 * 2. Explicit scope (from request body)
 *
 * Checks:
 * 1. JWT signature
 * 2. Expiration
 * 3. Token version (for backoffice/frontoffice)
 * 4. User exists in DB
 */
router.post(
  '/',
  zValidator('json', verifySchema, (result, _c) => {
    // Validation errors are non-fatal
  }),
  async (c) => {
    const body = c.req.valid('json')

    if (!body.token) {
      return c.json({
        success: true,
        data: {
          valid: false,
          reason: 'no_token_provided',
        },
        error: null,
      })
    }

    try {
      // Verify JWT
      const payload = auth.jwt.verifyToken(body.token, body.scope)

      // Additional checks based on scope
      if (body.scope === 'mmc') {
        // Check user exists in mmc_users
        const userResult = await db.master.query(
          `
          SELECT id, token_version FROM mmc_users WHERE id = $1
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

        // Check token version
        if (payload.token_version !== user.token_version) {
          return c.json({
            success: true,
            data: {
              valid: false,
              reason: 'token_version_mismatch',
            },
            error: null,
          })
        }

        return c.json({
          success: true,
          data: {
            valid: true,
            user_id: payload.user_id,
            email: payload.email,
            scope: body.scope,
            expires_at: new Date((payload.exp ?? 0) * 1000).toISOString(),
          },
          error: null,
        })
      }

      // For backoffice/frontoffice
      const workspaceId = payload.workspace_id

      if (!workspaceId) {
        return c.json({
          success: true,
          data: {
            valid: false,
            reason: 'invalid_workspace',
          },
          error: null,
        })
      }

      const pool = getTenantPool(workspaceId)

      if (!pool) {
        return c.json({
          success: true,
          data: {
            valid: false,
            reason: 'workspace_not_found',
          },
          error: null,
        })
      }

      // Check user exists and token version matches
      const userResult = await pool.query(
        `
        SELECT id, token_version FROM users WHERE id = $1
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

      if (payload.token_version !== user.token_version) {
        return c.json({
          success: true,
          data: {
            valid: false,
            reason: 'token_version_mismatch',
          },
          error: null,
        })
      }

      return c.json({
        success: true,
        data: {
          valid: true,
          user_id: payload.user_id,
          email: payload.email,
          scope: body.scope,
          workspace_id: workspaceId,
          expires_at: new Date((payload.exp ?? 0) * 1000).toISOString(),
        },
        error: null,
      })
    } catch (err) {
      return c.json({
        success: true,
        data: {
          valid: false,
          reason:
            err instanceof Error && err.message.includes('expired')
              ? 'token_expired'
              : 'invalid_signature',
        },
        error: null,
      })
    }
  }
)

export default router
