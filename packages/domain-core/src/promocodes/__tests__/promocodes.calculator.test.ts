/**
 * Discount Calculator Unit Tests — STAGE_45_PROMOCODES
 *
 * File: packages/domain-core/src/promocodes/__tests__/promocodes.calculator.test.ts
 *
 * Tests for calculateDiscount():
 *  - PERCENTAGE: normal, 100% edge case
 *  - FIXED: normal, exceeds planPrice (clamp)
 *  - FREE_TRIAL: discount matches planPrice, free_trial_days returned
 */

import { describe, expect, it } from 'vitest'

import { calculateDiscount } from '../promocodes.calculator'

describe('calculateDiscount', () => {
  // --------------------------------------------------------------------------
  // PERCENTAGE
  // --------------------------------------------------------------------------

  it('PERCENTAGE 10% on 100 → discount 10, final 90', () => {
    const result = calculateDiscount('PERCENTAGE', 10, null, 100)
    expect(result.discount_amount).toBe(10)
    expect(result.final_price).toBe(90)
    expect(result.free_trial_days).toBeUndefined()
  })

  it('PERCENTAGE 100% → final_price is 0', () => {
    const result = calculateDiscount('PERCENTAGE', 100, null, 100)
    expect(result.discount_amount).toBe(100)
    expect(result.final_price).toBe(0)
  })

  it('PERCENTAGE result is floor-rounded to 2 decimal places', () => {
    // 33% of 10 = 3.3 exactly; floor(3.3 * 100) / 100 = 3.3
    const result = calculateDiscount('PERCENTAGE', 33, null, 10)
    expect(result.discount_amount).toBe(3.3)
    expect(result.final_price).toBe(6.7)
  })

  // --------------------------------------------------------------------------
  // FIXED
  // --------------------------------------------------------------------------

  it('FIXED 30 on 100 → discount 30, final 70', () => {
    const result = calculateDiscount('FIXED', 30, null, 100)
    expect(result.discount_amount).toBe(30)
    expect(result.final_price).toBe(70)
    expect(result.free_trial_days).toBeUndefined()
  })

  it('FIXED > planPrice → final_price clamped to 0, discount = planPrice', () => {
    const result = calculateDiscount('FIXED', 200, null, 100)
    expect(result.final_price).toBe(0)
    expect(result.discount_amount).toBe(100)
  })

  // --------------------------------------------------------------------------
  // FREE_TRIAL
  // --------------------------------------------------------------------------

  it('FREE_TRIAL → final_price 0, discount = planPrice, free_trial_days returned', () => {
    const result = calculateDiscount('FREE_TRIAL', null, 30, 99)
    expect(result.discount_amount).toBe(99)
    expect(result.final_price).toBe(0)
    expect(result.free_trial_days).toBe(30)
  })

  // Edge cases
  it('PERCENTAGE 0% → no discount', () => {
    const result = calculateDiscount('PERCENTAGE', 0, null, 100)
    expect(result.discount_amount).toBe(0)
    expect(result.final_price).toBe(100)
  })

  it('FIXED 0 → no discount', () => {
    const result = calculateDiscount('FIXED', 0, null, 100)
    expect(result.discount_amount).toBe(0)
    expect(result.final_price).toBe(100)
  })

  it('planPrice 0 with FIXED discount → final_price 0', () => {
    const result = calculateDiscount('FIXED', 50, null, 0)
    expect(result.final_price).toBe(0)
    expect(result.discount_amount).toBe(0)
  })

  it('PERCENTAGE: missing value throws', () => {
    expect(() => calculateDiscount('PERCENTAGE', null, null, 10)).toThrow()
  })

  it('FIXED: missing value throws', () => {
    expect(() => calculateDiscount('FIXED', null, null, 10)).toThrow()
  })

  it('FREE_TRIAL: missing freeTrialDays throws', () => {
    expect(() => calculateDiscount('FREE_TRIAL', null, null, 10)).toThrow()
  })
})
