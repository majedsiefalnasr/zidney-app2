/**
 * Handler: POST /api/v1/backoffice/workspace/traditional-questions/:questionId/categories
 *
 * File: apps/api/src/routes/backoffice/traditional-questions/link-category.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 */

import { linkCategory } from '@zidney/domain-core/traditional-questions'
import { createLogger } from '@zidney/logger'
import {
  linkCategoryBodySchema,
  questionIdParamSchema,
} from '@zidney/validation/backoffice/traditional-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalQuestionsErrorResponse } from './helpers'

const logger = createLogger('traditional-questions-route:link-category')

export async function linkCategoryHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = questionIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalQuestionsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = linkCategoryBodySchema.safeParse(body)
    if (!bodyParsed.success) return traditionalQuestionsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    await linkCategory(db, paramParsed.data.questionId, bodyParsed.data.categoryValueId, audit)

    logger.info('Category linked to traditional question via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      question_id: paramParsed.data.questionId,
      category_value_id: bodyParsed.data.categoryValueId,
    })

    return c.json(successResponse({ linked: true }), 201)
  } catch (err) {
    return traditionalQuestionsErrorResponse(c, err)
  }
}
