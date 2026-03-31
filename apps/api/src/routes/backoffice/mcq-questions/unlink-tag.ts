/**
 * Handler: DELETE /api/v1/backoffice/workspace/mcq-questions/:questionId/tags/:tagId
 *
 * File: apps/api/src/routes/backoffice/mcq-questions/unlink-tag.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 */

import { unlinkTag } from '@zidney/domain-core/mcq-questions'
import { createLogger } from '@zidney/logger'
import { questionTagParamSchema } from '@zidney/validation/backoffice/mcq-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, mcqQuestionsErrorResponse, successResponse } from './helpers'

const logger = createLogger('mcq-questions-route:unlink-tag')

export async function unlinkTagHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = questionTagParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return mcqQuestionsErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    await unlinkTag(db, paramParsed.data.questionId, paramParsed.data.tagId, audit)

    logger.info('Tag unlinked from question via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      question_id: paramParsed.data.questionId,
      tag_id: paramParsed.data.tagId,
    })

    return c.json(successResponse({ deleted: true }), 200)
  } catch (err) {
    return mcqQuestionsErrorResponse(c, err)
  }
}
