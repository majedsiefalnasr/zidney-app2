/**
 * Migration 017 — Add Scheduled Exam Fields to Attempts
 *
 * File: apps/api/src/db/tenant/migrations/20260402_017_add_scheduled_fields_to_attempts.ts
 * Stage: STAGE_38_SCHEDULED_EXAM_ENGINE
 * Schema: 1.22.0 → 1.23.0
 *
 * Single phase (BEGIN/COMMIT only, no CONCURRENT indexes):
 *   - Adds 6 columns to `attempts` table
 *   - Adds 3 partial indexes inside the transaction
 */

import type { PoolClient } from 'pg'

export const description =
  'Add is_scheduled, scheduled_exam_id, scheduled_end_time, auto_submitted, forced_submission_reason, last_heartbeat_at columns to attempts. Add 3 partial indexes. Bump schema version to 1.23.0.'

// ---------------------------------------------------------------------------
// Migration Up
// ---------------------------------------------------------------------------

export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // ── Add columns to attempts ────────────────────────────────────────────
    await client.query(`
      ALTER TABLE attempts ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN NOT NULL DEFAULT false
    `)

    await client.query(`
      ALTER TABLE attempts ADD COLUMN IF NOT EXISTS scheduled_exam_id UUID
    `)

    await client.query(`
      ALTER TABLE attempts ADD COLUMN IF NOT EXISTS scheduled_end_time TIMESTAMPTZ
    `)

    await client.query(`
      ALTER TABLE attempts ADD COLUMN IF NOT EXISTS auto_submitted BOOLEAN NOT NULL DEFAULT false
    `)

    await client.query(`
      ALTER TABLE attempts ADD COLUMN IF NOT EXISTS forced_submission_reason VARCHAR(50)
        CONSTRAINT attempts_forced_submission_reason_check
        CHECK (forced_submission_reason IN ('ATTEMPT_TIME_EXCEEDED', 'SCHEDULED_END_REACHED', 'CONNECTION_TIMEOUT'))
    `)

    await client.query(`
      ALTER TABLE attempts ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ
    `)

    // ── Partial Indexes ────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attempts_scheduled_exam_id
      ON attempts (scheduled_exam_id, workspace_id) WHERE scheduled_exam_id IS NOT NULL
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attempts_scheduled_active
      ON attempts (workspace_id, scheduled_exam_id, status)
      WHERE is_scheduled = true AND status = 'IN_PROGRESS'
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attempts_heartbeat_expiry
      ON attempts (last_heartbeat_at)
      WHERE is_scheduled = true AND status = 'IN_PROGRESS'
    `)

    // ── Schema Version Bump ────────────────────────────────────────────────
    await client.query(`
      UPDATE _schema_versions
      SET version = '1.23.0', updated_at = NOW()
      WHERE version = '1.22.0'
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
    await client.query('DROP INDEX IF EXISTS idx_attempts_heartbeat_expiry')
    await client.query('DROP INDEX IF EXISTS idx_attempts_scheduled_active')
    await client.query('DROP INDEX IF EXISTS idx_attempts_scheduled_exam_id')

    await client.query(`
      ALTER TABLE attempts
        DROP COLUMN IF EXISTS last_heartbeat_at,
        DROP COLUMN IF EXISTS forced_submission_reason,
        DROP COLUMN IF EXISTS auto_submitted,
        DROP COLUMN IF EXISTS scheduled_end_time,
        DROP COLUMN IF EXISTS scheduled_exam_id,
        DROP COLUMN IF EXISTS is_scheduled
    `)

    await client.query(`
      UPDATE _schema_versions
      SET version = '1.22.0', updated_at = NOW()
      WHERE version = '1.23.0'
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}
