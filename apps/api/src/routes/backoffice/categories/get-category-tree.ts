/**
 * Handler: GET /api/v1/backoffice/workspace/categories/tree
 *
 * File: apps/api/src/routes/backoffice/categories/get-category-tree.ts
 * Stage: STAGE_30_CATEGORIES
 *
 * Returns the full category forest (all categories assembled as nested tree).
 * This route MUST be registered before /categories/:id in the router to avoid
 * Hono matching "tree" as an :id param.
 */

import { getCategoriesTree } from '@zidney/domain-core/categories'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'

import { categoriesErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('categories-route:tree')

export async function getCategoryTreeHandler(c: Context): Promise<Response> {
  try {
    const db = getDb(c)

    const tree = await getCategoriesTree(db)

    logger.info('Category tree fetched via API', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      root_count: tree.length,
    })

    return c.json(successResponse(tree))
  } catch (err) {
    return categoriesErrorResponse(c, err)
  }
}
