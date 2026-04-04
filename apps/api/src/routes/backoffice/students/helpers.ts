/**
 * Students Routes — Helpers
 *
 * File: apps/api/src/routes/backoffice/students/helpers.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 *
 * Shared utilities, context extractors, and error response builder for student routes.
 */

import type { AuditContext, DbClient } from '@zidney/domain-core/students'
import { STUDENT_ERROR_HTTP, StudentError } from '@zidney/domain-core/students'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'

const logger = createLogger('backoffice-students')

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
// UUID validation
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value)
}

// ---------------------------------------------------------------------------
// Error Response Mapping
// ---------------------------------------------------------------------------

export function studentErrorResponse(c: Context, err: unknown) {
  const requestId = (c.get('request_id') as string | undefined) ?? null
  const workspaceSlug = c.get('workspace_slug')
  const user = c.get('user')
  const userId = user?.id

  if (err instanceof StudentError) {
    if (err.code === 'STUDENT_LIMIT_EXCEEDED') {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'LICENSE_LIMIT_REACHED',
            type: 'STUDENT_LIMIT',
            limit_value: err.limit_value ?? null,
            current_value: err.current_value ?? null,
            message: err.message,
          },
          request_id: requestId,
        },
        403
      )
    }
    const status = STUDENT_ERROR_HTTP[err.code] as 400 | 403 | 404 | 409 | 422 | 500
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
  logger.error('Unhandled students error', {
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
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      request_id: requestId,
    },
    500
  )
}
