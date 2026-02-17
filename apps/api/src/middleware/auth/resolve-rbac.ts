/**
 * RBAC Resolver Middleware
 *
 * File: apps/api/src/middleware/auth/resolve-rbac.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Fetch user's role and associated permissions from database.
 * Build RBAC context for permission checks in route handlers.
 *
 * Architecture:
 * NOT cached in JWT (permissions always looked up live from database)
 * Prevents stale permission abuse if role changed during session
 *
 * Query Pattern:
 * 1. Get user's role from users table
 * 2. Get role_id from roles table
 * 3. Get all permissions for that role_id from role_permissions table
 * 4. Build RbacContext and attach to request
 *
 * Performance:
 * Live lookup (~5-10ms with proper indexes)
 * Good tradeoff: Security > Performance for auth checks
 *
 * Errors:
 * - 500: Role not found or permissions fetch fails
 */

import { buildRbacContext, logPermissionDenied } from '@zidney/domain-core/auth'
import { Context, Next } from 'hono'

/**
 * Resolve user's role and permissions from database
 *
 * Middleware execution (assumes validateTokenVersion already ran):
 * 1. Get userId from context
 * 2. Fetch user.role from users table
 * 3. Fetch role.id from roles table
 * 4. Fetch permissions from role_permissions table
 * 5. Build RbacContext
 * 6. Attach to context for route handlers
 */
export async function resolveRbacMiddleware(c: Context, next: Next) {
  try {
    // Check if authenticated (skip if not)
    const isAuthenticated = c.get('isAuthenticated')
    if (!isAuthenticated) {
      await next()
      return
    }

    const userId = c.get('userId')
    const workspaceSlug = c.get('workspaceSlug')
    const tenantDb = c.get('tenantDb')

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

    // Fetch user with role and division info
    const userResult = await tenantDb.query(
      `SELECT u.id, u.role, u.division_id 
       FROM users u 
       WHERE u.id = $1 AND u.is_active = true`,
      [userId]
    )

    if (userResult.rows.length === 0) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        },
        401
      )
    }

    const user = userResult.rows[0]
    const userRole = user.role
    const divisionId = user.division_id

    // Fetch permissions for this role
    const permissionsResult = await tenantDb.query(
      `SELECT rp.permission_code 
       FROM role_permissions rp
       JOIN roles r ON rp.role_id = r.id
       WHERE r.code = $1 AND rp.is_deleted = false`,
      [userRole]
    )

    const permissions = permissionsResult.rows.map((row) => row.permission_code)

    // Build RBAC context
    const rbacContext = buildRbacContext(
      userId,
      userRole,
      permissions,
      workspaceSlug,
      divisionId
    )

    // Attach to context
    c.set('rbacContext', rbacContext)

    await next()
  } catch (error) {
    console.error('RBAC resolution error:', error)
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'RBAC resolution failed',
        },
      },
      500
    )
  }
}

/**
 * Check permission middleware factory
 *
 * Usage in routes:
 * ```
 * app.get('/exams/:exam_id/grade', requirePermission('exam:grade'), (c) => {
 *   // route handler only executes if permission check passes
 *   return c.json({ success: true })
 * })
 * ```
 *
 * Returns 403 if permission denied
 */
export function requirePermission(requiredPermission: string) {
  return async (c: Context, next: Next) => {
    const rbacContext = c.get('rbacContext')

    if (!rbacContext) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'RBAC_CONTEXT_MISSING',
            message: 'RBAC context not found. Authentication required.',
          },
        },
        401
      )
    }

    // Check permission
    const hasPermission = rbacContext.permissions.includes(requiredPermission)

    if (!hasPermission) {
      // Log permission denial
      const authPayload = c.get('authPayload')
      if (authPayload) {
        const correlationId = c.get('correlationId') || 'unknown'
        await logPermissionDenied(
          correlationId,
          rbacContext.userId,
          authPayload.user_email,
          rbacContext.workspace_id || 'unknown',
          requiredPermission,
          rbacContext.role,
          c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP')
        )
      }

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'PERMISSION_DENIED',
            message: `You do not have permission to perform this action. Required: ${requiredPermission}`,
          },
        },
        403
      )
    }

    // Permission granted
    await next()
  }
}

/**
 * Check multiple permissions (ANY or ALL)
 *
 * Usage:
 * ```
 * app.get('/report', requireAnyPermission(['report:download', 'report:view']), (c) => {
 *   // Executes if user has either permission
 * })
 * ```
 */
export function requireAnyPermission(permissions: string[]) {
  return async (c: Context, next: Next) => {
    const rbacContext = c.get('rbacContext')

    if (!rbacContext) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'RBAC_CONTEXT_MISSING',
            message: 'RBAC context not found',
          },
        },
        401
      )
    }

    const hasAny = permissions.some((p) => rbacContext.permissions.includes(p))

    if (!hasAny) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'PERMISSION_DENIED',
            message: `You do not have permission. One of: ${permissions.join(', ')}`,
          },
        },
        403
      )
    }

    await next()
  }
}

/**
 * Check all permissions required
 *
 * Usage:
 * ```
 * app.delete('/exam/:id', requireAllPermissions(['exam:delete', 'exam:manage']), (c) => {
 *   // Executes only if user has BOTH permissions
 * })
 * ```
 */
export function requireAllPermissions(permissions: string[]) {
  return async (c: Context, next: Next) => {
    const rbacContext = c.get('rbacContext')

    if (!rbacContext) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'RBAC_CONTEXT_MISSING',
            message: 'RBAC context not found',
          },
        },
        401
      )
    }

    const hasAll = permissions.every((p) => rbacContext.permissions.includes(p))

    if (!hasAll) {
      const missing = permissions.filter(
        (p) => !rbacContext.permissions.includes(p)
      )
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'PERMISSION_DENIED',
            message: `You lack required permissions: ${missing.join(', ')}`,
          },
        },
        403
      )
    }

    await next()
  }
}
