/**
 * Handler: PATCH /api/v1/backoffice/workspace/traditional-questions/:questionId
 *
 * File: apps/api/src/routes/backoffice/traditional-questions/update-question.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 */

import { updateQuestion } from '@zidney/domain-core/traditional-questions'
import { createLogger } from '@zidney/logger'
import {
  questionIdParamSchema,
  updateQuestionBodySchema,
} from '@zidney/validation/backoffice/traditional-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalQuestionsErrorResponse } from './helpers'

const logger = createLogger('traditional-questions-route:update')

export async function updateQuestionHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = questionIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalQuestionsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = updateQuestionBodySchema.safeParse(body)
    if (!bodyParsed.success) return traditionalQuestionsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const question = await updateQuestion(
      db,
      paramParsed.data.questionId,
      {
        division_id: bodyParsed.data.divisionId,
        lesson_id: bodyParsed.data.lessonId,
        language: bodyParsed.data.language,
        content: bodyParsed.data.content,
        correct_answer: bodyParsed.data.correctAnswer,
        correction_criteria: bodyParsed.data.correctionCriteria,
        score: bodyParsed.data.score,
        updated_at: bodyParsed.data.updatedAt,
      },
      audit
    )

    logger.info('Traditional question updated via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      question_id: question.id,
    })

    return c.json(successResponse(question), 200)
  } catch (err) {
    return traditionalQuestionsErrorResponse(c, err)
  }
}
