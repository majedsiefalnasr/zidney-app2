/**
 * Handler: GET /api/v1/backoffice/workspace/category-values
 *
 * File: apps/api/src/routes/backoffice/category-values/list-category-values.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 */

import { listCategoryValues } from '@zidney/domain-core/category-values'
import { createLogger } from '@zidney/logger'
import { listCategoryValuesQuerySchema } from '@zidney/validation/backoffice/category-values.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, categoryValuesErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('category-values-route:list')

export async function listCategoryValuesHandler(c: Context): Promise<Response> {
  try {
    const queryParsed = listCategoryValuesQuerySchema.safeParse(c.req.query())
    if (!queryParsed.success) return categoryValuesErrorResponse(c, queryParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await listCategoryValues(db, queryParsed.data, audit)

    logger.info('Category values listed via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      category_id: queryParsed.data.category_id,
      total: result.total,
    })

    return c.json(successResponse(result))
  } catch (err) {
    return categoryValuesErrorResponse(c, err)
  }
}
