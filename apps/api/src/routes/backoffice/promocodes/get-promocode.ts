/**
 * Get Promocode — GET /promocodes/:id
 *
 * File: apps/api/src/routes/backoffice/promocodes/get-promocode.ts
 * Stage: STAGE_45_PROMOCODES
 */

import { randomUUID } from 'node:crypto'
import { promocodeService } from '@zidney/domain-core/promocodes'
import { createLogger } from '@zidney/logger'
import { promocodeIdParamsSchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildResponsePromocode, getDb, promocodeErrorResponse } from './helpers'

const logger = createLogger('backoffice-promocodes-get')

export async function handleGetPromocode(c: Context) {
  try {
    const requestId = (c.get('request_id') as string | undefined) ?? randomUUID()
    c.set('request_id', requestId)

    const parsed = promocodeIdParamsSchema.safeParse(c.req.param())
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid promocode id',
          },
          request_id: requestId,
        },
        422
      )
    }

    const { id } = parsed.data
    const db = getDb(c)

    logger.debug('Get promocode', {
      id,
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
    })

    const { promocode, analytics } = await promocodeService.getPromocode(db, id)

    return c.json(
      {
        success: true,
        data: { promocode: buildResponsePromocode(promocode), analytics },
        error: null,
        request_id: requestId,
      },
      200
    )
  } catch (err) {
    return promocodeErrorResponse(c, err)
  }
}
