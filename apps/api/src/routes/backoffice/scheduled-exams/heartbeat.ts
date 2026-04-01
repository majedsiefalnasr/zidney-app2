/**
 * POST /scheduled-exams/attempts/:attemptId/heartbeat
 * Student heartbeat to keep scheduled attempt alive.
 *
 * File: apps/api/src/routes/backoffice/scheduled-exams/heartbeat.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE
 */

import { recordHeartbeat } from '@zidney/domain-core/scheduled-exam'
import { attemptIdParamSchema } from '@zidney/validation/backoffice/scheduled-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, scheduledExamErrorResponse, successResponse } from './helpers'

export async function heartbeatHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = attemptIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid attemptId' },
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)
    const { attemptId } = paramParsed.data

    const result = await recordHeartbeat(db, attemptId, audit)
    return c.json(successResponse(result), 200)
  } catch (err) {
    return scheduledExamErrorResponse(c, err)
  }
}
