/**
 * Handler: PATCH /api/v1/backoffice/workspace/tags/:id
 *
 * File: apps/api/src/routes/backoffice/tags/update-tag.ts
 * Stage: STAGE_32_TAGS
 */

import { updateTag } from '@zidney/domain-core/tags'
import { createLogger } from '@zidney/logger'
import { tagIdParamSchema, updateTagBodySchema } from '@zidney/validation/backoffice/tags.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, tagsErrorResponse } from './helpers'

const logger = createLogger('tags-route:update')

export async function updateTagHandler(c: Context): Promise<Response> {
  try {
    const params = c.req.param()
    const parsedParams = tagIdParamSchema.safeParse(params)
    if (!parsedParams.success) return tagsErrorResponse(c, parsedParams.error)

    const body = await c.req.json()
    const parsedBody = updateTagBodySchema.safeParse(body)
    if (!parsedBody.success) return tagsErrorResponse(c, parsedBody.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const tag = await updateTag(db, parsedParams.data.id, parsedBody.data, audit)

    logger.info('Tag updated via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      tag_id: tag.id,
    })

    return c.json(successResponse(tag))
  } catch (err) {
    return tagsErrorResponse(c, err)
  }
}
