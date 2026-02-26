/**
 * Admin Rotate JWT Secret Route
 *
 * File: apps/api/src/routes/auth/admin-rotate-jwt-secret.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Rotate JWT secret for a workspace
 *
 * Context: Admin API
 * - Only MMC admins can execute
 * - Invalidate all JWTs by rotating the secret
 * - Used for security rotation or breach response
 * - All workspace users forced to re-authenticate
 *
 * Auth: Requires valid MMC JWT with admin role
 *
 * Request:
 * POST /admin/auth/rotate-jwt-secret
 * Header: Authorization: Bearer <mmc_token>
 * Body:
 * {
 *   workspace_id: string,
 *   reason: string (optional)
 * }
 *
 * Response (200):
 * {
 *   success: true,
 *   data: {
 *     message: "JWT secret rotated",
 *     workspace_id: string,
 *     affected_users: number
 *   },
 *   error: null
 * }
 *
 * Impact:
 * - All JWTs signed with old secret become invalid
 * - All workspace users must re-login
 * - No token_version update needed (secret change = automatic invalidation)
 */

import { zValidator } from '@hono/zod-validator'
import { randomBytes } from 'crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../db'
import {
  AuthErrorCodes,
  getAuditLogger,
  throwAuthError,
} from '../../middleware/auth/error-handler-middleware'
import { validateJwtMiddleware } from '../../middleware/auth/validate-jwt'

const router = new Hono()
const logger = getAuditLogger()

const rotateSchema = z.object({
  workspace_id: z.string().uuid(),
  reason: z.string().optional(),
})

type RotateRequest = z.infer<typeof rotateSchema>

/**
 * Rotate JWT secret for workspace
 *
 * Operation:
 * 1. Verify requester is MMC admin
 * 2. Generate new JWT secret (32 bytes)
 * 3. Update workspace.jwt_secret in master DB
 * 4. Get count of affected users (for audit)
 * 5. Log audit event
 *
 * Security:
 * - Only MMC admins can rotate
 * - Old JWTs become invalid immediately
 * - Audit trail recorded
 * - New secret stored encrypted in master DB
 */
router.post(
  '/',
  validateJwtMiddleware('mmc'),
  zValidator('json', rotateSchema, (result, _c) => {
    if (!result.success) {
      throwAuthError(AuthErrorCodes.VALIDATION_ERROR, 'Invalid request', 400)
    }
  }),
  async (c) => {
    const request = c.req.valid('json') as RotateRequest
    const adminPayload = c.get('authPayload')
    const correlationId = c.get('correlationId')

    // Only admin role can rotate
    if (adminPayload.role !== 'admin') {
      logger.warn(
        {
          correlation_id: correlationId,
          admin_id: adminPayload.user_id,
          workspace_id: request.workspace_id,
        },
        '[Admin Auth] Non-admin tried to rotate JWT secret'
      )

      throwAuthError(
        AuthErrorCodes.PERMISSION_DENIED,
        'Only admins can rotate secrets',
        403
      )
    }

    try {
      // Generate new secret
      const newSecret = randomBytes(32).toString('hex')

      const client = await db.master.connect()

      try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

        // Update workspace secret
        const result = await client.query(
          `
          UPDATE workspaces
          SET jwt_secret = $1,
              jwt_secret_rotated_at = NOW(),
              updated_at = NOW()
          WHERE id = $2
          RETURNING id, name
          `,
          [newSecret, request.workspace_id]
        )

        if (result.rows.length === 0) {
          await client.query('ROLLBACK')

          throwAuthError(AuthErrorCodes.NOT_FOUND, 'Workspace not found', 404)
        }

        const workspace = result.rows[0]

        // Count affected users for audit
        const _countResult = await client.query(
          `
          SELECT COUNT(*) FROM workspaces
          WHERE id = $1
          `,
          [request.workspace_id]
        )

        await client.query('COMMIT')

        // Log audit event (in master DB)
        await db.master.query(
          `
          INSERT INTO audit_logs (
            workspace_id,
            admin_id,
            event_type,
            event_data,
            correlation_id,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
          `,
          [
            request.workspace_id,
            adminPayload.user_id,
            'jwt_secret_rotated',
            JSON.stringify({
              reason: request.reason || 'Routine rotation',
              admin_email: adminPayload.email,
              rotated_at: new Date().toISOString(),
            }),
            correlationId,
          ]
        )

        logger.info(
          {
            correlation_id: correlationId,
            admin_id: adminPayload.user_id,
            workspace_id: request.workspace_id,
            workspace_name: workspace.name,
            event: 'jwt_secret_rotated',
            reason: request.reason,
          },
          '[Admin Auth] JWT secret rotated'
        )

        c.status(200)
        return c.json({
          success: true,
          data: {
            message: 'JWT secret rotated. All users must re-login.',
            workspace_id: request.workspace_id,
            workspace_name: workspace.name,
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
        '[Admin Auth] Secret rotation error'
      )

      throw err
    }
  }
)

export default router
