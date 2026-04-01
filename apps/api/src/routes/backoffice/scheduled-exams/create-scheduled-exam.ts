/**
 * POST /scheduled-exams
 * Create a new scheduled exam.
 *
 * File: apps/api/src/routes/backoffice/scheduled-exams/create-scheduled-exam.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE
 */

import { createScheduledExam } from '@zidney/domain-core/scheduled-exam'
import { createScheduledExamSchema } from '@zidney/validation/backoffice/scheduled-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, scheduledExamErrorResponse, successResponse } from './helpers'

export async function createScheduledExamHandler(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const parsed = createScheduledExamSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid request data',
          },
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await createScheduledExam(db, parsed.data, audit)
    return c.json(successResponse(result), 201)
  } catch (err) {
    return scheduledExamErrorResponse(c, err)
  }
}
