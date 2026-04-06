/**
 * Billing Domain — Repository (Raw SQL)
 *
 * File: packages/domain-core/src/billing/billing.repository.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 *
 * All queries are tenant-scoped via the database pool connection (database-per-tenant).
 * No workspace_id column exists on invoices; tenant isolation is enforced at pool level.
 *
 * No ORM — raw pg queries for explicit control.
 *
 * Constitutional Compliance:
 * ✓ No HTTP, no framework imports
 * ✓ All writes are caller-transactional
 * ✓ Tenant isolation enforced at pool level
 */

import type {
  AppendAuditLogInput,
  BillingAuditLogRecord,
  BillingAuditLogRow,
  CreateInvoiceDbInput,
  DbClient,
  InvoiceListQuery,
  InvoiceListResult,
  InvoiceRecord,
  InvoiceRow,
  InvoiceStatus,
  TransactionClient,
} from './billing.types'

// ---------------------------------------------------------------------------
// Column sets
// ---------------------------------------------------------------------------

const INVOICE_COLUMNS =
  'id, invoice_number, subscriber_id, subscription_plan_id, billing_period_start, billing_period_end, amount, currency, payment_method, payment_reference, proof_file_id, status, activation_date, idempotency_key, created_at, updated_at'

const AUDIT_COLUMNS = 'id, invoice_id, event, actor_id, actor_type, metadata, created_at'

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Find an invoice by primary key.
 */
export async function getInvoiceById(
  client: DbClient | TransactionClient,
  invoiceId: string
): Promise<InvoiceRecord | null> {
  const { rows } = await client.query<InvoiceRow>(
    `SELECT ${INVOICE_COLUMNS}
       FROM invoices
      WHERE id = $1`,
    [invoiceId]
  )
  return (rows[0] as InvoiceRecord) ?? null
}

/**
 * Find an invoice by its idempotency key.
 * Used to detect duplicate create/confirm requests.
 */
export async function getInvoiceByIdempotencyKey(
  client: DbClient | TransactionClient,
  idempotencyKey: string
): Promise<InvoiceRecord | null> {
  const { rows } = await client.query<InvoiceRow>(
    `SELECT ${INVOICE_COLUMNS}
       FROM invoices
      WHERE idempotency_key = $1`,
    [idempotencyKey]
  )
  return (rows[0] as InvoiceRecord) ?? null
}

/**
 * List invoices with optional subscriber_id / status filter and pagination.
 */
export async function listInvoices(
  client: DbClient,
  query: InvoiceListQuery
): Promise<InvoiceListResult> {
  const { page, limit, subscriber_id, status } = query
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: unknown[] = []

  if (subscriber_id) {
    params.push(subscriber_id)
    conditions.push(`subscriber_id = $${params.length}`)
  }
  if (status) {
    params.push(status)
    conditions.push(`status = $${params.length}`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const [{ rows: items }, { rows: countRows }] = await Promise.all([
    client.query<InvoiceRow>(
      `SELECT ${INVOICE_COLUMNS}
         FROM invoices
         ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    client.query<{ count: string }>(`SELECT COUNT(*) AS count FROM invoices ${where}`, params),
  ])

  return {
    items: items as InvoiceRecord[],
    total: parseInt(countRows[0]?.count ?? '0', 10),
    page,
    limit,
  }
}

// ---------------------------------------------------------------------------
// Write helpers (called inside transactions by the service layer)
// ---------------------------------------------------------------------------

/**
 * Insert a new invoice.
 * Returns the inserted InvoiceRecord.
 */
export async function createInvoice(
  client: TransactionClient,
  input: CreateInvoiceDbInput
): Promise<InvoiceRecord> {
  const { rows } = await client.query<InvoiceRow>(
    `INSERT INTO invoices
       (invoice_number, subscriber_id, subscription_plan_id, billing_period_start,
        billing_period_end, amount, currency, payment_method, payment_reference,
        idempotency_key)
     VALUES ($1, $2, $3, $4::TIMESTAMPTZ, $5::TIMESTAMPTZ, $6, $7, $8, $9, $10)
     RETURNING ${INVOICE_COLUMNS}`,
    [
      input.invoice_number,
      input.subscriber_id,
      input.subscription_plan_id,
      input.billing_period_start,
      input.billing_period_end,
      input.amount,
      input.currency ?? 'SAR',
      input.payment_method,
      input.payment_reference ?? null,
      input.idempotency_key ?? null,
    ]
  )

  if (!rows[0]) {
    throw new Error(
      `createInvoice failed: no row returned. subscriber_id: ${input.subscriber_id}, invoice_number: ${input.invoice_number}`
    )
  }

  return rows[0]
}

/**
 * Compare-and-set status transition.
 * Only updates if the current status matches expectedStatus.
 * Returns the updated InvoiceRecord, or null if the CAS check failed.
 */
export async function transitionInvoiceStatus(
  client: TransactionClient,
  invoiceId: string,
  expectedStatus: InvoiceStatus,
  newStatus: InvoiceStatus
): Promise<InvoiceRecord | null> {
  const { rows } = await client.query<InvoiceRow>(
    `UPDATE invoices
        SET status = $1, updated_at = NOW()
      WHERE id = $2
        AND status = $3
     RETURNING ${INVOICE_COLUMNS}`,
    [newStatus, invoiceId, expectedStatus]
  )
  return (rows[0] as InvoiceRecord) ?? null
}

/**
 * Set the proof_file_id and updated_at on an invoice.
 * Called during manual payment verification.
 */
export async function updateInvoiceProof(
  client: TransactionClient,
  invoiceId: string,
  proofFileId: string
): Promise<void> {
  await client.query(
    `UPDATE invoices
        SET proof_file_id = $1, updated_at = NOW()
      WHERE id = $2`,
    [proofFileId, invoiceId]
  )
}

/**
 * Set activation_date on an invoice (called when subscription is activated).
 * Uses DB NOW() to remain server-authoritative.
 */
export async function setActivationDate(
  client: TransactionClient,
  invoiceId: string
): Promise<void> {
  await client.query(
    `UPDATE invoices
        SET activation_date = NOW(), updated_at = NOW()
      WHERE id = $1`,
    [invoiceId]
  )
}

/**
 * Append an immutable audit log entry.
 * Returns the inserted BillingAuditLogRecord.
 */
export async function appendAuditLog(
  client: TransactionClient,
  input: AppendAuditLogInput
): Promise<BillingAuditLogRecord> {
  const { rows } = await client.query<BillingAuditLogRow>(
    `INSERT INTO billing_audit_logs
       (invoice_id, event, actor_id, actor_type, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING ${AUDIT_COLUMNS}`,
    [
      input.invoice_id,
      input.event,
      input.actor_id ?? null,
      input.actor_type,
      JSON.stringify(input.metadata ?? {}),
    ]
  )

  if (!rows[0]) {
    throw new Error(`appendAuditLog failed: no row returned. invoice_id: ${input.invoice_id}`)
  }

  return rows[0]
}

/**
 * Generate the next sequential invoice number for this workspace-month.
 * Format: INV-YYYY-MM-<NNNN> (zero-padded, 4 digits minimum).
 *
 * Counts all existing invoices for the current calendar month and
 * returns the next number. MUST be called inside a serializable
 * transaction to avoid race conditions.
 */
export async function generateInvoiceNumberSequence(client: TransactionClient): Promise<string> {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const prefix = `INV-${year}-${month}`

  const { rows } = await client.query<{ count: string }>(
    `SELECT COUNT(*) AS count
       FROM invoices
      WHERE invoice_number LIKE $1`,
    [`${prefix}-%`]
  )

  const seq = parseInt(rows[0]?.count ?? '0', 10) + 1
  return `${prefix}-${String(seq).padStart(4, '0')}`
}
