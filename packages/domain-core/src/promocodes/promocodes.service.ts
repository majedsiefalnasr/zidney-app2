/**
 * Promocodes Domain — Service Layer
 *
 * File: packages/domain-core/src/promocodes/promocodes.service.ts
 * Stage: STAGE_45_PROMOCODES
 *
 * Business-logic entry points for the promocode system.
 *
 * Key invariants:
 * - `validatePromocode` is a fast-fail pre-check — read-only, no insertions.
 * - `applyPromocode` participates in but does NOT own the transaction.
 *   The caller (activate-subscription handler) opens the SERIALIZABLE tx and
 *   passes `tx` to this method. Atomicity between subscriptions + usages rows
 *   is guaranteed at the caller level.
 * - FOR UPDATE lock is acquired inside `applyPromocode` before re-validating
 *   under concurrency.
 * - `calculateDiscount` is the single authoritative source of discount logic.
 *
 * Constitutional Compliance:
 * ✓ No HTTP, no framework imports
 * ✓ No logging side-effects
 * ✓ Server-authoritative time (server_now from DB passed in context)
 * ✓ Client discount values are never trusted
 */

import { calculateDiscount } from './promocodes.calculator'
import { PromocodeError } from './promocodes.errors'
import {
  countTotalUsages,
  countUserUsages,
  getAnalyticsSummary,
  getPromocodeByCode,
  getPromocodeById,
  getSinglePromocodeAnalytics,
  insertUsage,
  lockPromocodeForUpdate,
  createPromocode as repoCreatePromocode,
  deactivatePromocode as repoDeactivatePromocode,
  listPromocodes as repoListPromocodes,
} from './promocodes.repository'
import type {
  AnalyticsFilter,
  AuditContext,
  DbClient,
  DiscountResult,
  ListPromocodesFilter,
  PromocodeAnalytics,
  PromocodeInput,
  PromocodeRow,
  PromocodeUsageRow,
  PromocodeValidationContext,
  SinglePromocodeAnalytics,
  TransactionClient,
} from './promocodes.types'
import { validatePromocodeApplication } from './promocodes.validator'

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class PromocodeService {
  // -------------------------------------------------------------------------
  // Admin CRUD
  // -------------------------------------------------------------------------

  /**
   * Create a new promocode.
   * Caller must normalise `input.code` to UPPERCASE before calling.
   * Throws `PromocodeError('PROMOCODE_CODE_ALREADY_EXISTS')` on duplicate code.
   */
  async createPromocode(
    db: DbClient,
    input: PromocodeInput,
    _audit: AuditContext
  ): Promise<PromocodeRow> {
    return repoCreatePromocode(db, input)
  }

  /**
   * List promocodes with optional filters and pagination.
   */
  async listPromocodes(
    db: DbClient,
    filter: ListPromocodesFilter
  ): Promise<{ rows: PromocodeRow[]; total: number }> {
    return repoListPromocodes(db, filter)
  }

  /**
   * Get a single promocode by ID together with its usage analytics.
   * Throws `PromocodeError('PROMOCODE_NOT_FOUND')` when row is null.
   */
  async getPromocode(
    db: DbClient,
    id: string
  ): Promise<{ promocode: PromocodeRow; analytics: SinglePromocodeAnalytics }> {
    const [promocode, analytics] = await Promise.all([
      getPromocodeById(db, id),
      getSinglePromocodeAnalytics(db, id),
    ])
    if (!promocode) {
      throw new PromocodeError('PROMOCODE_NOT_FOUND', `Promocode ${id} not found`)
    }
    return { promocode, analytics }
  }

  /**
   * Deactivate a promocode (idempotent — no error if already inactive).
   */
  async deactivatePromocode(db: DbClient, id: string, _audit: AuditContext): Promise<PromocodeRow> {
    return repoDeactivatePromocode(db, id)
  }

  // -------------------------------------------------------------------------
  // Validation + application (discount engine)
  // -------------------------------------------------------------------------

  /**
   * Validate a promocode application without recording usage.
   * Called OUTSIDE the transaction as a fast-fail pre-check.
   *
   * Returns `{ promocode, discountPreview }` on success.
   * Throws `PromocodeError` on validation failure.
   *
   * Note: Usage counts are loaded from the DB here for the pre-check. The
   * definitive counts are re-checked under FOR UPDATE lock inside `applyPromocode`.
   */
  async validatePromocode(
    db: DbClient,
    ctx: PromocodeValidationContext,
    planPrice: number
  ): Promise<{ promocode: PromocodeRow; discountPreview: DiscountResult }> {
    const promocode = await getPromocodeByCode(db, ctx.code)

    // We do not need real counts for the pre-check (no FOR UPDATE lock) —
    // pass 0 so the validator can still run all structural checks. The definitive
    // atomically-safe count happens in applyPromocode under a lock.
    const result = validatePromocodeApplication(promocode, ctx, 0, 0)

    if (!result.valid) {
      throw new PromocodeError(result.code, result.message)
    }

    const discountPreview = calculateDiscount(
      result.promocode.type,
      result.promocode.value !== null ? parseFloat(result.promocode.value) : null,
      result.promocode.free_trial_days,
      planPrice
    )

    return { promocode: result.promocode, discountPreview }
  }

  /**
   * Apply a promocode inside the caller's SERIALIZABLE transaction.
   *
   * Must be called AFTER the subscription row has been inserted so that
   * `subscriptionId` references a valid FK.
   *
   * Flow:
   *  1. Lock the promo row (FOR UPDATE)
   *  2. Count total + per-user usages
   *  3. Re-run full validator under lock
   *  4. Calculate discount
   *  5. Insert usage record
   *
   * @param subscriptionId  The subscription row ID that was just inserted.
   * @returns DiscountResult to be applied to the subscription price/expires_at.
   * @throws PromocodeError on any of the 9 validation checks.
   */
  async applyPromocode(
    tx: TransactionClient,
    ctx: PromocodeValidationContext,
    planPrice: number,
    subscriptionId: string
  ): Promise<{ discount: DiscountResult; usageRow: PromocodeUsageRow }> {
    // 1. Lock
    const locked = await lockPromocodeForUpdate(tx, ctx.promocodeId!)

    // 2. Count usages (parallel — both under the FOR UPDATE lock)
    const [totalUsages, userUsages] = await Promise.all([
      countTotalUsages(tx, ctx.promocodeId!),
      countUserUsages(tx, ctx.promocodeId!, ctx.student_id),
    ])

    // 3. Re-validate under lock
    const result = validatePromocodeApplication(locked, ctx, totalUsages, userUsages)
    if (!result.valid) {
      throw new PromocodeError(result.code, result.message)
    }

    // 4. Calculate discount
    const discount = calculateDiscount(
      result.promocode.type,
      result.promocode.value !== null ? parseFloat(result.promocode.value) : null,
      result.promocode.free_trial_days,
      planPrice
    )

    // 5. Insert usage record
    const usageRow = await insertUsage(tx, {
      promocode_id: ctx.promocodeId!,
      student_id: ctx.student_id,
      subscription_id: subscriptionId,
      discount_amount: discount.discount_amount,
    })

    return { discount, usageRow }
  }

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------

  /**
   * Workspace-level promo analytics summary.
   */
  async getAnalytics(db: DbClient, filter?: AnalyticsFilter): Promise<PromocodeAnalytics> {
    return getAnalyticsSummary(db, filter)
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const promocodeService = new PromocodeService()
