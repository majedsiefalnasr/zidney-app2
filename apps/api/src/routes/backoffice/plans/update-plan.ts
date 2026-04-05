/**
 * Update Plan — PATCH /plans/:id
 *
 * File: apps/api/src/routes/backoffice/plans/update-plan.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 */

import { updatePlanService } from '@zidney/domain-core/plans'
import { createLogger } from '@zidney/logger'
import { planIdParamsSchema, updatePlanBodySchema } from '@zidney/validation'
import { randomUUID } from 'crypto'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, planErrorResponse } from './helpers'

const logger = createLogger('backoffice-plans-update')

export async function handleUpdatePlan(c: Context) {
  try {
    const requestId = (c.get('request_id') as string | undefined) ?? randomUUID()
    c.set('request_id', requestId)
    const workspaceId: string = c.get('workspace_id')
    const workspaceSlug: string = c.get('workspace_slug') ?? 'unknown'
    const userId: string = c.get('userId')
    const correlationId: string = c.get('correlation_id')

    const idParsed = planIdParamsSchema.safeParse({ id: c.req.param('id') })
    if (!idParsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: idParsed.error.issues[0]?.message ?? 'Invalid id',
          },
          request_id: requestId,
        },
        422
      )
    }

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

    const parsed = updatePlanBodySchema.safeParse(body)
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

    // Reject empty PATCH payloads
    if (Object.keys(parsed.data || {}).length === 0) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Empty update payload',
          },
          request_id: requestId,
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Update plan request', {
      workspace_id: workspaceId,
      workspace_slug: workspaceSlug,
      plan_id: idParsed.data.id,
      user_id: userId,
      correlation_id: correlationId,
      request_id: requestId,
    })

    const record = await updatePlanService(db, workspaceId, idParsed.data.id, parsed.data, audit)

    return c.json({ success: true, data: record, error: null, request_id: requestId }, 200)
  } catch (err) {
    return planErrorResponse(c, err)
  }
}
