/**
 * Cancel Subscription — DELETE /subscriptions/:id
 *
 * File: apps/api/src/routes/backoffice/subscriptions/cancel-subscription.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 *
 * Cancels an ACTIVE or PENDING subscription.
 * Returns 409 SUBSCRIPTION_CANNOT_CANCEL if subscription is not in a cancellable state.
 */

import { cancelSubscriptionService } from '@zidney/domain-core/subscriptions'
import { createLogger } from '@zidney/logger'
import { subscriptionIdParamsSchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, subscriptionErrorResponse } from './helpers'

const logger = createLogger('backoffice-subscriptions-cancel')

export async function handleCancelSubscription(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const parsed = subscriptionIdParamsSchema.safeParse({ id: c.req.param('id') })
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid id',
          },
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Cancel subscription request', {
      workspace_id: workspaceId,
      subscription_id: parsed.data.id,
      correlation_id: correlationId,
    })

    await cancelSubscriptionService(db, parsed.data.id, audit)

    return c.json({ success: true, data: null, error: null }, 200)
  } catch (err) {
    return subscriptionErrorResponse(c, err)
  }
}
