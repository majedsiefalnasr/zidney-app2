/**
 * Handler: GET /api/v1/backoffice/workspace/traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId/questions
 *
 * File: apps/api/src/routes/backoffice/traditional-exams/list-subsection-questions.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

import { listSubsectionQuestions } from '@zidney/domain-core/traditional-exams'
import { subsectionIdParamSchema } from '@zidney/validation/backoffice/traditional-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalExamsErrorResponse } from './helpers'

export async function listSubsectionQuestionsHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = subsectionIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalExamsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const questions = await listSubsectionQuestions(
      db,
      paramParsed.data.examId,
      paramParsed.data.sectionId,
      paramParsed.data.subsectionId,
      audit
    )

    return c.json(successResponse(questions), 200)
  } catch (err) {
    return traditionalExamsErrorResponse(c, err)
  }
}
