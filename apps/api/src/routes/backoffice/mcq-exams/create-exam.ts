/**
 * Handler: POST /api/v1/backoffice/workspace/mcq-exams
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/create-exam.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 */

import { createExam } from '@zidney/domain-core/mcq-exams'
import { createLogger } from '@zidney/logger'
import { createExamBodySchema } from '@zidney/validation/backoffice/mcq-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqExamsErrorResponse, successResponse } from './helpers'

const logger = createLogger('mcq-exams-route:create')

export async function createExamHandler(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const parsed = createExamBodySchema.safeParse(body)
    if (!parsed.success) return mcqExamsErrorResponse(c, parsed.error)

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
        language: parsed.data.language,
        total_questions: parsed.data.totalQuestions,
        duration_minutes: parsed.data.durationMinutes ?? null,
        pass_type: parsed.data.passType,
        pass_value: parsed.data.passValue,
        allow_multiple_attempts: parsed.data.allowMultipleAttempts,
        selection_mode: parsed.data.selectionMode,
      },
      audit
    )

    logger.info('MCQ exam created via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      exam_id: exam.id,
    })

    return c.json(successResponse(exam), 201)
  } catch (err) {
    return mcqExamsErrorResponse(c, err)
  }
}
