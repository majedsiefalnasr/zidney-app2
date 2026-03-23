/**
 * Handler: POST /api/v1/backoffice/workspace/mcq-baskets/:basketId/workflow/transition
 *
 * File: apps/api/src/routes/backoffice/baskets/transition-basket.ts
 * Stage: STAGE_33_MCQ_BASKETS
 *
 * Bridges RBAC permissions to workflow engine format (AD-002) before delegating to
 * the transitionStatus service function.
 */

import { transitionStatus } from '@zidney/domain-core/baskets'
import { createLogger } from '@zidney/logger'
import {
  basketIdParamSchema,
  transitionBasketBodySchema,
} from '@zidney/validation/backoffice/baskets.schemas'
import type { Context } from 'hono'

import {
  basketsErrorResponse,
  buildAuditCtx,
  buildBasketWorkflowPermissions,
  getDb,
  successResponse,
} from './helpers'

const logger = createLogger('baskets-route:transition')

export async function transitionBasketHandler(c: Context): Promise<Response> {
  try {
    const paramParsed = basketIdParamSchema.safeParse(c.req.param())
    if (!paramParsed.success) return basketsErrorResponse(c, paramParsed.error)

    const body = await c.req.json()
    const bodyParsed = transitionBasketBodySchema.safeParse(body)
    if (!bodyParsed.success) return basketsErrorResponse(c, bodyParsed.error)

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    // Bridge RBAC permissions to workflow engine permission tokens (AD-002)
    const rbacPerms = (c.get('rbacContext') as { permissions: string[] } | null)?.permissions ?? []
    const enginePermissions = buildBasketWorkflowPermissions(rbacPerms)

    const result = await transitionStatus(db, paramParsed.data.basketId, bodyParsed.data.to, {
      ...audit,
      enginePermissions,
    })

    logger.info('Basket status transitioned via API', {
      correlation_id: audit.correlation_id,
      workspace_id: audit.workspace_id,
      basket_id: paramParsed.data.basketId,
      to: bodyParsed.data.to,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return basketsErrorResponse(c, err)
  }
}
