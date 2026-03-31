/**
 * Drizzle Schema — mcq_question_tags
 *
 * File: apps/api/src/db/tenant/schemas/mcq-question-tags.schema.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 */

import { index, pgTable, unique, uuid } from 'drizzle-orm/pg-core'
import { mcqQuestions } from './mcq-questions.schema'
import { tags } from './tags.schema'

export const mcqQuestionTags = pgTable(
  'mcq_question_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    question_id: uuid('question_id')
      .notNull()
      .references(() => mcqQuestions.id, { onDelete: 'cascade' }),
    tag_id: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    unique('uq_mcq_question_tags').on(table.question_id, table.tag_id),
    index('idx_mcq_question_tags_question_id').on(table.question_id),
    index('idx_mcq_question_tags_tag_id').on(table.tag_id),
  ]
)

export type McqQuestionTag = typeof mcqQuestionTags.$inferSelect
export type NewMcqQuestionTag = typeof mcqQuestionTags.$inferInsert
