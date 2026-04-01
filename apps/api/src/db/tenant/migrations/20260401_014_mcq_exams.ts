/**
 * Migration 014 — MCQ Exam Configuration
 *
 * File: apps/api/src/db/tenant/migrations/20260401_014_mcq_exams.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 * Schema: 1.19.0 → 1.20.0
 *
 * Two-phase approach (CONCURRENT index requirement):
 *   Phase 1 (inside BEGIN/COMMIT): DDL + FK constraints + CHECK constraints + B-tree indexes + schema version bump.
 *   Phase 2 (outside transaction): CONCURRENT unique indexes.
 *
 * Tables created:
 *   1. mcq_exams               — core exam configuration entity
 *   2. mcq_exam_settings       — delivery mode & result visibility (1:1)
 *   3. mcq_exam_questions      — manual question selection (M:N link → mcq_questions)
 *   4. mcq_exam_auto_criteria  — automatic selection criteria with uuid[] arrays
 */

import type { PoolClient } from 'pg'

export const description =
  'Create mcq_exams, mcq_exam_settings, mcq_exam_questions, mcq_exam_auto_criteria tables with FK constraints, CHECK constraints, B-tree indexes, and CONCURRENT unique indexes. Bump schema version to 1.20.0.'

// ---------------------------------------------------------------------------
// Migration Up
// ---------------------------------------------------------------------------

export async function up(client: PoolClient): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1: DDL + FK constraints + B-tree indexes (inside transaction)
  // ─────────────────────────────────────────────────────────────────────────
  await client.query('BEGIN')
  try {
    // ── Table: mcq_exams ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcq_exams (
        id                      UUID           NOT NULL DEFAULT gen_random_uuid(),
        subject_id              UUID           NOT NULL,
        division_id             UUID,
        name                    VARCHAR(255)   NOT NULL,
        code                    VARCHAR(100)   NOT NULL,
        description             TEXT,
        language                VARCHAR(10)    NOT NULL,
        total_questions         INTEGER        NOT NULL
                                  CONSTRAINT mcq_exams_total_questions_check
                                  CHECK (total_questions > 0),
        duration_minutes        INTEGER,
        pass_type               VARCHAR(20)    NOT NULL
                                  CONSTRAINT mcq_exams_pass_type_check
                                  CHECK (pass_type IN ('PERCENTAGE', 'SCORE')),
        pass_value              NUMERIC(10,2)  NOT NULL
                                  CONSTRAINT mcq_exams_pass_value_check
                                  CHECK (pass_value > 0),
        allow_multiple_attempts BOOLEAN        NOT NULL DEFAULT false,
        selection_mode          VARCHAR(20)    NOT NULL
                                  CONSTRAINT mcq_exams_selection_mode_check
                                  CHECK (selection_mode IN ('MANUAL', 'AUTOMATIC')),
        status                  VARCHAR(30)    NOT NULL DEFAULT 'COMPLETED'
                                  CONSTRAINT mcq_exams_status_check
                                  CHECK (status IN ('DRAFT', 'COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED')),
        deleted_at              TIMESTAMPTZ,
        created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        created_by              UUID,
        updated_by              UUID,
        CONSTRAINT mcq_exams_pkey PRIMARY KEY (id)
      )
    `)

    // ── Table: mcq_exam_settings ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcq_exam_settings (
        id                        UUID        NOT NULL DEFAULT gen_random_uuid(),
        exam_id                   UUID        NOT NULL,
        allow_relax_mode          BOOLEAN     NOT NULL DEFAULT true,
        allow_chrono_mode         BOOLEAN     NOT NULL DEFAULT false,
        allow_rush_mode           BOOLEAN     NOT NULL DEFAULT false,
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
        CONSTRAINT mcq_exam_settings_pkey PRIMARY KEY (id)
      )
    `)

    // ── Table: mcq_exam_questions ─────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcq_exam_questions (
        id          UUID        NOT NULL DEFAULT gen_random_uuid(),
        exam_id     UUID        NOT NULL,
        question_id UUID        NOT NULL,
        order_index INTEGER     NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT mcq_exam_questions_pkey PRIMARY KEY (id),
        CONSTRAINT mcq_exam_questions_exam_question_unique UNIQUE (exam_id, question_id),
        CONSTRAINT mcq_exam_questions_exam_order_unique UNIQUE (exam_id, order_index)
      )
    `)

    // ── Table: mcq_exam_auto_criteria ─────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcq_exam_auto_criteria (
        id                 UUID        NOT NULL DEFAULT gen_random_uuid(),
        exam_id            UUID        NOT NULL,
        lesson_ids         UUID[],
        category_value_ids UUID[],
        tag_ids            UUID[],
        basket_ids         UUID[],
        percentage         INTEGER     NOT NULL
                             CONSTRAINT mcq_exam_auto_criteria_percentage_check
                             CHECK (percentage >= 0 AND percentage <= 100),
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT mcq_exam_auto_criteria_pkey PRIMARY KEY (id)
      )
    `)

    // ── FK: mcq_exams.subject_id → subjects.id (RESTRICT) ────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_exams_subject_id_fkey'
            AND table_name = 'mcq_exams'
        ) THEN
          ALTER TABLE mcq_exams
            ADD CONSTRAINT mcq_exams_subject_id_fkey
            FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE RESTRICT;
        END IF;
      END $$
    `)

    // ── FK: mcq_exams.division_id → divisions.id (SET NULL) ──────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_exams_division_id_fkey'
            AND table_name = 'mcq_exams'
        ) THEN
          ALTER TABLE mcq_exams
            ADD CONSTRAINT mcq_exams_division_id_fkey
            FOREIGN KEY (division_id) REFERENCES divisions (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: mcq_exam_settings.exam_id → mcq_exams.id (CASCADE) ──────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_exam_settings_exam_id_fkey'
            AND table_name = 'mcq_exam_settings'
        ) THEN
          ALTER TABLE mcq_exam_settings
            ADD CONSTRAINT mcq_exam_settings_exam_id_fkey
            FOREIGN KEY (exam_id) REFERENCES mcq_exams (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: mcq_exam_questions.exam_id → mcq_exams.id (CASCADE) ─────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_exam_questions_exam_id_fkey'
            AND table_name = 'mcq_exam_questions'
        ) THEN
          ALTER TABLE mcq_exam_questions
            ADD CONSTRAINT mcq_exam_questions_exam_id_fkey
            FOREIGN KEY (exam_id) REFERENCES mcq_exams (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: mcq_exam_questions.question_id → mcq_questions.id (RESTRICT) ─
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_exam_questions_question_id_fkey'
            AND table_name = 'mcq_exam_questions'
        ) THEN
          ALTER TABLE mcq_exam_questions
            ADD CONSTRAINT mcq_exam_questions_question_id_fkey
            FOREIGN KEY (question_id) REFERENCES mcq_questions (id) ON DELETE RESTRICT;
        END IF;
      END $$
    `)

    // ── FK: mcq_exam_auto_criteria.exam_id → mcq_exams.id (CASCADE) ─────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_exam_auto_criteria_exam_id_fkey'
            AND table_name = 'mcq_exam_auto_criteria'
        ) THEN
          ALTER TABLE mcq_exam_auto_criteria
            ADD CONSTRAINT mcq_exam_auto_criteria_exam_id_fkey
            FOREIGN KEY (exam_id) REFERENCES mcq_exams (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── B-tree Indexes ────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_exams_subject_id ON mcq_exams (subject_id)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_exams_division_id ON mcq_exams (division_id)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_exams_status ON mcq_exams (status)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_exams_selection_mode ON mcq_exams (selection_mode)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_exams_deleted_at ON mcq_exams (deleted_at)
    `)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mcq_exam_settings_exam_id ON mcq_exam_settings (exam_id)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_exam_questions_exam_id ON mcq_exam_questions (exam_id)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_exam_questions_question_id ON mcq_exam_questions (question_id)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_exam_auto_criteria_exam_id ON mcq_exam_auto_criteria (exam_id)
    `)

    // ── Schema Version Bump ───────────────────────────────────────────────
    await client.query(`
      UPDATE _schema_versions
      SET version = '1.20.0', updated_at = NOW()
      WHERE version = '1.19.0'
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
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS mcq_exams_code_unique_active
    ON mcq_exams (LOWER(code)) WHERE deleted_at IS NULL
  `)
}
