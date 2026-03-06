/**
 * Master Database Initial Schema Migration
 *
 * File: apps/api/src/db/master/migrations/20250102_001_create_master_schema.ts
 * Task: T006-T012
 * Phase: 2 - Core Schema Migration
 *
 * Creates all master database tables:
 * 1. products - Application product definitions
 * 2. licenses - License registry with workspace allocation
 * 3. tenants_registry - Tenant database connection metadata
 * 4. mmc_users - Platform admin/operator users
 * 5. platform_schema_version - Schema version tracking
 *
 * Properties:
 * - Transaction: YES (single atomic transaction)
 * - Idempotency: YES (IF NOT EXISTS + migration tracking)
 * - Rollback: Automatic on any error
 * - Dependencies: _schema_migrations table must exist
 */

import type { PoolClient } from 'pg'

export const description =
  'Create master database schema (products, licenses, tenants_registry, mmc_users, platform_schema_version)'

/**
 * Execute schema migration
 *
 * All DDL in single transaction for atomicity.
 * If any statement fails, entire transaction rolls back automatically.
 */
export async function up(client: PoolClient): Promise<void> {
  // ========================================================================
  // TABLE 1: products
  // ========================================================================
  // Purpose: Product catalog (e.g., 'Zidney Pro', 'Zidney Enterprise')
  // Immutable after creation (no UPDATE path in this stage)
  // Slug is globally unique identifier
  // Semantic version for API compatibility checks
  // JSONB enabled_modules allows flexible feature enablement
  //
  // Indexes:
  // - PRIMARY KEY (id) - automatic index
  // - UNIQUE (slug) - for lookups by product string identifier
  //
  await client.query(`
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
      enabled_modules JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      
      CONSTRAINT product_version_format CHECK (version ~ '^[0-9]+\\.[0-9]+\\.[0-9]+'),
      CONSTRAINT product_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
      CONSTRAINT product_name_not_empty CHECK (name <> ''),
      CONSTRAINT product_enabled_modules_is_object CHECK (jsonb_typeof(enabled_modules) = 'object')
    );

    COMMENT ON TABLE products IS 'Product catalog: Zidney Pro, Enterprise, etc.';
    COMMENT ON COLUMN products.id IS 'Global unique product ID';
    COMMENT ON COLUMN products.slug IS 'Global unique product identifier (e.g., "pro", "enterprise")';
    COMMENT ON COLUMN products.version IS 'Product version (semantic versioning)';
    COMMENT ON COLUMN products.enabled_modules IS 'Feature flags as JSONB (e.g., {"realtime": true})';
    
    CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
  `)

  // ========================================================================
  // TABLE 2: licenses
  // ========================================================================
  // Purpose: License registry - ONE license per workspace
  // Single source of truth for license lifecycle and state
  // Status transitions: ACTIVE → SOFT_LOCKED → ARCHIVED (one-way)
  // Soft-lock allows grace period before archival
  // Student/staff limits are optional (NULL = unlimited)
  //
  // Foreign key to products (ON DELETE RESTRICT: prevent product deletion if licensed)
  // Unique on workspace_slug (one license per workspace)
  //
  // Indexes:
  // - PRIMARY KEY (id) - automatic
  // - UNIQUE (workspace_slug) - quick license lookup
  // - (status) - filter by state (e.g., find all soft-locked)
  //
  await client.query(`
    CREATE TABLE IF NOT EXISTS licenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      workspace_slug VARCHAR(100) NOT NULL UNIQUE,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SOFT_LOCKED', 'ARCHIVED')),
      student_limit INTEGER,
      staff_limit INTEGER,
      soft_lock_until TIMESTAMP WITH TIME ZONE,
      archived_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      
      CONSTRAINT workspace_slug_format CHECK (workspace_slug ~ '^[a-z0-9-]+$'),
      CONSTRAINT workspace_slug_not_empty CHECK (workspace_slug <> ''),
      CONSTRAINT student_limit_positive CHECK (student_limit IS NULL OR student_limit > 0),
      CONSTRAINT staff_limit_positive CHECK (staff_limit IS NULL OR staff_limit > 0),
      CONSTRAINT soft_lock_after_active CHECK (
        (status != 'SOFT_LOCKED' OR soft_lock_until IS NOT NULL)
      ),
      CONSTRAINT archived_after_softlock CHECK (
        (status != 'ARCHIVED' OR archived_at IS NOT NULL)
      )
    );

    COMMENT ON TABLE licenses IS 'License registry: ONE license per workspace (single source of truth for lifecycle state)';
    COMMENT ON COLUMN licenses.product_id IS 'Foreign key to products (prevents product deletion if licensed)';
    COMMENT ON COLUMN licenses.workspace_slug IS 'Unique workspace identifier (globally unique)';
    COMMENT ON COLUMN licenses.status IS 'License lifecycle state: ACTIVE, SOFT_LOCKED, ARCHIVED';
    COMMENT ON COLUMN licenses.soft_lock_until IS 'Grace period expiration (soft-lock state only)';
    COMMENT ON COLUMN licenses.archived_at IS 'Archive timestamp (archived state only)';
    COMMENT ON COLUMN licenses.student_limit IS 'Student count limit (NULL = unlimited)';
    COMMENT ON COLUMN licenses.staff_limit IS 'Staff count limit (NULL = unlimited)';

    CREATE INDEX IF NOT EXISTS idx_licenses_workspace_slug ON licenses(workspace_slug);
    CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
    CREATE INDEX IF NOT EXISTS idx_licenses_product_id ON licenses(product_id);
  `)

  // ========================================================================
  // TABLE 3: tenants_registry
  // ========================================================================
  // Purpose: Tenant database connection metadata
  // CRITICAL: This table stores ONLY infrastructure metadata (host/port/user/password)
  // CRITICAL: This table NEVER duplicates lifecycle state (reads from licenses.status)
  // Architectural: Separation of concerns - licenses = lifecycle, tenants_registry = infrastructure
  //
  // Foreign key to licenses (ON DELETE RESTRICT: prevent license deletion if tenant active)
  // Unique on workspace_slug (one tenant connection per workspace)
  // Password stored encrypted (encryption handled at application layer)
  //
  // Indexes:
  // - PRIMARY KEY (id) - automatic
  // - UNIQUE (workspace_slug) - quick connection lookup
  //
  await client.query(`
    CREATE TABLE IF NOT EXISTS tenants_registry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE RESTRICT,
      workspace_slug VARCHAR(100) NOT NULL UNIQUE,
      db_host VARCHAR(255) NOT NULL,
      db_port INTEGER NOT NULL DEFAULT 5432,
      db_name VARCHAR(63) NOT NULL,
      db_user VARCHAR(63) NOT NULL,
      db_password_encrypted TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      
      CONSTRAINT db_port_valid CHECK (db_port > 0 AND db_port < 65536),
      CONSTRAINT db_host_not_empty CHECK (db_host <> ''),
      CONSTRAINT db_name_not_empty CHECK (db_name <> ''),
      CONSTRAINT db_user_not_empty CHECK (db_user <> ''),
      CONSTRAINT db_password_encrypted_not_empty CHECK (db_password_encrypted <> ''),
      CONSTRAINT workspace_slug_format CHECK (workspace_slug ~ '^[a-z0-9-]+$'),
      CONSTRAINT workspace_slug_not_empty CHECK (workspace_slug <> '')
    );

    COMMENT ON TABLE tenants_registry IS 'Tenant database connection metadata (infrastructure only, lifecycle state in licenses)';
    COMMENT ON COLUMN tenants_registry.license_id IS 'Foreign key to licenses (ONE tenant per license)';
    COMMENT ON COLUMN tenants_registry.workspace_slug IS 'Unique workspace identifier (matches licenses.workspace_slug)';
    COMMENT ON COLUMN tenants_registry.db_host IS 'Tenant database hostname';
    COMMENT ON COLUMN tenants_registry.db_password_encrypted IS 'Encrypted password (decrypted at application layer)';

    CREATE INDEX IF NOT EXISTS idx_tenants_registry_workspace_slug ON tenants_registry(workspace_slug);
    CREATE INDEX IF NOT EXISTS idx_tenants_registry_license_id ON tenants_registry(license_id);
  `)

  // ========================================================================
  // TABLE 4: mmc_users
  // ========================================================================
  // Purpose: Platform MMC (Master Management Console) user accounts
  // Admin/operator/read_only role-based access control
  // Email is globally unique identifier
  // Password stored as bcrypt hash (never stored plaintext)
  //
  // Indexes:
  // - PRIMARY KEY (id) - automatic
  // - UNIQUE (email) - login lookups
  //
  await client.query(`
    CREATE TABLE IF NOT EXISTS mmc_users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'read_only' CHECK (role IN ('admin', 'operator', 'read_only')),
      last_login_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      
      CONSTRAINT email_format CHECK (email ~ '^[^@]+@[^@]+$'),
      CONSTRAINT email_not_empty CHECK (email <> ''),
      CONSTRAINT password_hash_not_empty CHECK (password_hash <> '')
    );

    COMMENT ON TABLE mmc_users IS 'Platform MMC (Master Management Console) user accounts for admin/operator access';
    COMMENT ON COLUMN mmc_users.email IS 'Email (globally unique login identifier)';
    COMMENT ON COLUMN mmc_users.password_hash IS 'Bcrypt password hash (never plaintext)';
    COMMENT ON COLUMN mmc_users.role IS 'RBAC role: admin (full), operator (manage), read_only (view)';
    COMMENT ON COLUMN mmc_users.last_login_at IS 'Last successful login timestamp';

    CREATE INDEX IF NOT EXISTS idx_mmc_users_email ON mmc_users(email);
  `)

  // ========================================================================
  // TABLE 5: platform_schema_version
  // ========================================================================
  // Purpose: Platform schema version tracking
  // Single-row table (enforced by id = 1 in application)
  // Current version = deployed schema version
  // Minimum supported version = oldest schema version API can work with
  // Used for version compatibility checks during startup
  //
  // Constraint: Always id = 1 to enforce single row
  // Default: 1.0.0 (initial version)
  //
  await client.query(`
    CREATE TABLE IF NOT EXISTS platform_schema_version (
      id SERIAL PRIMARY KEY CHECK (id = 1),
      current_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
      minimum_supported_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      
      CONSTRAINT version_format CHECK (current_version ~ '^[0-9]+\\.[0-9]+\\.[0-9]+'),
      CONSTRAINT min_version_format CHECK (minimum_supported_version ~ '^[0-9]+\\.[0-9]+\\.[0-9]+')
    );

    COMMENT ON TABLE platform_schema_version IS 'Platform schema version tracking (single row: id=1)';
    COMMENT ON COLUMN platform_schema_version.current_version IS 'Deployed schema version (semantic versioning)';
    COMMENT ON COLUMN platform_schema_version.minimum_supported_version IS 'Minimum supported schema version for API';
  `)

  // ========================================================================
  // INITIALIZATION: Insert platform_schema_version
  // ========================================================================
  // Insert the initial version record (single row)
  // Idempotent: Use ON CONFLICT DO NOTHING to allow re-runs
  //
  await client.query(`
    INSERT INTO platform_schema_version (id, current_version, minimum_supported_version)
    VALUES (1, '1.0.0', '1.0.0')
    ON CONFLICT (id) DO NOTHING
  `)
}

export default { up, description }
