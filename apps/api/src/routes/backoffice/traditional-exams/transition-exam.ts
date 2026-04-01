/**
 * Handler: POST /api/v1/backoffice/workspace/traditional-exams/:examId/workflow/transition
 *
 * File: apps/api/src/routes/backoffice/traditional-exams/transition-exam.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 *
 * Uses the custom status machine in domain-core (not the shared workflow engine).
 */

import { transitionExam } from '@zidney/domain-core/traditional-exams'
import { createLogger } from '@zidney/logger'
import {
  examIdParamSchema,
  transitionBodySchema,
} from '@zidney/validation/backoffice/traditional-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalExamsErrorResponse } from './helpers'

const logger = createLogger('traditional-exams-route:transition')

export async function transitionExamHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = examIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalExamsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = transitionBodySchema.safeParse(body)
    if (!bodyParsed.success) return traditionalExamsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await transitionExam(
      db,
      paramParsed.data.examId,
      bodyParsed.data.to,
      audit,
      bodyParsed.data.reason
    )

    logger.info('Traditional exam status transitioned via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      exam_id: paramParsed.data.examId,
      to: bodyParsed.data.to,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return traditionalExamsErrorResponse(c, err)
  }
}
