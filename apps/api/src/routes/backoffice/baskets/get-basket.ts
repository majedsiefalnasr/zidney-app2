/**
 * Handler: GET /api/v1/backoffice/workspace/mcq-baskets/:basketId
 *
 * File: apps/api/src/routes/backoffice/baskets/get-basket.ts
 * Stage: STAGE_33_MCQ_BASKETS
 */

import { getBasket } from '@zidney/domain-core/baskets'
import { basketIdParamSchema } from '@zidney/validation/backoffice/baskets.schemas'
import type { Context } from 'hono'

import { basketsErrorResponse, buildAuditCtx, getDb, successResponse } from './helpers'

export async function getBasketHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = basketIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return basketsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const basket = await getBasket(db, paramParsed.data.basketId, audit)

    return c.json(successResponse(basket), 200)
  } catch (err) {
    return basketsErrorResponse(c, err)
  }
}
