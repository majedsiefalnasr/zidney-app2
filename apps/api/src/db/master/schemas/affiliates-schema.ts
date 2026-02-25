/**
 * Drizzle Schema: Affiliate System
 * Stage: STAGE_13_AFFILIATES
 * Purpose: Drizzle ORM table definitions for master_db
 *
 * Note: Actual table creation happens in SQL migrations.
 * These definitions are for reference and potential Drizzle introspection.
 */

import {
  boolean,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * Table: affiliates
 * Purpose: Store affiliate program definitions and configuration
 */
export const affiliates = pgTable(
  'affiliates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    promo_code: varchar('promo_code', { length: 50 }).notNull().unique(),
    discount_percentage: numeric('discount_percentage', {
      precision: 5,
      scale: 2,
    }).notNull(),
    commission_percentage: numeric('commission_percentage', {
      precision: 5,
      scale: 2,
    }).notNull(),
    allow_with_other_discounts: boolean('allow_with_other_discounts')
      .notNull()
      .default(false),
    usage_limit_total: integer('usage_limit_total'),
    usage_limit_per_client: integer('usage_limit_per_client'),
    usage_count: integer('usage_count').notNull().default(0),
    start_date: timestamp('start_date', { withTimezone: true }).notNull(),
    end_date: timestamp('end_date', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
    description: text('description'),
    created_at: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    promoCodeIndex: index('idx_affiliates_promo_code').on(table.promo_code),
    statusIndex: index('idx_affiliates_status').on(table.status),
    dateRangeIndex: index('idx_affiliates_date_range').on(
      table.start_date,
      table.end_date
    ),
  })
)

/**
 * Table: affiliate_usages
 * Purpose: Immutable audit trail of code usage per purchase
 */
export const affiliate_usages = pgTable(
  'affiliate_usages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    affiliate_id: uuid('affiliate_id').notNull(),
    client_id: uuid('client_id').notNull(),
    license_id: uuid('license_id').notNull(),
    base_amount: numeric('base_amount', { precision: 12, scale: 2 }).notNull(),
    discount_percentage: numeric('discount_percentage', {
      precision: 5,
      scale: 2,
    }).notNull(),
    discount_amount: numeric('discount_amount', {
      precision: 12,
      scale: 2,
    }).notNull(),
    commission_percentage: numeric('commission_percentage', {
      precision: 5,
      scale: 2,
    }).notNull(),
    commission_amount: numeric('commission_amount', {
      precision: 12,
      scale: 2,
    }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    affiliateIdIndex: index('idx_affiliate_usages_affiliate_id').on(
      table.affiliate_id
    ),
    clientAffiliateIndex: index('idx_affiliate_usages_client_affiliate').on(
      table.client_id,
      table.affiliate_id
    ),
    createdAtIndex: index('idx_affiliate_usages_created_at').on(
      table.created_at
    ),
    fkAffiliateId: foreignKey({
      columns: [table.affiliate_id],
      foreignColumns: [affiliates.id],
    }).onDelete('restrict'),
  })
)

/**
 * Table: affiliate_admin_audit
 * Purpose: Immutable audit trail of admin actions
 */
export const affiliate_admin_audit = pgTable(
  'affiliate_admin_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    affiliate_id: uuid('affiliate_id').notNull(),
    admin_id: uuid('admin_id').notNull(),
    action: varchar('action', {
      length: 50,
      enum: ['CREATE', 'UPDATE', 'DISABLE'],
    }).notNull(),
    old_values: text('old_values'), // JSONB stored as text (Drizzle limitation)
    new_values: text('new_values'), // JSONB stored as text
    ip_address: varchar('ip_address', { length: 45 }), // IPv4 or IPv6
    created_at: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    affiliateIdIndex: index('idx_affiliate_admin_audit_affiliate_id').on(
      table.affiliate_id
    ),
    adminIdIndex: index('idx_affiliate_admin_audit_admin_id').on(
      table.admin_id
    ),
    actionIndex: index('idx_affiliate_admin_audit_action').on(table.action),
    createdAtIndex: index('idx_affiliate_admin_audit_created_at').on(
      table.created_at
    ),
    fkAffiliateId: foreignKey({
      columns: [table.affiliate_id],
      foreignColumns: [affiliates.id],
    }).onDelete('restrict'),
  })
)
