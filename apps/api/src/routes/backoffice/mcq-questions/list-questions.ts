/**
 * Handler: GET /api/v1/backoffice/workspace/mcq-questions
 *
 * File: apps/api/src/routes/backoffice/mcq-questions/list-questions.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 */

import { listQuestions } from '@zidney/domain-core/mcq-questions'
import { listQuestionsQuerySchema } from '@zidney/validation/backoffice/mcq-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqQuestionsErrorResponse, successResponse } from './helpers'

export async function listQuestionsHandler(c: Context): Promise<Response> {
  try {
    const rawQuery = c.req.query()
    const parsed = listQuestionsQuerySchema.safeParse(rawQuery)
    if (!parsed.success) return mcqQuestionsErrorResponse(c, parsed.error)

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
        question_type: parsed.data.question_type,
        status: parsed.data.status,
        category_value_id: parsed.data.category_value_id,
        tag_id: parsed.data.tag_id,
        basket_id: parsed.data.basket_id,
        is_revision_only: parsed.data.is_revision_only,
        is_exam_only: parsed.data.is_exam_only,
        search: parsed.data.search,
      },
      audit
    )

    return c.json(successResponse(result), 200)
  } catch (err) {
    return mcqQuestionsErrorResponse(c, err)
  }
}
