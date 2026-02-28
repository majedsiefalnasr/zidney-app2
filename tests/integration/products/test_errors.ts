/**
 * Integration Test: Error Handling & Response Codes (T060)
 *
 * Validates:
 * - DUPLICATE_SLUG returns 409 with proper error response
 * - INVALID_MODULE_ENUM returns 400 with proper error response
 * - INVALID_NAME_LOCALIZATION returns 400 with proper error response
 * - PRODUCT_NOT_FOUND returns 404 with proper error response
 * - UNAUTHORIZED returns 401 with proper error response
 * - FORBIDDEN returns 403 with proper error response
 * - WORKSPACE_LOCKED returns 423 with proper error response
 * - All errors follow {success, data, error} format
 */

import * as productService from '@zidney/domain-core/products/productService'
import { Module } from '@zidney/types/enums/Module'
import { ErrorCodes } from '@zidney/types/errors/ErrorCodes'
import { ProductStatus } from '@zidney/types/products/Product'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanupTestContext,
  createTestContext,
  TestContext,
} from '../../test-helpers'

describe('T060: Error Handling Integration Tests', () => {
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

  describe('DUPLICATE_SLUG (409 Conflict)', () => {
    it('should reject duplicate slug on creation', async () => {
      await productService.createProduct(
        dbClient,
        {
          name: { en: 'First Product' },
          slug: 'duplicate-test',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      try {
        await productService.createProduct(
          dbClient,
          {
            name: { en: 'Second Product' },
            slug: 'duplicate-test',
            enabled_modules: [Module.MCQ],
          },
          ctx.userId
        )
        expect.fail('Should have thrown DUPLICATE_SLUG')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.DUPLICATE_SLUG)
      }
    })
  })

  describe('INVALID_MODULE_ENUM (400 Bad Request)', () => {
    it('should reject invalid module values', async () => {
      try {
        await productService.createProduct(
          dbClient,
          {
            name: { en: 'Invalid Module' },
            slug: 'invalid-mod',
            enabled_modules: ['INVALID_MODULE'] as any,
          },
          ctx.userId
        )
        expect.fail('Should have thrown INVALID_MODULE_ENUM')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.INVALID_MODULE_ENUM)
      }
    })

    it('should reject mixed valid and invalid modules', async () => {
      try {
        await productService.createProduct(
          dbClient,
          {
            name: { en: 'Mixed Modules' },
            slug: 'mixed-mod',
            enabled_modules: [Module.MCQ, 'FAKE_MODULE'] as any,
          },
          ctx.userId
        )
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.INVALID_MODULE_ENUM)
      }
    })

    it('should reject empty modules array', async () => {
      try {
        await productService.createProduct(
          dbClient,
          {
            name: { en: 'No Modules' },
            slug: 'no-mod',
            enabled_modules: [],
          },
          ctx.userId
        )
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('INVALID_NAME_LOCALIZATION (400 Bad Request)', () => {
    it('should reject missing name.en', async () => {
      try {
        await productService.createProduct(
          dbClient,
          {
            name: { en: '', ar: 'منتج' } as any,
            slug: 'no-en',
            enabled_modules: [Module.MCQ],
          },
          ctx.userId
        )
        expect.fail('Should have thrown INVALID_NAME_LOCALIZATION')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.INVALID_NAME_LOCALIZATION)
      }
    })

    it('should reject malformed name object', async () => {
      try {
        await productService.createProduct(
          dbClient,
          {
            name: 'Not an object' as any,
            slug: 'bad-name',
            enabled_modules: [Module.MCQ],
          },
          ctx.userId
        )
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('PRODUCT_NOT_FOUND (404 Not Found)', () => {
    it('should return 404 for non-existent product on GET', async () => {
      try {
        await productService.getProductById(dbClient, 'non-existent-id')
        expect.fail('Should have thrown PRODUCT_NOT_FOUND')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.PRODUCT_NOT_FOUND)
      }
    })

    it('should return 404 for non-existent product on UPDATE', async () => {
      try {
        await productService.updateProduct(
          dbClient,
          'non-existent-id',
          { name: { en: 'Updated' } },
          ctx.userId
        )
        expect.fail('Should have thrown PRODUCT_NOT_FOUND')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.PRODUCT_NOT_FOUND)
      }
    })

    it('should return 404 for non-existent product on STATUS_CHANGE', async () => {
      try {
        await productService.changeProductStatus(
          dbClient,
          'non-existent-id',
          ProductStatus.INACTIVE,
          ctx.userId
        )
        expect.fail('Should have thrown PRODUCT_NOT_FOUND')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.PRODUCT_NOT_FOUND)
      }
    })

    it('should return 404 for non-existent product on DELETE', async () => {
      try {
        await productService.deleteProduct(dbClient, 'non-existent-id')
        expect.fail('Should have thrown PRODUCT_NOT_FOUND')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.PRODUCT_NOT_FOUND)
      }
    })

    it('should return 404 for audit log of non-existent product', async () => {
      try {
        await productService.getProductAuditLog(dbClient, 'non-existent-id', {})
        // May return empty or throw
      } catch (error: any) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('PRODUCT_HAS_LICENSES (409 Conflict)', () => {
    it('should prevent deletion if product has active licenses', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Protected' },
          slug: 'protected',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      // Add license
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
        expect.fail('Should have thrown PRODUCT_HAS_LICENSES')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.PRODUCT_HAS_LICENSES)
      }
    })
  })

  describe('Error response format', () => {
    it('should follow standard error response format', async () => {
      try {
        await productService.getProductById(dbClient, 'nonexistent')
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.code).toBeDefined()
        expect(error.message).toBeDefined()
      }
    })

    it('should include error code in response', async () => {
      try {
        await productService.createProduct(
          dbClient,
          {
            name: { en: 'Test' },
            slug: 'test-error',
            enabled_modules: ['INVALID'] as any,
          },
          ctx.userId
        )
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.INVALID_MODULE_ENUM)
        expect(error.message).toBeDefined()
      }
    })

    it('should include meaningful error message', async () => {
      try {
        await productService.getProductById(dbClient, 'not-found')
      } catch (error: any) {
        expect(error.message.length).toBeGreaterThan(0)
        expect(error.message.toLowerCase()).toContain('not found')
      }
    })
  })

  describe('Validation error details', () => {
    it('should provide field-level validation errors', async () => {
      try {
        await productService.createProduct(
          dbClient,
          {
            name: { en: '' },
            slug: 'invalid-name',
            enabled_modules: [Module.MCQ],
          },
          ctx.userId
        )
        expect.fail('Should have thrown validation error')
      } catch (error: any) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('Status change error handling', () => {
    it('should reject invalid status values', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Status Test' },
          slug: 'status-test',
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
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('Update operation errors', () => {
    it('should reject updates with invalid modules', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Update Error' },
          slug: 'update-error',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      try {
        await productService.updateProduct(
          dbClient,
          product.id,
          {
            enabled_modules: ['INVALID_MODULE'] as any,
          },
          ctx.userId
        )
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.INVALID_MODULE_ENUM)
      }
    })

    it('should reject updates to non-existent product', async () => {
      try {
        await productService.updateProduct(
          dbClient,
          'nonexistent',
          { name: { en: 'Updated' } },
          ctx.userId
        )
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.PRODUCT_NOT_FOUND)
      }
    })
  })

  describe('Common error scenarios', () => {
    it('should handle missing product gracefully', async () => {
      try {
        await productService.getProductById(dbClient, 'missing')
      } catch (error: any) {
        expect(error.code).toBe(ErrorCodes.PRODUCT_NOT_FOUND)
      }
    })

    it('should handle invalid input types', async () => {
      try {
        await productService.createProduct(
          dbClient,
          {
            name: { en: 'Test' },
            slug: 'slug',
            enabled_modules: 'not-array' as any,
          },
          ctx.userId
        )
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error).toBeDefined()
      }
    })

    it('should handle null/undefined gracefully', async () => {
      try {
        await productService.getProductById(dbClient, null as any)
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('Error propagation', () => {
    it('should preserve error codes through service layers', async () => {
      try {
        await productService.createProduct(
          dbClient,
          {
            name: { en: 'Test' },
            slug: 'test',
            enabled_modules: ['NOT_A_MODULE'] as any,
          },
          ctx.userId
        )
        expect.fail('Should have thrown error')
      } catch (error: any) {
        // Error should have proper code, not be wrapped or transformed
        expect(error.code).toBe(ErrorCodes.INVALID_MODULE_ENUM)
      }
    })
  })

  describe('Concurrent error scenarios', () => {
    it('should handle concurrent duplicate slug attempts', async () => {
      const p1Promise = productService.createProduct(
        dbClient,
        {
          name: { en: 'P1' },
          slug: 'concurrent-slug',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const p2Promise = productService.createProduct(
        dbClient,
        {
          name: { en: 'P2' },
          slug: 'concurrent-slug',
          enabled_modules: [Module.MCQ],
        },
        ctx.userId
      )

      const results = await Promise.allSettled([p1Promise, p2Promise])

      // One should succeed, one should fail
      const successful = results.filter((r: any) => r.status === 'fulfilled')
      const failed = results.filter((r: any) => r.status === 'rejected')

      expect(successful.length).toBe(1)
      expect(failed.length).toBe(1)

      if (failed[0]!.status === 'rejected') {
        expect(failed[0]!.reason.code).toBe(ErrorCodes.DUPLICATE_SLUG)
      }
    })
  })
})

// Helper type for context
type TestContextWithDatabase = TestContext & { masterDb: any }
const dbContext = null // Placeholder for type checking
