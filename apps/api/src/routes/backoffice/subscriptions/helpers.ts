/**
 * Subscriptions Routes — Helpers
 *
 * File: apps/api/src/routes/backoffice/subscriptions/helpers.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 *
 * Shared utilities, context extractors, and error response builder for subscriptions routes.
 */

import type { AuditContext, DbClient } from '@zidney/domain-core/plans'
import type { PromocodeValidationContext } from '@zidney/domain-core/promocodes'
import { SUBSCRIPTION_ERROR_HTTP, SubscriptionError } from '@zidney/domain-core/subscriptions'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'

const logger = createLogger('backoffice-subscriptions')

// ---------------------------------------------------------------------------
// Database Access
// ---------------------------------------------------------------------------

export function getDb(c: Context): DbClient {
  const tenant = c.get('tenant')
  if (!tenant?.pool) {
    logger.error('Tenant pool not available in context', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
    })
    throw new Error('Tenant pool not initialized')
  }
  return tenant.pool as DbClient
}

// ---------------------------------------------------------------------------
// Audit Context
// ---------------------------------------------------------------------------

export function buildAuditCtx(c: Context): AuditContext {
  const user = c.get('user')
  if (!user?.id) {
    logger.error('User not present in context', { correlation_id: c.get('correlation_id') })
    throw new Error('User not authenticated')
  }
  const workspaceId = c.get('workspace_id')
  const workspaceSlug = c.get('workspace_slug')
  const correlationId = c.get('correlation_id')

  if (!workspaceId) throw new Error('missing workspace_id')
  if (!workspaceSlug) throw new Error('missing workspace_slug')
  if (!correlationId) throw new Error('missing correlation_id')

  return {
    user_id: user.id,
    workspace_id: workspaceId,
    workspace_slug: workspaceSlug,
    correlation_id: correlationId,
  }
}

// ---------------------------------------------------------------------------
// Promocode Context Resolution
// ---------------------------------------------------------------------------

/**
 * Resolves all context fields required to call `promocodeService.validatePromocode`
 * or `promocodeService.applyPromocode`.
 *
 * Performs four low-cost read queries against the tenant DB:
 *  1. Plan  → billing_type, price
 *  2. Student → division_id, group_id
 *  3. SELECT NOW() for server-authoritative current time
 *  4. Existing promocode usage IDs for the student (stacking / per-user limit checks)
 *
 * Throws a plain Error with a structured code string (e.g. 'PLAN_NOT_FOUND') so
 * callers can map it to an appropriate HTTP response.
 */
export async function resolvePromoContext(
  db: DbClient,
  promoCode: string,
  studentId: string,
  planId: string
): Promise<PromocodeValidationContext> {
  // 1. Plan
  const planRows = await db.query<{ billing_type: string; price: string }>(
    `SELECT billing_type, price FROM plans WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [planId]
  )
  if (planRows.rows.length === 0) {
    const err = new Error('Plan not found')
    ;(err as NodeJS.ErrnoException).code = 'PLAN_NOT_FOUND'
    throw err
  }
  const plan = planRows.rows[0]

  // 2. Student
  const studentRows = await db.query<{ division_id: string | null; group_id: string | null }>(
    `SELECT division_id, group_id FROM students WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [studentId]
  )
  if (studentRows.rows.length === 0) {
    const err = new Error('Student not found')
    ;(err as NodeJS.ErrnoException).code = 'STUDENT_NOT_FOUND'
    throw err
  }
  const student = studentRows.rows[0]

  // 3. Server-authoritative current time
  const nowRows = await db.query<{ now: Date }>(`SELECT NOW() AS now`)
  if (!nowRows.rows[0]?.now) {
    throw new Error('Failed to obtain server time from SELECT NOW()')
  }
  const serverNow = nowRows.rows[0].now

  // 4. Existing promo usage IDs for this student and their stackability
  const usedRows = await db.query<{ promocode_id: string }>(
    `SELECT DISTINCT promocode_id FROM promocode_usages WHERE student_id = $1`,
    [studentId]
  )
  const existingPromoIds = usedRows.rows.map((r) => r.promocode_id)

  // Check if any existing promo is non-stackable (for symmetric stacking validation)
  let existingPromosAreNonStackable = false
  if (existingPromoIds.length > 0) {
    const stackabilityRows = await db.query<{ is_stackable: boolean }>(
      `SELECT is_stackable FROM promocodes WHERE id = ANY($1) AND is_stackable = false LIMIT 1`,
      [existingPromoIds]
    )
    existingPromosAreNonStackable = stackabilityRows.rows.length > 0
  }

  return {
    code: promoCode.toUpperCase(),
    student_id: studentId,
    plan_id: planId,
    plan_billing_type: plan.billing_type,
    student_division_id: student.division_id,
    student_group_id: student.group_id,
    existing_promo_ids_on_subscription: existingPromoIds,
    existing_promos_are_non_stackable: existingPromosAreNonStackable,
    server_now: serverNow,
  }
}

// ---------------------------------------------------------------------------
// Error Response Mapping
// ---------------------------------------------------------------------------

export function subscriptionErrorResponse(c: Context, err: unknown) {
  const requestId = (c.get('request_id') as string | undefined) ?? null
  const workspaceSlug = c.get('workspace_slug')
  const user = c.get('user')
  const userId = user?.id

  if (err instanceof SubscriptionError) {
    const status = SUBSCRIPTION_ERROR_HTTP[err.code] as 400 | 404 | 409 | 422 | 500
    return c.json(
      {
        success: false,
        data: null,
        error: { code: err.code, message: err.message },
        request_id: requestId,
      },
      status
    )
  }

  const safeError = err instanceof Error ? err : new Error(String(err))
  logger.error('Unhandled subscriptions error', {
    message: safeError.message,
    code: (safeError as NodeJS.ErrnoException).code,
    request_id: requestId,
    workspace_slug: workspaceSlug,
    user_id: userId,
  })

  return c.json(
    {
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      request_id: requestId,
    },
    500
  )
}
