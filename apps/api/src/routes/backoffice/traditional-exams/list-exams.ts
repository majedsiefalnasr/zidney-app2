/**
 * Handler: GET /api/v1/backoffice/workspace/traditional-exams
 *
 * File: apps/api/src/routes/backoffice/traditional-exams/list-exams.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

import { listExams } from '@zidney/domain-core/traditional-exams'
import { listExamsQuerySchema } from '@zidney/validation/backoffice/traditional-exams.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalExamsErrorResponse } from './helpers'

export async function listExamsHandler(c: Context): Promise<Response> {
  try {
    const rawQuery = c.req.query()
    const parsed = listExamsQuerySchema.safeParse(rawQuery)
    if (!parsed.success) return traditionalExamsErrorResponse(c, parsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await listExams(
      db,
      {
        page: parsed.data.page,
        per_page: parsed.data.per_page,
        subject_id: parsed.data.subject_id,
        division_id: parsed.data.division_id,
        module_type: parsed.data.module_type,
        status: parsed.data.status,
        search: parsed.data.search,
      },
      audit
    )

    return c.json(successResponse(result), 200)
  } catch (err) {
    return traditionalExamsErrorResponse(c, err)
  }
}
