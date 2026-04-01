/**
 * Handler: DELETE /api/v1/backoffice/workspace/traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId/questions/:questionId
 *
 * File: apps/api/src/routes/backoffice/traditional-exams/remove-question.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

import { removeQuestion } from '@zidney/domain-core/traditional-exams'
import { questionIdParamSchema } from '@zidney/validation/backoffice/traditional-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalExamsErrorResponse } from './helpers'

export async function removeQuestionHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = questionIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalExamsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    await removeQuestion(
      db,
      paramParsed.data.examId,
      paramParsed.data.sectionId,
      paramParsed.data.subsectionId,
      paramParsed.data.questionId,
      audit
    )

    return c.json(successResponse({ deleted: true }), 200)
  } catch (err) {
    return traditionalExamsErrorResponse(c, err)
  }
}
