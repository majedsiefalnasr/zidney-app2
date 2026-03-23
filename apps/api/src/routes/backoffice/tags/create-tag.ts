/**
 * Handler: POST /api/v1/backoffice/workspace/tags
 *
 * File: apps/api/src/routes/backoffice/tags/create-tag.ts
 * Stage: STAGE_32_TAGS
 */

import { createTag } from '@zidney/domain-core/tags'
import { createLogger } from '@zidney/logger'
import { createTagBodySchema } from '@zidney/validation/backoffice/tags.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, tagsErrorResponse } from './helpers'

const logger = createLogger('tags-route:create')

export async function createTagHandler(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const parsed = createTagBodySchema.safeParse(body)
    if (!parsed.success) return tagsErrorResponse(c, parsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const tag = await createTag(db, parsed.data, audit)

    logger.info('Tag created via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      tag_id: tag.id,
    })

    return c.json(successResponse(tag), 201)
  } catch (err) {
    return tagsErrorResponse(c, err)
  }
}
