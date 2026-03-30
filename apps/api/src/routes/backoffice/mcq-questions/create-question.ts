/**
 * Handler: POST /api/v1/backoffice/workspace/mcq-questions
 *
 * File: apps/api/src/routes/backoffice/mcq-questions/create-question.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 */

import { createQuestion } from '@zidney/domain-core/mcq-questions'
import { createLogger } from '@zidney/logger'
import { createQuestionBodySchema } from '@zidney/validation/backoffice/mcq-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqQuestionsErrorResponse, successResponse } from './helpers'

const logger = createLogger('mcq-questions-route:create')

export async function createQuestionHandler(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const parsed = createQuestionBodySchema.safeParse(body)
    if (!parsed.success) return mcqQuestionsErrorResponse(c, parsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const question = await createQuestion(
      db,
      {
        subject_id: parsed.data.subjectId,
        division_id: parsed.data.divisionId ?? null,
        lesson_id: parsed.data.lessonId ?? null,
        question_type: parsed.data.questionType,
        language: parsed.data.language,
        content: parsed.data.content,
        explanation: parsed.data.explanation ?? null,
        is_revision_only: parsed.data.isRevisionOnly,
        is_exam_only: parsed.data.isExamOnly,
        options: parsed.data.options.map((o) => ({
          content: o.content,
          is_correct: o.isCorrect,
          order_index: o.orderIndex,
        })),
      },
      audit
    )

    logger.info('MCQ question created via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      question_id: question.id,
    })

    return c.json(successResponse(question), 201)
  } catch (err) {
    return mcqQuestionsErrorResponse(c, err)
  }
}
