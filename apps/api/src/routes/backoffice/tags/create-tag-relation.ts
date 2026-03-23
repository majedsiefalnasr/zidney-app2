/**
 * Handler: POST /api/v1/backoffice/workspace/tag-relations
 *
 * File: apps/api/src/routes/backoffice/tags/create-tag-relation.ts
 * Stage: STAGE_32_TAGS
 */

import { createTagRelation } from '@zidney/domain-core/tags'
import { createLogger } from '@zidney/logger'
import { createTagRelationBodySchema } from '@zidney/validation/backoffice/tags.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, tagsErrorResponse } from './helpers'

const logger = createLogger('tags-route:create-relation')

export async function createTagRelationHandler(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const parsed = createTagRelationBodySchema.safeParse(body)
    if (!parsed.success) return tagsErrorResponse(c, parsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const relation = await createTagRelation(db, parsed.data, audit)

    logger.info('Tag relation created via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      tag_relation_id: relation.id,
      tag_id: relation.tag_id,
      entity_type: relation.entity_type,
      entity_id: relation.entity_id,
    })

    return c.json(successResponse(relation), 201)
  } catch (err) {
    return tagsErrorResponse(c, err)
  }
}
