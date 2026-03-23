/**
 * Handler: POST /api/v1/backoffice/workspace/mcq-baskets/:basketId/questions
 *
 * File: apps/api/src/routes/backoffice/baskets/link-question.ts
 * Stage: STAGE_33_MCQ_BASKETS
 */

import { linkQuestion } from '@zidney/domain-core/baskets'
import { createLogger } from '@zidney/logger'
import {
  basketIdParamSchema,
  linkQuestionBodySchema,
} from '@zidney/validation/backoffice/baskets.schemas'
import type { Context } from 'hono'

import { basketsErrorResponse, buildAuditCtx, getDb, successResponse } from './helpers'

const logger = createLogger('baskets-route:link-question')

export async function linkQuestionHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = basketIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return basketsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = linkQuestionBodySchema.safeParse(body)
    if (!bodyParsed.success) return basketsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const link = await linkQuestion(
      db,
      {
        basket_id: paramParsed.data.basketId,
        question_id: bodyParsed.data.questionId,
      },
      audit
    )

    logger.info('Question linked to basket via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      basket_id: paramParsed.data.basketId,
      question_id: bodyParsed.data.questionId,
    })

    return c.json(successResponse(link), 201)
  } catch (err) {
    return basketsErrorResponse(c, err)
  }
}
