/**
 * Migration: Student Management Identity Columns
 *
 * File: apps/api/src/db/tenant/migrations/20260406_022_student_management.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 *
 * Purpose:
 * Add student identity and authentication columns to the `students` table:
 * - phone: optional contact number
 * - password_hash: argon2id password hash for frontoffice login
 * - subscription_status: ACTIVE | SUSPENDED | EXPIRED | NONE
 * - status: ACTIVE | DISABLED (replaces legacy is_active on users table)
 * - token_version: incremented on disable to invalidate all active JWTs
 * - failed_login_count: account lockout counter
 * - locked_until: timestamp for temporary account lockout
 *
 * Also adds two CHECK constraints and two partial indexes for query performance.
 *
 * Safety:
 * - All new columns are nullable or have safe defaults (no data loss)
 * - status defaults to 'ACTIVE' (existing rows remain accessible)
 * - subscription_status defaults to 'NONE'
 * - Idempotent: uses "IF NOT EXISTS" / "IF EXISTS" patterns
 *
 * Impact:
 * - Enables frontoffice-login.ts to query the students table directly
 * - Enables RBAC-based student status management from backoffice
 * - Removes dependency on legacy users table for student authentication
 *
 * References:
 * - ADR-0003: Database schema evolution
 * - AGENTS.md (apps/api): Migration governance
 * - Previous migration: 20260405_021_add_staff_hierarchy_levels_fkey.ts (version 1.27.0)
 */

import type { PoolClient } from 'pg'

// ---------------------------------------------------------------------------
// Migration Up
// ---------------------------------------------------------------------------

export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // ── 1. Add phone column ───────────────────────────────────────────────
    await client.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS phone VARCHAR(50) DEFAULT NULL
    `)

    // ── 2. Add password_hash column ───────────────────────────────────────
    await client.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT NULL
    `)

    // ── 3. Add subscription_status column ────────────────────────────────
    await client.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) NOT NULL DEFAULT 'NONE'
    `)

    // ── 4. Add status column ──────────────────────────────────────────────
    await client.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    `)

    // ── 5. Add token_version column ───────────────────────────────────────
    await client.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0
    `)

    // ── 6. Add failed_login_count column ─────────────────────────────────
    await client.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0
    `)

    // ── 7. Add locked_until column ────────────────────────────────────────
    await client.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ DEFAULT NULL
    `)

    // ── 8. Add CHECK constraint for status ───────────────────────────────
    await client.query(`
      ALTER TABLE students
        ADD CONSTRAINT IF NOT EXISTS chk_students_status
          CHECK (status IN ('ACTIVE', 'DISABLED'))
    `)

    // ── 9. Add CHECK constraint for subscription_status ──────────────────
    await client.query(`
      ALTER TABLE students
        ADD CONSTRAINT IF NOT EXISTS chk_students_subscription_status
          CHECK (subscription_status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'NONE'))
    `)

    // ── 10. Add partial index on status ──────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_students_status
        ON students (status)
        WHERE status != 'ACTIVE'
    `)

    // ── 11. Add partial index on subscription_status ─────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_students_subscription_status
        ON students (subscription_status)
        WHERE subscription_status != 'NONE'
    `)

    // ── 12. Add index on email for uniqueness check performance ──────────
    // (May already exist from bootstrap — IF NOT EXISTS is safe)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_students_email
        ON students (email)
    `)

    // ── 13. Bump schema version ────────────────────────────────────────────
    await client.query(`
      UPDATE workspace_schema_versions
        SET version    = '1.28.0',
            updated_at = NOW()
        WHERE 1=1
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// Migration Down (reverse — informational only, never run automatically)
// ---------------------------------------------------------------------------

export async function down(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // ── Drop indexes ──────────────────────────────────────────────────────
    await client.query(`DROP INDEX IF EXISTS idx_students_email`)
    await client.query(`DROP INDEX IF EXISTS idx_students_subscription_status`)
    await client.query(`DROP INDEX IF EXISTS idx_students_status`)

    // ── Drop constraints ──────────────────────────────────────────────────
    await client.query(`
      ALTER TABLE students DROP CONSTRAINT IF EXISTS chk_students_subscription_status
    `)
    await client.query(`
      ALTER TABLE students DROP CONSTRAINT IF EXISTS chk_students_status
    `)

    // ── Drop columns (reverse order) ─────────────────────────────────────
    await client.query(`ALTER TABLE students DROP COLUMN IF EXISTS locked_until`)
    await client.query(`ALTER TABLE students DROP COLUMN IF EXISTS failed_login_count`)
    await client.query(`ALTER TABLE students DROP COLUMN IF EXISTS token_version`)
    await client.query(`ALTER TABLE students DROP COLUMN IF EXISTS status`)
    await client.query(`ALTER TABLE students DROP COLUMN IF EXISTS subscription_status`)
    await client.query(`ALTER TABLE students DROP COLUMN IF EXISTS password_hash`)
    await client.query(`ALTER TABLE students DROP COLUMN IF EXISTS phone`)

    // ── Restore schema version ────────────────────────────────────────────
    await client.query(`
      UPDATE workspace_schema_versions
        SET version    = '1.27.0',
            updated_at = NOW()
        WHERE 1=1
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}
