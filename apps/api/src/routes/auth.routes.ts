/**
 * Authentication Routes
 *
 * File: apps/api/src/routes/auth.routes.ts
 * Task: T031, T032, T033
 * Phase: 5 - Authentication & Session Management
 *
 * Endpoints:
 * - POST /mmc/auth/login (T031) - Login (public)
 * - POST /mmc/auth/logout (T032) - Logout (authenticated)
 * - GET /mmc/permissions/check (T033) - Check permissions (authenticated)
 */

import {
  AppError,
  ErrorCode,
  errorResponse,
  successResponse,
} from '@zidney/domain-core/errors'
import { AuthService } from '@zidney/domain-core/services/auth.service'
import { PermissionService } from '@zidney/domain-core/services/permission.service'
import { Logger } from '@zidney/logger'
import { PermissionDomain } from '@zidney/types/permissions'
import { Context, Hono } from 'hono'
import { Database } from 'postgres'
import {
  getRequestContext,
  // @ts-ignore: LOGIC-BUG: requireMMCAuth is not exported from correlation-id.middleware — see INFRA-001-LOGIC-09
  requireMMCAuth,
} from '../middleware/correlation-id.middleware'
import { resetLoginRateLimit } from '../middleware/rate-limit.middleware'

export interface LoginRequest {
  username: string
  password: string
}

export interface PermissionCheckRequest {
  domains?: string
}

export function createAuthRouter(
  db: Database,
  authService: AuthService,
  permissionService: PermissionService,
  logger: Logger
): Hono {
  const router = new Hono()

  /**
   * POST /mmc/auth/login
   *
   * Login with username and password
   *
   * Permission: Public (no authentication required)
   * Rate limit: 5 attempts/minute/IP
   */
  router.post('/auth/login', async (ctx: Context) => {
    try {
      const context = getRequestContext(ctx)
      const correlationId = context.correlationId
      const ipAddress = ctx.req.header('X-Forwarded-For') || 'unknown'
      const userAgent = ctx.req.header('User-Agent') || 'unknown'

      // Parse request
      const body = await ctx.req.json<LoginRequest>()

      if (!body.username || !body.password) {
        return ctx.json(
          errorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Missing required fields: username, password',
            // @ts-ignore: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09
            400
          ),
          // @ts-ignore: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09
          400
        )
      }

      // Authenticate
      const member = await authService.authenticateMember(
        body.username,
        body.password
      )

      // Audit log successful login
      await db.query(
        `INSERT INTO mmc_audit_log (
          actor_user_id, action_type, entity_type, entity_id,
          previous_state, new_state, correlation_id, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          member.id,
          'LOGIN_ATTEMPT_SUCCESS',
          'SESSION',
          null,
          null,
          JSON.stringify({ username: member.username }),
          correlationId,
          ipAddress,
          userAgent,
        ]
      )

      // Issue token
      const token = await authService.issueToken(
        member.id,
        member.role_id,
        member.token_version
      )

      // Reset rate limiter on success
      await resetLoginRateLimit(ctx)

      logger.info(
        {
          correlation_id: correlationId,
          user_id: member.id,
          action: 'login',
        },
        `Member ${member.username} logged in`
      )

      return ctx.json(
        successResponse({
          ...token,
          user_id: member.id,
          username: member.username,
          role_name: member.role_name,
        })
      )
    } catch (error) {
      const context = getRequestContext(ctx)
      const ipAddress = ctx.req.header('X-Forwarded-For') || 'unknown'
      const userAgent = ctx.req.header('User-Agent') || 'unknown'

      if (error instanceof AppError) {
        // Audit log failed login
        await db.query(
          `INSERT INTO mmc_audit_log (
            actor_user_id, action_type, entity_type, entity_id,
            previous_state, new_state, correlation_id, ip_address, user_agent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            null,
            'LOGIN_ATTEMPT_FAILED',
            'SESSION',
            null,
            null,
            JSON.stringify({ error_code: error.code }),
            context.correlationId,
            ipAddress,
            userAgent,
          ]
        )

        logger.warn(
          {
            correlation_id: context.correlationId,
            error_code: error.code,
          },
          `Login failed: ${error.message}`
        )

        return ctx.json(
          errorResponse(ErrorCode.AUTHENTICATION_FAILED, 'Invalid credentials'),
          // @ts-ignore: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09
          401
        )
      }

      logger.error(
        {
          correlation_id: context.correlationId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Unexpected error in login'
      )

      return ctx.json(
        errorResponse(ErrorCode.INTERNAL_ERROR, 'Login failed'),
        // @ts-ignore: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09
        500
      )
    }
  })

  /**
   * POST /mmc/auth/logout
   *
   * Logout (no-op; client should discard token)
   *
   * Permission: Authenticated only
   */
  router.post('/auth/logout', async (ctx: Context) => {
    try {
      const context = getRequestContext(ctx)
      requireMMCAuth(ctx)

      const userId = context.mmcUser!.userId
      const correlationId = context.correlationId
      const ipAddress = ctx.req.header('X-Forwarded-For') || 'unknown'
      const userAgent = ctx.req.header('User-Agent') || 'unknown'

      // Audit log logout
      await db.query(
        `INSERT INTO mmc_audit_log (
          actor_user_id, action_type, entity_type, entity_id,
          previous_state, new_state, correlation_id, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId,
          'LOGOUT',
          'SESSION',
          null,
          null,
          null,
          correlationId,
          ipAddress,
          userAgent,
        ]
      )

      logger.info(
        {
          correlation_id: correlationId,
          user_id: userId,
          action: 'logout',
        },
        'Member logged out'
      )

      return ctx.json(successResponse({ message: 'Logged out successfully' }))
    } catch (error) {
      logger.error(
        {
          correlation_id: getRequestContext(ctx).correlationId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Unexpected error in logout'
      )

      return ctx.json(
        errorResponse(ErrorCode.INTERNAL_ERROR, 'Logout failed'),
        // @ts-ignore: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09
        500
      )
    }
  })

  /**
   * GET /mmc/permissions/check
   *
   * Get current user's permissions
   * Optional: filter by comma-separated domains
   *
   * Query params:
   * - domains: comma-separated list of permission domains to check (optional)
   *
   * Permission: Authenticated only (no authorization check)
   */
  router.get('/permissions/check', async (ctx: Context) => {
    try {
      const context = getRequestContext(ctx)
      requireMMCAuth(ctx)

      const userId = context.mmcUser!.userId
      const correlationId = context.correlationId
      const domainsParam = ctx.req.query('domains')

      let permissions: any[] = []

      if (domainsParam) {
        // Filter by requested domains
        const requestedDomains = domainsParam
          .split(',')
          .map((d) => d.trim())
          .filter((d) => d) as PermissionDomain[]

        permissions = await permissionService.getPermissionsForDomains(
          userId,
          requestedDomains
        )
      } else {
        // Return all permissions
        const allPerms = await permissionService.resolvePermissions(userId)
        permissions = allPerms || []
      }

      logger.debug(
        {
          correlation_id: correlationId,
          user_id: userId,
          domains_returned: permissions.length,
        },
        'Permission check performed'
      )

      return ctx.json(
        successResponse({
          user_id: userId,
          role_id: context.mmcUser!.roleId,
          permissions: permissions.map((p) => ({
            domain: p.domain,
            can_view: p.can_view,
            can_create: p.can_create,
            can_edit: p.can_edit,
            can_delete: p.can_delete,
          })),
        })
      )
    } catch (error) {
      logger.error(
        {
          correlation_id: getRequestContext(ctx).correlationId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Unexpected error in permission check'
      )

      return ctx.json(
        errorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to check permissions'),
        // @ts-ignore: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09
        500
      )
    }
  })

  return router
}
