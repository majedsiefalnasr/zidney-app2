/**
 * Migration 011 — MCQ Baskets
 *
 * File: apps/api/src/db/tenant/migrations/20260323_011_mcq_baskets.ts
 * Stage: STAGE_33_MCQ_BASKETS
 * Schema: 1.16.0 → 1.17.0
 *
 * Two-phase approach (CONCURRENT index requirement):
 *   Phase 1 (inside BEGIN/COMMIT): DDL + FK constraints + B-tree indexes + schema version bump.
 *   Phase 2 (outside transaction): CONCURRENT unique indexes.
 *
 * CONCURRENT indexes cannot be created inside a transaction block.
 */

import type { PoolClient } from 'pg'

export const description =
  'Create mcq_baskets and mcq_basket_questions tables with FK constraints, B-tree indexes, and CONCURRENT unique index. Bump schema version to 1.17.0.'

// ---------------------------------------------------------------------------
// Migration Up
// ---------------------------------------------------------------------------

export async function up(client: PoolClient): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1: DDL + FK constraints + B-tree indexes (inside transaction)
  // ─────────────────────────────────────────────────────────────────────────
  await client.query('BEGIN')
  try {
    // ── Table: mcq_baskets ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcq_baskets (
        id               UUID         NOT NULL DEFAULT gen_random_uuid(),
        name             VARCHAR(255) NOT NULL,
        code             VARCHAR(100) NOT NULL,
        type             VARCHAR(20)  NOT NULL
                           CONSTRAINT mcq_baskets_type_check
                           CHECK (type IN ('LINKED', 'UNLINKED')),
        max_questions    INTEGER,
        description      TEXT,
        status           VARCHAR(20)  NOT NULL DEFAULT 'DRAFT'
                           CONSTRAINT mcq_baskets_status_check
                           CHECK (status IN ('DRAFT', 'COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED')),
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        status_updated_at TIMESTAMPTZ,
        status_updated_by UUID,
        created_by       UUID,
        updated_by       UUID,
        CONSTRAINT mcq_baskets_pkey PRIMARY KEY (id)
      )
    `)

    // ── Table: mcq_basket_questions ───────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcq_basket_questions (
        id          UUID        NOT NULL DEFAULT gen_random_uuid(),
        basket_id   UUID        NOT NULL,
        question_id UUID        NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT mcq_basket_questions_pkey PRIMARY KEY (id)
      )
    `)

    // ── FK: mcq_baskets.status_updated_by → users.id (SET NULL) ──────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_baskets_status_updated_by_fkey'
            AND table_name = 'mcq_baskets'
        ) THEN
          ALTER TABLE mcq_baskets
            ADD CONSTRAINT mcq_baskets_status_updated_by_fkey
            FOREIGN KEY (status_updated_by) REFERENCES users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: mcq_baskets.created_by → users.id (SET NULL) ─────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_baskets_created_by_fkey'
            AND table_name = 'mcq_baskets'
        ) THEN
          ALTER TABLE mcq_baskets
            ADD CONSTRAINT mcq_baskets_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: mcq_baskets.updated_by → users.id (SET NULL) ─────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_baskets_updated_by_fkey'
            AND table_name = 'mcq_baskets'
        ) THEN
          ALTER TABLE mcq_baskets
            ADD CONSTRAINT mcq_baskets_updated_by_fkey
            FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: mcq_basket_questions.basket_id → mcq_baskets.id (CASCADE) ────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_basket_questions_basket_id_fkey'
            AND table_name = 'mcq_basket_questions'
        ) THEN
          ALTER TABLE mcq_basket_questions
            ADD CONSTRAINT mcq_basket_questions_basket_id_fkey
            FOREIGN KEY (basket_id) REFERENCES mcq_baskets (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: mcq_basket_questions.question_id → mcq_questions.id (CASCADE) ─
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_basket_questions_question_id_fkey'
            AND table_name = 'mcq_basket_questions'
        ) THEN
          ALTER TABLE mcq_basket_questions
            ADD CONSTRAINT mcq_basket_questions_question_id_fkey
            FOREIGN KEY (question_id) REFERENCES mcq_questions (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── B-tree indexes ─────────────────────────────────────────────────────

    // Filter baskets by type (LINKED / UNLINKED)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_baskets_type
        ON mcq_baskets (type)
    `)

    // Filter baskets by workflow status
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_baskets_status
        ON mcq_baskets (status)
    `)

    // Lookup all question links for a basket (used by auto-selection engine subquery — FR-020)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_basket_questions_basket_id
        ON mcq_basket_questions (basket_id)
    `)

    // Reverse lookup: all baskets containing a question
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_basket_questions_question_id
        ON mcq_basket_questions (question_id)
    `)

    // ── Schema version bump: 1.16.0 → 1.17.0 ─────────────────────────────
    await client.query(`
      UPDATE _schema_versions
      SET version = '1.17.0', updated_at = NOW()
      WHERE name = 'schema_version'
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2: CONCURRENT unique index — MUST run outside transaction
  // CONCURRENTLY prevents table locks on tenant databases with existing rows.
  // ─────────────────────────────────────────────────────────────────────────

  // Enforce basket code uniqueness per tenant (FR-007 / BR-01)
  await client.query(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_mcq_baskets_code
      ON mcq_baskets (code)
  `)

  // Enforce one question can only be linked once per basket (FR-013 / BR-11)
  await client.query(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_mcq_basket_questions
      ON mcq_basket_questions (basket_id, question_id)
  `)
}
