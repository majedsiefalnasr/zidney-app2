/**
 * Billing Domain — Service Layer (Business Logic)
 *
 * File: packages/domain-core/src/billing/billing.service.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 *
 * Business-logic entry points for the invoice lifecycle.
 *
 * Key invariants:
 * ─ createInvoiceForSubscription: READ COMMITTED. Idempotent via idempotency_key.
 * ─ confirmGatewayPayment: SERIALIZABLE. CAS PENDING→PAID. Idempotent:
 *   returns existing record when already PAID (WEBHOOK_ALREADY_PROCESSED).
 * ─ verifyManualPayment: SERIALIZABLE. CAS PENDING→PAID + proof_file_id guard.
 * ─ cancelInvoice: READ COMMITTED. CAS PENDING→CANCELLED.
 * ─ activateSubscriptionFromInvoice: called within the SERIALIZABLE transaction
 *   of the parent confirm/verify function — NOT a standalone transaction.
 *
 * Constitutional Compliance:
 * ✓ No HTTP, no framework imports
 * ✓ No logging side-effects
 * ✓ All writes transactional (BEGIN/COMMIT/ROLLBACK)
 * ✓ SERIALIZABLE isolation for PAID transitions
 * ✓ Server-authoritative time via DB NOW()
 */

import {
  expireSubscription,
  findActiveSubscriptionByStudent,
  insertSubscription,
  syncStudentSubscriptionStatus,
} from '../subscriptions/subscriptions.repository'
import type { CreateSubscriptionInput } from '../subscriptions/subscriptions.types'
import { BillingError } from './billing.errors'
import {
  appendAuditLog,
  createInvoice,
  generateInvoiceNumberSequence,
  getInvoiceById,
  getInvoiceByIdempotencyKey,
  listInvoices,
  setActivationDate,
  transitionInvoiceStatus,
  updateInvoiceProof,
} from './billing.repository'
import type {
  AuditContext,
  ConfirmGatewayPaymentInput,
  CreateInvoiceInput,
  DbClient,
  InvoiceListQuery,
  InvoiceListResult,
  InvoiceRecord,
  TransactionClient,
} from './billing.types'

// ---------------------------------------------------------------------------
// createInvoiceForSubscription
// ---------------------------------------------------------------------------

/**
 * Create a new PENDING invoice for a subscription purchase.
 *
 * Transactional flow (READ COMMITTED):
 *  1. If idempotency_key is set, check for an existing invoice with that key
 *     → Return existing if found (idempotent)
 *  2. Generate sequential invoice number within the transaction
 *  3. Insert invoice (status='PENDING')
 *  4. Append INVOICE_CREATED audit entry
 *
 * @returns The created (or existing) InvoiceRecord
 * @throws BillingError INVOICE_ALREADY_EXISTS if non-idempotency duplicate detected
 */
export async function createInvoiceForSubscription(
  db: DbClient,
  input: CreateInvoiceInput,
  audit: AuditContext
): Promise<InvoiceRecord> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // 1. Idempotency check
    if (input.idempotency_key) {
      const existing = await getInvoiceByIdempotencyKey(client, input.idempotency_key)
      if (existing) {
        await client.query('COMMIT')
        return existing
      }
    }

    // 2. Generate sequential invoice number (safe within transaction)
    const invoiceNumber = await generateInvoiceNumberSequence(client)

    // 3. Insert invoice
    const invoice = await createInvoice(client, { ...input, invoice_number: invoiceNumber })

    // 4. Append audit log
    await appendAuditLog(client, {
      invoice_id: invoice.id,
      event: 'INVOICE_CREATED',
      actor_id: audit.user_id ?? null,
      actor_type: 'STAFF',
      metadata: {
        subscriber_id: input.subscriber_id,
        plan_id: input.subscription_plan_id,
        amount: input.amount,
        currency: input.currency ?? 'SAR',
        request_id: audit.correlation_id,
      },
    })

    await client.query('COMMIT')
    return invoice
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// confirmGatewayPayment
// ---------------------------------------------------------------------------

/**
 * Confirm an invoice as PAID after a successful gateway payment.
 *
 * Transactional flow (SERIALIZABLE):
 *  1. Lock invoice row for update
 *  2. If status is already PAID → return existing record (idempotent — already processed)
 *  3. Validate status is PENDING → throw INVOICE_CANNOT_CONFIRM otherwise
 *  4. CAS PENDING→PAID
 *  5. Append PAYMENT_CONFIRMED audit entry
 *  6. activateSubscriptionFromInvoice (within same tx)
 *  7. Set activation_date on invoice
 *
 * @throws BillingError INVOICE_NOT_FOUND
 * @throws BillingError INVOICE_CANNOT_CONFIRM
 * @throws BillingError SUBSCRIPTION_ACTIVATION_FAILED
 */
export async function confirmGatewayPayment(
  db: DbClient,
  input: ConfirmGatewayPaymentInput,
  audit: AuditContext
): Promise<InvoiceRecord> {
  const client = await db.connect()
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

    // 1. Lock the invoice row
    const { rows } = await client.query<{
      id: string
      status: string
      subscriber_id: string
      subscription_plan_id: string
    }>(
      `SELECT id, status, subscriber_id, subscription_plan_id FROM invoices WHERE id = $1 FOR UPDATE`,
      [input.invoice_id]
    )
    const row = rows[0]
    if (!row) throw new BillingError('INVOICE_NOT_FOUND', `Invoice not found: ${input.invoice_id}`)

    // 2. Already PAID → idempotent return
    if (row.status === 'PAID') {
      const existing = await getInvoiceById(client, input.invoice_id)
      await client.query('COMMIT')
      if (!existing)
        throw new BillingError(
          'INVOICE_NOT_FOUND',
          `Invoice not found after commit: ${input.invoice_id}`
        )
      return existing
    }

    // 3. Must be PENDING to confirm
    if (row.status !== 'PENDING') {
      throw new BillingError(
        'INVOICE_CANNOT_CONFIRM',
        `Invoice status '${row.status}' cannot be confirmed as PAID`
      )
    }

    // 4. CAS PENDING→PAID (also sets payment_reference)
    await client.query(
      `UPDATE invoices
          SET status = 'PAID', payment_reference = $1, updated_at = NOW()
        WHERE id = $2`,
      [input.payment_reference, input.invoice_id]
    )

    // 5. Append audit entry
    await appendAuditLog(client, {
      invoice_id: input.invoice_id,
      event: 'PAYMENT_CONFIRMED',
      actor_id: null,
      actor_type: 'GATEWAY',
      metadata: {
        payment_reference: input.payment_reference,
        gateway_metadata: input.gateway_metadata ?? {},
        request_id: audit.correlation_id,
      },
    })

    // 6. Activate subscription within same SERIALIZABLE tx
    await activateSubscriptionFromInvoice(
      client,
      row.subscriber_id,
      row.subscription_plan_id,
      input.invoice_id
    )

    // 7. Set activation_date
    await setActivationDate(client, input.invoice_id)

    await client.query('COMMIT')

    const updated = await getInvoiceById(db, input.invoice_id)
    if (!updated)
      throw new BillingError(
        'INVOICE_NOT_FOUND',
        `Invoice not found after commit: ${input.invoice_id}`
      )
    return updated
  } catch (err) {
    await client.query('ROLLBACK')
    if (err && typeof err === 'object') {
      const pg = err as { code?: string | number }
      const code = pg.code !== undefined ? String(pg.code) : undefined
      if (code === '40001' || code === '23505') {
        throw new BillingError(
          'INVOICE_ALREADY_PROCESSING',
          'Concurrent payment confirmation conflict'
        )
      }
    }
    throw err
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// verifyManualPayment
// ---------------------------------------------------------------------------

/**
 * Mark an invoice as PAID after a staff member verifies a manual payment.
 *
 * Transactional flow (SERIALIZABLE):
 *  1. Lock invoice row
 *  2. Validate status is PENDING
 *  3. Validate proof_file_id is already set
 *  4. CAS PENDING→PAID
 *  5. Append MANUAL_PAYMENT_VERIFIED audit entry
 *  6. activateSubscriptionFromInvoice (within same tx)
 *  7. Set activation_date on invoice
 *
 * @throws BillingError INVOICE_NOT_FOUND
 * @throws BillingError INVOICE_CANNOT_CONFIRM
 * @throws BillingError PROOF_REQUIRED if proof_file_id not yet uploaded
 * @throws BillingError SUBSCRIPTION_ACTIVATION_FAILED
 */
export async function verifyManualPayment(
  db: DbClient,
  invoiceId: string,
  audit: AuditContext
): Promise<InvoiceRecord> {
  const client = await db.connect()
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

    // 1. Lock invoice row
    const { rows } = await client.query<{
      id: string
      status: string
      subscriber_id: string
      subscription_plan_id: string
      proof_file_id: string | null
    }>(
      `SELECT id, status, subscriber_id, subscription_plan_id, proof_file_id
         FROM invoices WHERE id = $1 FOR UPDATE`,
      [invoiceId]
    )
    const row = rows[0]
    if (!row) throw new BillingError('INVOICE_NOT_FOUND', `Invoice not found: ${invoiceId}`)

    // 2. Must be PENDING to approve
    if (row.status !== 'PENDING') {
      throw new BillingError(
        'INVOICE_CANNOT_CONFIRM',
        `Invoice status '${row.status}' cannot be approved as PAID`
      )
    }

    // 3. Proof must already be uploaded via POST /invoices/:id/proof
    if (!row.proof_file_id) {
      throw new BillingError('PROOF_REQUIRED', 'Proof of payment must be uploaded before approving')
    }

    // 4. CAS PENDING→PAID
    const updated = await transitionInvoiceStatus(client, invoiceId, 'PENDING', 'PAID')
    if (!updated) {
      throw new BillingError('INVOICE_CANNOT_CONFIRM', 'Concurrent status conflict — retry')
    }

    // 5. Append audit entry
    await appendAuditLog(client, {
      invoice_id: invoiceId,
      event: 'MANUAL_PAYMENT_VERIFIED',
      actor_id: audit.user_id ?? null,
      actor_type: 'STAFF',
      metadata: {
        proof_file_id: row.proof_file_id,
        request_id: audit.correlation_id,
      },
    })

    // 6. Activate subscription within same SERIALIZABLE tx
    await activateSubscriptionFromInvoice(
      client,
      row.subscriber_id,
      row.subscription_plan_id,
      invoiceId
    )

    // 7. Set activation_date
    await setActivationDate(client, invoiceId)

    await client.query('COMMIT')

    const final = await getInvoiceById(db, invoiceId)
    if (!final)
      throw new BillingError('INVOICE_NOT_FOUND', `Invoice not found after commit: ${invoiceId}`)
    return final
  } catch (err) {
    await client.query('ROLLBACK')
    if (err && typeof err === 'object') {
      const pg = err as { code?: string | number }
      const code = pg.code !== undefined ? String(pg.code) : undefined
      if (code === '40001' || code === '23505') {
        throw new BillingError('INVOICE_ALREADY_PROCESSING', 'Concurrent payment conflict')
      }
    }
    throw err
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// cancelInvoice
// ---------------------------------------------------------------------------

/**
 * Cancel a PENDING invoice.
 *
 * Transactional flow (READ COMMITTED):
 *  1. Find invoice
 *  2. Validate status is PENDING
 *  3. CAS PENDING→CANCELLED
 *  4. Append INVOICE_CANCELLED audit entry
 *
 * @throws BillingError INVOICE_NOT_FOUND
 * @throws BillingError INVOICE_ALREADY_PAID
 * @throws BillingError INVOICE_CANNOT_CANCEL
 * @throws BillingError INVOICE_ALREADY_CANCELLED
 */
export async function cancelInvoice(
  db: DbClient,
  invoiceId: string,
  reason: string,
  audit: AuditContext
): Promise<InvoiceRecord> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const invoice = await getInvoiceById(client, invoiceId)
    if (!invoice) throw new BillingError('INVOICE_NOT_FOUND', `Invoice not found: ${invoiceId}`)

    if (invoice.status === 'PAID') throw new BillingError('INVOICE_ALREADY_PAID')
    if (invoice.status === 'CANCELLED') throw new BillingError('INVOICE_ALREADY_CANCELLED')
    if (invoice.status !== 'PENDING') {
      throw new BillingError(
        'INVOICE_CANNOT_CANCEL',
        `Invoice status '${invoice.status}' cannot be cancelled`
      )
    }

    const updated = await transitionInvoiceStatus(client, invoiceId, 'PENDING', 'CANCELLED')
    if (!updated) {
      // Race: concurrent cancellation or payment
      throw new BillingError('INVOICE_CANNOT_CANCEL', 'Concurrent status conflict — retry')
    }

    await appendAuditLog(client, {
      invoice_id: invoiceId,
      event: 'INVOICE_CANCELLED',
      actor_id: audit.user_id ?? null,
      actor_type: 'STAFF',
      metadata: { reason, request_id: audit.correlation_id },
    })

    await client.query('COMMIT')

    const final = await getInvoiceById(db, invoiceId)
    if (!final)
      throw new BillingError('INVOICE_NOT_FOUND', `Invoice not found after commit: ${invoiceId}`)
    return final
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// uploadInvoiceProof
// ---------------------------------------------------------------------------

/**
 * Upload/set the proof-of-payment file for a PENDING invoice.
 *
 * Transactional flow (READ COMMITTED):
 *  1. Fetch invoice
 *  2. Validate status is PENDING
 *  3. Set proof_file_id
 *  4. Append PROOF_UPLOADED audit entry
 *
 * @throws BillingError INVOICE_NOT_FOUND
 * @throws BillingError INVOICE_CANNOT_CONFIRM if not PENDING
 */
export async function uploadInvoiceProof(
  db: DbClient,
  invoiceId: string,
  proofFileId: string,
  audit: AuditContext
): Promise<InvoiceRecord> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const invoice = await getInvoiceById(client, invoiceId)
    if (!invoice) throw new BillingError('INVOICE_NOT_FOUND', `Invoice not found: ${invoiceId}`)

    if (invoice.status !== 'PENDING') {
      throw new BillingError(
        'INVOICE_CANNOT_CONFIRM',
        `Cannot upload proof — invoice status is '${invoice.status}'`
      )
    }

    await updateInvoiceProof(client, invoiceId, proofFileId)

    await appendAuditLog(client, {
      invoice_id: invoiceId,
      event: 'PROOF_UPLOADED',
      actor_id: audit.user_id ?? null,
      actor_type: 'STAFF',
      metadata: { proof_file_id: proofFileId, request_id: audit.correlation_id },
    })

    await client.query('COMMIT')

    const final = await getInvoiceById(db, invoiceId)
    if (!final)
      throw new BillingError('INVOICE_NOT_FOUND', `Invoice not found after commit: ${invoiceId}`)
    return final
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// getInvoiceByIdService
// ---------------------------------------------------------------------------

/**
 * Get a single invoice by ID.
 * @throws BillingError INVOICE_NOT_FOUND if not found
 */
export async function getInvoiceByIdService(
  db: DbClient,
  invoiceId: string
): Promise<InvoiceRecord> {
  const record = await getInvoiceById(db, invoiceId)
  if (!record) throw new BillingError('INVOICE_NOT_FOUND', `Invoice not found: ${invoiceId}`)
  return record
}

// ---------------------------------------------------------------------------
// listInvoicesService
// ---------------------------------------------------------------------------

/**
 * List invoices with optional filters.
 */
export async function listInvoicesService(
  db: DbClient,
  query: InvoiceListQuery,
  _audit: AuditContext
): Promise<InvoiceListResult> {
  return listInvoices(db, query)
}

// ---------------------------------------------------------------------------
// activateSubscriptionFromInvoice (private — called within SERIALIZABLE tx)
// ---------------------------------------------------------------------------

/**
 * Activate a subscription directly within an already-open SERIALIZABLE transaction.
 * Does NOT open a new transaction — the caller is responsible for BEGIN/COMMIT/ROLLBACK.
 *
 * Flow:
 *  1. Fetch plan (validate it exists and is active)
 *  2. Fetch and expire any existing ACTIVE subscription
 *  3. Insert new ACTIVE subscription (expires_at computed server-side)
 *  4. Sync students.subscription_status = 'ACTIVE'
 *
 * @throws BillingError SUBSCRIPTION_ACTIVATION_FAILED
 */
async function activateSubscriptionFromInvoice(
  client: TransactionClient,
  subscriberId: string,
  planId: string,
  _invoiceId: string
): Promise<void> {
  try {
    // 1. Fetch plan ID and duration — lock the plan row to prevent concurrent plan deactivation
    const { rows: planRows } = await client.query<{
      id: string
      duration_days: number
      is_active: boolean
      workspace_id: string
    }>(`SELECT id, duration_days, is_active, workspace_id FROM plans WHERE id = $1 FOR SHARE`, [
      planId,
    ])
    const plan = planRows[0]
    if (!plan || !plan.is_active) {
      throw new BillingError(
        'SUBSCRIPTION_ACTIVATION_FAILED',
        `Plan not found or inactive: ${planId}`
      )
    }

    // 2. Expire existing ACTIVE subscription if present
    const existing = await findActiveSubscriptionByStudent(client, subscriberId)
    if (existing) {
      await expireSubscription(client, existing.id)
    }

    // 3. Insert new ACTIVE subscription
    const createInput: CreateSubscriptionInput = {
      workspace_id: plan.workspace_id,
      student_id: subscriberId,
      plan_id: planId,
    }
    await insertSubscription(client, createInput, plan.duration_days)

    // 4. Sync student subscription_status
    await syncStudentSubscriptionStatus(client, subscriberId, 'ACTIVE')
  } catch (err) {
    if (err instanceof BillingError) throw err
    throw new BillingError(
      'SUBSCRIPTION_ACTIVATION_FAILED',
      err instanceof Error ? err.message : 'Unknown activation error'
    )
  }
}
