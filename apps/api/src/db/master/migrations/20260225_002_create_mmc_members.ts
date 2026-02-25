/**
 * MMC Members Table Migration
 *
 * File: apps/api/src/db/master/migrations/20260225_002_create_mmc_members.ts
 * Task: T001
 * Phase: 1 - Database Migration & Schema Setup
 *
 * Creates the mmc_members table for storing internal MMC user accounts with role assignments
 * and session token versioning for session invalidation on role/status changes.
 *
 * Properties:
 * - Transaction: YES (single atomic transaction)
 * - Idempotency: YES (IF NOT EXISTS)
 * - Rollback: Automatic on any error
 * - Immutability: username immutable, password never null
 * - Security: Passwords stored as bcrypt hashes only
 * - Dependencies: roles table must exist
 */

import { PoolClient } from 'pg'

export const description =
  'Create mmc_members table with role assignments and token versioning'

/**
 * Execute schema migration
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS mmc_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(255) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
      team_id UUID,
      group_id UUID,
      department_id UUID,
      token_version INTEGER NOT NULL DEFAULT 1,
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      created_by UUID REFERENCES mmc_members(id) ON DELETE SET NULL,
      updated_by UUID REFERENCES mmc_members(id) ON DELETE SET NULL,

      CONSTRAINT mmc_members_username_length CHECK (LENGTH(username) > 2),
      CONSTRAINT mmc_members_token_version_positive CHECK (token_version > 0)
    );

    COMMENT ON TABLE mmc_members IS 'Internal MMC user accounts with role assignments and session management';
    COMMENT ON COLUMN mmc_members.id IS 'Unique member identifier';
    COMMENT ON COLUMN mmc_members.username IS 'Immutable username; alphanumeric + underscore';
    COMMENT ON COLUMN mmc_members.email IS 'Member email address';
    COMMENT ON COLUMN mmc_members.password_hash IS 'Bcrypt hash (cost=12); never plaintext';
    COMMENT ON COLUMN mmc_members.role_id IS 'Current role; determines permissions';
    COMMENT ON COLUMN mmc_members.token_version IS 'Session version; incremented on role/status changes to invalidate tokens';
    COMMENT ON COLUMN mmc_members.status IS 'Account status; ACTIVE or DISABLED (blocks login)';
    COMMENT ON COLUMN mmc_members.created_by IS 'MMC member who created this account (audit trail)';
    COMMENT ON COLUMN mmc_members.updated_by IS 'MMC member who last updated this account (audit trail)';

    CREATE INDEX IF NOT EXISTS idx_mmc_members_role_id ON mmc_members(role_id);
    CREATE INDEX IF NOT EXISTS idx_mmc_members_status ON mmc_members(status);
    CREATE INDEX IF NOT EXISTS idx_mmc_members_email ON mmc_members(email);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mmc_members_username ON mmc_members(username);
  `)
}

/**
 * Rollback: Drop mmc_members table
 */
export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS mmc_members CASCADE;`)
}
