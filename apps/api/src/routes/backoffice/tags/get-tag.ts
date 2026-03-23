/**
 * Handler: GET /api/v1/backoffice/workspace/tags/:id
 *
 * File: apps/api/src/routes/backoffice/tags/get-tag.ts
 * Stage: STAGE_32_TAGS
 */

import { getTag } from '@zidney/domain-core/tags'
import { createLogger } from '@zidney/logger'
import { tagIdParamSchema } from '@zidney/validation/backoffice/tags.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, tagsErrorResponse } from './helpers'

const logger = createLogger('tags-route:get')

export async function getTagHandler(c: Context): Promise<Response> {
  try {
    const params = c.req.param()
    const parsed = tagIdParamSchema.safeParse(params)
    if (!parsed.success) return tagsErrorResponse(c, parsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const tag = await getTag(db, parsed.data.id, audit)

    logger.info('Tag retrieved via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      tag_id: tag.id,
    })

    return c.json(successResponse(tag))
  } catch (err) {
    return tagsErrorResponse(c, err)
  }
}
