/**
 * Handler: DELETE /api/v1/backoffice/workspace/mcq-questions/:questionId/baskets/:basketId
 *
 * File: apps/api/src/routes/backoffice/mcq-questions/unlink-basket.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 */

import { unlinkBasket } from '@zidney/domain-core/mcq-questions'
import { createLogger } from '@zidney/logger'
import { questionBasketParamSchema } from '@zidney/validation/backoffice/mcq-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqQuestionsErrorResponse, successResponse } from './helpers'

const logger = createLogger('mcq-questions-route:unlink-basket')

export async function unlinkBasketHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = questionBasketParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqQuestionsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    await unlinkBasket(db, paramParsed.data.questionId, paramParsed.data.basketId, audit)

    logger.info('Basket unlinked from question via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      question_id: paramParsed.data.questionId,
      basket_id: paramParsed.data.basketId,
    })

    return c.json(successResponse({ deleted: true }), 200)
  } catch (err) {
    return mcqQuestionsErrorResponse(c, err)
  }
}
