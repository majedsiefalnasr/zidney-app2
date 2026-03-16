/**
 * Tenant Database Migration — Divisions
 *
 * File: apps/api/src/db/tenant/migrations/20260316_001_divisions.ts
 * Date: 2026-03-16
 * Stage: STAGE_22_DIVISIONS
 * Phase: 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE
 *
 * Purpose:
 * 1. CREATE divisions table (if not exists) OR ADD missing columns to existing table
 * 2. CREATE staff_divisions join table (staff_id, division_id, assigned_at; composite PK)
 * 3. ALTER workspace_settings — ADD divisions_enabled BOOLEAN NOT NULL DEFAULT true
 * 4. ALTER students — ADD division_id UUID (nullable initially)
 * 5. Backfill students.division_id with the default division ID
 * 6. ALTER students.division_id — SET NOT NULL
 * 7. ADD FK: students.division_id REFERENCES divisions(id) ON DELETE RESTRICT
 * 8. UPDATE schema_version 1.4.0 → 1.5.0
 *
 * Migration handles two scenarios:
 * - Fresh tenant (no prior divisions table): CREATE TABLE creates the full schema
 * - Existing tenant (old divisions table from 004-create-core-application-tables.sql):
 *   ADD COLUMN IF NOT EXISTS steps upgrade the schema; old UNIQUE(name) constraint
 *   is replaced with the case-insensitive functional index.
 *
 * Constitutional Compliance:
 * ✓ Tenant DB only — no master_db schema changes
 * ✓ Forward-only migration — down() throws per ADR-0008
 * ✓ All DDL in single transactional BEGIN/COMMIT block
 * ✓ CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS for idempotency
 * ✓ Additive-only — no existing table or column is dropped
 * ✓ schema_version bumped from 1.4.0 to 1.5.0
 * ✓ Server-authoritative timestamps (NOW())
 * ✓ Backfill uses default division (seeded by prior bootstrap migrations)
 *
 * ADR References:
 * - ADR-0001: Database-per-tenant isolation
 * - ADR-0006: Server-authoritative time
 * - ADR-0008: Semantic versioning / schema_version + forward-only migrations
 */

import type { PoolClient } from 'pg'

export const description =
  'Create divisions + staff_divisions tables, add divisions_enabled to workspace_settings, ' +
  'add division_id FK to students with backfill; bump schema_version 1.4.0 → 1.5.0'

/**
 * Forward migration — single transactional DDL block.
 *
 * Transaction boundary:
 *   BEGIN
 *     → CREATE divisions table + constraints + indexes
 *       (OR ADD missing columns to existing old-schema table)
 *     → CREATE staff_divisions join table + constraints + indexes
 *     → ALTER workspace_settings (add divisions_enabled)
 *     → ALTER students (add division_id nullable)
 *     → UPDATE students (backfill division_id = default division)
 *     → ALTER students (set division_id NOT NULL)
 *     → ADD FK constraint on students.division_id
 *     → UPDATE schema_version
 *   COMMIT
 *
 * Failure in any statement rolls back the entire transaction.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // -------------------------------------------------------------------------
    // STEP 1: CREATE divisions table
    // Fresh-tenant path: creates the full table with all required columns.
    // Existing-tenant path: IF NOT EXISTS is a no-op; column ADDs below upgrade.
    // status uses VARCHAR + CHECK constraint (not a PG enum) — follows RBAC pattern.
    // is_default uses BOOLEAN — application invariant: exactly one row is true.
    // Both created_at and updated_at are set to NOW() by DB default.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS divisions (
        id          UUID          NOT NULL DEFAULT gen_random_uuid(),
        name        VARCHAR(255)  NOT NULL,
        description TEXT,
        is_default  BOOLEAN       NOT NULL DEFAULT false,
        status      VARCHAR(20)   NOT NULL DEFAULT 'ENABLED'
                      CONSTRAINT divisions_status_check
                        CHECK (status IN ('ENABLED', 'DISABLED')),
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

        CONSTRAINT divisions_pkey
          PRIMARY KEY (id)
      )
    `)

    // Upgrade existing tenants: add columns that were absent in the old schema
    // (004-create-core-application-tables.sql created divisions without
    //  is_default, status, or updated_at).
    await client.query(`
      ALTER TABLE divisions
        ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false
    `)

    await client.query(`
      ALTER TABLE divisions
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ENABLED'
    `)

    // Add CHECK constraint only if it doesn't already exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'divisions_status_check'
            AND conrelid = 'divisions'::regclass
        ) THEN
          ALTER TABLE divisions
            ADD CONSTRAINT divisions_status_check
              CHECK (status IN ('ENABLED', 'DISABLED'));
        END IF;
      END
      $$
    `)

    await client.query(`
      ALTER TABLE divisions
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `)

    // Ensure the seeded default row (from 004-create-core-application-tables.sql)
    // is marked as the default division so STEP 5 backfill succeeds.
    // If no rows exist (fresh tenant) this UPDATE is a no-op; the application
    // must seed the default division before calling this migration.
    await client.query(`
      UPDATE divisions
        SET is_default = true
      WHERE id = '00000000-0000-0000-0000-000000000011'::uuid
        AND is_default = false
    `)

    // Drop old plain UNIQUE constraint on name if it exists (from old schema).
    // The new uniqueness is enforced by the functional LOWER(name) index below.
    await client.query(`
      ALTER TABLE divisions
        DROP CONSTRAINT IF EXISTS divisions_name_key
    `)

    // Case-insensitive functional unique index on divisions.name.
    // Replaces a plain UNIQUE(name) constraint — prevents concurrent case-variant
    // duplicates such as "Grade 10A" and "GRADE 10A" that a simple unique index
    // cannot catch.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS divisions_name_lower_unique
        ON divisions (LOWER(name))
    `)

    // Index: filter by status (list enabled/disabled divisions)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_divisions_status
        ON divisions (status)
    `)

    // Index: fast lookup of the default division (used by disable-divisions + backfill)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_divisions_is_default
        ON divisions (is_default)
    `)

    // Composite index: keyset pagination cursor (created_at, id) used by listDivisions.
    // Required for the (created_at, id) > ($cursor_ts, $cursor_id) row-value condition.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_divisions_created_at_id
        ON divisions (created_at ASC, id ASC)
    `)

    // -------------------------------------------------------------------------
    // STEP 2: CREATE staff_divisions join table
    // Composite PK (staff_id, division_id) enforces uniqueness at DB level.
    // FK staff_id → backoffice_staff_users(id) ON DELETE CASCADE:
    //   deleting a staff member removes all their division assignments.
    // FK division_id → divisions(id) ON DELETE RESTRICT:
    //   deleting a division is blocked if any staff assignment exists.
    // assigned_at is server-set (NOW()) — client time not trusted (ADR-0006).
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_divisions (
        staff_id    UUID        NOT NULL,
        division_id UUID        NOT NULL,
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT staff_divisions_pkey
          PRIMARY KEY (staff_id, division_id),
        CONSTRAINT staff_divisions_staff_id_fkey
          FOREIGN KEY (staff_id)
            REFERENCES backoffice_staff_users(id) ON DELETE CASCADE,
        CONSTRAINT staff_divisions_division_id_fkey
          FOREIGN KEY (division_id)
            REFERENCES divisions(id) ON DELETE RESTRICT
      )
    `)

    // Composite PK (staff_id, division_id) already covers all staff_id prefix
    // queries — no separate idx_staff_divisions_staff_id needed.
    // Index: count/list staff members in a division (used by DIVISION_IN_USE guard)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_divisions_division_id
        ON staff_divisions (division_id)
    `)

    // -------------------------------------------------------------------------
    // STEP 3: ALTER workspace_settings — add divisions_enabled flag
    // Default true: existing tenants are in divisions-enabled mode.
    // The disable-divisions operation sets this to false.
    // ADD COLUMN IF NOT EXISTS ensures idempotency.
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE workspace_settings
        ADD COLUMN IF NOT EXISTS divisions_enabled BOOLEAN NOT NULL DEFAULT true
    `)

    // -------------------------------------------------------------------------
    // STEP 4: ALTER students — add division_id column (nullable initially)
    // Must be nullable first to allow backfill in STEP 5.
    // NOT NULL constraint is added in STEP 6 after backfill.
    // ADD COLUMN IF NOT EXISTS ensures idempotency.
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS division_id UUID
    `)

    // -------------------------------------------------------------------------
    // STEP 5: Backfill students.division_id with the default division ID
    // Relies on bootstrap guarantee: exactly one row in divisions has
    // is_default = true at this point in the migration.
    // All students without a division_id receive the default division.
    // -------------------------------------------------------------------------
    await client.query(`
      UPDATE students
        SET division_id = (
          SELECT id FROM divisions WHERE is_default = true LIMIT 1
        )
      WHERE division_id IS NULL
    `)

    // -------------------------------------------------------------------------
    // STEP 6: ALTER students.division_id — SET NOT NULL
    // All rows now have a division_id (from STEP 5); the constraint is safe.
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE students
        ALTER COLUMN division_id SET NOT NULL
    `)

    // -------------------------------------------------------------------------
    // STEP 7: ADD FK constraint: students.division_id → divisions(id)
    // ON DELETE RESTRICT: prevents deleting a division that has students.
    // ADD CONSTRAINT IF NOT EXISTS is supported in PG 9.6+.
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE students
        ADD CONSTRAINT IF NOT EXISTS students_division_id_fkey
          FOREIGN KEY (division_id)
            REFERENCES divisions(id) ON DELETE RESTRICT
    `)

    // Index: list all students in a division + FK enforce path
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_students_division_id
        ON students (division_id)
    `)

    // -------------------------------------------------------------------------
    // STEP 8: Bump schema_version 1.4.0 → 1.5.0
    // -------------------------------------------------------------------------
    await client.query(`
      UPDATE schema_version
        SET version    = '1.5.0',
            applied_at = NOW()
      WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

/**
 * Reverse migration — NOT IMPLEMENTED.
 *
 * STAGE_22 migration is forward-only per ADR-0008.
 * Rollback must be performed via database snapshot restore.
 */
export async function down(_client: PoolClient): Promise<void> {
  throw new Error(
    'STAGE_22_DIVISIONS migration is forward-only. ' +
      'Rollback must be performed via database snapshot restore.'
  )
}
