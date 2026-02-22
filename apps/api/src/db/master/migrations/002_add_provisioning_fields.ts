/**
 * Migration 002: Add Provisioning Fields
 *
 * File: apps/api/src/db/master/migrations/002_add_provisioning_fields.ts
 * Task: T010
 *
 * Adds provisioning tracking columns:
 * - provisioning_error: For displaying failure messages
 * - provisioning_retries: Retry counter
 * - provisioning_last_attempt_at: Last job execution time
 *
 * Schema version: 2 → 3
 */

import { Database } from 'better-sqlite3'

export const name = '002_add_provisioning_fields'
export const version = 3

export async function up(db: Database): Promise<void> {
  db.exec(`
    ALTER TABLE licenses 
    ADD COLUMN IF NOT EXISTS provisioning_error TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS provisioning_retries INTEGER DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS provisioning_last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

    -- Create index for soft-lock expiration checks
    CREATE INDEX IF NOT EXISTS idx_licenses_soft_lock_until 
    ON licenses(soft_lock_until) 
    WHERE status = 'SOFT_LOCKED' AND soft_lock_until IS NOT NULL;
  `)
}

export async function down(db: Database): Promise<void> {
  db.exec(`
    ALTER TABLE licenses 
    DROP COLUMN IF EXISTS provisioning_error,
    DROP COLUMN IF EXISTS provisioning_retries,
    DROP COLUMN IF EXISTS provisioning_last_attempt_at;

    DROP INDEX IF EXISTS idx_licenses_soft_lock_until;
  `)
}

export const checksum = 'T010_provisioning_fields_v2'
