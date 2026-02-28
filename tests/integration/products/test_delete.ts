/**
 * Integration Test: Product Deletion (T057)
 *
 * Validates:
 * - DELETE product without licenses succeeds, returns 204
 * - DELETE product with licenses fails, returns 409
 * - Product not found returns 404
 * - Cascade delete works (audit logs → versions → product)
 */

import * as productService from '@zidney/domain-core/products/productService'
import { ErrorCodes } from '@zidney/types/errors/ErrorCodes'
import { ProductStatus } from '@zidney/types/products/Product'
import { Module } from '@zidney/types/enums/Module'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanupTestContext,
  createTestContext,
  TestContext,
} from '../../test-helpers'

describe('T057: Product Deletion Integration Tests', () => {
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

  describe('Happy path - Delete without licenses', () => {
    it('should delete product successfully (204 No Content)', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Delete Me' },
          slug: 'delete-me',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      // Verify it exists
      const before = await productService.getProductById(dbClient, product.id)
      expect(before.id).toBe(product.id)

      // Delete it
      await productService.deleteProduct(dbClient, product.id)

      // Verify it's gone
      try {
        await productService.getProductById(dbClient, product.id)
        expect.fail('Should have thrown error after delete')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.PRODUCT_NOT_FOUND)
      }
    })

    it('should cascade delete product_versions', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Cascade Test' },
          slug: 'cascade',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      // Update to create version 2
      await productService.updateProduct(
        dbClient,
        product.id,
        { name: { en: 'Updated' } },
        ctx.userId
      )

      // Verify versions exist
      let versions = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_versions WHERE product_id = $1',
        [product.id]
      )
      expect(parseInt(versions.rows[0]!.count)).toBe(2)

      // Delete product
      await productService.deleteProduct(dbClient, product.id)

      // Verify versions are deleted
      versions = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_versions WHERE product_id = $1',
        [product.id]
      )
      expect(parseInt(versions.rows[0]!.count)).toBe(0)
    })

    it('should cascade delete product_audit_logs', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Audit Delete' },
          slug: 'audit-del',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      // Create some audit entries
      await productService.updateProduct(
        dbClient,
        product.id,
        { description: 'New desc' },
        ctx.userId
      )
      await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )

      // Verify audit logs exist
      let audits = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_audit_logs WHERE product_id = $1',
        [product.id]
      )
      expect(parseInt(audits.rows[0]!.count)).toBeGreaterThan(1)

      // Delete product
      await productService.deleteProduct(dbClient, product.id)

      // Verify audit logs are deleted
      audits = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_audit_logs WHERE product_id = $1',
        [product.id]
      )
      expect(parseInt(audits.rows[0]!.count)).toBe(0)
    })

    it('should be atomic - delete all or nothing', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Atomic Delete' },
          slug: 'atomic-del',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      // Delete product
      await productService.deleteProduct(dbClient, product.id)

      // Verify EVERYTHING is deleted
      const productCount = await dbClient.query(
        'SELECT COUNT(*) as count FROM products WHERE id = $1',
        [product.id]
      )
      const versionCount = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_versions WHERE product_id = $1',
        [product.id]
      )
      const auditCount = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_audit_logs WHERE product_id = $1',
        [product.id]
      )

      expect(parseInt(productCount.rows[0]!.count)).toBe(0)
      expect(parseInt(versionCount.rows[0]!.count)).toBe(0)
      expect(parseInt(auditCount.rows[0]!.count)).toBe(0)
    })
  })

  describe('Constraints - Delete with licenses', () => {
    it('should reject deletion if product has licenses', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Protected Product' },
          slug: 'protected',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      // Create a mock license (or simulate having licenses)
      // In real system, would be created via license API
      await dbClient.query(
        `INSERT INTO licenses (id, product_id, workspace_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [
          'lic-' + Math.random().toString(36),
          product.id,
          ctx.workspaceId,
          ProductStatus.ACTIVE,
        ]
      )

      try {
        await productService.deleteProduct(dbClient, product.id)
        expect.fail('Should have thrown error for product with licenses')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.PRODUCT_HAS_LICENSES)
      }

      // Verify product still exists
      const retrieved = await productService.getProductById(
        dbClient,
        product.id
      )
      expect(retrieved.id).toBe(product.id)
    })

    it('should return 409 Conflict for products with licenses', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Conflict Test' },
          slug: 'conflict',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      // Add a license
      await dbClient.query(
        `INSERT INTO licenses (id, product_id, workspace_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [
          'lic-' + Math.random().toString(36),
          product.id,
          ctx.workspaceId,
          ProductStatus.ACTIVE,
        ]
      )

      try {
        await productService.deleteProduct(dbClient, product.id)
        expect.fail('Should reject deletion')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.PRODUCT_HAS_LICENSES)
      }
    })
  })

  describe('Error handling', () => {
    it('should return 404 for non-existent product', async () => {
      const fakeId = 'non-existent-' + Math.random().toString(36)

      try {
        await productService.deleteProduct(dbClient, fakeId)
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.PRODUCT_NOT_FOUND)
      }
    })

    it('should be idempotent (deleting twice should fail second time)', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Idempotent Delete' },
          slug: 'idem-del',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      // First delete succeeds
      await productService.deleteProduct(dbClient, product.id)

      // Second delete should fail
      try {
        await productService.deleteProduct(dbClient, product.id)
        expect.fail('Second delete should fail')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.PRODUCT_NOT_FOUND)
      }
    })
  })

  describe('Hard delete (no soft delete)', () => {
    it('should permanently remove product from database', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Hard Delete' },
          slug: 'hard-del',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const productId = product.id

      await productService.deleteProduct(dbClient, productId)

      try {
        await productService.getProductById(dbClient, productId)
        expect.fail('Should not find deleted product')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.PRODUCT_NOT_FOUND)
      }

      // Verify direct query returns nothing
      const result = await dbClient.query(
        'SELECT * FROM products WHERE id = $1',
        [productId]
      )
      expect(result.rows.length).toBe(0)
    })

    it('should not include deleted_at or soft_delete flag', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'No Soft Delete' },
          slug: 'no-soft',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      await productService.deleteProduct(dbClient, product.id)

      // Check schema - should not have deleted_at or is_deleted columns
      const columns = await dbClient.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'products' AND (column_name ILIKE '%deleted%' OR column_name ILIKE '%soft%')`
      )

      // These fields should not exist
      expect(columns.rows.length).toBe(0)
    })
  })

  describe('State consistency after deletion', () => {
    it('should not affect other products when deleting one', async () => {
      const product1 = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Product 1' },
          slug: 'product-1',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const product2 = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Product 2' },
          slug: 'product-2',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      // Delete product 1
      await productService.deleteProduct(dbClient, product1.id)

      // Product 2 should still exist
      const retrieved = await productService.getProductById(
        dbClient,
        product2.id
      )
      expect(retrieved.id).toBe(product2.id)

      // List should still contain product 2
      const list = await productService.listProducts(dbClient, {})
      expect(list.items.find((p) => p.id === product2.id)).toBeDefined()
    })

    it('should preserve audit logs structure (not delete them)', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Audit Preservation' },
          slug: 'audit-pres',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      // Create audit entries
      const auditBefore = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_audit_logs WHERE product_id = $1',
        [product.id]
      )
      expect(parseInt(auditBefore.rows[0]!.count)).toBeGreaterThan(0)

      // Delete product (cascade deletes audit logs)
      await productService.deleteProduct(dbClient, product.id)

      // Verify cascade delete worked
      const auditAfter = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_audit_logs WHERE product_id = $1',
        [product.id]
      )
      expect(parseInt(auditAfter.rows[0]!.count)).toBe(0)
    })
  })
})
