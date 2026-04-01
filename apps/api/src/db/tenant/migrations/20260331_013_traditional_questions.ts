/**
 * Migration 013 — Traditional Questions
 *
 * File: apps/api/src/db/tenant/migrations/20260331_013_traditional_questions.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 * Schema: 1.18.0 → 1.19.0
 *
 * Two-phase approach (CONCURRENT index requirement):
 *   Phase 1 (inside BEGIN/COMMIT): DDL + FK constraints + B-tree indexes + schema version bump.
 *   Phase 2 (outside transaction): CONCURRENT unique indexes.
 *
 * Tables created:
 *   1. traditional_exam_sections        — stub (Stage 37 adds full columns via ALTER TABLE)
 *   2. traditional_exam_subsections     — stub (Stage 37 adds full columns via ALTER TABLE)
 *   3. traditional_questions            — core question entity
 *   4. traditional_question_categories  — M:N link → category_values
 *   5. traditional_question_tags        — M:N link → tags
 *
 * CONCURRENT indexes cannot be created inside a transaction block.
 */

import type { PoolClient } from 'pg'

export const description =
  'Create traditional_exam_sections (stub), traditional_exam_subsections (stub), traditional_questions, traditional_question_categories, traditional_question_tags tables with FK constraints, B-tree indexes, and CONCURRENT unique indexes. Bump schema version to 1.19.0.'

// ---------------------------------------------------------------------------
// Migration Up
// ---------------------------------------------------------------------------

export async function up(client: PoolClient): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1: DDL + FK constraints + B-tree indexes (inside transaction)
  // ─────────────────────────────────────────────────────────────────────────
  await client.query('BEGIN')
  try {
    // ── Table: traditional_exam_sections (stub) ───────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS traditional_exam_sections (
        id         UUID        NOT NULL DEFAULT gen_random_uuid(),
        exam_id    UUID        NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT traditional_exam_sections_pkey PRIMARY KEY (id)
      )
    `)

    // ── Table: traditional_exam_subsections (stub) ────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS traditional_exam_subsections (
        id         UUID        NOT NULL DEFAULT gen_random_uuid(),
        section_id UUID        NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT traditional_exam_subsections_pkey PRIMARY KEY (id)
      )
    `)

    // ── FK: traditional_exam_subsections.section_id → traditional_exam_sections.id
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'traditional_exam_subsections_section_id_fkey'
            AND table_name = 'traditional_exam_subsections'
        ) THEN
          ALTER TABLE traditional_exam_subsections
            ADD CONSTRAINT traditional_exam_subsections_section_id_fkey
            FOREIGN KEY (section_id) REFERENCES traditional_exam_sections (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── Table: traditional_questions ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS traditional_questions (
        id                  UUID           NOT NULL DEFAULT gen_random_uuid(),
        subject_id          UUID           NOT NULL,
        division_id         UUID,
        lesson_id           UUID,
        subsection_id       UUID           NOT NULL,
        question_type       VARCHAR(20)    NOT NULL
                              CONSTRAINT traditional_questions_type_check
                              CHECK (question_type IN ('TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER')),
        language            VARCHAR(10)    NOT NULL,
        content             TEXT           NOT NULL,
        correct_answer      JSONB,
        correction_criteria JSONB,
        score               NUMERIC(10,2)  NOT NULL
                              CONSTRAINT traditional_questions_score_check
                              CHECK (score > 0),
        status              VARCHAR(30)    NOT NULL DEFAULT 'DRAFT'
                              CONSTRAINT traditional_questions_status_check
                              CHECK (status IN ('DRAFT', 'COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED')),
        deleted_at          TIMESTAMPTZ,
        created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        created_by          UUID,
        updated_by          UUID,
        status_updated_at   TIMESTAMPTZ,
        status_updated_by   UUID,
        CONSTRAINT traditional_questions_pkey PRIMARY KEY (id)
      )
    `)

    // ── Table: traditional_question_categories ────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS traditional_question_categories (
        id                UUID NOT NULL DEFAULT gen_random_uuid(),
        question_id       UUID NOT NULL,
        category_value_id UUID NOT NULL,
        CONSTRAINT traditional_question_categories_pkey PRIMARY KEY (id)
      )
    `)

    // ── Table: traditional_question_tags ──────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS traditional_question_tags (
        id          UUID NOT NULL DEFAULT gen_random_uuid(),
        question_id UUID NOT NULL,
        tag_id      UUID NOT NULL,
        CONSTRAINT traditional_question_tags_pkey PRIMARY KEY (id)
      )
    `)

    // ── FK: traditional_questions.subject_id → subjects.id (RESTRICT) ────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'traditional_questions_subject_id_fkey'
            AND table_name = 'traditional_questions'
        ) THEN
          ALTER TABLE traditional_questions
            ADD CONSTRAINT traditional_questions_subject_id_fkey
            FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE RESTRICT;
        END IF;
      END $$
    `)

    // ── FK: traditional_questions.division_id → divisions.id (RESTRICT) ──
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'traditional_questions_division_id_fkey'
            AND table_name = 'traditional_questions'
        ) THEN
          ALTER TABLE traditional_questions
            ADD CONSTRAINT traditional_questions_division_id_fkey
            FOREIGN KEY (division_id) REFERENCES divisions (id) ON DELETE RESTRICT;
        END IF;
      END $$
    `)

    // ── FK: traditional_questions.lesson_id → lessons.id (RESTRICT) ──────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'traditional_questions_lesson_id_fkey'
            AND table_name = 'traditional_questions'
        ) THEN
          ALTER TABLE traditional_questions
            ADD CONSTRAINT traditional_questions_lesson_id_fkey
            FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE RESTRICT;
        END IF;
      END $$
    `)

    // ── FK: traditional_questions.subsection_id → traditional_exam_subsections.id (RESTRICT)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'traditional_questions_subsection_id_fkey'
            AND table_name = 'traditional_questions'
        ) THEN
          ALTER TABLE traditional_questions
            ADD CONSTRAINT traditional_questions_subsection_id_fkey
            FOREIGN KEY (subsection_id) REFERENCES traditional_exam_subsections (id) ON DELETE RESTRICT;
        END IF;
      END $$
    `)

    // ── FK: traditional_questions.created_by → backoffice_staff_users.id (SET NULL)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'traditional_questions_created_by_fkey'
            AND table_name = 'traditional_questions'
        ) THEN
          ALTER TABLE traditional_questions
            ADD CONSTRAINT traditional_questions_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES backoffice_staff_users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: traditional_questions.updated_by → backoffice_staff_users.id (SET NULL)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'traditional_questions_updated_by_fkey'
            AND table_name = 'traditional_questions'
        ) THEN
          ALTER TABLE traditional_questions
            ADD CONSTRAINT traditional_questions_updated_by_fkey
            FOREIGN KEY (updated_by) REFERENCES backoffice_staff_users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: traditional_questions.status_updated_by → backoffice_staff_users.id (SET NULL)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'traditional_questions_status_updated_by_fkey'
            AND table_name = 'traditional_questions'
        ) THEN
          ALTER TABLE traditional_questions
            ADD CONSTRAINT traditional_questions_status_updated_by_fkey
            FOREIGN KEY (status_updated_by) REFERENCES backoffice_staff_users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: traditional_question_categories.question_id → traditional_questions.id (CASCADE)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'traditional_question_categories_question_id_fkey'
            AND table_name = 'traditional_question_categories'
        ) THEN
          ALTER TABLE traditional_question_categories
            ADD CONSTRAINT traditional_question_categories_question_id_fkey
            FOREIGN KEY (question_id) REFERENCES traditional_questions (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: traditional_question_categories.category_value_id → category_values.id (CASCADE)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'traditional_question_categories_category_value_id_fkey'
            AND table_name = 'traditional_question_categories'
        ) THEN
          ALTER TABLE traditional_question_categories
            ADD CONSTRAINT traditional_question_categories_category_value_id_fkey
            FOREIGN KEY (category_value_id) REFERENCES category_values (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: traditional_question_tags.question_id → traditional_questions.id (CASCADE)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'traditional_question_tags_question_id_fkey'
            AND table_name = 'traditional_question_tags'
        ) THEN
          ALTER TABLE traditional_question_tags
            ADD CONSTRAINT traditional_question_tags_question_id_fkey
            FOREIGN KEY (question_id) REFERENCES traditional_questions (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: traditional_question_tags.tag_id → tags.id (CASCADE)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'traditional_question_tags_tag_id_fkey'
            AND table_name = 'traditional_question_tags'
        ) THEN
          ALTER TABLE traditional_question_tags
            ADD CONSTRAINT traditional_question_tags_tag_id_fkey
            FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── B-tree indexes: traditional_questions ─────────────────────────────

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_traditional_questions_subject_id
        ON traditional_questions (subject_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_traditional_questions_division_id
        ON traditional_questions (division_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_traditional_questions_lesson_id
        ON traditional_questions (lesson_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_traditional_questions_subsection_id
        ON traditional_questions (subsection_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_traditional_questions_question_type
        ON traditional_questions (question_type)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_traditional_questions_status
        ON traditional_questions (status)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_traditional_questions_deleted_at
        ON traditional_questions (deleted_at)
    `)

    // ── B-tree indexes: traditional_question_categories ───────────────────

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_traditional_question_categories_question_id
        ON traditional_question_categories (question_id)
    `)

    // ── B-tree indexes: traditional_question_tags ─────────────────────────

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_traditional_question_tags_question_id
        ON traditional_question_tags (question_id)
    `)

    // ── Schema version bump: 1.18.0 → 1.19.0 ─────────────────────────────
    await client.query(`
      UPDATE _schema_versions
      SET version = '1.19.0', updated_at = NOW()
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

  // Enforce one category value per question
  await client.query(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_traditional_question_categories
      ON traditional_question_categories (question_id, category_value_id)
  `)

  // Enforce one tag per question
  await client.query(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_traditional_question_tags
      ON traditional_question_tags (question_id, tag_id)
  `)
}
