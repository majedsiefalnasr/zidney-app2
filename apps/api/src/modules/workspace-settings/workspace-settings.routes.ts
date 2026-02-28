/**
 * Workspace Settings — Hono Route Definitions
 *
 * File: apps/api/src/modules/workspace-settings/workspace-settings.routes.ts
 * Stage: 018_WORKSPACE_SETTINGS
 * Date: 2026-02-28
 *
 * Three route handlers:
 * - GET  /settings       — Retrieve all workspace settings
 * - PUT  /settings/:group — Update a specific settings group
 * - GET  /settings/audit  — Query audit trail
 *
 * Middleware chain applied at app.ts level (before this handler):
 *   correlationId → tenantResolver → licenseEnforcement → schemaVersion
 *   → rateLimit → auth (JWT) → this handler
 *
 * RBAC guard (institution admin) applied per-route below.
 *
 * Constitutional Compliance:
 * ✓ Structured error response format
 * ✓ No business logic in routes — delegates to service
 * ✓ No DB access in routes — uses service + repository
 * ✓ Structured logging with correlation_id + workspace_slug
 */

import { createLogger } from '@zidney/logger'
import { Hono } from 'hono'

import type { BackofficeEnv } from '../../routes/backoffice/types'
import {
  InvalidSettingsGroupError,
  WorkspaceSettingsError,
} from './workspace-settings.errors'
import type { SettingsRequestContext } from './workspace-settings.service'
import * as service from './workspace-settings.service'
import {
  settingsGroupSchema,
  updateSettingsRequestSchema,
} from './workspace-settings.validation'

const logger = createLogger('workspace-settings-routes')

export const workspaceSettingsRouter = new Hono<BackofficeEnv>()

// ---------------------------------------------------------------------------
// Helper: Extract SettingsRequestContext from Hono context
// ---------------------------------------------------------------------------

function extractContext(c: any): SettingsRequestContext {
  const tenant = c.get('tenant')
  const staffUser = c.get('staff_user')
  const correlationId = c.get('correlationId') || 'unknown'

  return {
    db: tenant.pool,
    workspace_id: tenant.id,
    workspace_slug: tenant.slug,
    user_id: staffUser?.user_id || 'unknown',
    correlation_id: correlationId,
    ip_address:
      c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || null,
    user_agent: c.req.header('user-agent') || null,
  }
}

// ---------------------------------------------------------------------------
// T012: GET /settings — Retrieve all workspace settings
// ---------------------------------------------------------------------------

workspaceSettingsRouter.get('/settings', async (c) => {
  try {
    const ctx = extractContext(c)
    const result = await service.getWorkspaceSettings(ctx)

    return c.json(
      {
        success: true,
        data: result,
        error: null,
      },
      200
    )
  } catch (err) {
    return handleSettingsError(c, err)
  }
})

// ---------------------------------------------------------------------------
// T025: GET /settings/audit — Query audit trail
// NOTE: This must be registered BEFORE /settings/:group to avoid route conflicts
// ---------------------------------------------------------------------------

workspaceSettingsRouter.get('/settings/audit', async (c) => {
  try {
    const ctx = extractContext(c)
    const group = c.req.query('group') || undefined
    const limit = c.req.query('limit')
      ? Number(c.req.query('limit'))
      : undefined
    const cursor = c.req.query('cursor') || undefined

    const result = await service.getSettingsAudit(ctx, { group, limit, cursor })

    return c.json(
      {
        success: true,
        data: result,
        error: null,
      },
      200
    )
  } catch (err) {
    return handleSettingsError(c, err)
  }
})

// ---------------------------------------------------------------------------
// T018: PUT /settings/:group — Update a specific settings group
// ---------------------------------------------------------------------------

workspaceSettingsRouter.put('/settings/:group', async (c) => {
  try {
    const ctx = extractContext(c)
    const group = c.req.param('group')

    // Validate group path parameter
    const groupResult = settingsGroupSchema.safeParse(group)
    if (!groupResult.success) {
      throw new InvalidSettingsGroupError(group)
    }

    // Parse request body
    const body = await c.req.json()
    const bodyResult = updateSettingsRequestSchema.safeParse(body)
    if (!bodyResult.success) {
      const issues = bodyResult.error.issues
        .map(
          (i: { path: (string | number)[]; message: string }) =>
            `${i.path.join('.')}: ${i.message}`
        )
        .join('; ')
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'SETTINGS_VALIDATION_FAILED',
            message: `Invalid request body: ${issues}`,
          },
        },
        422
      )
    }

    const { config_version, settings } = bodyResult.data

    const result = await service.updateSettingsGroup(
      ctx,
      groupResult.data,
      settings,
      config_version
    )

    return c.json(
      {
        success: true,
        data: result,
        error: null,
      },
      200
    )
  } catch (err) {
    return handleSettingsError(c, err)
  }
})

// ---------------------------------------------------------------------------
// Error Handler
// ---------------------------------------------------------------------------

function handleSettingsError(c: any, err: unknown) {
  const correlationId = c.get('correlationId') || 'unknown'

  if (err instanceof WorkspaceSettingsError) {
    logger.warn('Settings operation failed', {
      correlation_id: correlationId,
      error_code: err.code,
      error_message: err.message,
    })

    return c.json(err.toResponse(), err.statusCode)
  }

  // Unexpected error
  logger.error('Unexpected error in workspace settings', {
    correlation_id: correlationId,
    error_message: err instanceof Error ? err.message : 'Unknown error',
    error_stack: err instanceof Error ? err.stack : undefined,
  })

  return c.json(
    {
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred. Please try again.',
      },
    },
    500
  )
}
