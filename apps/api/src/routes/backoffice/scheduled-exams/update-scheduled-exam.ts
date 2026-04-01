/**
 * PATCH /scheduled-exams/:scheduledExamId
 * Update a scheduled exam.
 *
 * File: apps/api/src/routes/backoffice/scheduled-exams/update-scheduled-exam.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE
 */

import { updateScheduledExam } from '@zidney/domain-core/scheduled-exam'
import {
  scheduledExamIdParamSchema,
  updateScheduledExamSchema,
} from '@zidney/validation/backoffice/scheduled-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, scheduledExamErrorResponse, successResponse } from './helpers'

export async function updateScheduledExamHandler(c: Context): Promise<Response> {
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

    let body: unknown
    try {
      body = await c.req.json()
    } catch (err) {
      // Handle malformed JSON (SyntaxError)
      if (err instanceof SyntaxError) {
        return c.json(
          {
            success: false,
            data: null,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request data' },
          },
          422
        )
      }
      throw err
    }

    const parsed = updateScheduledExamSchema.safeParse(body)
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

    const updated = await updateScheduledExam(db, scheduledExamId, parsed.data, audit)
    return c.json(successResponse(updated), 200)
  } catch (err) {
    return scheduledExamErrorResponse(c, err)
  }
}
