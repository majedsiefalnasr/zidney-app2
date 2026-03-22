/**
 * Drizzle ORM Schema — category_value_subjects
 *
 * File: apps/api/src/db/tenant/schemas/category-value-subjects.schema.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 *
 * NOTE: FK constraints are migration-owned.
 */

import { index, pgTable, unique, uuid } from 'drizzle-orm/pg-core'

export const categoryValueSubjects = pgTable(
  'category_value_subjects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    category_value_id: uuid('category_value_id').notNull(),
    subject_id: uuid('subject_id').notNull(),
  },
  (table) => ({
    uniqueCategoryValueSubjects: unique('unique_category_value_subjects').on(
      table.category_value_id,
      table.subject_id
    ),
    categoryValueIdIdx: index('idx_cv_subjects_category_value_id').on(table.category_value_id),
    subjectIdIdx: index('idx_cv_subjects_subject_id').on(table.subject_id),
    // FK constraints: migration-owned
  })
)

export type CategoryValueSubject = typeof categoryValueSubjects.$inferSelect
export type NewCategoryValueSubject = typeof categoryValueSubjects.$inferInsert
