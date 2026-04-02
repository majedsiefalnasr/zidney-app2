/**
 * Drizzle Schema — attempts
 *
 * File: apps/api/src/db/tenant/schemas/attempts.schema.ts
 * Stage: STAGE_38_SCHEDULED_EXAM_ENGINE (columns added in migration 017)
 *        STAGE_39_AUTO_SELECTION_ENGINE (columns added in migration 018)
 *
 * Covers all existing attempts table columns (from v1.0.0/001_create_attempt_engine_tables.sql)
 * plus the 6 new scheduled exam columns added in migration 017,
 * plus the 3 auto-selection columns added in migration 018.
 */

import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const attempts = pgTable(
  'attempts',
  {
    // ── Identification ───────────────────────────────────────────
    id: uuid('id').primaryKey().defaultRandom(),
    workspace_id: uuid('workspace_id').notNull(),
    user_id: uuid('user_id').notNull(),
    attempt_type: varchar('attempt_type', { length: 50 }).notNull(),
    exam_id: uuid('exam_id').notNull(),

    // ── Snapshot Fields (IMMUTABLE after start) ──────────────────
    question_snapshot: jsonb('question_snapshot').notNull(),
    question_order: text('question_order').array().notNull(),
    grading_config_snapshot: jsonb('grading_config_snapshot').notNull(),
    mode: varchar('mode', { length: 20 }).notNull(),
    flags_snapshot: jsonb('flags_snapshot').notNull(),
    time_limit_snapshot: bigint('time_limit_snapshot', { mode: 'number' }),
    exam_version: varchar('exam_version', { length: 20 }).notNull(),
    expected_schema_version: integer('expected_schema_version').notNull(),
    expected_product_version: varchar('expected_product_version', { length: 20 }).notNull(),

    // ── Timing Fields ────────────────────────────────────────────
    started_at: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    submitted_at: timestamp('submitted_at', { withTimezone: true }),
    finalized_at: timestamp('finalized_at', { withTimezone: true }),
    server_start_time: timestamp('server_start_time', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // ── Attempt-Level Configuration ──────────────────────────────
    certificate_enabled: boolean('certificate_enabled').notNull().default(false),
    single_attempt_rule: boolean('single_attempt_rule').notNull().default(false),

    // ── Attempt Status & Results ─────────────────────────────────
    status: varchar('status', { length: 20 }).notNull().default('IN_PROGRESS'),
    score: numeric('score', { precision: 5, scale: 2 }),
    passed: boolean('passed'),
    result_snapshot: jsonb('result_snapshot'),

    // ── Audit ────────────────────────────────────────────────────
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

    // ── Scheduled Exam Fields (added in migration 017) ───────────
    is_scheduled: boolean('is_scheduled').notNull().default(false),
    scheduled_exam_id: uuid('scheduled_exam_id'),
    scheduled_end_time: timestamp('scheduled_end_time', { withTimezone: true }),
    auto_submitted: boolean('auto_submitted').notNull().default(false),
    forced_submission_reason: varchar('forced_submission_reason', { length: 50 }),
    last_heartbeat_at: timestamp('last_heartbeat_at', { withTimezone: true }),

    // ── Auto-Selection Fields (added in migration 018) ────────────
    selection_seed: text('selection_seed'),
    candidate_pool_fingerprint: text('candidate_pool_fingerprint'),
    selection_diagnostics: jsonb('selection_diagnostics'),
  },
  (table) => [
    check(
      'valid_status',
      sql`${table.status} IN ('IN_PROGRESS', 'SUBMITTED', 'FINALIZED', 'EXPIRED', 'ABORTED')`
    ),
    check('valid_mode', sql`${table.mode} IN ('RELAX', 'CHRONO', 'RUSH')`),
    check(
      'valid_attempt_type',
      sql`${table.attempt_type} IN ('MCQ_ASSESSMENT', 'MCQ_EXAM', 'MCQ_SCHEDULED', 'TOPIC_EXAM', 'EXERCISE_EXAM', 'TRADITIONAL_SCHEDULED')`
    ),
    check(
      'valid_score_range',
      sql`${table.score} IS NULL OR (${table.score} >= 0 AND ${table.score} <= 100)`
    ),
    index('idx_attempts_workspace_user_exam').on(
      table.workspace_id,
      table.user_id,
      table.exam_id,
      table.status
    ),
    index('idx_attempts_scheduled_exam_id')
      .on(table.scheduled_exam_id, table.workspace_id)
      .where(sql`${table.scheduled_exam_id} IS NOT NULL`),
    index('idx_attempts_scheduled_active')
      .on(table.workspace_id, table.scheduled_exam_id, table.status)
      .where(sql`${table.is_scheduled} = true AND ${table.status} = 'IN_PROGRESS'`),
    index('idx_attempts_heartbeat_expiry')
      .on(table.last_heartbeat_at)
      .where(sql`${table.is_scheduled} = true AND ${table.status} = 'IN_PROGRESS'`),
  ]
)

export type Attempt = typeof attempts.$inferSelect
export type NewAttempt = typeof attempts.$inferInsert
