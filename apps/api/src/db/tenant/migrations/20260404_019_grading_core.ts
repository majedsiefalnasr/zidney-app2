/**
 * Migration 019 — Grading Core
 *
 * File: apps/api/src/db/tenant/migrations/20260404_019_grading_core.ts
 * Stage: STAGE_40_GRADING_CORE
 * Schema: 1.24.0 → 1.25.0
 *
 * Additive-only. Never modifies or drops existing columns (only adds constraints).
 *
 * Changes in this migration (single transaction):
 *   1. Add `grading_status` column to `attempts`
 *   2. Drop old `valid_status` check constraint, add new one including 'GRADED'
 *   3. Add `valid_grading_status` check constraint to `attempts`
 *   4. Create `grading_results` table
 *   5. Create `grading_question_results` table with foreign key to grading_results
 *   6. Create `grading_overrides` table with foreign key to grading_results
 *   7. Create indexes for performance
 *   8. Bump schema version to 1.25.0
 */

import type { PoolClient } from 'pg'

export const description =
  'Add grading_status column to attempts. ' +
  'Create grading_results, grading_question_results, and grading_overrides tables. ' +
  'Bump schema version to 1.25.0.'

// ---------------------------------------------------------------------------
// Migration Up
// ---------------------------------------------------------------------------

export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // ── 1. Add grading_status column to attempts ──────────────────────────
    await client.query(`
      ALTER TABLE attempts
        ADD COLUMN IF NOT EXISTS grading_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    `)

    // ── 2. Update valid_status check to include GRADED ────────────────────
    await client.query(`
      ALTER TABLE attempts
        DROP CONSTRAINT IF EXISTS valid_status,
        ADD CONSTRAINT valid_status
          CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'FINALIZED', 'EXPIRED', 'ABORTED', 'GRADED'))
    `)

    // ── 3. Add valid_grading_status check constraint ──────────────────────
    await client.query(`
      ALTER TABLE attempts
        ADD CONSTRAINT valid_grading_status
          CHECK (grading_status IN ('PENDING', 'GRADING', 'GRADED', 'OVERRIDE'))
    `)

    // ── 4. Create grading_results table ──────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS grading_results (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id          UUID NOT NULL,
        attempt_id            UUID NOT NULL,
        total_score           NUMERIC(10, 2) NOT NULL,
        total_possible_score  NUMERIC(10, 2) NOT NULL,
        percentage            NUMERIC(5, 2) NOT NULL,
        passed                BOOLEAN NOT NULL,
        pass_type             VARCHAR(10) NOT NULL,
        pass_value            NUMERIC(10, 2) NOT NULL,
        grading_version       VARCHAR(20) NOT NULL,
        graded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        graded_by             VARCHAR(10) NOT NULL DEFAULT 'ENGINE',
        metadata              JSONB,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_grading_results_attempt UNIQUE (workspace_id, attempt_id),
        CONSTRAINT valid_pass_type CHECK (pass_type IN ('PERCENTAGE', 'SCORE')),
        CONSTRAINT valid_graded_by CHECK (graded_by IN ('ENGINE', 'SELF', 'ADMIN')),
        CONSTRAINT valid_percentage_range CHECK (percentage >= 0 AND percentage <= 100)
      )
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_grading_results_workspace_attempt
      ON grading_results (workspace_id, attempt_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_grading_results_attempt
      ON grading_results (attempt_id)
    `)

    // ── 5. Create grading_question_results table ─────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS grading_question_results (
        id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id             UUID NOT NULL,
        attempt_id               UUID NOT NULL,
        grading_result_id        UUID NOT NULL,
        question_id              UUID NOT NULL,
        question_type            VARCHAR(30) NOT NULL,
        question_score           NUMERIC(10, 2) NOT NULL,
        awarded_score            NUMERIC(10, 2) NOT NULL,
        is_correct               BOOLEAN NOT NULL,
        user_response            JSONB,
        correct_answer_snapshot  JSONB,
        grading_metadata         JSONB,
        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_grading_question_results_attempt_question
          UNIQUE (workspace_id, attempt_id, question_id),
        CONSTRAINT fk_grading_question_results_grading_result
          FOREIGN KEY (grading_result_id) REFERENCES grading_results(id),
        CONSTRAINT valid_awarded_score
          CHECK (awarded_score >= 0 AND awarded_score <= question_score),
        CONSTRAINT valid_question_type
          CHECK (question_type IN (
            'MCQ_SINGLE', 'MCQ_MULTIPLE', 'MCQ_TRUE_FALSE', 'MCQ_ARRANGEMENT',
            'TRADITIONAL_TRUE_FALSE', 'TRADITIONAL_FILL_BLANK', 'TRADITIONAL_SHORT_ANSWER'
          ))
      )
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_grading_question_results_workspace_attempt
      ON grading_question_results (workspace_id, attempt_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_grading_question_results_grading_result
      ON grading_question_results (grading_result_id)
    `)

    // ── 6. Create grading_overrides table ────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS grading_overrides (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id      UUID NOT NULL,
        attempt_id        UUID NOT NULL,
        grading_result_id UUID NOT NULL,
        previous_score    NUMERIC(10, 2) NOT NULL,
        new_score         NUMERIC(10, 2) NOT NULL,
        previous_passed   BOOLEAN NOT NULL,
        new_passed        BOOLEAN NOT NULL,
        override_reason   TEXT NOT NULL,
        override_user_id  UUID NOT NULL,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_grading_overrides_grading_result
          FOREIGN KEY (grading_result_id) REFERENCES grading_results(id)
      )
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_grading_overrides_attempt
      ON grading_overrides (attempt_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_grading_overrides_workspace
      ON grading_overrides (workspace_id)
    `)

    // ── 7. Bump schema version ───────────────────────────────────────────
    await client.query(`
      UPDATE schema_versions
        SET version = '1.25.0',
            updated_at = NOW()
        WHERE workspace_id IS NULL
    `)

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

// ---------------------------------------------------------------------------
// Migration Down
// ---------------------------------------------------------------------------

export async function down(client: PoolClient): Promise<void> {
  // ⚠️ Downgrade not supported for forward-only migration model.
  // This migration introduces new tables and constraints that cannot be safely rolled back.
  // If a rollback is required, use database restore from backup or manual intervention.
  throw new Error(
    'Downgrade not supported for migration 019_grading_core. ' +
    'This migration introduces immutable grading tables. Use database restore from backup instead.',
  )
}
