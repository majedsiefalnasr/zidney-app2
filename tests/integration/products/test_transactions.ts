/**
 * Integration Test: Transaction Atomicity (T059)
 *
 * Validates:
 * - If any part of createProduct fails, entire transaction rolls back
 * - If any part of updateProduct fails, no version increment
 * - Product remains in consistent state after failed operation
 * - Audit log not created if operation rolls back
 */

import * as productService from '@zidney/domain-core/products/productService'
import { Module } from '@zidney/types/enums/Module'
import { ProductStatus } from '@zidney/types/products/Product'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTestContext, createTestContext, type TestContext } from '../../test-helpers'

describe('T059: Transaction Atomicity Integration Tests', () => {
  let ctx: TestContext
  let dbClient: any

  beforeAll(async () => {
    ctx = await createTestContext()
    dbClient = ctx.masterDb
  })

  afterAll(async () => {
    await cleanupTestContext(ctx)
  })

  beforeEach(async () => {
    await dbClient.query('DELETE FROM product_audit_logs')
    await dbClient.query('DELETE FROM product_versions')
    await dbClient.query('DELETE FROM products')
  })

  describe('Create operation atomicity', () => {
    it('should create all three records (product, version, audit) or none', async () => {
      const input = {
        name: { en: 'Atomic Create' },
        slug: 'atomic-create',
        enabled_modules: [Module.MCQ],
      }

      const product = await productService.createProduct(dbClient, input, ctx.userId)

      // Verify all three records exist
      const productResult = await dbClient.query('SELECT * FROM products WHERE id = $1', [
        product.id,
      ])
      const versionResult = await dbClient.query(
        'SELECT * FROM product_versions WHERE product_id = $1',
        [product.id]
      )
      const auditResult = await dbClient.query(
        'SELECT * FROM product_audit_logs WHERE product_id = $1',
        [product.id]
      )

      expect(productResult.rows.length).toBe(1)
      expect(versionResult.rows.length).toBe(1)
      expect(auditResult.rows.length).toBe(1)
    })

    it('should maintain data consistency across records', async () => {
      const input = {
        name: { en: 'Consistency Test' },
        slug: 'consistency',
        enabled_modules: [Module.MCQ, Module.TRADITIONAL_EXAMS],
      }

      const product = await productService.createProduct(dbClient, input, ctx.userId)

      // All records should reference same product_id
      const versionResult = await dbClient.query(
        'SELECT product_id FROM product_versions WHERE product_id = $1',
        [product.id]
      )
      const auditResult = await dbClient.query(
        'SELECT product_id FROM product_audit_logs WHERE product_id = $1',
        [product.id]
      )

      expect(versionResult.rows[0]!.product_id).toBe(product.id)
      expect(auditResult.rows[0]!.product_id).toBe(product.id)

      // Module arrays should match
      expect(JSON.parse(versionResult.rows[0]!.enabled_modules)).toEqual(input.enabled_modules)
    })
  })

  describe('Update operation atomicity', () => {
    it('should validate before updating', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Validation Test' },
          slug: 'validation-test',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const beforeVersion = product.current_version

      // Try invalid update
      try {
        await productService.updateProduct(
          dbClient,
          product.id,
          {
            enabled_modules: [] as any, // Invalid: empty modules
          },
          ctx.userId
        )
      } catch (_error: any) {
        // Expected to fail validation
      }

      // Verify version didn't change
      const retrieved = await productService.getProductById(dbClient, product.id)
      expect(retrieved.current_version).toBe(beforeVersion)
    })

    it('should not create version record if update fails validation', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'No Version Record' },
          slug: 'no-version-rec',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const beforeCount = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_versions WHERE product_id = $1',
        [product.id]
      )
      const countBefore = parseInt(beforeCount.rows[0]!.count, 10)

      // Try invalid update
      try {
        await productService.updateProduct(
          dbClient,
          product.id,
          {
            enabled_modules: [] as any,
          },
          ctx.userId
        )
      } catch (_error: any) {
        // Expected
      }

      const afterCount = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_versions WHERE product_id = $1',
        [product.id]
      )
      const countAfter = parseInt(afterCount.rows[0]!.count, 10)

      expect(countAfter).toBe(countBefore)
    })

    it('should not create audit entry if update fails', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Audit Atomicity' },
          slug: 'audit-atomic',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const beforeAudit = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_audit_logs WHERE product_id = $1',
        [product.id]
      )
      const auditBefore = parseInt(beforeAudit.rows[0]!.count, 10)

      // Try invalid update
      try {
        await productService.updateProduct(
          dbClient,
          product.id,
          {
            enabled_modules: ['INVALID_MODULE'] as any,
          },
          ctx.userId
        )
      } catch (_error: any) {
        // Expected
      }

      const afterAudit = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_audit_logs WHERE product_id = $1',
        [product.id]
      )
      const auditAfter = parseInt(afterAudit.rows[0]!.count, 10)

      expect(auditAfter).toBe(auditBefore)
    })
  })

  describe('Consistent state maintenance', () => {
    it('should keep product in valid state after failed operations', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Valid State' },
          slug: 'valid-state',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const stateBefore = await productService.getProductById(dbClient, product.id)

      // Try invalid operations
      try {
        await productService.updateProduct(
          dbClient,
          product.id,
          {
            name: { en: '' }, // Invalid: empty name
          },
          ctx.userId
        )
      } catch (_error: any) {
        // Expected
      }

      // Product should be unchanged
      const stateAfter = await productService.getProductById(dbClient, product.id)

      expect(stateAfter.name).toEqual(stateBefore.name)
      expect(stateAfter.current_version).toBe(stateBefore.current_version)
      expect(stateAfter.status).toBe(stateBefore.status)
    })

    it('should maintain referential integrity', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Referential Test' },
          slug: 'referential',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const _productId = product.id

      // All product_versions should have valid product_id
      const orphans = await dbClient.query(
        `SELECT pv.id FROM product_versions pv 
         WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = pv.product_id)`
      )
      expect(orphans.rows.length).toBe(0)

      // All product_audit_logs should have valid product_id
      const auditOrphans = await dbClient.query(
        `SELECT pal.id FROM product_audit_logs pal 
         WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = pal.product_id)`
      )
      expect(auditOrphans.rows.length).toBe(0)
    })
  })

  describe('Sequential operation atomicity', () => {
    it('should maintain consistency across multiple operations', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Sequential' },
          slug: 'sequential',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      // Operation 1: Valid update
      const v2 = await productService.updateProduct(
        dbClient,
        product.id,
        { name: { en: 'Updated' } },
        ctx.userId
      )
      expect(v2.current_version).toBe(2)

      // Operation 2: Status change (no version increment)
      const statusChanged = await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )
      expect(statusChanged.current_version).toBe(2)

      // Operation 3: Another update
      const v3 = await productService.updateProduct(
        dbClient,
        product.id,
        { description: 'New desc' },
        ctx.userId
      )
      expect(v3.current_version).toBe(3)

      // Verify state consistency
      const final = await productService.getProductById(dbClient, product.id)
      expect(final.current_version).toBe(3)
      expect(final.status).toBe('INACTIVE')

      // Verify all records created
      const versions = await dbClient.query(
        'SELECT version_number FROM product_versions WHERE product_id = $1 ORDER BY version_number',
        [product.id]
      )
      const audits = await dbClient.query(
        'SELECT action FROM product_audit_logs WHERE product_id = $1 ORDER BY timestamp',
        [product.id]
      )

      expect(versions.rows.length).toBe(3)
      expect(audits.rows.length).toBe(4) // CREATE + UPDATE + STATUS_CHANGE + UPDATE
    })
  })

  describe('Concurrent operation safety', () => {
    it('should handle rapid successive operations', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Rapid Ops' },
          slug: 'rapid-ops',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      // Rapid updates
      const _updates = await Promise.all([
        productService.updateProduct(dbClient, product.id, { description: 'Update 1' }, ctx.userId),
        productService.updateProduct(dbClient, product.id, { description: 'Update 2' }, ctx.userId),
        productService.updateProduct(dbClient, product.id, { description: 'Update 3' }, ctx.userId),
      ])

      // Final state should be consistent
      const _final = await productService.getProductById(dbClient, product.id)

      // Should have versions 1-4 (or more if all succeeded)
      const versions = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_versions WHERE product_id = $1',
        [product.id]
      )

      expect(parseInt(versions.rows[0]!.count, 10)).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Rollback scenarios', () => {
    it('should rollback all changes if transaction fails mid-way', async () => {
      // Simulate constraint violation by duplicate slug
      const _product1 = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Product 1' },
          slug: 'taken-slug',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      // Try to create with same slug (should fail and rollback)
      try {
        await productService.createProduct(
          dbClient,
          {
            name: { en: 'Product 2' },
            slug: 'taken-slug', // Duplicate
            enabled_modules: [Module.MCQ],
          },
          ctx.userId
        )
        expect.fail('Should have failed with duplicate slug')
      } catch (_error: any) {
        // Expected
      }

      // Verify only one product created
      const products = await dbClient.query('SELECT COUNT(*) as count FROM products')
      expect(parseInt(products.rows[0]!.count, 10)).toBe(1)

      // Verify consistent state
      const list = await productService.listProducts(dbClient, {})
      expect(list.items.length).toBe(1)
    })
  })
})
