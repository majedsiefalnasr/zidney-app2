/**
 * Tenant Database Migration — RBAC Role Permissions Complete
 *
 * File: apps/api/src/db/tenant/migrations/20260302_001_rbac_role_permissions_complete.ts
 * Date: 2026-03-02
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM
 * Phase: 03_BACKOFFICE_CORE / 01_FOUNDATION
 *
 * Purpose:
 * Extends the STAGE_17 RBAC skeleton with:
 * 1. ALTER backoffice_roles — ADD status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK
 * 2. CREATE backoffice_role_module_permissions — boolean-flags permission model
 * 3. ALTER backoffice_staff_users — ADD role_id UUID FK (nullable, set null on delete)
 * 4. ALTER backoffice_staff_users — ADD division_ids UUID[] NOT NULL DEFAULT '{}'
 * 5. CREATE rbac_audit_logs — immutable RBAC audit trail (reuses prevent_audit_modification trigger)
 * 6. UPDATE schema_version 1.3.0 → 1.4.0
 *
 * Constitutional Compliance:
 * ✓ Tenant DB only — no master_db schema changes
 * ✓ Forward-only migration — down() throws per ADR-0008
 * ✓ All DDL in single transactional BEGIN/COMMIT block
 * ✓ CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS for idempotency
 * ✓ Additive-only — no existing table or column is dropped
 * ✓ Reuses existing prevent_audit_modification() trigger function (v1.0.0 baseline)
 * ✓ schema_version bumped from 1.3.0 to 1.4.0
 * ✓ Server-authoritative timestamps (NOW())
 *
 * ADR References:
 * - ADR-0001: Database-per-tenant isolation
 * - ADR-0006: Server-authoritative time
 * - ADR-0008: Semantic versioning / schema_version + forward-only migrations
 *
 * Files NOT modified:
 * - 20260228_001_tenant_rbac_skeleton.ts (STAGE_17 — forward-only)
 * - 20260217_002_create_audit_logs.ts (STAGE_03 — forward-only)
 */

import type { PoolClient } from 'pg'

export const description =
  'Extend RBAC skeleton: add backoffice_role_module_permissions, rbac_audit_logs, ' +
  'status to backoffice_roles, role_id + division_ids to backoffice_staff_users; ' +
  'bump schema_version 1.3.0 → 1.4.0'

/**
 * Forward migration — single transactional DDL block.
 *
 * Transaction boundary:
 *   BEGIN
 *     → ALTER backoffice_roles (add status)
 *     → CREATE backoffice_role_module_permissions + indexes
 *     → ALTER backoffice_staff_users (add role_id, division_ids) + index
 *     → CREATE rbac_audit_logs + indexes + immutability trigger
 *     → UPDATE schema_version
 *   COMMIT
 *
 * Failure in any statement rolls back the entire transaction.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // -------------------------------------------------------------------------
    // STEP 1: ALTER backoffice_roles — add status column
    // Existing rows automatically receive status = 'ACTIVE' via DEFAULT.
    // Additive — no data loss.
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE backoffice_roles
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
          CONSTRAINT backoffice_roles_status_check
            CHECK (status IN ('ACTIVE', 'DISABLED'))
    `)

    // -------------------------------------------------------------------------
    // STEP 2: CREATE backoffice_role_module_permissions
    // Boolean-flags permission model.
    // Absent row = full denial per FR-018.
    // ON DELETE CASCADE: removing a role removes all its permission rows.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS backoffice_role_module_permissions (
        id          UUID         NOT NULL DEFAULT gen_random_uuid(),
        role_id     UUID         NOT NULL,
        module      VARCHAR(100) NOT NULL,
        can_view    BOOLEAN      NOT NULL DEFAULT FALSE,
        can_create  BOOLEAN      NOT NULL DEFAULT FALSE,
        can_edit    BOOLEAN      NOT NULL DEFAULT FALSE,
        can_delete  BOOLEAN      NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

        CONSTRAINT backoffice_role_module_permissions_pkey
          PRIMARY KEY (id),
        CONSTRAINT backoffice_role_module_permissions_role_id_fkey
          FOREIGN KEY (role_id) REFERENCES backoffice_roles(id) ON DELETE CASCADE,
        CONSTRAINT backoffice_role_module_permissions_unique
          UNIQUE (role_id, module)
      )
    `)

    // Index 1: permission evaluation hot path (role_id lookup)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_brmp_role_id
        ON backoffice_role_module_permissions (role_id)
    `)

    // Index 2: per-module permission lookup
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_brmp_role_module
        ON backoffice_role_module_permissions (role_id, module)
    `)

    // -------------------------------------------------------------------------
    // STEP 3: ALTER backoffice_staff_users — add role_id FK (nullable)
    // ON DELETE SET NULL: removing a role does not delete staff users;
    // their role_id is nulled, which maps to no-access (FR-018).
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE backoffice_staff_users
        ADD COLUMN IF NOT EXISTS role_id UUID
          CONSTRAINT backoffice_staff_users_role_id_fkey
            REFERENCES backoffice_roles(id) ON DELETE SET NULL
    `)

    // Index: role-to-users reverse lookup (DELETE guard — count active users)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bsu_role_id
        ON backoffice_staff_users (role_id)
    `)

    // -------------------------------------------------------------------------
    // STEP 4: ALTER backoffice_staff_users — add division_ids UUID array
    // Stores division membership for division-scoped permission checks.
    // Default empty array — existing rows unaffected.
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE backoffice_staff_users
        ADD COLUMN IF NOT EXISTS division_ids UUID[] NOT NULL DEFAULT '{}'
    `)

    // -------------------------------------------------------------------------
    // STEP 5: CREATE rbac_audit_logs
    // Immutable RBAC audit trail.
    // user_id and role_id are nullable — preserved after actor/role deletion (GDPR model).
    // No FK on user_id / role_id — referential integrity sacrificed for audit durability.
    // Valid action values enforce allowlist at DB level.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS rbac_audit_logs (
        id             UUID         NOT NULL DEFAULT gen_random_uuid(),
        user_id        UUID,
        role_id        UUID,
        module         VARCHAR(100),
        action         VARCHAR(50)  NOT NULL,
        request_id     VARCHAR(50)  NOT NULL,
        workspace_slug VARCHAR(100) NOT NULL,
        timestamp      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        is_immutable   BOOLEAN      NOT NULL DEFAULT TRUE,
        metadata       JSONB,

        CONSTRAINT rbac_audit_logs_pkey
          PRIMARY KEY (id),
        CONSTRAINT rbac_audit_logs_action_check
          CHECK (action IN (
            'CREATE_ROLE',
            'UPDATE_ROLE',
            'DISABLE_ROLE',
            'DELETE_ROLE',
            'UPDATE_PERMISSIONS',
            'ASSIGN_ROLE'
          ))
      )
    `)

    // Index 1: role audit history
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rbac_al_role_id
        ON rbac_audit_logs (role_id)
    `)

    // Index 2: actor history
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rbac_al_user_id
        ON rbac_audit_logs (user_id)
    `)

    // Index 3: time-series queries (DESC for most-recent-first pagination)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rbac_al_timestamp
        ON rbac_audit_logs (timestamp DESC)
    `)

    // -------------------------------------------------------------------------
    // STEP 6: Attach immutability trigger to rbac_audit_logs
    // Reuses the prevent_audit_modification() function from v1.0.0 triggers.sql.
    // Blocks UPDATE and DELETE at DB level — cannot be bypassed via SQL.
    // DROP IF EXISTS first to allow idempotent re-runs.
    // -------------------------------------------------------------------------
    await client.query(`
      DROP TRIGGER IF EXISTS prevent_rbac_audit_modification
        ON rbac_audit_logs
    `)

    await client.query(`
      CREATE TRIGGER prevent_rbac_audit_modification
        BEFORE UPDATE OR DELETE ON rbac_audit_logs
        FOR EACH ROW
        EXECUTE FUNCTION prevent_audit_modification()
    `)

    // -------------------------------------------------------------------------
    // STEP 7: Bump schema_version 1.3.0 → 1.4.0
    // -------------------------------------------------------------------------
    await client.query(`
      UPDATE schema_version
        SET version    = '1.4.0',
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
 * STAGE_21 migration is forward-only per ADR-0008.
 * Rollback must be performed via database snapshot restore.
 */
export async function down(_client: PoolClient): Promise<void> {
  throw new Error(
    'STAGE_21_ROLE_PERMISSION_SYSTEM migration is forward-only. ' +
      'Rollback must be performed via database snapshot restore.'
  )
}
