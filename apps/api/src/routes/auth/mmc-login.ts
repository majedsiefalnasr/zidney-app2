/**
 * MMC Login Route
 *
 * File: apps/api/src/routes/auth/mmc-login.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Authenticate platform administrator
 *
 * Context: MMC (Platform Control Layer)
 * - No workspace context
 * - Uses master database directly
 * - JWT scope: "mmc"
 *
 * Request:
 * POST /mmc/auth/login
 * {
 *   email: string,
 *   password: string
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
 * - 400: VALIDATION_ERROR (missing fields)
 * - 401: INVALID_CREDENTIALS
 * - 423: ACCOUNT_LOCKED (5 failed attempts)
 * - 500: INTERNAL_ERROR
 */

import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import * as auth from '../../auth'
import { db } from '../../db'
import {
  AuthErrorCodes,
  getAuditLogger,
  throwAuthError,
} from '../../middleware/auth/error-handler-middleware'
import { validateJwtMiddleware } from '../../middleware/auth/validate-jwt'

const router = new Hono()
const logger = getAuditLogger()

// Request validation schema
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginRequest = z.infer<typeof loginSchema>

/**
 * MMC Login Handler
 *
 * Auth flow:
 * 1. Validate email/password format
 * 2. Look up user in master.mmc_users (FOR UPDATE lock)
 * 3. Check account lock status (locked_until > NOW())
 * 4. Verify password (with dummy hash for timing safety)
 * 5. On success: reset failed_login_count, return JWT
 * 6. On failure: increment counter, lock at 5 attempts
 *
 * Transaction: SERIALIZABLE
 * Isolation: Prevents concurrent login race conditions
 */
router.post(
  '/login',
  zValidator('json', loginSchema, (result, c) => {
    if (!result.success) {
      throwAuthError(
        AuthErrorCodes.VALIDATION_ERROR,
        'Invalid login request',
        400
      )
    }
  }),
  async (c) => {
    const request = c.req.valid('json') as LoginRequest
    const correlationId = c.get('correlationId')
    const startTime = Date.now()

    try {
      // Start transaction (SERIALIZABLE isolation)
      const client = await db.master.connect()

      try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

        // Phase 1: Fetch user with lock
        const userResult = await client.query(
          `
          SELECT id, email, password_hash, token_version, locked_until
          FROM mmc_users
          WHERE email = $1
          FOR UPDATE
          `,
          [request.email]
        )

        if (userResult.rows.length === 0) {
          // User not found → log & increment phantom counter
          logger.warn(
            {
              correlation_id: correlationId,
              email: request.email,
              event: 'login_failed_not_found',
              scope: 'mmc',
            },
            '[MMC Auth] Login attempt for non-existent user'
          )

          // Use dummy hash to prevent timing attacks
          await auth.password.verifyPassword(
            request.password,
            auth.password.getDummyHash()
          )

          throwAuthError(
            AuthErrorCodes.INVALID_CREDENTIALS,
            'Invalid email or password',
            401
          )
        }

        const user = userResult.rows[0]

        // Phase 2: Check account lock
        if (user.locked_until && user.locked_until > new Date()) {
          logger.warn(
            {
              correlation_id: correlationId,
              user_id: user.id,
              event: 'login_failed_account_locked',
              scope: 'mmc',
            },
            '[MMC Auth] Account locked'
          )

          await client.query('ROLLBACK')

          throwAuthError(
            AuthErrorCodes.ACCOUNT_LOCKED,
            'Account locked due to too many failed attempts',
            423
          )
        }

        // Phase 3: Verify password
        const passwordValid = await auth.password.verifyPassword(
          request.password,
          user.password_hash
        )

        if (!passwordValid) {
          // Increment failed counter
          const failed = await client.query(
            `
            UPDATE mmc_users
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
              scope: 'mmc',
              failed_count: updated.failed_login_count,
              account_locked: updated.locked_until > new Date(),
            },
            '[MMC Auth] Invalid password'
          )

          await client.query('COMMIT')

          if (updated.locked_until > new Date()) {
            throwAuthError(
              AuthErrorCodes.ACCOUNT_LOCKED,
              'Account locked due to too many failed attempts',
              423
            )
          }

          throwAuthError(
            AuthErrorCodes.INVALID_CREDENTIALS,
            'Invalid email or password',
            401
          )
        }

        // Phase 4: Success - reset counters and generate token
        await client.query(
          `
          UPDATE mmc_users
          SET failed_login_count = 0,
              locked_until = NULL,
              last_login_at = NOW()
          WHERE id = $1
          `,
          [user.id]
        )

        await client.query('COMMIT')

        // Generate JWT
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

        const token = auth.jwt.signToken(
          {
            user_id: user.id,
            email: user.email,
            scope: 'mmc',
            type: 'access',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(expiresAt.getTime() / 1000),
          },
          'mmc' // Use MMC secret key
        )

        logger.info(
          {
            correlation_id: correlationId,
            user_id: user.id,
            event: 'login_success',
            scope: 'mmc',
            duration_ms: Date.now() - startTime,
          },
          '[MMC Auth] Login successful'
        )

        c.status(200)
        return c.json({
          success: true,
          data: {
            user_id: user.id,
            email: user.email,
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
        '[MMC Auth] Login error'
      )
      throw err
    }
  }
)

/**
 * Get current MMC user
 */
router.get('/me', validateJwtMiddleware('mmc'), async (c) => {
  const authPayload = c.get('authPayload')

  c.status(200)
  return c.json({
    success: true,
    data: {
      user_id: authPayload.user_id,
      email: authPayload.email,
    },
    error: null,
  })
})

export default router
