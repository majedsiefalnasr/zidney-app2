/**
 * Frontoffice Login Route
 *
 * File: apps/api/src/routes/auth/frontoffice-login.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Student authentication
 *
 * Context: Frontoffice (Student Runtime)
 * - Student login endpoint
 * - Workspace-bound route
 * - JWT scope: "frontoffice"
 *
 * Request:
 * POST /workspaces/{workspace_slug}/auth/login
 * {
 *   email: string,
 *   password: string,
 *   attempt_id?: string (optional, for resuming attempt)
 * }
 *
 * Response (200):
 * {
 *   success: true,
 *   data: {
 *     user_id: string,
 *     email: string,
 *     role: string,
 *     token: string,
 *     expires_at: ISO8601
 *   },
 *   error: null
 * }
 *
 * Errors:
 * - 400: VALIDATION_ERROR
 * - 401: INVALID_CREDENTIALS
 * - 423: ACCOUNT_LOCKED
 * - 426: SCHEMA_VERSION_MISMATCH
 * - 423: LICENSE_SOFT_LOCKED
 * - 403: LICENSE_ARCHIVED
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
import { validateLicenseMiddleware } from '../../middleware/auth/validate-license-middleware'
import { validateSchemaVersionMiddleware } from '../../middleware/auth/validate-schema-version-middleware'

const router = new Hono()
const logger = getAuditLogger()

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  attempt_id: z.string().optional(),
})

type LoginRequest = z.infer<typeof loginSchema>

/**
 * Frontoffice login handler
 *
 * Auth flow (identical to backoffice):
 * 1. Validate workspace + license
 * 2. Validate request format
 * 3. Fetch user with FOR UPDATE lock (SERIALIZABLE)
 * 4. Check account lock status
 * 5. Verify password (timing-safe)
 * 6. On success: reset counters, generate JWT
 * 7. On failure: increment counter, lock at 5 attempts
 *
 * Scope: frontoffice (student runtime)
 * Role filter: Only "student" users
 */
router.post(
  '/',
  validateSchemaVersionMiddleware(),
  validateLicenseMiddleware(),
  zValidator('json', loginSchema, (result, _c) => {
    if (!result.success) {
      throwAuthError(AuthErrorCodes.VALIDATION_ERROR, 'Invalid login request', 400)
    }
  }),
  async (c) => {
    const request = c.req.valid('json') as LoginRequest
    const correlationId = c.get('correlationId')
    const workspaceId = c.get('workspaceId')
    const workspaceSlug = c.get('workspaceSlug')
    const startTime = Date.now()

    try {
      if (!workspaceId) {
        throwAuthError(AuthErrorCodes.WORKSPACE_INVALID, 'Workspace not found', 404)
      }

      const pool = getTenantPool(workspaceId)

      if (!pool) {
        throwAuthError(AuthErrorCodes.WORKSPACE_INVALID, 'Workspace not found', 404)
      }

      const client = await pool.connect()

      try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

        // Fetch user with lock
        const userResult = await client.query(
          `
          SELECT id, email, password_hash, token_version, locked_until
          FROM students
          WHERE email = $1 AND status = 'ACTIVE'
          FOR UPDATE
          `,
          [request.email]
        )

        if (userResult.rows.length === 0) {
          // Dummy hash for timing safety
          await auth.password.verifyPassword(request.password, auth.password.getDummyHash())

          logger.warn(
            {
              correlation_id: correlationId,
              email: request.email,
              event: 'login_failed_not_found',
              scope: 'frontoffice',
              workspace_slug: workspaceSlug,
            },
            '[Frontoffice Auth] Login attempt for non-existent student'
          )

          throwAuthError(AuthErrorCodes.INVALID_CREDENTIALS, 'Invalid email or password', 401)
        }

        const user = userResult.rows[0]

        // Check account lock
        if (user.locked_until && user.locked_until > new Date()) {
          logger.warn(
            {
              correlation_id: correlationId,
              user_id: user.id,
              event: 'login_failed_account_locked',
              scope: 'frontoffice',
              workspace_slug: workspaceSlug,
            },
            '[Frontoffice Auth] Account locked'
          )

          await client.query('ROLLBACK')

          throwAuthError(
            AuthErrorCodes.ACCOUNT_LOCKED,
            'Account locked due to too many failed attempts',
            423
          )
        }

        // Verify password
        const passwordValid = await auth.password.verifyPassword(
          request.password,
          user.password_hash
        )

        if (!passwordValid) {
          const failed = await client.query(
            `
            UPDATE students
            SET failed_login_count = failed_login_count + 1,
                locked_until = CASE
                  WHEN failed_login_count >= 4 THEN NOW() + INTERVAL '15 minutes'
                  ELSE locked_until
                END
            WHERE id = $1
            RETURNING failed_login_count, locked_until
            `,
            [user.id]
          )

          const updated = failed.rows[0]

          logger.warn(
            {
              correlation_id: correlationId,
              user_id: user.id,
              event: 'login_failed_invalid_password',
              scope: 'frontoffice',
              workspace_slug: workspaceSlug,
              failed_count: updated.failed_login_count,
            },
            '[Frontoffice Auth] Invalid password'
          )

          await client.query('COMMIT')

          if (updated.locked_until > new Date()) {
            throwAuthError(
              AuthErrorCodes.ACCOUNT_LOCKED,
              'Account locked due to too many failed attempts',
              423
            )
          }

          throwAuthError(AuthErrorCodes.INVALID_CREDENTIALS, 'Invalid email or password', 401)
        }

        // Success - reset counters
        await client.query(
          `
          UPDATE students
          SET failed_login_count = 0,
              locked_until = NULL,
              last_login_at = NOW()
          WHERE id = $1
          `,
          [user.id]
        )

        await client.query('COMMIT')

        // Generate JWT
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

        const token = auth.jwt.signToken(
          {
            user_id: user.id,
            email: user.email,
            workspace_id: workspaceId,
            scope: 'frontoffice',
            type: 'access',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(expiresAt.getTime() / 1000),
          },
          workspaceId
        )

        logger.info(
          {
            correlation_id: correlationId,
            user_id: user.id,
            event: 'login_success',
            scope: 'frontoffice',
            workspace_slug: workspaceSlug,
            duration_ms: Date.now() - startTime,
          },
          '[Frontoffice Auth] Student login successful'
        )

        c.status(200)
        return c.json({
          success: true,
          data: {
            user_id: user.id,
            email: user.email,
            role: 'student',
            token,
            expires_at: expiresAt.toISOString(),
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
        '[Frontoffice Auth] Login error'
      )

      throw err
    }
  }
)

export default router
