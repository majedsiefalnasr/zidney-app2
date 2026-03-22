/**
 * Handler: GET /api/v1/backoffice/workspace/categories
 *
 * File: apps/api/src/routes/backoffice/categories/list-categories.ts
 * Stage: STAGE_30_CATEGORIES
 */

import { listCategories } from '@zidney/domain-core/categories'
import { createLogger } from '@zidney/logger'
import { listCategoriesQuerySchema } from '@zidney/validation/backoffice/categories.schemas'
import type { Context } from 'hono'

import { categoriesErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('categories-route:list')

export async function listCategoriesHandler(c: Context): Promise<Response> {
  try {
    const queryParsed = listCategoriesQuerySchema.safeParse(c.req.query())
    if (!queryParsed.success) return categoriesErrorResponse(c, queryParsed.error)

    const db = getDb(c)

    const result = await listCategories(db, queryParsed.data)

    logger.info('Categories listed via API', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      total: result.total,
    })

    return c.json(successResponse(result))
  } catch (err) {
    return categoriesErrorResponse(c, err)
  }
}
