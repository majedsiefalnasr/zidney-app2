/**
 * Backoffice Module Guard Middleware — STAGE_17
 *
 * File: apps/api/src/middleware/backoffice-module-guard.ts
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 * Date: 2026-02-28
 *
 * Lightweight module-enabled gate middleware. Checks `c.get('enabled_modules')`
 * without a DB query to block API endpoints scoped to a disabled module.
 *
 * Used on routes that need module enforcement without RBAC (e.g., read-only
 * module pages where no role check is needed).
 *
 * M-02: logger is a mandatory parameter — required to emit security audit log
 *       on every module guard denial.
 *
 * Constitutional Compliance:
 * ✓ No DB access — reads from Hono context only
 * ✓ Structured logging with all 6 required audit fields on every denial
 * ✓ No console.log — all logging through @zidney/logger (M-02)
 * ✓ Error response format: { success, data, error: { code, message, correlationId } }
 */

import type { Logger } from '@zidney/logger'
import type { Module } from '@zidney/types'
import type { MiddlewareHandler } from 'hono'

/**
 * Creates a module-enabled guard middleware.
 *
 * Usage:
 *   app.get(
 *     '/api/v1/backoffice/library',
 *     createModuleGuard(routeLogger, Module.LIBRARY),
 *     libraryListHandler
 *   )
 *
 * @param logger          - Module-scoped logger (M-02: mandatory — emits security audit log on denial)
 * @param requiredModule  - Module that must be enabled for the request to proceed
 */
export function createModuleGuard(logger: Logger, requiredModule: Module): MiddlewareHandler {
  return async (c, next) => {
    const enabled_modules: string[] = (c.get('enabled_modules') as string[]) ?? []

    if (!enabled_modules.includes(requiredModule)) {
      // M-02: Emit security audit log on every module guard denial
      logger.warn('Module guard denied request', {
        module: requiredModule,
        workspace_id: (c.get('workspace_id') as string | undefined) ?? 'unknown',
        workspace_slug: (c.get('workspace_slug') as string | undefined) ?? 'unknown',
        correlation_id: (c.get('correlationId') as string | undefined) ?? 'unknown',
        user_id: (c.get('staff_user') as { user_id?: string } | undefined)?.user_id ?? 'unknown',
        route_name: `${c.req.method} ${c.req.path}`,
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'MODULE_NOT_LICENSED',
            message: `Module ${requiredModule} is not available for this workspace`,
            correlationId: (c.get('correlationId') as string | undefined) ?? 'unknown',
          },
        },
        403
      )
    }

    await next()
  }
}
