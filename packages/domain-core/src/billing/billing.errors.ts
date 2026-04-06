/**
 * Billing Domain — Error Types
 *
 * File: packages/domain-core/src/billing/billing.errors.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 *
 * Standard Zidney error contract for the billing domain.
 */

// ---------------------------------------------------------------------------
// Error code union
// ---------------------------------------------------------------------------

export type BillingErrorCode =
  | 'INVOICE_NOT_FOUND'
  | 'INVOICE_ALREADY_PAID'
  | 'INVOICE_ALREADY_PROCESSING'
  | 'INVOICE_ALREADY_EXISTS'
  | 'INVOICE_CANNOT_CONFIRM'
  | 'INVOICE_CANNOT_CANCEL'
  | 'INVOICE_ALREADY_CANCELLED'
  | 'PROOF_REQUIRED'
  | 'SUBSCRIPTION_ACTIVATION_FAILED'
  | 'INVALID_WEBHOOK_SIGNATURE'
  | 'WEBHOOK_ALREADY_PROCESSED'

// ---------------------------------------------------------------------------
// HTTP status map
// ---------------------------------------------------------------------------

export const BILLING_ERROR_HTTP: Record<BillingErrorCode, number> = {
  INVOICE_NOT_FOUND: 404,
  INVOICE_ALREADY_PAID: 409,
  INVOICE_ALREADY_PROCESSING: 409,
  INVOICE_ALREADY_EXISTS: 409,
  INVOICE_CANNOT_CONFIRM: 422,
  INVOICE_CANNOT_CANCEL: 422,
  INVOICE_ALREADY_CANCELLED: 409,
  PROOF_REQUIRED: 422,
  SUBSCRIPTION_ACTIVATION_FAILED: 500,
  INVALID_WEBHOOK_SIGNATURE: 401,
  WEBHOOK_ALREADY_PROCESSED: 200,
}

// ---------------------------------------------------------------------------
// Typed error class
// ---------------------------------------------------------------------------

export class BillingError extends Error {
  readonly code: BillingErrorCode
  readonly httpStatus: number

  constructor(code: BillingErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'BillingError'
    this.code = code
    this.httpStatus = BILLING_ERROR_HTTP[code]
  }
}
