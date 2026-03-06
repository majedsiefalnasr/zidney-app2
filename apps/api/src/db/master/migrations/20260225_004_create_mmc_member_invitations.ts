/**
 * MMC Member Invitations Table Migration
 *
 * File: apps/api/src/db/master/migrations/20260225_004_create_mmc_member_invitations.ts
 * Task: T004
 * Phase: 1 - Database Migration & Schema Setup
 *
 * Creates the mmc_member_invitations table for one-time token-based member onboarding.
 * Encodes invitation state (pending, accepted, expired) and one-time token hash (SHA256).
 *
 * Properties:
 * - Transaction: YES (single atomic transaction)
 * - Idempotency: YES (IF NOT EXISTS)
 * - Rollback: Automatic on any error
 * - Security: Token stored as SHA256 hash only (never plaintext)
 * - TTL: 24 hours (expires_at computed server-side)
 * - One-time use: token_hash UNIQUE prevents reuse
 * - Dependencies: roles and mmc_members tables must exist
 */

import type { PoolClient } from 'pg'

export const description = 'Create mmc_member_invitations table for onboarding workflow'

/**
 * Execute schema migration
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS mmc_member_invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL,
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
      token_hash VARCHAR(255) NOT NULL UNIQUE,
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED')),
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      invited_by UUID NOT NULL REFERENCES mmc_members(id) ON DELETE SET NULL,
      accepted_at TIMESTAMP WITH TIME ZONE,
      accepted_by_user_id UUID REFERENCES mmc_members(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    COMMENT ON TABLE mmc_member_invitations IS 'One-time invitation workflow for member onboarding';
    COMMENT ON COLUMN mmc_member_invitations.id IS 'Unique invitation identifier';
    COMMENT ON COLUMN mmc_member_invitations.email IS 'Target email for invitation';
    COMMENT ON COLUMN mmc_member_invitations.role_id IS 'Role to assign upon acceptance; prevents role deletion if pending';
    COMMENT ON COLUMN mmc_member_invitations.token_hash IS 'SHA256(token); never store plaintext';
    COMMENT ON COLUMN mmc_member_invitations.status IS 'Invitation status: PENDING, ACCEPTED, EXPIRED';
    COMMENT ON COLUMN mmc_member_invitations.expires_at IS 'Expiration time (NOW() + 24 hours at creation)';
    COMMENT ON COLUMN mmc_member_invitations.invited_by IS 'MMC member who sent invitation';
    COMMENT ON COLUMN mmc_member_invitations.accepted_at IS 'When invitation was accepted (audit trail)';
    COMMENT ON COLUMN mmc_member_invitations.accepted_by_user_id IS 'MMC member who accepted (typically same as created member)';

    CREATE INDEX IF NOT EXISTS idx_invitations_email ON mmc_member_invitations(email);
    CREATE INDEX IF NOT EXISTS idx_invitations_status ON mmc_member_invitations(status);
    CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON mmc_member_invitations(expires_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token_hash ON mmc_member_invitations(token_hash);
  `)
}

/**
 * Rollback: Drop mmc_member_invitations table
 */
export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS mmc_member_invitations CASCADE;`)
}
