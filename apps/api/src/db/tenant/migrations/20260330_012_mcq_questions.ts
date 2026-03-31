/**
 * Migration 012 — MCQ Questions
 *
 * File: apps/api/src/db/tenant/migrations/20260330_012_mcq_questions.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 * Schema: 1.17.0 → 1.18.0
 *
 * Two-phase approach (CONCURRENT index requirement):
 *   Phase 1 (inside BEGIN/COMMIT): DDL + FK constraints + B-tree indexes + schema version bump.
 *   Phase 2 (outside transaction): CONCURRENT unique indexes.
 *
 * Tables created:
 *   1. mcq_questions           — core question entity
 *   2. mcq_question_options    — normalised answer options
 *   3. mcq_question_categories — M:N link → category_values
 *   4. mcq_question_tags       — M:N link → tags
 *   5. mcq_question_baskets    — M:N link → mcq_baskets
 *
 * CONCURRENT indexes cannot be created inside a transaction block.
 */

import type { PoolClient } from 'pg'

export const description =
  'Create mcq_questions, mcq_question_options, mcq_question_categories, mcq_question_tags, mcq_question_baskets tables with FK constraints, B-tree indexes, and CONCURRENT unique indexes. Bump schema version to 1.18.0.'

// ---------------------------------------------------------------------------
// Migration Up
// ---------------------------------------------------------------------------

export async function up(client: PoolClient): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1: DDL + FK constraints + B-tree indexes (inside transaction)
  // ─────────────────────────────────────────────────────────────────────────
  await client.query('BEGIN')
  try {
    // ── Table: mcq_questions ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcq_questions (
        id                UUID         NOT NULL DEFAULT gen_random_uuid(),
        subject_id        UUID         NOT NULL,
        division_id       UUID,
        lesson_id         UUID,
        question_type     VARCHAR(20)  NOT NULL
                            CONSTRAINT mcq_questions_type_check
                            CHECK (question_type IN ('SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'ARRANGEMENT')),
        language          VARCHAR(10)  NOT NULL,
        content           TEXT         NOT NULL,
        explanation       TEXT,
        is_revision_only  BOOLEAN      NOT NULL DEFAULT false,
        is_exam_only      BOOLEAN      NOT NULL DEFAULT false,
        status            VARCHAR(30)  NOT NULL DEFAULT 'DRAFT'
                            CONSTRAINT mcq_questions_status_check
                            CHECK (status IN ('DRAFT', 'COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED')),
        deleted_at        TIMESTAMPTZ,
        created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        created_by        UUID,
        updated_by        UUID,
        status_updated_at TIMESTAMPTZ,
        status_updated_by UUID,
        CONSTRAINT mcq_questions_pkey PRIMARY KEY (id)
      )
    `)

    // ── Table: mcq_question_options ───────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcq_question_options (
        id          UUID        NOT NULL DEFAULT gen_random_uuid(),
        question_id UUID        NOT NULL,
        content     TEXT        NOT NULL,
        is_correct  BOOLEAN     NOT NULL DEFAULT false,
        order_index INTEGER     NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT mcq_question_options_pkey PRIMARY KEY (id)
      )
    `)

    // ── Table: mcq_question_categories ────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcq_question_categories (
        id                UUID NOT NULL DEFAULT gen_random_uuid(),
        question_id       UUID NOT NULL,
        category_value_id UUID NOT NULL,
        CONSTRAINT mcq_question_categories_pkey PRIMARY KEY (id)
      )
    `)

    // ── Table: mcq_question_tags ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcq_question_tags (
        id          UUID NOT NULL DEFAULT gen_random_uuid(),
        question_id UUID NOT NULL,
        tag_id      UUID NOT NULL,
        CONSTRAINT mcq_question_tags_pkey PRIMARY KEY (id)
      )
    `)

    // ── Table: mcq_question_baskets ───────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcq_question_baskets (
        id          UUID NOT NULL DEFAULT gen_random_uuid(),
        question_id UUID NOT NULL,
        basket_id   UUID NOT NULL,
        CONSTRAINT mcq_question_baskets_pkey PRIMARY KEY (id)
      )
    `)

    // ── FK: mcq_questions.subject_id → subjects.id (RESTRICT) ────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_questions_subject_id_fkey'
            AND table_name = 'mcq_questions'
        ) THEN
          ALTER TABLE mcq_questions
            ADD CONSTRAINT mcq_questions_subject_id_fkey
            FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE RESTRICT;
        END IF;
      END $$
    `)

    // ── FK: mcq_questions.division_id → divisions.id (SET NULL) ──────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_questions_division_id_fkey'
            AND table_name = 'mcq_questions'
        ) THEN
          ALTER TABLE mcq_questions
            ADD CONSTRAINT mcq_questions_division_id_fkey
            FOREIGN KEY (division_id) REFERENCES divisions (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: mcq_questions.lesson_id → lessons.id (SET NULL) ──────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_questions_lesson_id_fkey'
            AND table_name = 'mcq_questions'
        ) THEN
          ALTER TABLE mcq_questions
            ADD CONSTRAINT mcq_questions_lesson_id_fkey
            FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: mcq_questions.created_by → backoffice_staff_users.id (SET NULL)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_questions_created_by_fkey'
            AND table_name = 'mcq_questions'
        ) THEN
          ALTER TABLE mcq_questions
            ADD CONSTRAINT mcq_questions_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES backoffice_staff_users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: mcq_questions.updated_by → backoffice_staff_users.id (SET NULL)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_questions_updated_by_fkey'
            AND table_name = 'mcq_questions'
        ) THEN
          ALTER TABLE mcq_questions
            ADD CONSTRAINT mcq_questions_updated_by_fkey
            FOREIGN KEY (updated_by) REFERENCES backoffice_staff_users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: mcq_questions.status_updated_by → backoffice_staff_users.id (SET NULL)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_questions_status_updated_by_fkey'
            AND table_name = 'mcq_questions'
        ) THEN
          ALTER TABLE mcq_questions
            ADD CONSTRAINT mcq_questions_status_updated_by_fkey
            FOREIGN KEY (status_updated_by) REFERENCES backoffice_staff_users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: mcq_question_options.question_id → mcq_questions.id (CASCADE)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_question_options_question_id_fkey'
            AND table_name = 'mcq_question_options'
        ) THEN
          ALTER TABLE mcq_question_options
            ADD CONSTRAINT mcq_question_options_question_id_fkey
            FOREIGN KEY (question_id) REFERENCES mcq_questions (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: mcq_question_categories.question_id → mcq_questions.id (CASCADE)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_question_categories_question_id_fkey'
            AND table_name = 'mcq_question_categories'
        ) THEN
          ALTER TABLE mcq_question_categories
            ADD CONSTRAINT mcq_question_categories_question_id_fkey
            FOREIGN KEY (question_id) REFERENCES mcq_questions (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: mcq_question_categories.category_value_id → category_values.id (CASCADE)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_question_categories_category_value_id_fkey'
            AND table_name = 'mcq_question_categories'
        ) THEN
          ALTER TABLE mcq_question_categories
            ADD CONSTRAINT mcq_question_categories_category_value_id_fkey
            FOREIGN KEY (category_value_id) REFERENCES category_values (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: mcq_question_tags.question_id → mcq_questions.id (CASCADE)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_question_tags_question_id_fkey'
            AND table_name = 'mcq_question_tags'
        ) THEN
          ALTER TABLE mcq_question_tags
            ADD CONSTRAINT mcq_question_tags_question_id_fkey
            FOREIGN KEY (question_id) REFERENCES mcq_questions (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: mcq_question_tags.tag_id → tags.id (CASCADE)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_question_tags_tag_id_fkey'
            AND table_name = 'mcq_question_tags'
        ) THEN
          ALTER TABLE mcq_question_tags
            ADD CONSTRAINT mcq_question_tags_tag_id_fkey
            FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: mcq_question_baskets.question_id → mcq_questions.id (CASCADE)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_question_baskets_question_id_fkey'
            AND table_name = 'mcq_question_baskets'
        ) THEN
          ALTER TABLE mcq_question_baskets
            ADD CONSTRAINT mcq_question_baskets_question_id_fkey
            FOREIGN KEY (question_id) REFERENCES mcq_questions (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: mcq_question_baskets.basket_id → mcq_baskets.id (CASCADE)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_question_baskets_basket_id_fkey'
            AND table_name = 'mcq_question_baskets'
        ) THEN
          ALTER TABLE mcq_question_baskets
            ADD CONSTRAINT mcq_question_baskets_basket_id_fkey
            FOREIGN KEY (basket_id) REFERENCES mcq_baskets (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── B-tree indexes: mcq_questions ─────────────────────────────────────

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_questions_subject_id
        ON mcq_questions (subject_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_questions_division_id
        ON mcq_questions (division_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_questions_lesson_id
        ON mcq_questions (lesson_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_questions_question_type
        ON mcq_questions (question_type)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_questions_status
        ON mcq_questions (status)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_questions_deleted_at
        ON mcq_questions (deleted_at)
    `)

    // ── B-tree indexes: mcq_question_options ──────────────────────────────

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_question_options_question_id
        ON mcq_question_options (question_id)
    `)

    // ── B-tree indexes: mcq_question_categories ───────────────────────────

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_question_categories_question_id
        ON mcq_question_categories (question_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_question_categories_category_value_id
        ON mcq_question_categories (category_value_id)
    `)

    // ── B-tree indexes: mcq_question_tags ─────────────────────────────────

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_question_tags_question_id
        ON mcq_question_tags (question_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_question_tags_tag_id
        ON mcq_question_tags (tag_id)
    `)

    // ── B-tree indexes: mcq_question_baskets ──────────────────────────────

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_question_baskets_question_id
        ON mcq_question_baskets (question_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_question_baskets_basket_id
        ON mcq_question_baskets (basket_id)
    `)

    // ── Schema version bump: 1.17.0 → 1.18.0 ─────────────────────────────
    await client.query(`
      UPDATE _schema_versions
      SET version = '1.18.0', updated_at = NOW()
      WHERE name = 'schema_version'
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2: CONCURRENT unique indexes — MUST run outside transaction
  // CONCURRENTLY prevents table locks on tenant databases with existing rows.
  // ─────────────────────────────────────────────────────────────────────────

  // Enforce unique ordering per question (FR-002)
  await client.query(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_mcq_question_options_question_order
      ON mcq_question_options (question_id, order_index)
  `)

  // Enforce one category value per question (FR-009)
  await client.query(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_mcq_question_categories
      ON mcq_question_categories (question_id, category_value_id)
  `)

  // Enforce one tag per question (FR-011)
  await client.query(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_mcq_question_tags
      ON mcq_question_tags (question_id, tag_id)
  `)

  // Enforce one basket per question (FR-013)
  await client.query(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_mcq_question_baskets
      ON mcq_question_baskets (question_id, basket_id)
  `)
}
