/**
 * Create Plan — POST /plans
 *
 * File: apps/api/src/routes/backoffice/plans/create-plan.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 */

import { createPlan } from '@zidney/domain-core/plans'
import { createLogger } from '@zidney/logger'
import { createPlanBodySchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, planErrorResponse } from './helpers'

const logger = createLogger('backoffice-plans-create')

export async function handleCreatePlan(c: Context) {
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

    const parsed = createPlanBodySchema.safeParse(body)
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

    logger.debug('Create plan request', {
      workspace_id: workspaceId,
      correlation_id: correlationId,
    })

    const record = await createPlan(db, { workspace_id: workspaceId, ...parsed.data }, audit)

    return c.json({ success: true, data: record, error: null, request_id: requestId }, 201)
  } catch (err) {
    return planErrorResponse(c, err)
  }
}
