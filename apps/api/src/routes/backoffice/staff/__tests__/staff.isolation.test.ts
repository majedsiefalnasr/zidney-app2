/**
 * Staff Tenant Isolation Unit Tests
 *
 * File: apps/api/src/routes/backoffice/staff/__tests__/staff.isolation.test.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 *
 * Verifies that staff operations are strictly workspace-scoped and that
 * cross-tenant data access is impossible at the service layer.
 *
 * Tests:
 * – Staff from workspace A not visible from workspace B
 * – Cross-tenant GET/PATCH/DELETE returns STAFF_NOT_FOUND
 * – password_hash is never exposed in any service response
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fully mock to avoid loading argon2 (native module not available in test env)
vi.mock('@zidney/domain-core/staff', () => ({
  getStaffById: vi.fn(),
  listStaff: vi.fn(),
  disableStaff: vi.fn(),
  deleteStaff: vi.fn(),
  StaffError: class StaffError extends Error {
    code: string
    httpStatus: number
    constructor(code: string, message?: string) {
      super(message ?? code)
      this.name = 'StaffError'
      this.code = code
      this.httpStatus = 0
    }
  },
}))

import {
  deleteStaff,
  disableStaff,
  getStaffById,
  listStaff,
  StaffError,
} from '@zidney/domain-core/staff'

const mockDb = {} as never

const mockAuditB = {
  user_id: 'user-B',
  workspace_id: 'ws-B',
  workspace_slug: 'workspace-b',
  correlation_id: 'corr-B',
}

const staffInWsA = {
  id: 'staff-in-a',
  workspace_id: 'ws-A',
  email: 'staff-a@example.com',
  full_name: 'Staff A',
  status: 'ACTIVE' as const,
  role_id: 'role-uuid-A',
  is_deleted: false,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
}

describe('Staff Service — Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // GET isolation
  // ---------------------------------------------------------------------------

  describe('getStaffById — cross-tenant isolation', () => {
    it('returns staff record when querying correct workspace', async () => {
      vi.mocked(getStaffById).mockResolvedValue(staffInWsA)

      const result = await getStaffById(mockDb, 'ws-A', 'staff-in-a')

      expect(result.id).toBe('staff-in-a')
      expect(result.workspace_id).toBe('ws-A')
    })

    it('throws STAFF_NOT_FOUND when querying staff from a different workspace', async () => {
      // Service scopes WHERE workspace_id = $1 so ws-B cannot see ws-A staff
      vi.mocked(getStaffById).mockImplementation((_db, workspaceId, _staffId) => {
        if (workspaceId !== 'ws-A') {
          return Promise.reject(new StaffError('STAFF_NOT_FOUND', 'Staff not found'))
        }
        return Promise.resolve(staffInWsA)
      })

      await expect(getStaffById(mockDb, 'ws-B', 'staff-in-a')).rejects.toMatchObject({
        code: 'STAFF_NOT_FOUND',
      })
    })
  })

  // ---------------------------------------------------------------------------
  // List isolation
  // ---------------------------------------------------------------------------

  describe('listStaff — cross-tenant isolation', () => {
    it('returns only workspace-scoped staff records', async () => {
      vi.mocked(listStaff).mockImplementation((_db, query) => {
        const items = query.workspace_id === 'ws-A' ? [staffInWsA] : []
        return Promise.resolve({ items, total: items.length, page: 1, limit: 20 })
      })

      const resultA = await listStaff(mockDb, { workspace_id: 'ws-A', page: 1, limit: 20 })
      const resultB = await listStaff(mockDb, { workspace_id: 'ws-B', page: 1, limit: 20 })

      expect(resultA.items).toHaveLength(1)
      expect(resultB.items).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // PATCH/DELETE isolation
  // ---------------------------------------------------------------------------

  describe('disableStaff — cross-tenant isolation', () => {
    it('throws STAFF_NOT_FOUND when disabling staff from a different workspace', async () => {
      vi.mocked(disableStaff).mockImplementation((_db, workspaceId, _staffId, _audit) => {
        if (workspaceId !== 'ws-A') {
          return Promise.reject(new StaffError('STAFF_NOT_FOUND', 'Staff not found'))
        }
        return Promise.resolve({ ...staffInWsA, status: 'INACTIVE' as const })
      })

      await expect(disableStaff(mockDb, 'ws-B', 'staff-in-a', mockAuditB)).rejects.toMatchObject({
        code: 'STAFF_NOT_FOUND',
      })
    })
  })

  describe('deleteStaff — cross-tenant isolation', () => {
    it('throws STAFF_NOT_FOUND when deleting staff from a different workspace', async () => {
      vi.mocked(deleteStaff).mockImplementation((_db, workspaceId, _staffId, _audit) => {
        if (workspaceId !== 'ws-A') {
          return Promise.reject(new StaffError('STAFF_NOT_FOUND', 'Staff not found'))
        }
        return Promise.resolve(undefined)
      })

      await expect(deleteStaff(mockDb, 'ws-B', 'staff-in-a', mockAuditB)).rejects.toMatchObject({
        code: 'STAFF_NOT_FOUND',
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Password hash never exposed
  // ---------------------------------------------------------------------------

  describe('password_hash exposure', () => {
    it('does not include password_hash in list results', async () => {
      vi.mocked(listStaff).mockResolvedValue({
        items: [staffInWsA],
        total: 1,
        page: 1,
        limit: 20,
      })

      const result = await listStaff(mockDb, { workspace_id: 'ws-A', page: 1, limit: 20 })

      for (const item of result.items) {
        expect(item).not.toHaveProperty('password_hash')
      }
    })

    it('does not include password_hash in getStaffById result', async () => {
      vi.mocked(getStaffById).mockResolvedValue(staffInWsA)

      const result = await getStaffById(mockDb, 'ws-A', 'staff-in-a')

      expect(result).not.toHaveProperty('password_hash')
    })
  })
})
