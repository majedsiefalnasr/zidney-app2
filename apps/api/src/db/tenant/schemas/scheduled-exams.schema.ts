/**
 * Drizzle Schema — scheduled_exams
 *
 * File: apps/api/src/db/tenant/schemas/scheduled-exams.schema.ts
 * Stage: STAGE_38_SCHEDULED_EXAM_ENGINE
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const scheduledExams = pgTable(
  'scheduled_exams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    base_exam_id: uuid('base_exam_id').notNull(),
    base_exam_type: varchar('base_exam_type', { length: 30 }).notNull(),
    workspace_id: uuid('workspace_id').notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    code: varchar('code', { length: 100 }).notNull(),
    instructions: text('instructions'),
    status: varchar('status', { length: 30 }).notNull().default('DRAFT'),
    total_marks: numeric('total_marks', { precision: 10, scale: 2 }).notNull(),
    pass_mark: numeric('pass_mark', { precision: 10, scale: 2 }).notNull(),
    duration_minutes: integer('duration_minutes'),
    window_start: timestamp('window_start', { withTimezone: true }).notNull(),
    window_end: timestamp('window_end', { withTimezone: true }).notNull(),
    question_pool_id: uuid('question_pool_id'),
    base_exam_snapshot: jsonb('base_exam_snapshot'),
    base_exam_hash: varchar('base_exam_hash', { length: 64 }),
    base_exam_modified: boolean('base_exam_modified').notNull().default(false),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    created_by: uuid('created_by'),
    updated_by: uuid('updated_by'),
  },
  (table) => [
    check(
      'scheduled_exams_base_exam_type_check',
      sql`${table.base_exam_type} IN ('MCQ_EXAM', 'TRADITIONAL_EXAM')`
    ),
    check(
      'scheduled_exams_status_check',
      sql`${table.status} IN ('DRAFT','UNDER_REVIEW','APPROVED','ENABLED','DISABLED','ARCHIVED')`
    ),
    check('scheduled_exams_pass_mark_check', sql`${table.pass_mark} > 0`),
    check('scheduled_exams_total_marks_check', sql`${table.total_marks} > 0`),
    check('scheduled_exams_window_check', sql`${table.window_end} > ${table.window_start}`),
    index('idx_scheduled_exams_workspace_id').on(table.workspace_id),
    index('idx_scheduled_exams_base_exam_id').on(table.base_exam_id),
    index('idx_scheduled_exams_workspace_status')
      .on(table.workspace_id, table.status)
      .where(sql`${table.deleted_at} IS NULL`),
    index('idx_scheduled_exams_workspace_window')
      .on(table.workspace_id, table.window_start, table.window_end)
      .where(sql`${table.deleted_at} IS NULL`),
  ]
)

export type ScheduledExam = typeof scheduledExams.$inferSelect
export type NewScheduledExam = typeof scheduledExams.$inferInsert
