/**
 * Get Plan — GET /plans/:id
 *
 * File: apps/api/src/routes/backoffice/plans/get-plan.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 */

import { getPlanById } from '@zidney/domain-core/plans'
import { createLogger } from '@zidney/logger'
import { planIdParamsSchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, planErrorResponse } from './helpers'

const logger = createLogger('backoffice-plans-get')

export async function handleGetPlan(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const parsed = planIdParamsSchema.safeParse({ id: c.req.param('id') })
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

    logger.debug('Get plan request', {
      workspace_id: workspaceId,
      plan_id: parsed.data.id,
      correlation_id: correlationId,
    })

    const record = await getPlanById(db, workspaceId, parsed.data.id, audit)

    return c.json({ success: true, data: record, error: null }, 200)
  } catch (err) {
    return planErrorResponse(c, err)
  }
}
