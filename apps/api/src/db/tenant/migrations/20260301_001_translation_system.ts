/**
 * Tenant Database Migration — Translation System
 *
 * File: apps/api/src/db/tenant/migrations/20260301_001_translation_system.ts
 * Date: 2026-03-01
 * Stage: 019_TRANSLATION_SYSTEM
 *
 * Purpose:
 * Create `translations` and `translation_audit_logs` tables with all indexes,
 * attach immutability trigger to audit table, and bump schema_version 1.1.0 → 1.2.0.
 *
 * Constitutional Compliance:
 * ✓ Tenant DB only — no master_db schema changes
 * ✓ Forward-only migration — down() throws per ADR-0008
 * ✓ All DDL in single transactional BEGIN/COMMIT block
 * ✓ CREATE ... IF NOT EXISTS for idempotency
 * ✓ Additive-only — no existing table modifications
 * ✓ Reuses existing prevent_audit_modification() trigger function
 * ✓ schema_version bumped from 1.1.0 to 1.2.0
 */

import type { PoolClient } from 'pg'

export const description =
  'Create translations and translation_audit_logs tables with indexes and immutability trigger; bump schema_version 1.1.0 → 1.2.0'

/**
 * Forward migration — single transactional DDL block.
 *
 * Transaction boundary:
 *   BEGIN → CREATE translations → indexes → CREATE translation_audit_logs
 *         → indexes → immutability trigger → UPDATE schema_version → COMMIT
 *
 * Failure in any statement rolls back the entire transaction.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // -----------------------------------------------------------------------
    // STEP 1: Create translations table with composite unique constraint
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS translations (
        id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type    VARCHAR(100) NOT NULL,
        entity_id      UUID         NOT NULL,
        field_name     VARCHAR(100) NOT NULL,
        language_code  VARCHAR(10)  NOT NULL,
        translated_value TEXT       NOT NULL,
        created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT translations_composite_unique
          UNIQUE (entity_type, entity_id, field_name, language_code)
      )
    `)

    // -----------------------------------------------------------------------
    // STEP 2: Indexes on translations
    // -----------------------------------------------------------------------

    // Index 1: Batch entity load (FR-037) + entity cleanup
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_translations_entity
        ON translations (entity_type, entity_id)
    `)

    // Index 2: Coverage aggregation (FR-022) — index-only COUNT(*) scans
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_translations_coverage
        ON translations (entity_type, language_code)
    `)

    // Index 3: Language drain / row-count threshold check
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_translations_language
        ON translations (language_code)
    `)

    // -----------------------------------------------------------------------
    // STEP 3: Create translation_audit_logs table
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS translation_audit_logs (
        id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id    UUID         NOT NULL,
        entity_type     VARCHAR(100) NOT NULL,
        entity_id       UUID         NOT NULL,
        field_name      VARCHAR(100) NOT NULL,
        language_code   VARCHAR(10)  NOT NULL,
        action          VARCHAR(20)  NOT NULL,
        previous_value  TEXT,
        new_value       TEXT,
        user_id         UUID         NOT NULL,
        correlation_id  VARCHAR(50)  NOT NULL,
        reason          VARCHAR(100),
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `)

    // -----------------------------------------------------------------------
    // STEP 4: Indexes on translation_audit_logs
    // -----------------------------------------------------------------------

    // Index 1: Primary query — paginated audit trail per entity
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tal_entity_created
        ON translation_audit_logs (workspace_id, entity_type, entity_id, created_at DESC, id DESC)
    `)

    // Index 2: Audit trail by language (language removal queries)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tal_language_created
        ON translation_audit_logs (workspace_id, language_code, created_at DESC)
    `)

    // -----------------------------------------------------------------------
    // STEP 5: Attach immutability trigger to translation_audit_logs
    // Reuses the prevent_audit_modification() function from v1.0.0 triggers.sql.
    // Blocks UPDATE and DELETE on the audit table at database level.
    // -----------------------------------------------------------------------
    await client.query(`
      DROP TRIGGER IF EXISTS prevent_translation_audit_modification
        ON translation_audit_logs
    `)

    await client.query(`
      CREATE TRIGGER prevent_translation_audit_modification
        BEFORE UPDATE OR DELETE ON translation_audit_logs
        FOR EACH ROW
        EXECUTE FUNCTION prevent_audit_modification()
    `)

    // -----------------------------------------------------------------------
    // STEP 6: Bump schema_version 1.1.0 → 1.2.0
    // -----------------------------------------------------------------------
    await client.query(`
      UPDATE schema_version
        SET version = '1.2.0',
            applied_at = NOW()
      WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

/**
 * Reverse migration — NOT IMPLEMENTED.
 *
 * Translation system migration is forward-only per ADR-0008.
 * Rollback must be performed via database snapshot restore.
 */
export async function down(_client: PoolClient): Promise<void> {
  throw new Error(
    'Translation system migration is not reversible. Restore from snapshot.'
  )
}
