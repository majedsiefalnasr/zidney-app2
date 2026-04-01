/**
 * POST /scheduled-exams/:scheduledExamId/re-approve
 * Re-approve a scheduled exam after base exam modification.
 *
 * File: apps/api/src/routes/backoffice/scheduled-exams/re-approve.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE
 */

import { reApproveScheduledExam } from '@zidney/domain-core/scheduled-exam'
import { scheduledExamIdParamSchema } from '@zidney/validation/backoffice/scheduled-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, scheduledExamErrorResponse, successResponse } from './helpers'

export async function reApproveHandler(c: Context): Promise<Response> {
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

    const result = await reApproveScheduledExam(db, scheduledExamId, audit)
    return c.json(successResponse(result), 200)
  } catch (err) {
    return scheduledExamErrorResponse(c, err)
  }
}
