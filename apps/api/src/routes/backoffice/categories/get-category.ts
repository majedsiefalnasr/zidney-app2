/**
 * Handler: GET /api/v1/backoffice/workspace/categories/:id
 *
 * File: apps/api/src/routes/backoffice/categories/get-category.ts
 * Stage: STAGE_30_CATEGORIES
 */

import { getCategory } from '@zidney/domain-core/categories'
import { createLogger } from '@zidney/logger'
import { categoryIdParamSchema } from '@zidney/validation/backoffice/categories.schemas'
import type { Context } from 'hono'

import { categoriesErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('categories-route:get')

export async function getCategoryHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = categoryIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return categoriesErrorResponse(c, paramParsed.error)

    const db = getDb(c)

    const category = await getCategory(db, paramParsed.data.id)

    logger.info('Category fetched via API', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      category_id: category.id,
    })

    return c.json(successResponse(category))
  } catch (err) {
    return categoriesErrorResponse(c, err)
  }
}
