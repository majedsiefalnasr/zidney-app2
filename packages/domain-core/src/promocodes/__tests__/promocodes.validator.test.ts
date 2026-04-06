/**
 * Promocode Validator Unit Tests — STAGE_45_PROMOCODES
 *
 * File: packages/domain-core/src/promocodes/__tests__/promocodes.validator.test.ts
 *
 * Tests for validatePromocodeApplication() covering all 9 checks.
 */

import { describe, expect, it } from 'vitest'
import type { PromocodeRow, PromocodeValidationContext } from '../promocodes.types'
import { validatePromocodeApplication } from '../promocodes.validator'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROMO_ID = 'pc-00000000-0000-0000-0000-000000000001'
const PLAN_ID = 'pl-00000000-0000-0000-0000-000000000001'
const OTHER_PLAN_ID = 'pl-00000000-0000-0000-0000-000000009999'
const STUDENT_ID = 'st-00000000-0000-0000-0000-000000000001'
const DIV_ID = 'dv-00000000-0000-0000-0000-000000000001'
const GRP_ID = 'gr-00000000-0000-0000-0000-000000000001'

const NOW = new Date('2026-04-08T10:00:00Z')
const PAST = new Date('2026-01-01T00:00:00Z')
const FUTURE = new Date('2027-01-01T00:00:00Z')

function makePromo(overrides: Partial<PromocodeRow> = {}): PromocodeRow {
  return {
    id: PROMO_ID,
    code: 'SAVE10',
    type: 'PERCENTAGE',
    value: '10',
    free_trial_days: null,
    is_active: true,
    valid_from: PAST,
    valid_until: FUTURE,
    usage_limit: null,
    per_user_limit: 1,
    applies_to_plan_ids: [],
    is_stackable: true,
    target_division_ids: null,
    target_group_ids: null,
    created_at: PAST,
    updated_at: PAST,
    ...overrides,
  }
}

function makeCtx(overrides: Partial<PromocodeValidationContext> = {}): PromocodeValidationContext {
  return {
    code: 'SAVE10',
    student_id: STUDENT_ID,
    plan_id: PLAN_ID,
    plan_billing_type: 'recurring',
    student_division_id: DIV_ID,
    student_group_id: GRP_ID,
    existing_promo_ids_on_subscription: [],
    server_now: NOW,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests — 14 cases covering all 9 validator checks
// ---------------------------------------------------------------------------

describe('validatePromocodeApplication', () => {
  // Check 1 — code existence
  it('null promocode → NOT_FOUND', () => {
    const result = validatePromocodeApplication(null, makeCtx(), 0, 0)
    expect(result.valid).toBe(false)
    expect(result.code).toBe('PROMOCODE_NOT_FOUND')
  })

  // Check 2 — is_active
  it('inactive promocode → INACTIVE', () => {
    const result = validatePromocodeApplication(makePromo({ is_active: false }), makeCtx(), 0, 0)
    expect(result.valid).toBe(false)
    expect(result.code).toBe('PROMOCODE_INACTIVE')
  })

  // Check 3a — not yet valid
  it('server_now < valid_from → NOT_YET_VALID', () => {
    const result = validatePromocodeApplication(makePromo({ valid_from: FUTURE }), makeCtx(), 0, 0)
    expect(result.valid).toBe(false)
    expect(result.code).toBe('PROMOCODE_NOT_YET_VALID')
  })

  // Check 3b — expired
  it('server_now > valid_until → EXPIRED', () => {
    const result = validatePromocodeApplication(makePromo({ valid_until: PAST }), makeCtx(), 0, 0)
    expect(result.valid).toBe(false)
    expect(result.code).toBe('PROMOCODE_EXPIRED')
  })

  // Check 4 — global usage limit
  it('totalUsages >= usage_limit → USAGE_LIMIT_REACHED', () => {
    const result = validatePromocodeApplication(makePromo({ usage_limit: 100 }), makeCtx(), 100, 0)
    expect(result.valid).toBe(false)
    expect(result.code).toBe('PROMOCODE_USAGE_LIMIT_REACHED')
  })

  // Check 5 — per-user limit
  it('userUsages >= per_user_limit → PER_USER_LIMIT_REACHED', () => {
    const result = validatePromocodeApplication(makePromo({ per_user_limit: 1 }), makeCtx(), 0, 1)
    expect(result.valid).toBe(false)
    expect(result.code).toBe('PROMOCODE_PER_USER_LIMIT_REACHED')
  })

  // Check 6 — plan eligibility
  it('plan not in applies_to_plan_ids → PLAN_NOT_ELIGIBLE', () => {
    const result = validatePromocodeApplication(
      makePromo({ applies_to_plan_ids: [OTHER_PLAN_ID] }),
      makeCtx(),
      0,
      0
    )
    expect(result.valid).toBe(false)
    expect(result.code).toBe('PROMOCODE_PLAN_NOT_ELIGIBLE')
  })

  // Check 6 — empty applies_to_plan_ids means all plans eligible
  it('empty applies_to_plan_ids → any plan passes', () => {
    const result = validatePromocodeApplication(
      makePromo({ applies_to_plan_ids: [] }),
      makeCtx(),
      0,
      0
    )
    expect(result.valid).toBe(true)
  })

  // Check 7 — student targeting — division miss
  it('student division not in target_division_ids (no group targeting) → NOT_IN_TARGET', () => {
    const result = validatePromocodeApplication(
      makePromo({ target_division_ids: ['dv-other'], target_group_ids: null }),
      makeCtx({ student_division_id: DIV_ID, student_group_id: null }),
      0,
      0
    )
    expect(result.valid).toBe(false)
    expect(result.code).toBe('PROMOCODE_STUDENT_NOT_IN_TARGET')
  })

  // Check 7 — student targeting — group miss
  it('student group not in target_group_ids (no division targeting) → NOT_IN_TARGET', () => {
    const result = validatePromocodeApplication(
      makePromo({ target_division_ids: null, target_group_ids: ['gr-other'] }),
      makeCtx({ student_division_id: null, student_group_id: GRP_ID }),
      0,
      0
    )
    expect(result.valid).toBe(false)
    expect(result.code).toBe('PROMOCODE_STUDENT_NOT_IN_TARGET')
  })

  // Check 7 — no targeting = open to all
  it('null targeting arrays → all students eligible', () => {
    const result = validatePromocodeApplication(
      makePromo({ target_division_ids: null, target_group_ids: null }),
      makeCtx({ student_division_id: null, student_group_id: null }),
      0,
      0
    )
    expect(result.valid).toBe(true)
  })

  // Check 8 — stacking not allowed
  it('is_stackable false + existing promo → STACKING_NOT_ALLOWED', () => {
    const result = validatePromocodeApplication(
      makePromo({ is_stackable: false }),
      makeCtx({ existing_promo_ids_on_subscription: ['other-promo-id'] }),
      0,
      0
    )
    expect(result.valid).toBe(false)
    expect(result.code).toBe('PROMOCODE_STACKING_NOT_ALLOWED')
  })

  // Check 8 — stackable + existing promo = allowed
  it('is_stackable true + existing promo → passes', () => {
    const result = validatePromocodeApplication(
      makePromo({ is_stackable: true }),
      makeCtx({ existing_promo_ids_on_subscription: ['other-promo-id'] }),
      0,
      0
    )
    expect(result.valid).toBe(true)
  })

  // Check 9 — FREE_TRIAL + one-time billing
  it('FREE_TRIAL type + one-time billing_type → FREE_TRIAL_REQUIRES_RECURRING', () => {
    const result = validatePromocodeApplication(
      makePromo({ type: 'FREE_TRIAL', value: null, free_trial_days: 30 }),
      makeCtx({ plan_billing_type: 'one-time' }),
      0,
      0
    )
    expect(result.valid).toBe(false)
    expect(result.code).toBe('PROMOCODE_FREE_TRIAL_REQUIRES_RECURRING')
  })

  // All checks pass
  it('all valid inputs → returns { valid: true, promocode }', () => {
    const promo = makePromo()
    const result = validatePromocodeApplication(promo, makeCtx(), 0, 0)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.promocode).toBe(promo)
    }
  })
})
