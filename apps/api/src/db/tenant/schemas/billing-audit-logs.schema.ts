/**
 * Drizzle ORM Schema — Billing Audit Logs (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/billing-audit-logs.schema.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 * Date: 2026-04-09
 *
 * Drizzle pgTable definition for the `billing_audit_logs` table.
 * Append-only immutable log of all state transitions on invoices.
 * No UPDATE or DELETE is ever issued against this table.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import { sql } from 'drizzle-orm'
import { check, index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

import { invoices } from './invoices.schema'

// ---------------------------------------------------------------------------
// billing_audit_logs  (append-only)
// ---------------------------------------------------------------------------

export const billingAuditLogs = pgTable(
  'billing_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** FK → invoices(id) ON DELETE RESTRICT. Prevents deleting invoices with audit history. */
    invoice_id: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'restrict' }),
    /**
     * Event type describing the state transition.
     * e.g. INVOICE_CREATED, PAYMENT_CONFIRMED, SUBSCRIPTION_ACTIVATED, etc.
     */
    event: varchar('event', { length: 64 }).notNull(),
    /** UUID of the actor who triggered the event. Null for system-initiated events. */
    actor_id: uuid('actor_id'),
    /** Actor classification: SYSTEM | STAFF | GATEWAY. */
    actor_type: varchar('actor_type', { length: 20 }).notNull().default('SYSTEM'),
    /** Arbitrary JSON metadata for the event (gateway payload, request IDs, etc.). */
    metadata: jsonb('metadata').notNull().default({}),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** FK traversal index — fetch all log entries for a given invoice. */
    invoiceIdx: index('idx_billing_audit_invoice').on(table.invoice_id),
    /** Time-descending index for chronological log queries. */
    createdIdx: index('idx_billing_audit_created').on(table.created_at),
    /** CHECK: actor_type must be a valid value. */
    validActorType: check(
      'billing_audit_actor_type_check',
      sql`${table.actor_type} IN ('SYSTEM', 'STAFF', 'GATEWAY')`
    ),
  })
)
