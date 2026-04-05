/**
 * Get Promocode Analytics — GET /promocodes/analytics
 *
 * File: apps/api/src/routes/backoffice/promocodes/get-promocode-analytics.ts
 * Stage: STAGE_45_PROMOCODES
 *
 * Returns aggregate analytics across all promocodes for the workspace.
 * Optional query params: from (ISO date), to (ISO date).
 */

import { randomUUID } from 'node:crypto'
import { promocodeService } from '@zidney/domain-core/promocodes'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'
import { z } from 'zod'

import { getDb, promocodeErrorResponse } from './helpers'

const logger = createLogger('backoffice-promocodes-analytics')

const analyticsQuerySchema = z.object({
  from: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  to: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
})

export async function handleGetPromocodeAnalytics(c: Context) {
  try {
    const requestId = (c.get('request_id') as string | undefined) ?? randomUUID()
    c.set('request_id', requestId)

    const parsed = analyticsQuerySchema.safeParse({
      from: c.req.query('from'),
      to: c.req.query('to'),
    })
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid query parameters',
          },
          request_id: requestId,
        },
        422
      )
    }

    const db = getDb(c)
    const filter = (parsed.data.from ?? parsed.data.to) ? parsed.data : undefined

    logger.debug('Get promocode analytics', {
      from: parsed.data.from,
      to: parsed.data.to,
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
    })

    const analytics = await promocodeService.getAnalytics(db, filter)

    return c.json({ success: true, data: { analytics }, error: null, request_id: requestId }, 200)
  } catch (err) {
    return promocodeErrorResponse(c, err)
  }
}
