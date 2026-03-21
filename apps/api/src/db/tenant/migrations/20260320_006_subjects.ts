/**
 * Migration 006 — Subjects
 *
 * File: apps/api/src/db/tenant/migrations/20260320_006_subjects.ts
 * Stage: STAGE_28_SUBJECTS
 *
 * Creates the `subjects` table with a custom DRAFT→ACTIVE→ARCHIVED state machine,
 * FK constraints to `divisions` and `semesters`, all 9 required indexes,
 * and bumps schema version to 1.12.0.
 *
 * Forward-only (ADR-0008). Down migration not supported.
 */

import type { PoolClient } from 'pg'

export const description =
  'Add subjects table with workflow status, FK constraints, and composite indexes'

export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // -------------------------------------------------------------------------
    // 1. Create subjects table
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id               UUID          NOT NULL DEFAULT gen_random_uuid(),
        name             VARCHAR(255)  NOT NULL,
        code             VARCHAR(100),
        division_id      UUID,
        semester_id      UUID,
        is_multilanguage BOOLEAN       NOT NULL DEFAULT false,
        default_language VARCHAR(10)   NOT NULL,
        description      TEXT,
        status           VARCHAR(20)   NOT NULL DEFAULT 'DRAFT'
                           CONSTRAINT subjects_status_check CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
        deleted_at       TIMESTAMPTZ,
        created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT subjects_pkey PRIMARY KEY (id)
      )
    `)

    // -------------------------------------------------------------------------
    // 2. FK constraint: division_id → divisions(id) ON DELETE RESTRICT
    //    Idempotent: wrapped in DO block to check for existing constraint.
    // -------------------------------------------------------------------------
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'subjects'
            AND constraint_name = 'subjects_division_id_fkey'
        ) THEN
          ALTER TABLE subjects
            ADD CONSTRAINT subjects_division_id_fkey
            FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE RESTRICT;
        END IF;
      END
      $$
    `)

    // -------------------------------------------------------------------------
    // 3. FK constraint: semester_id → semesters(id) ON DELETE RESTRICT
    // -------------------------------------------------------------------------
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'subjects'
            AND constraint_name = 'subjects_semester_id_fkey'
        ) THEN
          ALTER TABLE subjects
            ADD CONSTRAINT subjects_semester_id_fkey
            FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE RESTRICT;
        END IF;
      END
      $$
    `)

    // -------------------------------------------------------------------------
    // 4. Partial functional unique index on name (case-insensitive, active only)
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS subjects_name_lower_unique_active
        ON subjects (LOWER(name))
        WHERE deleted_at IS NULL
    `)

    // -------------------------------------------------------------------------
    // 5. Partial unique index on code (non-null, active only)
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS subjects_code_unique_non_null
        ON subjects (code)
        WHERE code IS NOT NULL AND deleted_at IS NULL
    `)

    // -------------------------------------------------------------------------
    // 6. Division FK traversal index
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subjects_division_id
        ON subjects (division_id)
        WHERE deleted_at IS NULL
    `)

    // -------------------------------------------------------------------------
    // 7. Semester FK traversal index
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subjects_semester_id
        ON subjects (semester_id)
        WHERE deleted_at IS NULL
    `)

    // -------------------------------------------------------------------------
    // 8. Status filter index (runtime ACTIVE queries, workflow transition checks)
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subjects_status
        ON subjects (status)
        WHERE deleted_at IS NULL
    `)

    // -------------------------------------------------------------------------
    // 9. Compound index: division + status (runtime active-by-division queries)
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subjects_division_status
        ON subjects (division_id, status)
        WHERE deleted_at IS NULL
    `)

    // -------------------------------------------------------------------------
    // 10. Compound index: semester + status (runtime active-by-semester queries)
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subjects_semester_status
        ON subjects (semester_id, status)
        WHERE deleted_at IS NULL
    `)

    // -------------------------------------------------------------------------
    // 11. Soft-delete exclusion scan optimization
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subjects_deleted_at
        ON subjects (deleted_at)
    `)

    // -------------------------------------------------------------------------
    // 12. Schema version bump: 1.11.0 → 1.12.0
    // -------------------------------------------------------------------------
    await client.query(`
      UPDATE _schema_versions
        SET version    = '1.12.0',
            updated_at = NOW()
        WHERE name = 'schema_version'
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}
