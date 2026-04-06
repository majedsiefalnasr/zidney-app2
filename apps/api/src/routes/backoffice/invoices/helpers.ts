/**
 * Invoices Routes — Helpers
 *
 * File: apps/api/src/routes/backoffice/invoices/helpers.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 *
 * Shared utilities, context extractors, and error response builder for invoice routes.
 */

import { BILLING_ERROR_HTTP, BillingError } from '@zidney/domain-core/billing'
import type { AuditContext, DbClient } from '@zidney/domain-core/plans'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'

const logger = createLogger('backoffice-invoices')

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
  const workspaceId = c.get('workspace_id')
  const workspaceSlug = c.get('workspace_slug')
  const correlationId = c.get('correlation_id')

  if (!workspaceId) throw new Error('missing workspace_id')
  if (!workspaceSlug) throw new Error('missing workspace_slug')
  if (!correlationId) throw new Error('missing correlation_id')

  return {
    user_id: user.id,
    workspace_id: workspaceId,
    workspace_slug: workspaceSlug,
    correlation_id: correlationId,
  }
}

// ---------------------------------------------------------------------------
// Error Response Mapping
// ---------------------------------------------------------------------------

export function invoiceErrorResponse(c: Context, err: unknown) {
  const requestId = (c.get('request_id') as string | undefined) ?? null
  const workspaceSlug = c.get('workspace_slug')
  const user = c.get('user')
  const userId = user?.id

  if (err instanceof BillingError) {
    const status = BILLING_ERROR_HTTP[err.code] as 200 | 400 | 401 | 404 | 409 | 422 | 500
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
  logger.error('Unhandled invoices error', {
    message: safeError.message,
    code: (safeError as NodeJS.ErrnoException).code,
    request_id: requestId,
    workspace_slug: workspaceSlug,
    user_id: userId,
  })

  return c.json(
    {
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      request_id: requestId,
    },
    500
  )
}
