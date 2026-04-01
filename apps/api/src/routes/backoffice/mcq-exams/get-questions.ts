/**
 * Handler: GET /api/v1/backoffice/workspace/mcq-exams/:examId/questions
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/get-questions.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 */

import { getQuestions } from '@zidney/domain-core/mcq-exams'
import { examIdParamSchema } from '@zidney/validation/backoffice/mcq-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqExamsErrorResponse, successResponse } from './helpers'

export async function getQuestionsHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqExamsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const questions = await getQuestions(db, paramParsed.data.examId, audit)

    return c.json(successResponse(questions), 200)
  } catch (err) {
    return mcqExamsErrorResponse(c, err)
  }
}
