/**
 * Migration 007 — Lessons
 *
 * File: apps/api/src/db/tenant/migrations/20260321_007_lessons.ts
 * Stage: STAGE_29_LESSONS
 *
 * Creates the `lessons` table — the smallest structured academic unit under Subject.
 * Adds FK constraints (subject_id RESTRICT, created_by/updated_by SET NULL),
 * a case-insensitive composite unique index, two performance indexes, and bumps
 * schema version from 1.12.0 to 1.13.0.
 *
 * Dependency: `subjects` table must exist before this migration is applied.
 * Forward-only (ADR-0008). No down() function.
 */

import type { PoolClient } from 'pg'

export const description =
  'Add lessons table with subject FK, status lifecycle, and composite uniqueness index'

export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // -------------------------------------------------------------------------
    // 1. Create lessons table
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id          UUID         NOT NULL DEFAULT gen_random_uuid(),
        subject_id  UUID         NOT NULL,
        name        VARCHAR(255) NOT NULL,
        code        VARCHAR(100),
        description TEXT,
        status      VARCHAR(20)  NOT NULL DEFAULT 'ENABLED'
                      CONSTRAINT lessons_status_check CHECK (status IN ('ENABLED', 'DISABLED')),
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        created_by  UUID,
        updated_by  UUID,
        CONSTRAINT  lessons_pkey PRIMARY KEY (id)
      )
    `)

    // -------------------------------------------------------------------------
    // 2. FK: subject_id → subjects(id) ON DELETE RESTRICT
    //    RESTRICT: subject deletion must be blocked when lessons exist.
    //    Two-layer protection: DB FK + subjects dependency-registry.
    // -------------------------------------------------------------------------
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'lessons'
            AND constraint_name = 'lessons_subject_id_fkey'
        ) THEN
          ALTER TABLE lessons
            ADD CONSTRAINT lessons_subject_id_fkey
            FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT;
        END IF;
      END
      $$
    `)

    // -------------------------------------------------------------------------
    // 3. FK: created_by → users(id) ON DELETE SET NULL
    // -------------------------------------------------------------------------
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'lessons'
            AND constraint_name = 'lessons_created_by_fkey'
        ) THEN
          ALTER TABLE lessons
            ADD CONSTRAINT lessons_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END
      $$
    `)

    // -------------------------------------------------------------------------
    // 4. FK: updated_by → users(id) ON DELETE SET NULL
    // -------------------------------------------------------------------------
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'lessons'
            AND constraint_name = 'lessons_updated_by_fkey'
        ) THEN
          ALTER TABLE lessons
            ADD CONSTRAINT lessons_updated_by_fkey
            FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END
      $$
    `)

    // -------------------------------------------------------------------------
    // 5. Case-insensitive composite unique index on (subject_id, LOWER(name))
    //    "Algebra" and "algebra" in the same subject collide.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_lessons_subject_name
        ON lessons (subject_id, LOWER(name))
    `)

    // -------------------------------------------------------------------------
    // 6. FK traversal index on subject_id
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lessons_subject_id ON lessons (subject_id)
    `)

    // -------------------------------------------------------------------------
    // 7. Status filter index
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons (status)
    `)

    // -------------------------------------------------------------------------
    // 8. Schema version bump: 1.12.0 → 1.13.0
    // -------------------------------------------------------------------------
    await client.query(`
      UPDATE _schema_versions
        SET version    = '1.13.0',
            updated_at = NOW()
        WHERE name = 'schema_version'
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}
