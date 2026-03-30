/**
 * Handler: DELETE /api/v1/backoffice/workspace/mcq-questions/:questionId
 *
 * File: apps/api/src/routes/backoffice/mcq-questions/delete-question.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 */

import { deleteQuestion } from '@zidney/domain-core/mcq-questions'
import { createLogger } from '@zidney/logger'
import { questionIdParamSchema } from '@zidney/validation/backoffice/mcq-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqQuestionsErrorResponse, successResponse } from './helpers'

const logger = createLogger('mcq-questions-route:delete')

export async function deleteQuestionHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = questionIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqQuestionsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await deleteQuestion(db, paramParsed.data.questionId, audit)

    logger.info('MCQ question deleted via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      question_id: paramParsed.data.questionId,
      delete_type: result.deleteType,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return mcqQuestionsErrorResponse(c, err)
  }
}
