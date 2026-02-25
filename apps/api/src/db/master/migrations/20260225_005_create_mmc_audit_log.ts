/**
 * MMC Audit Log Table Migration
 *
 * File: apps/api/src/db/master/migrations/20260225_005_create_mmc_audit_log.ts
 * Task: T005
 * Phase: 1 - Database Migration & Schema Setup
 *
 * Creates the mmc_audit_log table - immutable append-only audit trail of all destructive
 * and administrative actions within MMC. Source of regulatory compliance evidence.
 *
 * Properties:
 * - Transaction: YES (single atomic transaction)
 * - Idempotency: YES (IF NOT EXISTS)
 * - Rollback: Automatic on any error
 * - Immutability: Enforced via trigger (no UPDATE/DELETE allowed)
 * - State Tracking: JSONB previous_state and new_state for full audit trail
 * - Correlation: Linked to API request via correlation_id
 * - Dependencies: mmc_members table must exist
 */

import { PoolClient } from 'pg'

export const description =
  'Create mmc_audit_log table for immutable audit trail'

/**
 * Execute schema migration
 */
export async function up(client: PoolClient): Promise<void> {
  // Create ENUM for action types
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action_type') THEN
        CREATE TYPE audit_action_type AS ENUM (
          'MEMBER_CREATED',
          'MEMBER_UPDATED',
          'MEMBER_DISABLED',
          'MEMBER_ENABLED',
          'MEMBER_ROLE_CHANGED',
          'MEMBER_DELETED',
          'ROLE_CREATED',
          'ROLE_UPDATED',
          'ROLE_DELETED',
          'PERMISSION_BATCH_UPDATED',
          'PERMISSION_SINGLE_CHANGED',
          'INVITATION_SENT',
          'INVITATION_ACCEPTED',
          'INVITATION_EXPIRED',
          'INVITATION_RESENT',
          'LOGIN_ATTEMPT_SUCCESS',
          'LOGIN_ATTEMPT_FAILED',
          'LOGOUT',
          'PERMISSION_CHECK_DENIED',
          'PERMISSION_CHECK_ALLOWED',
          'SESSION_INVALIDATED'
        );
      END IF;
    END$$;
  `)

  // Create ENUM for entity types
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_entity_type') THEN
        CREATE TYPE audit_entity_type AS ENUM (
          'MEMBER',
          'ROLE',
          'PERMISSION',
          'INVITATION',
          'SESSION'
        );
      END IF;
    END$$;
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS mmc_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_user_id UUID REFERENCES mmc_members(id) ON DELETE SET NULL,
      action_type audit_action_type NOT NULL,
      entity_type audit_entity_type NOT NULL,
      entity_id UUID,
      previous_state JSONB,
      new_state JSONB,
      correlation_id UUID NOT NULL,
      ip_address INET,
      user_agent TEXT,
      timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    COMMENT ON TABLE mmc_audit_log IS 'Immutable append-only audit trail of all MMC administrative actions';
    COMMENT ON COLUMN mmc_audit_log.id IS 'Unique audit entry identifier';
    COMMENT ON COLUMN mmc_audit_log.actor_user_id IS 'MMC member who performed action; NULL if actor deleted';
    COMMENT ON COLUMN mmc_audit_log.action_type IS 'Action performed (MEMBER_CREATED, ROLE_UPDATED, etc.)';
    COMMENT ON COLUMN mmc_audit_log.entity_type IS 'Type of entity affected (MEMBER, ROLE, PERMISSION)';
    COMMENT ON COLUMN mmc_audit_log.entity_id IS 'ID of affected entity; NULL for bulk operations';
    COMMENT ON COLUMN mmc_audit_log.previous_state IS 'Snapshot of state before change (JSONB)';
    COMMENT ON COLUMN mmc_audit_log.new_state IS 'Snapshot of state after change (JSONB)';
    COMMENT ON COLUMN mmc_audit_log.correlation_id IS 'Link to API request; used for tracing related actions';
    COMMENT ON COLUMN mmc_audit_log.ip_address IS 'Client IP (for geographic/pattern detection)';
    COMMENT ON COLUMN mmc_audit_log.user_agent IS 'Client User-Agent (for device tracking)';
    COMMENT ON COLUMN mmc_audit_log.timestamp IS 'Server timestamp of action; immutable';

    CREATE INDEX IF NOT EXISTS idx_audit_actor ON mmc_audit_log(actor_user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON mmc_audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON mmc_audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_correlation ON mmc_audit_log(correlation_id);

    -- Create immutability trigger
    CREATE OR REPLACE FUNCTION raise_audit_log_immutable_error()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Audit log is immutable; no updates or deletes allowed';
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS audit_log_immutable ON mmc_audit_log;
    CREATE TRIGGER audit_log_immutable
      BEFORE UPDATE OR DELETE ON mmc_audit_log
      FOR EACH ROW
      EXECUTE FUNCTION raise_audit_log_immutable_error();
  `)
}

/**
 * Rollback: Drop mmc_audit_log table and associated types/functions
 */
export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TRIGGER IF EXISTS audit_log_immutable ON mmc_audit_log;
    DROP FUNCTION IF EXISTS raise_audit_log_immutable_error();
    DROP TABLE IF EXISTS mmc_audit_log CASCADE;
    DROP TYPE IF EXISTS audit_action_type CASCADE;
    DROP TYPE IF EXISTS audit_entity_type CASCADE;
  `)
}
