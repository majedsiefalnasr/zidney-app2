/**
 * Drizzle Schema — mcq_exam_questions
 *
 * File: apps/api/src/db/tenant/schemas/mcq-exam-questions.schema.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 */

import { index, integer, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { mcqExams } from './mcq-exams.schema'
import { mcqQuestions } from './mcq-questions.schema'

export const mcqExamQuestions = pgTable(
  'mcq_exam_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    exam_id: uuid('exam_id')
      .notNull()
      .references(() => mcqExams.id, { onDelete: 'cascade' }),
    question_id: uuid('question_id')
      .notNull()
      .references(() => mcqQuestions.id, { onDelete: 'restrict' }),
    order_index: integer('order_index').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('mcq_exam_questions_exam_question_unique').on(table.exam_id, table.question_id),
    uniqueIndex('mcq_exam_questions_exam_order_unique').on(table.exam_id, table.order_index),
    index('idx_mcq_exam_questions_exam_id').on(table.exam_id),
    index('idx_mcq_exam_questions_question_id').on(table.question_id),
  ]
)

export type McqExamQuestion = typeof mcqExamQuestions.$inferSelect
export type NewMcqExamQuestion = typeof mcqExamQuestions.$inferInsert
