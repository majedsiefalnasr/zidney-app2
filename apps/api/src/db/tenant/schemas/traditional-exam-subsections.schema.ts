/**
 * Drizzle Schema — traditional_exam_subsections
 *
 * File: apps/api/src/db/tenant/schemas/traditional-exam-subsections.schema.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG (expanded from stub)
 */

import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { traditionalExamSections } from './traditional-exam-sections.schema'

export const traditionalExamSubsections = pgTable(
  'traditional_exam_subsections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    section_id: uuid('section_id')
      .notNull()
      .references(() => traditionalExamSections.id, { onDelete: 'cascade' }),
    template_subsection_id: uuid('template_subsection_id'),
    header_content: text('header_content'),
    order_index: integer('order_index').notNull().default(0),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_traditional_exam_subsections_section_id').on(table.section_id)]
)

export type TraditionalExamSubsection = typeof traditionalExamSubsections.$inferSelect
export type NewTraditionalExamSubsection = typeof traditionalExamSubsections.$inferInsert
