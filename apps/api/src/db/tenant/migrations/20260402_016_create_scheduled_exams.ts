/**
 * Migration 016 — Scheduled Exam Engine
 *
 * File: apps/api/src/db/tenant/migrations/20260402_016_create_scheduled_exams.ts
 * Stage: STAGE_38_SCHEDULED_EXAM_ENGINE
 * Schema: 1.21.0 → 1.22.0
 *
 * Two-phase approach (CONCURRENT index requirement):
 *   Phase 1 (inside BEGIN/COMMIT): DDL + FK constraints + CHECK constraints + B-tree indexes + schema version bump.
 *   Phase 2 (outside transaction): CONCURRENT unique indexes.
 *
 * Tables created:
 *   1. scheduled_exams — scheduled exam engine entity
 */

import type { PoolClient } from 'pg'

export const description =
  'Create scheduled_exams table with 20 columns, FK to workspaces, CHECK constraints, B-tree indexes. Bump schema version to 1.22.0.'

// ---------------------------------------------------------------------------
// Migration Up
// ---------------------------------------------------------------------------

export async function up(client: PoolClient): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1: DDL + FK constraints + B-tree indexes (inside transaction)
  // ─────────────────────────────────────────────────────────────────────────
  await client.query('BEGIN')
  try {
    // ── Table: scheduled_exams ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS scheduled_exams (
        id                    UUID           NOT NULL DEFAULT gen_random_uuid(),
        base_exam_id          UUID           NOT NULL,
        base_exam_type        VARCHAR(30)    NOT NULL
                                CONSTRAINT scheduled_exams_base_exam_type_check
                                CHECK (base_exam_type IN ('MCQ_EXAM', 'TRADITIONAL_EXAM')),
        workspace_id          UUID           NOT NULL,
        title                 VARCHAR(500)   NOT NULL,
        code                  VARCHAR(100)   NOT NULL,
        instructions          TEXT,
        status                VARCHAR(30)    NOT NULL DEFAULT 'DRAFT'
                                CONSTRAINT scheduled_exams_status_check
                                CHECK (status IN ('DRAFT','UNDER_REVIEW','APPROVED','ENABLED','DISABLED','ARCHIVED')),
        total_marks           NUMERIC(10,2)  NOT NULL,
        pass_mark             NUMERIC(10,2)  NOT NULL,
        duration_minutes      INTEGER,
        window_start          TIMESTAMPTZ    NOT NULL,
        window_end            TIMESTAMPTZ    NOT NULL,
        question_pool_id      UUID,
        base_exam_snapshot    JSONB,
        base_exam_hash        VARCHAR(64),
        base_exam_modified    BOOLEAN        NOT NULL DEFAULT false,
        deleted_at            TIMESTAMPTZ,
        created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        created_by            UUID,
        updated_by            UUID,
        CONSTRAINT scheduled_exams_pkey PRIMARY KEY (id),
        CONSTRAINT scheduled_exams_workspace_fk FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        CONSTRAINT scheduled_exams_pass_mark_check CHECK (pass_mark > 0),
        CONSTRAINT scheduled_exams_total_marks_check CHECK (total_marks > 0),
        CONSTRAINT scheduled_exams_window_check CHECK (window_end > window_start)
      )
    `)

    // ── B-tree Indexes ──────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_exams_workspace_id
      ON scheduled_exams (workspace_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_exams_base_exam_id
      ON scheduled_exams (base_exam_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_exams_workspace_status
      ON scheduled_exams (workspace_id, status) WHERE deleted_at IS NULL
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_exams_workspace_window
      ON scheduled_exams (workspace_id, window_start, window_end) WHERE deleted_at IS NULL
    `)

    // ── Schema Version Bump ────────────────────────────────────────────────
    await client.query(`
      UPDATE _schema_versions
      SET version = '1.22.0', updated_at = NOW()
      WHERE version = '1.21.0'
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
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_exams_code_unique
    ON scheduled_exams (workspace_id, code) WHERE deleted_at IS NULL
  `)
}

// ---------------------------------------------------------------------------
// Migration Down (rollback)
// ---------------------------------------------------------------------------

export async function down(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    await client.query('DROP TABLE IF EXISTS scheduled_exams CASCADE')

    await client.query(`
      UPDATE _schema_versions
      SET version = '1.21.0', updated_at = NOW()
      WHERE version = '1.22.0'
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}
