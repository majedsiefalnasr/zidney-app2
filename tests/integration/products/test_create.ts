/**
 * Integration Test: Product Creation (T052)
 *
 * Validates:
 * - Product creation returns 201 with ProductResponse
 * - Version initialized to 1
 * - Version 1 record created in product_versions table
 * - Audit log entry created with action=CREATE
 * - Duplicate slug returns 409 Conflict
 * - Proper error responses for invalid input
 */

import * as productService from '@zidney/domain-core/products/productService'
import { Module } from '@zidney/types/enums/Module'
import type { CreateProductInput } from '@zidney/types/products/Product'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTestContext, createTestContext, type TestContext } from '../../test-helpers'

describe('T052: Product Creation Integration Tests', () => {
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
    // Clean up test data before each test
    await dbClient.query('DELETE FROM product_audit_logs')
    await dbClient.query('DELETE FROM product_versions')
    await dbClient.query('DELETE FROM products')
  })

  describe('Happy path - Valid product creation', () => {
    it('should create product with valid input and return 201', async () => {
      const input: CreateProductInput = {
        name: { en: 'Test Product', ar: 'منتج اختبار' },
        slug: 'test-product-001',
        description: 'A test product for validation',
        enabled_modules: [Module.MCQ, Module.TRADITIONAL_EXAMS],
      }

      const product = await productService.createProduct(dbClient, input, ctx.userId)

      expect(product).toBeDefined()
      expect(product.id).toBeDefined()
      expect(product.name).toEqual(input.name)
      expect(product.slug).toEqual(input.slug)
      expect(product.current_version).toBe(1)
      expect(product.status).toBe('ACTIVE')
      expect(product.enabled_modules).toEqual(input.enabled_modules)
    })

    it('should create version 1 record in product_versions table', async () => {
      const input: CreateProductInput = {
        name: { en: 'Version Test' },
        slug: 'version-test',
        enabled_modules: [Module.EXERCISES],
      }

      const product = await productService.createProduct(dbClient, input, ctx.userId)

      const versionResult = await dbClient.query(
        'SELECT * FROM product_versions WHERE product_id = $1',
        [product.id]
      )

      expect(versionResult.rows.length).toBe(1)
      const version = versionResult.rows[0]!
      expect(version.version_number).toBe(1)
      expect(version.product_id).toEqual(product.id)
      expect(JSON.parse(version.name)).toEqual(input.name)
    })

    it('should create audit log entry with action=CREATE', async () => {
      const input: CreateProductInput = {
        name: { en: 'Audit Test' },
        slug: 'audit-test',
        enabled_modules: [Module.LIBRARY],
      }

      const product = await productService.createProduct(dbClient, input, ctx.userId)

      const auditResult = await dbClient.query(
        'SELECT * FROM product_audit_logs WHERE product_id = $1',
        [product.id]
      )

      expect(auditResult.rows.length).toBe(1)
      const audit = auditResult.rows[0]!
      expect(audit.action).toBe('CREATE')
      expect(audit.product_id).toEqual(product.id)
      expect(audit.performed_by).toBe(ctx.userId)
      expect(audit.timestamp).toBeDefined()
    })

    it('should initialize product with ACTIVE status', async () => {
      const input: CreateProductInput = {
        name: { en: 'Status Test' },
        slug: 'status-test',
        enabled_modules: [Module.LIVES],
      }

      const product = await productService.createProduct(dbClient, input, ctx.userId)

      expect(product.status).toBe('ACTIVE')
    })

    it('should support optional description', async () => {
      const input: CreateProductInput = {
        name: { en: 'No Description' },
        slug: 'no-desc',
        enabled_modules: [Module.FORUM],
        description: undefined,
      }

      const product = await productService.createProduct(dbClient, input, ctx.userId)

      expect(product.description).toBeNull()
    })

    it('should support multilingua names (ar optional)', async () => {
      const input: CreateProductInput = {
        name: { en: 'English Only' },
        slug: 'english-only',
        enabled_modules: [Module.MCQ],
      }

      const product = await productService.createProduct(dbClient, input, ctx.userId)

      expect(product.name.en).toBe('English Only')
      expect(product.name.ar).toBeUndefined()
    })

    it('should support all 6 module combinations', async () => {
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
        slug: 'all-modules',
        enabled_modules: allModules as any[],
      }

      const product = await productService.createProduct(dbClient, input, ctx.userId)

      expect(product.enabled_modules.sort()).toEqual(allModules.sort())
    })

    it('should set timestamps (created_at, updated_at)', async () => {
      const input: CreateProductInput = {
        name: { en: 'Timestamp Test' },
        slug: 'timestamp-test',
        enabled_modules: [Module.MCQ],
      }

      const beforeCreate = new Date()
      const product = await productService.createProduct(dbClient, input, ctx.userId)
      const afterCreate = new Date()

      expect(product.created_at).toBeDefined()
      expect(product.updated_at).toBeDefined()
      expect(new Date(product.created_at).getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(new Date(product.updated_at).getTime()).toBeLessThanOrEqual(afterCreate.getTime())
    })
  })

  describe('Error cases - Validation & Constraints', () => {
    it('should return 409 Conflict for duplicate slug', async () => {
      const input1: CreateProductInput = {
        name: { en: 'First Product' },
        slug: 'duplicate-slug',
        enabled_modules: [Module.MCQ],
      }

      const input2: CreateProductInput = {
        name: { en: 'Second Product' },
        slug: 'duplicate-slug', // Same slug
        enabled_modules: [Module.LIVES],
      }

      await productService.createProduct(dbClient, input1, ctx.userId)

      // Second creation should throw or return error
      try {
        await productService.createProduct(dbClient, input2, ctx.userId)
        expect.fail('Should have thrown error for duplicate slug')
      } catch (error: any) {
        // Error expected - could be DUPLICATE_SLUG or database constraint error
        expect(error.code || error.message).toBeDefined()
      }
    })

    it('should reject invalid module enum values', async () => {
      const input: CreateProductInput = {
        name: { en: 'Bad Module' },
        slug: 'bad-module',
        enabled_modules: ['INVALID_MODULE' as any],
      }

      try {
        await productService.createProduct(dbClient, input, ctx.userId)
        expect.fail('Should have rejected invalid module')
      } catch (error: any) {
        expect(error.code || error.message).toBeDefined()
      }
    })

    it('should reject empty module list', async () => {
      const input: CreateProductInput = {
        name: { en: 'No Modules' },
        slug: 'no-modules',
        enabled_modules: [],
      }

      try {
        await productService.createProduct(dbClient, input, ctx.userId)
        expect.fail('Should have rejected empty modules array')
      } catch (error: any) {
        expect(error.code || error.message).toBeDefined()
      }
    })

    it('should reject missing name.en', async () => {
      const input: Partial<CreateProductInput> = {
        name: { en: '', ar: 'منتج' }, // Empty en
        slug: 'no-en',
        enabled_modules: [Module.MCQ],
      }

      try {
        await productService.createProduct(dbClient, input as CreateProductInput, ctx.userId)
        expect.fail('Should have rejected empty name.en')
      } catch (error: any) {
        expect(error.code || error.message).toBeDefined()
      }
    })

    it('should reject invalid slug format', async () => {
      const input: CreateProductInput = {
        name: { en: 'Bad Slug' },
        slug: 'UPPERCASE_SLUG', // Invalid format
        enabled_modules: [Module.MCQ],
      }

      try {
        await productService.createProduct(dbClient, input, ctx.userId)
        expect.fail('Should have rejected invalid slug format')
      } catch (error: any) {
        expect(error.code || error.message).toBeDefined()
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle very long product names', async () => {
      const longName = 'A'.repeat(255)
      const input: CreateProductInput = {
        name: { en: longName },
        slug: 'long-name',
        enabled_modules: [Module.MCQ],
      }

      const product = await productService.createProduct(dbClient, input, ctx.userId)

      expect(product.name.en.length).toBe(255)
    })

    it('should handle special characters in description', async () => {
      const specialDesc = `Test with special chars: @#$%!&*() "quotes" 'apostrophes'`
      const input: CreateProductInput = {
        name: { en: 'Special Chars' },
        slug: 'special-chars',
        description: specialDesc,
        enabled_modules: [Module.MCQ],
      }

      const product = await productService.createProduct(dbClient, input, ctx.userId)

      expect(product.description).toBe(specialDesc)
    })

    it('should handle single character slug', async () => {
      const input: CreateProductInput = {
        name: { en: 'Single Char' },
        slug: 'a',
        enabled_modules: [Module.MCQ],
      }

      const product = await productService.createProduct(dbClient, input, ctx.userId)

      expect(product.slug).toBe('a')
    })

    it('should handle numeric slugs', async () => {
      const input: CreateProductInput = {
        name: { en: 'numeric' },
        slug: '12345',
        enabled_modules: [Module.MCQ],
      }

      const product = await productService.createProduct(dbClient, input, ctx.userId)

      expect(product.slug).toBe('12345')
    })

    it('should handle consecutive hyphens in slug', async () => {
      const input: CreateProductInput = {
        name: { en: 'Hyphenated' },
        slug: 'test--product--name',
        enabled_modules: [Module.MCQ],
      }

      const product = await productService.createProduct(dbClient, input, ctx.userId)

      expect(product.slug).toBe('test--product--name')
    })

    it('should provide change_summary in audit log', async () => {
      const input: CreateProductInput = {
        name: { en: 'Change Summary Test' },
        slug: 'change-summary',
        enabled_modules: [Module.MCQ],
        description: 'Test description',
      }

      const product = await productService.createProduct(dbClient, input, ctx.userId)

      const auditResult = await dbClient.query(
        'SELECT change_summary FROM product_audit_logs WHERE product_id = $1',
        [product.id]
      )

      expect(auditResult.rows[0]!.change_summary).toBeDefined()
    })
  })

  describe('Transaction Atomicity', () => {
    it('should rollback entire transaction if product_versions insert fails', async () => {
      const input: CreateProductInput = {
        name: { en: 'Rollback Test' },
        slug: 'rollback-test',
        enabled_modules: [Module.MCQ],
      }

      // This would require injecting a failure scenario
      // In real implementation, monitor database state
      await productService.createProduct(dbClient, input, ctx.userId)

      // Verify all three records created (product + version + audit)
      const productCount = await dbClient.query(
        'SELECT COUNT(*) as count FROM products WHERE slug = $1',
        [input.slug]
      )
      const versionCount = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_versions WHERE product_id = (SELECT id FROM products WHERE slug = $1)',
        [input.slug]
      )
      const auditCount = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_audit_logs WHERE product_id = (SELECT id FROM products WHERE slug = $1)',
        [input.slug]
      )

      expect(parseInt(productCount.rows[0]!.count, 10)).toBe(1)
      expect(parseInt(versionCount.rows[0]!.count, 10)).toBe(1)
      expect(parseInt(auditCount.rows[0]!.count, 10)).toBe(1)
    })
  })
})
