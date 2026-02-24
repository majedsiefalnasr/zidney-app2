/**
 * Audit Read Permission Middleware
 *
 * Validates that user has AUDIT_READ role/permission.
 * Used only on GET /products/:id/audit-log endpoint.
 *
 * Returns 403 Forbidden if user lacks permission.
 *
 * Stage: STAGE_09_PRODUCTS
 * Task: T030
 */

import { createLogger } from '@zidney/logger'
import { ErrorCodes } from '@zidney/types/errors/ErrorCodes'
import type { Context, Next } from 'hono'

const logger = createLogger('api')

/**
 * Audit read permission middleware
 *
 * Only allows users with AUDIT_READ role to access audit logs.
 */
export async function auditReadMiddleware(
  c: Context,
  next: Next
): Promise<Response | void> {
  // Get user from context (set by auth middleware)
  const userId = c.get('userId')
  const userRoles = c.get('userRoles') || []
  const correlationId = c.get('correlationId')

  if (!userId) {
    logger.warn('user_context_missing', {
      correlation_id: correlationId,
      action: 'audit_read_middleware',
    })
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: 'User context not found',
        },
      },
      401
    )
  }

  // Check for AUDIT_READ role
  const hasAuditReadPermission =
    Array.isArray(userRoles) &&
    (userRoles.includes('AUDIT_READ') || userRoles.includes('ADMIN'))

  if (!hasAuditReadPermission) {
    logger.warn('audit_read_permission_denied', {
      correlation_id: correlationId,
      user_id: userId,
      user_roles: userRoles,
      action: 'audit_read_middleware',
    })
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: 'Access denied',
        },
      },
      403
    )
  }

  // Permission granted, continue
  await next()
}
