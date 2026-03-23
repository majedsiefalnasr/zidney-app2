/**
 * Migration 009 — Category Values (Classification Values)
 *
 * File: apps/api/src/db/tenant/migrations/20260322_009_category_values.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 * Schema: 1.14.0 → 1.15.0
 *
 * Two-phase approach (CONCURRENT index requirement):
 *   Phase 1 (inside BEGIN/COMMIT): all DDL + FK constraints + B-tree indexes + schema version bump.
 *   Phase 2 (outside transaction): CONCURRENT unique partial functional index.
 *
 * CONCURRENT indexes cannot be created inside a transaction block. The
 * unique_category_values_code index must run after COMMIT.
 */

import type { PoolClient } from 'pg'

export const description =
  'Create category_values, category_value_subjects, and category_value_divisions tables with FK constraints, B-tree indexes, and a CONCURRENT partial functional unique index. Bump schema version to 1.15.0.'

// ---------------------------------------------------------------------------
// Migration Up
// ---------------------------------------------------------------------------

export async function up(client: PoolClient): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1: DDL + FK constraints + B-tree indexes (inside transaction)
  // ─────────────────────────────────────────────────────────────────────────
  await client.query('BEGIN')
  try {
    // ── Table: category_values ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS category_values (
        id           UUID         NOT NULL DEFAULT gen_random_uuid(),
        category_id  UUID         NOT NULL,
        code         VARCHAR(100) NOT NULL,
        status       VARCHAR(20)  NOT NULL DEFAULT 'COMPLETED'
                       CONSTRAINT category_values_status_check CHECK (status IN ('COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED', 'DISABLED')),
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        created_by   UUID,
        updated_by   UUID,
        deleted_at   TIMESTAMPTZ,
        CONSTRAINT   category_values_pkey PRIMARY KEY (id)
      )
    `)

    // ── Table: category_value_subjects ─────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS category_value_subjects (
        id                 UUID NOT NULL DEFAULT gen_random_uuid(),
        category_value_id  UUID NOT NULL,
        subject_id         UUID NOT NULL,
        CONSTRAINT category_value_subjects_pkey PRIMARY KEY (id),
        CONSTRAINT unique_category_value_subjects UNIQUE (category_value_id, subject_id)
      )
    `)

    // ── Table: category_value_divisions ────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS category_value_divisions (
        id                 UUID NOT NULL DEFAULT gen_random_uuid(),
        category_value_id  UUID NOT NULL,
        division_id        UUID NOT NULL,
        CONSTRAINT category_value_divisions_pkey PRIMARY KEY (id),
        CONSTRAINT unique_category_value_divisions UNIQUE (category_value_id, division_id)
      )
    `)

    // ── FK: category_values.category_id → categories.id (CASCADE) ──────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'cv_category_id_fkey'
            AND table_name = 'category_values'
        ) THEN
          ALTER TABLE category_values
            ADD CONSTRAINT cv_category_id_fkey
            FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: category_values.created_by → users.id (SET NULL) ───────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'cv_created_by_fkey'
            AND table_name = 'category_values'
        ) THEN
          ALTER TABLE category_values
            ADD CONSTRAINT cv_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: category_values.updated_by → users.id (SET NULL) ───────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'cv_updated_by_fkey'
            AND table_name = 'category_values'
        ) THEN
          ALTER TABLE category_values
            ADD CONSTRAINT cv_updated_by_fkey
            FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: category_value_subjects.category_value_id → category_values.id (CASCADE)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'cv_subjects_category_value_id_fkey'
            AND table_name = 'category_value_subjects'
        ) THEN
          ALTER TABLE category_value_subjects
            ADD CONSTRAINT cv_subjects_category_value_id_fkey
            FOREIGN KEY (category_value_id) REFERENCES category_values (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: category_value_subjects.subject_id → subjects.id (CASCADE) ─────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'cv_subjects_subject_id_fkey'
            AND table_name = 'category_value_subjects'
        ) THEN
          ALTER TABLE category_value_subjects
            ADD CONSTRAINT cv_subjects_subject_id_fkey
            FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: category_value_divisions.category_value_id → category_values.id (CASCADE)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'cv_divisions_category_value_id_fkey'
            AND table_name = 'category_value_divisions'
        ) THEN
          ALTER TABLE category_value_divisions
            ADD CONSTRAINT cv_divisions_category_value_id_fkey
            FOREIGN KEY (category_value_id) REFERENCES category_values (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: category_value_divisions.division_id → divisions.id (CASCADE) ──
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'cv_divisions_division_id_fkey'
            AND table_name = 'category_value_divisions'
        ) THEN
          ALTER TABLE category_value_divisions
            ADD CONSTRAINT cv_divisions_division_id_fkey
            FOREIGN KEY (division_id) REFERENCES divisions (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── B-tree indexes ─────────────────────────────────────────────────────

    // Lookup all values for a category
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_category_values_category_id
        ON category_values (category_id)
    `)

    // Status-filtered queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_category_values_status
        ON category_values (status)
    `)

    // Most common query: active values for a category with a specific status
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_category_values_category_id_status
        ON category_values (category_id, status)
    `)

    // Active-value scans (partial — only non-deleted rows)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_category_values_deleted_at
        ON category_values (deleted_at)
        WHERE deleted_at IS NULL
    `)

    // Scope lookup: all values for a given subject
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cv_subjects_category_value_id
        ON category_value_subjects (category_value_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cv_subjects_subject_id
        ON category_value_subjects (subject_id)
    `)

    // Scope lookup: all values for a given division
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cv_divisions_category_value_id
        ON category_value_divisions (category_value_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cv_divisions_division_id
        ON category_value_divisions (division_id)
    `)

    // ── Schema version bump: 1.14.0 → 1.15.0 ──────────────────────────────
    await client.query(`
      UPDATE _schema_versions
      SET version = '1.15.0', updated_at = NOW()
      WHERE name = 'schema_version'
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2: CONCURRENT unique partial functional index — MUST run outside TX
  // Per-category case-insensitive code uniqueness for active (non-deleted) values.
  // CONCURRENTLY prevents SHARE lock on tenant databases with existing rows.
  // ─────────────────────────────────────────────────────────────────────────

  await client.query(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_category_values_code
      ON category_values (category_id, LOWER(code))
      WHERE deleted_at IS NULL
  `)
}
