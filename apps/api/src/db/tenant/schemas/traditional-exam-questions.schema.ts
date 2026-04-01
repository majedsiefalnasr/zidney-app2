/**
 * Drizzle Schema — traditional_exam_questions
 *
 * File: apps/api/src/db/tenant/schemas/traditional-exam-questions.schema.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { traditionalExamSubsections } from './traditional-exam-subsections.schema'
import { traditionalQuestions } from './traditional-questions.schema'

export const traditionalExamQuestions = pgTable(
  'traditional_exam_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subsection_id: uuid('subsection_id')
      .notNull()
      .references(() => traditionalExamSubsections.id, { onDelete: 'cascade' }),
    question_id: uuid('question_id')
      .notNull()
      .references(() => traditionalQuestions.id, { onDelete: 'restrict' }),
    score: numeric('score', { precision: 10, scale: 2 }).notNull(),
    order_index: integer('order_index').notNull().default(0),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('traditional_exam_questions_score_check', sql`${table.score} > 0`),
    unique('uq_traditional_exam_questions_subsection_question').on(
      table.subsection_id,
      table.question_id
    ),
    index('idx_traditional_exam_questions_subsection_id').on(table.subsection_id),
    index('idx_traditional_exam_questions_question_id').on(table.question_id),
  ]
)

export type TraditionalExamQuestion = typeof traditionalExamQuestions.$inferSelect
export type NewTraditionalExamQuestion = typeof traditionalExamQuestions.$inferInsert
