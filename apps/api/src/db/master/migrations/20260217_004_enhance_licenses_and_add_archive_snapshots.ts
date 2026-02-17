/**
 * Master Database License Table Enhancement + Archive Snapshots
 *
 * File: apps/api/src/db/master/migrations/20260217_004_enhance_licenses_and_add_archive_snapshots.ts
 * Task: T001 – Create Master Database Migration
 * Phase: 01 – Platform Foundation
 * Stage: STAGE_04_LICENSE_ENGINE
 *
 * Enhancements:
 * 1. Add expected_schema_version and expected_product_version to licenses table
 * 2. Create archive_snapshots table (5 columns)
 * 3. Create indexes on archive_snapshots
 * 4. Update platform_schema_version from 1.0.0 to 1.1.0
 *
 * Properties:
 * - Transaction: YES (single atomic transaction)
 * - Idempotency: YES (IF NOT EXISTS + migration tracking)
 * - Rollback: Automatic on any error
 * - Dependencies: prior master DB setup
 *
 * Migration Strategy:
 * - All DDL executed atomically
 * - If any statement fails, entire transaction rolls back
 * - Version columns added with NOT NULL + DEFAULT
 * - archive_snapshots table created with FK to licenses
 */

import type { PoolClient } from 'pg'

export const description =
  'Enhance licenses table with version fields and create archive_snapshots table for STAGE_04_LICENSE_ENGINE'

/**
 * Execute schema migration (UP)
 *
 * All DDL in single transaction for atomicity.
 * If any statement fails, entire transaction rolls back automatically.
 */
export async function up(client: PoolClient): Promise<void> {
  // ========================================================================
  // ALTERATION 1: Add version columns to licenses table
  // ========================================================================
  // Columns: expected_schema_version, expected_product_version
  // Type: VARCHAR(20), NOT NULL, DEFAULT '1.0.0'
  // Rationale: Freeze version expectations at license creation
  // Immutability: Never updated after creation
  //
  await client.query(`
    ALTER TABLE licenses
    ADD COLUMN IF NOT EXISTS expected_schema_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    ADD COLUMN IF NOT EXISTS expected_product_version VARCHAR(20) NOT NULL DEFAULT '1.0.0';
  `)

  // Add semantic version format constraints
  await client.query(`
    ALTER TABLE licenses
    ADD CONSTRAINT licenses_expected_schema_version_format 
      CHECK (expected_schema_version ~ '^[0-9]+\\.[0-9]+\\.[0-9]+(-(alpha|beta|rc)\\.[0-9]+)?$'),
    ADD CONSTRAINT licenses_expected_product_version_format 
      CHECK (expected_product_version ~ '^[0-9]+\\.[0-9]+\\.[0-9]+(-(alpha|beta|rc)\\.[0-9]+)?$');
  `)

  // Add column comments
  await client.query(`
    COMMENT ON COLUMN licenses.expected_schema_version IS 'Expected schema version for tenant database (frozen at creation, used for version enforcement)';
    COMMENT ON COLUMN licenses.expected_product_version IS 'Expected product version for runtime (frozen at creation, used for version enforcement)';
  `)

  // ========================================================================
  // TABLE CREATION: archive_snapshots
  // ========================================================================
  // Purpose: Archive snapshot tracking for archived workspaces
  // Lifecycle: Records created during SOFT_LOCKED → ARCHIVED transition
  // Retention: Snapshots retained indefinitely (business archive)
  // Deduplication: UNIQUE(license_id) prevents duplicate snapshots per license
  //   (Only one snapshot per license, overwritten on re-archive)
  //
  // Columns:
  // - id: UUID primary key
  // - license_id: UUID FK to licenses (ON DELETE CASCADE if license deleted)
  // - snapshot_location: S3 path or NAS path (e.g., s3://archive-snapshots/acme.edu/2026-02-17T10:30:00Z.sql)
  // - snapshot_timestamp: Exact time snapshot was taken (UTC, for deduplication and ordering)
  // - created_at: Record creation timestamp (audit trail)
  //
  // Indexes:
  // - PRIMARY KEY (id) - automatic index
  // - (license_id) - lookup all snapshots for a license
  // - (created_at DESC) - find most recent snapshots
  // Deduplication: UNIQUE(license_id) ensures one snapshot per license
  //
  await client.query(`
    CREATE TABLE IF NOT EXISTS archive_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
      snapshot_location VARCHAR(512) NOT NULL,
      snapshot_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      
      CONSTRAINT snapshot_location_not_empty CHECK (snapshot_location <> ''),
      UNIQUE(license_id)
    );

    COMMENT ON TABLE archive_snapshots IS 'Archive snapshots for archived workspaces (immutable records)';
    COMMENT ON COLUMN archive_snapshots.license_id IS 'License being archived (FK to licenses table)';
    COMMENT ON COLUMN archive_snapshots.snapshot_location IS 'S3/NAS path to snapshot file (e.g., s3://archive-snapshots/license-id/2026-02-17T10:30:00Z.sql)';
    COMMENT ON COLUMN archive_snapshots.snapshot_timestamp IS 'Exact time snapshot was taken (UTC)';

    CREATE INDEX IF NOT EXISTS idx_archive_snapshots_license_id ON archive_snapshots(license_id);
    CREATE INDEX IF NOT EXISTS idx_archive_snapshots_created_at ON archive_snapshots(created_at DESC);
  `)

  // ========================================================================
  // UPDATE: Platform Schema Version
  // ========================================================================
  // Bump schema version from 1.0.0 to 1.1.0 (MINOR version bump)
  // Rationale: Feature addition (additive schema changes)
  //
  await client.query(`
    UPDATE platform_schema_version
    SET current_version = '1.1.0', updated_at = NOW()
    WHERE id = 1;
  `)
}

/**
 * Rollback schema migration (DOWN)
 *
 * Reverses all changes from up() function.
 * Order is REVERSE of up() (drop tables first, then columns, finally revert version).
 */
export async function down(client: PoolClient): Promise<void> {
  // Drop archive_snapshots table first (references licenses)
  await client.query(`
    DROP TABLE IF EXISTS archive_snapshots CASCADE;
  `)

  // Drop version columns and constraints from licenses
  await client.query(`
    ALTER TABLE licenses
    DROP CONSTRAINT IF EXISTS licenses_expected_schema_version_format,
    DROP CONSTRAINT IF EXISTS licenses_expected_product_version_format,
    DROP COLUMN IF EXISTS expected_schema_version,
    DROP COLUMN IF EXISTS expected_product_version;
  `)

  // Revert platform schema version
  await client.query(`
    UPDATE platform_schema_version
    SET current_version = '1.0.0', updated_at = NOW()
    WHERE id = 1;
  `)
}

export default { up, down, description }
