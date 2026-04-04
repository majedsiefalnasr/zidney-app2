/**
 * Subscriptions Domain — Error Types
 *
 * File: packages/domain-core/src/subscriptions/subscriptions.errors.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 *
 * Standard Zidney error contract for the subscriptions domain.
 */

// ---------------------------------------------------------------------------
// Error code union
// ---------------------------------------------------------------------------

export type SubscriptionErrorCode =
  | 'SUBSCRIPTION_NOT_FOUND'
  | 'SUBSCRIPTION_ALREADY_ACTIVE'
  | 'PLAN_NOT_FOUND'
  | 'PLAN_INACTIVE'
  | 'SUBSCRIPTION_CANNOT_CANCEL'
  | 'SUBSCRIPTION_REQUIRED'
  | 'SUBSCRIPTION_EXPIRED'

// ---------------------------------------------------------------------------
// HTTP status map
// ---------------------------------------------------------------------------

export const SUBSCRIPTION_ERROR_HTTP: Record<SubscriptionErrorCode, number> = {
  SUBSCRIPTION_NOT_FOUND: 404,
  SUBSCRIPTION_ALREADY_ACTIVE: 409,
  PLAN_NOT_FOUND: 404,
  PLAN_INACTIVE: 422,
  SUBSCRIPTION_CANNOT_CANCEL: 409,
  SUBSCRIPTION_REQUIRED: 422,
  SUBSCRIPTION_EXPIRED: 422,
}

// ---------------------------------------------------------------------------
// Typed error class
// ---------------------------------------------------------------------------

export class SubscriptionError extends Error {
  readonly code: SubscriptionErrorCode
  readonly httpStatus: number

  constructor(code: SubscriptionErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'SubscriptionError'
    this.code = code
    this.httpStatus = SUBSCRIPTION_ERROR_HTTP[code]
  }
}
