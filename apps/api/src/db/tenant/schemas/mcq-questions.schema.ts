/**
 * Drizzle Schema — mcq_questions
 *
 * File: apps/api/src/db/tenant/schemas/mcq-questions.schema.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 */

import { sql } from 'drizzle-orm'
import { boolean, check, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { subjects } from './subjects.schema'

export const mcqQuestions = pgTable(
  'mcq_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subject_id: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    division_id: uuid('division_id'),
    lesson_id: uuid('lesson_id'),
    question_type: varchar('question_type', { length: 20 }).notNull(),
    language: varchar('language', { length: 10 }).notNull(),
    content: text('content').notNull(),
    explanation: text('explanation'),
    is_revision_only: boolean('is_revision_only').notNull().default(false),
    is_exam_only: boolean('is_exam_only').notNull().default(false),
    status: varchar('status', { length: 30 }).notNull().default('DRAFT'),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    created_by: uuid('created_by'),
    updated_by: uuid('updated_by'),
    status_updated_at: timestamp('status_updated_at', { withTimezone: true }),
    status_updated_by: uuid('status_updated_by'),
  },
  (table) => [
    check(
      'mcq_questions_type_check',
      sql`${table.question_type} IN ('SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'ARRANGEMENT')`
    ),
    check(
      'mcq_questions_status_check',
      sql`${table.status} IN ('DRAFT', 'COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED')`
    ),
    index('idx_mcq_questions_subject_id').on(table.subject_id),
    index('idx_mcq_questions_division_id').on(table.division_id),
    index('idx_mcq_questions_lesson_id').on(table.lesson_id),
    index('idx_mcq_questions_question_type').on(table.question_type),
    index('idx_mcq_questions_status').on(table.status),
    index('idx_mcq_questions_deleted_at').on(table.deleted_at),
  ]
)

export type McqQuestion = typeof mcqQuestions.$inferSelect
export type NewMcqQuestion = typeof mcqQuestions.$inferInsert
