/**
 * Handler: POST /api/v1/backoffice/workspace/traditional-questions
 *
 * File: apps/api/src/routes/backoffice/traditional-questions/create-question.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 */

import { createQuestion } from '@zidney/domain-core/traditional-questions'
import { createLogger } from '@zidney/logger'
import { createQuestionBodySchema } from '@zidney/validation/backoffice/traditional-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalQuestionsErrorResponse } from './helpers'

const logger = createLogger('traditional-questions-route:create')

export async function createQuestionHandler(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const parsed = createQuestionBodySchema.safeParse(body)
    if (!parsed.success) return traditionalQuestionsErrorResponse(c, parsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const question = await createQuestion(
      db,
      {
        subject_id: parsed.data.subjectId,
        division_id: parsed.data.divisionId ?? null,
        lesson_id: parsed.data.lessonId ?? null,
        subsection_id: parsed.data.subsectionId,
        question_type: parsed.data.questionType,
        language: parsed.data.language,
        content: parsed.data.content,
        correct_answer: parsed.data.correctAnswer ?? null,
        correction_criteria: parsed.data.correctionCriteria ?? null,
        score: parsed.data.score,
      },
      audit
    )

    logger.info('Traditional question created via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      question_id: question.id,
    })

    return c.json(successResponse(question), 201)
  } catch (err) {
    return traditionalQuestionsErrorResponse(c, err)
  }
}
