/**
 * Handler: PATCH /api/v1/backoffice/workspace/categories/:id
 *
 * File: apps/api/src/routes/backoffice/categories/update-category.ts
 * Stage: STAGE_30_CATEGORIES
 */

import { updateCategory } from '@zidney/domain-core/categories'
import { createLogger } from '@zidney/logger'
import {
  categoryIdParamSchema,
  updateCategoryBodySchema,
} from '@zidney/validation/backoffice/categories.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, categoriesErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('categories-route:update')

export async function updateCategoryHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = categoryIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return categoriesErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = updateCategoryBodySchema.safeParse(body)
    if (!bodyParsed.success) return categoriesErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const category = await updateCategory(db, paramParsed.data.id, bodyParsed.data, audit)

    logger.info('Category updated via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      category_id: category.id,
    })

    return c.json(successResponse(category))
  } catch (err) {
    return categoriesErrorResponse(c, err)
  }
}
