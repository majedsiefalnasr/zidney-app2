/**
 * Handler: GET /api/v1/backoffice/workspace/mcq-questions/:questionId
 *
 * File: apps/api/src/routes/backoffice/mcq-questions/get-question.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 */

import { getQuestion } from '@zidney/domain-core/mcq-questions'
import { questionIdParamSchema } from '@zidney/validation/backoffice/mcq-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqQuestionsErrorResponse, successResponse } from './helpers'

export async function getQuestionHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = questionIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqQuestionsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const question = await getQuestion(db, paramParsed.data.questionId, audit)

    return c.json(successResponse(question), 200)
  } catch (err) {
    return mcqQuestionsErrorResponse(c, err)
  }
}
