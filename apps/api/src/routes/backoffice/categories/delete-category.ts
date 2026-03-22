/**
 * Handler: DELETE /api/v1/backoffice/workspace/categories/:id
 *
 * File: apps/api/src/routes/backoffice/categories/delete-category.ts
 * Stage: STAGE_30_CATEGORIES
 *
 * Soft-delete (status → DISABLED). Returns 204 No Content on success.
 */

import { deleteCategory } from '@zidney/domain-core/categories'
import { createLogger } from '@zidney/logger'
import { categoryIdParamSchema } from '@zidney/validation/backoffice/categories.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, categoriesErrorResponse, getDb } from './helpers'

const logger = createLogger('categories-route:delete')

export async function deleteCategoryHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = categoryIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return categoriesErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    await deleteCategory(db, paramParsed.data.id, audit)

    logger.info('Category deleted via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      category_id: paramParsed.data.id,
    })

    return new Response(null, { status: 204 })
  } catch (err) {
    return categoriesErrorResponse(c, err)
  }
}
