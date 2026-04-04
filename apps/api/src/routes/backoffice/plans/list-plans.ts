/**
 * List Plans — GET /plans
 *
 * File: apps/api/src/routes/backoffice/plans/list-plans.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 */

import { listPlansService } from '@zidney/domain-core/plans'
import { createLogger } from '@zidney/logger'
import { listPlansQuerySchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, planErrorResponse } from './helpers'

const logger = createLogger('backoffice-plans-list')

export async function handleListPlans(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const rawQuery = c.req.query()
    const parsed = listPlansQuerySchema.safeParse(rawQuery)
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

    logger.debug('List plans request', {
      workspace_id: workspaceId,
      correlation_id: correlationId,
    })

    const result = await listPlansService(db, workspaceId, parsed.data, audit)

    return c.json({ success: true, data: result, error: null }, 200)
  } catch (err) {
    return planErrorResponse(c, err)
  }
}
