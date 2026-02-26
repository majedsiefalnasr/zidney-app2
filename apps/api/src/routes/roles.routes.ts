/**
 * Role Management Routes
 *
 * File: apps/api/src/routes/roles.routes.ts
 * Task: T023, T024, T025, T026, T028
 * Phase: 4 - Role & Permission Management
 *
 * Endpoints:
 * - GET /mmc/roles (T023)
 * - GET /mmc/roles/:id (T024)
 * - GET /mmc/roles/:id/permissions (T025)
 * - PATCH /mmc/roles/:id/permissions (T026)
 *
 * All endpoints require MMC authentication + permission check
 */

import {
  AppError,
  ErrorCode,
  errorResponse,
  successResponse,
} from '@zidney/domain-core/errors'
import { PermissionService } from '@zidney/domain-core/services/permission.service'
import { RoleService } from '@zidney/domain-core/services/role.service'
import { Logger } from '@zidney/logger'
import { UpdateRolePermissionRequest } from '@zidney/types/mmc.types'
import { isValidPermissionDomain } from '@zidney/types/permissions'
import { Context, Hono } from 'hono'
import { Database } from 'postgres'
import {
  getRequestContext,
  requireMMCAuth,
} from '../middleware/correlation-id.middleware'

export function createRolesRouter(
  _db: Database,
  roleService: RoleService,
  permissionService: PermissionService,
  logger: Logger
): Hono {
  const router = new Hono()

  /**
   * GET /mmc/roles
   *
   * List all roles with optional status filter
   *
   * Permission: MEMBERS_MANAGEMENT.view
   */
  router.get('/roles', async (ctx: Context) => {
    try {
      const context = getRequestContext(ctx)
      requireMMCAuth(ctx)

      const status = ctx.req.query('status') as
        | 'ACTIVE'
        | 'INACTIVE'
        | undefined
      const correlationId = context.correlationId

      // Validate status if provided
      if (status && !['ACTIVE', 'INACTIVE'].includes(status)) {
        return ctx.json(
          errorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Invalid status; must be ACTIVE or INACTIVE',
            400
          ),
          400
        )
      }

      const roles = await roleService.getRoles(status)

      logger.debug(
        {
          correlation_id: correlationId,
          roles_count: roles.length,
        },
        `Retrieved ${roles.length} roles`
      )

      return ctx.json(
        successResponse({
          roles,
          total: roles.length,
        })
      )
    } catch (error) {
      logger.error(
        {
          correlation_id: getRequestContext(ctx).correlationId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Unexpected error in role list'
      )

      return ctx.json(
        errorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to list roles'),
        500
      )
    }
  })

  /**
   * GET /mmc/roles/:id
   *
   * Get single role by ID
   *
   * Permission: MEMBERS_MANAGEMENT.view
   */
  router.get('/roles/:id', async (ctx: Context) => {
    try {
      const context = getRequestContext(ctx)
      requireMMCAuth(ctx)

      const roleId = ctx.req.param('id')
      const correlationId = context.correlationId

      // Validate UUID format
      if (!isValidUUID(roleId)) {
        return ctx.json(
          errorResponse(
            ErrorCode.INVALID_REQUEST,
            'Invalid role ID format',
            400
          ),
          400
        )
      }

      const role = await roleService.getRole(roleId)
      if (!role) {
        return ctx.json(
          errorResponse(ErrorCode.NOT_FOUND, 'Role not found'),
          404
        )
      }

      logger.debug(
        {
          correlation_id: correlationId,
          role_id: roleId,
        },
        `Retrieved role: ${role.name}`
      )

      return ctx.json(successResponse(role))
    } catch (error) {
      logger.error(
        {
          correlation_id: getRequestContext(ctx).correlationId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Unexpected error in role retrieval'
      )

      return ctx.json(
        errorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to retrieve role'),
        500
      )
    }
  })

  /**
   * GET /mmc/roles/:id/permissions
   *
   * Get permission matrix for role (7 domains × 4 actions)
   *
   * Permission: MEMBERS_MANAGEMENT.view
   */
  router.get('/roles/:id/permissions', async (ctx: Context) => {
    try {
      const context = getRequestContext(ctx)
      requireMMCAuth(ctx)

      const roleId = ctx.req.param('id')
      const correlationId = context.correlationId

      // Validate UUID format
      if (!isValidUUID(roleId)) {
        return ctx.json(
          errorResponse(
            ErrorCode.INVALID_REQUEST,
            'Invalid role ID format',
            400
          ),
          400
        )
      }

      const permissions = await permissionService.getPermissionsForRole(roleId)
      if (permissions === null) {
        return ctx.json(
          errorResponse(ErrorCode.NOT_FOUND, 'Role not found'),
          404
        )
      }

      logger.debug(
        {
          correlation_id: correlationId,
          role_id: roleId,
          permissions_count: permissions.length,
        },
        `Retrieved permissions for role`
      )

      return ctx.json(
        successResponse({
          role_id: roleId,
          permissions,
        })
      )
    } catch (error) {
      logger.error(
        {
          correlation_id: getRequestContext(ctx).correlationId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Unexpected error in permission retrieval'
      )

      return ctx.json(
        errorResponse(
          ErrorCode.INTERNAL_ERROR,
          'Failed to retrieve permissions'
        ),
        500
      )
    }
  })

  /**
   * PATCH /mmc/roles/:id/permissions
   *
   * Update role permissions
   * Cascades token_version increment to all members with this role
   *
   * Permission: MEMBERS_MANAGEMENT.edit
   * Body: { domain, can_view?, can_create?, can_edit?, can_delete? } | []
   */
  router.patch('/roles/:id/permissions', async (ctx: Context) => {
    try {
      const context = getRequestContext(ctx)
      requireMMCAuth(ctx)

      const roleId = ctx.req.param('id')
      const userId = context.mmcUser!.userId
      const correlationId = context.correlationId
      const ipAddress = ctx.req.header('X-Forwarded-For') || 'unknown'
      const userAgent = ctx.req.header('User-Agent') || 'unknown'

      // Validate UUID format
      if (!isValidUUID(roleId)) {
        return ctx.json(
          errorResponse(
            ErrorCode.INVALID_REQUEST,
            'Invalid role ID format',
            400
          ),
          400
        )
      }

      // Parse request
      const body = await ctx.req.json<
        UpdateRolePermissionRequest | UpdateRolePermissionRequest[]
      >()

      // Validate permissions
      const updates = Array.isArray(body) ? body : [body]

      for (const update of updates) {
        if (!update.domain) {
          return ctx.json(
            errorResponse(
              ErrorCode.VALIDATION_ERROR,
              'Missing required field: domain',
              400
            ),
            400
          )
        }

        if (!isValidPermissionDomain(update.domain)) {
          return ctx.json(
            errorResponse(
              ErrorCode.VALIDATION_ERROR,
              `Invalid permission domain: ${update.domain}`,
              400
            ),
            400
          )
        }
      }

      // Update permissions
      const result = await roleService.updatePermissions(
        roleId,
        updates,
        userId,
        correlationId,
        ipAddress,
        userAgent
      )

      logger.info(
        {
          correlation_id: correlationId,
          user_id: userId,
          role_id: roleId,
          affected_members: result.affected_members,
          action: 'role_permissions_updated',
        },
        `Role permissions updated; ${result.affected_members} members affected`
      )

      return ctx.json(
        successResponse({
          permissions: result.permissions,
          affected_members: result.affected_members,
        })
      )
    } catch (error) {
      if (error instanceof AppError) {
        logger.warn(
          {
            correlation_id: getRequestContext(ctx).correlationId,
            error_code: error.code,
          },
          `Permission update failed: ${error.message}`
        )
        return ctx.json(
          errorResponse(error.code, error.message, error.details),
          error.statusCode
        )
      }

      logger.error(
        {
          correlation_id: getRequestContext(ctx).correlationId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Unexpected error in permission update'
      )

      return ctx.json(
        errorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to update permissions'),
        500
      )
    }
  })

  return router
}

/**
 * Validate UUID format
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}
