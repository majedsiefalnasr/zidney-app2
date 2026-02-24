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

import type { PoolClient } from 'pg'

export const name = '003_add_status_enum_values'
export const version = 4

export async function up(client: PoolClient): Promise<void> {
  // Note: PostgreSQL ENUM values cannot be removed, only added
  // PROVISION_FAILED is added before ARCHIVED
  await client.query(`
    -- PostgreSQL: ALTER TYPE status_enum ADD VALUE 'PROVISION_FAILED' BEFORE 'ARCHIVED';
    -- No-op placeholder kept for historical compatibility.
  `)
}

export async function down(_client: PoolClient): Promise<void> {
  // PostgreSQL limitation: ENUM values cannot be removed
  // Rollback is not possible without recreating the type
  // This is documented and requires manual intervention if ever needed
}

export const checksum = 'T011_status_enum_values_v3'
