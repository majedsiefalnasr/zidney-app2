/**
 * Role Permissions Table Migration
 *
 * File: apps/api/src/db/master/migrations/20260225_003_create_role_permissions.ts
 * Task: T003
 * Phase: 1 - Database Migration & Schema Setup
 *
 * Creates the role_permissions table that stores the permission matrix (role × domain).
 * Each row represents whether a role can view/create/edit/delete entities in a specific domain.
 *
 * Properties:
 * - Transaction: YES (single atomic transaction)
 * - Idempotency: YES (IF NOT EXISTS)
 * - Rollback: Automatic on any error
 * - Permission Domains: 7 domains (ORGANIZATION_SETTINGS, PRODUCT_MANAGEMENT, etc.)
 * - Cascade: ON DELETE CASCADE (if role deleted, permissions deleted)
 * - Dependencies: roles table must exist
 */

import type { PoolClient } from 'pg'

export const description = 'Create role_permissions table with permission matrix (role × domain)'

/**
 * Execute schema migration
 */
export async function up(client: PoolClient): Promise<void> {
  // Create ENUM type for permission domains
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_domain') THEN
        CREATE TYPE permission_domain AS ENUM (
          'ORGANIZATION_SETTINGS',
          'PRODUCT_MANAGEMENT',
          'LICENSE_MANAGEMENT',
          'CLIENT_MANAGEMENT',
          'AFFILIATE_MANAGEMENT',
          'MEMBERS_MANAGEMENT',
          'REPORTING'
        );
      END IF;
    END$$;
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      domain permission_domain NOT NULL,
      can_view BOOLEAN NOT NULL DEFAULT FALSE,
      can_create BOOLEAN NOT NULL DEFAULT FALSE,
      can_edit BOOLEAN NOT NULL DEFAULT FALSE,
      can_delete BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

      CONSTRAINT role_permissions_unique_role_domain UNIQUE (role_id, domain)
    );

    COMMENT ON TABLE role_permissions IS 'Permission matrix: role × domain × abilities (view/create/edit/delete)';
    COMMENT ON COLUMN role_permissions.id IS 'Unique permission record identifier';
    COMMENT ON COLUMN role_permissions.role_id IS 'Role this permission belongs to; cascade delete if role deleted';
    COMMENT ON COLUMN role_permissions.domain IS 'Permission domain (ORGANIZATION_SETTINGS, PRODUCT_MANAGEMENT, etc.)';
    COMMENT ON COLUMN role_permissions.can_view IS 'Can members with this role view entities in this domain?';
    COMMENT ON COLUMN role_permissions.can_create IS 'Can members with this role create entities in this domain?';
    COMMENT ON COLUMN role_permissions.can_edit IS 'Can members with this role modify entities in this domain?';
    COMMENT ON COLUMN role_permissions.can_delete IS 'Can members with this role delete entities in this domain?';

    CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_role_permissions_role_domain ON role_permissions(role_id, domain);
  `)
}

/**
 * Rollback: Drop role_permissions table and permission_domain enum
 */
export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS role_permissions CASCADE;
    DROP TYPE IF EXISTS permission_domain CASCADE;
  `)
}
