/**
 * Drizzle ORM Schema — category_divisions
 *
 * File: apps/api/src/db/tenant/schemas/category-divisions.schema.ts
 * Stage: STAGE_30_CATEGORIES
 *
 * Join table: categories ↔ divisions (many-to-many).
 * FK constraints and CONCURRENT lookup index on division_id are migration-owned.
 */

import { index, pgTable, unique, uuid } from 'drizzle-orm/pg-core'

export const categoryDivisions = pgTable(
  'category_divisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    category_id: uuid('category_id').notNull(),
    division_id: uuid('division_id').notNull(),
  },
  (table) => ({
    uniqueCategoryDivisions: unique('unique_category_divisions').on(
      table.category_id,
      table.division_id
    ),
    categoryIdIdx: index('idx_category_divisions_category_id').on(table.category_id),
    divisionIdIdx: index('idx_category_divisions_division_id').on(table.division_id),
    // FK constraints (category_id → categories, division_id → divisions): migration-owned
  })
)

export type CategoryDivision = typeof categoryDivisions.$inferSelect
export type NewCategoryDivision = typeof categoryDivisions.$inferInsert
