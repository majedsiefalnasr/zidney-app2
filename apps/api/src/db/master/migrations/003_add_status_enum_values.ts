/**
 * Migration 003: Add Status Enum PROVISION_FAILED Value
 *
 * File: apps/api/src/db/master/migrations/003_add_status_enum_values.ts
 * Task: T011
 *
 * Extends status_enum to include PROVISION_FAILED state.
 * PostgreSQL limitation: Cannot remove ENUM values once added.
 *
 * Schema version: 3 → 4
 */

import { Database } from 'better-sqlite3'

export const name = '003_add_status_enum_values'
export const version = 4

export async function up(db: Database): Promise<void> {
  // Note: PostgreSQL ENUM values cannot be removed, only added
  // PROVISION_FAILED is added before ARCHIVED
  db.exec(`
    -- PostgreSQL: ALTER TYPE status_enum ADD VALUE 'PROVISION_FAILED' BEFORE 'ARCHIVED';
    -- SQLite: No action needed, enum is not used in SQLite DDL
    -- This migration is a placeholder for PostgreSQL environments
  `)
}

export async function down(db: Database): Promise<void> {
  // PostgreSQL limitation: ENUM values cannot be removed
  // Rollback is not possible without recreating the type
  // This is documented and requires manual intervention if ever needed
}

export const checksum = 'T011_status_enum_values_v3'
