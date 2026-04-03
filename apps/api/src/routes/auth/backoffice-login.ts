/**
 * Backoffice Login Route
 *
 * File: apps/api/src/routes/auth/backoffice-login.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Authenticate workspace staff (instructors, admins) and issue JWT token.
 *
 * Endpoint: POST /auth/backoffice/login
 * Scope: Tenant-bound (requires resolved workspace context)
 * Authentication: None (no JWT required for login)
 * Response: JWT token + user info (200) or error (401, 423, 426)
 *
 * Flow:
 * 1. Validate request body (email, password)
 * 2. Resolve workspace (from subdomain/path)
 * 3. Check workspace license state (ACTIVE required)
 * 4. Verify user exists in workspace database
 * 5. Check account lock status
 * 6. Verify password (with dummy hash for timing attack prevention)
 * 7. On success: generate JWT token, reset failed_login_count
 * 8. On failure: increment failed_login_count, auto-lock at 5 attempts
 * 9. Log audit event
 * 10. Return token or error
 *
 * Errors:
 * - 400: Invalid request body (email/password missing)
 * - 401: Invalid credentials or user not found
 * - 401: Account locked (temporary)
 * - 423: Workspace soft-locked
 * - 403: Workspace archived
 * - 426: Schema version mismatch
 *
 * Compliance:
 * - ADR-0001: Database-per-tenant (resolves workspace first)
 * - ADR-0006: Server-authoritative time (NOW() in database)
 * - AGENTS.md: Transaction safety (FOR UPDATE lock on user row)
 * - Standard error contract
 * - Comprehensive audit logging
 */

import {
  generateStaffDummyHash,
  logAccountLocked,
  logLoginFailure,
  logLoginSuccess,
  signBackofficeToken,
  verifyStaffPassword,
} from '@zidney/domain-core/auth'
import { logger } from '@zidney/logger'
import type { Context } from 'hono'

/**
 * POST /auth/backoffice/login
 *
 * Request body:
 * ```json
 * {
 *   "email": "instructor@example.com",
 *   "password": "secure_password_123"
 * }
 * ```
 *
 * Success response (200):
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "access_token": "eyJhbGc...",
 *     "token_type": "Bearer",
 *     "expires_in": 900,
 *     "user": {
 *       "id": "user-uuid",
 *       "email": "instructor@example.com",
 *       "role": "INSTRUCTOR",
 *       "workspace_id": "workspace-uuid"
 *     }
 *   },
 *   "error": null
 * }
 * ```
 *
 * Error response (401):
 * ```json
 * {
 *   "success": false,
 *   "data": null,
 *   "error": {
 *     "code": "INVALID_CREDENTIALS",
 *     "message": "Invalid email or password"
 *   }
 * }
 * ```
 */
export async function backofficeLoginHandler(c: Context) {
  const correlationId = c.get('correlationId') || 'unknown'
  const workspaceSlug = c.get('workspaceSlug') || 'unknown'
  const workspaceId = c.get('workspaceId')
  const tenantDb = c.get('tenantDb')

  try {
    // === STEP 1: Parse & validate request ===
    const body = await c.req.json().catch(() => ({}))
    const { email, password } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Email is required and must be valid',
          },
        },
        400
      )
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Password is required',
          },
        },
        400
      )
    }

    // === STEP 2: Check workspace context ===
    if (!workspaceId || !tenantDb) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'WORKSPACE_NOT_RESOLVED',
            message: 'Workspace not found',
          },
        },
        400
      )
    }

    // === STEP 3: Fetch user with FOR UPDATE lock ===
    // Critical: Use FOR UPDATE to prevent concurrent login race conditions
    const client = await tenantDb.connect()

    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

      const userResult = await client.query(
        `SELECT u.id, u.email, u.password_hash, r.name AS role, u.token_version,
                u.locked_until, u.failed_login_count, u.status
         FROM backoffice_staff_users u
         JOIN backoffice_roles r ON r.id = u.role_id
         WHERE u.email = $1 AND u.is_deleted = false
         FOR UPDATE`,
        [email]
      )

      const user = userResult.rows[0]

      // === STEP 4: Timing-attack safe password check ===
      // Always verify even if user not found (prevents email enumeration)
      const passwordHash = user ? user.password_hash : generateStaffDummyHash()
      const passwordValid = await verifyStaffPassword(passwordHash, password)

      // === STEP 5: Check if user found (after time-safe verification) ===
      if (!user || user.status !== 'ACTIVE') {
        await logLoginFailure(correlationId, email, workspaceSlug, 'user_not_found_or_inactive', 0)
        await client.query('COMMIT')
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password',
            },
          },
          401
        )
      }

      // === STEP 6: Check account lock ===
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        await logLoginFailure(
          correlationId,
          email,
          workspaceSlug,
          'account_locked',
          user.failed_login_count
        )
        await client.query('COMMIT')
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'ACCOUNT_LOCKED',
              message: 'Account temporarily locked. Please try again later.',
            },
          },
          401
        )
      }

      // === STEP 7: Check password ===
      if (!passwordValid) {
        // Increment failed login counter
        const newFailCount = user.failed_login_count + 1
        const shouldLock = newFailCount >= 5

        if (shouldLock) {
          // Lock for 5 minutes — locked_until set by the DB server (server-authoritative time)
          await client.query(
            `UPDATE backoffice_staff_users
             SET failed_login_count = $1,
                 locked_until = NOW() + INTERVAL '5 minutes',
                 updated_at = NOW()
             WHERE id = $2`,
            [newFailCount, user.id]
          )

          await logAccountLocked(correlationId, user.id, user.email, workspaceSlug, 300)
        } else {
          // Just increment counter
          await client.query(
            `UPDATE backoffice_staff_users
             SET failed_login_count = $1, updated_at = NOW()
             WHERE id = $2`,
            [newFailCount, user.id]
          )

          await logLoginFailure(
            correlationId,
            email,
            workspaceSlug,
            'invalid_password',
            newFailCount
          )
        }

        await client.query('COMMIT')
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password',
            },
          },
          401
        )
      }

      // === STEP 8: Success! Reset failed login count & update last_login ===
      await client.query(
        `UPDATE backoffice_staff_users
         SET failed_login_count = 0, last_login = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [user.id]
      )

      // === STEP 9: Get workspace info for JWT claims ===
      const workspaceResult = await client.query(
        `SELECT schema_version, product_version FROM workspaces WHERE id = $1`,
        [workspaceId]
      )

      const workspace = workspaceResult.rows[0] || {
        schema_version: '1.0.0',
        product_version: '1.0.0',
      }

      // === STEP 10: Sign JWT token ===
      const token = await signBackofficeToken(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          token_version: user.token_version,
        },
        {
          workspaceId,
          schemaVersion: workspace.schema_version,
          productVersion: workspace.product_version,
          permissions: [], // Loaded by middleware later
        }
      )

      // === STEP 11: Commit transaction ===
      await client.query('COMMIT')

      // === STEP 12: Log success ===
      await logLoginSuccess(
        correlationId,
        user.id,
        user.email,
        workspaceSlug,
        c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
        c.req.header('User-Agent'),
        {
          role: user.role,
          token_version: user.token_version,
        }
      )

      // === STEP 13: Return success ===
      return c.json(
        {
          success: true,
          data: {
            access_token: token,
            token_type: 'Bearer',
            expires_in: 900, // 15 minutes
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              workspace_id: workspaceId,
            },
          },
          error: null,
        },
        200
      )
    } finally {
      client.release()
    }
  } catch (error) {
    const requestId = correlationId ?? 'unknown'
    const safeError = error instanceof Error ? error : new Error(String(error))
    logger.error('Backoffice login error', {
      message: safeError.message,
      code: (safeError as NodeJS.ErrnoException).code,
      request_id: requestId,
    })
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Login failed',
        },
        request_id: requestId,
      },
      500
    )
  }
}
