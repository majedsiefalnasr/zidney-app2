/**
 * Handler: GET /api/v1/backoffice/workspace/tags/:id/entities
 *
 * File: apps/api/src/routes/backoffice/tags/list-tag-entities.ts
 * Stage: STAGE_32_TAGS
 */

import { listTagEntities } from '@zidney/domain-core/tags'
import { createLogger } from '@zidney/logger'
import {
  listTagEntitiesQuerySchema,
  tagIdParamSchema,
} from '@zidney/validation/backoffice/tags.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, tagsErrorResponse } from './helpers'

const logger = createLogger('tags-route:list-tag-entities')

export async function listTagEntitiesHandler(c: Context): Promise<Response> {
  try {
    const params = c.req.param()
    const parsedParams = tagIdParamSchema.safeParse(params)
    if (!parsedParams.success) return tagsErrorResponse(c, parsedParams.error)

    const query = c.req.query()
    const parsedQuery = listTagEntitiesQuerySchema.safeParse(query)
    if (!parsedQuery.success) return tagsErrorResponse(c, parsedQuery.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await listTagEntities(
      db,
      {
        tag_id: parsedParams.data.id,
        entity_type: parsedQuery.data.entity_type,
        page: parsedQuery.data.page,
        limit: parsedQuery.data.limit,
      },
      audit
    )

    logger.info('Tag entities listed via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      tag_id: parsedParams.data.id,
      total: result.total,
    })

    return c.json(successResponse(result))
  } catch (err) {
    return tagsErrorResponse(c, err)
  }
}
