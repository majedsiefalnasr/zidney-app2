/**
 * Handler: PATCH /api/v1/backoffice/workspace/mcq-baskets/:basketId
 *
 * File: apps/api/src/routes/backoffice/baskets/update-basket.ts
 * Stage: STAGE_33_MCQ_BASKETS
 */

import { updateBasket } from '@zidney/domain-core/baskets'
import { createLogger } from '@zidney/logger'
import {
  basketIdParamSchema,
  updateBasketBodySchema,
} from '@zidney/validation/backoffice/baskets.schemas'
import type { Context } from 'hono'

import { basketsErrorResponse, buildAuditCtx, getDb, successResponse } from './helpers'

const logger = createLogger('baskets-route:update')

export async function updateBasketHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = basketIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return basketsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = updateBasketBodySchema.safeParse(body)
    if (!bodyParsed.success) return basketsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const basket = await updateBasket(
      db,
      paramParsed.data.basketId,
      {
        name: bodyParsed.data.name,
        code: bodyParsed.data.code,
        max_questions: bodyParsed.data.maxQuestions,
        description: bodyParsed.data.description,
      },
      audit
    )

    logger.info('Basket updated via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      basket_id: basket.id,
    })

    return c.json(successResponse(basket), 200)
  } catch (err) {
    return basketsErrorResponse(c, err)
  }
}
