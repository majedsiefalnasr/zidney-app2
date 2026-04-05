/**
 * Promocodes Domain — Error Registry
 *
 * File: packages/domain-core/src/promocodes/promocodes.errors.ts
 * Stage: STAGE_45_PROMOCODES
 *
 * 13 error codes covering all failure paths in the validation engine plus
 * admin operation errors. Pure definitions — no framework dependencies.
 */

// ---------------------------------------------------------------------------
// Error code union
// ---------------------------------------------------------------------------

export type PromocodeErrorCode =
  | 'PROMOCODE_NOT_FOUND'
  | 'PROMOCODE_INACTIVE'
  | 'PROMOCODE_EXPIRED'
  | 'PROMOCODE_NOT_YET_VALID'
  | 'PROMOCODE_USAGE_LIMIT_REACHED'
  | 'PROMOCODE_PER_USER_LIMIT_REACHED'
  | 'PROMOCODE_PLAN_NOT_ELIGIBLE'
  | 'PROMOCODE_STUDENT_NOT_IN_TARGET'
  | 'PROMOCODE_STACKING_NOT_ALLOWED'
  | 'PROMOCODE_FREE_TRIAL_REQUIRES_RECURRING'
  | 'PROMOCODE_DISCOUNT_EXCEEDS_PLAN'
  | 'PROMOCODE_CODE_ALREADY_EXISTS'
  | 'PROMOCODE_IMMUTABLE_FIELDS'

// ---------------------------------------------------------------------------
// HTTP status mapping
// ---------------------------------------------------------------------------

export const PROMOCODE_ERROR_HTTP: Record<PromocodeErrorCode, number> = {
  PROMOCODE_NOT_FOUND: 404,
  PROMOCODE_INACTIVE: 422,
  PROMOCODE_EXPIRED: 422,
  PROMOCODE_NOT_YET_VALID: 422,
  PROMOCODE_USAGE_LIMIT_REACHED: 422,
  PROMOCODE_PER_USER_LIMIT_REACHED: 422,
  PROMOCODE_PLAN_NOT_ELIGIBLE: 422,
  PROMOCODE_STUDENT_NOT_IN_TARGET: 422,
  PROMOCODE_STACKING_NOT_ALLOWED: 422,
  PROMOCODE_FREE_TRIAL_REQUIRES_RECURRING: 422,
  PROMOCODE_DISCOUNT_EXCEEDS_PLAN: 422,
  PROMOCODE_CODE_ALREADY_EXISTS: 409,
  PROMOCODE_IMMUTABLE_FIELDS: 422,
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

/**
 * Domain error for all promocode failures.
 * Carries a strongly-typed `code` field and a pre-resolved `httpStatus`.
 */
export class PromocodeError extends Error {
  readonly code: PromocodeErrorCode
  readonly httpStatus: number

  constructor(code: PromocodeErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'PromocodeError'
    this.code = code
    this.httpStatus = PROMOCODE_ERROR_HTTP[code]
  }
}
