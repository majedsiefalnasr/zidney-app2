/**
 * Handler: POST /api/v1/backoffice/workspace/traditional-questions/:questionId/tags
 *
 * File: apps/api/src/routes/backoffice/traditional-questions/link-tag.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 */

import { linkTag } from '@zidney/domain-core/traditional-questions'
import { createLogger } from '@zidney/logger'
import {
  linkTagBodySchema,
  questionIdParamSchema,
} from '@zidney/validation/backoffice/traditional-questions.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, traditionalQuestionsErrorResponse } from './helpers'

const logger = createLogger('traditional-questions-route:link-tag')

export async function linkTagHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = questionIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return traditionalQuestionsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = linkTagBodySchema.safeParse(body)
    if (!bodyParsed.success) return traditionalQuestionsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    await linkTag(db, paramParsed.data.questionId, bodyParsed.data.tagId, audit)

    logger.info('Tag linked to traditional question via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      question_id: paramParsed.data.questionId,
      tag_id: bodyParsed.data.tagId,
    })

    return c.json(successResponse({ linked: true }), 201)
  } catch (err) {
    return traditionalQuestionsErrorResponse(c, err)
  }
}
