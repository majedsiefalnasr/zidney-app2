/**
 * Drizzle Schema — grading_overrides
 *
 * Audit trail for admin score overrides.
 *
 * File: apps/api/src/db/tenant/schemas/grading-overrides.schema.ts
 * Stage: STAGE_40_GRADING_CORE
 * Schema: 1.25.0
 */

import {
  boolean,
  foreignKey,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { gradingResults } from './grading-results.schema'

export const gradingOverrides = pgTable(
  'grading_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspace_id: uuid('workspace_id').notNull(),
    attempt_id: uuid('attempt_id').notNull(),
    grading_result_id: uuid('grading_result_id').notNull(),
    previous_score: numeric('previous_score', { precision: 10, scale: 2 }).notNull(),
    new_score: numeric('new_score', { precision: 10, scale: 2 }).notNull(),
    previous_passed: boolean('previous_passed').notNull(),
    new_passed: boolean('new_passed').notNull(),
    override_reason: text('override_reason').notNull(),
    override_user_id: uuid('override_user_id').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_grading_overrides_attempt').on(table.attempt_id),
    index('idx_grading_overrides_workspace').on(table.workspace_id),
    foreignKey({
      columns: [table.grading_result_id],
      foreignColumns: [gradingResults.id],
    }),
  ]
)

export type GradingOverride = typeof gradingOverrides.$inferSelect
export type NewGradingOverride = typeof gradingOverrides.$inferInsert
