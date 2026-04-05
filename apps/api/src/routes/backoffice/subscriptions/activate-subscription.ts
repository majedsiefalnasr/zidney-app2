/**
 * Activate Subscription — POST /subscriptions
 *
 * File: apps/api/src/routes/backoffice/subscriptions/activate-subscription.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS (updated in STAGE_45_PROMOCODES)
 *
 * Creates a new ACTIVE subscription for a student.
 * If the student has an existing ACTIVE subscription, it is expired first.
 * Subscription lifecycle is managed atomically in a SERIALIZABLE transaction.
 *
 * Promo integration (Stage 45):
 *  - If `promo_code` is supplied, it is validated before subscription creation.
 *  - After a successful subscription, a second atomic transaction applies the
 *    promocode, records the usage, and writes `price_paid` on the subscription.
 *  - If the promo application step fails the subscription remains valid but
 *    undiscounted; the promo code is NOT marked as used so the student may retry.
 */

import { randomUUID } from 'node:crypto'
import { promocodeService } from '@zidney/domain-core/promocodes'
import { activateSubscription } from '@zidney/domain-core/subscriptions'
import { createLogger } from '@zidney/logger'
import { createSubscriptionBodySchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, resolvePromoContext, subscriptionErrorResponse } from './helpers'

const logger = createLogger('backoffice-subscriptions-activate')

export async function handleActivateSubscription(c: Context) {
  try {
    const requestId = (c.get('request_id') as string | undefined) ?? randomUUID()
    c.set('request_id', requestId)
    const workspaceId: string = c.get('workspace_id')
    const workspaceSlug: string = c.get('workspace_slug') ?? 'unknown'
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

    // Enforce tenant isolation: request workspace_id must match context workspace_id
    if (parsed.data.workspace_id !== workspaceId) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'FORBIDDEN',
            message: 'Workspace ID in request does not match authenticated workspace',
          },
          request_id: requestId,
        },
        403
      )
    }

    logger.debug('Activate subscription request', {
      workspace_id: workspaceId,
      workspace_slug: workspaceSlug,
      user_id: audit.user_id,
      student_id: parsed.data.student_id,
      plan_id: parsed.data.plan_id,
      has_promo: !!parsed.data.promo_code,
      correlation_id: correlationId,
    })

    const promoCode = parsed.data.promo_code ?? null

    // -------------------------------------------------------------------------
    // Phase 1: Pre-validate promo (read-only, outside any transaction).
    // Fails fast if the code is invalid before any write occurs.
    // -------------------------------------------------------------------------
    let planPrice = 0
    let promoCtx: Awaited<ReturnType<typeof resolvePromoContext>> | null = null

    if (promoCode) {
      // resolvePromoContext also loads the plan price needed by applyPromocode
      promoCtx = await resolvePromoContext(
        db,
        promoCode,
        parsed.data.student_id,
        parsed.data.plan_id
      )

      // Re-fetch plan price from the already-loaded context
      const planPriceRow = await db.query<{ price: string }>(
        `SELECT price FROM plans WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [parsed.data.plan_id]
      )
      planPrice = parseFloat(planPriceRow.rows[0]?.price ?? '0')

      // Validate promo before writing anything
      await promocodeService.validatePromocode(db, promoCtx, planPrice)

      logger.debug('Promo pre-validation passed', {
        code: promoCode,
        correlation_id: correlationId,
      })
    }

    // -------------------------------------------------------------------------
    // Phase 2: Activate subscription (SERIALIZABLE tx inside domain function).
    // -------------------------------------------------------------------------
    const record = await activateSubscription(db, parsed.data, audit)

    // -------------------------------------------------------------------------
    // Phase 3: Apply promo (separate atomic transaction).
    // If this fails the subscription is clean; promo usage NOT recorded.
    // -------------------------------------------------------------------------
    if (promoCode && promoCtx) {
      const tx = await db.connect()
      try {
        await tx.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

        const { discount } = await promocodeService.applyPromocode(
          tx,
          promoCtx,
          planPrice,
          record.id
        )

        // Write the discounted price onto the subscription row
        await tx.query(`UPDATE subscriptions SET price_paid = $1 WHERE id = $2`, [
          discount.final_price,
          record.id,
        ])

        // For FREE_TRIAL: extend expires_at by free_trial_days
        if (discount.free_trial_days && discount.free_trial_days > 0) {
          await tx.query(
            `UPDATE subscriptions SET expires_at = expires_at + interval '1 day' * $1 WHERE id = $2`,
            [discount.free_trial_days, record.id]
          )
        }

        await tx.query('COMMIT')

        logger.info('Promo applied to subscription', {
          subscription_id: record.id,
          code: promoCode,
          discount_amount: discount.discount_amount,
          final_price: discount.final_price,
          correlation_id: correlationId,
        })
      } catch (promoErr) {
        await tx.query('ROLLBACK').catch(() => undefined)
        logger.error('Promo application failed after subscription creation', {
          subscription_id: record.id,
          code: promoCode,
          error: promoErr instanceof Error ? promoErr.message : String(promoErr),
          correlation_id: correlationId,
        })
        // Re-throw to abort the handler response — promo failure means the operation failed
        throw promoErr
      } finally {
        tx.release()
      }
    }

    return c.json({ success: true, data: record, error: null, request_id: requestId }, 201)
  } catch (err) {
    return subscriptionErrorResponse(c, err)
  }
}
