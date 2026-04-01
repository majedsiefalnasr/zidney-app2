/**
 * Drizzle Schema — mcq_exam_settings
 *
 * File: apps/api/src/db/tenant/schemas/mcq-exam-settings.schema.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 */

import { boolean, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { mcqExams } from './mcq-exams.schema'

export const mcqExamSettings = pgTable(
  'mcq_exam_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    exam_id: uuid('exam_id')
      .notNull()
      .references(() => mcqExams.id, { onDelete: 'cascade' }),
    allow_relax_mode: boolean('allow_relax_mode').notNull().default(true),
    allow_chrono_mode: boolean('allow_chrono_mode').notNull().default(false),
    allow_rush_mode: boolean('allow_rush_mode').notNull().default(false),
    allow_review_answers: boolean('allow_review_answers').notNull().default(true),
    allow_review_hints: boolean('allow_review_hints').notNull().default(false),
    allow_result_effects: boolean('allow_result_effects').notNull().default(true),
    show_results_after_submit: boolean('show_results_after_submit').notNull().default(true),
    show_correct_answers: boolean('show_correct_answers').notNull().default(false),
    show_explanations: boolean('show_explanations').notNull().default(false),
    enable_certificate: boolean('enable_certificate').notNull().default(false),
    message_template_id: uuid('message_template_id'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('idx_mcq_exam_settings_exam_id').on(table.exam_id)]
)

export type McqExamSetting = typeof mcqExamSettings.$inferSelect
export type NewMcqExamSetting = typeof mcqExamSettings.$inferInsert
