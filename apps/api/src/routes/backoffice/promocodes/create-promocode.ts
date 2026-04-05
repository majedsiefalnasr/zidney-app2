/**
 * Create Promocode — POST /promocodes
 *
 * File: apps/api/src/routes/backoffice/promocodes/create-promocode.ts
 * Stage: STAGE_45_PROMOCODES
 */

import { randomUUID } from 'node:crypto'
import { promocodeService } from '@zidney/domain-core/promocodes'
import { createLogger } from '@zidney/logger'
import { createPromocodeBodySchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, buildResponsePromocode, getDb, promocodeErrorResponse } from './helpers'

const logger = createLogger('backoffice-promocodes-create')

export async function handleCreatePromocode(c: Context) {
  try {
    const requestId = (c.get('request_id') as string | undefined) ?? randomUUID()
    c.set('request_id', requestId)

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

    const parsed = createPromocodeBodySchema.safeParse(body)
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

    // Normalise code to UPPERCASE before passing to service
    const input = {
      ...parsed.data,
      code: parsed.data.code.toUpperCase(),
      value: parsed.data.value ?? undefined,
      free_trial_days: parsed.data.free_trial_days ?? undefined,
      usage_limit: parsed.data.usage_limit ?? undefined,
      per_user_limit: parsed.data.per_user_limit ?? undefined,
      applies_to_plan_ids: parsed.data.applies_to_plan_ids ?? undefined,
      target_division_ids: parsed.data.target_division_ids ?? undefined,
      target_group_ids: parsed.data.target_group_ids ?? undefined,
    }

    logger.debug('Create promocode', {
      code: input.code,
      type: input.type,
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
    })

    const created = await promocodeService.createPromocode(db, input, audit)

    return c.json(
      { success: true, data: buildResponsePromocode(created), error: null, request_id: requestId },
      201
    )
  } catch (err) {
    return promocodeErrorResponse(c, err)
  }
}
