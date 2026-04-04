/**
 * List Subscriptions — GET /subscriptions
 *
 * File: apps/api/src/routes/backoffice/subscriptions/list-subscriptions.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 */

import { listSubscriptionsService } from '@zidney/domain-core/subscriptions'
import { createLogger } from '@zidney/logger'
import { listSubscriptionsQuerySchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, subscriptionErrorResponse } from './helpers'

const logger = createLogger('backoffice-subscriptions-list')

export async function handleListSubscriptions(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const rawQuery = c.req.query()
    const parsed = listSubscriptionsQuerySchema.safeParse(rawQuery)
    if (!parsed.success) {
      const requestId = (c.get('request_id') as string | undefined) ?? null
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid query',
          },
          request_id: requestId,
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('List subscriptions request', {
      workspace_id: workspaceId,
      correlation_id: correlationId,
    })

    const result = await listSubscriptionsService(db, parsed.data, audit)

    return c.json({ success: true, data: result, error: null }, 200)
  } catch (err) {
    return subscriptionErrorResponse(c, err)
  }
}
