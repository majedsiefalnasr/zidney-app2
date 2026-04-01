/**
 * GET /scheduled-exams/:scheduledExamId
 * Get a single scheduled exam by ID.
 *
 * File: apps/api/src/routes/backoffice/scheduled-exams/get-scheduled-exam.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE
 */

import {
  countAttempts,
  findById,
  SCHEDULED_EXAM_ERROR_CODES,
} from '@zidney/domain-core/scheduled-exam'
import { scheduledExamIdParamSchema } from '@zidney/validation/backoffice/scheduled-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, scheduledExamErrorResponse, successResponse } from './helpers'

export async function getScheduledExamHandler(c: Context): Promise<Response> {
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

    const db = getDb(c)
    const audit = buildAuditCtx(c)
    const { scheduledExamId } = paramParsed.data

    const [exam, attempts_count] = await Promise.all([
      findById(db, scheduledExamId, audit.workspace_id),
      countAttempts(db, scheduledExamId),
    ])

    if (!exam) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: SCHEDULED_EXAM_ERROR_CODES.NOT_FOUND,
            message: 'Scheduled exam not found',
          },
        },
        404
      )
    }

    return c.json(successResponse({ ...exam, attempts_count }), 200)
  } catch (err) {
    return scheduledExamErrorResponse(c, err)
  }
}
