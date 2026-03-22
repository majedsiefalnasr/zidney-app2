/**
 * Drizzle ORM Schema — category_value_divisions
 *
 * File: apps/api/src/db/tenant/schemas/category-value-divisions.schema.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 *
 * NOTE: FK constraints are migration-owned.
 */

import { index, pgTable, unique, uuid } from 'drizzle-orm/pg-core'

export const categoryValueDivisions = pgTable(
  'category_value_divisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    category_value_id: uuid('category_value_id').notNull(),
    division_id: uuid('division_id').notNull(),
  },
  (table) => ({
    uniqueCategoryValueDivisions: unique('unique_category_value_divisions').on(
      table.category_value_id,
      table.division_id
    ),
    categoryValueIdIdx: index('idx_cv_divisions_category_value_id').on(table.category_value_id),
    divisionIdIdx: index('idx_cv_divisions_division_id').on(table.division_id),
    // FK constraints: migration-owned
  })
)

export type CategoryValueDivision = typeof categoryValueDivisions.$inferSelect
export type NewCategoryValueDivision = typeof categoryValueDivisions.$inferInsert
