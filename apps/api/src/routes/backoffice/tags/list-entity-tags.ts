/**
 * Handler: GET /api/v1/backoffice/workspace/entities/:entityType/:entityId/tags
 *
 * File: apps/api/src/routes/backoffice/tags/list-entity-tags.ts
 * Stage: STAGE_32_TAGS
 */

import { listEntityTags, TagError, VALID_ENTITY_TYPES } from '@zidney/domain-core/tags'
import { createLogger } from '@zidney/logger'
import { entityParamsSchema } from '@zidney/validation/backoffice/tags.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, tagsErrorResponse } from './helpers'

const logger = createLogger('tags-route:list-entity-tags')

export async function listEntityTagsHandler(c: Context): Promise<Response> {
  try {
    const raw = {
      entityType: c.req.param('entityType'),
      entityId: c.req.param('entityId'),
    }
    const parsed = entityParamsSchema.safeParse(raw)
    if (!parsed.success) return tagsErrorResponse(c, parsed.error)

    if (!VALID_ENTITY_TYPES.includes(parsed.data.entityType)) {
      return tagsErrorResponse(c, new TagError('TAG_RELATION_INVALID_ENTITY_TYPE'))
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const items = await listEntityTags(
      db,
      { entity_type: parsed.data.entityType, entity_id: parsed.data.entityId },
      audit
    )

    logger.info('Entity tags listed via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      entity_type: parsed.data.entityType,
      entity_id: parsed.data.entityId,
      count: items.length,
    })

    return c.json(successResponse(items))
  } catch (err) {
    return tagsErrorResponse(c, err)
  }
}
