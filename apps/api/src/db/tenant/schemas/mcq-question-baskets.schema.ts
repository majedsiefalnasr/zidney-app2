/**
 * Drizzle Schema — mcq_question_baskets
 *
 * File: apps/api/src/db/tenant/schemas/mcq-question-baskets.schema.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 */

import { index, pgTable, unique, uuid } from 'drizzle-orm/pg-core'
import { mcqBaskets } from './baskets.schema'
import { mcqQuestions } from './mcq-questions.schema'

export const mcqQuestionBaskets = pgTable(
  'mcq_question_baskets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    question_id: uuid('question_id')
      .notNull()
      .references(() => mcqQuestions.id, { onDelete: 'cascade' }),
    basket_id: uuid('basket_id')
      .notNull()
      .references(() => mcqBaskets.id, { onDelete: 'cascade' }),
  },
  (table) => [
    unique('uq_mcq_question_baskets').on(table.question_id, table.basket_id),
    index('idx_mcq_question_baskets_question_id').on(table.question_id),
    index('idx_mcq_question_baskets_basket_id').on(table.basket_id),
  ]
)

export type McqQuestionBasket = typeof mcqQuestionBaskets.$inferSelect
export type NewMcqQuestionBasket = typeof mcqQuestionBaskets.$inferInsert
