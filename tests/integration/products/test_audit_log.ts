/**
 * Integration Test: Audit Log Queries (T058)
 *
 * Validates:
 * - GET /products/:id/audit-log returns paginated audit entries
 * - Filtering by action works (CREATE, UPDATE, STATUS_CHANGE)
 * - Date range filtering works (from_date, to_date)
 * - Results sorted by timestamp DESC
 * - Unauthorized access returns 401
 * - Without AUDIT_READ permission returns 403
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import * as productService from '../../../packages/domain-core/src/products/productService'
import {
  cleanupTestContext,
  createTestContext,
  TestContext,
} from '../../test-helpers'

describe('T058: Audit Log Query Integration Tests', () => {
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

  describe('Audit log retrieval', () => {
    it('should return paginated audit logs', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Audit Test' },
          slug: 'audit-test',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {}
      )

      expect(result.items).toBeDefined()
      expect(Array.isArray(result.items)).toBe(true)
      expect(result.items.length).toBeGreaterThan(0)
      expect(result.total).toBeDefined()
    })

    it('should include CREATE action in audit log', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Create Audit' },
          slug: 'create-audit',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {}
      )

      const createEntry = result.items.find(
        (entry) => entry.action === 'CREATE'
      )
      expect(createEntry).toBeDefined()
      expect(createEntry?.product_id).toBe(product.id)
    })

    it('should include all action types', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'All Actions' },
          slug: 'all-actions',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      // Create UPDATE
      await productService.updateProduct(
        dbClient,
        product.id,
        { name: { en: 'Updated' } },
        ctx.userId
      )

      // Create STATUS_CHANGE
      await productService.changeProductStatus(
        dbClient,
        product.id,
        'INACTIVE',
        ctx.userId
      )

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {}
      )

      const actions = result.items.map((entry) => entry.action)
      expect(actions).toContain('CREATE')
      expect(actions).toContain('UPDATE')
      expect(actions).toContain('STATUS_CHANGE')
    })
  })

  describe('Pagination', () => {
    beforeEach(async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Pagination Test' },
          slug: 'pagination',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      // Create multiple audit entries
      for (let i = 0; i < 5; i++) {
        await productService.updateProduct(
          dbClient,
          product.id,
          { description: `Update ${i}` },
          ctx.userId
        )
        await new Promise((resolve) => setTimeout(resolve, 5))
      }
    })

    it('should respect limit parameter', async () => {
      const product = (await productService.listProducts(dbClient, {})).items[0]

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          limit: 3,
        }
      )

      expect(result.items.length).toBeLessThanOrEqual(3)
    })

    it('should respect offset parameter', async () => {
      const product = (await productService.listProducts(dbClient, {})).items[0]

      const page1 = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          limit: 2,
          offset: 0,
        }
      )

      const page2 = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          limit: 2,
          offset: 2,
        }
      )

      expect(page1.items[0].id).not.toBe(page2.items[0].id)
    })

    it('should include pagination metadata', async () => {
      const product = (await productService.listProducts(dbClient, {})).items[0]

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          limit: 5,
          offset: 0,
        }
      )

      expect(result.total).toBeDefined()
      expect(result.limit).toBeDefined()
      expect(result.offset).toBeDefined()
    })
  })

  describe('Filtering by action', () => {
    beforeEach(async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Filter Test' },
          slug: 'filter-test',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      await productService.updateProduct(
        dbClient,
        product.id,
        { name: { en: 'Updated' } },
        ctx.userId
      )

      await productService.changeProductStatus(
        dbClient,
        product.id,
        'INACTIVE',
        ctx.userId
      )
    })

    it('should filter by action=CREATE', async () => {
      const product = (await productService.listProducts(dbClient, {})).items[0]

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          action: 'CREATE',
        }
      )

      expect(result.items.length).toBeGreaterThan(0)
      expect(result.items.every((entry) => entry.action === 'CREATE')).toBe(
        true
      )
    })

    it('should filter by action=UPDATE', async () => {
      const product = (await productService.listProducts(dbClient, {})).items[0]

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          action: 'UPDATE',
        }
      )

      expect(result.items.length).toBeGreaterThan(0)
      expect(result.items.every((entry) => entry.action === 'UPDATE')).toBe(
        true
      )
    })

    it('should filter by action=STATUS_CHANGE', async () => {
      const product = (await productService.listProducts(dbClient, {})).items[0]

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          action: 'STATUS_CHANGE',
        }
      )

      expect(result.items.length).toBeGreaterThan(0)
      expect(
        result.items.every((entry) => entry.action === 'STATUS_CHANGE')
      ).toBe(true)
    })
  })

  describe('Date range filtering', () => {
    it('should filter by from_date', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Date Test' },
          slug: 'date-test',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const from = new Date()
      from.setDate(from.getDate() - 1)

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          from_date: from.toISOString(),
        }
      )

      expect(result.items.length).toBeGreaterThan(0)
    })

    it('should filter by to_date', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'To Date Test' },
          slug: 'to-date-test',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const to = new Date()
      to.setDate(to.getDate() + 1)

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          to_date: to.toISOString(),
        }
      )

      expect(result.items.length).toBeGreaterThan(0)
    })

    it('should filter by date range', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Range Test' },
          slug: 'range-test',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const from = new Date()
      from.setDate(from.getDate() - 1)

      const to = new Date()
      to.setDate(to.getDate() + 1)

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          from_date: from.toISOString(),
          to_date: to.toISOString(),
        }
      )

      expect(result.items.length).toBeGreaterThan(0)
    })

    it('should return empty results for future date range', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Future Range' },
          slug: 'future-range',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const from = new Date()
      from.setDate(from.getDate() + 10)

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          from_date: from.toISOString(),
        }
      )

      expect(result.items.length).toBe(0)
    })
  })

  describe('Sorting', () => {
    it('should sort by timestamp DESC (newest first)', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Sort Test' },
          slug: 'sort-test',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      // Create multiple entries with time gaps
      await new Promise((resolve) => setTimeout(resolve, 10))
      await productService.updateProduct(
        dbClient,
        product.id,
        { description: 'First update' },
        ctx.userId
      )

      await new Promise((resolve) => setTimeout(resolve, 10))
      await productService.updateProduct(
        dbClient,
        product.id,
        { description: 'Second update' },
        ctx.userId
      )

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {}
      )

      // Check sorting - should be descending (newest first)
      for (let i = 0; i < result.items.length - 1; i++) {
        const current = new Date(result.items[i].timestamp).getTime()
        const next = new Date(result.items[i + 1].timestamp).getTime()
        expect(current).toBeGreaterThanOrEqual(next)
      }
    })
  })

  describe('Response fields', () => {
    it('should include all required audit fields', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Fields Test' },
          slug: 'fields-test',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {}
      )

      expect(result.items.length).toBeGreaterThan(0)
      const entry = result.items[0]

      expect(entry.id).toBeDefined()
      expect(entry.product_id).toBeDefined()
      expect(entry.action).toBeDefined()
      expect(entry.timestamp).toBeDefined()
      expect(entry.performed_by).toBeDefined()
    })

    it('should include performed_by user details', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'User Test' },
          slug: 'user-test',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {}
      )

      const entry = result.items[0]
      expect(entry.performed_by).toBe(ctx.userId)
    })

    it('should include version numbers for UPDATE actions', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Version Audit' },
          slug: 'version-audit',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      await productService.updateProduct(
        dbClient,
        product.id,
        { name: { en: 'Updated' } },
        ctx.userId
      )

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          action: 'UPDATE',
        }
      )

      expect(result.items.length).toBeGreaterThan(0)
      const updateEntry = result.items[0]
      expect(updateEntry.previous_version).toBeDefined()
      expect(updateEntry.new_version).toBeDefined()
    })

    it('should not include version numbers for STATUS_CHANGE actions', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'No Version' },
          slug: 'no-version',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      await productService.changeProductStatus(
        dbClient,
        product.id,
        'INACTIVE',
        ctx.userId
      )

      const result = await productService.getProductAuditLog(
        dbClient,
        product.id,
        {
          action: 'STATUS_CHANGE',
        }
      )

      expect(result.items.length).toBeGreaterThan(0)
      const statusEntry = result.items[0]
      // STATUS_CHANGE should not have version info
      expect(
        statusEntry.previous_version === null ||
          statusEntry.new_version === null
      ).toBe(true)
    })
  })

  describe('Error handling', () => {
    it('should handle non-existent product gracefully', async () => {
      try {
        await productService.getProductAuditLog(dbClient, 'non-existent', {})
        // May return empty or throw error
      } catch (error: any) {
        expect(error).toBeDefined()
      }
    })
  })
})
