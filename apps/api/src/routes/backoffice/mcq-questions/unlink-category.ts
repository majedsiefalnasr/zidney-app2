/**
 * Handler: DELETE /api/v1/backoffice/workspace/mcq-questions/:questionId/categories/:categoryValueId
 *
 * File: apps/api/src/routes/backoffice/mcq-questions/unlink-category.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 */

import { unlinkCategory } from '@zidney/domain-core/mcq-questions'
import { createLogger } from '@zidney/logger'
import { questionCategoryParamSchema } from '@zidney/validation/backoffice/mcq-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqQuestionsErrorResponse, successResponse } from './helpers'

const logger = createLogger('mcq-questions-route:unlink-category')

export async function unlinkCategoryHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = questionCategoryParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqQuestionsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    await unlinkCategory(db, paramParsed.data.questionId, paramParsed.data.categoryValueId, audit)

    logger.info('Category unlinked from question via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      question_id: paramParsed.data.questionId,
      category_value_id: paramParsed.data.categoryValueId,
    })

    return c.json(successResponse({ deleted: true }), 200)
  } catch (err) {
    return mcqQuestionsErrorResponse(c, err)
  }
}
