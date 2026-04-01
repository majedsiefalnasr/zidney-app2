/**
 * POST /scheduled-exams/:scheduledExamId/workflow
 * Transition workflow status (APPROVED → ENABLED).
 *
 * File: apps/api/src/routes/backoffice/scheduled-exams/workflow-transition.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE
 */

import { enableScheduledExam } from '@zidney/domain-core/scheduled-exam'
import {
  scheduledExamIdParamSchema,
  workflowTransitionSchema,
} from '@zidney/validation/backoffice/scheduled-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, scheduledExamErrorResponse, successResponse } from './helpers'

export async function workflowTransitionHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = scheduledExamIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid scheduledExamId' },
        },
        422
      )
    }

    const body = await c.req.json()
    const parsed = workflowTransitionSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid request data',
          },
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)
    const { scheduledExamId } = paramParsed.data

    // ENABLE is the only supported transition
    const result = await enableScheduledExam(db, scheduledExamId, audit)
    return c.json(successResponse(result), 200)
  } catch (err) {
    return scheduledExamErrorResponse(c, err)
  }
}
