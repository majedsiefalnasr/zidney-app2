/**
 * Staff Routes — Helpers
 *
 * File: apps/api/src/routes/backoffice/staff/helpers.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 *
 * Shared utilities, context extractors, and error response builder for staff routes.
 */

import type { AuditContext, DbClient } from '@zidney/domain-core/staff'
import { STAFF_ERROR_HTTP, StaffError } from '@zidney/domain-core/staff'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'

const logger = createLogger('backoffice-staff')

// ---------------------------------------------------------------------------
// Database Access
// ---------------------------------------------------------------------------

export function getDb(c: Context): DbClient {
  const tenant = c.get('tenant')
  if (!tenant?.pool) {
    logger.error('Tenant pool not available in context', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
    })
    throw new Error('Tenant pool not initialized')
  }
  return tenant.pool as DbClient
}

// ---------------------------------------------------------------------------
// Audit Context
// ---------------------------------------------------------------------------

export function buildAuditCtx(c: Context): AuditContext {
  const user = c.get('user')
  if (!user?.id) {
    logger.error('User not present in context', { correlation_id: c.get('correlation_id') })
    throw new Error('User not authenticated')
  }
  return {
    user_id: user.id,
    workspace_id: c.get('workspace_id') || '',
    workspace_slug: c.get('workspace_slug') || '',
    correlation_id: c.get('correlation_id') || '',
  }
}

// ---------------------------------------------------------------------------
// UUID validation
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value)
}

// ---------------------------------------------------------------------------
// Error Response Mapping
// ---------------------------------------------------------------------------

export function staffErrorResponse(c: Context, err: unknown) {
  const requestId = (c.get('request_id') as string | undefined) ?? null

  if (err instanceof StaffError) {
    const status = STAFF_ERROR_HTTP[err.code] as 400 | 403 | 404 | 409 | 422 | 500
    return c.json(
      {
        success: false,
        data: null,
        error: { code: err.code, message: err.message },
        request_id: requestId,
      },
      status
    )
  }

  const safeError = err instanceof Error ? err : new Error(String(err))
  logger.error('Unhandled staff error', {
    message: safeError.message,
    code: (safeError as NodeJS.ErrnoException).code,
    request_id: requestId,
  })

  return c.json(
    {
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      request_id: requestId,
    },
    500
  )
}
