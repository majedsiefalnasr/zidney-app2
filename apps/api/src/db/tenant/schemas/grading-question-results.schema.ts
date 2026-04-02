/**
 * Drizzle Schema — grading_question_results
 *
 * Stores per-question grading detail for each attempt.
 *
 * File: apps/api/src/db/tenant/schemas/grading-question-results.schema.ts
 * Stage: STAGE_40_GRADING_CORE
 * Schema: 1.25.0
 */

import { pgTable, uuid, numeric, boolean, varchar, timestamp, jsonb, uniqueIndex, index, foreignKey } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { gradingResults } from './grading-results.schema'

export const gradingQuestionResults = pgTable(
  'grading_question_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspace_id: uuid('workspace_id').notNull(),
    attempt_id: uuid('attempt_id').notNull(),
    grading_result_id: uuid('grading_result_id').notNull(),
    question_id: uuid('question_id').notNull(),
    question_type: varchar('question_type', { length: 30 }).notNull(),
    question_score: numeric('question_score', { precision: 10, scale: 2 }).notNull(),
    awarded_score: numeric('awarded_score', { precision: 10, scale: 2 }).notNull(),
    is_correct: boolean('is_correct').notNull(),
    user_response: jsonb('user_response'),
    correct_answer_snapshot: jsonb('correct_answer_snapshot'),
    grading_metadata: jsonb('grading_metadata'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_grading_question_results_attempt_question').on(
      table.workspace_id,
      table.attempt_id,
      table.question_id,
    ),
    index('idx_grading_question_results_workspace_attempt').on(table.workspace_id, table.attempt_id),
    index('idx_grading_question_results_grading_result').on(table.grading_result_id),
    foreignKey({
      columns: [table.grading_result_id],
      foreignColumns: [gradingResults.id],
    }),
    sql`CHECK (${table.awarded_score} >= 0 AND ${table.awarded_score} <= ${table.question_score})`,
    sql`CHECK (${table.question_type} IN ('MCQ_SINGLE', 'MCQ_MULTIPLE', 'MCQ_TRUE_FALSE', 'MCQ_ARRANGEMENT', 'TRADITIONAL_TRUE_FALSE', 'TRADITIONAL_FILL_BLANK', 'TRADITIONAL_SHORT_ANSWER'))`,
  ],
)

export type GradingQuestionResult = typeof gradingQuestionResults.$inferSelect
export type NewGradingQuestionResult = typeof gradingQuestionResults.$inferInsert
