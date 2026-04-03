/**
 * Migration 020 — Staff Management
 *
 * File: apps/api/src/db/tenant/migrations/20260404_020_staff_management.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 * Schema: 1.25.0 → 1.26.0
 *
 * Additive-only. Never modifies or drops existing columns (only adds new ones).
 *
 * Changes in this migration (single transaction):
 *   1. ALTER password_hash from VARCHAR(72) to TEXT (Argon2id hashes are ~97 chars)
 *   2. ADD status VARCHAR(20) with CHECK constraint (ACTIVE | INACTIVE | SUSPENDED)
 *   3. ADD failed_login_count INTEGER DEFAULT 0
 *   4. ADD locked_until TIMESTAMPTZ nullable
 *   5. ADD last_login TIMESTAMPTZ nullable
 *   6. Backfill status from is_active (true → ACTIVE, false → INACTIVE)
 *   7. CREATE staff_hierarchy_levels table
 *   8. Bump schema version to 1.26.0
 */

import type { PoolClient } from 'pg'

export const description =
  'Extend backoffice_staff_users with Argon2id-compatible password_hash (TEXT), ' +
  'explicit status column, account lock fields. ' +
  'Create staff_hierarchy_levels table. ' +
  'Bump schema version to 1.26.0.'

// ---------------------------------------------------------------------------
// Migration Up
// ---------------------------------------------------------------------------

export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // ── 1. Widen password_hash from VARCHAR(72) to TEXT ──────────────────
    // Argon2id encoded output is ~97 characters, well beyond the 72-byte bcrypt limit.
    await client.query(`
      ALTER TABLE backoffice_staff_users
        ALTER COLUMN password_hash TYPE TEXT
    `)

    // ── 2. Add status column ──────────────────────────────────────────────
    await client.query(`
      ALTER TABLE backoffice_staff_users
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    `)

    await client.query(`
      ALTER TABLE backoffice_staff_users
        ADD CONSTRAINT bsu_valid_status
          CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'))
    `)

    // ── 3. Backfill status from is_active ─────────────────────────────────
    // Existing rows: is_active=false → INACTIVE, true → ACTIVE (already default)
    await client.query(`
      UPDATE backoffice_staff_users
        SET status = 'INACTIVE'
        WHERE is_active = false
    `)

    // ── 4. Add failed_login_count ─────────────────────────────────────────
    await client.query(`
      ALTER TABLE backoffice_staff_users
        ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0
    `)

    // ── 5. Add locked_until ───────────────────────────────────────────────
    await client.query(`
      ALTER TABLE backoffice_staff_users
        ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ
    `)

    // ── 6. Add last_login ─────────────────────────────────────────────────
    await client.query(`
      ALTER TABLE backoffice_staff_users
        ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ
    `)

    // ── 7. Create staff_hierarchy_levels table ────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_hierarchy_levels (
        staff_id           UUID NOT NULL REFERENCES backoffice_staff_users(id) ON DELETE CASCADE,
        hierarchy_node_id  UUID NOT NULL,
        workspace_id       UUID NOT NULL,
        assigned_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (staff_id, hierarchy_node_id)
      )
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_shl_workspace_id
        ON staff_hierarchy_levels (workspace_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_shl_hierarchy_node_id
        ON staff_hierarchy_levels (hierarchy_node_id)
    `)

    // ── 8. Bump schema version ────────────────────────────────────────────
    await client.query(`
      UPDATE workspace_schema_versions
        SET version = '1.26.0',
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
    await client.query('DROP TABLE IF EXISTS staff_hierarchy_levels')
    await client.query(`
      ALTER TABLE backoffice_staff_users
        DROP COLUMN IF EXISTS last_login,
        DROP COLUMN IF EXISTS locked_until,
        DROP COLUMN IF EXISTS failed_login_count,
        DROP CONSTRAINT IF EXISTS bsu_valid_status,
        DROP COLUMN IF EXISTS status
        -- WARNING: reverting password_hash to a short VARCHAR type is intentionally omitted.
        -- Argon2id hashes are ~97 chars; VARCHAR(72) would truncate them and corrupt credentials.
        -- Do NOT alter password_hash type in a rollback without a full credential migration plan.
    `)
    await client.query(`
      UPDATE workspace_schema_versions
        SET version = '1.25.0', updated_at = NOW()
        WHERE 1=1
    `)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}
