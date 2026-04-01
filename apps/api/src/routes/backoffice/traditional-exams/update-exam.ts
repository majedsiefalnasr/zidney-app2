/**
 * Handler: PATCH /api/v1/backoffice/workspace/traditional-exams/:examId
 *
 * File: apps/api/src/routes/backoffice/traditional-exams/update-exam.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

import { updateExam } from '@zidney/domain-core/traditional-exams'
import { createLogger } from '@zidney/logger'
import {
  examIdParamSchema,
  updateExamBodySchema,
} from '@zidney/validation/backoffice/traditional-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalExamsErrorResponse } from './helpers'

const logger = createLogger('traditional-exams-route:update')

export async function updateExamHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalExamsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = updateExamBodySchema.safeParse(body)
    if (!bodyParsed.success) return traditionalExamsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const exam = await updateExam(
      db,
      paramParsed.data.examId,
      {
        name: bodyParsed.data.name,
        code: bodyParsed.data.code,
        description: bodyParsed.data.description,
        subject_id: bodyParsed.data.subjectId,
        division_id: bodyParsed.data.divisionId,
        semester_id: bodyParsed.data.semesterId,
        duration_minutes: bodyParsed.data.durationMinutes,
        pass_percentage: bodyParsed.data.passPercentage,
        module_type: bodyParsed.data.moduleType,
      },
      audit
    )

    logger.info('Traditional exam updated via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      exam_id: exam.id,
    })

    return c.json(successResponse(exam), 200)
  } catch (err) {
    return traditionalExamsErrorResponse(c, err)
  }
}
