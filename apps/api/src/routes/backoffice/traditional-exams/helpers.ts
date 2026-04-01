/**
 * Traditional Exams Route Helpers
 *
 * File: apps/api/src/routes/backoffice/traditional-exams/helpers.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 *
 * Shared utilities used by all traditional exam route handlers.
 */

import type { AuditContext, DbClient } from '@zidney/domain-core/traditional-exams'
import {
  TRADITIONAL_EXAM_ERROR_HTTP_STATUS,
  TRADITIONAL_EXAM_ERROR_MESSAGES,
  TraditionalExamError,
} from '@zidney/domain-core/traditional-exams'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'

const logger = createLogger('traditional-exams-route:helpers')

// ---------------------------------------------------------------------------
// DB + Audit Context Extractors
// ---------------------------------------------------------------------------

export function getDb(c: Context): DbClient {
  return c.get('tenant').pool as DbClient
}

export function buildAuditCtx(c: Context): AuditContext {
  const user = c.get('user') as { id: string } | undefined
  const rbacCtx = c.get('rbacContext') as { permissions: string[] } | null
  return {
    user_id: (user?.id ?? '') as string,
    correlation_id: c.get('correlation_id') as string,
    workspace_slug: (c.get('workspace_slug') ?? '') as string,
    workspace_id: c.get('workspace_id') as string,
    caller_permissions: rbacCtx?.permissions ?? [],
  }
}

// ---------------------------------------------------------------------------
// Response Envelope
// ---------------------------------------------------------------------------

interface SuccessResponse<T> {
  success: true
  data: T
  error: null
}

interface ErrorResponse {
  success: false
  data: null
  error: { code: string; message: string }
}

export function successResponse<T>(data: T): SuccessResponse<T> {
  return { success: true, data, error: null }
}

// ---------------------------------------------------------------------------
// Traditional Exams Error Response
// ---------------------------------------------------------------------------

export function traditionalExamsErrorResponse(c: Context, err: unknown): Response {
  const correlationId = c.get('correlation_id') as string | undefined
  const workspaceId = c.get('workspace_id') as string | undefined

  if (err instanceof TraditionalExamError) {
    logger.warn('Traditional exams domain error', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      error_code: err.code,
      error_message: err.message,
    })

    const httpStatus = TRADITIONAL_EXAM_ERROR_HTTP_STATUS[err.code] ?? 500
    const response: ErrorResponse = {
      success: false,
      data: null,
      error: {
        code: err.code,
        message: err.message || TRADITIONAL_EXAM_ERROR_MESSAGES[err.code] || 'Unknown error',
      },
    }
    return c.json(response, httpStatus as 400 | 403 | 404 | 409 | 422 | 500 | 503)
  }

  if (
    err !== null &&
    typeof err === 'object' &&
    'name' in err &&
    (err as { name: string }).name === 'ZodError'
  ) {
    return c.json(
      {
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request data' },
      } as ErrorResponse,
      422
    )
  }

  logger.error('Unexpected error in traditional-exams route', {
    correlation_id: correlationId,
    workspace_id: workspaceId,
    error_message: err instanceof Error ? err.message : 'Unknown error',
  })

  return c.json(
    {
      success: false,
      data: null,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
    } as ErrorResponse,
    500
  )
}
