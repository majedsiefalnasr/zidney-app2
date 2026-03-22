/**
 * Handler: POST /api/v1/backoffice/workspace/categories
 *
 * File: apps/api/src/routes/backoffice/categories/create-category.ts
 * Stage: STAGE_30_CATEGORIES
 */

import { createCategory } from '@zidney/domain-core/categories'
import { createLogger } from '@zidney/logger'
import { createCategoryBodySchema } from '@zidney/validation/backoffice/categories.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, categoriesErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('categories-route:create')

export async function createCategoryHandler(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const parsed = createCategoryBodySchema.safeParse(body)
    if (!parsed.success) return categoriesErrorResponse(c, parsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const category = await createCategory(db, parsed.data, audit)

    logger.info('Category created via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      category_id: category.id,
    })

    return c.json(successResponse(category), 201)
  } catch (err) {
    return categoriesErrorResponse(c, err)
  }
}
