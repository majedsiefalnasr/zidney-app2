/**
 * Handler: GET /api/v1/backoffice/workspace/mcq-baskets/:basketId/questions
 *
 * File: apps/api/src/routes/backoffice/baskets/list-questions.ts
 * Stage: STAGE_33_MCQ_BASKETS
 */

import { listBasketQuestions } from '@zidney/domain-core/baskets'
import {
  basketIdParamSchema,
  listBasketQuestionsQuerySchema,
} from '@zidney/validation/backoffice/baskets.schemas'
import type { Context } from 'hono'

import { basketsErrorResponse, buildAuditCtx, getDb, successResponse } from './helpers'

export async function listBasketQuestionsHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = basketIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return basketsErrorResponse(c, paramParsed.error)

    const rawQuery = c.req.query()
    const queryParsed = listBasketQuestionsQuerySchema.safeParse(rawQuery)
    if (!queryParsed.success) return basketsErrorResponse(c, queryParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await listBasketQuestions(
      db,
      paramParsed.data.basketId,
      {
        page: queryParsed.data.page,
        perPage: queryParsed.data.per_page,
      },
      audit
    )

    return c.json(successResponse(result), 200)
  } catch (err) {
    return basketsErrorResponse(c, err)
  }
}
