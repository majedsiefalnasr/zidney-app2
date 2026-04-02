/**
 * MCQ Exams Route Helpers
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/helpers.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 *
 * Shared utilities used by all MCQ exam route handlers.
 */

import type { AuditContext, DbClient } from '@zidney/domain-core/mcq-exams'
import {
  MCQ_EXAM_ERROR_HTTP_STATUS,
  MCQ_EXAM_ERROR_MESSAGES,
  McqExamError,
} from '@zidney/domain-core/mcq-exams'
import type { CriteriaValidationResult } from '@zidney/domain-core/mcq-exams'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'

const logger = createLogger('mcq-exams-route:helpers')

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
// MCQ Exams Error Response
// ---------------------------------------------------------------------------

/** Map internal criteria validation codes to public API error codes (Stage 39). */
function criteriaCodeToApiCode(
  code: CriteriaValidationResult['errors'][number]['code']
): string {
  switch (code) {
    case 'INVALID_CRITERIA_MODE':
    case 'CRITERIA_COUNT_MISMATCH':
      return 'AUTO_SELECTION_INVALID_CRITERIA'
    case 'CRITERIA_OVERLAP_RISK':
      return 'AUTO_SELECTION_OVERLAP_UNDERSIZED'
    case 'UNDERSIZED_POOL':
      return 'AUTO_SELECTION_INSUFFICIENT_POOL'
  }
}

/**
 * Return a 422 JSON response derived from a failed CriteriaValidationResult.
 * Picks the first error entry as the primary code/message.
 */
export function criteriaValidationErrorResponse(
  c: Context,
  result: CriteriaValidationResult
): Response {
  const first = result.errors[0]
  const code = first ? criteriaCodeToApiCode(first.code) : 'AUTO_SELECTION_INVALID_CRITERIA'
  const message = first?.message ?? 'Criteria validation failed'

  const correlationId = c.get('correlation_id') as string | undefined
  const workspaceId = c.get('workspace_id') as string | undefined
  logger.warn('Criteria validation failed', {
    correlation_id: correlationId,
    workspace_id: workspaceId,
    errors: result.errors,
  })

  return c.json(
    {
      success: false,
      data: null,
      error: { code, message },
    } as ErrorResponse,
    422
  )
}

export function mcqExamsErrorResponse(c: Context, err: unknown): Response {
  const correlationId = c.get('correlation_id') as string | undefined
  const workspaceId = c.get('workspace_id') as string | undefined

  if (err instanceof McqExamError) {
    logger.warn('MCQ exams domain error', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      error_code: err.code,
      error_message: err.message,
    })

    const httpStatus = MCQ_EXAM_ERROR_HTTP_STATUS[err.code] ?? 500
    const response: ErrorResponse = {
      success: false,
      data: null,
      error: {
        code: err.code,
        message: err.message || MCQ_EXAM_ERROR_MESSAGES[err.code] || 'Unknown error',
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
    logger.warn('Workflow engine error in mcq-exams route', {
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

  logger.error('Unexpected error in mcq-exams route', {
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
 * exam_manage | content_manage  → mcq_exam.complete, mcq_exam.review
 * exam_manage | content_review  → mcq_exam.approve, mcq_exam.enable
 */
export function buildExamWorkflowPermissions(rbacPerms: string[]): string[] {
  const perms: string[] = []
  if (rbacPerms.includes('exam_manage') || rbacPerms.includes('content_manage')) {
    perms.push('mcq_exam.complete', 'mcq_exam.review')
  }
  if (rbacPerms.includes('exam_manage') || rbacPerms.includes('content_review')) {
    perms.push('mcq_exam.approve', 'mcq_exam.enable')
  }
  return perms
}
