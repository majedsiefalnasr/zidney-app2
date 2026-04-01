/**
 * GET /scheduled-exams
 * List scheduled exams with pagination.
 *
 * File: apps/api/src/routes/backoffice/scheduled-exams/list-scheduled-exams.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE
 */

import { countAll, findAll } from '@zidney/domain-core/scheduled-exam'
import { listScheduledExamsQuerySchema } from '@zidney/validation/backoffice/scheduled-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, scheduledExamErrorResponse, successResponse } from './helpers'

export async function listScheduledExamsHandler(c: Context): Promise<Response> {
  try {
    const rawQuery = c.req.query()
    const parsed = listScheduledExamsQuerySchema.safeParse(rawQuery)
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid query params',
          },
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)
    const { page, per_page, ...filters } = parsed.data

    const [items, total] = await Promise.all([
      findAll(db, { ...filters, page, per_page, workspace_id: audit.workspace_id }),
      countAll(db, { ...filters, workspace_id: audit.workspace_id }),
    ])

    return c.json(
      successResponse({
        items,
        pagination: {
          page,
          per_page,
          total,
          total_pages: Math.ceil(total / per_page),
        },
      }),
      200
    )
  } catch (err) {
    return scheduledExamErrorResponse(c, err)
  }
}
