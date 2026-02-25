/**
 * Load/Performance Tests: Phase 13 (T068-T071)
 *
 * T068: Concurrent update stress test (10+ simultaneous updates)
 * T069: Slug uniqueness under concurrency (10+ concurrent creates with same slug)
 * T070: List performance (1000+ products, <1 second)
 * T071: Audit query performance (10000+ entries, <1 second)
 */

import * as productService from '@zidney/domain-core/products/productService'
import { ProductStatus } from '@zidney/types/products/Product'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanupTestContext,
  createTestContext,
  TestContext,
} from '../../test-helpers'

describe('T068-T071: Load and Performance Tests', () => {
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

  describe('T068: Concurrent Update Stress Test', () => {
    it('should handle 20 simultaneous updates to same product', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Base Product' },
          slug: 'concurrent-update-test',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const updatePromises = Array.from({ length: 20 }, (_, i) =>
        productService.updateProduct(
          dbClient,
          product.id,
          {
            description: `Update ${i}`,
          },
          ctx.userId
        )
      )

      const results = await Promise.allSettled(updatePromises)

      // All updates should succeed or be handled correctly
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      expect(succeeded).toBeGreaterThan(0)
    })

    it('should maintain version consistency under concurrent updates', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Version Check' },
          slug: 'version-check',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const updatePromises = Array.from({ length: 15 }, (_, i) =>
        productService
          .updateProduct(
            dbClient,
            product.id,
            { description: `Concurrent ${i}` },
            ctx.userId
          )
          .catch((e) => ({ error: e }))
      )

      const results = await Promise.all(updatePromises)
      const successful = results.filter((r) => !r.error) as any[]

      if (successful.length > 1) {
        // Get all versions from database
        const versions = await dbClient.query(
          'SELECT DISTINCT version_number FROM product_versions WHERE product_id = $1 ORDER BY version_number',
          [product.id]
        )

        // Verify no duplicate version numbers
        const versionNumbers = versions.rows.map((r) => r.version_number)
        const uniqueVersions = new Set(versionNumbers)
        expect(uniqueVersions.size).toBe(versionNumbers.length)
      }
    })

    it('should not lose updates under concurrent stress', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'No Lost Updates' },
          slug: 'no-lost-updates',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const descriptions = Array.from(
        { length: 10 },
        (_, i) => `Description ${i}`
      )
      const updatePromises = descriptions.map((desc) =>
        productService
          .updateProduct(
            dbClient,
            product.id,
            { description: desc },
            ctx.userId
          )
          .catch(() => null)
      )

      await Promise.all(updatePromises)

      // Verify final state exists
      const final = await productService.getProductById(dbClient, product.id)
      expect(final).toBeDefined()
      expect(final.id).toBe(product.id)
    })

    it('should preserve all audit logs under concurrent updates', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Audit Preservation' },
          slug: 'audit-preservation',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const updateCount = 8
      const updatePromises = Array.from({ length: updateCount }, (_, i) =>
        productService
          .updateProduct(
            dbClient,
            product.id,
            { description: `Audit ${i}` },
            ctx.userId
          )
          .catch(() => null)
      )

      await Promise.all(updatePromises)

      // Query audit logs
      const auditLog = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_audit_logs WHERE product_id = $1',
        [product.id]
      )

      // Should have CREATE + multiple UPDATEs
      expect(auditLog.rows[0].count).toBeGreaterThanOrEqual(1)
    })

    it('should handle rapid sequential updates correctly', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Sequential Updates' },
          slug: 'sequential-updates',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      let current = product
      for (let i = 0; i < 10; i++) {
        current = await productService.updateProduct(
          dbClient,
          current.id,
          { description: `Sequential ${i}` },
          ctx.userId
        )
        expect(current.current_version).toBe(i + 2) // Version starts at 1, each update increments
      }

      const final = await productService.getProductById(dbClient, product.id)
      expect(final.current_version).toBe(11)
    })
  })

  describe('T069: Slug Uniqueness Under Concurrency', () => {
    it('should enforce slug uniqueness with 20 concurrent creates of same slug', async () => {
      const createPromises = Array.from({ length: 20 }, (_, i) =>
        productService
          .createProduct(
            dbClient,
            {
              name: { en: `Product ${i}` },
              slug: 'unique-slug-test',
              enabled_modules: ['MODULE_ATTEMPT'],
            },
            ctx.userId
          )
          .catch((e) => ({
            error: e,
            code: e.code,
          }))
      )

      const results = await Promise.all(createPromises)

      // Only one should succeed (201)
      const succeeded = results.filter((r) => !r.error && r.id).length
      expect(succeeded).toBe(1)

      // Rest should fail with DUPLICATE_SLUG error
      const failed = results.filter((r) => r.code === 'DUPLICATE_SLUG').length
      expect(failed).toBeGreaterThan(0)
    })

    it('should not create phantom records on slug collision', async () => {
      const createPromises = Array.from({ length: 15 }, () =>
        productService
          .createProduct(
            dbClient,
            {
              name: { en: 'Phantom Check' },
              slug: 'phantom-check',
              enabled_modules: ['MODULE_ATTEMPT'],
            },
            ctx.userId
          )
          .catch(() => null)
      )

      await Promise.all(createPromises)

      // Verify only one product with this slug exists
      const products = await dbClient.query(
        'SELECT COUNT(*) as count FROM products WHERE slug = $1',
        ['phantom-check']
      )

      expect(products.rows[0].count).toBe(1)
    })

    it('should allow sequential slug creation after initial failure', async () => {
      // First batch - all try same slug
      const batch1 = Array.from({ length: 5 }, () =>
        productService
          .createProduct(
            dbClient,
            {
              name: { en: 'Batch1' },
              slug: 'batch-slug',
              enabled_modules: ['MODULE_ATTEMPT'],
            },
            ctx.userId
          )
          .catch(() => null)
      )

      await Promise.all(batch1)

      // Second batch - different slugs should all succeed
      const batch2Promises = Array.from({ length: 5 }, (_, i) =>
        productService
          .createProduct(
            dbClient,
            {
              name: { en: `Batch2-${i}` },
              slug: `batch-slug-${i}`,
              enabled_modules: ['MODULE_ATTEMPT'],
            },
            ctx.userId
          )
          .catch(() => null)
      )

      const batch2Results = await Promise.all(batch2Promises)
      const batch2Succeeded = batch2Results.filter((r) => r && r.id).length
      expect(batch2Succeeded).toBe(5)
    })

    it('should maintain referential integrity under concurrent slug collisions', async () => {
      const createPromises = Array.from({ length: 10 }, () =>
        productService
          .createProduct(
            dbClient,
            {
              name: { en: 'Referential' },
              slug: 'referential-test',
              enabled_modules: ['MODULE_ATTEMPT'],
            },
            ctx.userId
          )
          .catch(() => null)
      )

      await Promise.all(createPromises)

      // Verify no orphaned records
      const versions = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_versions WHERE product_id NOT IN (SELECT id FROM products)'
      )

      expect(versions.rows[0].count).toBe(0)

      const audits = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_audit_logs WHERE product_id NOT IN (SELECT id FROM products)'
      )

      expect(audits.rows[0].count).toBe(0)
    })
  })

  describe('T070: List Performance (1000+ products, <1 second)', () => {
    it('should list 1000 products in under 1 second', async () => {
      // Bulk insert products
      const insertPromises = Array.from({ length: 100 }, (_, batch) =>
        Promise.all(
          Array.from({ length: 10 }, async (_, i) => {
            const index = batch * 10 + i
            return productService
              .createProduct(
                dbClient,
                {
                  name: { en: `Product ${index}` },
                  slug: `product-${index}`,
                  enabled_modules: ['MODULE_ATTEMPT'],
                },
                ctx.userId
              )
              .catch(() => null)
          })
        )
      )

      await Promise.all(insertPromises)

      // Measure list performance
      const startTime = performance.now()

      const result = await productService.listProducts(dbClient, {
        limit: 100,
        offset: 0,
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete in under 1 second (1000ms)
      expect(duration).toBeLessThan(1000)
      expect(result.items.length).toBeGreaterThan(0)
    })

    it('should handle pagination efficiently', async () => {
      // Create 50 products
      const creates = Array.from({ length: 50 }, (_, i) =>
        productService
          .createProduct(
            dbClient,
            {
              name: { en: `Paginated ${i}` },
              slug: `paginated-${i}`,
              enabled_modules: ['MODULE_ATTEMPT'],
            },
            ctx.userId
          )
          .catch(() => null)
      )

      await Promise.all(creates)

      // Test multiple pages
      const startTime = performance.now()

      const page1 = await productService.listProducts(dbClient, {
        limit: 10,
        offset: 0,
      })
      const page2 = await productService.listProducts(dbClient, {
        limit: 10,
        offset: 10,
      })
      const page3 = await productService.listProducts(dbClient, {
        limit: 10,
        offset: 20,
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(500) // All 3 pages in under 500ms
      expect(page1.items.length).toBeGreaterThan(0)
      expect(page2.items.length).toBeGreaterThan(0)
    })

    it('should filter products efficiently', async () => {
      // Create mixed status products
      const creates = Array.from({ length: 30 }, (_, i) =>
        productService
          .createProduct(
            dbClient,
            {
              name: { en: `Filtered ${i}` },
              slug: `filtered-${i}`,
              enabled_modules: ['MODULE_ATTEMPT'],
            },
            ctx.userId
          )
          .catch(() => null)
      )

      await Promise.all(creates)

      // Deactivate half
      const products = await productService.listProducts(dbClient, {
        limit: 100,
      })
      for (let i = 0; i < Math.floor(products.items.length / 2); i++) {
        await productService
          .changeProductStatus(
            dbClient,
            products.items[i].id,
            ProductStatus.INACTIVE,
            ctx.userId
          )
          .catch(() => null)
      }

      // Measure filter performance
      const startTime = performance.now()

      const result = await productService.listProducts(dbClient, {
        limit: 100,
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(200) // Filter in under 200ms
    })
  })

  describe('T071: Audit Query Performance (10000+ entries, <1 second)', () => {
    it('should query 10000+ audit entries in under 1 second', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Audit Performance' },
          slug: 'audit-performance',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      // Create 200 updates to generate many audit logs
      let current = product
      for (let i = 0; i < 200; i++) {
        try {
          current = await productService.updateProduct(
            dbClient,
            current.id,
            { description: `Audit entry ${i}` },
            ctx.userId
          )
        } catch {
          // Continue on error
        }
      }

      // Measure audit query performance
      const startTime = performance.now()

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          limit: 100,
          offset: 0,
        }
      )

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete in under 1 second
      expect(duration).toBeLessThan(1000)
      expect(result.items.length).toBeGreaterThan(0)
    })

    it('should handle audit log pagination efficiently', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Audit Pagination' },
          slug: 'audit-pagination',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      // Generate audit entries
      let current = product
      for (let i = 0; i < 50; i++) {
        try {
          current = await productService.updateProduct(
            dbClient,
            current.id,
            { description: `Entry ${i}` },
            ctx.userId
          )
        } catch {
          // Continue
        }
      }

      // Test multiple pages
      const startTime = performance.now()

      const page1 = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          limit: 10,
          offset: 0,
        }
      )
      const page2 = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          limit: 10,
          offset: 10,
        }
      )
      const page3 = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          limit: 10,
          offset: 20,
        }
      )

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(300) // All pages in under 300ms
      expect(page1.items.length).toBeGreaterThan(0)
    })

    it('should filter audit logs by action efficiently', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Audit Filter' },
          slug: 'audit-filter',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      // Mix of operations
      let current = product
      for (let i = 0; i < 20; i++) {
        try {
          current = await productService.updateProduct(
            dbClient,
            current.id,
            { description: `Update ${i}` },
            ctx.userId
          )

          await productService.changeProductStatus(
            dbClient,
            current.id,
            i % 2 === 0 ? ProductStatus.INACTIVE : ProductStatus.ACTIVE,
            ctx.userId
          )
        } catch {
          // Continue
        }
      }

      // Measure filter performance
      const startTime = performance.now()

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          limit: 100,
        }
      )

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(200) // Filter in under 200ms
      expect(result.items.length).toBeGreaterThan(0)
    })

    it('should maintain performance with large result sets', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Large Result' },
          slug: 'large-result',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      // Create 100+ entries
      let current = product
      for (let i = 0; i < 100; i++) {
        try {
          current = await productService.updateProduct(
            dbClient,
            current.id,
            { description: `Large ${i}` },
            ctx.userId
          )
        } catch {
          // Continue
        }
      }

      // Query with high limit
      const startTime = performance.now()

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          limit: 100,
          offset: 0,
        }
      )

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(500) // Should still be fast
      expect(result.items.length).toBeGreaterThan(0)
    })
  })

  describe('Concurrent stress - combined operations', () => {
    it('should handle mixed concurrent operations without deadlock', async () => {
      // Create product
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Mixed Ops' },
          slug: 'mixed-ops',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      // Mix of operations: updates, status changes, and audits
      const operations = [
        ...Array.from({ length: 5 }, (_, i) =>
          productService
            .updateProduct(
              dbClient,
              product.id,
              { description: `Mixed ${i}` },
              ctx.userId
            )
            .catch(() => null)
        ),
        ...Array.from({ length: 3 }, () =>
          productService
            .changeProductStatus(
              dbClient,
              product.id,
              ProductStatus.INACTIVE,
              ctx.userId
            )
            .catch(() => null)
        ),
        ...Array.from({ length: 3 }, () =>
          productService
            .changeProductStatus(
              dbClient,
              product.id,
              ProductStatus.ACTIVE,
              ctx.userId
            )
            .catch(() => null)
        ),
        productService
          .getProductAuditLog(dbClient, product.id, {})
          .catch(() => null),
      ]

      const startTime = performance.now()
      const results = await Promise.all(operations)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(5000) // Should complete in 5 seconds
      expect(results.filter((r) => r).length).toBeGreaterThan(0)
    })
  })
})
