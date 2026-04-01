/**
 * Handler: DELETE /api/v1/backoffice/workspace/traditional-questions/:questionId/tags/:tagId
 *
 * File: apps/api/src/routes/backoffice/traditional-questions/unlink-tag.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 */

import { unlinkTag } from '@zidney/domain-core/traditional-questions'
import { createLogger } from '@zidney/logger'
import { questionTagParamSchema } from '@zidney/validation/backoffice/traditional-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalQuestionsErrorResponse } from './helpers'

const logger = createLogger('traditional-questions-route:unlink-tag')

export async function unlinkTagHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = questionTagParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalQuestionsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    await unlinkTag(db, paramParsed.data.questionId, paramParsed.data.tagId, audit)

    logger.info('Tag unlinked from traditional question via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      question_id: paramParsed.data.questionId,
      tag_id: paramParsed.data.tagId,
    })

    return c.json(successResponse({ deleted: true }), 200)
  } catch (err) {
    return traditionalQuestionsErrorResponse(c, err)
  }
}
