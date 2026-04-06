/**
 * Promocodes Domain — Types
 *
 * File: packages/domain-core/src/promocodes/promocodes.types.ts
 * Stage: STAGE_45_PROMOCODES
 *
 * Pure type definitions — no logic, no imports from framework layer.
 */

// Re-export shared DB client types for convenience
export type { AuditContext, DbClient, TransactionClient } from '../plans/plans.types'

// ---------------------------------------------------------------------------
// Domain Enums
// ---------------------------------------------------------------------------

/** The three supported discount mechanisms. */
export type PromocodeType = 'PERCENTAGE' | 'FIXED' | 'FREE_TRIAL'

// ---------------------------------------------------------------------------
// Raw DB rows
// ---------------------------------------------------------------------------

/** Full database row for a promocode. `value` is returned as string by pg (numeric). */
export interface PromocodeRow {
  id: string
  code: string
  type: PromocodeType
  value: string | null
  free_trial_days: number | null
  valid_from: Date
  valid_until: Date
  usage_limit: number | null
  per_user_limit: number
  applies_to_plan_ids: string[]
  target_division_ids: string[] | null
  target_group_ids: string[] | null
  is_stackable: boolean
  is_active: boolean
  created_at: Date
  updated_at: Date
}

/** Full database row for a promocode usage. `discount_amount` is numeric string from pg. */
export interface PromocodeUsageRow {
  id: string
  promocode_id: string
  student_id: string
  subscription_id: string
  discount_amount: string
  redeemed_at: Date
}

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

/** Validated input for creating a new promocode. */
export interface PromocodeInput {
  code: string
  type: PromocodeType
  value?: number
  free_trial_days?: number
  valid_from: string
  valid_until: string
  usage_limit?: number
  per_user_limit?: number
  applies_to_plan_ids?: string[]
  target_division_ids?: string[]
  target_group_ids?: string[]
  is_stackable?: boolean
}

/** Input for creating a new usage record (passed to insertUsage). */
export interface NewPromocodeUsageInput {
  promocode_id: string
  student_id: string
  subscription_id: string
  discount_amount: number
}

// ---------------------------------------------------------------------------
// Service / engine shapes
// ---------------------------------------------------------------------------

/**
 * Context required by `validatePromocodeApplication`.
 * All time-sensitive fields must be sourced from the DB (server-authoritative).
 */
export interface PromocodeValidationContext {
  /** Set when re-validating inside applyPromocode — the locked promo row ID. */
  promocodeId?: string
  code: string
  student_id: string
  plan_id: string
  /** Loaded by the route handler from the plan record (NOT from client body). */
  plan_billing_type: string
  student_division_id: string | null
  student_group_id: string | null
  /** Existing promocode IDs already applied to this student's current subscription. */
  existing_promo_ids_on_subscription: string[]
  /** Whether any existing promo on the subscription has is_stackable=false (for symmetric stacking check). */
  existing_promos_are_non_stackable?: boolean
  /** Server `NOW()` fetched from DB before validation. */
  server_now: Date
}

/** Result of `calculateDiscount()`. */
export interface DiscountResult {
  discount_amount: number
  final_price: number
  free_trial_days?: number
}

/** Return type of `validatePromocodeApplication()`. */
export type ValidatorResult =
  | { valid: true; promocode: PromocodeRow }
  | {
      valid: false
      code: import('./promocodes.errors').PromocodeErrorCode
      message: string
    }

// ---------------------------------------------------------------------------
// Query / filter shapes
// ---------------------------------------------------------------------------

/** Filter bag for `listPromocodes`. */
export interface ListPromocodesFilter {
  is_active?: boolean
  type?: PromocodeType
  /** Computed status filter applied server-side using DB NOW(). */
  status?: 'ACTIVE_NOW' | 'EXPIRED' | 'NOT_YET_VALID' | 'INACTIVE'
  page?: number
  limit?: number
}

// ---------------------------------------------------------------------------
// Analytics shapes
// ---------------------------------------------------------------------------

/** Workspace-level promo analytics returned by `getAnalyticsSummary`. */
export interface PromocodeAnalytics {
  total_codes: number
  active_codes: number
  expired_codes: number
  total_redemptions: number
  revenue_impact: number
  by_type: { type: PromocodeType; count: number; total_usages: number }[]
  top_codes: { code: string; total_usages: number; revenue_impact: number }[]
}

/** Per-code analytics returned alongside a single promocode response. */
export interface SinglePromocodeAnalytics {
  total_usages: number
  total_discount_amount: number
  unique_students: number
}

/** Optional date-range filter for analytics queries. */
export interface AnalyticsFilter {
  from?: string
  to?: string
}
