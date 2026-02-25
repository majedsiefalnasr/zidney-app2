/**
 * License Middleware Unit Tests
 *
 * File: tests/unit/middleware/license.middleware.test.ts
 * Task: T067
 *
 * Tests license enforcement middleware logic.
 * Covers status checks, soft-lock expiration, and not-found handling.
 */

import createLicenseMiddleware from '@zidney/app/api/middleware/license.middleware'
import { LicenseStatus } from '@zidney/domain-core/licenses/types'
import type { Logger } from '@zidney/logger'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type LicenseRow = {
  id: string
  workspace_slug: string
  status: LicenseStatus
  soft_lock_until: string | null
  deleted_at: string | null
}

type QueryResult = { rows: any[] }

describe('License Middleware', () => {
  const licensesBySlug = new Map<string, LicenseRow>()
  let middleware: any
  let mockLogger: Logger
  let mockDb: { query: ReturnType<typeof vi.fn> }
  let mockContext: any

  const setLicense = (overrides: Partial<LicenseRow>) => {
    const license: LicenseRow = {
      id: 'license-1',
      workspace_slug: 'test-workspace',
      status: LicenseStatus.ACTIVE,
      soft_lock_until: null,
      deleted_at: null,
      ...overrides,
    }
    licensesBySlug.set(license.workspace_slug, license)
  }

  beforeEach(() => {
    licensesBySlug.clear()

    mockDb = {
      query: vi.fn(
        async (sqlText: string, params?: unknown[]): Promise<QueryResult> => {
          const normalized = sqlText.replace(/\s+/g, ' ').trim().toLowerCase()

          if (normalized.startsWith('select * from licenses')) {
            const workspaceSlug = String(params?.[0] ?? '')
            const license = licensesBySlug.get(workspaceSlug)
            if (!license || license.deleted_at) {
              return { rows: [] }
            }
            return { rows: [license] }
          }

          if (
            normalized.startsWith(
              'update licenses set status = $1, archived_at = now(), updated_at = now()'
            )
          ) {
            const [newStatus, licenseId, expectedStatus] = params || []
            const target = Array.from(licensesBySlug.values()).find(
              (row) => row.id === licenseId
            )

            if (
              !target ||
              target.status !== expectedStatus ||
              !target.soft_lock_until ||
              new Date(target.soft_lock_until) >= new Date()
            ) {
              return { rows: [] }
            }

            target.status = newStatus as LicenseStatus
            return { rows: [target] }
          }

          return { rows: [] }
        }
      ),
    }

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as any

    middleware = createLicenseMiddleware(mockDb as any, mockLogger)

    mockContext = {
      req: {
        header: vi.fn(),
        query: vi.fn(),
      },
      json: vi.fn((data: any, status: number) => ({
        success: data.success,
        status,
      })),
      correlation_id: 'test-correlation-123',
      workspaceSlug: 'test-workspace',
    }
    mockContext.status = vi.fn(() => mockContext)
  })

  describe('License Status Validation', () => {
    beforeEach(() => {
      mockContext.req.header.mockReturnValue('test-workspace')
    })

    it('should allow ACTIVE license', async () => {
      setLicense({ status: LicenseStatus.ACTIVE })
      const next = vi.fn().mockResolvedValue(undefined)

      await middleware(mockContext, next)

      expect(next).toHaveBeenCalledTimes(1)
      expect(mockContext.license).toBeDefined()
      expect(mockContext.license.status).toBe(LicenseStatus.ACTIVE)
    })

    it('should block SOFT_LOCKED license (403)', async () => {
      setLicense({
        status: LicenseStatus.SOFT_LOCKED,
        soft_lock_until: new Date(Date.now() + 86_400_000).toISOString(),
      })

      await middleware(mockContext, vi.fn().mockResolvedValue(undefined))

      expect(mockContext.status).toHaveBeenCalledWith(403)
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'LICENSE_SOFT_LOCKED',
          }),
        })
      )
    })

    it('should block PENDING_PROVISION license (503)', async () => {
      setLicense({ status: LicenseStatus.PENDING_PROVISION })

      await middleware(mockContext, vi.fn().mockResolvedValue(undefined))

      expect(mockContext.status).toHaveBeenCalledWith(503)
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'LICENSE_PENDING_PROVISION',
          }),
        })
      )
    })

    it('should block ARCHIVED license (403)', async () => {
      setLicense({ status: LicenseStatus.ARCHIVED })

      await middleware(mockContext, vi.fn().mockResolvedValue(undefined))

      expect(mockContext.status).toHaveBeenCalledWith(403)
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'LICENSE_ARCHIVED',
          }),
        })
      )
    })

    it('should return 404 for DELETED license', async () => {
      setLicense({ status: LicenseStatus.DELETED })

      await middleware(mockContext, vi.fn().mockResolvedValue(undefined))

      expect(mockContext.status).toHaveBeenCalledWith(404)
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'LICENSE_NOT_FOUND',
          }),
        })
      )
    })
  })

  describe('Soft-lock Expiration (T041)', () => {
    beforeEach(() => {
      mockContext.req.header.mockReturnValue('test-workspace')
    })

    it('should auto-transition expired SOFT_LOCKED to ARCHIVED', async () => {
      setLicense({
        status: LicenseStatus.SOFT_LOCKED,
        soft_lock_until: new Date(Date.now() - 1_000).toISOString(),
      })

      await middleware(mockContext, vi.fn().mockResolvedValue(undefined))

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'LICENSE_ARCHIVED',
          }),
        }),
        403
      )
      expect(licensesBySlug.get('test-workspace')?.status).toBe(
        LicenseStatus.ARCHIVED
      )
    })
  })

  describe('License Not Found', () => {
    beforeEach(() => {
      mockContext.req.header.mockReturnValue('non-existent-workspace')
    })

    it('should return 404 if license not found', async () => {
      await middleware(mockContext, vi.fn().mockResolvedValue(undefined))

      expect(mockContext.status).toHaveBeenCalledWith(404)
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'LICENSE_NOT_FOUND',
          }),
        })
      )
    })
  })
})
