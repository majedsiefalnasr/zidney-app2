/**
 * Drizzle ORM Schema — Subscriptions (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/subscriptions.schema.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 * Date: 2026-04-07
 *
 * Drizzle pgTable definition for the `subscriptions` table.
 * A subscription binds a student to a plan for a fixed duration.
 * Only one ACTIVE subscription per student is allowed at any time
 * (enforced by a unique partial index in migration 023).
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import {
  boolean,
  check,
  index,
  pgTable,
  sql,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { plans } from './plans.schema'
import { students } from './students.schema'

// ---------------------------------------------------------------------------
// subscriptions
// ---------------------------------------------------------------------------

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** FK → students(id) ON DELETE RESTRICT. Prevents deleting students with subscription history. */
    student_id: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'restrict' }),
    /** FK → plans(id) ON DELETE RESTRICT. Prevents deleting plans referenced by subscriptions. */
    plan_id: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'restrict' }),
    /**
     * Subscription lifecycle state.
     * ACTIVE | EXPIRED | CANCELED | PENDING (distinct from students.subscription_status).
     */
    status: varchar('status', { length: 20 }).notNull().default('PENDING'),
    /** Subscription start timestamp (informational — provided by client or defaulted to NOW). */
    started_at: timestamp('started_at', { withTimezone: true }).notNull(),
    /** Subscription expiry timestamp — always computed server-side via DB NOW(). */
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Whether the subscription should auto-renew when it expires. Deferred to Stage 45+. */
    auto_renew: boolean('auto_renew').notNull().default(false),
    /** Payment method used. 'MANUAL' is the only value in Stage 44. 'GATEWAY' deferred. */
    payment_method: varchar('payment_method', { length: 20 }).notNull().default('MANUAL'),
    /** External payment gateway reference. Null until gateway integration in Stage 45+. */
    gateway_ref: varchar('gateway_ref', { length: 255 }),
    /** Optional administrative note. */
    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** Unique partial index: at most one ACTIVE subscription per student. */
    activePerStudentIdx: uniqueIndex('idx_subscriptions_active_per_student')
      .on(table.student_id)
      .where(sql`${table.status} = 'ACTIVE'`),
    /** FK traversal index. */
    studentIdx: index('idx_subscriptions_student').on(table.student_id),
    /** FK traversal index. */
    planIdx: index('idx_subscriptions_plan').on(table.plan_id),
    /** Partial index for expiry-sweep queries. */
    expiresIdx: index('idx_subscriptions_expires')
      .on(table.expires_at)
      .where(sql`${table.status} = 'ACTIVE'`),
    /** CHECK: status must be a valid lifecycle state. */
    validStatus: check(
      'chk_subscriptions_status',
      sql`${table.status} IN ('ACTIVE', 'EXPIRED', 'CANCELED', 'PENDING')`
    ),
    /** CHECK: payment_method must be a valid value. */
    validPaymentMethod: check(
      'chk_subscriptions_payment_method',
      sql`${table.payment_method} IN ('MANUAL', 'GATEWAY')`
    ),
    /** CHECK: expires_at must be strictly after started_at. */
    validExpiryAfterStart: check(
      'chk_subscriptions_expires_after_start',
      sql`${table.expires_at} > ${table.started_at}`
    ),
  })
)
