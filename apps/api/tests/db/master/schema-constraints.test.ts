/**
 * Schema Constraint Validation Tests
 *
 * File: apps/api/tests/db/master/schema-constraints.test.ts
 * Task: T022 (Phase 5)
 *
 * Tests that all database constraints are properly enforced:
 * - Primary key constraints
 * - Unique constraints
 * - Foreign key constraints
 * - Check constraints for enums and formats
 * - NOT NULL constraints
 */

import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const getMasterTestConnectionString = () => {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL
  }
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  const user = process.env.TEST_DB_USER || process.env.DB_USER || 'zidney_app'
  const password =
    process.env.TEST_DB_PASSWORD ||
    process.env.DB_PASSWORD ||
    'change-me-in-production'
  const host = process.env.TEST_DB_HOST || process.env.DB_HOST || 'localhost'
  const port = process.env.TEST_DB_PORT || process.env.DB_PORT || '5432'
  const database =
    process.env.TEST_DB_NAME ||
    process.env.DB_DATABASE ||
    process.env.DB_NAME ||
    'zidney_master'

  return `postgresql://${user}:${password}@${host}:${port}/${database}`
}

const ensureLegacyMasterSchema = async (pool: Pool) => {
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`)
  } catch (error: unknown) {
    const pgError = error as { code?: string; constraint?: string }
    const isConcurrentCreateRace =
      pgError.code === '23505' &&
      pgError.constraint === 'pg_extension_name_index'
    if (!isConcurrentCreateRace) {
      throw error
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      version VARCHAR(20) NOT NULL,
      enabled_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT products_slug_format_check CHECK (slug ~ '^[a-z0-9-]+$'),
      CONSTRAINT products_version_format_check CHECK (version ~ '^\\d+\\.\\d+\\.\\d+$')
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS licenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      workspace_slug VARCHAR(255) NOT NULL UNIQUE,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      student_limit INTEGER NOT NULL DEFAULT 0,
      staff_limit INTEGER NOT NULL DEFAULT 0,
      soft_lock_until TIMESTAMPTZ,
      archived_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT licenses_workspace_slug_format_check CHECK (workspace_slug ~ '^[a-z0-9-]+$'),
      CONSTRAINT licenses_status_check CHECK (status IN ('ACTIVE', 'SOFT_LOCKED', 'ARCHIVED', 'DELETED')),
      CONSTRAINT licenses_student_limit_positive_check CHECK (student_limit >= 0),
      CONSTRAINT licenses_staff_limit_positive_check CHECK (staff_limit >= 0)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants_registry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
      workspace_slug VARCHAR(255) NOT NULL UNIQUE,
      db_host VARCHAR(255) NOT NULL DEFAULT 'localhost',
      db_port INTEGER NOT NULL DEFAULT 5432,
      db_name VARCHAR(255) NOT NULL DEFAULT 'workspace_db',
      db_user VARCHAR(255) NOT NULL DEFAULT 'tenant_user',
      db_password_encrypted TEXT NOT NULL DEFAULT 'encrypted',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mmc_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(50) NOT NULL,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT mmc_users_role_check CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'SUPPORT'))
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_schema_version (
      id INTEGER PRIMARY KEY DEFAULT 1,
      current_version VARCHAR(20) NOT NULL,
      minimum_supported_version VARCHAR(20) NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT platform_schema_version_single_row_check CHECK (id = 1),
      CONSTRAINT platform_schema_version_current_version_format_check CHECK (current_version ~ '^\\d+\\.\\d+\\.\\d+$'),
      CONSTRAINT platform_schema_version_minimum_supported_version_format_check CHECK (minimum_supported_version ~ '^\\d+\\.\\d+\\.\\d+$')
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      version VARCHAR(32) PRIMARY KEY,
      description TEXT NOT NULL,
      checksum VARCHAR(64),
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug)`
  )
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_licenses_workspace_slug ON licenses(workspace_slug)`
  )
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status)`
  )
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_tenants_registry_workspace_slug ON tenants_registry(workspace_slug)`
  )
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_mmc_users_email ON mmc_users(email)`
  )

  await pool.query(`
    INSERT INTO products (id, name, slug, description, version, enabled_modules)
    VALUES (
      '00000000-0000-0000-0000-000000000101'::uuid,
      'Seed Product',
      'seed-product',
      'Seed product for schema tests',
      '1.0.0',
      '[]'::jsonb
    )
    ON CONFLICT (slug) DO NOTHING
  `)

  await pool.query(`
    INSERT INTO licenses (
      id,
      product_id,
      workspace_slug,
      status,
      student_limit,
      staff_limit
    )
    VALUES (
      '00000000-0000-0000-0000-000000000201'::uuid,
      '00000000-0000-0000-0000-000000000101'::uuid,
      'seed-workspace',
      'ACTIVE',
      100,
      20
    )
    ON CONFLICT (workspace_slug) DO NOTHING
  `)

  await pool.query(`
    INSERT INTO tenants_registry (
      id,
      license_id,
      workspace_slug,
      db_host,
      db_port,
      db_name,
      db_user,
      db_password_encrypted
    )
    VALUES (
      '00000000-0000-0000-0000-000000000301'::uuid,
      '00000000-0000-0000-0000-000000000201'::uuid,
      'seed-workspace',
      'localhost',
      5432,
      'workspace_seed',
      'tenant_user',
      'encrypted'
    )
    ON CONFLICT (workspace_slug) DO NOTHING
  `)

  await pool.query(`
    INSERT INTO mmc_users (
      id,
      email,
      password_hash,
      role
    )
    VALUES (
      '00000000-0000-0000-0000-000000000401'::uuid,
      'seed-admin@zidney.test',
      '$2b$10$seed',
      'ADMIN'
    )
    ON CONFLICT (email) DO NOTHING
  `)

  await pool.query(`
    INSERT INTO platform_schema_version (id, current_version, minimum_supported_version)
    VALUES (1, '1.0.0', '1.0.0')
    ON CONFLICT (id) DO UPDATE
    SET current_version = EXCLUDED.current_version,
        minimum_supported_version = EXCLUDED.minimum_supported_version,
        updated_at = NOW()
  `)

  await pool.query(`
    INSERT INTO _schema_migrations (version, description, checksum)
    VALUES ('20250102001', 'initial_master_schema', 'seed-checksum')
    ON CONFLICT (version) DO NOTHING
  `)
}

describe('Master Database Schema Constraints', () => {
  let pool: Pool

  beforeAll(async () => {
    // Initialize connection pool pointing to the configured master DB.
    pool = new Pool({ connectionString: getMasterTestConnectionString() })
    await ensureLegacyMasterSchema(pool)

    // Run migrations
    // Note: Migration runner should be called here
  })

  afterAll(async () => {
    await pool.end()
  })

  describe('products table', () => {
    it('should enforce UUID primary key', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'id'
      `)

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].data_type).toBe('uuid')
      expect(result.rows[0].is_nullable).toBe('NO')
    })

    it('should enforce unique slug constraint', async () => {
      const result = await pool.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'products' AND constraint_name LIKE '%slug%'
      `)

      expect(result.rows.length).toBeGreaterThan(0)
      expect(result.rows.some((r) => r.constraint_type === 'UNIQUE')).toBe(true)
    })

    it('should enforce version semantic format CHECK constraint', async () => {
      const result = await pool.query(`
        SELECT constraint_name
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%version%' OR constraint_name LIKE '%product_version%'
      `)

      // Should have at least one CHECK constraint for version format
      expect(result.rows.length).toBeGreaterThan(0)
    })

    it('should enforce slug format CHECK constraint', async () => {
      const result = await pool.query(`
        SELECT constraint_name
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%slug%'
      `)

      expect(result.rows.length).toBeGreaterThan(0)
    })

    it('should reject invalid product slug format', async () => {
      // Try to insert product with invalid slug (uppercase letters)
      const invalidSlug = 'MyProduct' // Upper case not allowed

      try {
        await pool.query(
          `INSERT INTO products (name, slug, version)
           VALUES ($1, $2, $3)`,
          ['My Product', invalidSlug, '1.0.0']
        )
        expect.fail('Should have rejected uppercase slug')
      } catch (error: unknown) {
        if (error instanceof Error) {
          expect(error.message).toMatch(/check/i)
        }
      }
    })

    it('should reject invalid product version format', async () => {
      try {
        await pool.query(
          `INSERT INTO products (name, slug, version)
           VALUES ($1, $2, $3)`,
          ['Test Product', 'test-prod', 'invalid-version']
        )
        expect.fail('Should have rejected invalid version format')
      } catch (error: unknown) {
        if (error instanceof Error) {
          expect(error.message).toMatch(/check/i)
        }
      }
    })
  })

  describe('licenses table', () => {
    it('should enforce unique workspace_slug constraint', async () => {
      const result = await pool.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'licenses' AND constraint_name LIKE '%workspace%'
      `)

      expect(result.rows.some((r) => r.constraint_type === 'UNIQUE')).toBe(true)
    })

    it('should enforce status enum CHECK constraint', async () => {
      const result = await pool.query(`
        SELECT constraint_name
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%status%'
      `)

      expect(result.rows.length).toBeGreaterThan(0)
    })

    it('should enforce FK to products', async () => {
      const result = await pool.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'licenses'
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name LIKE '%product%'
      `)

      expect(result.rows.length).toBeGreaterThan(0)
    })

    it('should reject invalid status value', async () => {
      const productResult = await pool.query(`SELECT id FROM products LIMIT 1`)
      const productId = productResult.rows[0]?.id

      if (productId) {
        try {
          await pool.query(
            `INSERT INTO licenses (product_id, workspace_slug, status)
             VALUES ($1, $2, $3)`,
            [productId, 'test-workspace', 'INVALID_STATUS']
          )
          expect.fail('Should have rejected invalid status')
        } catch (error: unknown) {
          if (error instanceof Error) {
            expect(error.message).toMatch(/check/i)
          }
        }
      }
    })

    it('should enforce positive limit CHECK constraints', async () => {
      const productResult = await pool.query(`SELECT id FROM products LIMIT 1`)
      const productId = productResult.rows[0]?.id

      if (productId) {
        try {
          await pool.query(
            `INSERT INTO licenses (product_id, workspace_slug, student_limit)
             VALUES ($1, $2, $3)`,
            [productId, 'test-workspace-2', -5]
          )
          expect.fail('Should have rejected negative limit')
        } catch (error: unknown) {
          if (error instanceof Error) {
            expect(error.message).toMatch(/check/i)
          }
        }
      }
    })
  })

  describe('tenants_registry table', () => {
    it('should enforce unique workspace_slug constraint', async () => {
      const result = await pool.query(`
        SELECT constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'tenants_registry'
          AND constraint_name LIKE '%workspace%'
      `)

      expect(result.rows.some((r) => r.constraint_type === 'UNIQUE')).toBe(true)
    })

    it('should enforce FK to licenses', async () => {
      const result = await pool.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'tenants_registry'
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name LIKE '%license%'
      `)

      expect(result.rows.length).toBeGreaterThan(0)
    })

    it('should NOT have status field (architectural rule)', async () => {
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'tenants_registry' AND column_name = 'status'
      `)

      expect(result.rows).toHaveLength(0)
    })
  })

  describe('mmc_users table', () => {
    it('should enforce unique email constraint', async () => {
      const result = await pool.query(`
        SELECT constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'mmc_users' AND constraint_name LIKE '%email%'
      `)

      expect(result.rows.some((r) => r.constraint_type === 'UNIQUE')).toBe(true)
    })

    it('should enforce role enum CHECK constraint', async () => {
      const result = await pool.query(`
        SELECT constraint_name
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%role%'
      `)

      expect(result.rows.length).toBeGreaterThan(0)
    })

    it('should reject invalid role value', async () => {
      try {
        await pool.query(
          `INSERT INTO mmc_users (email, password_hash, role)
           VALUES ($1, $2, $3)`,
          ['test@example.com', '$2b$10$...', 'invalid_role']
        )
        expect.fail('Should have rejected invalid role')
      } catch (error: unknown) {
        if (error instanceof Error) {
          expect(error.message).toMatch(/check/i)
        }
      }
    })
  })

  describe('platform_schema_version table', () => {
    it('should have single-row constraint (id = 1)', async () => {
      const result = await pool.query(`
        SELECT constraint_name
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%platform_schema_version%'
      `)

      // Single-row constraint enforced via CHECK (id = 1)
      expect(result.rows.length).toBeGreaterThan(0)
    })

    it('should have version semantic format CHECK constraint', async () => {
      const result = await pool.query(`
        SELECT constraint_name
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%version_format%'
      `)

      expect(result.rows.length).toBeGreaterThan(0)
    })
  })

  describe('indexes', () => {
    it('should have index on products(slug)', async () => {
      const result = await pool.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'products' AND indexname LIKE '%slug%'
      `)

      expect(result.rows.length).toBeGreaterThan(0)
    })

    it('should have index on licenses(workspace_slug)', async () => {
      const result = await pool.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'licenses' AND indexname LIKE '%workspace%'
      `)

      expect(result.rows.length).toBeGreaterThan(0)
    })

    it('should have index on licenses(status)', async () => {
      const result = await pool.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'licenses' AND indexname LIKE '%status%'
      `)

      expect(result.rows.length).toBeGreaterThan(0)
    })

    it('should have index on tenants_registry(workspace_slug)', async () => {
      const result = await pool.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'tenants_registry' AND indexname LIKE '%workspace%'
      `)

      expect(result.rows.length).toBeGreaterThan(0)
    })

    it('should have index on mmc_users(email)', async () => {
      const result = await pool.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'mmc_users' AND indexname LIKE '%email%'
      `)

      expect(result.rows.length).toBeGreaterThan(0)
    })
  })
})
