/**
 * Handler: DELETE /api/v1/backoffice/workspace/traditional-questions/:questionId/categories/:categoryValueId
 *
 * File: apps/api/src/routes/backoffice/traditional-questions/unlink-category.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 */

import { unlinkCategory } from '@zidney/domain-core/traditional-questions'
import { createLogger } from '@zidney/logger'
import { questionCategoryParamSchema } from '@zidney/validation/backoffice/traditional-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalQuestionsErrorResponse } from './helpers'

const logger = createLogger('traditional-questions-route:unlink-category')

export async function unlinkCategoryHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = questionCategoryParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalQuestionsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    await unlinkCategory(db, paramParsed.data.questionId, paramParsed.data.categoryValueId, audit)

    logger.info('Category unlinked from traditional question via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      question_id: paramParsed.data.questionId,
      category_value_id: paramParsed.data.categoryValueId,
    })

    return c.json(successResponse({ deleted: true }), 200)
  } catch (err) {
    return traditionalQuestionsErrorResponse(c, err)
  }
}
