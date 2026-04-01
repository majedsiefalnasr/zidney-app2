/**
 * Handler: PUT /api/v1/backoffice/workspace/traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId/questions/reorder
 *
 * File: apps/api/src/routes/backoffice/traditional-exams/reorder-questions.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

import { reorderQuestions } from '@zidney/domain-core/traditional-exams'
import {
  reorderQuestionsBodySchema,
  subsectionIdParamSchema,
} from '@zidney/validation/backoffice/traditional-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalExamsErrorResponse } from './helpers'

export async function reorderQuestionsHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = subsectionIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalExamsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = reorderQuestionsBodySchema.safeParse(body)
    if (!bodyParsed.success) return traditionalExamsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await reorderQuestions(
      db,
      paramParsed.data.examId,
      paramParsed.data.sectionId,
      paramParsed.data.subsectionId,
      bodyParsed.data.questionIds,
      audit
    )

    return c.json(successResponse(result), 200)
  } catch (err) {
    return traditionalExamsErrorResponse(c, err)
  }
}
