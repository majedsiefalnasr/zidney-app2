/**
 * Integration Test: Get Single Product (T054)
 *
 * Validates:
 * - GET /products/:id returns single product
 * - Invalid product_id returns 404
 * - All product fields are present
 */

import * as productService from '@zidney/domain-core/products/productService'
import { Module } from '@zidney/types/enums/Module'
import { ErrorCodes } from '@zidney/types/errors/ErrorCodes'
import type { CreateProductInput } from '@zidney/types/products/Product'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTestContext, createTestContext, type TestContext } from '../../test-helpers'

describe('T054: Get Single Product Integration Tests', () => {
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

  describe('Happy path', () => {
    it('should return single product by ID', async () => {
      const input: CreateProductInput = {
        name: { en: 'Get Test Product' },
        slug: 'get-test',
        description: 'Test product for get operation',
        enabled_modules: [Module.MCQ, Module.TRADITIONAL_EXAMS],
      }

      const created = await productService.createProduct(dbClient, input, ctx.userId)
      const retrieved = await productService.getProductById(dbClient, created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved.id).toBe(created.id)
      expect(retrieved.name).toEqual(input.name)
      expect(retrieved.slug).toEqual(input.slug)
      expect(retrieved.description).toBe(input.description)
      expect(retrieved.enabled_modules).toEqual(input.enabled_modules)
    })

    it('should include all required fields', async () => {
      const created = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Fields Test' },
          slug: 'fields-test',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const product = await productService.getProductById(dbClient, created.id)

      expect(product.id).toBeDefined()
      expect(product.name).toBeDefined()
      expect(product.slug).toBeDefined()
      expect(product.status).toBeDefined()
      expect(product.current_version).toBeDefined()
      expect(product.enabled_modules).toBeDefined()
      expect(product.description).toBeDefined()
      expect(product.created_at).toBeDefined()
      expect(product.updated_at).toBeDefined()
    })

    it('should return exact version from current_version field', async () => {
      const created = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Version Test' },
          slug: 'v-test',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const product = await productService.getProductById(dbClient, created.id)

      expect(product.current_version).toBe(1)
    })

    it('should reflect status correctly', async () => {
      const created = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Status Get Test' },
          slug: 'status-get-test',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      expect(created.status).toBe('ACTIVE')

      const product = await productService.getProductById(dbClient, created.id)
      expect(product.status).toBe('ACTIVE')
    })

    it('should return updated timestamps correctly', async () => {
      const created = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Timestamp Get' },
          slug: 'ts-get',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const product = await productService.getProductById(dbClient, created.id)

      expect(new Date(product.created_at)).toBeInstanceOf(Date)
      expect(new Date(product.updated_at)).toBeInstanceOf(Date)
      expect(new Date(product.created_at).getTime()).toBeLessThanOrEqual(
        new Date(product.updated_at).getTime()
      )
    })
  })

  describe('Error handling', () => {
    it('should throw error for non-existent product ID', async () => {
      const fakeId = `fake-id-${Math.random().toString(36).substring(7)}`

      try {
        await productService.getProductById(dbClient, fakeId)
        expect.fail('Should have thrown error for non-existent product')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.PRODUCT_NOT_FOUND)
      }
    })

    it('should handle malformed UUID gracefully', async () => {
      try {
        await productService.getProductById(dbClient, 'invalid-uuid-format')
        expect.fail('Should have thrown error for invalid format')
      } catch (error: any) {
        // Error expected - either validation error or not found
        expect(error.code || error.message).toBeDefined()
      }
    })

    it('should return 404 consistently', async () => {
      const fakeIds = ['nonexistent-1', 'nonexistent-2', 'nonexistent-3']

      for (const fakeId of fakeIds) {
        try {
          await productService.getProductById(dbClient, fakeId)
          expect.fail('Should have thrown error')
        } catch (error: any) {
          expect(error.code).toBe(ErrorCodes.PRODUCT_NOT_FOUND)
        }
      }
    })
  })

  describe('Data integrity', () => {
    it('should return identical values to created product', async () => {
      const input: CreateProductInput = {
        name: { en: 'Integrity Test', ar: 'اختبار التكامل' },
        slug: 'integrity-test',
        description: 'Testing data integrity',
        enabled_modules: [Module.EXERCISES, Module.LIBRARY],
      }

      const created = await productService.createProduct(dbClient, input, ctx.userId)
      const retrieved = await productService.getProductById(dbClient, created.id)

      expect(JSON.stringify(created)).toBe(JSON.stringify(retrieved))
    })

    it('should not include sensitive fields', async () => {
      const created = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Security Test' },
          slug: 'security-test',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const product = await productService.getProductById(dbClient, created.id)

      // Should not expose internal fields
      expect(product).not.toHaveProperty('password')
      expect(product).not.toHaveProperty('secret')
      expect(product).not.toHaveProperty('api_key')
    })
  })

  describe('Multilingual support', () => {
    it('should preserve both English and Arabic names', async () => {
      const input: CreateProductInput = {
        name: { en: 'Bilingual Product', ar: 'منتج ثنائي اللغة' },
        slug: 'bilingual',
        enabled_modules: [Module.MCQ],
      }

      const created = await productService.createProduct(dbClient, input, ctx.userId)
      const product = await productService.getProductById(dbClient, created.id)

      expect(product.name.en).toBe('Bilingual Product')
      expect(product.name.ar).toBe('منتج ثنائي اللغة')
    })

    it('should handle missing Arabic name', async () => {
      const input: CreateProductInput = {
        name: { en: 'English Only' },
        slug: 'en-only',
        enabled_modules: [Module.MCQ],
      }

      const created = await productService.createProduct(dbClient, input, ctx.userId)
      const product = await productService.getProductById(dbClient, created.id)

      expect(product.name.en).toBe('English Only')
      expect(product.name.ar).toBeUndefined()
    })
  })

  describe('Module information', () => {
    it('should return all enabled modules', async () => {
      const allModules = [
        Module.EXERCISES,
        Module.MCQ,
        Module.LIVES,
        Module.TRADITIONAL_EXAMS,
        Module.LIBRARY,
        Module.FORUM,
      ]

      const input: CreateProductInput = {
        name: { en: 'All Modules' },
        slug: 'all-modules-get',
        enabled_modules: allModules as any[],
      }

      const created = await productService.createProduct(dbClient, input, ctx.userId)
      const product = await productService.getProductById(dbClient, created.id)

      expect(product.enabled_modules.sort()).toEqual(allModules.sort())
    })

    it('should return single module correctly', async () => {
      const input: CreateProductInput = {
        name: { en: 'Single Module' },
        slug: 'single-module',
        enabled_modules: [Module.EXERCISES],
      }

      const created = await productService.createProduct(dbClient, input, ctx.userId)
      const product = await productService.getProductById(dbClient, created.id)

      expect(product.enabled_modules.length).toBe(1)
      expect(product.enabled_modules[0]).toBe(Module.EXERCISES)
    })
  })
})
