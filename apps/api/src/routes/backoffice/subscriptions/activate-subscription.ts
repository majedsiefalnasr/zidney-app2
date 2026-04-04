/**
 * Activate Subscription — POST /subscriptions
 *
 * File: apps/api/src/routes/backoffice/subscriptions/activate-subscription.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 *
 * Creates a new ACTIVE subscription for a student.
 * If the student has an existing ACTIVE subscription, it is expired first.
 * Subscription lifecycle is managed atomically in a SERIALIZABLE transaction.
 */

import { activateSubscription } from '@zidney/domain-core/subscriptions'
import { createLogger } from '@zidney/logger'
import { createSubscriptionBodySchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, subscriptionErrorResponse } from './helpers'

const logger = createLogger('backoffice-subscriptions-activate')

export async function handleActivateSubscription(c: Context) {
  try {
    const requestId = (c.get('request_id') as string | undefined) ?? null
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json(
        {
          success: false,
          data: null,
          error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
          request_id: requestId,
        },
        400
      )
    }

    const parsed = createSubscriptionBodySchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid input',
          },
          request_id: requestId,
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Activate subscription request', {
      workspace_id: workspaceId,
      student_id: parsed.data.student_id,
      plan_id: parsed.data.plan_id,
      correlation_id: correlationId,
    })

    const record = await activateSubscription(db, parsed.data, audit)

    return c.json({ success: true, data: record, error: null, request_id: requestId }, 201)
  } catch (err) {
    return subscriptionErrorResponse(c, err)
  }
}
