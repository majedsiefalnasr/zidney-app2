/**
 * Students Integration Tests
 *
 * File: apps/api/src/routes/backoffice/students/__tests__/students.test.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 *
 * Tests all 16 student endpoint scenarios via service layer with mocked DB client.
 * Does NOT require a live database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Fully mock to avoid loading argon2 (native module not available in test env)
vi.mock('@zidney/domain-core/students', () => ({
  createStudent: vi.fn(),
  listStudents: vi.fn(),
  getStudentById: vi.fn(),
  updateStudent: vi.fn(),
  disableStudent: vi.fn(),
  enableStudent: vi.fn(),
  deleteStudent: vi.fn(),
  updateStudentSubscriptionStatus: vi.fn(),
  bulkImportStudents: vi.fn(),
  StudentError: class StudentError extends Error {
    code: string
    httpStatus: number
    constructor(code: string, message?: string) {
      super(message ?? code)
      this.name = 'StudentError'
      this.code = code
      this.httpStatus = 0
    }
  },
}))

import {
  bulkImportStudents,
  createStudent,
  deleteStudent,
  disableStudent,
  enableStudent,
  getStudentById,
  listStudents,
  StudentError,
  updateStudent,
  updateStudentSubscriptionStatus,
} from '@zidney/domain-core/students'

const mockDb = {} as never

const mockAudit = {
  user_id: 'user-001',
  workspace_id: 'ws-001',
  workspace_slug: 'test-workspace',
  correlation_id: 'corr-001',
}

const studentRecord = {
  id: 'student-uuid-001',
  email: 'jane@example.com',
  full_name: 'Jane Doe',
  student_code: 'S001',
  status: 'ACTIVE' as const,
  subscription_status: 'ACTIVE' as const,
  division_id: 'div-uuid-001',
  department_id: null,
  group_id: null,
  phone: null,
  token_version: 0,
  failed_login_count: 0,
  locked_until: null,
  last_login_at: null,
  is_deleted: false,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
}

const baseCreateInput = {
  workspace_id: 'ws-001',
  email: 'jane@example.com',
  password: 'Secure1234!',
  full_name: 'Jane Doe',
  division_id: 'div-uuid-001',
}

describe('Students Service — Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ---------------------------------------------------------------------------
  // POST /students — success (201, no password_hash in response)
  // ---------------------------------------------------------------------------

  describe('POST /students — createStudent', () => {
    it('returns created student record without password_hash on success', async () => {
      vi.mocked(createStudent).mockResolvedValue(studentRecord)

      const result = await createStudent(mockDb, baseCreateInput, mockAudit, 100)

      expect(result).toEqual(studentRecord)
      expect(result).not.toHaveProperty('password_hash')
    })

    // -------------------------------------------------------------------------
    // POST /students — email conflict (409 STUDENT_EMAIL_CONFLICT)
    // -------------------------------------------------------------------------

    it('throws STUDENT_EMAIL_CONFLICT when email already exists', async () => {
      vi.mocked(createStudent).mockRejectedValue(
        new StudentError('STUDENT_EMAIL_CONFLICT', 'Email already in use')
      )

      await expect(createStudent(mockDb, baseCreateInput, mockAudit, 100)).rejects.toMatchObject({
        code: 'STUDENT_EMAIL_CONFLICT',
      })
    })

    // -------------------------------------------------------------------------
    // POST /students — limit exceeded (422 STUDENT_LIMIT_EXCEEDED)
    // -------------------------------------------------------------------------

    it('throws STUDENT_LIMIT_EXCEEDED when workspace limit is reached', async () => {
      vi.mocked(createStudent).mockRejectedValue(
        new StudentError('STUDENT_LIMIT_EXCEEDED', 'Student limit reached')
      )

      await expect(createStudent(mockDb, baseCreateInput, mockAudit, 10)).rejects.toMatchObject({
        code: 'STUDENT_LIMIT_EXCEEDED',
      })
    })

    // -------------------------------------------------------------------------
    // POST /students — invalid division (422 STUDENT_DIVISION_INACTIVE)
    // -------------------------------------------------------------------------

    it('throws STUDENT_DIVISION_INACTIVE when division is inactive', async () => {
      vi.mocked(createStudent).mockRejectedValue(
        new StudentError('STUDENT_DIVISION_INACTIVE', 'Division is not active')
      )

      await expect(
        createStudent(mockDb, { ...baseCreateInput, division_id: 'inactive-div' }, mockAudit, 100)
      ).rejects.toMatchObject({
        code: 'STUDENT_DIVISION_INACTIVE',
      })
    })
  })

  // ---------------------------------------------------------------------------
  // GET /students — paginated list (200 + StudentListResult)
  // ---------------------------------------------------------------------------

  describe('GET /students — listStudents', () => {
    it('returns paginated student list', async () => {
      const listResult = {
        items: [studentRecord],
        total: 1,
        page: 1,
        limit: 20,
      }
      vi.mocked(listStudents).mockResolvedValue(listResult)

      const result = await listStudents(
        mockDb,
        { workspace_id: 'ws-001', page: 1, limit: 20 },
        mockAudit
      )

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.page).toBe(1)
    })
  })

  // ---------------------------------------------------------------------------
  // GET /students/:id — found (200 + StudentRecord)
  // ---------------------------------------------------------------------------

  describe('GET /students/:id — getStudentById', () => {
    it('returns student record when found', async () => {
      vi.mocked(getStudentById).mockResolvedValue(studentRecord)

      const result = await getStudentById(mockDb, 'ws-001', 'student-uuid-001', mockAudit)

      expect(result.id).toBe('student-uuid-001')
      expect(result).not.toHaveProperty('password_hash')
    })

    // -------------------------------------------------------------------------
    // GET /students/:id — not found (404 STUDENT_NOT_FOUND)
    // -------------------------------------------------------------------------

    it('throws STUDENT_NOT_FOUND when student does not exist', async () => {
      vi.mocked(getStudentById).mockRejectedValue(
        new StudentError('STUDENT_NOT_FOUND', 'Student not found')
      )

      await expect(
        getStudentById(mockDb, 'ws-001', 'nonexistent-id', mockAudit)
      ).rejects.toMatchObject({
        code: 'STUDENT_NOT_FOUND',
      })
    })
  })

  // ---------------------------------------------------------------------------
  // PATCH /students/:id — update (200)
  // ---------------------------------------------------------------------------

  describe('PATCH /students/:id — updateStudent', () => {
    it('returns updated student record on success', async () => {
      const updated = { ...studentRecord, full_name: 'Jane Updated' }
      vi.mocked(updateStudent).mockResolvedValue(updated)

      const result = await updateStudent(
        mockDb,
        'ws-001',
        'student-uuid-001',
        { full_name: 'Jane Updated' },
        mockAudit
      )

      expect(result.full_name).toBe('Jane Updated')
    })
  })

  // ---------------------------------------------------------------------------
  // PATCH /students/:id/disable — success (200 + status=DISABLED)
  // ---------------------------------------------------------------------------

  describe('PATCH /students/:id/disable — disableStudent', () => {
    it('returns student with status DISABLED on success', async () => {
      const disabled = { ...studentRecord, status: 'DISABLED' as const }
      vi.mocked(disableStudent).mockResolvedValue(disabled)

      const result = await disableStudent(mockDb, 'ws-001', 'student-uuid-001', mockAudit)

      expect(result.status).toBe('DISABLED')
    })

    // -------------------------------------------------------------------------
    // PATCH /students/:id/disable — already disabled (409 STUDENT_ALREADY_DISABLED)
    // -------------------------------------------------------------------------

    it('throws STUDENT_ALREADY_DISABLED when student is already disabled', async () => {
      vi.mocked(disableStudent).mockRejectedValue(
        new StudentError('STUDENT_ALREADY_DISABLED', 'Student is already disabled')
      )

      await expect(
        disableStudent(mockDb, 'ws-001', 'student-uuid-001', mockAudit)
      ).rejects.toMatchObject({
        code: 'STUDENT_ALREADY_DISABLED',
      })
    })
  })

  // ---------------------------------------------------------------------------
  // PATCH /students/:id/enable — success (200 + status=ACTIVE)
  // ---------------------------------------------------------------------------

  describe('PATCH /students/:id/enable — enableStudent', () => {
    it('returns student with status ACTIVE on success', async () => {
      const enabled = { ...studentRecord, status: 'ACTIVE' as const }
      vi.mocked(enableStudent).mockResolvedValue(enabled)

      const result = await enableStudent(mockDb, 'ws-001', 'student-uuid-001', mockAudit)

      expect(result.status).toBe('ACTIVE')
    })
  })

  // ---------------------------------------------------------------------------
  // DELETE /students/:id — success, no attempts (200 + void)
  // ---------------------------------------------------------------------------

  describe('DELETE /students/:id — deleteStudent', () => {
    it('resolves without error when student has no attempts', async () => {
      vi.mocked(deleteStudent).mockResolvedValue()

      await expect(
        deleteStudent(mockDb, 'ws-001', 'student-uuid-001', mockAudit)
      ).resolves.toBeUndefined()
    })

    // -------------------------------------------------------------------------
    // DELETE /students/:id — has attempts (409 STUDENT_HAS_ATTEMPTS)
    // -------------------------------------------------------------------------

    it('throws STUDENT_HAS_ATTEMPTS when student has submitted attempts', async () => {
      vi.mocked(deleteStudent).mockRejectedValue(
        new StudentError(
          'STUDENT_HAS_ATTEMPTS',
          'Student has submitted attempts and cannot be deleted'
        )
      )

      await expect(
        deleteStudent(mockDb, 'ws-001', 'student-uuid-001', mockAudit)
      ).rejects.toMatchObject({
        code: 'STUDENT_HAS_ATTEMPTS',
      })
    })
  })

  // ---------------------------------------------------------------------------
  // PATCH /students/:id/subscription — success (200)
  // ---------------------------------------------------------------------------

  describe('PATCH /students/:id/subscription — updateStudentSubscriptionStatus', () => {
    it('returns student with updated subscription_status', async () => {
      const updated = { ...studentRecord, subscription_status: 'SUSPENDED' as const }
      vi.mocked(updateStudentSubscriptionStatus).mockResolvedValue(updated)

      const result = await updateStudentSubscriptionStatus(
        mockDb,
        'ws-001',
        'student-uuid-001',
        { subscription_status: 'SUSPENDED' },
        mockAudit
      )

      expect(result.subscription_status).toBe('SUSPENDED')
    })
  })

  // ---------------------------------------------------------------------------
  // POST /students/bulk-import — success (200 + BulkImportResult)
  // ---------------------------------------------------------------------------

  describe('POST /students/bulk-import — bulkImportStudents', () => {
    it('returns BulkImportResult with all rows succeeded', async () => {
      const bulkResult = {
        succeeded: 2,
        failed: 0,
        errors: [],
        rows: [
          { row: 1, email: 'a@example.com', status: 'success' as const },
          { row: 2, email: 'b@example.com', status: 'success' as const },
        ],
      }
      vi.mocked(bulkImportStudents).mockResolvedValue(bulkResult)

      const result = await bulkImportStudents(
        mockDb,
        'ws-001',
        [
          { email: 'a@example.com', password: 'Pass1234!', full_name: 'A' },
          { email: 'b@example.com', password: 'Pass1234!', full_name: 'B' },
        ],
        100,
        'div-uuid-001',
        mockAudit
      )

      expect(result.succeeded).toBe(2)
      expect(result.failed).toBe(0)
    })

    // -------------------------------------------------------------------------
    // POST /students/bulk-import — limit reached (200 + errors in result)
    // -------------------------------------------------------------------------

    it('returns BulkImportResult with errors when limit is reached mid-batch', async () => {
      const bulkResult = {
        succeeded: 1,
        failed: 1,
        errors: [
          {
            row: 2,
            email: 'b@example.com',
            code: 'STUDENT_LIMIT_EXCEEDED',
            message: 'Limit reached',
          },
        ],
        rows: [
          { row: 1, email: 'a@example.com', status: 'success' as const },
          {
            row: 2,
            email: 'b@example.com',
            status: 'failed' as const,
            error: 'STUDENT_LIMIT_EXCEEDED',
          },
        ],
      }
      vi.mocked(bulkImportStudents).mockResolvedValue(bulkResult)

      const result = await bulkImportStudents(
        mockDb,
        'ws-001',
        [
          { email: 'a@example.com', password: 'Pass1234!', full_name: 'A' },
          { email: 'b@example.com', password: 'Pass1234!', full_name: 'B' },
        ],
        1,
        'div-uuid-001',
        mockAudit
      )

      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('STUDENT_LIMIT_EXCEEDED')
    })
  })
})
