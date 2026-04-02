/**
 * Drizzle Schema — attempt_questions
 *
 * File: apps/api/src/db/tenant/schemas/attempt-questions.schema.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 *
 * Immutable question-to-attempt assignment records.
 * Written once at attempt start. Never updated.
 * Enforces uniqueness of (attempt_id, question_id) to prevent duplicates.
 */

import { index, integer, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

export const attemptQuestions = pgTable(
  'attempt_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspace_id: uuid('workspace_id').notNull(),
    attempt_id: uuid('attempt_id').notNull(),
    question_id: uuid('question_id').notNull(),
    question_order: integer('question_order').notNull(),
    criteria_block_id: uuid('criteria_block_id'),
    assigned_at: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('uq_attempt_questions_attempt_question').on(table.attempt_id, table.question_id),
    index('idx_attempt_questions_attempt_id').on(table.attempt_id),
    index('idx_attempt_questions_workspace_attempt').on(table.workspace_id, table.attempt_id),
  ]
)

export type AttemptQuestion = typeof attemptQuestions.$inferSelect
export type NewAttemptQuestion = typeof attemptQuestions.$inferInsert
