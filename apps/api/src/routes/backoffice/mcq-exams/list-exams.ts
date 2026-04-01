/**
 * Handler: GET /api/v1/backoffice/workspace/mcq-exams
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/list-exams.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 */

import { listExams } from '@zidney/domain-core/mcq-exams'
import { listExamsQuerySchema } from '@zidney/validation/backoffice/mcq-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqExamsErrorResponse, successResponse } from './helpers'

export async function listExamsHandler(c: Context): Promise<Response> {
  try {
    const rawQuery = c.req.query()
    const parsed = listExamsQuerySchema.safeParse(rawQuery)
    if (!parsed.success) return mcqExamsErrorResponse(c, parsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await listExams(
      db,
      {
        page: parsed.data.page,
        per_page: parsed.data.per_page,
        subject_id: parsed.data.subject_id,
        division_id: parsed.data.division_id,
        selection_mode: parsed.data.selection_mode,
        status: parsed.data.status,
        search: parsed.data.search,
      },
      audit
    )

    return c.json(successResponse(result), 200)
  } catch (err) {
    return mcqExamsErrorResponse(c, err)
  }
}
