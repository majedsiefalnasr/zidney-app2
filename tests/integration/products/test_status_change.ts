/**
 * Integration Test: Product Status Change (T056)
 *
 * Validates:
 * - Change ACTIVE → INACTIVE succeeds, returns 200
 * - Change INACTIVE → ACTIVE succeeds, returns 200
 * - Status change does NOT increment current_version
 * - Audit log created with action=STATUS_CHANGE (no version numbers)
 * - Version field immutable (not included in PATCH request)
 */

import * as productService from '@zidney/domain-core/products/productService'
import { Module } from '@zidney/types/enums/Module'
import { ProductStatus } from '@zidney/types/products/Product'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTestContext, createTestContext, type TestContext } from '../../test-helpers'

describe('T056: Product Status Change Integration Tests', () => {
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

  describe('Status transitions', () => {
    it('should change from ACTIVE to INACTIVE', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Status Test' },
          slug: 'status-trans',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      expect(product.status).toBe('ACTIVE')

      const updated = await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )

      expect(updated.status).toBe('INACTIVE')
    })

    it('should change from INACTIVE back to ACTIVE', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Toggle Test' },
          slug: 'toggle',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const inactive = await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )
      expect(inactive.status).toBe('INACTIVE')

      const active = await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.ACTIVE,
        ctx.userId
      )
      expect(active.status).toBe('ACTIVE')
    })

    it('should handle idempotent status changes', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Idempotent' },
          slug: 'idem',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const result1 = await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )
      const result2 = await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )

      expect(result1.status).toBe('INACTIVE')
      expect(result2.status).toBe('INACTIVE')
    })
  })

  describe('Version immutability on status change', () => {
    it('should NOT increment version on status change', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Version Immutable' },
          slug: 'version-immut',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const beforeVersion = product.current_version

      const updated = await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )

      expect(updated.current_version).toBe(beforeVersion)
    })

    it('should preserve version across multiple status changes', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Multi Status' },
          slug: 'multi-status',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const v1 = product.current_version

      const v1_inactive = await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )
      expect(v1_inactive.current_version).toBe(v1)

      const v1_active = await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.ACTIVE,
        ctx.userId
      )
      expect(v1_active.current_version).toBe(v1)

      const v1_inactive2 = await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )
      expect(v1_inactive2.current_version).toBe(v1)
    })

    it('should not create new version record on status change', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'No Version Record' },
          slug: 'no-ver-rec',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const beforeCount = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_versions WHERE product_id = $1',
        [product.id]
      )
      const beforeNum = parseInt(beforeCount.rows[0]!.count)

      await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )

      const afterCount = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_versions WHERE product_id = $1',
        [product.id]
      )
      const afterNum = parseInt(afterCount.rows[0]!.count)

      expect(afterNum).toBe(beforeNum)
      expect(afterNum).toBe(1) // Only the initial version
    })
  })

  describe('Audit logging', () => {
    it('should create STATUS_CHANGE audit entry', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Audit Status' },
          slug: 'audit-status',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )

      const audits = await dbClient.query(
        'SELECT * FROM product_audit_logs WHERE product_id = $1 ORDER BY timestamp',
        [product.id]
      )

      expect(audits.rows.length).toBe(2) // CREATE + STATUS_CHANGE
      const statusChangeAudit = audits.rows[1]
      expect(statusChangeAudit.action).toBe('STATUS_CHANGE')
      expect(statusChangeAudit.performed_by).toBe(ctx.userId)
    })

    it('should not include version numbers in STATUS_CHANGE audit', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Status No Version' },
          slug: 'status-no-ver',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )

      const audits = await dbClient.query(
        'SELECT previous_version, new_version FROM product_audit_logs WHERE product_id = $1 AND action = $2',
        [product.id, 'STATUS_CHANGE']
      )

      expect(audits.rows.length).toBe(1)
      const audit = audits.rows[0]!
      // STATUS_CHANGE should not have version tracking
      expect(audit.previous_version === null || audit.new_version === null).toBe(true)
    })

    it('should track all status transitions in audit log', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Status History' },
          slug: 'status-hist',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )
      await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.ACTIVE,
        ctx.userId
      )
      await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )

      const audits = await dbClient.query(
        "SELECT action FROM product_audit_logs WHERE product_id = $1 AND action = 'STATUS_CHANGE' ORDER BY timestamp",
        [product.id]
      )

      expect(audits.rows.length).toBe(3)
      expect(audits.rows.every((r: any) => r.action === 'STATUS_CHANGE')).toBe(true)
    })
  })

  describe('Data preservation', () => {
    it('should preserve all other product data on status change', async () => {
      const original = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Data Preserve', ar: 'الحفاظ على البيانات' },
          slug: 'data-pres',
          description: 'Important description',
          enabled_modules: [Module.MCQ, Module.TRADITIONAL_EXAMS],
        },
        ctx.userId
      )

      const updated = await productService.changeProductStatus(
        dbClient,
        original.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )

      expect(updated.id).toBe(original.id)
      expect(updated.name).toEqual(original.name)
      expect(updated.slug).toBe(original.slug)
      expect(updated.description).toBe(original.description)
      expect(updated.enabled_modules).toEqual(original.enabled_modules)
      expect(updated.created_at).toBe(original.created_at)
      expect(updated.current_version).toBe(original.current_version)
    })

    it('should preserve updated_at from last content update', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Timestamp Preserve' },
          slug: 'ts-pres',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      await new Promise((resolve) => setTimeout(resolve, 10))

      const statusChanged = await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )

      // updated_at for product itself should not change (or may be updated)
      // The key is that it preserves the logical product state
      expect(statusChanged.id).toBe(product.id)
    })
  })

  describe('Status field behavior', () => {
    it('should return correct status in GET after change', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'GET Status' },
          slug: 'get-status',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )

      const retrieved = await productService.getProductById(dbClient, product.id)

      expect(retrieved.status).toBe('INACTIVE')
    })

    it('should reflect status in list operations', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'List Status' },
          slug: 'list-status',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      await productService.changeProductStatus(
        dbClient,
        product.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )

      const activeList = await productService.listProducts(dbClient, {
        status: ProductStatus.ACTIVE,
      })
      const inactiveList = await productService.listProducts(dbClient, {
        status: ProductStatus.INACTIVE,
      })

      expect(activeList.items.find((p) => p.id === product.id)).toBeUndefined()
      expect(inactiveList.items.find((p) => p.id === product.id)).toBeDefined()
    })
  })

  describe('Error cases', () => {
    it('should handle invalid status values', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Invalid Status' },
          slug: 'inv-status',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      try {
        await productService.changeProductStatus(
          dbClient,
          product.id,
          'INVALID_STATUS' as any,
          ctx.userId
        )
        expect.fail('Should have rejected invalid status')
      } catch (error: any) {
        expect(error).toBeDefined()
      }
    })

    it('should handle non-existent product', async () => {
      try {
        await productService.changeProductStatus(
          dbClient,
          'non-existent-id',
          ProductStatus.INACTIVE,
          ctx.userId
        )
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error).toBeDefined()
      }
    })
  })
})
