/**
 * Plans Domain — Error Types
 *
 * File: packages/domain-core/src/plans/plans.errors.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 *
 * Standard Zidney error contract for the plans domain.
 */

// ---------------------------------------------------------------------------
// Error code union
// ---------------------------------------------------------------------------

export type PlanErrorCode =
  | 'PLAN_NOT_FOUND'
  | 'PLAN_HAS_ACTIVE_SUBSCRIPTIONS'
  | 'PLAN_INACTIVE'
  | 'PLAN_INVALID_MODULES'

// ---------------------------------------------------------------------------
// HTTP status map
// ---------------------------------------------------------------------------

export const PLAN_ERROR_HTTP: Record<PlanErrorCode, number> = {
  PLAN_NOT_FOUND: 404,
  PLAN_HAS_ACTIVE_SUBSCRIPTIONS: 409,
  PLAN_INACTIVE: 422,
  PLAN_INVALID_MODULES: 422,
}

// ---------------------------------------------------------------------------
// Typed error class
// ---------------------------------------------------------------------------

export class PlanError extends Error {
  readonly code: PlanErrorCode
  readonly httpStatus: number

  constructor(code: PlanErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'PlanError'
    this.code = code
    this.httpStatus = PLAN_ERROR_HTTP[code]
  }
}
