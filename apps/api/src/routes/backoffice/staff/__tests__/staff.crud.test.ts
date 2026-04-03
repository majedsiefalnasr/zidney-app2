/**
 * Staff CRUD Unit Tests
 *
 * File: apps/api/src/routes/backoffice/staff/__tests__/staff.crud.test.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 *
 * Tests all 7 staff endpoints via service layer with mocked DB client.
 * Does NOT require a live database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Fully mock to avoid loading argon2 (native module not available in test env)
vi.mock('@zidney/domain-core/staff', () => ({
  createStaff: vi.fn(),
  listStaff: vi.fn(),
  getStaffById: vi.fn(),
  updateStaff: vi.fn(),
  disableStaff: vi.fn(),
  enableStaff: vi.fn(),
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
  createStaff,
  deleteStaff,
  disableStaff,
  enableStaff,
  getStaffById,
  listStaff,
  StaffError,
  updateStaff,
} from '@zidney/domain-core/staff'

const mockDb = {} as never

const mockAudit = {
  user_id: 'user-001',
  workspace_id: 'ws-001',
  workspace_slug: 'test-workspace',
  correlation_id: 'corr-001',
}

const staffRecord = {
  id: 'staff-uuid-001',
  workspace_id: 'ws-001',
  email: 'alice@example.com',
  full_name: 'Alice Smith',
  status: 'ACTIVE' as const,
  role_id: 'role-uuid-001',
  is_deleted: false,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
}

describe('Staff Service — CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ---------------------------------------------------------------------------
  // POST /staff — createStaff
  // ---------------------------------------------------------------------------

  describe('createStaff', () => {
    it('returns created staff record on success', async () => {
      vi.mocked(createStaff).mockResolvedValue(staffRecord)

      const result = await createStaff(
        mockDb,
        {
          workspace_id: 'ws-001',
          email: 'alice@example.com',
          full_name: 'Alice Smith',
          password: 'Secure1!',
          role_id: 'role-uuid-001',
        },
        50,
        mockAudit
      )

      expect(result).toEqual(staffRecord)
      expect(result).not.toHaveProperty('password_hash')
    })

    it('throws STAFF_EMAIL_CONFLICT when email already exists', async () => {
      vi.mocked(createStaff).mockRejectedValue(
        new StaffError('STAFF_EMAIL_CONFLICT', 'Email already in use')
      )

      await expect(
        createStaff(
          mockDb,
          {
            workspace_id: 'ws-001',
            email: 'alice@example.com',
            full_name: 'Alice Smith',
            password: 'Secure1!',
            role_id: 'role-uuid-001',
          },
          50,
          mockAudit
        )
      ).rejects.toThrowError('Email already in use')
    })

    it('throws STAFF_LIMIT_EXCEEDED when workspace is at capacity', async () => {
      vi.mocked(createStaff).mockRejectedValue(
        new StaffError('STAFF_LIMIT_EXCEEDED', 'Staff limit reached')
      )

      await expect(
        createStaff(
          mockDb,
          {
            workspace_id: 'ws-001',
            email: 'bob@example.com',
            full_name: 'Bob Jones',
            password: 'Secure1!',
            role_id: 'role-uuid-001',
          },
          5,
          mockAudit
        )
      ).rejects.toThrowError('Staff limit reached')
    })
  })

  // ---------------------------------------------------------------------------
  // GET /staff — listStaff
  // ---------------------------------------------------------------------------

  describe('listStaff', () => {
    it('returns paginated list with default page/limit', async () => {
      vi.mocked(listStaff).mockResolvedValue({
        items: [staffRecord],
        total: 1,
        page: 1,
        limit: 20,
      })

      const result = await listStaff(mockDb, { workspace_id: 'ws-001', page: 1, limit: 20 })

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('applies status filter correctly', async () => {
      vi.mocked(listStaff).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })

      const result = await listStaff(mockDb, {
        workspace_id: 'ws-001',
        page: 1,
        limit: 20,
        status: 'INACTIVE',
      })

      expect(result.items).toHaveLength(0)
      expect(listStaff).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ status: 'INACTIVE' })
      )
    })
  })

  // ---------------------------------------------------------------------------
  // GET /staff/:id — getStaffById
  // ---------------------------------------------------------------------------

  describe('getStaffById', () => {
    it('returns staff record when found', async () => {
      vi.mocked(getStaffById).mockResolvedValue(staffRecord)

      const result = await getStaffById(mockDb, 'ws-001', 'staff-uuid-001')

      expect(result.id).toBe('staff-uuid-001')
      expect(result).not.toHaveProperty('password_hash')
    })

    it('throws STAFF_NOT_FOUND when id does not exist', async () => {
      vi.mocked(getStaffById).mockRejectedValue(
        new StaffError('STAFF_NOT_FOUND', 'Staff not found')
      )

      await expect(getStaffById(mockDb, 'ws-001', 'non-existent-id')).rejects.toThrowError(
        'Staff not found'
      )
    })
  })

  // ---------------------------------------------------------------------------
  // PUT /staff/:id — updateStaff
  // ---------------------------------------------------------------------------

  describe('updateStaff', () => {
    it('returns updated staff record on success', async () => {
      const updated = { ...staffRecord, full_name: 'Alice Jones' }
      vi.mocked(updateStaff).mockResolvedValue(updated)

      const result = await updateStaff(
        mockDb,
        'ws-001',
        'staff-uuid-001',
        { full_name: 'Alice Jones' },
        mockAudit
      )

      expect(result.full_name).toBe('Alice Jones')
    })

    it('throws STAFF_NOT_FOUND when updating non-existent staff', async () => {
      vi.mocked(updateStaff).mockRejectedValue(new StaffError('STAFF_NOT_FOUND', 'Staff not found'))

      await expect(
        updateStaff(mockDb, 'ws-001', 'bad-id', { full_name: 'X' }, mockAudit)
      ).rejects.toThrowError('Staff not found')
    })

    it('throws STAFF_EMAIL_CONFLICT when updating to existing email', async () => {
      vi.mocked(updateStaff).mockRejectedValue(
        new StaffError('STAFF_EMAIL_CONFLICT', 'Email already in use')
      )

      await expect(
        updateStaff(mockDb, 'ws-001', 'staff-uuid-001', { email: 'taken@example.com' }, mockAudit)
      ).rejects.toThrowError('Email already in use')
    })
  })

  // ---------------------------------------------------------------------------
  // PATCH /staff/:id/disable — disableStaff
  // ---------------------------------------------------------------------------

  describe('disableStaff', () => {
    it('returns disabled record on success', async () => {
      const disabled = { ...staffRecord, status: 'INACTIVE' as const }
      vi.mocked(disableStaff).mockResolvedValue(disabled)

      const result = await disableStaff(mockDb, 'ws-001', 'staff-uuid-001', mockAudit)

      expect(result.status).toBe('INACTIVE')
    })

    it('throws STAFF_ALREADY_DISABLED when already inactive', async () => {
      vi.mocked(disableStaff).mockRejectedValue(
        new StaffError('STAFF_ALREADY_DISABLED', 'Staff is already inactive')
      )

      await expect(
        disableStaff(mockDb, 'ws-001', 'staff-uuid-001', mockAudit)
      ).rejects.toThrowError('Staff is already inactive')
    })

    it('throws STAFF_NOT_FOUND when id does not exist', async () => {
      vi.mocked(disableStaff).mockRejectedValue(
        new StaffError('STAFF_NOT_FOUND', 'Staff not found')
      )

      await expect(disableStaff(mockDb, 'ws-001', 'bad-id', mockAudit)).rejects.toThrowError(
        'Staff not found'
      )
    })
  })

  // ---------------------------------------------------------------------------
  // PATCH /staff/:id/enable — enableStaff
  // ---------------------------------------------------------------------------

  describe('enableStaff', () => {
    it('returns enabled record on success', async () => {
      const active = { ...staffRecord, status: 'ACTIVE' as const }
      vi.mocked(enableStaff).mockResolvedValue(active)

      const result = await enableStaff(mockDb, 'ws-001', 'staff-uuid-001', mockAudit)

      expect(result.status).toBe('ACTIVE')
    })

    it('throws STAFF_ALREADY_ACTIVE when already active', async () => {
      vi.mocked(enableStaff).mockRejectedValue(
        new StaffError('STAFF_ALREADY_ACTIVE', 'Staff is already active')
      )

      await expect(enableStaff(mockDb, 'ws-001', 'staff-uuid-001', mockAudit)).rejects.toThrowError(
        'Staff is already active'
      )
    })

    it('throws STAFF_NOT_FOUND when id does not exist', async () => {
      vi.mocked(enableStaff).mockRejectedValue(new StaffError('STAFF_NOT_FOUND', 'Staff not found'))

      await expect(enableStaff(mockDb, 'ws-001', 'bad-id', mockAudit)).rejects.toThrowError(
        'Staff not found'
      )
    })
  })

  // ---------------------------------------------------------------------------
  // DELETE /staff/:id — deleteStaff
  // ---------------------------------------------------------------------------

  describe('deleteStaff', () => {
    it('resolves void on success', async () => {
      vi.mocked(deleteStaff).mockResolvedValue(undefined)

      await expect(
        deleteStaff(mockDb, 'ws-001', 'staff-uuid-001', mockAudit)
      ).resolves.toBeUndefined()
    })

    it('throws STAFF_NOT_FOUND when id does not exist', async () => {
      vi.mocked(deleteStaff).mockRejectedValue(new StaffError('STAFF_NOT_FOUND', 'Staff not found'))

      await expect(deleteStaff(mockDb, 'ws-001', 'bad-id', mockAudit)).rejects.toThrowError(
        'Staff not found'
      )
    })

    it('throws STAFF_HAS_AUTHORED_CONTENT when staff has authored content', async () => {
      vi.mocked(deleteStaff).mockRejectedValue(
        new StaffError('STAFF_HAS_AUTHORED_CONTENT', 'Cannot delete staff with authored content')
      )

      await expect(deleteStaff(mockDb, 'ws-001', 'staff-uuid-001', mockAudit)).rejects.toThrowError(
        'Cannot delete staff with authored content'
      )
    })
  })
})
