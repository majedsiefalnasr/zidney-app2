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

describe('Master Database Schema Constraints', () => {
  let pool: Pool

  beforeAll(async () => {
    // Initialize connection pool pointing to test master database
    // Note: Test database must be set up before running tests
    pool = new Pool({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
      database: process.env.TEST_DB_NAME || 'zidney_master_test',
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'postgres',
    })

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
          expect(error.message).toContain('CHECK')
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
          expect(error.message).toContain('CHECK')
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
            expect(error.message).toContain('CHECK')
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
            expect(error.message).toContain('CHECK')
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
          expect(error.message).toContain('CHECK')
        }
      }
    })
  })

  describe('platform_schema_version table', () => {
    it('should have single-row constraint (id = 1)', async () => {
      const result = await pool.query(`
        SELECT id
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
