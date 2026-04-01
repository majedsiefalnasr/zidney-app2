/**
 * Handler: GET /api/v1/backoffice/workspace/traditional-questions/:questionId
 *
 * File: apps/api/src/routes/backoffice/traditional-questions/get-question.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 */

import { getQuestion } from '@zidney/domain-core/traditional-questions'
import { questionIdParamSchema } from '@zidney/validation/backoffice/traditional-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalQuestionsErrorResponse } from './helpers'

export async function getQuestionHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = questionIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalQuestionsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const question = await getQuestion(db, paramParsed.data.questionId, audit)

    return c.json(successResponse(question), 200)
  } catch (err) {
    return traditionalQuestionsErrorResponse(c, err)
  }
}
