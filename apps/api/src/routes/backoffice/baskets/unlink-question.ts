/**
 * Handler: DELETE /api/v1/backoffice/workspace/mcq-baskets/:basketId/questions/:questionId
 *
 * File: apps/api/src/routes/backoffice/baskets/unlink-question.ts
 * Stage: STAGE_33_MCQ_BASKETS
 */

import { unlinkQuestion } from '@zidney/domain-core/baskets'
import { createLogger } from '@zidney/logger'
import { basketQuestionParamSchema } from '@zidney/validation/backoffice/baskets.schemas'
import type { Context } from 'hono'

import { basketsErrorResponse, buildAuditCtx, getDb, successResponse } from './helpers'

const logger = createLogger('baskets-route:unlink-question')

export async function unlinkQuestionHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = basketQuestionParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return basketsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    await unlinkQuestion(db, paramParsed.data.basketId, paramParsed.data.questionId, audit)

    logger.info('Question unlinked from basket via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      basket_id: paramParsed.data.basketId,
      question_id: paramParsed.data.questionId,
    })

    return c.json(successResponse({ deleted: true }), 200)
  } catch (err) {
    return basketsErrorResponse(c, err)
  }
}
