/**
 * Migration 005 — Semesters
 *
 * File: apps/api/src/db/tenant/migrations/20260320_005_semesters.ts
 * Stage: STAGE_27_SEMESTERS
 *
 * Creates the `semesters` table, adds `semester_id` FK column to `students`,
 * creates all required indexes, and bumps schema version to 1.11.0.
 *
 * Forward-only (ADR-0008). Down migration not supported.
 */

import type { PoolClient } from 'pg'

export const description = 'Add semesters table and semester_id FK to students'

export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // -------------------------------------------------------------------------
    // 1. Create semesters table
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS semesters (
        id          UUID         NOT NULL DEFAULT gen_random_uuid(),
        name        VARCHAR(255) NOT NULL,
        description TEXT,
        start_date  DATE,
        end_date    DATE,
        status      VARCHAR(20)  NOT NULL DEFAULT 'ENABLED'
                      CONSTRAINT semesters_status_check CHECK (status IN ('ENABLED', 'DISABLED')),
        deleted_at  TIMESTAMPTZ,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT semesters_pkey PRIMARY KEY (id)
      )
    `)

    // -------------------------------------------------------------------------
    // 2. Case-insensitive partial unique index on name (active records only)
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS semesters_name_lower_unique_active
        ON semesters (LOWER(name))
        WHERE deleted_at IS NULL
    `)

    // -------------------------------------------------------------------------
    // 3. Status filter index (active records only)
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_semesters_status
        ON semesters (status)
        WHERE deleted_at IS NULL
    `)

    // -------------------------------------------------------------------------
    // 4. start_date index for range queries (active records only)
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_semesters_start_date
        ON semesters (start_date)
        WHERE deleted_at IS NULL
    `)

    // -------------------------------------------------------------------------
    // 5. deleted_at index for soft-delete exclusion scans
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_semesters_deleted_at
        ON semesters (deleted_at)
    `)

    // -------------------------------------------------------------------------
    // 6. Add semester_id nullable FK to students (ON DELETE RESTRICT)
    //    Add column first, then named constraint — idempotent pattern.
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS semester_id UUID
    `)

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'students'
            AND constraint_name = 'students_semester_id_fkey'
        ) THEN
          ALTER TABLE students
            ADD CONSTRAINT students_semester_id_fkey
            FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE RESTRICT;
        END IF;
      END
      $$
    `)

    // -------------------------------------------------------------------------
    // 7. Sparse FK traversal index on students.semester_id
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_students_semester_id
        ON students (semester_id)
        WHERE semester_id IS NOT NULL
    `)

    // -------------------------------------------------------------------------
    // 8. Bump schema version
    // -------------------------------------------------------------------------
    await client.query(`
      UPDATE _schema_versions
        SET version = '1.11.0'
        WHERE name = 'schema_version'
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

export function down(): never {
  throw new Error('Down migration not supported. Restore from snapshot.')
}
