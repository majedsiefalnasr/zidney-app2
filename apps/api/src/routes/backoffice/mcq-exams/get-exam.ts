/**
 * Handler: GET /api/v1/backoffice/workspace/mcq-exams/:examId
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/get-exam.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 */

import { getExam } from '@zidney/domain-core/mcq-exams'
import { examIdParamSchema } from '@zidney/validation/backoffice/mcq-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqExamsErrorResponse, successResponse } from './helpers'

export async function getExamHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqExamsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const exam = await getExam(db, paramParsed.data.examId, audit)

    return c.json(successResponse(exam), 200)
  } catch (err) {
    return mcqExamsErrorResponse(c, err)
  }
}
