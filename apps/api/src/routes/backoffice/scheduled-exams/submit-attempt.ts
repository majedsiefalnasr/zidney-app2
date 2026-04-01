/**
 * POST /scheduled-exams/attempts/:attemptId/submit
 * Student submits a scheduled exam attempt (idempotent).
 *
 * File: apps/api/src/routes/backoffice/scheduled-exams/submit-attempt.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE
 *
 * Late submission (auto_submitted=true) still returns HTTP 200 per spec Clarification Q4.
 */

import { submitAttempt } from '@zidney/domain-core/scheduled-exam'
import { attemptIdParamSchema } from '@zidney/validation/backoffice/scheduled-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, scheduledExamErrorResponse, successResponse } from './helpers'

export async function submitAttemptHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = attemptIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid attemptId' },
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)
    const { attemptId } = paramParsed.data

    const result = await submitAttempt(db, attemptId, audit)
    // Always 200 — even for auto_submitted=true (idempotent late submission)
    return c.json(successResponse(result), 200)
  } catch (err) {
    return scheduledExamErrorResponse(c, err)
  }
}
