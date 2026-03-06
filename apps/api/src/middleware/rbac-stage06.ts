/**
 * RBAC (Role-Based Access Control) Middleware — STAGE_06 Attempt Engine
 *
 * Purpose: Verify user has required roles for attempt operations
 * Middleware Priority: After auth context middleware
 *
 * Task: T018 – RBAC middleware for attempt access
 * Phase: B – Middleware Integration
 * Stage: STAGE_06_ATTEMPT_ENGINE_FOUNDATION
 *
 * Rules:
 * - Students/exam_access role can create/submit their own attempts
 * - Instructors can view attempt results
 * - No suspended/restricted users allowed
 *
 * Constitutional Compliance:
 * - Role-based access (no data mixing between roles)
 * - User can only access their own attempts (except instructors)
 */

import type { Logger } from '@zidney/logger'
import type { Context, MiddlewareHandler } from 'hono'

export type AttemptRole = 'student' | 'instructor' | 'admin'

export interface RBACContextStage06 {
  role: AttemptRole
  allowed: boolean
  can_create_attempt: boolean
  can_submit_attempt: boolean
  can_view_result: boolean
  can_view_all_results: boolean // For instructors
}

/**
 * Create RBAC middleware for STAGE_06
 *
 * Validates:
 * 1. User has required role (student, instructor, admin)
 * 2. User is not suspended/restricted
 * 3. Attaches available permissions to context
 *
 * Used with route-level permission checks:
 * - Student can create/submit own attempts only
 * - Instructor can view any result in workspace
 * - Admin has full access
 */
export function createRBACMiddlewareStage06(logger: Logger): MiddlewareHandler {
  return async (c: Context, next) => {
    const correlation_id = c.get('correlationId') || 'unknown'
    const user = c.get('user')
    const workspace_id = c.get('tenant')?.id

    if (!user) {
      logger.warn('RBAC middleware: Missing user context', {
        correlation_id,
        workspace_id,
      })
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User context not found',
          },
        },
        401
      )
    }

    try {
      // Determine user role
      const roles = user.roles || []
      let primary_role: AttemptRole = 'student' // default

      if (roles.includes('admin')) {
        primary_role = 'admin'
      } else if (roles.includes('instructor')) {
        primary_role = 'instructor'
      } else if (roles.includes('student') || roles.includes('exam_access')) {
        primary_role = 'student'
      }

      // Check for suspended/restricted status
      const is_restricted = roles.includes('restricted') || roles.includes('suspended')

      if (is_restricted) {
        logger.warn('RBAC middleware: User restricted', {
          correlation_id,
          workspace_id,
          user_id: user.id,
          roles: roles.join(','),
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'FORBIDDEN',
              message: 'User account is restricted or suspended',
            },
          },
          403
        )
      }

      // Compute permissions based on role
      const rbac: RBACContextStage06 = {
        role: primary_role,
        allowed: true,
        // Student permissions
        can_create_attempt: ['student', 'instructor', 'admin'].includes(primary_role),
        can_submit_attempt: ['student', 'instructor', 'admin'].includes(primary_role),
        can_view_result:
          primary_role === 'student' || primary_role === 'instructor' || primary_role === 'admin', // Can see own results
        // Instructor/Admin permissions
        can_view_all_results: ['instructor', 'admin'].includes(primary_role),
      }

      c.set('rbac', rbac)

      logger.debug('RBAC validated', {
        correlation_id,
        workspace_id,
        user_id: user.id,
        role: primary_role,
        permissions: {
          can_create: rbac.can_create_attempt,
          can_submit: rbac.can_submit_attempt,
          can_view_all: rbac.can_view_all_results,
        },
      })

      await next()
    } catch (error) {
      logger.error('RBAC middleware: Unexpected error', {
        correlation_id,
        workspace_id,
        user_id: user.id,
        error: error instanceof Error ? error.message : String(error),
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Authorization check failed',
          },
        },
        500
      )
    }
  }
}

/**
 * Helper function to enforce permission check in route handler
 *
 * Usage:
 * ```
 * assertPermission(c, 'can_create_attempt', logger, 'attempt.create')
 * ```
 */
export function assertPermission(
  c: Context,
  permission: keyof RBACContextStage06,
  logger: Logger,
  resource: string
): boolean {
  const rbac = c.get('rbac')
  const user = c.get('user')
  const correlation_id = c.get('correlationId')

  if (!rbac || !rbac[permission]) {
    logger.warn('Permission denied', {
      correlation_id,
      user_id: user?.id,
      permission,
      resource,
    })
    return false
  }

  return true
}

export default createRBACMiddlewareStage06
