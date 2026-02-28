/**
 * Tenant Database Migration — Workspace Settings JSONB
 *
 * File: apps/api/src/db/tenant/migrations/20260228_002_workspace_settings_jsonb.ts
 * Date: 2026-02-28
 * Stage: 018_WORKSPACE_SETTINGS
 *
 * Purpose:
 * ALTER existing workspace_settings table to add JSONB columns, config_version,
 * and singleton_key. Create workspace_settings_audit table. Migrate existing
 * flat column values into JSONB structure.
 *
 * Constitutional Compliance:
 * ✓ Tenant DB only — no master_db schema changes
 * ✓ Forward-only migration — down() throws
 * ✓ Single DDL transaction — all operations or none
 * ✓ Server-authoritative timestamps (NOW())
 * ✓ No columns dropped from workspace_settings (forward-only)
 * ✓ Audit immutability enforced via trigger
 *
 * Guardian Audit Conditions:
 * ✓ Composite indexes for audit table: (workspace_id, created_at DESC, id DESC)
 * ✓ Audit immutability trigger mandatory
 * ✓ user_agent truncated to 500 chars before storage (application layer)
 */

import type { PoolClient } from 'pg'

export const description =
  'Add JSONB settings columns, config_version, singleton enforcement, and audit table for STAGE_018 Workspace Settings'

/**
 * Forward migration — ALTERs workspace_settings, creates audit table.
 *
 * Transaction boundary: BEGIN → ALTER → DATA MIGRATION → CREATE TABLE → INDEXES → COMMIT
 * Failure in any statement rolls back the entire transaction.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // -----------------------------------------------------------------------
    // STEP 1: Add singleton_key column with CHECK + UNIQUE constraint
    // Replaces trigger-based singleton with deterministic constraint enforcement
    // -----------------------------------------------------------------------
    await client.query(`
      ALTER TABLE workspace_settings
        ADD COLUMN IF NOT EXISTS singleton_key VARCHAR(10) NOT NULL DEFAULT 'SETTINGS'
    `)

    await client.query(`
      ALTER TABLE workspace_settings
        ADD CONSTRAINT workspace_settings_singleton_key_check
        CHECK (singleton_key = 'SETTINGS')
    `)

    await client.query(`
      ALTER TABLE workspace_settings
        ADD CONSTRAINT workspace_settings_singleton_key_unique
        UNIQUE (singleton_key)
    `)

    // -----------------------------------------------------------------------
    // STEP 2: Add config_version column
    // -----------------------------------------------------------------------
    await client.query(`
      ALTER TABLE workspace_settings
        ADD COLUMN IF NOT EXISTS config_version INTEGER NOT NULL DEFAULT 1
    `)

    // -----------------------------------------------------------------------
    // STEP 3: Add JSONB settings columns
    // -----------------------------------------------------------------------
    await client.query(`
      ALTER TABLE workspace_settings
        ADD COLUMN IF NOT EXISTS general_settings JSONB NOT NULL DEFAULT '{}'::jsonb
    `)

    await client.query(`
      ALTER TABLE workspace_settings
        ADD COLUMN IF NOT EXISTS language_settings JSONB NOT NULL DEFAULT '{}'::jsonb
    `)

    await client.query(`
      ALTER TABLE workspace_settings
        ADD COLUMN IF NOT EXISTS branding_settings JSONB NOT NULL DEFAULT '{}'::jsonb
    `)

    await client.query(`
      ALTER TABLE workspace_settings
        ADD COLUMN IF NOT EXISTS payment_settings JSONB NOT NULL DEFAULT '{}'::jsonb
    `)

    await client.query(`
      ALTER TABLE workspace_settings
        ADD COLUMN IF NOT EXISTS security_settings JSONB NOT NULL DEFAULT '{}'::jsonb
    `)

    // -----------------------------------------------------------------------
    // STEP 4: Migrate existing flat column values into JSONB structure
    // -----------------------------------------------------------------------
    await client.query(`
      UPDATE workspace_settings SET
        general_settings = jsonb_build_object(
          'app_name', COALESCE(organization_name, 'Uninitialized'),
          'timezone', COALESCE(timezone, 'UTC'),
          'date_format', 'YYYY-MM-DD',
          'session_timeout_minutes', COALESCE(session_timeout_minutes, 30)
        ),
        language_settings = jsonb_build_object(
          'default_language', COALESCE(default_language, 'en'),
          'supported_languages', jsonb_build_array(COALESCE(default_language, 'en'))
        ),
        security_settings = jsonb_build_object(
          'analytics_opt_in', false,
          'max_login_attempts', 5,
          'lockout_duration_minutes', 15
        )
      WHERE general_settings = '{}'::jsonb
    `)

    // -----------------------------------------------------------------------
    // STEP 5: Create workspace_settings_audit table
    // Immutable audit trail for all workspace settings changes.
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspace_settings_audit (
        id              UUID         NOT NULL DEFAULT gen_random_uuid(),
        workspace_id    UUID         NOT NULL,
        user_id         UUID         NOT NULL,
        settings_group  VARCHAR(30)  NOT NULL,
        config_version  INTEGER      NOT NULL,
        changes         JSONB        NOT NULL,
        request_id      VARCHAR(50)  NOT NULL,
        ip_address      INET,
        user_agent       TEXT,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

        CONSTRAINT workspace_settings_audit_pkey PRIMARY KEY (id),
        CONSTRAINT workspace_settings_audit_group_check
          CHECK (settings_group IN ('general', 'language', 'branding', 'payment', 'security'))
      )
    `)

    // -----------------------------------------------------------------------
    // STEP 6: Create indexes for audit table
    // Guardian audit: composite index (workspace_id, created_at DESC, id DESC) for pagination
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wsa_workspace_created_id
        ON workspace_settings_audit (workspace_id, created_at DESC, id DESC)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wsa_settings_group
        ON workspace_settings_audit (settings_group)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wsa_config_version
        ON workspace_settings_audit (config_version)
    `)

    // Singleton lookup index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_workspace_settings_singleton
        ON workspace_settings (singleton_key)
    `)

    // -----------------------------------------------------------------------
    // STEP 7: Create audit immutability trigger
    // Guardian audit: immutability trigger mandatory
    // Prevents UPDATE and DELETE on audit table at database level
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE OR REPLACE FUNCTION workspace_settings_audit_immutable()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'workspace_settings_audit table is immutable. UPDATE and DELETE operations are forbidden.';
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `)

    await client.query(`
      DROP TRIGGER IF EXISTS workspace_settings_audit_no_update ON workspace_settings_audit
    `)

    await client.query(`
      CREATE TRIGGER workspace_settings_audit_no_update
        BEFORE UPDATE OR DELETE ON workspace_settings_audit
        FOR EACH ROW
        EXECUTE FUNCTION workspace_settings_audit_immutable()
    `)

    // -----------------------------------------------------------------------
    // STEP 8: Drop old singleton trigger (replaced by CHECK + UNIQUE)
    // -----------------------------------------------------------------------
    await client.query(`
      DROP TRIGGER IF EXISTS workspace_settings_singleton_check ON workspace_settings
    `)

    await client.query(`
      DROP FUNCTION IF EXISTS workspace_settings_singleton()
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
 * 018_WORKSPACE_SETTINGS is forward-only per platform migration policy.
 * Rollback must be performed via database snapshot restore (ADR-0008).
 */
export async function down(_client: PoolClient): Promise<void> {
  throw new Error(
    '018_WORKSPACE_SETTINGS migration is forward-only. ' +
      'Rollback must be performed via database snapshot restore.'
  )
}
