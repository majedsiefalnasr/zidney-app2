/**
 * Subscriptions Domain — Types
 *
 * File: packages/domain-core/src/subscriptions/subscriptions.types.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 *
 * Pure type definitions — no logic, no imports from framework layer.
 *
 * Important: `SubscriptionState` is a NEW distinct type for the subscriptions
 * table lifecycle. It is NOT the same as `SubscriptionStatus` on the students
 * table (which remains ACTIVE | SUSPENDED | EXPIRED | NONE).
 */

// Re-export shared DB client types for convenience
export type { AuditContext, DbClient, TransactionClient } from '../plans/plans.types'

// ---------------------------------------------------------------------------
// Domain Enums
// ---------------------------------------------------------------------------

/** Lifecycle state of a subscription record in the subscriptions table. */
export type SubscriptionState = 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'PENDING'

/** Payment method. 'GATEWAY' deferred to Stage 45+. */
export type PaymentMethod = 'MANUAL' | 'GATEWAY'

// ---------------------------------------------------------------------------
// Raw DB rows
// ---------------------------------------------------------------------------

/** Full database row for a subscription. */
export interface SubscriptionRow {
  id: string
  student_id: string
  plan_id: string
  status: SubscriptionState
  started_at: Date
  expires_at: Date
  auto_renew: boolean
  payment_method: PaymentMethod
  gateway_ref: string | null
  notes: string | null
  /** Final price after promocode discount. NULL means no discount was applied. */
  price_paid: string | number | null
  created_at: Date
  updated_at: Date
}

// ---------------------------------------------------------------------------
// Public records
// ---------------------------------------------------------------------------

/** Subscription record — identical to SubscriptionRow (no sensitive fields to strip). */
export type SubscriptionRecord = SubscriptionRow

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

export interface CreateSubscriptionInput {
  workspace_id: string
  student_id: string
  plan_id: string
  /** Client-provided start timestamp. Defaults to NOW() if not supplied. */
  started_at?: string | null
  notes?: string | null
}

// ---------------------------------------------------------------------------
// Query shapes
// ---------------------------------------------------------------------------

export interface SubscriptionListQuery {
  student_id?: string
  status?: SubscriptionState
  page: number
  limit: number
}

export interface SubscriptionListResult {
  items: SubscriptionRecord[]
  total: number
  page: number
  limit: number
}
