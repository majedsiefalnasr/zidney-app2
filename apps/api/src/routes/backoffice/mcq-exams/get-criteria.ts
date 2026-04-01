/**
 * Handler: GET /api/v1/backoffice/workspace/mcq-exams/:examId/criteria
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/get-criteria.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 */

import { getCriteria } from '@zidney/domain-core/mcq-exams'
import { examIdParamSchema } from '@zidney/validation/backoffice/mcq-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqExamsErrorResponse, successResponse } from './helpers'

export async function getCriteriaHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqExamsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const criteria = await getCriteria(db, paramParsed.data.examId, audit)

    return c.json(successResponse(criteria), 200)
  } catch (err) {
    return mcqExamsErrorResponse(c, err)
  }
}
