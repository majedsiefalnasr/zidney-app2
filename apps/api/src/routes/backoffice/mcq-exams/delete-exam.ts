/**
 * Handler: DELETE /api/v1/backoffice/workspace/mcq-exams/:examId
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/delete-exam.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 */

import { deleteExam } from '@zidney/domain-core/mcq-exams'
import { createLogger } from '@zidney/logger'
import { examIdParamSchema } from '@zidney/validation/backoffice/mcq-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqExamsErrorResponse, successResponse } from './helpers'

const logger = createLogger('mcq-exams-route:delete')

export async function deleteExamHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqExamsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await deleteExam(db, paramParsed.data.examId, audit)

    logger.info('MCQ exam deleted via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      exam_id: paramParsed.data.examId,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return mcqExamsErrorResponse(c, err)
  }
}
