/**
 * Drizzle ORM Schema — Plans (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/plans.schema.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 * Date: 2026-04-07
 *
 * Drizzle pgTable definition for the `plans` table.
 * Plans define billable product offerings per tenant workspace.
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
  integer,
  jsonb,
  numeric,
  pgTable,
  sql,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// plans
// ---------------------------------------------------------------------------

export const plans = pgTable(
  'plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Tenant workspace identifier — scopes the plan to a single workspace. */
    workspace_id: varchar('workspace_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    /** Price in workspace currency. Stored as exact decimal. */
    price: numeric('price', { precision: 10, scale: 2 }).notNull().default('0.00'),
    /** Billing model: one-time payment or recurring subscription. */
    billing_type: varchar('billing_type', { length: 20 }).notNull().default('one-time'),
    /** Number of calendar days the plan grants access for. Must be > 0. */
    duration_days: integer('duration_days').notNull(),
    /** Array of module permission keys enabled by this plan. Stored as JSONB. */
    enabled_modules: jsonb('enabled_modules').notNull().default([]),
    /** Whether this plan is available for new subscriptions. */
    is_active: boolean('is_active').notNull().default(true),
    /** Soft-delete flag. Soft-deleted plans are hidden from list queries. */
    is_deleted: boolean('is_deleted').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** Workspace-scoped partial index — filters deleted plans from list queries. */
    workspaceIdx: index('idx_plans_workspace')
      .on(table.workspace_id)
      .where(sql`${table.is_deleted} = FALSE`),
    /** CHECK: billing_type must be a valid enum value. */
    validBillingType: check(
      'chk_plans_billing_type',
      sql`${table.billing_type} IN ('one-time', 'recurring')`
    ),
    /** CHECK: duration_days must be positive. */
    validDurationDays: check('chk_plans_duration_days', sql`${table.duration_days} > 0`),
    /** CHECK: price must be non-negative. */
    validPrice: check('chk_plans_price', sql`${table.price} >= 0`),
  })
)
