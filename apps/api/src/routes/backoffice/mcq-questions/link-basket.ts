/**
 * Handler: POST /api/v1/backoffice/workspace/mcq-questions/:questionId/baskets
 *
 * File: apps/api/src/routes/backoffice/mcq-questions/link-basket.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 */

import { linkBasket } from '@zidney/domain-core/mcq-questions'
import { createLogger } from '@zidney/logger'
import {
  linkBasketBodySchema,
  questionIdParamSchema,
} from '@zidney/validation/backoffice/mcq-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqQuestionsErrorResponse, successResponse } from './helpers'

const logger = createLogger('mcq-questions-route:link-basket')

export async function linkBasketHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = questionIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqQuestionsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = linkBasketBodySchema.safeParse(body)
    if (!bodyParsed.success) return mcqQuestionsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    await linkBasket(db, paramParsed.data.questionId, bodyParsed.data.basketId, audit)

    logger.info('Basket linked to question via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      question_id: paramParsed.data.questionId,
      basket_id: bodyParsed.data.basketId,
    })

    return c.json(successResponse({ linked: true }), 201)
  } catch (err) {
    return mcqQuestionsErrorResponse(c, err)
  }
}
