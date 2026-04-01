/**
 * POST /scheduled-exams/:scheduledExamId/attempts
 * Student starts a scheduled exam attempt.
 *
 * File: apps/api/src/routes/backoffice/scheduled-exams/start-attempt.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE
 *
 * Security: JWT → STUDENT role → ENABLED status → time gate → single-attempt guard
 * Uses advisory lock via startScheduledAttempt service to prevent race conditions.
 */

import { startScheduledAttempt } from '@zidney/domain-core/scheduled-exam'
import { scheduledExamIdParamSchema } from '@zidney/validation/backoffice/scheduled-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, scheduledExamErrorResponse, successResponse } from './helpers'

export async function startAttemptHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = scheduledExamIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid scheduledExamId' },
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)
    const { scheduledExamId } = paramParsed.data

    const result = await startScheduledAttempt(db, scheduledExamId, audit)
    return c.json(successResponse(result), 201)
  } catch (err) {
    return scheduledExamErrorResponse(c, err)
  }
}
