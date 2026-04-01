/**
 * Handler: DELETE /api/v1/backoffice/workspace/traditional-exams/:examId
 *
 * File: apps/api/src/routes/backoffice/traditional-exams/delete-exam.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

import { deleteExam } from '@zidney/domain-core/traditional-exams'
import { createLogger } from '@zidney/logger'
import { examIdParamSchema } from '@zidney/validation/backoffice/traditional-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalExamsErrorResponse } from './helpers'

const logger = createLogger('traditional-exams-route:delete')

export async function deleteExamHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalExamsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    await deleteExam(db, paramParsed.data.examId, audit)

    logger.info('Traditional exam deleted via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      exam_id: paramParsed.data.examId,
    })

    return c.json(successResponse({ deleted: true }), 200)
  } catch (err) {
    return traditionalExamsErrorResponse(c, err)
  }
}
