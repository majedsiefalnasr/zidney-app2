/**
 * Handler: DELETE /api/v1/backoffice/workspace/tag-relations/:id
 *
 * File: apps/api/src/routes/backoffice/tags/delete-tag-relation.ts
 * Stage: STAGE_32_TAGS
 */

import { deleteTagRelation } from '@zidney/domain-core/tags'
import { createLogger } from '@zidney/logger'
import { tagRelationIdParamSchema } from '@zidney/validation/backoffice/tags.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, tagsErrorResponse } from './helpers'

const logger = createLogger('tags-route:delete-relation')

export async function deleteTagRelationHandler(c: Context): Promise<Response> {
  try {
    const params = c.req.param()
    const parsed = tagRelationIdParamSchema.safeParse(params)
    if (!parsed.success) return tagsErrorResponse(c, parsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await deleteTagRelation(db, parsed.data.id, audit)

    logger.info('Tag relation deleted via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      tag_relation_id: parsed.data.id,
    })

    return c.json(successResponse(result))
  } catch (err) {
    return tagsErrorResponse(c, err)
  }
}
