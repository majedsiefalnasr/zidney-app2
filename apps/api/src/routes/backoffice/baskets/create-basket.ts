/**
 * Handler: POST /api/v1/backoffice/workspace/mcq-baskets
 *
 * File: apps/api/src/routes/backoffice/baskets/create-basket.ts
 * Stage: STAGE_33_MCQ_BASKETS
 */

import { createBasket } from '@zidney/domain-core/baskets'
import { createLogger } from '@zidney/logger'
import { createBasketBodySchema } from '@zidney/validation/backoffice/baskets.schemas'
import type { Context } from 'hono'

import { basketsErrorResponse, buildAuditCtx, getDb, successResponse } from './helpers'

const logger = createLogger('baskets-route:create')

export async function createBasketHandler(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const parsed = createBasketBodySchema.safeParse(body)
    if (!parsed.success) return basketsErrorResponse(c, parsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const basket = await createBasket(
      db,
      {
        name: parsed.data.name,
        code: parsed.data.code,
        type: parsed.data.type,
        max_questions: parsed.data.maxQuestions ?? null,
        description: parsed.data.description ?? null,
      },
      audit
    )

    logger.info('Basket created via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      basket_id: basket.id,
    })

    return c.json(successResponse(basket), 201)
  } catch (err) {
    return basketsErrorResponse(c, err)
  }
}
