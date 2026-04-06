/**
 * Billing Domain — Types
 *
 * File: packages/domain-core/src/billing/billing.types.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 *
 * Pure type definitions — no logic, no imports from framework layer.
 */

export type { AuditContext, DbClient, TransactionClient } from '../plans/plans.types'

// ---------------------------------------------------------------------------
// Domain Enums
// ---------------------------------------------------------------------------

/** Invoice lifecycle state. */
export type InvoiceStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED'

/** Payment method for an invoice. */
export type InvoicePaymentMethod = 'GATEWAY' | 'MANUAL'

/** Actor type for billing audit log entries. */
export type BillingActorType = 'SYSTEM' | 'STAFF' | 'GATEWAY'

// ---------------------------------------------------------------------------
// Raw DB rows
// ---------------------------------------------------------------------------

/** Full database row for an invoice. */
export interface InvoiceRow {
  id: string
  invoice_number: string
  subscriber_id: string
  subscription_plan_id: string
  billing_period_start: Date
  billing_period_end: Date
  /** Stored as string from pg driver for NUMERIC columns. */
  amount: string
  currency: string
  payment_method: InvoicePaymentMethod
  payment_reference: string | null
  proof_file_id: string | null
  status: InvoiceStatus
  activation_date: Date | null
  idempotency_key: string | null
  created_at: Date
  updated_at: Date
}

/** Full database row for a billing audit log entry. */
export interface BillingAuditLogRow {
  id: string
  invoice_id: string
  event: string
  actor_id: string | null
  actor_type: BillingActorType
  metadata: Record<string, unknown>
  created_at: Date
}

// ---------------------------------------------------------------------------
// Public records
// ---------------------------------------------------------------------------

/** Invoice record returned from repository and handler layers. */
export type InvoiceRecord = InvoiceRow

/** Billing audit log record. */
export type BillingAuditLogRecord = BillingAuditLogRow

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

export interface CreateInvoiceInput {
  subscriber_id: string
  subscription_plan_id: string
  billing_period_start: string
  billing_period_end: string
  amount: string
  currency?: string
  payment_method: InvoicePaymentMethod
  payment_reference?: string | null
  idempotency_key?: string | null
}

/** Internal shape used by the repository — includes server-generated invoice_number */
export type CreateInvoiceDbInput = CreateInvoiceInput & { invoice_number: string }

export interface ConfirmGatewayPaymentInput {
  invoice_id: string
  payment_reference: string
  /** Server-set gateway payload stored in audit metadata. */
  gateway_metadata?: Record<string, unknown>
}

export interface AppendAuditLogInput {
  invoice_id: string
  event: string
  actor_id?: string | null
  actor_type: BillingActorType
  metadata?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Query shapes
// ---------------------------------------------------------------------------

export interface InvoiceListQuery {
  subscriber_id?: string
  status?: InvoiceStatus
  page: number
  limit: number
}

export interface InvoiceListResult {
  items: InvoiceRecord[]
  total: number
  page: number
  limit: number
}
