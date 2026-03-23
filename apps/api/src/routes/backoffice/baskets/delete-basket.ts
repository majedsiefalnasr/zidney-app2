/**
 * Handler: DELETE /api/v1/backoffice/workspace/mcq-baskets/:basketId
 *
 * File: apps/api/src/routes/backoffice/baskets/delete-basket.ts
 * Stage: STAGE_33_MCQ_BASKETS
 */

import { deleteBasket } from '@zidney/domain-core/baskets'
import { createLogger } from '@zidney/logger'
import { basketIdParamSchema } from '@zidney/validation/backoffice/baskets.schemas'
import type { Context } from 'hono'

import { basketsErrorResponse, buildAuditCtx, getDb, successResponse } from './helpers'

const logger = createLogger('baskets-route:delete')

export async function deleteBasketHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = basketIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return basketsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    await deleteBasket(db, paramParsed.data.basketId, audit)

    logger.info('Basket deleted via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      basket_id: paramParsed.data.basketId,
    })

    return c.json(successResponse({ deleted: true }), 200)
  } catch (err) {
    return basketsErrorResponse(c, err)
  }
}
