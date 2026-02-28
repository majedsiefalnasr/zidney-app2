/**
 * Integration Test: Product Listing (T053)
 *
 * Validates:
 * - GET /products returns ACTIVE products by default
 * - ?status=INACTIVE returns inactive products only
 * - ?status=all returns both active and inactive
 * - Pagination works (limit/offset)
 * - Search by name (en/ar) works
 * - Results sorted by created_at DESC
 */

import * as productService from '@zidney/domain-core/products/productService'
import {
  CreateProductInput,
  ProductQueryFilters,
  ProductStatus,
} from '@zidney/types/products/Product'
import { Module } from '@zidney/types/enums/Module'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanupTestContext,
  createTestContext,
  TestContext,
} from '../../test-helpers'

describe('T053: Product Listing Integration Tests', () => {
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

  describe('Default listing behavior', () => {
    it('should return ACTIVE products only by default', async () => {
      // Create mix of active and inactive products
      const activeInput: CreateProductInput = {
        name: { en: 'Active Product' },
        slug: 'active-1',
        enabled_modules: [Module.MCQ],
      }

      const inactiveInput: CreateProductInput = {
        name: { en: 'Inactive Product' },
        slug: 'inactive-1',
        enabled_modules: [Module.MCQ],
      }

      const activeProduct = await productService.createProduct(
        dbClient,
        activeInput,
        ctx.userId
      )
      const inactiveProduct = await productService.createProduct(
        dbClient,
        inactiveInput,
        ctx.userId
      )

      // Change second to INACTIVE
      await productService.changeProductStatus(
        dbClient,
        inactiveProduct.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )

      // List without filters
      const filters: ProductQueryFilters = {}
      const result = await productService.listProducts(dbClient, filters)

      expect(result.items.length).toBe(1)
      expect(result.items[0]!.id).toBe(activeProduct.id)
      expect(result.items[0]!.status).toBe('ACTIVE')
    })

    it('should count total correctly', async () => {
      await productService.createProduct(
        dbClient,
        {
          name: { en: 'Product 1' },
          slug: 'p1',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )
      await productService.createProduct(
        dbClient,
        {
          name: { en: 'Product 2' },
          slug: 'p2',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const result = await productService.listProducts(dbClient, {})

      expect(result.total).toBe(2)
      expect(result.items.length).toBe(2)
    })
  })

  describe('Status filtering', () => {
    beforeEach(async () => {
      // Create 2 active and 2 inactive
      const p1 = await productService.createProduct(
        dbClient,
        {
          name: { en: 'A1' },
          slug: 's-a1',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )
      const p2 = await productService.createProduct(
        dbClient,
        {
          name: { en: 'A2' },
          slug: 's-a2',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )
      const p3 = await productService.createProduct(
        dbClient,
        {
          name: { en: 'I1' },
          slug: 's-i1',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )
      const p4 = await productService.createProduct(
        dbClient,
        {
          name: { en: 'I2' },
          slug: 's-i2',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      await productService.changeProductStatus(
        dbClient,
        p3.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )
      await productService.changeProductStatus(
        dbClient,
        p4.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )
    })

    it('should filter by status=ACTIVE', async () => {
      const result = await productService.listProducts(dbClient, {
        status: ProductStatus.ACTIVE,
      })

      expect(result.items.length).toBe(2)
      expect(result.items.every((p) => p.status === 'ACTIVE')).toBe(true)
    })

    it('should filter by status=INACTIVE', async () => {
      const result = await productService.listProducts(dbClient, {
        status: ProductStatus.INACTIVE,
      })

      expect(result.items.length).toBe(2)
      expect(result.items.every((p) => p.status === 'INACTIVE')).toBe(true)
    })

    it('should return all products with status=all', async () => {
      const result = await productService.listProducts(dbClient, {
        status: 'all' as any,
      })

      expect(result.items.length).toBe(4)
      expect(result.total).toBe(4)
    })
  })

  describe('Pagination', () => {
    beforeEach(async () => {
      // Create 10 products
      for (let i = 0; i < 10; i++) {
        await productService.createProduct(
          dbClient,
          {
            name: { en: `Product ${i}` },
            slug: `product-${i}`,
            enabled_modules: [Module.MCQ],
          },
          ctx.userId
        )
      }
    })

    it('should respect limit parameter', async () => {
      const result = await productService.listProducts(dbClient, { limit: 5 })

      expect(result.items.length).toBe(5)
      expect(result.total).toBe(10)
      expect(result.limit).toBe(5)
    })

    it('should respect offset parameter', async () => {
      const page1 = await productService.listProducts(dbClient, {
        limit: 5,
        offset: 0,
      })
      const page2 = await productService.listProducts(dbClient, {
        limit: 5,
        offset: 5,
      })

      expect(page1.items.length).toBe(5)
      expect(page2.items.length).toBe(5)
      expect(page1.items[0]!.id).not.toBe(page2.items[0]!.id)
    })

    it('should enforce maximum limit of 100', async () => {
      const result = await productService.listProducts(dbClient, { limit: 200 })

      expect(result.limit).toBeLessThanOrEqual(100)
    })

    it('should handle offset beyond total', async () => {
      const result = await productService.listProducts(dbClient, {
        limit: 10,
        offset: 100,
      })

      expect(result.items.length).toBe(0)
      expect(result.total).toBe(10)
    })

    it('should include pagination metadata', async () => {
      const result = await productService.listProducts(dbClient, {
        limit: 5,
        offset: 0,
      })

      expect(result.limit).toBe(5)
      expect(result.offset).toBe(0)
      expect(result.total).toBe(10)
      expect(result.has_more).toBe(true)
    })
  })

  describe('Search functionality', () => {
    beforeEach(async () => {
      await productService.createProduct(
        dbClient,
        {
          name: { en: 'Assessment Engine', ar: 'محرك التقييم' },
          slug: 'assessment-engine',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )
      await productService.createProduct(
        dbClient,
        {
          name: { en: 'Content Library', ar: 'مكتبة المحتوى' },
          slug: 'content-library',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )
      await productService.createProduct(
        dbClient,
        {
          name: { en: 'Analytics Dashboard', ar: 'لوحة التحليلات' },
          slug: 'analytics-dashboard',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )
    })

    it('should search by English name', async () => {
      const result = await productService.listProducts(dbClient, {
        search: 'Assessment',
      })

      expect(result.items.length).toBe(1)
      expect(result.items[0]!.name.en).toContain('Assessment')
    })

    it('should search by Arabic name', async () => {
      const result = await productService.listProducts(dbClient, {
        search: 'محرك',
      })

      expect(result.items.length).toBe(1)
      expect(result.items[0]!.name.ar).toContain('محرك')
    })

    it('should search by slug', async () => {
      const result = await productService.listProducts(dbClient, {
        search: 'content',
      })

      expect(result.items.length).toBeGreaterThanOrEqual(1)
      expect(result.items.some((p) => p.slug.includes('content'))).toBe(true)
    })

    it('should be case-insensitive', async () => {
      const result1 = await productService.listProducts(dbClient, {
        search: 'assessment',
      })
      const result2 = await productService.listProducts(dbClient, {
        search: 'ASSESSMENT',
      })

      expect(result1.items.length).toBe(result2.items.length)
    })

    it('should return empty array for non-matching search', async () => {
      const result = await productService.listProducts(dbClient, {
        search: 'nonexistent',
      })

      expect(result.items.length).toBe(0)
      expect(result.total).toBe(0)
    })
  })

  describe('Sorting', () => {
    it('should sort by created_at DESC (newest first)', async () => {
      const products = []

      for (let i = 0; i < 3; i++) {
        const p = await productService.createProduct(
          dbClient,
          {
            name: { en: `Product ${i}` },
            slug: `sort-test-${i}`,
            enabled_modules: [Module.MCQ],
          },
          ctx.userId
        )
        products.push(p)
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      const result = await productService.listProducts(dbClient, {})

      // Should be in reverse order (newest first)
      expect(result.items[0]!.id).toBe(products[2]!.id)
      expect(result.items[1]!.id).toBe(products[1]!.id)
      expect(result.items[2]!.id).toBe(products[0]!.id)
    })
  })

  describe('Combined filtering', () => {
    it('should combine status, search, and pagination', async () => {
      // Create test data
      const p1 = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Active Assessment' },
          slug: 'active-assess',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )
      const p2 = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Inactive Assessment' },
          slug: 'inactive-assess',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      await productService.changeProductStatus(
        dbClient,
        p2.id,
        ProductStatus.INACTIVE,
        ctx.userId
      )

      const result = await productService.listProducts(dbClient, {
        status: ProductStatus.ACTIVE,
        search: 'Assessment',
        limit: 10,
        offset: 0,
      })

      expect(result.items.length).toBe(1)
      expect(result.items[0]!.id).toBe(p1.id)
    })
  })

  describe('Response format validation', () => {
    it('should include all required fields in each product', async () => {
      await productService.createProduct(
        dbClient,
        {
          name: { en: 'Test' },
          slug: 'test',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const result = await productService.listProducts(dbClient, {})

      expect(result.items.length).toBeGreaterThan(0)
      const product = result.items[0]!
      expect(product.id).toBeDefined()
      expect(product.name).toBeDefined()
      expect(product.slug).toBeDefined()
      expect(product.status).toBeDefined()
      expect(product.current_version).toBeDefined()
      expect(product.enabled_modules).toBeDefined()
      expect(product.created_at).toBeDefined()
      expect(product.updated_at).toBeDefined()
    })

    it('should not include audit log in list response', async () => {
      await productService.createProduct(
        dbClient,
        {
          name: { en: 'Test' },
          slug: 'test',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const result = await productService.listProducts(dbClient, {})

      expect(result.items[0]!).not.toHaveProperty('audit_log')
    })
  })
})
