/**
 * Drizzle Schema — traditional_exam_sections (stub)
 *
 * File: apps/api/src/db/tenant/schemas/traditional-exam-sections.schema.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 *
 * Stub table — Stage 37 adds full columns via ALTER TABLE.
 */

import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'

export const traditionalExamSections = pgTable('traditional_exam_sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  exam_id: uuid('exam_id').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TraditionalExamSection = typeof traditionalExamSections.$inferSelect
export type NewTraditionalExamSection = typeof traditionalExamSections.$inferInsert
