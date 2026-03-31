/**
 * Drizzle Schema — traditional_questions, traditional_question_categories, traditional_question_tags
 *
 * File: apps/api/src/db/tenant/schemas/traditional-questions.schema.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 */

import { sql } from 'drizzle-orm'
import {
  check,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { categoryValues } from './category-values.schema'
import { subjects } from './subjects.schema'
import { tags } from './tags.schema'
import { traditionalExamSubsections } from './traditional-exam-subsections.schema'

// ── traditional_questions ─────────────────────────────────────────────────

export const traditionalQuestions = pgTable(
  'traditional_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subject_id: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    division_id: uuid('division_id'),
    lesson_id: uuid('lesson_id'),
    subsection_id: uuid('subsection_id')
      .notNull()
      .references(() => traditionalExamSubsections.id, { onDelete: 'restrict' }),
    question_type: varchar('question_type', { length: 20 }).notNull(),
    language: varchar('language', { length: 10 }).notNull(),
    content: text('content').notNull(),
    correct_answer: jsonb('correct_answer'),
    correction_criteria: jsonb('correction_criteria'),
    score: numeric('score', { precision: 10, scale: 2 }).notNull(),
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
      'traditional_questions_type_check',
      sql`${table.question_type} IN ('TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER')`
    ),
    check(
      'traditional_questions_status_check',
      sql`${table.status} IN ('DRAFT', 'COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED')`
    ),
    check('traditional_questions_score_check', sql`${table.score} > 0`),
    index('idx_traditional_questions_subject_id').on(table.subject_id),
    index('idx_traditional_questions_division_id').on(table.division_id),
    index('idx_traditional_questions_lesson_id').on(table.lesson_id),
    index('idx_traditional_questions_subsection_id').on(table.subsection_id),
    index('idx_traditional_questions_question_type').on(table.question_type),
    index('idx_traditional_questions_status').on(table.status),
    index('idx_traditional_questions_deleted_at').on(table.deleted_at),
  ]
)

export type TraditionalQuestion = typeof traditionalQuestions.$inferSelect
export type NewTraditionalQuestion = typeof traditionalQuestions.$inferInsert

// ── traditional_question_categories ───────────────────────────────────────

export const traditionalQuestionCategories = pgTable(
  'traditional_question_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    question_id: uuid('question_id')
      .notNull()
      .references(() => traditionalQuestions.id, { onDelete: 'cascade' }),
    category_value_id: uuid('category_value_id')
      .notNull()
      .references(() => categoryValues.id, { onDelete: 'cascade' }),
  },
  (table) => [
    unique('uq_traditional_question_categories').on(table.question_id, table.category_value_id),
    index('idx_traditional_question_categories_question_id').on(table.question_id),
    index('idx_traditional_question_categories_category_value_id').on(table.category_value_id),
  ]
)

export type TraditionalQuestionCategory = typeof traditionalQuestionCategories.$inferSelect
export type NewTraditionalQuestionCategory = typeof traditionalQuestionCategories.$inferInsert

// ── traditional_question_tags ─────────────────────────────────────────────

export const traditionalQuestionTags = pgTable(
  'traditional_question_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    question_id: uuid('question_id')
      .notNull()
      .references(() => traditionalQuestions.id, { onDelete: 'cascade' }),
    tag_id: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    unique('uq_traditional_question_tags').on(table.question_id, table.tag_id),
    index('idx_traditional_question_tags_question_id').on(table.question_id),
    index('idx_traditional_question_tags_tag_id').on(table.tag_id),
  ]
)

export type TraditionalQuestionTag = typeof traditionalQuestionTags.$inferSelect
export type NewTraditionalQuestionTag = typeof traditionalQuestionTags.$inferInsert
