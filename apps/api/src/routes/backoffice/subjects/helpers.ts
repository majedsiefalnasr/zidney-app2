/**
 * Subjects Route Helpers
 *
 * File: apps/api/src/routes/backoffice/subjects/helpers.ts
 * Stage: STAGE_28_SUBJECTS
 */

import type { AuditContext, DbClient } from '@zidney/domain-core/subjects'
import {
  SUBJECTS_ERROR_HTTP_STATUS,
  SUBJECTS_ERROR_MESSAGES,
  SubjectsError,
  type SubjectsErrorCode,
} from '@zidney/domain-core/subjects'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'

const logger = createLogger('subjects-route:helpers')

// ---------------------------------------------------------------------------
// DB + Audit Context Extractors
// ---------------------------------------------------------------------------

export function getDb(c: Context): DbClient {
  return c.get('tenant').pool as DbClient
}

export function buildAuditCtx(c: Context): AuditContext {
  const user = c.get('user')
  return {
    user_id: user.id as string,
    correlation_id: c.get('correlation_id') as string,
    workspace_slug: (c.get('workspace_slug') ?? '') as string,
    workspace_id: c.get('workspace_id') as string,
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
// Subjects Error Response
// ---------------------------------------------------------------------------

export function subjectsErrorResponse(c: Context, err: unknown): Response {
  const correlationId = c.get('correlation_id') as string | undefined
  const workspaceId = c.get('workspace_id') as string | undefined

  // Handle lock contention (pg error 55P03 — FOR UPDATE NOWAIT)
  if (err !== null && typeof err === 'object' && 'code' in err) {
    const pgCode = (err as { code: string }).code
    if (pgCode === '55P03') {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'SUBJECT_NOT_FOUND',
            message: SUBJECTS_ERROR_MESSAGES.SUBJECT_NOT_FOUND,
          },
        } as ErrorResponse,
        503
      )
    }
  }

  // Structured domain errors
  if (err instanceof SubjectsError) {
    logger.warn('Subjects domain error', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      error_code: err.code,
      error_message: err.message,
    })

    const httpStatus = SUBJECTS_ERROR_HTTP_STATUS[err.code as SubjectsErrorCode] || 500
    const response: ErrorResponse = {
      success: false,
      data: null,
      error: {
        code: err.code,
        message:
          err.message || SUBJECTS_ERROR_MESSAGES[err.code as SubjectsErrorCode] || 'Unknown error',
      },
    }
    return c.json(response, httpStatus)
  }

  // Zod validation errors
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

  // Fallback 500
  logger.error('Unexpected error in subjects route', {
    correlation_id: correlationId,
    workspace_id: workspaceId,
    error_name: err instanceof Error ? err.name : typeof err,
    error_message: err instanceof Error ? err.message : String(err),
  })

  return c.json(
    {
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    } as ErrorResponse,
    500
  )
}
