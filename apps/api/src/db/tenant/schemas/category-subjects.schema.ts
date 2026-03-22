/**
 * Drizzle ORM Schema — category_subjects
 *
 * File: apps/api/src/db/tenant/schemas/category-subjects.schema.ts
 * Stage: STAGE_30_CATEGORIES
 *
 * Join table: categories ↔ subjects (many-to-many).
 * FK constraints and CONCURRENT lookup index on subject_id are migration-owned.
 */

import { index, pgTable, unique, uuid } from 'drizzle-orm/pg-core'

export const categorySubjects = pgTable(
  'category_subjects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    category_id: uuid('category_id').notNull(),
    subject_id: uuid('subject_id').notNull(),
  },
  (table) => ({
    uniqueCategorySubjects: unique('unique_category_subjects').on(
      table.category_id,
      table.subject_id
    ),
    categoryIdIdx: index('idx_category_subjects_category_id').on(table.category_id),
    subjectIdIdx: index('idx_category_subjects_subject_id').on(table.subject_id),
    // FK constraints (category_id → categories, subject_id → subjects): migration-owned
  })
)

export type CategorySubject = typeof categorySubjects.$inferSelect
export type NewCategorySubject = typeof categorySubjects.$inferInsert
