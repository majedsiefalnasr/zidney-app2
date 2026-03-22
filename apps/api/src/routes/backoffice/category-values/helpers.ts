/**
 * Category Values Route Helpers
 *
 * File: apps/api/src/routes/backoffice/category-values/helpers.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 */

import type { AuditContext, DbClient } from '@zidney/domain-core/category-values'
import {
  CATEGORY_VALUE_ERROR_HTTP_STATUS,
  CATEGORY_VALUE_ERROR_MESSAGES,
  CategoryValueError,
  type CategoryValueErrorCode,
} from '@zidney/domain-core/category-values'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'

const logger = createLogger('category-values-route:helpers')

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
    user_id: (user?.id ?? null) as string | null,
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
// Category Values Error Response
// ---------------------------------------------------------------------------

export function categoryValuesErrorResponse(c: Context, err: unknown): Response {
  const correlationId = c.get('correlation_id') as string | undefined
  const workspaceId = c.get('workspace_id') as string | undefined

  if (err instanceof CategoryValueError) {
    logger.warn('Category values domain error', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      error_code: err.code,
      error_message: err.message,
    })

    const httpStatus = CATEGORY_VALUE_ERROR_HTTP_STATUS[err.code as CategoryValueErrorCode] ?? 500
    const response: ErrorResponse = {
      success: false,
      data: null,
      error: {
        code: err.code,
        message:
          err.message ||
          CATEGORY_VALUE_ERROR_MESSAGES[err.code as CategoryValueErrorCode] ||
          'Unknown error',
      },
    }
    return c.json(response, httpStatus)
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

  logger.error('Unexpected error in category-values route', {
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
