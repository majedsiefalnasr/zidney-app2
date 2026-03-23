/**
 * Handler: GET /api/v1/backoffice/workspace/tags
 *
 * File: apps/api/src/routes/backoffice/tags/list-tags.ts
 * Stage: STAGE_32_TAGS
 */

import { listTags } from '@zidney/domain-core/tags'
import { createLogger } from '@zidney/logger'
import { listTagsQuerySchema } from '@zidney/validation/backoffice/tags.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, successResponse, tagsErrorResponse } from './helpers'

const logger = createLogger('tags-route:list')

export async function listTagsHandler(c: Context): Promise<Response> {
  try {
    const query = c.req.query()
    const parsed = listTagsQuerySchema.safeParse(query)
    if (!parsed.success) return tagsErrorResponse(c, parsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await listTags(db, parsed.data, audit)

    logger.info('Tags listed via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      total: result.total,
    })

    return c.json(successResponse(result))
  } catch (err) {
    return tagsErrorResponse(c, err)
  }
}
