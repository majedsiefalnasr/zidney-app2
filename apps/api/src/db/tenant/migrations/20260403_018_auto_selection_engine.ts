/**
 * Migration 018 — Auto-Selection Engine
 *
 * File: apps/api/src/db/tenant/migrations/20260403_018_auto_selection_engine.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Schema: 1.23.0 → 1.24.0
 *
 * Additive-only. Never modifies or drops existing columns.
 *
 * Changes in this migration (single transaction):
 *   1. Add 3 columns to `attempts`: selection_seed, candidate_pool_fingerprint, selection_diagnostics
 *   2. Create `attempt_questions` table (immutable question assignments)
 *   3. Create `attempt_start_idempotency_claims` table (exactly-once semantics)
 *   4. Add 3 nullable columns to `mcq_exam_auto_criteria`: fixed_count, category_ids, semester_id
 *   5. Drop old check constraint on mcq_exam_auto_criteria.percentage and add new one allowing
 *      either percentage (0-100) OR fixed_count (>0), but not both null simultaneously
 *   6. Create supporting indexes for filter/lookup performance
 *   7. Bump schema version to 1.24.0
 */

import type { PoolClient } from 'pg'

export const description =
  'Add selection_seed, candidate_pool_fingerprint, selection_diagnostics to attempts. ' +
  'Create attempt_questions and attempt_start_idempotency_claims tables. ' +
  'Add fixed_count, category_ids, semester_id to mcq_exam_auto_criteria. ' +
  'Bump schema version to 1.24.0.'

// ---------------------------------------------------------------------------
// Migration Up
// ---------------------------------------------------------------------------

export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // ── 1. Add columns to attempts ─────────────────────────────────────────
    await client.query(`
      ALTER TABLE attempts
        ADD COLUMN IF NOT EXISTS selection_seed TEXT,
        ADD COLUMN IF NOT EXISTS candidate_pool_fingerprint TEXT,
        ADD COLUMN IF NOT EXISTS selection_diagnostics JSONB
    `)

    // ── 2. Create attempt_questions table ──────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS attempt_questions (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id      UUID NOT NULL,
        attempt_id        UUID NOT NULL,
        question_id       UUID NOT NULL,
        question_order    INTEGER NOT NULL,
        criteria_block_id UUID,
        assigned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_attempt_questions_attempt_question UNIQUE (attempt_id, question_id)
      )
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attempt_questions_attempt_id
      ON attempt_questions (attempt_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attempt_questions_workspace_attempt
      ON attempt_questions (workspace_id, attempt_id)
    `)

    // ── 3. Create attempt_start_idempotency_claims table ───────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS attempt_start_idempotency_claims (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id     UUID NOT NULL,
        user_id          UUID NOT NULL,
        exam_id          UUID NOT NULL,
        idempotency_key  TEXT NOT NULL,
        attempt_id       UUID,
        payload_hash     TEXT,
        claimed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at       TIMESTAMPTZ NOT NULL,
        CONSTRAINT uq_attempt_start_idempotency_key
          UNIQUE (workspace_id, user_id, exam_id, idempotency_key)
      )
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attempt_start_idempotency_claims_lookup
      ON attempt_start_idempotency_claims (workspace_id, user_id, exam_id, idempotency_key)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attempt_start_idempotency_claims_expiry
      ON attempt_start_idempotency_claims (expires_at)
    `)

    // ── 4. Add columns to mcq_exam_auto_criteria ───────────────────────────
    await client.query(`
      ALTER TABLE mcq_exam_auto_criteria
        ADD COLUMN IF NOT EXISTS fixed_count   INTEGER,
        ADD COLUMN IF NOT EXISTS category_ids  UUID[],
        ADD COLUMN IF NOT EXISTS semester_id   UUID
    `)

    // ── 5. Update check constraint on mcq_exam_auto_criteria ──────────────
    // Drop old constraint first (it only checked percentage 0-100)
    // then add new constraint: (percentage IS NOT NULL AND percentage BETWEEN 0 AND 100)
    //                       OR (fixed_count IS NOT NULL AND fixed_count > 0)
    await client.query(`
      ALTER TABLE mcq_exam_auto_criteria
        DROP CONSTRAINT IF EXISTS mcq_exam_auto_criteria_percentage_check
    `)

    await client.query(`
      ALTER TABLE mcq_exam_auto_criteria
        ADD CONSTRAINT mcq_exam_auto_criteria_quota_check
        CHECK (
          (percentage IS NOT NULL AND percentage >= 0 AND percentage <= 100 AND fixed_count IS NULL)
          OR
          (fixed_count IS NOT NULL AND fixed_count > 0 AND percentage IS NULL)
        )
    `)

    // ── 6. Schema Version Bump ─────────────────────────────────────────────
    await client.query(`
      UPDATE _schema_versions
      SET version = '1.24.0', updated_at = NOW()
      WHERE version = '1.23.0'
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// Migration Down (rollback)
// ---------------------------------------------------------------------------

export async function down(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // Restore original percentage constraint
    await client.query(`
      ALTER TABLE mcq_exam_auto_criteria
        DROP CONSTRAINT IF EXISTS mcq_exam_auto_criteria_quota_check
    `)

    await client.query(`
      ALTER TABLE mcq_exam_auto_criteria
        ADD CONSTRAINT mcq_exam_auto_criteria_percentage_check
        CHECK (percentage >= 0 AND percentage <= 100)
    `)

    await client.query(`
      ALTER TABLE mcq_exam_auto_criteria
        DROP COLUMN IF EXISTS semester_id,
        DROP COLUMN IF EXISTS category_ids,
        DROP COLUMN IF EXISTS fixed_count
    `)

    await client.query('DROP INDEX IF EXISTS idx_attempt_start_idempotency_claims_expiry')
    await client.query('DROP INDEX IF EXISTS idx_attempt_start_idempotency_claims_lookup')
    await client.query('DROP TABLE IF EXISTS attempt_start_idempotency_claims')

    await client.query('DROP INDEX IF EXISTS idx_attempt_questions_workspace_attempt')
    await client.query('DROP INDEX IF EXISTS idx_attempt_questions_attempt_id')
    await client.query('DROP TABLE IF EXISTS attempt_questions')

    await client.query(`
      ALTER TABLE attempts
        DROP COLUMN IF EXISTS selection_diagnostics,
        DROP COLUMN IF EXISTS candidate_pool_fingerprint,
        DROP COLUMN IF EXISTS selection_seed
    `)

    await client.query(`
      UPDATE _schema_versions
      SET version = '1.23.0', updated_at = NOW()
      WHERE version = '1.24.0'
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}
