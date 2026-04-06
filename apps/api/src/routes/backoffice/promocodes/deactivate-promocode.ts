/**
 * Deactivate Promocode — POST /promocodes/:id/deactivate
 *
 * File: apps/api/src/routes/backoffice/promocodes/deactivate-promocode.ts
 * Stage: STAGE_45_PROMOCODES
 *
 * Idempotent — returns 200 even if already inactive.
 */

import { randomUUID } from 'node:crypto'
import { promocodeService } from '@zidney/domain-core/promocodes'
import { createLogger } from '@zidney/logger'
import { promocodeIdParamsSchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, buildResponsePromocode, getDb, promocodeErrorResponse } from './helpers'

const logger = createLogger('backoffice-promocodes-deactivate')

export async function handleDeactivatePromocode(c: Context) {
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
    const audit = buildAuditCtx(c)

    logger.debug('Deactivate promocode', {
      id,
      request_id: requestId,
      user_id: c.get('user_id'),
      workspace_slug: c.get('workspace_slug'),
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
    })

    const updated = await promocodeService.deactivatePromocode(db, id, audit)

    return c.json(
      {
        success: true,
        data: buildResponsePromocode(updated),
        error: null,
        request_id: requestId,
      },
      200
    )
  } catch (err) {
    return promocodeErrorResponse(c, err)
  }
}
