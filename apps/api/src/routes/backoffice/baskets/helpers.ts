/**
 * Baskets Route Helpers
 *
 * File: apps/api/src/routes/backoffice/baskets/helpers.ts
 * Stage: STAGE_33_MCQ_BASKETS
 *
 * Shared utilities used by all basket route handlers.
 */

import type { AuditContext, DbClient } from '@zidney/domain-core/baskets'
import {
  BASKET_ERROR_HTTP_STATUS,
  BASKET_ERROR_MESSAGES,
  BasketError,
} from '@zidney/domain-core/baskets'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'

const logger = createLogger('baskets-route:helpers')

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
// Baskets Error Response
// ---------------------------------------------------------------------------

export function basketsErrorResponse(c: Context, err: unknown): Response {
  const correlationId = c.get('correlation_id') as string | undefined
  const workspaceId = c.get('workspace_id') as string | undefined

  if (err instanceof BasketError) {
    logger.warn('Baskets domain error', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      error_code: err.code,
      error_message: err.message,
    })

    const httpStatus = BASKET_ERROR_HTTP_STATUS[err.code] ?? 500
    const response: ErrorResponse = {
      success: false,
      data: null,
      error: {
        code: err.code,
        message: err.message || BASKET_ERROR_MESSAGES[err.code] || 'Unknown error',
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

  logger.error('Unexpected error in baskets route', {
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

// ---------------------------------------------------------------------------
// Permission Bridge (AD-002)
// ---------------------------------------------------------------------------

/**
 * Translate RBAC permissions to workflow engine permission tokens.
 *
 * question_manage | content_manage  → mcq_basket.complete, mcq_basket.review
 * question_manage | content_review  → mcq_basket.approve, mcq_basket.enable
 */
export function buildBasketWorkflowPermissions(rbacPerms: string[]): string[] {
  const perms: string[] = []
  if (rbacPerms.includes('question_manage') || rbacPerms.includes('content_manage')) {
    perms.push('mcq_basket.complete', 'mcq_basket.review')
  }
  if (rbacPerms.includes('question_manage') || rbacPerms.includes('content_review')) {
    perms.push('mcq_basket.approve', 'mcq_basket.enable')
  }
  return perms
}
