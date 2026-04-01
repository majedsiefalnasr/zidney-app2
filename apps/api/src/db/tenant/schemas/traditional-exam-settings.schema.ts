/**
 * Drizzle Schema — traditional_exam_settings
 *
 * File: apps/api/src/db/tenant/schemas/traditional-exam-settings.schema.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

import { boolean, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { traditionalExams } from './traditional-exams.schema'

export const traditionalExamSettings = pgTable('traditional_exam_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  exam_id: uuid('exam_id')
    .notNull()
    .unique()
    .references(() => traditionalExams.id, { onDelete: 'cascade' }),
  shuffle_questions: boolean('shuffle_questions').notNull().default(false),
  shuffle_options: boolean('shuffle_options').notNull().default(false),
  show_results_immediately: boolean('show_results_immediately').notNull().default(false),
  allow_back_navigation: boolean('allow_back_navigation').notNull().default(true),
  auto_submit_on_timeout: boolean('auto_submit_on_timeout').notNull().default(true),
  show_question_score: boolean('show_question_score').notNull().default(false),
  require_answer_before_next: boolean('require_answer_before_next').notNull().default(false),
  show_remaining_time: boolean('show_remaining_time').notNull().default(true),
  allow_flag_questions: boolean('allow_flag_questions').notNull().default(true),
  enable_auto_grading: boolean('enable_auto_grading').notNull().default(false),
  message_template_id: uuid('message_template_id'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TraditionalExamSetting = typeof traditionalExamSettings.$inferSelect
export type NewTraditionalExamSetting = typeof traditionalExamSettings.$inferInsert
