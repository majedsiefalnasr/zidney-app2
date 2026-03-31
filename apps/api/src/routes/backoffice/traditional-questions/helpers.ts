/**
 * Traditional Questions Route Helpers
 *
 * File: apps/api/src/routes/backoffice/traditional-questions/helpers.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 *
 * Shared utilities used by all traditional question route handlers.
 */

import type { AuditContext, DbClient } from '@zidney/domain-core/traditional-questions'
import {
  TRAD_QUESTION_ERROR_HTTP_STATUS,
  TRAD_QUESTION_ERROR_MESSAGES,
  TraditionalQuestionError,
} from '@zidney/domain-core/traditional-questions'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'

const logger = createLogger('traditional-questions-route:helpers')

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
// Traditional Questions Error Response
// ---------------------------------------------------------------------------

export function traditionalQuestionsErrorResponse(c: Context, err: unknown): Response {
  const correlationId = c.get('correlation_id') as string | undefined
  const workspaceId = c.get('workspace_id') as string | undefined

  if (err instanceof TraditionalQuestionError) {
    logger.warn('Traditional questions domain error', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      error_code: err.code,
      error_message: err.message,
    })

    const httpStatus = TRAD_QUESTION_ERROR_HTTP_STATUS[err.code] ?? 500
    const response: ErrorResponse = {
      success: false,
      data: null,
      error: {
        code: err.code,
        message: err.message || TRAD_QUESTION_ERROR_MESSAGES[err.code] || 'Unknown error',
      },
    }
    return c.json(response, httpStatus as 400 | 403 | 404 | 409 | 422 | 500 | 503)
  }

  if (
    err !== null &&
    typeof err === 'object' &&
    'name' in err &&
    (err as { name: string }).name === 'WorkflowError'
  ) {
    const workflowErr = err as { name: string; code: string; message: string; httpStatus: number }
    logger.warn('Workflow engine error in traditional-questions route', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      error_code: workflowErr.code,
      error_message: workflowErr.message,
    })
    return c.json(
      {
        success: false,
        data: null,
        error: { code: workflowErr.code, message: workflowErr.message },
      } as ErrorResponse,
      workflowErr.httpStatus as 400 | 403 | 404 | 409 | 422 | 429 | 500
    )
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

  logger.error('Unexpected error in traditional-questions route', {
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
 * question_manage | content_manage  → traditional_question.complete, traditional_question.review
 * question_manage | content_review  → traditional_question.approve, traditional_question.enable
 */
export function buildQuestionWorkflowPermissions(rbacPerms: string[]): string[] {
  const perms: string[] = []
  if (rbacPerms.includes('question_manage') || rbacPerms.includes('content_manage')) {
    perms.push('traditional_question.complete', 'traditional_question.review')
  }
  if (rbacPerms.includes('question_manage') || rbacPerms.includes('content_review')) {
    perms.push('traditional_question.approve', 'traditional_question.enable')
  }
  return perms
}
