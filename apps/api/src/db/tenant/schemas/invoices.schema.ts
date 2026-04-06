/**
 * Drizzle ORM Schema — Invoices (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/invoices.schema.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 * Date: 2026-04-09
 *
 * Drizzle pgTable definition for the `invoices` table.
 * An invoice tracks the full payment lifecycle for a subscription purchase.
 * Subscription activation is gated on invoice status reaching PAID.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import { sql } from 'drizzle-orm'
import {
  check,
  index,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { plans } from './plans.schema'
import { students } from './students.schema'

// ---------------------------------------------------------------------------
// invoices
// ---------------------------------------------------------------------------

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Unique human-readable invoice number (e.g. INV-2026-001). */
    invoice_number: varchar('invoice_number', { length: 64 }).notNull(),
    /** FK → students(id) ON DELETE RESTRICT. */
    subscriber_id: uuid('subscriber_id')
      .notNull()
      .references(() => students.id, { onDelete: 'restrict' }),
    /** FK → plans(id) ON DELETE RESTRICT. */
    subscription_plan_id: uuid('subscription_plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'restrict' }),
    /** Start of the billing period this invoice covers. */
    billing_period_start: timestamp('billing_period_start', { withTimezone: true }).notNull(),
    /** End of the billing period this invoice covers. Must be > billing_period_start. */
    billing_period_end: timestamp('billing_period_end', { withTimezone: true }).notNull(),
    /** Invoice amount. Non-negative. Stored as exact decimal (12, 2). */
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    /** ISO 4217 currency code. Defaults to SAR. */
    currency: varchar('currency', { length: 10 }).notNull().default('SAR'),
    /** Payment method used: GATEWAY or MANUAL. */
    payment_method: varchar('payment_method', { length: 20 }).notNull(),
    /** External gateway transaction reference. Null for manual payments. */
    payment_reference: varchar('payment_reference', { length: 255 }),
    /** UUID of the uploaded proof-of-payment file (stored externally, no FK required). */
    proof_file_id: uuid('proof_file_id'),
    /**
     * Invoice lifecycle state.
     * PENDING → PAID | FAILED | CANCELLED
     */
    status: varchar('status', { length: 20 }).notNull().default('PENDING'),
    /** Timestamp when the subscription was activated from this invoice. */
    activation_date: timestamp('activation_date', { withTimezone: true }),
    /** Client-supplied idempotency key. Partial-unique: only enforced when NOT NULL. */
    idempotency_key: varchar('idempotency_key', { length: 255 }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** Unique invoice number per workspace (globally unique within tenant DB). */
    numberUniqueIdx: uniqueIndex('idx_invoices_number_workspace').on(table.invoice_number),
    /** Partial unique index: idempotency_key must be unique when present. */
    idempotencyUniqueIdx: uniqueIndex('idx_invoices_idempotency')
      .on(table.idempotency_key)
      .where(sql`${table.idempotency_key} IS NOT NULL`),
    /** FK traversal index for subscriber lookups. */
    subscriberIdx: index('idx_invoices_subscriber').on(table.subscriber_id),
    /** Status filter index for pending-invoice queries. */
    statusIdx: index('idx_invoices_status').on(table.status),
    /** Time-descending index for invoice list queries. */
    createdIdx: index('idx_invoices_created').on(table.created_at),
    /** CHECK: status must be a valid lifecycle value. */
    validStatus: check(
      'invoices_status_check',
      sql`${table.status} IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED')`
    ),
    /** CHECK: payment_method must be GATEWAY or MANUAL. */
    validPaymentMethod: check(
      'invoices_payment_method_check',
      sql`${table.payment_method} IN ('GATEWAY', 'MANUAL')`
    ),
    /** CHECK: billing period must be a positive interval. */
    validPeriod: check(
      'invoices_period_check',
      sql`${table.billing_period_end} > ${table.billing_period_start}`
    ),
    /** CHECK: amount must be non-negative. */
    validAmount: check('invoices_amount_check', sql`${table.amount} >= 0`),
  })
)
