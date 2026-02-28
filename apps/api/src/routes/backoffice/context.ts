/**
 * Backoffice Context Route — STAGE_17
 *
 * File: apps/api/src/routes/backoffice/context.ts
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 * Date: 2026-02-28
 *
 * Exposes GET /api/v1/backoffice/context — the runtime BackofficeContext
 * endpoint consumed by the Backoffice SPA on mount to initialize the Pinia store.
 *
 * Auth: HttpOnly SameSite=Strict cookie (backoffice_token). No Authorization header.
 * SPA sends credentials: 'include' — no Authorization header.
 * No RBAC guard — any authenticated staff user may read their own context.
 *
 * Middleware chain (applied at app.ts level):
 *   correlationId → tenantResolver → licenseEnforcement → schemaVersion
 *   → rateLimit(max:60) → authentication → this handler
 *
 * Constitutional Compliance:
 * ✓ All context values read from Hono context (injected by middleware chain)
 * ✓ No DB queries in this route handler — stateless read of injected context
 * ✓ Structured logging: workspace_slug, workspace_id, correlation_id, user_id, route_name
 * ✓ No console.log — uses @zidney/logger
 * ✓ Response: { success, data: BackofficeContext, error: null }
 */

import { createLogger } from '@zidney/logger'
import { Hono } from 'hono'
import type { BackofficeEnv } from './types'

const logger = createLogger('backoffice-context')

export const backofficeContextRouter = new Hono<BackofficeEnv>()

backofficeContextRouter.get('/backoffice/context', async (c) => {
  const correlation_id = c.get('correlationId') || 'unknown'
  const tenant = c.get('tenant')
  const staff_user = c.get('staff_user')

  // Guard: auth middleware must have injected staff_user; if absent, return 401
  if (!staff_user) {
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          correlationId: correlation_id,
        },
      },
      401
    )
  }

  // Guard: tenant resolver must have injected tenant; if absent, return 404
  if (!tenant) {
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'WORKSPACE_NOT_FOUND',
          message: 'Workspace not found',
          correlationId: correlation_id,
        },
      },
      404
    )
  }

  logger.info('Backoffice context requested', {
    workspace_slug: tenant.slug,
    workspace_id: tenant.id,
    correlation_id,
    route_name: 'GET /api/v1/backoffice/context',
    user_id: staff_user.user_id,
  })

  return c.json(
    {
      success: true,
      data: {
        workspace_id: tenant.id,
        workspace_slug: tenant.slug,
        license_status: c.get('license_status'),
        enabled_modules: c.get('enabled_modules'),
        student_limit: c.get('student_limit'),
        staff_limit: c.get('staff_limit'),
        product_version: c.get('product_version'),
        schema_version: tenant.schema_version,
        request_id: correlation_id,
      },
      error: null,
    },
    200
  )
})
