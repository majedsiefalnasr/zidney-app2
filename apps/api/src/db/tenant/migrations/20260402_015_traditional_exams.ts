/**
 * Migration 015 — Traditional Exam Configuration
 *
 * File: apps/api/src/db/tenant/migrations/20260402_015_traditional_exams.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 * Schema: 1.20.0 → 1.21.0
 *
 * Two-phase approach (CONCURRENT index requirement):
 *   Phase 1 (inside BEGIN/COMMIT): DDL + FK constraints + CHECK constraints + B-tree indexes + schema version bump.
 *   Phase 2 (outside transaction): CONCURRENT unique indexes.
 *
 * Tables created:
 *   1. traditional_exams               — core exam configuration entity
 *   2. traditional_exam_settings       — delivery mode & result visibility (1:1)
 *   3. traditional_exam_questions      — question assignments with score snapshot
 *
 * Tables altered:
 *   4. traditional_exam_sections       — add template_section_id, header_content, order_index
 *   5. traditional_exam_subsections    — add template_subsection_id, header_content, order_index
 */

import type { PoolClient } from 'pg'

export const description =
  'Create traditional_exams, traditional_exam_settings, traditional_exam_questions tables. ALTER traditional_exam_sections and traditional_exam_subsections with new columns. Bump schema version to 1.21.0.'

// ---------------------------------------------------------------------------
// Migration Up
// ---------------------------------------------------------------------------

export async function up(client: PoolClient): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1: DDL + FK constraints + B-tree indexes (inside transaction)
  // ─────────────────────────────────────────────────────────────────────────
  await client.query('BEGIN')
  try {
    // ── Table: traditional_exams ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS traditional_exams (
        id                 UUID           NOT NULL DEFAULT gen_random_uuid(),
        subject_id         UUID           NOT NULL,
        division_id        UUID,
        semester_id        UUID,
        template_id        UUID           NOT NULL,
        name               VARCHAR(500)   NOT NULL,
        code               VARCHAR(100)   NOT NULL,
        description        TEXT,
        duration_minutes   INTEGER,
        pass_percentage    NUMERIC(5,2)   NOT NULL
                             CONSTRAINT traditional_exams_pass_percentage_check
                             CHECK (pass_percentage > 0 AND pass_percentage <= 100),
        module_type        VARCHAR(20)    NOT NULL
                             CONSTRAINT traditional_exams_module_type_check
                             CHECK (module_type IN ('TOPIC', 'EXERCISE')),
        status             VARCHAR(30)    NOT NULL DEFAULT 'DRAFT'
                             CONSTRAINT traditional_exams_status_check
                             CHECK (status IN ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ENABLED', 'DISABLED')),
        deleted_at         TIMESTAMPTZ,
        created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        created_by         UUID,
        updated_by         UUID,
        CONSTRAINT traditional_exams_pkey PRIMARY KEY (id)
      )
    `)

    // ── Table: traditional_exam_settings ───────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS traditional_exam_settings (
        id                        UUID        NOT NULL DEFAULT gen_random_uuid(),
        exam_id                   UUID        NOT NULL,
        allow_relax_mode          BOOLEAN     NOT NULL DEFAULT true,
        allow_chrono_mode         BOOLEAN     NOT NULL DEFAULT false,
        allow_review_answers      BOOLEAN     NOT NULL DEFAULT true,
        allow_review_hints        BOOLEAN     NOT NULL DEFAULT false,
        allow_result_effects      BOOLEAN     NOT NULL DEFAULT true,
        show_results_after_submit BOOLEAN     NOT NULL DEFAULT true,
        show_correct_answers      BOOLEAN     NOT NULL DEFAULT false,
        show_explanations         BOOLEAN     NOT NULL DEFAULT false,
        enable_certificate        BOOLEAN     NOT NULL DEFAULT false,
        message_template_id       UUID,
        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT traditional_exam_settings_pkey PRIMARY KEY (id)
      )
    `)

    // ── Table: traditional_exam_questions ──────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS traditional_exam_questions (
        id              UUID           NOT NULL DEFAULT gen_random_uuid(),
        subsection_id   UUID           NOT NULL,
        question_id     UUID           NOT NULL,
        score           NUMERIC(10,2)  NOT NULL
                          CONSTRAINT traditional_exam_questions_score_check
                          CHECK (score > 0),
        order_index     INTEGER        NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        CONSTRAINT traditional_exam_questions_pkey PRIMARY KEY (id)
      )
    `)

    // ── ALTER: traditional_exam_sections — add columns ────────────────────
    await client.query(`
      ALTER TABLE traditional_exam_sections
        ADD COLUMN IF NOT EXISTS template_section_id UUID,
        ADD COLUMN IF NOT EXISTS header_content      TEXT,
        ADD COLUMN IF NOT EXISTS order_index         INTEGER NOT NULL DEFAULT 0
    `)

    // ── ALTER: traditional_exam_subsections — add columns ─────────────────
    await client.query(`
      ALTER TABLE traditional_exam_subsections
        ADD COLUMN IF NOT EXISTS template_subsection_id UUID,
        ADD COLUMN IF NOT EXISTS header_content         TEXT,
        ADD COLUMN IF NOT EXISTS order_index            INTEGER NOT NULL DEFAULT 0
    `)

    // ── FK: traditional_exams.subject_id → subjects.id (RESTRICT) ─────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'traditional_exams_subject_id_fkey'
            AND table_name = 'traditional_exams'
        ) THEN
          ALTER TABLE traditional_exams
            ADD CONSTRAINT traditional_exams_subject_id_fkey
            FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE RESTRICT;
        END IF;
      END $$
    `)

    // ── FK: traditional_exam_settings.exam_id → traditional_exams.id (CASCADE) ──
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'traditional_exam_settings_exam_id_fkey'
            AND table_name = 'traditional_exam_settings'
        ) THEN
          ALTER TABLE traditional_exam_settings
            ADD CONSTRAINT traditional_exam_settings_exam_id_fkey
            FOREIGN KEY (exam_id) REFERENCES traditional_exams (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: traditional_exam_questions.subsection_id → traditional_exam_subsections.id (CASCADE) ──
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'traditional_exam_questions_subsection_id_fkey'
            AND table_name = 'traditional_exam_questions'
        ) THEN
          ALTER TABLE traditional_exam_questions
            ADD CONSTRAINT traditional_exam_questions_subsection_id_fkey
            FOREIGN KEY (subsection_id) REFERENCES traditional_exam_subsections (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: traditional_exam_questions.question_id → traditional_questions.id (RESTRICT) ──
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'traditional_exam_questions_question_id_fkey'
            AND table_name = 'traditional_exam_questions'
        ) THEN
          ALTER TABLE traditional_exam_questions
            ADD CONSTRAINT traditional_exam_questions_question_id_fkey
            FOREIGN KEY (question_id) REFERENCES traditional_questions (id) ON DELETE RESTRICT;
        END IF;
      END $$
    `)

    // ── FK: traditional_exam_sections.exam_id → traditional_exams.id (CASCADE) ──
    // The stub already has exam_id but may not have the FK to traditional_exams
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'traditional_exam_sections_exam_id_fkey_v2'
            AND table_name = 'traditional_exam_sections'
        ) THEN
          ALTER TABLE traditional_exam_sections
            ADD CONSTRAINT traditional_exam_sections_exam_id_fkey_v2
            FOREIGN KEY (exam_id) REFERENCES traditional_exams (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── B-tree Indexes ────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_traditional_exams_subject_id ON traditional_exams (subject_id)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_traditional_exams_division_id ON traditional_exams (division_id)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_traditional_exams_status ON traditional_exams (status)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_traditional_exams_module_type ON traditional_exams (module_type)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_traditional_exams_template_id ON traditional_exams (template_id)
    `)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_traditional_exam_settings_exam_id ON traditional_exam_settings (exam_id)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trad_exam_questions_subsection_id ON traditional_exam_questions (subsection_id)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trad_exam_sections_exam_id ON traditional_exam_sections (exam_id)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trad_exam_subsections_section_id ON traditional_exam_subsections (section_id)
    `)

    // ── Schema Version Bump ───────────────────────────────────────────────
    await client.query(`
      UPDATE _schema_versions
      SET version = '1.21.0', updated_at = NOW()
      WHERE version = '1.20.0'
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2: CONCURRENT unique indexes (outside transaction)
  // ─────────────────────────────────────────────────────────────────────────
  await client.query(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS traditional_exams_code_unique_active
    ON traditional_exams (LOWER(code)) WHERE deleted_at IS NULL
  `)

  await client.query(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_trad_exam_questions_subsection_question
    ON traditional_exam_questions (subsection_id, question_id)
  `)
}

// ---------------------------------------------------------------------------
// Migration Down (rollback)
// ---------------------------------------------------------------------------

export async function down(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // Drop new tables (reverse order of creation)
    await client.query('DROP TABLE IF EXISTS traditional_exam_questions CASCADE')
    await client.query('DROP TABLE IF EXISTS traditional_exam_settings CASCADE')
    await client.query('DROP TABLE IF EXISTS traditional_exams CASCADE')

    // Remove added columns from stubs
    await client.query(`
      ALTER TABLE traditional_exam_subsections
        DROP COLUMN IF EXISTS template_subsection_id,
        DROP COLUMN IF EXISTS header_content,
        DROP COLUMN IF EXISTS order_index
    `)
    await client.query(`
      ALTER TABLE traditional_exam_sections
        DROP COLUMN IF EXISTS template_section_id,
        DROP COLUMN IF EXISTS header_content,
        DROP COLUMN IF EXISTS order_index
    `)

    // Revert schema version
    await client.query(`
      UPDATE _schema_versions
      SET version = '1.20.0', updated_at = NOW()
      WHERE version = '1.21.0'
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}
