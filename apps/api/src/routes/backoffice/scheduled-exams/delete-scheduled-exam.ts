/**
 * DELETE /scheduled-exams/:scheduledExamId
 * Soft-delete a scheduled exam.
 *
 * File: apps/api/src/routes/backoffice/scheduled-exams/delete-scheduled-exam.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE
 */

import { deleteScheduledExam } from '@zidney/domain-core/scheduled-exam'
import { scheduledExamIdParamSchema } from '@zidney/validation/backoffice/scheduled-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, scheduledExamErrorResponse } from './helpers'

export async function deleteScheduledExamHandler(c: Context): Promise<Response> {
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

    await deleteScheduledExam(db, scheduledExamId, audit)
    return new Response(null, { status: 204 })
  } catch (err) {
    return scheduledExamErrorResponse(c, err)
  }
}
