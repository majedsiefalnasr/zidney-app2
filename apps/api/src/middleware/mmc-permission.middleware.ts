/**
 * MMC Permission Enforcement Middleware
 *
 * File: apps/api/src/middleware/mmc-permission.middleware.ts
 * Task: T009
 * Phase: 2 - Infrastructure & Middleware
 *
 * Enforces role-based access control (RBAC) for MMC endpoints.
 * Maps HTTP methods + routes to permission domains and actions.
 * Queries role_permissions table to check abilities (can_view, can_create, can_edit, can_delete).
 *
 * Properties:
 * - Domain × Action mapping (7 domains, 4 actions)
 * - Explicit allow (permission exists AND bit=true)
 * - Explicit deny (permission missing OR bit=false)
 * - Audit logging on denial
 * - Fail-safe (missing permission = 403)
 */

import { AppError, ErrorCode } from '@zidney/domain-core/errors'
import type { Logger } from '@zidney/logger'
import type { Context, Next } from 'hono'
import type { Database } from 'postgres'
import { getRequestContext } from './correlation-id.middleware'

export type PermissionDomain =
  | 'ORGANIZATION_SETTINGS'
  | 'PRODUCT_MANAGEMENT'
  | 'LICENSE_MANAGEMENT'
  | 'CLIENT_MANAGEMENT'
  | 'AFFILIATE_MANAGEMENT'
  | 'MEMBERS_MANAGEMENT'
  | 'REPORTING'

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete'

export interface RoutePermission {
  domain: PermissionDomain
  action: PermissionAction
}

/**
 * Map routes to required permission domain and action
 */
function getRoutePermission(method: string, path: string): RoutePermission | null {
  // Member routes
  if (path.startsWith('/mmc/members')) {
    if (method === 'GET') return { domain: 'MEMBERS_MANAGEMENT', action: 'view' }
    if (method === 'POST') return { domain: 'MEMBERS_MANAGEMENT', action: 'create' }
    if (method === 'PATCH') return { domain: 'MEMBERS_MANAGEMENT', action: 'edit' }
    if (method === 'DELETE') return { domain: 'MEMBERS_MANAGEMENT', action: 'delete' }
  }

  // Role routes
  if (path.startsWith('/mmc/roles')) {
    if (method === 'GET') return { domain: 'MEMBERS_MANAGEMENT', action: 'view' }
    if (method === 'POST') return { domain: 'MEMBERS_MANAGEMENT', action: 'create' }
    if (method === 'PATCH') return { domain: 'MEMBERS_MANAGEMENT', action: 'edit' }
    if (method === 'DELETE') return { domain: 'MEMBERS_MANAGEMENT', action: 'delete' }
  }

  // Permission routes
  if (path.startsWith('/mmc/permissions')) {
    if (method === 'GET') return { domain: 'MEMBERS_MANAGEMENT', action: 'view' }
    if (method === 'PATCH') return { domain: 'MEMBERS_MANAGEMENT', action: 'edit' }
  }

  // Invitation routes
  if (path.startsWith('/mmc/invitations')) {
    if (method === 'GET') return { domain: 'MEMBERS_MANAGEMENT', action: 'view' }
    if (method === 'POST' && path.includes('/accept')) return null // Public endpoint
    if (method === 'POST') return { domain: 'MEMBERS_MANAGEMENT', action: 'create' }
  }

  // Auth routes (login/logout are public, but logout requires auth)
  if (path.startsWith('/mmc/auth')) {
    if (path === '/mmc/auth/login' && method === 'POST') return null // Public
    if (path === '/mmc/auth/logout' && method === 'POST') return null // No permission check needed
  }

  return null
}

/**
 * MMC Permission Enforcement Middleware
 *
 * Checks that authenticated user has required permission.
 * Throws 403 if permission denied.
 */
export function createMMCPermissionMiddleware(db: Database, logger: Logger) {
  return async (ctx: Context, next: Next): Promise<void> => {
    const context = getRequestContext(ctx)
    const correlationId = context.correlationId
    const method = ctx.req.method
    const path = ctx.req.path

    // Get required permission for this route
    const requiredPermission = getRoutePermission(method, path)

    // If no permission required (public endpoint), proceed
    if (!requiredPermission) {
      await next()
      return
    }

    // Ensure user is authenticated
    if (!context.mmcUser) {
      throw new AppError(ErrorCode.AUTHENTICATION_FAILED, 'Authentication required', 401)
    }

    const roleId = context.mmcUser.roleId
    const userId = context.mmcUser.userId
    const { domain, action } = requiredPermission
    const ipAddress = ctx.req.header('X-Forwarded-For') || 'unknown'
    const userAgent = ctx.req.header('User-Agent') || 'unknown'

    try {
      // Query permission from database
      const result = await db.query(
        `SELECT can_view, can_create, can_edit, can_delete
         FROM role_permissions
         WHERE role_id = $1 AND domain = $2`,
        [roleId, domain]
      )

      // Check if permission row exists
      if (result.rowCount === 0) {
        // Permission missing = implicit deny (fail-safe)
        logger.warn(
          {
            correlation_id: correlationId,
            user_id: userId,
            role_id: roleId,
            domain,
            action,
            reason: 'permission_row_missing',
          },
          `Permission denied: no permission row for role ${roleId} domain ${domain}`
        )

        // Audit log the denial
        // Note: Will integrate with audit service in T011
        await db.query(
          `INSERT INTO mmc_audit_log (
            actor_user_id, action_type, entity_type, entity_id,
            previous_state, new_state, correlation_id, ip_address, user_agent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            userId,
            'PERMISSION_CHECK_DENIED',
            'PERMISSION',
            null,
            null,
            JSON.stringify({
              domain,
              action,
              reason: 'permission_row_missing',
            }),
            correlationId,
            ipAddress,
            userAgent,
          ]
        )

        throw new AppError(ErrorCode.PERMISSION_DENIED, 'Permission denied', 403)
      }

      const permission = result.rows[0]

      // Check the specific action bit
      const permissionKey = `can_${action}` as 'can_view' | 'can_create' | 'can_edit' | 'can_delete'
      const allowed = permission[permissionKey] === true

      if (!allowed) {
        // Permission bit is false = explicit deny
        logger.warn(
          {
            correlation_id: correlationId,
            user_id: userId,
            role_id: roleId,
            domain,
            action,
            reason: 'permission_bit_false',
          },
          `Permission denied: ${action} not allowed for role ${roleId} in domain ${domain}`
        )

        // Audit log the denial
        await db.query(
          `INSERT INTO mmc_audit_log (
            actor_user_id, action_type, entity_type, entity_id,
            previous_state, new_state, correlation_id, ip_address, user_agent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            userId,
            'PERMISSION_CHECK_DENIED',
            'PERMISSION',
            null,
            null,
            JSON.stringify({ domain, action, reason: 'permission_bit_false' }),
            correlationId,
            ipAddress,
            userAgent,
          ]
        )

        throw new AppError(ErrorCode.PERMISSION_DENIED, 'Permission denied', 403)
      }

      // Permission granted
      context.checkedPermission = {
        domain,
        action,
        allowed: true,
      }

      logger.debug(
        {
          correlation_id: correlationId,
          user_id: userId,
          role_id: roleId,
          domain,
          action,
        },
        `Permission check passed`
      )

      await next()
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }

      // Database or other errors
      logger.error(
        {
          correlation_id: correlationId,
          user_id: userId,
          domain,
          action,
          error: error instanceof Error ? error.message : String(error),
        },
        'Permission check error'
      )

      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to check permissions', 500)
    }
  }
}
