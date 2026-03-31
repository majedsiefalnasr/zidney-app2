/**
 * Handler: PATCH /api/v1/backoffice/workspace/mcq-questions/:questionId
 *
 * File: apps/api/src/routes/backoffice/mcq-questions/update-question.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 */

import { updateQuestion } from '@zidney/domain-core/mcq-questions'
import { createLogger } from '@zidney/logger'
import {
  questionIdParamSchema,
  updateQuestionBodySchema,
} from '@zidney/validation/backoffice/mcq-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqQuestionsErrorResponse, successResponse } from './helpers'

const logger = createLogger('mcq-questions-route:update')

export async function updateQuestionHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = questionIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqQuestionsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = updateQuestionBodySchema.safeParse(body)
    if (!bodyParsed.success) return mcqQuestionsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const question = await updateQuestion(
      db,
      paramParsed.data.questionId,
      {
        subject_id: bodyParsed.data.subjectId,
        division_id: bodyParsed.data.divisionId,
        lesson_id: bodyParsed.data.lessonId,
        question_type: bodyParsed.data.questionType,
        language: bodyParsed.data.language,
        content: bodyParsed.data.content,
        explanation: bodyParsed.data.explanation,
        is_revision_only: bodyParsed.data.isRevisionOnly,
        is_exam_only: bodyParsed.data.isExamOnly,
        options: bodyParsed.data.options?.map((o) => ({
          content: o.content,
          is_correct: o.isCorrect,
          order_index: o.orderIndex,
        })),
        updated_at: bodyParsed.data.updatedAt,
      },
      audit
    )

    logger.info('MCQ question updated via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      question_id: question.id,
    })

    return c.json(successResponse(question), 200)
  } catch (err) {
    return mcqQuestionsErrorResponse(c, err)
  }
}
