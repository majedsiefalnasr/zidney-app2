/**
 * Drizzle Schema — mcq_exams
 *
 * File: apps/api/src/db/tenant/schemas/mcq-exams.schema.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { subjects } from './subjects.schema'

export const mcqExams = pgTable(
  'mcq_exams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subject_id: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    division_id: uuid('division_id'),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 100 }).notNull(),
    description: text('description'),
    language: varchar('language', { length: 10 }).notNull(),
    total_questions: integer('total_questions').notNull(),
    duration_minutes: integer('duration_minutes'),
    pass_type: varchar('pass_type', { length: 20 }).notNull(),
    pass_value: numeric('pass_value', { precision: 10, scale: 2 }).notNull(),
    allow_multiple_attempts: boolean('allow_multiple_attempts').notNull().default(false),
    selection_mode: varchar('selection_mode', { length: 20 }).notNull(),
    status: varchar('status', { length: 30 }).notNull().default('COMPLETED'),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    created_by: uuid('created_by'),
    updated_by: uuid('updated_by'),
  },
  (table) => [
    check('mcq_exams_pass_type_check', sql`${table.pass_type} IN ('PERCENTAGE', 'SCORE')`),
    check(
      'mcq_exams_selection_mode_check',
      sql`${table.selection_mode} IN ('MANUAL', 'AUTOMATIC')`
    ),
    check(
      'mcq_exams_status_check',
      sql`${table.status} IN ('DRAFT', 'COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED')`
    ),
    check('mcq_exams_total_questions_check', sql`${table.total_questions} > 0`),
    check('mcq_exams_pass_value_check', sql`${table.pass_value} > 0`),
    index('idx_mcq_exams_subject_id').on(table.subject_id),
    index('idx_mcq_exams_division_id').on(table.division_id),
    index('idx_mcq_exams_status').on(table.status),
    index('idx_mcq_exams_selection_mode').on(table.selection_mode),
    index('idx_mcq_exams_deleted_at').on(table.deleted_at),
  ]
)

export type McqExam = typeof mcqExams.$inferSelect
export type NewMcqExam = typeof mcqExams.$inferInsert
