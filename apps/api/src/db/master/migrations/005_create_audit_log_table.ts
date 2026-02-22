/**
 * Migration 005: Create Audit Log Table
 *
 * File: apps/api/src/db/master/migrations/005_create_audit_log_table.ts
 * Task: T013
 *
 * Creates audit_log table for tracking all license lifecycle transitions.
 * Enables compliance auditing and system observability.
 *
 * Schema version: 5 → 6
 */

import { Database } from 'better-sqlite3'

export const name = '005_create_audit_log_table'
export const version = 6

export async function up(db: Database): Promise<void> {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
      
      -- Action type
      action VARCHAR(50) NOT NULL CHECK (action IN ('SOFT_LOCK', 'UNLOCK', 'ARCHIVE', 'RESTORE', 'DELETE', 'EDIT')),
      
      -- State transition record
      old_status status_enum,
      new_status status_enum,
      
      -- Audit context
      reason TEXT,
      correlation_id VARCHAR(100) NOT NULL,
      
      -- Timestamp (immutable after creation)
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    -- Create indexes for common queries
    CREATE INDEX idx_audit_license_id ON audit_log(license_id);
    CREATE INDEX idx_audit_created_at ON audit_log(created_at DESC);
    CREATE INDEX idx_audit_correlation_id ON audit_log(correlation_id);
  `)
}

export async function down(db: Database): Promise<void> {
  db.exec(`
    DROP TABLE IF EXISTS audit_log CASCADE;
  `)
}

export const checksum = 'T013_audit_log_table_v5'
