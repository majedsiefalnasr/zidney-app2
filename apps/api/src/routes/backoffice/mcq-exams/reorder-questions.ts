/**
 * Handler: PUT /api/v1/backoffice/workspace/mcq-exams/:examId/questions/reorder
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/reorder-questions.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 */

import { reorderQuestions } from '@zidney/domain-core/mcq-exams'
import { createLogger } from '@zidney/logger'
import {
  examIdParamSchema,
  reorderQuestionsBodySchema,
} from '@zidney/validation/backoffice/mcq-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqExamsErrorResponse, successResponse } from './helpers'

const logger = createLogger('mcq-exams-route:reorder-questions')

export async function reorderQuestionsHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqExamsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = reorderQuestionsBodySchema.safeParse(body)
    if (!bodyParsed.success) return mcqExamsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await reorderQuestions(
      db,
      paramParsed.data.examId,
      {
        order: bodyParsed.data.order.map((entry: { questionId: string; orderIndex: number }) => ({
          question_id: entry.questionId,
          order_index: entry.orderIndex,
        })),
      },
      audit
    )

    logger.info('MCQ exam questions reordered via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      exam_id: paramParsed.data.examId,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return mcqExamsErrorResponse(c, err)
  }
}
