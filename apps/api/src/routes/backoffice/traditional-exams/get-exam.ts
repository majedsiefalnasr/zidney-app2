/**
 * Handler: GET /api/v1/backoffice/workspace/traditional-exams/:examId
 *
 * File: apps/api/src/routes/backoffice/traditional-exams/get-exam.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

import { getExam } from '@zidney/domain-core/traditional-exams'
import { examIdParamSchema } from '@zidney/validation/backoffice/traditional-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalExamsErrorResponse } from './helpers'

export async function getExamHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalExamsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const exam = await getExam(db, paramParsed.data.examId, audit)

    return c.json(successResponse(exam), 200)
  } catch (err) {
    return traditionalExamsErrorResponse(c, err)
  }
}
