/**
 * Drizzle Schema — grading_results
 *
 * Stores the aggregate attempt-level grading result.
 *
 * File: apps/api/src/db/tenant/schemas/grading-results.schema.ts
 * Stage: STAGE_40_GRADING_CORE
 * Schema: 1.25.0
 */

import { pgTable, uuid, numeric, boolean, varchar, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const gradingResults = pgTable(
  'grading_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspace_id: uuid('workspace_id').notNull(),
    attempt_id: uuid('attempt_id').notNull(),
    total_score: numeric('total_score', { precision: 10, scale: 2 }).notNull(),
    total_possible_score: numeric('total_possible_score', { precision: 10, scale: 2 }).notNull(),
    percentage: numeric('percentage', { precision: 5, scale: 2 }).notNull(),
    passed: boolean('passed').notNull(),
    pass_type: varchar('pass_type', { length: 10 }).notNull(),
    pass_value: numeric('pass_value', { precision: 10, scale: 2 }).notNull(),
    grading_version: varchar('grading_version', { length: 20 }).notNull(),
    graded_at: timestamp('graded_at', { withTimezone: true }).notNull().defaultNow(),
    graded_by: varchar('graded_by', { length: 10 }).notNull().default('ENGINE'),
    metadata: jsonb('metadata'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_grading_results_attempt').on(table.workspace_id, table.attempt_id),
    index('idx_grading_results_workspace_attempt').on(table.workspace_id, table.attempt_id),
    index('idx_grading_results_attempt').on(table.attempt_id),
    sql`CHECK (${table.pass_type} IN ('PERCENTAGE', 'SCORE'))`,
    sql`CHECK (${table.graded_by} IN ('ENGINE', 'SELF', 'ADMIN'))`,
    sql`CHECK (${table.percentage} >= 0 AND ${table.percentage} <= 100)`,
  ],
)

export type GradingResult = typeof gradingResults.$inferSelect
export type NewGradingResult = typeof gradingResults.$inferInsert
