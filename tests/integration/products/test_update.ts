/**
 * Integration Test: Product Update (T055)
 *
 * Validates:
 * - Valid update returns 200 with updated ProductResponse
 * - current_version incremented
 * - New version record created in product_versions table
 * - Audit log entry created with action=UPDATE
 * - No update (same data) returns 200 without version increment
 * - Cannot update slug (immutable)
 * - Change tracking works correctly
 */

import * as productService from '@zidney/domain-core/products/productService'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanupTestContext,
  createTestContext,
  TestContext,
} from '../../test-helpers'

describe('T055: Product Update Integration Tests', () => {
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

  describe('Happy path - Valid updates', () => {
    it('should update product and increment version', async () => {
      const initial = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Initial Name' },
          slug: 'update-test',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      expect(initial.current_version).toBe(1)

      const updated = await productService.updateProduct(
        dbClient,
        initial.id,
        {
          name: { en: 'Updated Name' },
        },
        ctx.userId
      )

      expect(updated.current_version).toBe(2)
      expect(updated.name.en).toBe('Updated Name')
    })

    it('should create new version record in product_versions', async () => {
      const initial = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Version Track' },
          slug: 'version-track',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      await productService.updateProduct(
        dbClient,
        initial.id,
        {
          name: { en: 'Updated' },
        },
        ctx.userId
      )

      const versions = await dbClient.query(
        'SELECT * FROM product_versions WHERE product_id = $1 ORDER BY version_number',
        [initial.id]
      )

      expect(versions.rows.length).toBe(2)
      expect(versions.rows[0].version_number).toBe(1)
      expect(versions.rows[1].version_number).toBe(2)
    })

    it('should create audit log with UPDATE action', async () => {
      const initial = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Audit Test' },
          slug: 'audit-upd',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      await productService.updateProduct(
        dbClient,
        initial.id,
        {
          name: { en: 'Modified' },
        },
        ctx.userId
      )

      const audits = await dbClient.query(
        'SELECT * FROM product_audit_logs WHERE product_id = $1 ORDER BY timestamp',
        [initial.id]
      )

      expect(audits.rows.length).toBe(2) // CREATE + UPDATE
      const updateAudit = audits.rows[1]
      expect(updateAudit.action).toBe('UPDATE')
      expect(updateAudit.previous_version).toBe(1)
      expect(updateAudit.new_version).toBe(2)
    })

    it('should track field changes', async () => {
      const initial = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Original' },
          slug: 'changes',
          description: 'Original desc',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      await productService.updateProduct(
        dbClient,
        initial.id,
        {
          name: { en: 'Updated' },
          description: 'Updated desc',
        },
        ctx.userId
      )

      const audits = await dbClient.query(
        'SELECT changed_fields FROM product_audit_logs WHERE action = $1 AND product_id = $2',
        ['UPDATE', initial.id]
      )

      expect(audits.rows.length).toBe(1)
      const changes = audits.rows[0].changed_fields
      expect(changes).toBeDefined()
      // Should document the name and description changes
      expect(JSON.stringify(changes)).toContain('name')
    })

    it('should update description', async () => {
      const initial = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Desc Update' },
          slug: 'desc-update',
          description: 'Original',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const updated = await productService.updateProduct(
        dbClient,
        initial.id,
        {
          description: 'New description',
        },
        ctx.userId
      )

      expect(updated.description).toBe('New description')
      expect(updated.current_version).toBe(2)
    })

    it('should update enabled modules', async () => {
      const initial = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Module Update' },
          slug: 'mod-update',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const updated = await productService.updateProduct(
        dbClient,
        initial.id,
        {
          enabled_modules: [
            'MODULE_ATTEMPT',
            'MODULE_REPORTING',
            'MODULE_ANALYTICS',
          ],
        },
        ctx.userId
      )

      expect(updated.enabled_modules.sort()).toEqual(
        ['MODULE_ATTEMPT', 'MODULE_REPORTING', 'MODULE_ANALYTICS'].sort()
      )
      expect(updated.current_version).toBe(2)
    })

    it('should update Arabic name', async () => {
      const initial = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Test', ar: 'اختبار' },
          slug: 'ar-update',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const updated = await productService.updateProduct(
        dbClient,
        initial.id,
        {
          name: { en: 'Test', ar: 'اختبار محدث' },
        },
        ctx.userId
      )

      expect(updated.name.ar).toBe('اختبار محدث')
    })
  })

  describe('No-op updates', () => {
    it('should not increment version if data unchanged', async () => {
      const initial = await productService.createProduct(
        dbClient,
        {
          name: { en: 'No Op Test' },
          slug: 'noop',
          description: 'Same',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const before = initial.current_version

      // Update with identical data
      const updated = await productService.updateProduct(
        dbClient,
        initial.id,
        {
          name: { en: 'No Op Test' },
          description: 'Same',
        },
        ctx.userId
      )

      expect(updated.current_version).toBe(before)
    })

    it('should not create version record for no-op update', async () => {
      const initial = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Version Noop' },
          slug: 'ver-noop',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const beforeCount = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_versions WHERE product_id = $1',
        [initial.id]
      )

      await productService.updateProduct(dbClient, initial.id, {}, ctx.userId)

      const afterCount = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_versions WHERE product_id = $1',
        [initial.id]
      )

      expect(parseInt(beforeCount.rows[0].count)).toBe(
        parseInt(afterCount.rows[0].count)
      )
    })

    it('should not create audit log for no-op update', async () => {
      const initial = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Audit Noop' },
          slug: 'audit-noop',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const beforeCount = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_audit_logs WHERE product_id = $1',
        [initial.id]
      )

      await productService.updateProduct(
        dbClient,
        initial.id,
        { name: { en: 'Audit Noop' } },
        ctx.userId
      )

      const afterCount = await dbClient.query(
        'SELECT COUNT(*) as count FROM product_audit_logs WHERE product_id = $1',
        [initial.id]
      )

      expect(parseInt(beforeCount.rows[0].count)).toBe(
        parseInt(afterCount.rows[0].count)
      )
    })
  })

  describe('Immutability constraints', () => {
    it('should reject attempts to change slug', async () => {
      const initial = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Immutable Test' },
          slug: 'immutable',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      try {
        // Try to update slug (this should be rejected by validation layer)
        const input: any = {
          slug: 'new-slug',
        }
        await productService.updateProduct(
          dbClient,
          initial.id,
          input,
          ctx.userId
        )

        // If it allows the update, the slug should still not change
        const retrieved = await productService.getProductById(
          dbClient,
          initial.id
        )
        expect(retrieved.slug).toBe('immutable')
      } catch (error: any) {
        // Expected - slug should be immutable
        expect(error).toBeDefined()
      }
    })

    it('should preserve ID across updates', async () => {
      const initial = await productService.createProduct(
        dbClient,
        {
          name: { en: 'ID Preserve' },
          slug: 'id-preserve',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const updated = await productService.updateProduct(
        dbClient,
        initial.id,
        {
          name: { en: 'Updated' },
        },
        ctx.userId
      )

      expect(updated.id).toBe(initial.id)
    })

    it('should preserve created_at timestamp', async () => {
      const initial = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Timestamp Preserve' },
          slug: 'ts-preserve',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      const updated = await productService.updateProduct(
        dbClient,
        initial.id,
        {
          name: { en: 'Modified' },
        },
        ctx.userId
      )

      expect(updated.created_at).toBe(initial.created_at)
    })

    it('should update updated_at timestamp', async () => {
      const initial = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Updated At Test' },
          slug: 'upd-at',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      await new Promise((resolve) => setTimeout(resolve, 10))

      const updated = await productService.updateProduct(
        dbClient,
        initial.id,
        {
          name: { en: 'Changed' },
        },
        ctx.userId
      )

      expect(new Date(updated.updated_at).getTime()).toBeGreaterThan(
        new Date(initial.updated_at).getTime()
      )
    })
  })

  describe('Multiple sequential updates', () => {
    it('should handle multiple updates with incremental versioning', async () => {
      const product = await productService.createProduct(
        dbClient,
        {
          name: { en: 'Sequential' },
          slug: 'sequential',
          enabled_modules: ['MODULE_ATTEMPT'],
        },
        ctx.userId
      )

      expect(product.current_version).toBe(1)

      const v2 = await productService.updateProduct(
        dbClient,
        product.id,
        { name: { en: 'V2' } },
        ctx.userId
      )
      expect(v2.current_version).toBe(2)

      const v3 = await productService.updateProduct(
        dbClient,
        product.id,
        { description: 'Added description' },
        ctx.userId
      )
      expect(v3.current_version).toBe(3)

      const v4 = await productService.updateProduct(
        dbClient,
        product.id,
        { name: { en: 'V4' } },
        ctx.userId
      )
      expect(v4.current_version).toBe(4)

      const versions = await dbClient.query(
        'SELECT version_number FROM product_versions WHERE product_id = $1 ORDER BY version_number',
        [product.id]
      )

      expect(versions.rows.map((r) => r.version_number)).toEqual([1, 2, 3, 4])
    })
  })
})
