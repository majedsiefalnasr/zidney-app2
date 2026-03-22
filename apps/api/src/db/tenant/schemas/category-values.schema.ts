/**
 * Drizzle ORM Schema — category_values
 *
 * File: apps/api/src/db/tenant/schemas/category-values.schema.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 *
 * NOTE: The functional unique index (unique_category_values_code) is migration-owned.
 * Drizzle cannot represent partial functional indexes. FK constraints are also migration-owned.
 */

import { check, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const categoryValues = pgTable(
  'category_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    category_id: uuid('category_id').notNull(),
    code: varchar('code', { length: 100 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('COMPLETED'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    created_by: uuid('created_by'),
    updated_by: uuid('updated_by'),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    statusCheck: check(
      'category_values_status_check',
      `${table.status.name} IN ('COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED', 'DISABLED')`
    ),
    categoryIdIdx: index('idx_category_values_category_id').on(table.category_id),
    statusIdx: index('idx_category_values_status').on(table.status),
    categoryIdStatusIdx: index('idx_category_values_category_id_status').on(
      table.category_id,
      table.status
    ),
    // unique_category_values_code: migration-owned partial functional index (CONCURRENTLY)
    // FK constraints (category_id, created_by, updated_by): migration-owned
  })
)

export type CategoryValue = typeof categoryValues.$inferSelect
export type NewCategoryValue = typeof categoryValues.$inferInsert
