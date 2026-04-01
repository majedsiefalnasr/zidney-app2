/**
 * Handler: POST /api/v1/backoffice/workspace/mcq-exams/:examId/questions
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/add-questions.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 */

import { addQuestions } from '@zidney/domain-core/mcq-exams'
import { createLogger } from '@zidney/logger'
import {
  addQuestionsBodySchema,
  examIdParamSchema,
} from '@zidney/validation/backoffice/mcq-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqExamsErrorResponse, successResponse } from './helpers'

const logger = createLogger('mcq-exams-route:add-questions')

export async function addQuestionsHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqExamsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = addQuestionsBodySchema.safeParse(body)
    if (!bodyParsed.success) return mcqExamsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await addQuestions(
      db,
      paramParsed.data.examId,
      {
        questions: bodyParsed.data.questions.map(
          (q: { questionId: string; orderIndex: number }) => ({
            question_id: q.questionId,
            order_index: q.orderIndex,
          })
        ),
      },
      audit
    )

    logger.info('Questions added to MCQ exam via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      exam_id: paramParsed.data.examId,
      count: bodyParsed.data.questions.length,
    })

    return c.json(successResponse(result), 201)
  } catch (err) {
    return mcqExamsErrorResponse(c, err)
  }
}
