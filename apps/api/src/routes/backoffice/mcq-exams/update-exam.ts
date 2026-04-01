/**
 * Handler: PATCH /api/v1/backoffice/workspace/mcq-exams/:examId
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/update-exam.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 */

import { updateExam } from '@zidney/domain-core/mcq-exams'
import { createLogger } from '@zidney/logger'
import {
  examIdParamSchema,
  updateExamBodySchema,
} from '@zidney/validation/backoffice/mcq-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqExamsErrorResponse, successResponse } from './helpers'

const logger = createLogger('mcq-exams-route:update')

export async function updateExamHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqExamsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = updateExamBodySchema.safeParse(body)
    if (!bodyParsed.success) return mcqExamsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const exam = await updateExam(
      db,
      paramParsed.data.examId,
      {
        name: bodyParsed.data.name,
        code: bodyParsed.data.code,
        description: bodyParsed.data.description,
        division_id: bodyParsed.data.divisionId,
        language: bodyParsed.data.language,
        total_questions: bodyParsed.data.totalQuestions,
        duration_minutes: bodyParsed.data.durationMinutes,
        pass_type: bodyParsed.data.passType,
        pass_value: bodyParsed.data.passValue,
        allow_multiple_attempts: bodyParsed.data.allowMultipleAttempts,
        selection_mode: bodyParsed.data.selectionMode,
      },
      audit
    )

    logger.info('MCQ exam updated via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      exam_id: exam.id,
    })

    return c.json(successResponse(exam), 200)
  } catch (err) {
    return mcqExamsErrorResponse(c, err)
  }
}
