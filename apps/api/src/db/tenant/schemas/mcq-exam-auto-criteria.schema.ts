/**
 * Drizzle Schema — mcq_exam_auto_criteria
 *
 * File: apps/api/src/db/tenant/schemas/mcq-exam-auto-criteria.schema.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG (original)
 *        STAGE_39_AUTO_SELECTION_ENGINE (added fixed_count, category_ids, semester_id)
 */

import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { mcqExams } from './mcq-exams.schema'

export const mcqExamAutoCriteria = pgTable(
  'mcq_exam_auto_criteria',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    exam_id: uuid('exam_id')
      .notNull()
      .references(() => mcqExams.id, { onDelete: 'cascade' }),
    lesson_ids: sql`UUID[]`.as('lesson_ids'),
    category_value_ids: sql`UUID[]`.as('category_value_ids'),
    tag_ids: sql`UUID[]`.as('tag_ids'),
    basket_ids: sql`UUID[]`.as('basket_ids'),
    percentage: integer('percentage'),
    // Added in migration 018 (Stage 39)
    fixed_count: integer('fixed_count'),
    category_ids: sql`UUID[]`.as('category_ids'),
    semester_id: uuid('semester_id'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Allow either percentage (0-100) or fixed_count (>0), but not both
    check(
      'mcq_exam_auto_criteria_quota_check',
      sql`(${table.percentage} IS NOT NULL AND ${table.percentage} >= 0 AND ${table.percentage} <= 100 AND ${table.fixed_count} IS NULL)
        OR (${table.fixed_count} IS NOT NULL AND ${table.fixed_count} > 0 AND ${table.percentage} IS NULL)`
    ),
    index('idx_mcq_exam_auto_criteria_exam_id').on(table.exam_id),
  ]
)

export type McqExamAutoCriterion = typeof mcqExamAutoCriteria.$inferSelect
export type NewMcqExamAutoCriterion = typeof mcqExamAutoCriteria.$inferInsert
