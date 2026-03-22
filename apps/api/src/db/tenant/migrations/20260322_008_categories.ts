/**
 * Migration 008 — Categories (Classification Dimensions)
 *
 * File: apps/api/src/db/tenant/migrations/20260322_008_categories.ts
 * Stage: STAGE_30_CATEGORIES
 * Schema: 1.13.0 → 1.14.0
 *
 * Two-phase approach (CONCURRENT index requirement):
 *   Phase 1 (inside BEGIN/COMMIT): all DDL + unique indexes + schema version bump.
 *   Phase 2 (outside transaction): CONCURRENT secondary lookup indexes.
 *
 * CONCURRENT indexes cannot be created inside a transaction block. They are
 * run as separate client.query() calls after the transaction completes.
 */

import type { PoolClient } from 'pg'

export const description =
  'Create categories, category_subjects, and category_divisions tables with FK constraints, unique indexes, and CONCURRENT lookup indexes. Bump schema version to 1.14.0.'

// ---------------------------------------------------------------------------
// Migration Up
// ---------------------------------------------------------------------------

export async function up(client: PoolClient): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1: DDL + transactional operations (inside transaction)
  // ─────────────────────────────────────────────────────────────────────────
  await client.query('BEGIN')
  try {
    // ── Table: categories ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id           UUID         NOT NULL DEFAULT gen_random_uuid(),
        name         VARCHAR(255) NOT NULL,
        code         VARCHAR(100),
        description  TEXT,
        parent_id    UUID,
        status       VARCHAR(20)  NOT NULL DEFAULT 'ENABLED'
                       CONSTRAINT categories_status_check CHECK (status IN ('ENABLED', 'DISABLED')),
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        created_by   UUID,
        updated_by   UUID,
        CONSTRAINT   categories_pkey PRIMARY KEY (id)
      )
    `)

    // ── Table: category_subjects ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS category_subjects (
        id           UUID NOT NULL DEFAULT gen_random_uuid(),
        category_id  UUID NOT NULL,
        subject_id   UUID NOT NULL,
        CONSTRAINT   category_subjects_pkey PRIMARY KEY (id),
        CONSTRAINT   unique_category_subjects UNIQUE (category_id, subject_id)
      )
    `)

    // ── Table: category_divisions ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS category_divisions (
        id           UUID NOT NULL DEFAULT gen_random_uuid(),
        category_id  UUID NOT NULL,
        division_id  UUID NOT NULL,
        CONSTRAINT   category_divisions_pkey PRIMARY KEY (id),
        CONSTRAINT   unique_category_divisions UNIQUE (category_id, division_id)
      )
    `)

    // ── FK: categories.parent_id → categories.id (RESTRICT) ────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'categories_parent_id_fkey'
            AND table_name = 'categories'
        ) THEN
          ALTER TABLE categories
            ADD CONSTRAINT categories_parent_id_fkey
            FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE RESTRICT;
        END IF;
      END $$
    `)

    // ── FK: categories.created_by → users.id (SET NULL) ────────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'categories_created_by_fkey'
            AND table_name = 'categories'
        ) THEN
          ALTER TABLE categories
            ADD CONSTRAINT categories_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: categories.updated_by → users.id (SET NULL) ────────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'categories_updated_by_fkey'
            AND table_name = 'categories'
        ) THEN
          ALTER TABLE categories
            ADD CONSTRAINT categories_updated_by_fkey
            FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: category_subjects.category_id → categories.id (CASCADE) ────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'category_subjects_category_id_fkey'
            AND table_name = 'category_subjects'
        ) THEN
          ALTER TABLE category_subjects
            ADD CONSTRAINT category_subjects_category_id_fkey
            FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: category_subjects.subject_id → subjects.id (CASCADE) ───────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'category_subjects_subject_id_fkey'
            AND table_name = 'category_subjects'
        ) THEN
          ALTER TABLE category_subjects
            ADD CONSTRAINT category_subjects_subject_id_fkey
            FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: category_divisions.category_id → categories.id (CASCADE) ───────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'category_divisions_category_id_fkey'
            AND table_name = 'category_divisions'
        ) THEN
          ALTER TABLE category_divisions
            ADD CONSTRAINT category_divisions_category_id_fkey
            FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: category_divisions.division_id → divisions.id (CASCADE) ─────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'category_divisions_division_id_fkey'
            AND table_name = 'category_divisions'
        ) THEN
          ALTER TABLE category_divisions
            ADD CONSTRAINT category_divisions_division_id_fkey
            FOREIGN KEY (division_id) REFERENCES divisions (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── Unique index: LOWER(name) — case-insensitive tenant-wide name uniqueness
    // NOTE: UNIQUE indexes use CONCURRENTLY but are in Phase 1 via schema version
    // constraint. For an initial migration on a new table this is safe inside
    // the transaction. If migrating existing data, move to Phase 2.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_categories_name
        ON categories (LOWER(name))
    `)

    // ── Unique partial index: LOWER(code) WHERE code IS NOT NULL ────────────
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_categories_code
        ON categories (LOWER(code)) WHERE code IS NOT NULL
    `)

    // ── Unique index on category_subjects composite (already in table constraint)
    // No extra index needed — UNIQUE constraint creates the index automatically.

    // ── Seed permissions: question:manage and classification:manage ─────────
    // These permission codes enable RBAC guards on category write routes.
    // Idempotent via ON CONFLICT DO NOTHING.
    await client.query(`
      INSERT INTO role_permissions (role_id, permission_code)
      SELECT r.id, p.code
      FROM roles r
      CROSS JOIN (
        VALUES
          ('question:manage'),
          ('classification:manage')
      ) AS p(code)
      WHERE r.code IN ('ADMIN')
      ON CONFLICT (role_id, permission_code) DO NOTHING
    `)

    // ── Schema version bump: 1.13.0 → 1.14.0 ──────────────────────────────
    await client.query(`
      UPDATE _schema_versions
      SET version = '1.14.0', updated_at = NOW()
      WHERE name = 'schema_version'
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2: CONCURRENT indexes — MUST run outside any transaction block
  // These prevent write-blocking on live tenant databases during index creation.
  // ─────────────────────────────────────────────────────────────────────────

  await client.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_parent_id
      ON categories (parent_id)
  `)

  await client.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_status
      ON categories (status)
  `)

  await client.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_category_subjects_category_id
      ON category_subjects (category_id)
  `)

  await client.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_category_subjects_subject_id
      ON category_subjects (subject_id)
  `)

  await client.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_category_divisions_category_id
      ON category_divisions (category_id)
  `)

  await client.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_category_divisions_division_id
      ON category_divisions (division_id)
  `)
}
