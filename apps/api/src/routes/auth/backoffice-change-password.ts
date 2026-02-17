/**
 * Backoffice Change Password Route
 *
 * File: apps/api/src/routes/auth/backoffice-change-password.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Change backoffice user password
 *
 * Context: Backoffice (Institution Control Panel)
 * - Allow authenticated users to change their password
 * - Invalidates all existing sessions (increment token_version)
 * - User must log in again on all devices
 * - Workspace-bound route
 *
 * Auth: Requires valid Backoffice JWT for workspace
 *
 * Request:
 * POST /workspaces/{workspace_slug}/auth/change-password
 * Header: Authorization: Bearer <token>
 * Body:
 * {
 *   current_password: string,
 *   new_password: string,
 *   confirm_password: string
 * }
 *
 * Response (200):
 * {
 *   success: true,
 *   data: { message: "Password changed successfully" },
 *   error: null
 * }
 *
 * Errors:
 * - 400: VALIDATION_ERROR (password too weak)
 * - 401: INVALID_CREDENTIALS (current password wrong)
 * - 500: INTERNAL_ERROR
 */

import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import * as auth from '../../auth'
import { getTenantPool } from '../../db'
import {
  AuthErrorCodes,
  getAuditLogger,
  throwAuthError,
} from '../../middleware/auth/error-handler-middleware'
import { validateJwtMiddleware } from '../../middleware/auth/validate-jwt'
import { validateLicenseMiddleware } from '../../middleware/auth/validate-license-middleware'
import { validateTokenVersionMiddleware } from '../../middleware/auth/validate-token-version'

const router = new Hono()
const logger = getAuditLogger()

const changePasswordSchema = z
  .object({
    current_password: z.string().min(8, 'Password too short'),
    new_password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })
  .refine((data) => data.current_password !== data.new_password, {
    message: 'New password must be different from current password',
    path: ['new_password'],
  })

type ChangePasswordRequest = z.infer<typeof changePasswordSchema>

/**
 * Change password handler
 *
 * Middleware order:
 * 1. validateJwt (backoffice scope)
 * 2. validateLicense
 * 3. validateTokenVersion
 * 4. auditLogger (after handler)
 *
 * Operation:
 * 1. Validate current password
 * 2. Hash new password
 * 3. Update user record
 * 4. Increment token_version (invalidate all sessions)
 * 5. Return success
 *
 * Security:
 * - Transaction SERIALIZABLE prevents concurrent updates
 * - Timing-safe password verification
 * - All existing tokens invalidated
 */
router.post(
  '/',
  validateJwtMiddleware('backoffice'),
  validateLicenseMiddleware(),
  validateTokenVersionMiddleware('backoffice'),
  zValidator('json', changePasswordSchema, (result, c) => {
    if (!result.success) {
      throwAuthError(
        AuthErrorCodes.VALIDATION_ERROR,
        result.error.flatten().fieldErrors.new_password?.[0] ||
          'Invalid request',
        400
      )
    }
  }),
  async (c) => {
    const request = c.req.valid('json') as ChangePasswordRequest
    const authPayload = c.get('authPayload')
    const correlationId = c.get('correlationId')
    const workspaceId = c.get('workspaceId')
    const userId = authPayload.user_id

    try {
      const pool = getTenantPool(workspaceId)

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

        // Fetch user with lock
        const userResult = await client.query(
          `
          SELECT id, password_hash FROM users
          WHERE id = $1 AND role IN ('admin', 'instructor')
          FOR UPDATE
          `,
          [userId]
        )

        if (userResult.rows.length === 0) {
          throw new Error('User not found')
        }

        const user = userResult.rows[0]

        // Verify current password
        const isValid = await auth.password.verifyPassword(
          request.current_password,
          user.password_hash
        )

        if (!isValid) {
          logger.warn(
            {
              correlation_id: correlationId,
              user_id: userId,
              event: 'password_change_failed_invalid_current',
              workspace_id: workspaceId,
            },
            '[Backoffice Auth] Invalid current password'
          )

          await client.query('ROLLBACK')

          throwAuthError(
            AuthErrorCodes.INVALID_CREDENTIALS,
            'Current password is incorrect',
            401
          )
        }

        // Hash new password
        const newHash = await auth.password.hashPassword(request.new_password)

        // Update password and increment token_version
        await client.query(
          `
          UPDATE users
          SET password_hash = $1,
              token_version = token_version + 1,
              updated_at = NOW()
          WHERE id = $2
          `,
          [newHash, userId]
        )

        await client.query('COMMIT')

        logger.info(
          {
            correlation_id: correlationId,
            user_id: userId,
            event: 'password_changed',
            workspace_id: workspaceId,
          },
          '[Backoffice Auth] Password changed, all sessions invalidated'
        )

        c.status(200)
        return c.json({
          success: true,
          data: {
            message: 'Password changed successfully. Please log in again.',
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
          user_id: userId,
          error: err instanceof Error ? err.message : 'unknown',
        },
        '[Backoffice Auth] Password change error'
      )

      throw err
    }
  }
)

export default router
