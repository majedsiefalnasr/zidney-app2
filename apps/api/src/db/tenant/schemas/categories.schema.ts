/**
 * Drizzle ORM Schema — categories
 *
 * File: apps/api/src/db/tenant/schemas/categories.schema.ts
 * Stage: STAGE_30_CATEGORIES
 *
 * NOTE: The functional unique indexes below are migration-owned:
 *   - unique_categories_name  (LOWER(name))
 *   - unique_categories_code  (LOWER(code) WHERE code IS NOT NULL)
 * Drizzle cannot represent partial functional indexes, so they are
 * intentionally absent here. FK constraints are also migration-owned.
 *
 * CONCURRENT secondary indexes (parent_id, status) are Phase 2 in the
 * migration and are not declared in Drizzle schema.
 */

import { check, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 100 }),
    description: text('description'),
    parent_id: uuid('parent_id'),
    status: varchar('status', { length: 20 }).notNull().default('ENABLED'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    created_by: uuid('created_by'),
    updated_by: uuid('updated_by'),
  },
  (table) => ({
    statusCheck: check(
      'categories_status_check',
      `${table.status.name} IN ('ENABLED', 'DISABLED')`
    ),
    parentIdIdx: index('idx_categories_parent_id').on(table.parent_id),
    statusIdx: index('idx_categories_status').on(table.status),
    // unique_categories_name: migration-owned functional index (LOWER(name))
    // unique_categories_code: migration-owned partial functional index
    // FK constraints (parent_id, created_by, updated_by): migration-owned
  })
)

export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
