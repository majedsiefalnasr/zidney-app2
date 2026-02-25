/**
 * Roles Table Migration
 *
 * File: apps/api/src/db/master/migrations/20260225_001_create_roles.ts
 * Task: T002
 * Phase: 1 - Database Migration & Schema Setup
 *
 * Creates the roles table for MMC role definitions. Each role has a set of permissions
 * (domain × ability matrix) defined in role_permissions table.
 *
 * Properties:
 * - Transaction: YES (single atomic transaction)
 * - Idempotency: YES (IF NOT EXISTS)
 * - Rollback: Automatic on any error
 * - Status: ACTIVE or INACTIVE (INACTIVE roles cannot be assigned to new members)
 * - Execution Order: FIRST (no dependencies)
 */

import { PoolClient } from 'pg'

export const description = 'Create roles table for MMC role definitions'

/**
 * Execute schema migration
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    COMMENT ON TABLE roles IS 'MMC role definitions; each role has permissions defined in role_permissions';
    COMMENT ON COLUMN roles.id IS 'Unique role identifier';
    COMMENT ON COLUMN roles.name IS 'Role display name (e.g., "Platform Administrator")';
    COMMENT ON COLUMN roles.description IS 'Human-readable description of role purpose';
    COMMENT ON COLUMN roles.status IS 'Lifecycle status; INACTIVE roles cannot be assigned';

    CREATE INDEX IF NOT EXISTS idx_roles_status ON roles(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
  `)
}

/**
 * Rollback: Drop roles table
 */
export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS roles CASCADE;`)
}
