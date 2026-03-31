/**
 * Drizzle Schema — mcq_question_options
 *
 * File: apps/api/src/db/tenant/schemas/mcq-question-options.schema.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 */

import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { mcqQuestions } from './mcq-questions.schema'

export const mcqQuestionOptions = pgTable(
  'mcq_question_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    question_id: uuid('question_id')
      .notNull()
      .references(() => mcqQuestions.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    is_correct: boolean('is_correct').notNull().default(false),
    order_index: integer('order_index').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('uq_mcq_question_options_question_order').on(table.question_id, table.order_index),
    index('idx_mcq_question_options_question_id').on(table.question_id),
  ]
)

export type McqQuestionOption = typeof mcqQuestionOptions.$inferSelect
export type NewMcqQuestionOption = typeof mcqQuestionOptions.$inferInsert
