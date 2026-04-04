/**
 * Students Domain — Bulk Import Unit Tests
 *
 * File: packages/domain-core/src/students/__tests__/students.bulk-import.test.ts
 * Stage: STAGE_43_LIMIT_ENFORCEMENT
 *
 * Tests for limit enforcement, email conflict handling, division validation
 * failure, batch failure recovery, and client.release() contract.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { processBulkImport } from '../students.bulk-import'
import type { BulkImportRow } from '../students.types'

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted
// ---------------------------------------------------------------------------

vi.mock('../auth/staff-password', () => ({
  hashStaffPassword: vi.fn(async () => '$argon2id$mock-hash'),
}))

const mockCountActiveStudents = vi.fn()
const mockFindStudentByEmailForUpdate = vi.fn()
const mockInsertStudent = vi.fn()
const mockValidateDivisionActive = vi.fn()

vi.mock('../students.repository', () => ({
  countActiveStudents: (...args: unknown[]) => mockCountActiveStudents(...args),
  findStudentByEmailForUpdate: (...args: unknown[]) => mockFindStudentByEmailForUpdate(...args),
  insertStudent: (...args: unknown[]) => mockInsertStudent(...args),
  validateDivisionActive: (...args: unknown[]) => mockValidateDivisionActive(...args),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORKSPACE_ID = 'ws-00000000-0000-0000-0000-000000000001'
const DIVISION_ID = 'div-00000000-0000-0000-0000-000000000001'

function makeRow(overrides: Partial<BulkImportRow> = {}): BulkImportRow {
  return {
    email: `student${Math.random().toString(36).slice(2)}@example.com`,
    password: 'password1234',
    first_name: 'Jane',
    last_name: 'Doe',
    division_id: DIVISION_ID,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Pool / client mock factory
// ---------------------------------------------------------------------------

function makePool() {
  const client = {
    query: vi.fn(async (sql: string) => {
      const txCmds = ['BEGIN', 'BEGIN ISOLATION LEVEL SERIALIZABLE', 'COMMIT', 'ROLLBACK']
      if (txCmds.includes(sql.trim())) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    }),
    release: vi.fn(),
  }

  return {
    connect: vi.fn(async () => client),
    query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    _client: client,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processBulkImport', () => {
  afterEach(() => vi.clearAllMocks())

  it('inserts all rows when studentLimit is null (unlimited)', async () => {
    const rows = [makeRow({ email: 'a@ex.com' }), makeRow({ email: 'b@ex.com' })]
    const pool = makePool()

    mockValidateDivisionActive.mockResolvedValue(undefined)
    mockCountActiveStudents.mockResolvedValue(0)
    mockFindStudentByEmailForUpdate.mockResolvedValue(null)
    mockInsertStudent.mockResolvedValue({ id: 'new-id' })

    const result = await processBulkImport(pool as any, WORKSPACE_ID, rows, null, DIVISION_ID)

    expect(result.inserted).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
    expect(pool._client.release).toHaveBeenCalled()
  })

  it('blocks all rows when limit=0 (count-at-limit)', async () => {
    const rows = [makeRow({ email: 'x@ex.com' })]
    const pool = makePool()

    mockValidateDivisionActive.mockResolvedValue(undefined)
    mockCountActiveStudents.mockResolvedValue(0)
    mockFindStudentByEmailForUpdate.mockResolvedValue(null)

    const result = await processBulkImport(pool as any, WORKSPACE_ID, rows, 0, DIVISION_ID)

    expect(result.inserted).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors[0].code).toBe('STUDENT_LIMIT_EXCEEDED')
    expect(mockInsertStudent).not.toHaveBeenCalled()
  })

  it('blocks new rows once activeCount reaches studentLimit', async () => {
    // 3 active, limit=5 — only 2 more can be inserted from 4 rows
    const rows = Array.from({ length: 4 }, (_, i) => makeRow({ email: `r${i}@ex.com` }))
    const pool = makePool()

    mockValidateDivisionActive.mockResolvedValue(undefined)
    mockCountActiveStudents.mockResolvedValue(3)
    mockFindStudentByEmailForUpdate.mockResolvedValue(null)
    mockInsertStudent.mockResolvedValue({ id: 'new-id' })

    const result = await processBulkImport(pool as any, WORKSPACE_ID, rows, 5, DIVISION_ID)

    expect(result.inserted).toBe(2)
    expect(result.skipped).toBe(2)
    expect(result.errors.filter((e) => e.code === 'STUDENT_LIMIT_EXCEEDED')).toHaveLength(2)
  })

  it('allows all rows when activeCount is below studentLimit', async () => {
    const rows = [makeRow({ email: 'p@ex.com' }), makeRow({ email: 'q@ex.com' })]
    const pool = makePool()

    mockValidateDivisionActive.mockResolvedValue(undefined)
    mockCountActiveStudents.mockResolvedValue(3)
    mockFindStudentByEmailForUpdate.mockResolvedValue(null)
    mockInsertStudent.mockResolvedValue({ id: 'new-id' })

    const result = await processBulkImport(pool as any, WORKSPACE_ID, rows, 10, DIVISION_ID)

    expect(result.inserted).toBe(2)
    expect(result.errors).toHaveLength(0)
  })

  it('produces STUDENT_EMAIL_CONFLICT for duplicate email', async () => {
    const rows = [makeRow({ email: 'dup@ex.com' })]
    const pool = makePool()

    mockValidateDivisionActive.mockResolvedValue(undefined)
    mockCountActiveStudents.mockResolvedValue(0)
    // Email already exists
    mockFindStudentByEmailForUpdate.mockResolvedValue({ id: 'existing-id' })

    const result = await processBulkImport(pool as any, WORKSPACE_ID, rows, null, DIVISION_ID)

    expect(result.inserted).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors[0].code).toBe('STUDENT_EMAIL_CONFLICT')
    expect(result.errors[0].email).toBe('dup@ex.com')
  })

  it('marks all batch rows as STUDENT_BATCH_FAILED on unexpected DB error', async () => {
    const rows = [makeRow({ email: 'a@ex.com' }), makeRow({ email: 'b@ex.com' })]
    const pool = makePool()

    mockValidateDivisionActive.mockResolvedValue(undefined)
    // countActiveStudents throws to simulate DB failure
    mockCountActiveStudents.mockRejectedValue(new Error('connection lost'))

    const result = await processBulkImport(pool as any, WORKSPACE_ID, rows, null, DIVISION_ID)

    expect(result.inserted).toBe(0)
    expect(result.skipped).toBe(2)
    for (const err of result.errors) {
      expect(err.code).toBe('STUDENT_BATCH_FAILED')
    }
    expect(pool._client.release).toHaveBeenCalled()
  })

  it('calls client.release() exactly once per batch even after error', async () => {
    const rows = [makeRow()]
    const pool = makePool()

    mockValidateDivisionActive.mockResolvedValue(undefined)
    mockCountActiveStudents.mockRejectedValue(new Error('db down'))

    await processBulkImport(pool as any, WORKSPACE_ID, rows, null, DIVISION_ID)

    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('returns zero totals for an empty row list', async () => {
    const pool = makePool()

    const result = await processBulkImport(pool as any, WORKSPACE_ID, [], null, DIVISION_ID)

    expect(result.inserted).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
    expect(pool.connect).not.toHaveBeenCalled()
  })
})
