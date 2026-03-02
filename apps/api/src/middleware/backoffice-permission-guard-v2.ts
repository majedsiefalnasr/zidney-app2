/**
 * Backoffice Permission Guard v2 — STAGE_21
 *
 * File: apps/api/src/middleware/backoffice-permission-guard-v2.ts
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM
 * Date: 2026-03-02
 *
 * Server-side RBAC enforcement for Backoffice routes.
 * Implements the 7-step permission evaluation chain described in plan.md.
 *
 * Chain position (authoritative):
 *   correlationId → tenantResolver → licenseMiddleware → auth-jwt
 *   → workspace-id-assertion (sets workspaceId, validates jwt.workspace_id === tenant.id)
 *   → [per-route] createPermissionGuard(logger, module, action)   ← THIS FILE
 *   → route handler
 *
 * NOTE: workspace_id assertion (cross-tenant token replay check) is handled
 * by the chain-level workspace-id-assertion middleware that runs BEFORE this guard.
 * DO NOT duplicate that check here — it would emit a double WARN log.
 *
 * Guard starts at Step 2: load staff user from backoffice_staff_users by jwt.sub.
 *
 * Cache:
 * - Per-request: Map<string, boolean> (request-scoped, disposed at response)
 * - Redis: key `rbac_v2:{workspace_id}:{user_id}:{module}:{action}` TTL 30s
 * - Invalidation: Redis SCAN cursor + DEL (NEVER use KEYS — O(N) blocking)
 * - Cache prefix `rbac_v2:` is distinct from STAGE_17's `rbac:` prefix
 *
 * Error responses: { success: false, data: null, error: { code: 'FORBIDDEN', message: 'Access denied' } }
 * No internal permission structure, role names, or user counts in 403 responses (SC-007).
 *
 * Constitutional Compliance:
 * ✓ All DB access via tenant.pool (from tenant resolver context)
 * ✓ No global DB singleton
 * ✓ Structured logging with correlation_id, workspace_slug, workspace_id, user_id, module, action
 * ✓ No console.log — all logs via @zidney/logger
 * ✓ Deny-by-default on any missing/invalid element
 * ✓ Redis SCAN cursor for wildcard flush (not KEYS)
 * ✓ Cache prefix `rbac_v2:` (not `rbac:`)
 */

import type { Logger } from '@zidney/logger'
import type { MiddlewareHandler } from 'hono'
import type { Redis } from 'ioredis'

import {
  PermissionModule,
  type PermissionAction,
} from '@zidney/domain-core/rbac'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TenantContext {
  id: string
  slug: string
  pool: {
    query: <T = any>(
      sql: string,
      params?: unknown[]
    ) => Promise<{ rows: T[]; rowCount: number | null }>
  }
  redis?: Redis
}

interface StaffUserRow {
  id: string
  is_active: boolean
  role_id: string | null
}

interface RoleRow {
  id: string
  status: string
}

interface PermissionRow {
  [key: string]: boolean
}

// ---------------------------------------------------------------------------
// Forbidden response helper
// ---------------------------------------------------------------------------

function forbidden(c: any, correlationId: string): Response {
  return c.json(
    {
      success: false,
      data: null,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied',
        correlationId: correlationId,
      },
    },
    403
  )
}

// ---------------------------------------------------------------------------
// Redis SCAN wildcard flush
//
// Invalidates all rbac_v2 cache entries for a workspace.
// Uses SCAN cursor to avoid O(N) KEYS blocking in production Redis.
// ---------------------------------------------------------------------------

export async function flushRbacCacheForWorkspace(
  redis: Redis,
  workspaceId: string,
  logger: Logger
): Promise<void> {
  try {
    let cursor = '0'
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        `rbac_v2:${workspaceId}:*`,
        'COUNT',
        '100'
      )
      cursor = nextCursor
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } while (cursor !== '0')
  } catch (err) {
    // Log at ERROR — do not throw (cache invalidation failure must not abort transaction)
    logger.error('RBAC cache flush failed', {
      workspace_id: workspaceId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ---------------------------------------------------------------------------
// createPermissionGuard
// ---------------------------------------------------------------------------

/**
 * Creates a per-route RBAC permission guard middleware.
 *
 * @param logger  - Module-scoped structured logger
 * @param module  - PermissionModule being protected
 * @param action  - PermissionAction being protected
 *
 * Usage:
 *   rolesRouter.get('/roles', createPermissionGuard(logger, PermissionModule.SETTINGS, 'can_view'), handler)
 */
export function createPermissionGuard(
  logger: Logger,
  module: PermissionModule | string,
  action: PermissionAction
): MiddlewareHandler {
  return async (c, next) => {
    const correlationId: string =
      (c.get('correlationId') as string) || 'unknown'
    const tenant = c.get('tenant') as TenantContext | undefined

    if (!tenant) {
      return forbidden(c, correlationId)
    }

    // Resolve user_id from JWT payload (set by auth-jwt middleware)
    // Support both the legacy 'userId' key and the 'authPayload' key
    const authPayload = c.get('authPayload') as { user_id?: string } | undefined
    const userId: string | undefined =
      authPayload?.user_id ?? (c.get('userId') as string | undefined)

    if (!userId) {
      return forbidden(c, correlationId)
    }

    // Per-request in-memory cache (keyed by module:action)
    const requestCache = new Map<string, boolean>()
    const requestCacheKey = `${module}:${action}`

    // -- Step 1 (already done by chain-level workspace-id-assertion) --
    // workspace_id assertion is performed by the middleware chain before this guard.
    // DO NOT re-check here — that would emit a duplicate WARN log.

    // -- Step 2: Load staff user from backoffice_staff_users by jwt.sub --
    const userResult = await tenant.pool.query<StaffUserRow>(
      `SELECT id, is_active, role_id FROM backoffice_staff_users WHERE id = $1`,
      [userId]
    )
    if (userResult.rows.length === 0) {
      logger.warn('Permission denied: staff user not found', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        user_id: userId,
        module,
        action,
      })
      return forbidden(c, correlationId)
    }
    const user = userResult.rows[0]!

    // -- Step 3: Check is_active --
    if (!user.is_active) {
      logger.warn('Permission denied: staff user inactive', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        user_id: userId,
        module,
        action,
      })
      return forbidden(c, correlationId)
    }

    // -- Step 4: Check role_id not null --
    if (!user.role_id) {
      logger.warn('Permission denied: no role assigned', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        user_id: userId,
        module,
        action,
      })
      return forbidden(c, correlationId)
    }

    // -- Step 5: Load role from backoffice_roles --
    const roleResult = await tenant.pool.query<RoleRow>(
      `SELECT id, status FROM backoffice_roles WHERE id = $1`,
      [user.role_id]
    )
    if (roleResult.rows.length === 0) {
      logger.warn('Permission denied: role not found', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        user_id: userId,
        module,
        action,
      })
      return forbidden(c, correlationId)
    }

    // -- Step 6: Check role.status === 'ACTIVE' --
    if (roleResult.rows[0]!.status !== 'ACTIVE') {
      logger.warn('Permission denied: role disabled', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        user_id: userId,
        module,
        action,
      })
      return forbidden(c, correlationId)
    }

    // -- Step 7: Load permission row (check per-request cache, then Redis, then DB) --
    let hasPermission: boolean | undefined

    // Check per-request cache first
    if (requestCache.has(requestCacheKey)) {
      hasPermission = requestCache.get(requestCacheKey)!
    } else {
      // Check Redis cache
      const redisCacheKey = `rbac_v2:${tenant.id}:${userId}:${module}:${action}`
      if (tenant.redis) {
        try {
          const cached = await tenant.redis.get(redisCacheKey)
          if (cached !== null && cached !== undefined) {
            hasPermission = cached === '1'
            requestCache.set(requestCacheKey, hasPermission)
          }
        } catch (err) {
          // Redis read failure — proceed to DB query (degraded cache, not a block)
          logger.warn('Redis cache read failed — falling back to DB', {
            workspace_slug: tenant.slug,
            workspace_id: tenant.id,
            correlation_id: correlationId,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      // Cache miss — query DB
      if (hasPermission === undefined) {
        const permResult = await tenant.pool.query<PermissionRow>(
          `
          SELECT ${action}
          FROM backoffice_role_module_permissions
          WHERE role_id = $1 AND module = $2
          `,
          [user.role_id, module]
        )

        if (permResult.rows.length === 0) {
          hasPermission = false
        } else {
          hasPermission = permResult.rows[0]![action] === true
        }

        // Store in request cache
        requestCache.set(requestCacheKey, hasPermission)

        // Store in Redis (TTL 30s)
        if (tenant.redis) {
          try {
            await tenant.redis.set(
              redisCacheKey,
              hasPermission ? '1' : '0',
              'EX',
              30
            )
          } catch (err) {
            // Redis write failure is non-blocking — log and continue
            logger.warn('Redis cache write failed', {
              workspace_slug: tenant.slug,
              workspace_id: tenant.id,
              correlation_id: correlationId,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }
      }
    }

    // -- Step 8: Evaluate permission flag --
    if (!hasPermission) {
      logger.warn('Permission denied: missing or false permission flag', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id: correlationId,
        user_id: userId,
        module,
        action,
      })
      return forbidden(c, correlationId)
    }

    await next()
  }
}
