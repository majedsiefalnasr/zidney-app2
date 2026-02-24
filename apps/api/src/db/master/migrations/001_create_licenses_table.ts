/**
 * Migration 001: Create Licenses Table
 *
 * File: apps/api/src/db/master/migrations/001_create_licenses_table.ts
 * Task: T009
 *
 * Creates the core licenses table with status enum and indexes.
 * Schema version: 1 → 2
 */

import type { PoolClient } from 'pg'

export const name = '001_create_licenses_table'
export const version = 2

export async function up(client: PoolClient): Promise<void> {
  // Create status enum type
  await client.query(`
    CREATE TYPE IF NOT EXISTS status_enum AS ENUM (
      'PENDING_PROVISION',
      'ACTIVE',
      'SOFT_LOCKED',
      'PROVISION_FAILED',
      'ARCHIVED',
      'DELETED'
    );
  `)

  // Create licenses table with 18 core fields
  await client.query(`
    CREATE TABLE IF NOT EXISTS licenses (
      -- Identifiers
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      workspace_slug VARCHAR(64) NOT NULL UNIQUE,
      
      -- Workspace metadata
      workspace_name VARCHAR(255) NOT NULL,
      student_limit INTEGER CHECK (student_limit IS NULL OR student_limit >= 0),
      staff_limit INTEGER CHECK (staff_limit IS NULL OR staff_limit >= 0),
      
      -- Commercial settings
      use_zidney_payment BOOLEAN NOT NULL DEFAULT false,
      commission_per_user NUMERIC(10, 2),
      
      -- Institutional settings
      default_language VARCHAR(5) NOT NULL DEFAULT 'en',
      uses_divisions BOOLEAN NOT NULL DEFAULT false,
      
      -- Lifecycle state
      status status_enum NOT NULL DEFAULT 'PENDING_PROVISION',
      soft_lock_until TIMESTAMP WITH TIME ZONE,
      archived_at TIMESTAMP WITH TIME ZONE,
      deleted_at TIMESTAMP WITH TIME ZONE,
      
      -- Version snapshots (immutable after creation)
      schema_version INTEGER NOT NULL,
      product_version INTEGER NOT NULL,
      
      -- Audit fields
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      
      -- Constraints on format
      CONSTRAINT valid_slug_format CHECK (workspace_slug ~ '^[a-z0-9-]+$'),
      CONSTRAINT valid_slug_length CHECK (LENGTH(workspace_slug) >= 3 AND LENGTH(workspace_slug) <= 64)
    )
  `)

  // Create indexes for common queries
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
    CREATE INDEX IF NOT EXISTS idx_licenses_created_at ON licenses(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_licenses_product_id ON licenses(product_id);
    CREATE INDEX IF NOT EXISTS idx_licenses_status_created ON licenses(status, created_at DESC);
  `)
}

export async function down(client: PoolClient): Promise<void> {
  // Drop table and enum
  await client.query(`
    DROP TABLE IF EXISTS licenses CASCADE;
    DROP TYPE IF EXISTS status_enum CASCADE;
  `)
}

export const checksum = 'T009_licenses_table_v1'
