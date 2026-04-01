/**
 * Drizzle Schema — traditional_exams
 *
 * File: apps/api/src/db/tenant/schemas/traditional-exams.schema.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

import { sql } from 'drizzle-orm'
import {
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

export const traditionalExams = pgTable(
  'traditional_exams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subject_id: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    division_id: uuid('division_id'),
    semester_id: uuid('semester_id'),
    template_id: uuid('template_id').notNull(),
    name: varchar('name', { length: 500 }).notNull(),
    code: varchar('code', { length: 100 }).notNull(),
    description: text('description'),
    duration_minutes: integer('duration_minutes'),
    pass_percentage: numeric('pass_percentage', { precision: 5, scale: 2 }).notNull(),
    module_type: varchar('module_type', { length: 20 }).notNull(),
    status: varchar('status', { length: 30 }).notNull().default('DRAFT'),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    created_by: uuid('created_by'),
    updated_by: uuid('updated_by'),
  },
  (table) => [
    check(
      'traditional_exams_pass_percentage_check',
      sql`${table.pass_percentage} > 0 AND ${table.pass_percentage} <= 100`
    ),
    check(
      'traditional_exams_module_type_check',
      sql`${table.module_type} IN ('TOPIC', 'EXERCISE')`
    ),
    check(
      'traditional_exams_status_check',
      sql`${table.status} IN ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ENABLED', 'DISABLED')`
    ),
    index('idx_traditional_exams_subject_id').on(table.subject_id),
    index('idx_traditional_exams_division_id').on(table.division_id),
    index('idx_traditional_exams_status').on(table.status),
    index('idx_traditional_exams_module_type').on(table.module_type),
    index('idx_traditional_exams_template_id').on(table.template_id),
  ]
)

export type TraditionalExam = typeof traditionalExams.$inferSelect
export type NewTraditionalExam = typeof traditionalExams.$inferInsert
