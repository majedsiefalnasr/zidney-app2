/**
 * Lessons Route Helpers
 *
 * File: apps/api/src/routes/backoffice/lessons/helpers.ts
 * Stage: STAGE_29_LESSONS
 *
 * user_id is `string | null` because the runtime endpoint (/lessons/runtime)
 * is license-only (no auth token), so `c.get('user')` may be undefined there.
 * Authenticated backoffice handlers will always have a non-null user_id.
 */

import type { AuditContext, DbClient } from '@zidney/domain-core/lessons'
import {
  LESSON_ERROR_HTTP_STATUS,
  LESSON_ERROR_MESSAGES,
  LessonError,
  type LessonErrorCode,
} from '@zidney/domain-core/lessons'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'

const logger = createLogger('lessons-route:helpers')

// ---------------------------------------------------------------------------
// DB + Audit Context Extractors
// ---------------------------------------------------------------------------

export function getDb(c: Context): DbClient {
  return c.get('tenant').pool as DbClient
}

export function buildAuditCtx(c: Context): AuditContext {
  const user = c.get('user') as { id: string } | undefined
  return {
    user_id: (user?.id ?? null) as string | null,
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
// Lessons Error Response
// ---------------------------------------------------------------------------

export function lessonsErrorResponse(c: Context, err: unknown): Response {
  const correlationId = c.get('correlation_id') as string | undefined
  const workspaceId = c.get('workspace_id') as string | undefined

  // Structured domain errors
  if (err instanceof LessonError) {
    logger.warn('Lessons domain error', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      error_code: err.code,
      error_message: err.message,
    })

    const httpStatus = LESSON_ERROR_HTTP_STATUS[err.code as LessonErrorCode] ?? 500
    const response: ErrorResponse = {
      success: false,
      data: null,
      error: {
        code: err.code,
        message:
          err.message || LESSON_ERROR_MESSAGES[err.code as LessonErrorCode] || 'Unknown error',
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
  logger.error('Unexpected error in lessons route', {
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
