/**
 * Get Subscription — GET /subscriptions/:id
 *
 * File: apps/api/src/routes/backoffice/subscriptions/get-subscription.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 */

import { getSubscriptionById } from '@zidney/domain-core/subscriptions'
import { createLogger } from '@zidney/logger'
import { subscriptionIdParamsSchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, subscriptionErrorResponse } from './helpers'

const logger = createLogger('backoffice-subscriptions-get')

export async function handleGetSubscription(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const parsed = subscriptionIdParamsSchema.safeParse({ id: c.req.param('id') })
    if (!parsed.success) {
      const requestId = (c.get('request_id') as string | undefined) ?? null
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid id',
          },
          request_id: requestId,
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Get subscription request', {
      workspace_id: workspaceId,
      subscription_id: parsed.data.id,
      correlation_id: correlationId,
    })

    const record = await getSubscriptionById(db, parsed.data.id, audit)

    return c.json({ success: true, data: record, error: null }, 200)
  } catch (err) {
    return subscriptionErrorResponse(c, err)
  }
}
