/**
 * Promocodes Domain — Validation Engine
 *
 * File: packages/domain-core/src/promocodes/promocodes.validator.ts
 * Stage: STAGE_45_PROMOCODES
 *
 * Pure function — no async, no I/O.
 * All DB reads (usages counts, FOR UPDATE lock) are done by the caller
 * and passed in as arguments.
 *
 * Check order (fail-fast):
 *  1. Code existence
 *  2. is_active flag
 *  3a. valid_from window (NOT_YET_VALID)
 *  3b. valid_until window (EXPIRED)
 *  4. Global usage_limit
 *  5. Per-user per_user_limit
 *  6. Plan eligibility (applies_to_plan_ids)
 *  7. Student targeting (target_division_ids / target_group_ids)
 *  8. Stacking policy
 *  9. FREE_TRIAL billing-type requirement
 */

import type { PromocodeRow, PromocodeValidationContext, ValidatorResult } from './promocodes.types'

/**
 * Validate whether a promocode can be applied in the given context.
 *
 * @param promocode         The locked promo row (or null if not found).
 * @param ctx               All context required for the 9 checks (server-authoritative).
 * @param totalUsages       Total redemption count (from DB, inside tx).
 * @param userUsages        Per-student redemption count (from DB, inside tx).
 */
export function validatePromocodeApplication(
  promocode: PromocodeRow | null,
  ctx: PromocodeValidationContext,
  totalUsages: number,
  userUsages: number
): ValidatorResult {
  // Check 1 — code exists
  if (!promocode) {
    return {
      valid: false,
      code: 'PROMOCODE_NOT_FOUND',
      message: `Promocode '${ctx.code}' not found`,
    }
  }

  // Check 2 — is_active
  if (!promocode.is_active) {
    return {
      valid: false,
      code: 'PROMOCODE_INACTIVE',
      message: 'This promocode is no longer active',
    }
  }

  // Check 3a — not yet valid
  if (ctx.server_now < promocode.valid_from) {
    return {
      valid: false,
      code: 'PROMOCODE_NOT_YET_VALID',
      message: 'This promocode is not yet valid',
    }
  }

  // Check 3b — expired
  if (ctx.server_now > promocode.valid_until) {
    return {
      valid: false,
      code: 'PROMOCODE_EXPIRED',
      message: 'This promocode has expired',
    }
  }

  // Check 4 — global usage limit
  if (promocode.usage_limit !== null && totalUsages >= promocode.usage_limit) {
    return {
      valid: false,
      code: 'PROMOCODE_USAGE_LIMIT_REACHED',
      message: 'This promocode has reached its total usage limit',
    }
  }

  // Check 5 — per-user limit
  if (userUsages >= promocode.per_user_limit) {
    return {
      valid: false,
      code: 'PROMOCODE_PER_USER_LIMIT_REACHED',
      message: 'You have reached the per-user usage limit for this promocode',
    }
  }

  // Check 6 — plan eligibility
  if (
    promocode.applies_to_plan_ids.length > 0 &&
    !promocode.applies_to_plan_ids.includes(ctx.plan_id)
  ) {
    return {
      valid: false,
      code: 'PROMOCODE_PLAN_NOT_ELIGIBLE',
      message: 'This promocode is not valid for the selected plan',
    }
  }

  // Check 7 — student targeting
  const hasDivisionTargeting =
    promocode.target_division_ids !== null && promocode.target_division_ids.length > 0
  const hasGroupTargeting =
    promocode.target_group_ids !== null && promocode.target_group_ids.length > 0

  if (hasDivisionTargeting || hasGroupTargeting) {
    const inTargetDivision =
      hasDivisionTargeting &&
      ctx.student_division_id !== null &&
      (promocode.target_division_ids as string[]).includes(ctx.student_division_id)

    const inTargetGroup =
      hasGroupTargeting &&
      ctx.student_group_id !== null &&
      (promocode.target_group_ids as string[]).includes(ctx.student_group_id)

    if (!inTargetDivision && !inTargetGroup) {
      return {
        valid: false,
        code: 'PROMOCODE_STUDENT_NOT_IN_TARGET',
        message: 'This promocode is not available for your account',
      }
    }
  }

  // Check 8 — stacking policy (symmetric: bidirectional check)
  // Reject if incoming promo is non-stackable AND existing promos exist
  if (!promocode.is_stackable && ctx.existing_promo_ids_on_subscription.length > 0) {
    return {
      valid: false,
      code: 'PROMOCODE_STACKING_NOT_ALLOWED',
      message: 'This promocode cannot be combined with other promotions',
    }
  }
  // Reject if incoming promo IS stackable but ANY existing promo is non-stackable
  // (to prevent stackable code from layering on non-stackable existing promo)
  if (
    promocode.is_stackable &&
    ctx.existing_promo_ids_on_subscription.length > 0 &&
    ctx.existing_promos_are_non_stackable
  ) {
    return {
      valid: false,
      code: 'PROMOCODE_STACKING_NOT_ALLOWED',
      message: 'This promocode cannot be combined with the existing non-stackable promotion',
    }
  }

  // Check 9 — FREE_TRIAL requires recurring billing
  if (promocode.type === 'FREE_TRIAL' && ctx.plan_billing_type !== 'recurring') {
    return {
      valid: false,
      code: 'PROMOCODE_FREE_TRIAL_REQUIRES_RECURRING',
      message: 'Free trial promocodes can only be applied to recurring billing plans',
    }
  }

  return { valid: true, promocode }
}
