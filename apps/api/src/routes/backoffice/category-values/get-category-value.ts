/**
 * Handler: GET /api/v1/backoffice/workspace/category-values/:id
 *
 * File: apps/api/src/routes/backoffice/category-values/get-category-value.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 */

import { getCategoryValue } from '@zidney/domain-core/category-values'
import { createLogger } from '@zidney/logger'
import { categoryValueIdParamSchema } from '@zidney/validation/backoffice/category-values.schemas'
import type { Context } from 'hono'

import { categoryValuesErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('category-values-route:get')

export async function getCategoryValueHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = categoryValueIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return categoryValuesErrorResponse(c, paramParsed.error)

    const db = getDb(c)

    const value = await getCategoryValue(db, paramParsed.data.id)

    logger.info('Category value fetched via API', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      category_value_id: value.id,
    })

    return c.json(successResponse(value))
  } catch (err) {
    return categoryValuesErrorResponse(c, err)
  }
}
