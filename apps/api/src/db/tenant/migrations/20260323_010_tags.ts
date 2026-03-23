/**
 * Migration 010 — Tags
 *
 * File: apps/api/src/db/tenant/migrations/20260323_010_tags.ts
 * Stage: STAGE_32_TAGS
 * Schema: 1.15.0 → 1.16.0
 *
 * Two-phase approach (CONCURRENT index requirement):
 *   Phase 1 (inside BEGIN/COMMIT): DDL + FK constraints + B-tree indexes + schema version bump.
 *   Phase 2 (outside transaction): CONCURRENT unique indexes.
 *
 * CONCURRENT indexes cannot be created inside a transaction block. Both
 * unique_tags_normalized_name and unique_tag_relation must run after COMMIT.
 */

import type { PoolClient } from 'pg'

export const description =
  'Create tags and tag_relations tables with FK constraints, B-tree indexes, and CONCURRENT unique indexes. Bump schema version to 1.16.0.'

// ---------------------------------------------------------------------------
// Migration Up
// ---------------------------------------------------------------------------

export async function up(client: PoolClient): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1: DDL + FK constraints + B-tree indexes (inside transaction)
  // ─────────────────────────────────────────────────────────────────────────
  await client.query('BEGIN')
  try {
    // ── Table: tags ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id               UUID         NOT NULL DEFAULT gen_random_uuid(),
        name             VARCHAR(255) NOT NULL,
        normalized_name  VARCHAR(255) NOT NULL,
        status           VARCHAR(20)  NOT NULL DEFAULT 'ENABLED'
                           CONSTRAINT tags_status_check CHECK (status IN ('ENABLED', 'DISABLED')),
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        created_by       UUID,
        updated_by       UUID,
        CONSTRAINT tags_pkey PRIMARY KEY (id)
      )
    `)

    // ── Table: tag_relations ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tag_relations (
        id           UUID        NOT NULL DEFAULT gen_random_uuid(),
        tag_id       UUID        NOT NULL,
        entity_type  VARCHAR(40) NOT NULL
                       CONSTRAINT tag_relations_entity_type_check
                       CHECK (entity_type IN ('MCQ_QUESTION', 'TRADITIONAL_QUESTION', 'LIBRARY_FILE')),
        entity_id    UUID        NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT tag_relations_pkey PRIMARY KEY (id)
      )
    `)

    // ── FK: tags.created_by → users.id (SET NULL) ─────────────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'tags_created_by_fkey'
            AND table_name = 'tags'
        ) THEN
          ALTER TABLE tags
            ADD CONSTRAINT tags_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: tags.updated_by → users.id (SET NULL) ─────────────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'tags_updated_by_fkey'
            AND table_name = 'tags'
        ) THEN
          ALTER TABLE tags
            ADD CONSTRAINT tags_updated_by_fkey
            FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: tag_relations.tag_id → tags.id (CASCADE) ──────────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'tag_relations_tag_id_fkey'
            AND table_name = 'tag_relations'
        ) THEN
          ALTER TABLE tag_relations
            ADD CONSTRAINT tag_relations_tag_id_fkey
            FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── B-tree indexes ─────────────────────────────────────────────────────

    // Status-filtered tag queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tags_status
        ON tags (status)
    `)

    // Lookup all relations for a tag
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tag_relations_tag_id
        ON tag_relations (tag_id)
    `)

    // Lookup all tags for an entity (composite: entity_type + entity_id)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tag_relations_entity
        ON tag_relations (entity_type, entity_id)
    `)

    // ── Schema version bump: 1.15.0 → 1.16.0 ─────────────────────────────
    await client.query(`
      UPDATE _schema_versions
      SET version = '1.16.0', updated_at = NOW()
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

  // Case-insensitive globally unique tag name (per tenant DB, across all statuses)
  await client.query(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_tags_normalized_name
      ON tags (normalized_name)
  `)

  // Prevent duplicate tag assignments to the same entity
  await client.query(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_tag_relation
      ON tag_relations (tag_id, entity_type, entity_id)
  `)
}
