/**
 * Staff Domain — Bulk Import Unit Tests
 *
 * File: packages/domain-core/src/staff/__tests__/staff.bulk-import.test.ts
 * Stage: STAGE_43_LIMIT_ENFORCEMENT
 *
 * Tests for limit enforcement, email conflict handling, batch failure
 * recovery, and client.release() contract.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { processStaffBulkImport } from '../staff.bulk-import'
import type { AuditContext, StaffBulkImportRow } from '../staff.types'

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted
// ---------------------------------------------------------------------------

vi.mock('../auth/staff-password', () => ({
  hashStaffPassword: vi.fn(async () => '$argon2id$mock-hash'),
}))

const mockCountActiveStaff = vi.fn()
const mockFindStaffByEmailForUpdate = vi.fn()
const mockInsertStaff = vi.fn()

vi.mock('../staff.repository', () => ({
  countActiveStaff: (...args: unknown[]) => mockCountActiveStaff(...args),
  findStaffByEmailForUpdate: (...args: unknown[]) => mockFindStaffByEmailForUpdate(...args),
  insertStaff: (...args: unknown[]) => mockInsertStaff(...args),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORKSPACE_ID = 'ws-00000000-0000-0000-0000-000000000001'
const NOW = new Date('2026-04-06T10:00:00Z')

const audit: AuditContext = {
  user_id: 'user-001',
  workspace_id: WORKSPACE_ID,
  workspace_slug: 'test-ws',
  correlation_id: 'corr-001',
}

function makeRow(overrides: Partial<StaffBulkImportRow> = {}): StaffBulkImportRow {
  return {
    email: `staff${Math.random().toString(36).slice(2)}@example.com`,
    name: 'Test Staff',
    password: 'password1234',
    role_id: null,
    ...overrides,
  }
}

function makeStaffRecord(email: string) {
  return {
    id: 'sf-001',
    workspace_id: WORKSPACE_ID,
    email,
    name: 'Test Staff',
    password_hash: '$argon2id$mock-hash',
    token_version: 0,
    is_active: true,
    status: 'ACTIVE',
    role_id: null,
    division_ids: [],
    failed_login_count: 0,
    locked_until: null,
    last_login: null,
    created_at: NOW,
    updated_at: NOW,
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

describe('processStaffBulkImport', () => {
  afterEach(() => vi.clearAllMocks())

  it('inserts all rows when staffLimit is null (unlimited)', async () => {
    const rows = [makeRow({ email: 'a@ex.com' }), makeRow({ email: 'b@ex.com' })]
    const pool = makePool()

    mockCountActiveStaff.mockResolvedValue(0)
    mockFindStaffByEmailForUpdate.mockResolvedValue(null)
    mockInsertStaff.mockImplementation(async (_client: unknown, input: { email: string }) =>
      makeStaffRecord(input.email)
    )

    const result = await processStaffBulkImport(pool as any, WORKSPACE_ID, rows, null, audit)

    expect(result.inserted).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
    expect(pool._client.release).toHaveBeenCalled()
  })

  it('stops inserting new rows once staffLimit is reached', async () => {
    const rows = [
      makeRow({ email: 'a@ex.com' }),
      makeRow({ email: 'b@ex.com' }),
      makeRow({ email: 'c@ex.com' }),
    ]
    const pool = makePool()

    // 2 active staff already, limit is 3 — only 1 more can be inserted
    mockCountActiveStaff.mockResolvedValue(2)
    mockFindStaffByEmailForUpdate.mockResolvedValue(null)
    mockInsertStaff.mockImplementation(async (_client: unknown, input: { email: string }) =>
      makeStaffRecord(input.email)
    )

    const result = await processStaffBulkImport(pool as any, WORKSPACE_ID, rows, 3, audit)

    expect(result.inserted).toBe(1)
    expect(result.skipped).toBe(2)
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0].code).toBe('STAFF_LIMIT_EXCEEDED')
    expect(result.errors[1].code).toBe('STAFF_LIMIT_EXCEEDED')
  })

  it('produces STAFF_EMAIL_CONFLICT error for duplicate email', async () => {
    const rows = [makeRow({ email: 'dup@ex.com' })]
    const pool = makePool()

    mockCountActiveStaff.mockResolvedValue(0)
    // Email already exists
    mockFindStaffByEmailForUpdate.mockResolvedValue(makeStaffRecord('dup@ex.com'))

    const result = await processStaffBulkImport(pool as any, WORKSPACE_ID, rows, null, audit)

    expect(result.inserted).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe('STAFF_EMAIL_CONFLICT')
    expect(result.errors[0].email).toBe('dup@ex.com')
  })

  it('marks all batch rows as STAFF_BATCH_FAILED when the batch transaction throws', async () => {
    const rows = [makeRow({ email: 'x@ex.com' }), makeRow({ email: 'y@ex.com' })]
    const pool = makePool()

    // countActiveStaff throws to simulate unexpected DB error
    mockCountActiveStaff.mockRejectedValue(new Error('connection error'))

    const result = await processStaffBulkImport(pool as any, WORKSPACE_ID, rows, null, audit)

    expect(result.inserted).toBe(0)
    expect(result.skipped).toBe(2)
    expect(result.errors).toHaveLength(2)
    for (const err of result.errors) {
      expect(err.code).toBe('STAFF_BATCH_FAILED')
    }
    expect(pool._client.release).toHaveBeenCalled()
  })

  it('calls client.release() exactly once per batch even after an error', async () => {
    const rows = [makeRow()]
    const pool = makePool()

    mockCountActiveStaff.mockRejectedValue(new Error('db down'))

    await processStaffBulkImport(pool as any, WORKSPACE_ID, rows, null, audit)

    expect(pool._client.release).toHaveBeenCalledTimes(1)
  })

  it('returns zero totals for an empty row list', async () => {
    const pool = makePool()

    const result = await processStaffBulkImport(pool as any, WORKSPACE_ID, [], null, audit)

    expect(result.inserted).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
    // No batch → connect never called
    expect(pool.connect).not.toHaveBeenCalled()
  })

  it('allows unlimited inserts when both activeCount=0 and staffLimit=null', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeRow({ email: `u${i}@ex.com` }))
    const pool = makePool()

    mockCountActiveStaff.mockResolvedValue(0)
    mockFindStaffByEmailForUpdate.mockResolvedValue(null)
    mockInsertStaff.mockImplementation(async (_client: unknown, input: { email: string }) =>
      makeStaffRecord(input.email)
    )

    const result = await processStaffBulkImport(pool as any, WORKSPACE_ID, rows, null, audit)

    expect(result.inserted).toBe(5)
    expect(result.errors).toHaveLength(0)
  })

  it('skips ALL rows when activeCount already equals staffLimit', async () => {
    const rows = [makeRow({ email: 'new@ex.com' })]
    const pool = makePool()

    // Already at limit — no room
    mockCountActiveStaff.mockResolvedValue(10)

    const result = await processStaffBulkImport(pool as any, WORKSPACE_ID, rows, 10, audit)

    expect(result.inserted).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors[0].code).toBe('STAFF_LIMIT_EXCEEDED')
    // insertStaff should never be called
    expect(mockInsertStaff).not.toHaveBeenCalled()
  })
})
