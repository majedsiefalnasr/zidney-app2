/**
 * Handler: POST /api/v1/backoffice/workspace/traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId/questions
 *
 * File: apps/api/src/routes/backoffice/traditional-exams/assign-questions.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

import { assignQuestions } from '@zidney/domain-core/traditional-exams'
import {
  assignQuestionsBodySchema,
  subsectionIdParamSchema,
} from '@zidney/validation/backoffice/traditional-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalExamsErrorResponse } from './helpers'

export async function assignQuestionsHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = subsectionIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalExamsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = assignQuestionsBodySchema.safeParse(body)
    if (!bodyParsed.success) return traditionalExamsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const questions = bodyParsed.data.questions.map((q) => ({
      question_id: q.questionId,
      score: q.score,
    }))

    const result = await assignQuestions(
      db,
      paramParsed.data.examId,
      paramParsed.data.sectionId,
      paramParsed.data.subsectionId,
      questions,
      audit
    )

    return c.json(successResponse(result), 201)
  } catch (err) {
    return traditionalExamsErrorResponse(c, err)
  }
}
