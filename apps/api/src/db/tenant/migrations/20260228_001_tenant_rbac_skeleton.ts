/**
 * Tenant Database Migration — RBAC Skeleton
 *
 * File: apps/api/src/db/tenant/migrations/20260228_001_tenant_rbac_skeleton.ts
 * Date: 2026-02-28
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 * Phase: 03 – Backoffice Core / 01 – Foundation
 *
 * Purpose:
 * Establish the RBAC table skeleton in the tenant DB for Backoffice access control.
 * Creates: backoffice_roles, backoffice_role_permissions, backoffice_staff_users, backoffice_staff_user_roles.
 *
 * Constitutional Compliance:
 * ✓ Tenant DB only — no master_db schema changes
 * ✓ Forward-only migration — down() throws
 * ✓ Single DDL transaction — all 4 tables or none
 * ✓ Server-authoritative timestamps (NOW())
 * ✓ Idempotent (IF NOT EXISTS)
 *
 * ADR References:
 * - ADR-0001: Database-per-tenant isolation
 * - ADR-0006: Server-authoritative time
 * - ADR-0008: Semantic versioning / schema_version
 */

import type { PoolClient } from 'pg'

export const description =
  'Create RBAC skeleton tables for STAGE_17 Tenant Bootstrap'

/**
 * Forward migration — creates all 4 RBAC tables in a single DDL transaction.
 *
 * Transaction boundary: BEGIN → 4× CREATE TABLE IF NOT EXISTS → COMMIT
 * Failure in any statement rolls back the entire transaction.
 * Provisioning worker retries up to 3 times before routing to DLQ.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // -----------------------------------------------------------------------
    // TABLE 1: backoffice_roles
    // Workspace-scoped role definitions.
    // workspace_id is denormalized here (tenant DB is already workspace-scoped,
    // but stored for cross-query safety and future audit trace).
    // backoffice_ prefix avoids collision with pre-existing `roles` table from STAGE_12.
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS backoffice_roles (
        id           UUID         NOT NULL DEFAULT gen_random_uuid(),
        workspace_id UUID         NOT NULL,
        name         VARCHAR(128) NOT NULL,
        description  TEXT,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

        CONSTRAINT backoffice_roles_pkey        PRIMARY KEY (id),
        CONSTRAINT backoffice_roles_name_unique UNIQUE (workspace_id, name)
      )
    `)

    // -----------------------------------------------------------------------
    // TABLE 2: backoffice_role_permissions
    // Module-scoped permission assignments per role.
    // module  ← one of: MCQ | TRADITIONAL_EXAMS | EXERCISES | LIBRARY | LIVES | FORUM
    // action  ← one of: view | create | edit | delete
    // Unique constraint prevents duplicate (role, module, action) triples.
    // backoffice_ prefix avoids collision with pre-existing `role_permissions` table from STAGE_12.
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS backoffice_role_permissions (
        id         UUID         NOT NULL DEFAULT gen_random_uuid(),
        role_id    UUID         NOT NULL,
        module     VARCHAR(64)  NOT NULL,
        action     VARCHAR(16)  NOT NULL,

        CONSTRAINT backoffice_role_permissions_pkey               PRIMARY KEY (id),
        CONSTRAINT backoffice_role_permissions_role_id_fkey       FOREIGN KEY (role_id)    REFERENCES backoffice_roles(id)    ON DELETE CASCADE,
        CONSTRAINT backoffice_role_permissions_module_action_ck   CHECK (action IN ('view', 'create', 'edit', 'delete')),
        CONSTRAINT backoffice_role_permissions_unique             UNIQUE (role_id, module, action)
      )
    `)

    // -----------------------------------------------------------------------
    // TABLE 3: backoffice_staff_users
    // Backoffice staff accounts scoped to this tenant.
    // Separate from frontoffice student accounts.
    // token_version provides forced-logout / credential-change invalidation.
    // password_hash stores bcrypt hash only — plaintext never stored.
    // backoffice_ prefix avoids any potential collision with user tables from prior stages.
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS backoffice_staff_users (
        id             UUID         NOT NULL DEFAULT gen_random_uuid(),
        workspace_id   UUID         NOT NULL,
        email          VARCHAR(320) NOT NULL,
        name           VARCHAR(256) NOT NULL,
        password_hash  VARCHAR(72)  NOT NULL,
        token_version  INTEGER      NOT NULL DEFAULT 0,
        is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

        CONSTRAINT backoffice_staff_users_pkey         PRIMARY KEY (id),
        CONSTRAINT backoffice_staff_users_email_unique UNIQUE (workspace_id, email),
        CONSTRAINT backoffice_staff_users_tv_min       CHECK (token_version >= 0)
      )
    `)

    // -----------------------------------------------------------------------
    // TABLE 4: backoffice_staff_user_roles
    // Junction: many-to-many between backoffice_staff_users and backoffice_roles.
    // Composite PK (staff_user_id, role_id) — no surrogate key needed.
    // Cascade deletes to auto-remove assignments when user or role is deleted.
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS backoffice_staff_user_roles (
        staff_user_id UUID        NOT NULL,
        role_id       UUID        NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT backoffice_staff_user_roles_pkey             PRIMARY KEY (staff_user_id, role_id),
        CONSTRAINT backoffice_staff_user_roles_staff_user_fkey  FOREIGN KEY (staff_user_id) REFERENCES backoffice_staff_users(id) ON DELETE CASCADE,
        CONSTRAINT backoffice_staff_user_roles_role_fkey        FOREIGN KEY (role_id)       REFERENCES backoffice_roles(id)       ON DELETE CASCADE
      )
    `)

    // -----------------------------------------------------------------------
    // INDEXES
    // -----------------------------------------------------------------------

    // backoffice_roles — lookup by workspace
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_backoffice_roles_workspace_id
        ON backoffice_roles (workspace_id)
    `)

    // backoffice_role_permissions — lookup by role_id (permission check hot path)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_backoffice_role_permissions_role_id
        ON backoffice_role_permissions (role_id)
    `)

    // backoffice_role_permissions — lookup by (role_id, module) for module-specific permission checks
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_backoffice_role_permissions_role_module
        ON backoffice_role_permissions (role_id, module)
    `)

    // backoffice_staff_users — lookup by workspace_id + email (login)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_backoffice_staff_users_workspace_email
        ON backoffice_staff_users (workspace_id, email)
    `)

    // backoffice_staff_users — lookup by workspace_id (list all staff)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_backoffice_staff_users_workspace_id
        ON backoffice_staff_users (workspace_id)
    `)

    // backoffice_staff_user_roles — reverse lookup by role_id (which users have this role?)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_backoffice_staff_user_roles_role_id
        ON backoffice_staff_user_roles (role_id)
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
 * STAGE_17 is forward-only per platform migration policy.
 * Rollback requires snapshot restore (ADR-0008).
 */
export async function down(_client: PoolClient): Promise<void> {
  throw new Error(
    'STAGE_17_TENANT_BOOTSTRAP migration is forward-only. ' +
      'Rollback must be performed via database snapshot restore.'
  )
}
