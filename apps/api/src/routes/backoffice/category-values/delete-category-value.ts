/**
 * Handler: DELETE /api/v1/backoffice/workspace/category-values/:id
 *
 * File: apps/api/src/routes/backoffice/category-values/delete-category-value.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 *
 * Returns 200 with { deleted: true } (not 204) for idempotent soft-delete.
 * An already-deleted value also returns { deleted: true } 200 — idempotent.
 */

import { deleteCategoryValue } from '@zidney/domain-core/category-values'
import { createLogger } from '@zidney/logger'
import { categoryValueIdParamSchema } from '@zidney/validation/backoffice/category-values.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, categoryValuesErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('category-values-route:delete')

export async function deleteCategoryValueHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = categoryValueIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return categoryValuesErrorResponse(c, paramParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await deleteCategoryValue(db, paramParsed.data.id, audit)

    logger.info('Category value deleted via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      category_value_id: paramParsed.data.id,
    })

    return c.json(successResponse(result))
  } catch (err) {
    return categoryValuesErrorResponse(c, err)
  }
}
