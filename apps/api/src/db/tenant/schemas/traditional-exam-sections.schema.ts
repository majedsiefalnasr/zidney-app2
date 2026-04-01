/**
 * Drizzle Schema — traditional_exam_sections
 *
 * File: apps/api/src/db/tenant/schemas/traditional-exam-sections.schema.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG (expanded from stub)
 */

import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { traditionalExams } from './traditional-exams.schema'

export const traditionalExamSections = pgTable(
  'traditional_exam_sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    exam_id: uuid('exam_id')
      .notNull()
      .references(() => traditionalExams.id, { onDelete: 'cascade' }),
    template_section_id: uuid('template_section_id'),
    header_content: text('header_content'),
    order_index: integer('order_index').notNull().default(0),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_traditional_exam_sections_exam_id').on(table.exam_id)]
)

export type TraditionalExamSection = typeof traditionalExamSections.$inferSelect
export type NewTraditionalExamSection = typeof traditionalExamSections.$inferInsert
