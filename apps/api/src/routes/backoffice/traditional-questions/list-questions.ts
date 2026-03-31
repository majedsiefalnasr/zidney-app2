/**
 * Handler: GET /api/v1/backoffice/workspace/traditional-questions
 *
 * File: apps/api/src/routes/backoffice/traditional-questions/list-questions.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 */

import { listQuestions } from '@zidney/domain-core/traditional-questions'
import { listQuestionsQuerySchema } from '@zidney/validation/backoffice/traditional-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalQuestionsErrorResponse } from './helpers'

export async function listQuestionsHandler(c: Context): Promise<Response> {
  try {
    const rawQuery = c.req.query()
    const parsed = listQuestionsQuerySchema.safeParse(rawQuery)
    if (!parsed.success) return traditionalQuestionsErrorResponse(c, parsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await listQuestions(
      db,
      {
        page: parsed.data.page,
        per_page: parsed.data.per_page,
        subject_id: parsed.data.subject_id,
        division_id: parsed.data.division_id,
        lesson_id: parsed.data.lesson_id,
        subsection_id: parsed.data.subsection_id,
        question_type: parsed.data.question_type,
        status: parsed.data.status,
        category_value_id: parsed.data.category_value_id,
        tag_id: parsed.data.tag_id,
        search: parsed.data.search,
      },
      audit
    )

    return c.json(successResponse(result), 200)
  } catch (err) {
    return traditionalQuestionsErrorResponse(c, err)
  }
}
