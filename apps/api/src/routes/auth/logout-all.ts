/**
 * Logout All Sessions Route
 *
 * File: apps/api/src/routes/auth/logout-all.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Invalidate ALL sessions for authenticated user by incrementing token_version.
 * Enables stateless token revocation without maintaining a blocklist.
 *
 * Endpoint: POST /auth/logout-all
 * Scope: Requires valid JWT token
 * Authentication: YES (protected route)
 * Response: Success confirmation (200) or error (401, 500)
 *
 * How It Works:
 * 1. User has multiple active JWT tokens (desktop, mobile, browser, etc.)
 * 2. User clicks "Logout all devices" / "Change password" / "Update role"
 * 3. Server increments user.token_version in database
 * 4. ALL existing JWT tokens now have stale token_version
 * 5. Next request with any old token fails token_version check
 * 6. User must login again with new credentials
 *
 * Advantages:
 * ✓ No blocklist needed (scale to millions of users)
 * ✓ Immediate across all sessions (no sync delay)
 * ✓ Atomic database operation (no race conditions)
 * ✓ Stateless (can be checked at edge/CDN level in future)
 *
 * Use Cases:
 * - Security incident: Suspicious login detected
 * - Password change: Requires re-authentication from all sessions
 * - Role change: Permissions need to be re-fetched
 * - Admin action: Force logout user (Phase 2+)
 * - Logout all: User manually invalidates all sessions
 *
 * Error Cases:
 * - 401: User not authenticated
 * - 401: Token version mismatch (already logged out?)
 * - 500: Database error during token_version increment
 */

import { logTokenInvalidation } from '@zidney/domain-core/auth'
import { logger } from '@zidney/logger'
import type { Context } from 'hono'

/**
 * POST /auth/logout-all
 *
 * Request body: {} (empty, uses JWT for authentication)
 *
 * Success response (200):
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "message": "All sessions have been invalidated. Please login again.",
 *     "invalidated_at": "2026-02-17T10:30:00Z"
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
 *     "code": "UNAUTHORIZED",
 *     "message": "Authentication required"
 *   }
 * }
 * ```
 */
export async function logoutAllHandler(c: Context) {
  const correlationId = c.get('correlationId') || 'unknown'
  const userId = c.get('userId')
  const workspaceSlug = c.get('workspaceSlug') || 'unknown'
  const tenantDb = c.get('tenantDb')
  const authPayload = c.get('authPayload')

  // === STEP 1: Ensure authenticated ===
  if (!userId || !authPayload) {
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      },
      401
    )
  }

  // === STEP 2: Ensure has database context ===
  if (!tenantDb) {
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'DB_CONTEXT_MISSING',
          message: 'Database context not found',
        },
      },
      500
    )
  }

  try {
    // === STEP 3: Begin SERIALIZABLE transaction to prevent race conditions ===
    // This ensures that concurrent logout-all requests don't race on token_version increment
    const client = await tenantDb.connect()

    try {
      // Start serializable transaction for atomicity
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

      // === STEP 4: Lock user row for exclusive access ===
      // FOR UPDATE prevents other transactions from modifying this row concurrently
      const userResult = await client.query(
        `SELECT id, email, token_version FROM users 
         WHERE id = $1 AND is_active = true 
         FOR UPDATE`,
        [userId]
      )

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found or inactive',
            },
          },
          401
        )
      }

      const user = userResult.rows[0]
      const currentTokenVersion = user.token_version

      // === STEP 5: Increment token_version atomically ===
      // token_version = token_version + 1 ensures deterministic increment even under concurrency
      const newTokenVersion = currentTokenVersion + 1

      const updateResult = await client.query(
        `UPDATE users 
         SET token_version = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING token_version`,
        [newTokenVersion, userId]
      )

      // === STEP 6: Commit transaction ===
      await client.query('COMMIT')

      if (updateResult.rows.length === 0) {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'UPDATE_FAILED',
              message: 'Failed to update token version',
            },
          },
          500
        )
      }

      // === STEP 7: Log the invalidation event ===
      await logTokenInvalidation(
        correlationId,
        userId,
        user.email,
        workspaceSlug,
        'logout_all',
        newTokenVersion
      )

      // === STEP 8: Return success ===
      return c.json(
        {
          success: true,
          data: {
            message: 'All sessions have been invalidated. Please login again.',
            invalidated_at: new Date().toISOString(),
          },
          error: null,
        },
        200
      )
    } catch (txError) {
      // Rollback on any error
      try {
        await client.query('ROLLBACK')
      } catch (rollbackErr) {
        logger.error('Rollback error:', { error: rollbackErr })
      }

      // Serialization error - retry logic could go here in future
      if (txError instanceof Error && txError.message.includes('40001')) {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'TRANSACTION_CONFLICT',
              message: 'Transaction conflict with concurrent request. Please retry.',
            },
          },
          409
        )
      }

      throw txError
    } finally {
      client.release()
    }
  } catch (error) {
    logger.error('Logout all error:', { error })
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to invalidate sessions',
        },
      },
      500
    )
  }
}

/**
 * Logout All Middleware
 *
 * Used to compose the route:
 * ```
 * // Middleware stack for logout-all endpoint:
 * // 1. validateJwtMiddleware (require valid JWT)
 * // 2. validateTokenVersionMiddleware (ensure token not stale)
 * // 3. resolveRbacMiddleware (optional, load permissions)
 * // 4. logoutAllHandler (execute logout)
 *
 * app.post('/auth/logout-all',
 *   validateJwtMiddleware,
 *   validateTokenVersionMiddleware,
 *   logoutAllHandler
 * )
 * ```
 *
 * Why validateTokenVersion before logout-all?
 * - Ensures user is still authenticated
 * - If token stale, they already logged out (idempotent)
 * - Prevents invalidation by someone with old expired token
 */

export const logoutAllRouteName = 'auth.logout-all'
