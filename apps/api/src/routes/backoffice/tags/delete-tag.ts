/**
 * Handler: DELETE /api/v1/backoffice/workspace/tags/:id
 *
 * File: apps/api/src/routes/backoffice/tags/delete-tag.ts
 * Stage: STAGE_32_TAGS
 */

import { deleteTag } from '@zidney/domain-core/tags'
import { createLogger } from '@zidney/logger'
import { deleteTagQuerySchema, tagIdParamSchema } from '@zidney/validation/backoffice/tags.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, tagsErrorResponse } from './helpers'

const logger = createLogger('tags-route:delete')

export async function deleteTagHandler(c: Context): Promise<Response> {
  try {
    const params = c.req.param()
    const parsedParams = tagIdParamSchema.safeParse(params)
    if (!parsedParams.success) return tagsErrorResponse(c, parsedParams.error)

    const query = c.req.query()
    const parsedQuery = deleteTagQuerySchema.safeParse(query)
    if (!parsedQuery.success) return tagsErrorResponse(c, parsedQuery.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await deleteTag(db, parsedParams.data.id, parsedQuery.data.cascade_delete, audit)

    logger.info('Tag deleted via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      tag_id: parsedParams.data.id,
      cascade_delete: parsedQuery.data.cascade_delete,
      relations_removed: result.relations_removed,
    })

    return c.json(successResponse(result))
  } catch (err) {
    return tagsErrorResponse(c, err)
  }
}
