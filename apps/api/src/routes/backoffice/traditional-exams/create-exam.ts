/**
 * Handler: POST /api/v1/backoffice/workspace/traditional-exams
 *
 * File: apps/api/src/routes/backoffice/traditional-exams/create-exam.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

import { createExam } from '@zidney/domain-core/traditional-exams'
import { createLogger } from '@zidney/logger'
import { createExamBodySchema } from '@zidney/validation/backoffice/traditional-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalExamsErrorResponse } from './helpers'

const logger = createLogger('traditional-exams-route:create')

export async function createExamHandler(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const parsed = createExamBodySchema.safeParse(body)
    if (!parsed.success) return traditionalExamsErrorResponse(c, parsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const exam = await createExam(
      db,
      {
        name: parsed.data.name,
        code: parsed.data.code,
        description: parsed.data.description ?? null,
        subject_id: parsed.data.subjectId,
        division_id: parsed.data.divisionId ?? null,
        semester_id: parsed.data.semesterId ?? null,
        template_id: parsed.data.templateId,
        duration_minutes: parsed.data.durationMinutes ?? null,
        pass_percentage: parsed.data.passPercentage,
        module_type: parsed.data.moduleType,
      },
      audit
    )

    logger.info('Traditional exam created via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      exam_id: exam.id,
    })

    return c.json(successResponse(exam), 201)
  } catch (err) {
    return traditionalExamsErrorResponse(c, err)
  }
}
