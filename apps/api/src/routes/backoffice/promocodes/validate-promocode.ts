/**
 * Validate Promocode — POST /promocodes/validate
 *
 * File: apps/api/src/routes/backoffice/promocodes/validate-promocode.ts
 * Stage: STAGE_45_PROMOCODES
 *
 * Fast-fails immediately if the code is invalid before any write occurs.
 * Rate-limited at the router level (10 req / 60 s per workspace).
 */

import { randomUUID } from 'node:crypto'
import { promocodeService } from '@zidney/domain-core/promocodes'
import { createLogger } from '@zidney/logger'
import { validatePromocodeBodySchema } from '@zidney/validation'
import type { Context } from 'hono'

import { getDb, promocodeErrorResponse } from './helpers'

const logger = createLogger('backoffice-promocodes-validate')

export async function handleValidatePromocode(c: Context) {
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

    const parsed = validatePromocodeBodySchema.safeParse(body)
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

    const { code, student_id, plan_id } = parsed.data
    const db = getDb(c)

    logger.debug('Validate promocode', {
      code,
      student_id,
      plan_id,
      user_id: c.get('user_id'),
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
    })

    // 1. Load plan — need billing_type and price for validation
    const planRows = await db.query<{ billing_type: string; price: string }>(
      `SELECT billing_type, price FROM plans WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [plan_id]
    )
    if (planRows.rows.length === 0) {
      return c.json(
        {
          success: false,
          data: null,
          error: { code: 'PLAN_NOT_FOUND', message: 'Plan not found' },
          request_id: requestId,
        },
        404
      )
    }
    const plan = planRows.rows[0]

    // 2. Load student — need division_id and group_id for targeting checks
    const studentRows = await db.query<{ division_id: string | null; group_id: string | null }>(
      `SELECT division_id, group_id FROM students WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [student_id]
    )
    if (studentRows.rows.length === 0) {
      return c.json(
        {
          success: false,
          data: null,
          error: { code: 'STUDENT_NOT_FOUND', message: 'Student not found' },
          request_id: requestId,
        },
        404
      )
    }
    const student = studentRows.rows[0]

    // 3. Get server time (authoritative — do not use client Date.now())
    const nowRows = await db.query<{ now: Date }>(`SELECT NOW() AS now`)
    if (!nowRows.rows[0]?.now) {
      throw new Error('Failed to retrieve server time')
    }
    const serverNow = nowRows.rows[0].now

    // 4. Get promocode_ids already used by this student (for stacking + per-user limit checks)
    const usedRows = await db.query<{ promocode_id: string }>(
      `SELECT DISTINCT promocode_id FROM promocode_usages WHERE student_id = $1`,
      [student_id]
    )
    const existingPromoIds = usedRows.rows.map((r) => r.promocode_id)

    // 5. Build validation context and validate
    const ctx = {
      code: code.toUpperCase(),
      student_id,
      plan_id,
      plan_billing_type: plan.billing_type,
      student_division_id: student.division_id,
      student_group_id: student.group_id,
      existing_promo_ids_on_subscription: existingPromoIds,
      server_now: serverNow,
    }

    const { discountPreview } = await promocodeService.validatePromocode(
      db,
      ctx,
      parseFloat(plan.price)
    )

    return c.json(
      {
        success: true,
        data: { valid: true, discount: discountPreview },
        error: null,
        request_id: requestId,
      },
      200
    )
  } catch (err) {
    return promocodeErrorResponse(c, err)
  }
}
