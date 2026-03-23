/**
 * Handler: GET /api/v1/backoffice/workspace/mcq-baskets
 *
 * File: apps/api/src/routes/backoffice/baskets/list-baskets.ts
 * Stage: STAGE_33_MCQ_BASKETS
 */

import { listBaskets } from '@zidney/domain-core/baskets'
import { listBasketsQuerySchema } from '@zidney/validation/backoffice/baskets.schemas'
import type { Context } from 'hono'

import { basketsErrorResponse, buildAuditCtx, getDb, successResponse } from './helpers'

export async function listBasketsHandler(c: Context): Promise<Response> {
  try {
    const rawQuery = c.req.query()
    const parsed = listBasketsQuerySchema.safeParse(rawQuery)
    if (!parsed.success) return basketsErrorResponse(c, parsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    const result = await listBaskets(
      db,
      {
        page: parsed.data.page,
        perPage: parsed.data.per_page,
        type: parsed.data.type,
        status: parsed.data.status,
        search: parsed.data.search,
      },
      audit
    )

    return c.json(successResponse(result), 200)
  } catch (err) {
    return basketsErrorResponse(c, err)
  }
}
