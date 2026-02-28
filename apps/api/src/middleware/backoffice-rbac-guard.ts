/**
 * Backoffice RBAC Permission Guard Middleware — STAGE_17
 *
 * File: apps/api/src/middleware/backoffice-rbac-guard.ts
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 * Date: 2026-02-28
 *
 * Per-route RBAC enforcement middleware. Validates that the authenticated
 * staff user holds the required module + action permission in the tenant DB.
 *
 * Chain position: After Authentication (step 5), before Route Handler (step 7).
 *
 * F-02: Redis RBAC cache key `rbac:{tenant_id}:{user_id}:{module}:{action}` TTL 30s
 *       Cache hit returning '1' → allow; '0' → deny (no DB query on cache hit).
 *       Cache miss → query tenant DB → store result in Redis.
 *
 * Constitutional Compliance:
 * ✓ All DB access through tenant.pool only — no platform-level pool access
 * ✓ No cross-tenant joins
 * ✓ Structured logging with correlation_id, workspace_slug, workspace_id
 * ✓ No console.log — all logging through @zidney/logger
 * ✓ Error response format: { success, data, error: { code, message, correlationId } }
 */

import type { Logger } from '@zidney/logger'
import type { ActionEnum, Module } from '@zidney/types'
import type { MiddlewareHandler } from 'hono'

/**
 * Minimal tenant context shape expected in Hono context.
 * Set by the tenant resolver middleware before this guard executes.
 */
interface TenantCtx {
  id: string
  slug: string
  pool: {
    query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>
  }
  redis?: {
    get: (key: string) => Promise<string | null>
    set: (
      key: string,
      value: string,
      options?: { EX?: number }
    ) => Promise<unknown>
  }
}

/**
 * Minimal staff user context shape expected in Hono context.
 * Set by the authentication middleware before this guard executes.
 */
interface StaffCtx {
  user_id: string
  role_id: string
}

/**
 * Creates an RBAC Permission Guard middleware for a specific module + action.
 *
 * Usage:
 *   app.get(
 *     '/api/v1/backoffice/mcq',
 *     createBackofficeRBACGuard(logger, Module.MCQ, ActionEnum.VIEW),
 *     handler
 *   )
 *
 * @param logger  - Module-scoped logger (required for audit log on denial)
 * @param requiredModule - Module being protected
 * @param requiredAction - Action being protected
 */
export function createBackofficeRBACGuard(
  logger: Logger,
  requiredModule: Module,
  requiredAction: ActionEnum
): MiddlewareHandler {
  return async (c, next) => {
    const correlation_id: string =
      (c.get('correlationId') as string) || 'unknown'
    const staff_user = c.get('staff_user') as StaffCtx | undefined
    const tenant = c.get('tenant') as TenantCtx | undefined

    if (!staff_user || !tenant) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Staff user context not found',
            correlationId: correlation_id,
          },
        },
        401
      )
    }

    // Check enabled_modules first — fast pre-check before DB/Redis query
    const enabled_modules: string[] =
      (c.get('enabled_modules') as string[]) ?? []
    if (!enabled_modules.includes(requiredModule)) {
      logger.warn('Module not licensed (RBAC guard pre-check)', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id,
        route_name: c.req.routePath,
        user_id: staff_user.user_id,
        module: requiredModule,
      })
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'MODULE_NOT_LICENSED',
            message: `Module ${requiredModule} is not enabled for this workspace`,
            correlationId: correlation_id,
          },
        },
        403
      )
    }

    // F-02: Check Redis RBAC cache before DB query
    // Cache key: rbac:{workspace_id}:{user_id}:{module}:{action}
    // TTL: 30 seconds — permissions change infrequently in the bootstrap phase
    const rbacCacheKey = `rbac:${tenant.id}:${staff_user.user_id}:${requiredModule}:${requiredAction}`

    if (tenant.redis) {
      const cached = await tenant.redis.get(rbacCacheKey)
      if (cached !== null && cached !== undefined) {
        const hasPermission = cached === '1'
        if (!hasPermission) {
          logger.warn('RBAC permission denied (cache hit)', {
            workspace_slug: tenant.slug,
            workspace_id: tenant.id,
            correlation_id,
            route_name: c.req.routePath,
            user_id: staff_user.user_id,
            module: requiredModule,
            action: requiredAction,
          })
          return c.json(
            {
              success: false,
              data: null,
              error: {
                code: 'RBAC_PERMISSION_DENIED',
                message: 'Insufficient permissions',
                correlationId: correlation_id,
              },
            },
            403
          )
        }
        await next()
        return
      }
    }

    // Cache miss — query tenant DB for permission
    const result = await tenant.pool.query<{ has_permission: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1
        FROM   backoffice_staff_user_roles sur
        JOIN   backoffice_role_permissions rp ON rp.role_id = sur.role_id
        WHERE  sur.staff_user_id = $1
        AND    rp.module         = $2
        AND    rp.action         = $3
      ) AS has_permission
      `,
      [staff_user.user_id, requiredModule, requiredAction]
    )

    const hasPermission = result.rows[0]?.has_permission ?? false

    // Store result in Redis cache (TTL = 30 s)
    if (tenant.redis) {
      await tenant.redis.set(rbacCacheKey, hasPermission ? '1' : '0', {
        EX: 30,
      })
    }

    if (!hasPermission) {
      logger.warn('RBAC permission denied', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id,
        route_name: c.req.routePath,
        user_id: staff_user.user_id,
        module: requiredModule,
        action: requiredAction,
      })
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'RBAC_PERMISSION_DENIED',
            message: 'Insufficient permissions',
            correlationId: correlation_id,
          },
        },
        403
      )
    }

    await next()
  }
}
