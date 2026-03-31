/**
 * Drizzle Schema — mcq_question_categories
 *
 * File: apps/api/src/db/tenant/schemas/mcq-question-categories.schema.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 */

import { index, pgTable, unique, uuid } from 'drizzle-orm/pg-core'
import { categoryValues } from './category-values.schema'
import { mcqQuestions } from './mcq-questions.schema'

export const mcqQuestionCategories = pgTable(
  'mcq_question_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    question_id: uuid('question_id')
      .notNull()
      .references(() => mcqQuestions.id, { onDelete: 'cascade' }),
    category_value_id: uuid('category_value_id')
      .notNull()
      .references(() => categoryValues.id, { onDelete: 'cascade' }),
  },
  (table) => [
    unique('uq_mcq_question_categories').on(table.question_id, table.category_value_id),
    index('idx_mcq_question_categories_question_id').on(table.question_id),
    index('idx_mcq_question_categories_category_value_id').on(table.category_value_id),
  ]
)

export type McqQuestionCategory = typeof mcqQuestionCategories.$inferSelect
export type NewMcqQuestionCategory = typeof mcqQuestionCategories.$inferInsert
