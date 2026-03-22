/**
 * Handler: POST /api/v1/backoffice/workspace/category-values
 *
 * File: apps/api/src/routes/backoffice/category-values/create-category-value.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 */

import { createCategoryValue } from '@zidney/domain-core/category-values'
import { createLogger } from '@zidney/logger'
import { createCategoryValueBodySchema } from '@zidney/validation/backoffice/category-values.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, categoryValuesErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('category-values-route:create')

export async function createCategoryValueHandler(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const parsed = createCategoryValueBodySchema.safeParse(body)
    if (!parsed.success) return categoryValuesErrorResponse(c, parsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const value = await createCategoryValue(db, parsed.data, audit)

    logger.info('Category value created via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      category_value_id: value.id,
      category_id: value.category_id,
    })

    return c.json(successResponse(value), 201)
  } catch (err) {
    return categoryValuesErrorResponse(c, err)
  }
}
