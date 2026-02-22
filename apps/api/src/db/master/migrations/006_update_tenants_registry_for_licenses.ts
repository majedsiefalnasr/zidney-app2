/**
 * Migration 006: Update Tenants Registry For Licenses
 *
 * File: apps/api/src/db/master/migrations/006_update_tenants_registry_for_licenses.ts
 * Task: T014
 *
 * Links tenants_registry to licenses table.
 * Creates 1:1 relationship: One License = One Workspace (tenant database).
 *
 * Schema version: 6 → 7
 */

import { Database } from 'better-sqlite3'

export const name = '006_update_tenants_registry_for_licenses'
export const version = 7

export async function up(db: Database): Promise<void> {
  db.exec(`
    -- Add license_id column to tenants_registry
    ALTER TABLE tenants_registry 
    ADD COLUMN IF NOT EXISTS license_id UUID;

    -- Create foreign key (initially nullable, will be populated)
    ALTER TABLE tenants_registry
    ADD CONSTRAINT fk_tenants_license FOREIGN KEY (license_id) 
    REFERENCES licenses(id) ON DELETE RESTRICT ON UPDATE CASCADE;

    -- Create unique constraint (1:1 relationship)
    ALTER TABLE tenants_registry
    ADD CONSTRAINT uk_license_id UNIQUE (license_id);

    -- Create index for quick lookups
    CREATE INDEX IF NOT EXISTS idx_tenants_registry_license_id ON tenants_registry(license_id);
  `)
}

export async function down(db: Database): Promise<void> {
  db.exec(`
    ALTER TABLE tenants_registry 
    DROP CONSTRAINT IF EXISTS uk_license_id,
    DROP CONSTRAINT IF EXISTS fk_tenants_license;

    DROP INDEX IF EXISTS idx_tenants_registry_license_id;

    ALTER TABLE tenants_registry 
    DROP COLUMN IF EXISTS license_id;
  `)
}

export const checksum = 'T014_tenants_registry_licenses_v6'
