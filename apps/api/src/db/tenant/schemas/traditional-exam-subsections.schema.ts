/**
 * Drizzle Schema — traditional_exam_subsections (stub)
 *
 * File: apps/api/src/db/tenant/schemas/traditional-exam-subsections.schema.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 *
 * Stub table — Stage 37 adds full columns via ALTER TABLE.
 */

import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { traditionalExamSections } from './traditional-exam-sections.schema'

export const traditionalExamSubsections = pgTable('traditional_exam_subsections', {
  id: uuid('id').primaryKey().defaultRandom(),
  section_id: uuid('section_id')
    .notNull()
    .references(() => traditionalExamSections.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TraditionalExamSubsection = typeof traditionalExamSubsections.$inferSelect
export type NewTraditionalExamSubsection = typeof traditionalExamSubsections.$inferInsert
