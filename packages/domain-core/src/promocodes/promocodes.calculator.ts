/**
 * Promocodes Domain — Discount Calculator
 *
 * File: packages/domain-core/src/promocodes/promocodes.calculator.ts
 * Stage: STAGE_45_PROMOCODES
 *
 * Pure function — no side effects, no I/O.
 * Client-supplied prices/values are NEVER used; all inputs come from DB rows.
 */

import type { DiscountResult, PromocodeType } from './promocodes.types'

/**
 * Calculate the discount for a given promocode type and plan price.
 *
 * Rules:
 * - PERCENTAGE: floor-round to 2 decimal places; clamp final_price to 0.
 * - FIXED:      clamp final_price to 0; discount_amount = planPrice - final_price.
 * - FREE_TRIAL: discount_amount = planPrice, final_price = 0, free_trial_days passed through.
 *
 * @param type           The promocode type.
 * @param value          Numeric value (percentage points OR fixed amount). Null for FREE_TRIAL.
 * @param freeTrialDays  Days of free trial. Null for PERCENTAGE/FIXED.
 * @param planPrice      The plan's price as a number (not the pg numeric string).
 */
export function calculateDiscount(
  type: PromocodeType,
  value: number | null,
  freeTrialDays: number | null,
  planPrice: number
): DiscountResult {
  switch (type) {
    case 'PERCENTAGE': {
      if (value === null || value === undefined) {
        throw new Error('PERCENTAGE promocode requires a numeric value')
      }
      // Floor-round at 2 decimal places to avoid floating-point creep
      const pct = value
      const raw = (planPrice * pct) / 100
      const discount_amount = Math.floor(raw * 100) / 100
      const final_price = Math.max(0, planPrice - discount_amount)
      // Normalize final_price to 2 decimals to avoid IEEE-754 precision errors
      return {
        discount_amount,
        final_price: Math.round(final_price * 100) / 100,
      }
    }

    case 'FIXED': {
      if (value === null || value === undefined) {
        throw new Error('FIXED promocode requires a numeric value')
      }
      const amt = value
      const final_price = Math.max(0, planPrice - amt)
      const discount_amount = planPrice - final_price
      // Normalize to 2 decimals to avoid floating-point creep
      return {
        discount_amount: Math.round(discount_amount * 100) / 100,
        final_price: Math.round(final_price * 100) / 100,
      }
    }

    case 'FREE_TRIAL': {
      if (freeTrialDays === null || freeTrialDays === undefined) {
        throw new Error('FREE_TRIAL promocode requires freeTrialDays')
      }
      return {
        discount_amount: planPrice,
        final_price: 0,
        free_trial_days: freeTrialDays,
      }
    }
  }
}
