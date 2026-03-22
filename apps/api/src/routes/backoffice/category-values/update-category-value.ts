/**
 * Handler: PATCH /api/v1/backoffice/workspace/category-values/:id
 *
 * File: apps/api/src/routes/backoffice/category-values/update-category-value.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 */

import { updateCategoryValue } from '@zidney/domain-core/category-values'
import { createLogger } from '@zidney/logger'
import {
  categoryValueIdParamSchema,
  updateCategoryValueBodySchema,
} from '@zidney/validation/backoffice/category-values.schemas'
import type { Context } from 'hono'

import { buildAuditCtx, categoryValuesErrorResponse, getDb, successResponse } from './helpers'

const logger = createLogger('category-values-route:update')

export async function updateCategoryValueHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = categoryValueIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return categoryValuesErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = updateCategoryValueBodySchema.safeParse(body)
    if (!bodyParsed.success) return categoryValuesErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const value = await updateCategoryValue(db, paramParsed.data.id, bodyParsed.data, audit)

    logger.info('Category value updated via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      category_value_id: value.id,
    })

    return c.json(successResponse(value))
  } catch (err) {
    return categoryValuesErrorResponse(c, err)
  }
}
