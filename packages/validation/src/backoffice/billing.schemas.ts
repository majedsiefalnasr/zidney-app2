/**
 * Billing Validation Schemas (Backoffice)
 *
 * File: packages/validation/src/backoffice/billing.schemas.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export const invoiceIdParamsSchema = z.object({
  id: z.string().uuid().describe('Invoice ID'),
})

export type InvoiceIdParams = z.infer<typeof invoiceIdParamsSchema>

// ---------------------------------------------------------------------------
// Create invoice
// ---------------------------------------------------------------------------

export const createInvoiceBodySchema = z.object({
  subscriber_id: z.string().uuid().describe('Student/subscriber ID'),
  subscription_plan_id: z.string().uuid().describe('Plan ID'),
  billing_period_start: z
    .string()
    .datetime({ offset: true })
    .describe('Start of the billing period (ISO 8601)'),
  billing_period_end: z
    .string()
    .datetime({ offset: true })
    .describe('End of the billing period (ISO 8601)'),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a non-negative decimal with up to 2 decimal places')
    .describe('Invoice amount'),
  currency: z.string().min(1).max(10).default('SAR').describe('ISO 4217 currency code'),
  payment_method: z.enum(['GATEWAY', 'MANUAL']).describe('Payment method'),
  payment_reference: z
    .string()
    .max(255)
    .optional()
    .nullable()
    .describe('External payment reference'),
  idempotency_key: z
    .string()
    .max(255)
    .optional()
    .nullable()
    .describe('Client-supplied idempotency key'),
})

export type CreateInvoiceBody = z.infer<typeof createInvoiceBodySchema>

// ---------------------------------------------------------------------------
// Upload proof of payment (Step 1 of two-step manual approval)
// ---------------------------------------------------------------------------

export const uploadProofBodySchema = z.object({
  proof_file_id: z.string().uuid().describe('UUID of the uploaded proof-of-payment file'),
})

export type UploadProofBody = z.infer<typeof uploadProofBodySchema>

// ---------------------------------------------------------------------------
// Verify manual payment — kept for backwards compat but body is now empty
// approve-invoice route uses no body; proof uploaded separately via upload-proof
// ---------------------------------------------------------------------------

export const verifyManualPaymentBodySchema = z.object({
  proof_file_id: z.string().uuid().describe('UUID of the uploaded proof-of-payment file'),
})

export type VerifyManualPaymentBody = z.infer<typeof verifyManualPaymentBodySchema>

// ---------------------------------------------------------------------------
// Cancel invoice
// ---------------------------------------------------------------------------

export const cancelInvoiceBodySchema = z.object({
  reason: z.string().min(1).max(500).describe('Reason for cancellation'),
})

export type CancelInvoiceBody = z.infer<typeof cancelInvoiceBodySchema>

// ---------------------------------------------------------------------------
// List invoices
// ---------------------------------------------------------------------------

export const listInvoicesQuerySchema = z.object({
  subscriber_id: z.string().uuid().optional().describe('Filter by subscriber (student) ID'),
  status: z
    .enum(['PENDING', 'PAID', 'FAILED', 'CANCELLED'])
    .optional()
    .describe('Filter by invoice status'),
  page: z.coerce.number().int().positive().default(1).describe('Page number'),
  limit: z.coerce.number().int().positive().max(100).default(20).describe('Results per page'),
})

export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>

// ---------------------------------------------------------------------------
// Webhook — gateway notification
// ---------------------------------------------------------------------------

export const gatewayWebhookBodySchema = z
  .object({
    event: z.string().min(1).max(64).describe('Event type from payment gateway'),
    invoice_id: z.string().uuid().describe('Invoice ID this event relates to'),
    payment_reference: z.string().min(1).max(255).describe('Gateway transaction reference'),
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .optional()
      .describe('Amount reported by gateway (informational)'),
    metadata: z.record(z.unknown()).optional().describe('Gateway-specific payload'),
  })
  .passthrough()

export type GatewayWebhookBody = z.infer<typeof gatewayWebhookBodySchema>
