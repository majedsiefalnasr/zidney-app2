/**
 * Handler: GET /api/v1/backoffice/workspace/mcq-exams/:examId/settings
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/get-settings.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 */

import { getSettings } from '@zidney/domain-core/mcq-exams'
import { examIdParamSchema } from '@zidney/validation/backoffice/mcq-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqExamsErrorResponse, successResponse } from './helpers'

export async function getSettingsHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqExamsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const settings = await getSettings(db, paramParsed.data.examId, audit)

    return c.json(successResponse(settings), 200)
  } catch (err) {
    return mcqExamsErrorResponse(c, err)
  }
}
