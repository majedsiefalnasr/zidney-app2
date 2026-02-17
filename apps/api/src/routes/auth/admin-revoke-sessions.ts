/**
 * Admin Revoke User Sessions Route
 *
 * File: apps/api/src/routes/auth/admin-revoke-sessions.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Force logout all sessions for a user (admin action)
 *
 * Context: Admin API
 * - Only MMC admins can execute
 * - Revoke all sessions for a specific user
 * - Used for account security (compromised password, suspicious activity)
 * - Works for both backoffice and frontoffice users
 *
 * Auth: Requires valid MMC JWT with admin role
 *
 * Request:
 * POST /admin/auth/revoke-sessions
 * Header: Authorization: Bearer <mmc_token>
 * Body:
 * {
 *   workspace_id: string,
 *   user_id: string,
 *   reason: string (optional, for audit)
 * }
 *
 * Response (200):
 * {
 *   success: true,
 *   data: {
 *     message: "User sessions revoked",
 *     user_id: string,
 *     session_count: number
 *   },
 *   error: null
 * }
 */

import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { db, getTenantPool } from '../../db'
import {
  AuthErrorCodes,
  getAuditLogger,
  throwAuthError,
} from '../../middleware/auth/error-handler-middleware'
import { validateJwtMiddleware } from '../../middleware/auth/validate-jwt'

const router = new Hono()
const logger = getAuditLogger()

const revokeSchemma = z.object({
  workspace_id: z.string().uuid(),
  user_id: z.string().uuid(),
  reason: z.string().optional(),
})

type RevokeRequest = z.infer<typeof revokeSchemma>

/**
 * Revoke all sessions for a user
 *
 * Operation:
 * 1. Verify requester is MMC admin
 * 2. Validate workspace exists
 * 3. Fetch user from tenant DB
 * 4. Increment token_version
 * 5. Log audit event
 *
 * Security:
 * - Only MMC admins can revoke sessions
 * - Audit trail includes admin_id + reason
 * - Tenant database used for user lookup
 */
router.post(
  '/',
  validateJwtMiddleware('mmc'),
  zValidator('json', revokeSchemma, (result, c) => {
    if (!result.success) {
      throwAuthError(AuthErrorCodes.VALIDATION_ERROR, 'Invalid request', 400)
    }
  }),
  async (c) => {
    const request = c.req.valid('json') as RevokeRequest
    const adminPayload = c.get('authPayload')
    const correlationId = c.get('correlationId')

    // Only admin role can revoke
    if (adminPayload.role !== 'admin') {
      logger.warn(
        {
          correlation_id: correlationId,
          admin_id: adminPayload.user_id,
          event: 'revoke_denied_insufficient_permissions',
        },
        '[Admin Auth] Non-admin tried to revoke sessions'
      )

      throwAuthError(
        AuthErrorCodes.PERMISSION_DENIED,
        'Only admins can revoke sessions',
        403
      )
    }

    try {
      // Get tenant pool
      const pool = getTenantPool(request.workspace_id)

      if (!pool) {
        throwAuthError(
          AuthErrorCodes.WORKSPACE_INVALID,
          'Workspace not found',
          404
        )
      }

      const client = await pool.connect()

      try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

        // Verify user exists
        const userResult = await client.query(
          `
          SELECT id, email FROM users WHERE id = $1
          `,
          [request.user_id]
        )

        if (userResult.rows.length === 0) {
          await client.query('ROLLBACK')
          throwAuthError(AuthErrorCodes.NOT_FOUND, 'User not found', 404)
        }

        const user = userResult.rows[0]

        // Increment token_version
        const result = await client.query(
          `
          UPDATE users
          SET token_version = token_version + 1,
              updated_at = NOW()
          WHERE id = $1
          RETURNING token_version
          `,
          [request.user_id]
        )

        const newVersion = result.rows[0].token_version

        // Log audit event in master DB
        await db.master.query(
          `
          INSERT INTO audit_logs (
            workspace_id,
            user_id,
            admin_id,
            event_type,
            event_data,
            correlation_id,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
          `,
          [
            request.workspace_id,
            request.user_id,
            adminPayload.user_id,
            'session_revoked_by_admin',
            JSON.stringify({
              reason: request.reason || 'Administrator action',
              admin_email: adminPayload.email,
            }),
            correlationId,
          ]
        )

        await client.query('COMMIT')

        logger.info(
          {
            correlation_id: correlationId,
            admin_id: adminPayload.user_id,
            user_id: request.user_id,
            event: 'session_revoked_by_admin',
            workspace_id: request.workspace_id,
            reason: request.reason,
          },
          '[Admin Auth] User sessions revoked'
        )

        c.status(200)
        return c.json({
          success: true,
          data: {
            message: 'User sessions revoked',
            user_id: request.user_id,
            user_email: user.email,
            new_token_version: newVersion,
          },
          error: null,
        })
      } finally {
        client.release()
      }
    } catch (err) {
      logger.error(
        {
          correlation_id: correlationId,
          error: err instanceof Error ? err.message : 'unknown',
        },
        '[Admin Auth] Session revocation error'
      )

      throw err
    }
  }
)

export default router
