/**
 * MMC Authentication Middleware
 *
 * File: apps/api/src/middleware/mmc-auth.middleware.ts
 * Task: T008
 * Phase: 2 - Infrastructure & Middleware
 *
 * Validates JWT tokens for MMC endpoints. Enforces:
 * - JWT signature verification (issuer check)
 * - Token expiration validation
 * - No workspace_id in token (MMC is workspace-independent)
 * - Member status check (ACTIVE only can authenticate)
 * - Token version matching (session invalidation enforcement)
 *
 * Properties:
 * - Blocks cross-context tokens (with workspace_id)
 * - Validates token_version against DB
 * - Disables login for members with status != ACTIVE
 * - Stores user context in request.context for downstream use
 */

import { AppError, ErrorCode } from '@zidney/domain-core/errors'
import type { Logger } from '@zidney/logger'
import type { Context, Next } from 'hono'
import { verify } from 'hono/jwt'
import type { Database } from 'postgres'
import { getRequestContext } from './correlation-id.middleware'

export interface MMCTokenPayload {
  sub: string // user ID
  issuer: string // 'mmc'
  role_id: string
  token_version: number
  exp: number
  iat: number
  workspace_id?: string // Must be absent for MMC tokens
}

/**
 * MMC Authentication Middleware
 *
 * Validates JWT and enforces token version matching.
 * Throws 401 if token invalid or version mismatch.
 */
export function createMMCAuthMiddleware(db: Database, jwtSecret: string, logger: Logger) {
  return async (ctx: Context, next: Next): Promise<void> => {
    const context = getRequestContext(ctx)
    const correlationId = context.correlationId
    const authHeader = ctx.req.header('Authorization')

    // Validate Authorization header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error = new AppError(
        ErrorCode.AUTHENTICATION_FAILED,
        'Missing or invalid Authorization header',
        401
      )
      throw error
    }

    const token = authHeader.substring(7) // Remove 'Bearer '

    try {
      // Decode and verify JWT
      // @ts-expect-error: LOGIC-BUG: JWTPayload cast to MMCTokenPayload — see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
      const decoded = (await verify(token, jwtSecret)) as MMCTokenPayload

      // Validate issuer
      if (decoded.issuer !== 'mmc') {
        throw new AppError(
          ErrorCode.AUTHENTICATION_FAILED,
          'Invalid token issuer; expected "mmc"',
          401
        )
      }

      // Reject tokens with workspace_id (cross-context token)
      if (decoded.workspace_id) {
        throw new AppError(
          ErrorCode.AUTHENTICATION_FAILED,
          'MMC does not accept workspace-scoped tokens',
          401,
          { reason: 'Token contains workspace_id' }
        )
      }

      // Validate expiration
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        throw new AppError(ErrorCode.TOKEN_EXPIRED, 'Token has expired', 401)
      }

      const userId = decoded.sub
      const roleId = decoded.role_id
      const tokenVersion = decoded.token_version

      // Query member from DB to validate status and token version
      const memberResult = await db.query(
        `SELECT id, status, token_version, role_id FROM mmc_members WHERE id = $1`,
        [userId]
      )

      if (memberResult.rowCount === 0) {
        throw new AppError(ErrorCode.AUTHENTICATION_FAILED, 'Member not found', 401, {
          reason: 'User ID not found in database',
        })
      }

      const member = memberResult.rows[0]

      // Validate member status (ACTIVE only)
      if (member.status !== 'ACTIVE') {
        throw new AppError(ErrorCode.MEMBER_DISABLED, 'Member account is disabled', 401, {
          reason: `Status: ${member.status}`,
        })
      }

      // Validate token version (prevents session hijacking on role change)
      if (member.token_version !== tokenVersion) {
        throw new AppError(
          ErrorCode.TOKEN_VERSION_MISMATCH,
          'Session invalidated; token version mismatch',
          401,
          {
            reason: `Token version ${tokenVersion} does not match DB version ${member.token_version}`,
          }
        )
      }

      // Store authenticated user in context
      context.mmcUser = {
        userId,
        roleId,
        tokenVersion,
      }

      // Log successful auth
      logger.debug(
        {
          correlation_id: correlationId,
          user_id: userId,
          action: 'mmc_auth_success',
        },
        `MMC authentication successful for user ${userId}`
      )

      await next()
    } catch (error) {
      if (error instanceof AppError) {
        logger.warn(
          {
            correlation_id: correlationId,
            error_code: error.code,
            reason: error.message,
          },
          `MMC authentication failed: ${error.message}`
        )
        throw error
      }

      // JWT decode/verify errors
      const jwtError = error instanceof Error ? error.message : String(error)
      logger.warn(
        {
          correlation_id: correlationId,
          jwt_error: jwtError,
        },
        'JWT verification failed'
      )

      throw new AppError(ErrorCode.AUTHENTICATION_FAILED, 'Invalid or malformed token', 401, {
        reason: jwtError,
      })
    }
  }
}

/**
 * Verify MMC auth is present in context
 */
export function requireMMCAuth(ctx: Context): void {
  const context = getRequestContext(ctx)
  if (!context.mmcUser) {
    throw new AppError(ErrorCode.AUTHENTICATION_FAILED, 'MMC authentication required', 401)
  }
}
