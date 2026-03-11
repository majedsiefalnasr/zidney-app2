/**
 * Role Management Routes — STAGE_21
 *
 * File: apps/api/src/routes/backoffice/roles.ts
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM
 * Date: 2026-03-02
 *
 * All 9 Backoffice role management endpoints in a single Hono router.
 * Mounted at /api/v1/backoffice/workspace in app.ts.
 *
 * Endpoints:
 *   POST   /roles                        — Create role + initial permissions
 *   GET    /roles                        — Paginated role list
 *   GET    /roles/:id                    — Role detail + permission matrix
 *   PATCH  /roles/:id                    — Update name/description/status
 *   PUT    /roles/:id/permissions        — Full-replace permissions
 *   DELETE /roles/:id                    — Delete role (with active-user guard)
 *   GET    /roles/:id/users              — Paginated users with this role
 *   PATCH  /staff/:userId/role           — Assign role to staff user
 *   GET    /role-permission-modules      — Static module + display name list
 *
 * Middleware chain (inherited from app.ts backoffice group):
 *   correlationId → tenantResolver → licenseEnforcement → schemaVersion
 *   → rateLimit(max:60) → auth-jwt
 * Per-route: createPermissionGuard(logger, module, action)
 *
 * Constitutional Compliance:
 * ✓ All DB access through tenant.pool (from tenant resolver context)
 * ✓ All mutations transactional with co-transactional audit log (domain service)
 * ✓ Error responses expose no internal structure (SC-007)
 * ✓ GET /roles/:id/users never returns password_hash or token_version
 * ✓ Structured logging via @zidney/logger — console.log forbidden
 * ✓ All 403/409/422/404 follow platform error contract { success, data, error }
 * ✓ Redis cache invalidated after mutations via SCAN cursor (rbac_v2: prefix)
 */

import {
  assignRoleToStaffUser,
  createRole,
  deleteRole,
  getRoleById,
  getRoleUsers,
  listRoles,
  PermissionModule,
  RbacError,
  RoleStatus,
  updateRole,
  updateRolePermissions,
} from '@zidney/domain-core/rbac'
import { createLogger } from '@zidney/logger'
import { type Context, Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import {
  createPermissionGuard,
  flushRbacCacheForWorkspace,
} from '../../middleware/backoffice-permission-guard-v2'
import type { BackofficeEnv } from './types'

const logger = createLogger('backoffice-roles')

// ---------------------------------------------------------------------------
// Module display names — returned by GET /role-permission-modules
// ---------------------------------------------------------------------------

const MODULE_DISPLAY_NAMES: Record<PermissionModule, string> = {
  [PermissionModule.ACADEMIC_STRUCTURE]: 'Academic Structure',
  [PermissionModule.CONTENT_CLASSIFICATION]: 'Content Classification',
  [PermissionModule.EXAM_ENGINE]: 'Exam Engine',
  [PermissionModule.USERS]: 'Users (Staff & Students)',
  [PermissionModule.COMMERCIAL]: 'Commercial Layer',
  [PermissionModule.MEDIA_ASSETS]: 'Media & Assets',
  [PermissionModule.COMMUNICATION]: 'Communication',
  [PermissionModule.ADS]: 'Ads',
  [PermissionModule.DASHBOARD]: 'Dashboard',
  [PermissionModule.SETTINGS]: 'Settings',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRequestContext(c: Context<BackofficeEnv>) {
  const correlationId: string = c.get('correlationId')
  const tenant = c.get('tenant')
  const staffUser = c.get('staff_user')
  const userId: string | null = staffUser?.user_id ?? null
  return { correlationId, tenant, userId }
}

function auditCtx(correlationId: string, userId: string | null, workspaceSlug: string) {
  return {
    user_id: userId,
    request_id: correlationId,
    workspace_slug: workspaceSlug,
  }
}

function errorResponse(
  c: Context<BackofficeEnv>,
  status: number,
  code: string,
  correlationId: string
) {
  return c.json(
    {
      success: false as const,
      data: null,
      error: {
        code,
        message: errorMessageForCode(code),
        correlationId,
      },
    },
    status as ContentfulStatusCode
  )
}

function errorMessageForCode(code: string): string {
  const messages: Record<string, string> = {
    ROLE_NAME_CONFLICT: 'A role with this name already exists in this workspace',
    ROLE_HAS_ACTIVE_USERS: 'This role has active users assigned and cannot be deleted',
    ROLE_NOT_ASSIGNABLE: 'The specified role is not assignable',
    INVALID_MODULE: 'One or more module keys are invalid',
    ROLE_NOT_FOUND: 'The requested role was not found',
    USER_NOT_FOUND: 'The requested staff user was not found',
    INTERNAL_ERROR: 'An internal error occurred',
    SERVICE_UNAVAILABLE: 'The service is temporarily unavailable',
  }
  return messages[code] ?? 'An error occurred'
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const rolesRouter = new Hono<BackofficeEnv>()

// ---------------------------------------------------------------------------
// 1. POST /roles
// ---------------------------------------------------------------------------

rolesRouter.post(
  '/roles',
  createPermissionGuard(logger, PermissionModule.SETTINGS, 'can_create'),
  async (c) => {
    const { correlationId, tenant, userId } = getRequestContext(c)

    let body: {
      name?: string
      description?: string | null
      permissions?: Record<
        string,
        {
          can_view?: boolean
          can_create?: boolean
          can_edit?: boolean
          can_delete?: boolean
        }
      >
    }
    try {
      body = await c.req.json()
    } catch {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid JSON body',
            correlationId,
          },
        },
        422
      )
    }

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'name is required',
            correlationId,
          },
        },
        422
      )
    }

    try {
      const role = await createRole(
        tenant.pool,
        {
          workspace_id: tenant.id,
          name: body.name.trim(),
          description: body.description ?? null,
          permissions: body.permissions,
        },
        auditCtx(correlationId, userId, tenant.slug)
      )

      // Flush RBAC cache after mutation
      if (tenant.redis) {
        await flushRbacCacheForWorkspace(tenant.redis, tenant.id, logger)
      }

      logger.info('Role created', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        user_id: userId ?? undefined,
        role_id: role.id,
      })

      return c.json({ success: true, data: role, error: null }, 201)
    } catch (err) {
      if (err instanceof RbacError) {
        return errorResponse(
          c,
          err.code === 'ROLE_NAME_CONFLICT' ? 409 : err.code === 'INVALID_MODULE' ? 422 : 400,
          err.code,
          correlationId
        )
      }
      logger.error('createRole failed', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        error: err instanceof Error ? err.message : String(err),
      })
      return errorResponse(c, 500, 'INTERNAL_ERROR', correlationId)
    }
  }
)

// ---------------------------------------------------------------------------
// 2. GET /roles
// ---------------------------------------------------------------------------

rolesRouter.get(
  '/roles',
  createPermissionGuard(logger, PermissionModule.SETTINGS, 'can_view'),
  async (c) => {
    const { correlationId, tenant } = getRequestContext(c)

    const pageStr = c.req.query('page')
    const pageSizeStr = c.req.query('pageSize')
    const statusFilter = c.req.query('status') as RoleStatus | undefined

    const page = pageStr ? parseInt(pageStr, 10) : 1
    const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : 20

    try {
      const result = await listRoles(tenant.pool, {
        workspace_id: tenant.id,
        status: statusFilter ?? null,
        page,
        pageSize,
      })
      return c.json({ success: true, data: result, error: null }, 200)
    } catch (err) {
      logger.error('listRoles failed', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        error: err instanceof Error ? err.message : String(err),
      })
      return errorResponse(c, 500, 'INTERNAL_ERROR', correlationId)
    }
  }
)

// ---------------------------------------------------------------------------
// 3. GET /roles/:id
// ---------------------------------------------------------------------------

rolesRouter.get(
  '/roles/:id',
  createPermissionGuard(logger, PermissionModule.SETTINGS, 'can_view'),
  async (c) => {
    const { correlationId, tenant } = getRequestContext(c)
    const roleId = c.req.param('id')

    try {
      const role = await getRoleById(tenant.pool, roleId)
      if (!role) {
        return errorResponse(c, 404, 'ROLE_NOT_FOUND', correlationId)
      }
      return c.json({ success: true, data: role, error: null }, 200)
    } catch (err) {
      logger.error('getRoleById failed', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        error: err instanceof Error ? err.message : String(err),
      })
      return errorResponse(c, 500, 'INTERNAL_ERROR', correlationId)
    }
  }
)

// ---------------------------------------------------------------------------
// 4. PATCH /roles/:id
// ---------------------------------------------------------------------------

rolesRouter.patch(
  '/roles/:id',
  createPermissionGuard(logger, PermissionModule.SETTINGS, 'can_edit'),
  async (c) => {
    const { correlationId, tenant, userId } = getRequestContext(c)
    const roleId = c.req.param('id')

    let body: { name?: string; description?: string | null; status?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid JSON body',
            correlationId,
          },
        },
        422
      )
    }

    // Validate status if provided
    if (
      body.status !== undefined &&
      body.status !== RoleStatus.ACTIVE &&
      body.status !== RoleStatus.DISABLED
    ) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'status must be ACTIVE or DISABLED',
            correlationId,
          },
        },
        422
      )
    }

    try {
      const updated = await updateRole(
        tenant.pool,
        roleId,
        {
          name: body.name,
          description: body.description,
          status: body.status as RoleStatus | undefined,
        },
        auditCtx(correlationId, userId, tenant.slug)
      )

      // Flush RBAC cache after mutation (especially important for status change)
      if (tenant.redis) {
        await flushRbacCacheForWorkspace(tenant.redis, tenant.id, logger)
      }

      logger.info('Role updated', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        user_id: userId ?? undefined,
        role_id: roleId,
      })

      return c.json({ success: true, data: updated, error: null }, 200)
    } catch (err) {
      if (err instanceof RbacError) {
        const status =
          err.code === 'ROLE_NOT_FOUND' ? 404 : err.code === 'ROLE_NAME_CONFLICT' ? 409 : 400
        return errorResponse(c, status, err.code, correlationId)
      }
      logger.error('updateRole failed', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        error: err instanceof Error ? err.message : String(err),
      })
      return errorResponse(c, 500, 'INTERNAL_ERROR', correlationId)
    }
  }
)

// ---------------------------------------------------------------------------
// 5. PUT /roles/:id/permissions
// ---------------------------------------------------------------------------

rolesRouter.put(
  '/roles/:id/permissions',
  createPermissionGuard(logger, PermissionModule.SETTINGS, 'can_edit'),
  async (c) => {
    const { correlationId, tenant, userId } = getRequestContext(c)
    const roleId = c.req.param('id')

    let body: {
      permissions?: Record<
        string,
        {
          can_view?: boolean
          can_create?: boolean
          can_edit?: boolean
          can_delete?: boolean
        }
      >
    }
    try {
      body = await c.req.json()
    } catch {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid JSON body',
            correlationId,
          },
        },
        422
      )
    }

    if (!body.permissions || typeof body.permissions !== 'object') {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'permissions object is required',
            correlationId,
          },
        },
        422
      )
    }

    try {
      const result = await updateRolePermissions(
        tenant.pool,
        roleId,
        body.permissions,
        auditCtx(correlationId, userId, tenant.slug)
      )

      // Flush RBAC cache — permission change must be reflected immediately
      if (tenant.redis) {
        await flushRbacCacheForWorkspace(tenant.redis, tenant.id, logger)
      }

      logger.info('Role permissions updated', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        user_id: userId ?? undefined,
        role_id: roleId,
      })

      return c.json(
        {
          success: true,
          data: { role_id: roleId, permissions: result },
          error: null,
        },
        200
      )
    } catch (err) {
      if (err instanceof RbacError) {
        const status =
          err.code === 'ROLE_NOT_FOUND' ? 404 : err.code === 'INVALID_MODULE' ? 422 : 400
        return errorResponse(c, status, err.code, correlationId)
      }
      logger.error('updateRolePermissions failed', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        error: err instanceof Error ? err.message : String(err),
      })
      return errorResponse(c, 500, 'INTERNAL_ERROR', correlationId)
    }
  }
)

// ---------------------------------------------------------------------------
// 6. DELETE /roles/:id
// ---------------------------------------------------------------------------

rolesRouter.delete(
  '/roles/:id',
  createPermissionGuard(logger, PermissionModule.SETTINGS, 'can_delete'),
  async (c) => {
    const { correlationId, tenant, userId } = getRequestContext(c)
    const roleId = c.req.param('id')

    try {
      await deleteRole(tenant.pool, roleId, auditCtx(correlationId, userId, tenant.slug))

      // Flush RBAC cache after deletion
      if (tenant.redis) {
        await flushRbacCacheForWorkspace(tenant.redis, tenant.id, logger)
      }

      logger.info('Role deleted', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        user_id: userId ?? undefined,
        role_id: roleId,
      })

      return c.body(null, 204)
    } catch (err) {
      if (err instanceof RbacError) {
        const status =
          err.code === 'ROLE_NOT_FOUND' ? 404 : err.code === 'ROLE_HAS_ACTIVE_USERS' ? 409 : 400
        return errorResponse(c, status, err.code, correlationId)
      }
      logger.error('deleteRole failed', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        error: err instanceof Error ? err.message : String(err),
      })
      return errorResponse(c, 500, 'INTERNAL_ERROR', correlationId)
    }
  }
)

// ---------------------------------------------------------------------------
// 7. GET /roles/:id/users
// ---------------------------------------------------------------------------

rolesRouter.get(
  '/roles/:id/users',
  createPermissionGuard(logger, PermissionModule.SETTINGS, 'can_view'),
  async (c) => {
    const { correlationId, tenant } = getRequestContext(c)
    const roleId = c.req.param('id')

    const pageStr = c.req.query('page')
    const pageSizeStr = c.req.query('pageSize')
    const page = pageStr ? parseInt(pageStr, 10) : 1
    const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : 20

    try {
      // Verify role exists first
      const role = await getRoleById(tenant.pool, roleId)
      if (!role) {
        return errorResponse(c, 404, 'ROLE_NOT_FOUND', correlationId)
      }

      const result = await getRoleUsers(tenant.pool, { roleId, page, pageSize })
      return c.json({ success: true, data: result, error: null }, 200)
    } catch (err) {
      logger.error('getRoleUsers failed', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        error: err instanceof Error ? err.message : String(err),
      })
      return errorResponse(c, 500, 'INTERNAL_ERROR', correlationId)
    }
  }
)

// ---------------------------------------------------------------------------
// 8. PATCH /staff/:userId/role
// ---------------------------------------------------------------------------

rolesRouter.patch(
  '/staff/:userId/role',
  createPermissionGuard(logger, PermissionModule.USERS, 'can_edit'),
  async (c) => {
    const { correlationId, tenant, userId: actorId } = getRequestContext(c)
    const targetUserId = c.req.param('userId')

    let body: { role_id?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid JSON body',
            correlationId,
          },
        },
        422
      )
    }

    if (!body.role_id || typeof body.role_id !== 'string') {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'role_id is required',
            correlationId,
          },
        },
        422
      )
    }

    try {
      await assignRoleToStaffUser(
        tenant.pool,
        targetUserId,
        body.role_id,
        auditCtx(correlationId, actorId, tenant.slug)
      )

      // Flush RBAC cache — user's permission set changes
      if (tenant.redis) {
        await flushRbacCacheForWorkspace(tenant.redis, tenant.id, logger)
      }

      logger.info('Role assigned to staff user', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        user_id: actorId ?? undefined,
        target_user_id: targetUserId,
        role_id: body.role_id,
      })

      return c.json(
        {
          success: true,
          data: { user_id: targetUserId, role_id: body.role_id },
          error: null,
        },
        200
      )
    } catch (err) {
      if (err instanceof RbacError) {
        const status: Record<string, number> = {
          USER_NOT_FOUND: 404,
          ROLE_NOT_FOUND: 404,
          ROLE_NOT_ASSIGNABLE: 422,
        }
        return errorResponse(c, status[err.code] ?? 400, err.code, correlationId)
      }
      logger.error('assignRoleToStaffUser failed', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        error: err instanceof Error ? err.message : String(err),
      })
      return errorResponse(c, 500, 'INTERNAL_ERROR', correlationId)
    }
  }
)

// ---------------------------------------------------------------------------
// 9. GET /role-permission-modules
// ---------------------------------------------------------------------------

rolesRouter.get(
  '/role-permission-modules',
  createPermissionGuard(logger, PermissionModule.SETTINGS, 'can_view'),
  async (c) => {
    const modules = Object.values(PermissionModule).map((key) => ({
      key,
      display_name: MODULE_DISPLAY_NAMES[key],
    }))

    return c.json(
      {
        success: true,
        data: { modules },
        error: null,
      },
      200
    )
  }
)
