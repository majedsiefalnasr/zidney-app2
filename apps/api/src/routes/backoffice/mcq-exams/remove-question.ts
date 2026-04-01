/**
 * Handler: DELETE /api/v1/backoffice/workspace/mcq-exams/:examId/questions/:questionId
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/remove-question.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 */

import { removeQuestion } from '@zidney/domain-core/mcq-exams'
import { createLogger } from '@zidney/logger'
import { examQuestionParamSchema } from '@zidney/validation/backoffice/mcq-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqExamsErrorResponse, successResponse } from './helpers'

const logger = createLogger('mcq-exams-route:remove-question')

export async function removeQuestionHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examQuestionParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqExamsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    await removeQuestion(db, paramParsed.data.examId, paramParsed.data.questionId, audit)

    logger.info('Question removed from MCQ exam via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      exam_id: paramParsed.data.examId,
      question_id: paramParsed.data.questionId,
    })

    return c.json(successResponse({ removed: true }), 200)
  } catch (err) {
    return mcqExamsErrorResponse(c, err)
  }
}
