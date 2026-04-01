/**
 * Handler: DELETE /api/v1/backoffice/workspace/traditional-questions/:questionId
 *
 * File: apps/api/src/routes/backoffice/traditional-questions/delete-question.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 */

import { deleteQuestion } from '@zidney/domain-core/traditional-questions'
import { createLogger } from '@zidney/logger'
import { questionIdParamSchema } from '@zidney/validation/backoffice/traditional-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalQuestionsErrorResponse } from './helpers'

const logger = createLogger('traditional-questions-route:delete')

export async function deleteQuestionHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = questionIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalQuestionsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await deleteQuestion(db, paramParsed.data.questionId, audit)

    logger.info('Traditional question deleted via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      question_id: paramParsed.data.questionId,
      delete_type: result.deleteType,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return traditionalQuestionsErrorResponse(c, err)
  }
}
