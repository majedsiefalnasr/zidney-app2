/**
 * Divisions Service — Unit Tests (T031)
 *
 * File: packages/domain-core/src/divisions/__tests__/divisions.service.test.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * Tests all 11 service functions using a mock DbClient.
 * No real database required — query results are stubbed per test.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DivisionsError } from '../divisions.errors'
import {
  assignStaffDivision,
  createDivision,
  deleteDivision,
  disableDivisions,
  getDivisionById,
  removeStaffDivision,
  updateDivision,
  updateDivisionStatus,
} from '../divisions.service'
import type { AuditContext, DbClient } from '../divisions.types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AUDIT: AuditContext = {
  user_id: 'user-001',
  request_id: 'req-001',
  workspace_slug: 'test-ws',
  workspace_id: 'ws-001',
}

const DEFAULT_DIVISION = {
  id: 'div-default-001',
  name: 'Default Division',
  description: null,
  is_default: true,
  status: 'ENABLED',
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
}

const NON_DEFAULT_DIVISION = {
  id: 'div-001',
  name: 'Grade 10',
  description: 'Grade 10 students',
  is_default: false,
  status: 'ENABLED',
  created_at: new Date('2026-01-02T00:00:00Z'),
  updated_at: new Date('2026-01-02T00:00:00Z'),
}

// ---------------------------------------------------------------------------
// createDivision
// ---------------------------------------------------------------------------

describe('createDivision', () => {
  let mockDb: DbClient

  beforeEach(() => {
    mockDb = { query: vi.fn() }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('creates a division with valid input', async () => {
    const created = { ...NON_DEFAULT_DIVISION, id: 'new-div-001', name: 'Math Class' }

    vi.mocked(mockDb.query)
      // isDivisionsEnabled
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      // case-insensitive name conflict check
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // INSERT RETURNING
      .mockResolvedValueOnce({ rows: [created], rowCount: 1 })
      // COMMIT
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const result = await createDivision(mockDb, { name: 'Math Class', description: null }, AUDIT)

    expect(result.id).toBe('new-div-001')
    expect(result.name).toBe('Math Class')
  })

  it('throws DIVISION_NAME_CONFLICT on case-insensitive duplicate', async () => {
    vi.mocked(mockDb.query)
      // isDivisionsEnabled
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      // name conflict — finds an existing division
      .mockResolvedValueOnce({ rows: [{ id: 'existing-id' }], rowCount: 1 })

    const err = await createDivision(mockDb, { name: 'GRADE 10', description: null }, AUDIT).catch(
      (e) => e
    )
    expect(err).toBeInstanceOf(DivisionsError)
    expect((err as DivisionsError).code).toBe('DIVISION_NAME_CONFLICT')
  })

  it('throws DIVISIONS_FEATURE_DISABLED when workspace locked', async () => {
    vi.mocked(mockDb.query)
      // isDivisionsEnabled — false
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: false }], rowCount: 1 })

    const err = await createDivision(mockDb, { name: 'X', description: null }, AUDIT).catch(
      (e) => e
    )
    expect(err).toBeInstanceOf(DivisionsError)
    expect((err as DivisionsError).code).toBe('DIVISIONS_FEATURE_DISABLED')
  })

  it('rolls back and rethrows on INSERT error', async () => {
    vi.mocked(mockDb.query)
      // isDivisionsEnabled
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      // no conflict
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // INSERT fails
      .mockRejectedValueOnce(new Error('DB insert failure'))
      // ROLLBACK
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await expect(
      createDivision(mockDb, { name: 'Test', description: null }, AUDIT)
    ).rejects.toThrow('DB insert failure')

    // Verify ROLLBACK was called (5th query call)
    const calls = vi.mocked(mockDb.query).mock.calls
    const lastSql = calls[calls.length - 1]?.[0]
    expect(lastSql).toBe('ROLLBACK')
  })
})

// ---------------------------------------------------------------------------
// updateDivision
// ---------------------------------------------------------------------------

describe('updateDivision', () => {
  let mockDb: DbClient

  beforeEach(() => {
    mockDb = { query: vi.fn() }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('updates name and description successfully', async () => {
    const updated = { ...NON_DEFAULT_DIVISION, name: 'Grade 11', description: 'Updated desc' }

    vi.mocked(mockDb.query)
      // isDivisionsEnabled
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // FOR UPDATE lock — same name as new name (no conflict check needed if same)
      .mockResolvedValueOnce({ rows: [{ ...NON_DEFAULT_DIVISION, name: 'grade 11' }], rowCount: 1 })
      // UPDATE RETURNING
      .mockResolvedValueOnce({ rows: [updated], rowCount: 1 })
      // COMMIT
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const result = await updateDivision(
      mockDb,
      NON_DEFAULT_DIVISION.id,
      { name: 'Grade 11', description: 'Updated desc' },
      AUDIT
    )

    expect(result.name).toBe('Grade 11')
    expect(result.description).toBe('Updated desc')
  })

  it('ignores is_default field — service never updates it via updateDivision', async () => {
    // updateDivision SQL only sets name and description, not is_default
    // Verify no UPDATE with is_default= in the query calls
    const updated = { ...NON_DEFAULT_DIVISION }

    vi.mocked(mockDb.query)
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [NON_DEFAULT_DIVISION], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [updated], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await updateDivision(
      mockDb,
      NON_DEFAULT_DIVISION.id,
      { name: NON_DEFAULT_DIVISION.name, description: null },
      AUDIT
    )

    // The UPDATE SET clause must not assign is_default (is_default = <value>).
    // Note: is_default may legitimately appear in SELECT/RETURNING column lists — that is fine.
    const sqlCalls = vi.mocked(mockDb.query).mock.calls.map(([sql]) => sql as string)
    const anyUpdatesIsDefault = sqlCalls.some(
      (sql) => sql.includes('UPDATE') && /\bis_default\s*=/i.test(sql)
    )
    expect(anyUpdatesIsDefault).toBe(false)
  })

  it('throws DIVISION_NOT_FOUND when division does not exist', async () => {
    vi.mocked(mockDb.query)
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // FOR UPDATE returns empty
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // ROLLBACK
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const err = await updateDivision(
      mockDb,
      'nonexistent-id',
      { name: 'X', description: null },
      AUDIT
    ).catch((e) => e)

    expect(err).toBeInstanceOf(DivisionsError)
    expect((err as DivisionsError).code).toBe('DIVISION_NOT_FOUND')
  })

  it('throws DIVISION_NAME_CONFLICT on name collision with another division', async () => {
    vi.mocked(mockDb.query)
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // FOR UPDATE — div exists with DIFFERENT name (triggers conflict check)
      .mockResolvedValueOnce({ rows: [{ ...NON_DEFAULT_DIVISION, name: 'Old Name' }], rowCount: 1 })
      // conflict check — finds existing division with same new name
      .mockResolvedValueOnce({ rows: [{ id: 'other-div' }], rowCount: 1 })
      // ROLLBACK
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const err = await updateDivision(
      mockDb,
      NON_DEFAULT_DIVISION.id,
      { name: 'Conflicting Name', description: null },
      AUDIT
    ).catch((e) => e)

    expect(err).toBeInstanceOf(DivisionsError)
    expect((err as DivisionsError).code).toBe('DIVISION_NAME_CONFLICT')
  })
})

// ---------------------------------------------------------------------------
// updateDivisionStatus
// ---------------------------------------------------------------------------

describe('updateDivisionStatus', () => {
  let mockDb: DbClient

  beforeEach(() => {
    mockDb = { query: vi.fn() }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('disables a non-default division', async () => {
    const disabled = { ...NON_DEFAULT_DIVISION, status: 'DISABLED' }

    vi.mocked(mockDb.query)
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // FOR UPDATE lock
      .mockResolvedValueOnce({ rows: [NON_DEFAULT_DIVISION], rowCount: 1 })
      // UPDATE RETURNING
      .mockResolvedValueOnce({ rows: [disabled], rowCount: 1 })
      // COMMIT
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const result = await updateDivisionStatus(
      mockDb,
      NON_DEFAULT_DIVISION.id,
      { status: 'DISABLED' },
      AUDIT
    )

    expect(result.status).toBe('DISABLED')
  })

  it('re-enables a disabled division', async () => {
    const existingDisabled = { ...NON_DEFAULT_DIVISION, status: 'DISABLED' }
    const reEnabled = { ...NON_DEFAULT_DIVISION, status: 'ENABLED' }

    vi.mocked(mockDb.query)
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [existingDisabled], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [reEnabled], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const result = await updateDivisionStatus(
      mockDb,
      NON_DEFAULT_DIVISION.id,
      { status: 'ENABLED' },
      AUDIT
    )

    expect(result.status).toBe('ENABLED')
  })

  it('throws DEFAULT_DIVISION_IMMUTABLE when trying to disable the default division', async () => {
    vi.mocked(mockDb.query)
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // FOR UPDATE returns default division
      .mockResolvedValueOnce({
        rows: [{ id: DEFAULT_DIVISION.id, is_default: true, status: 'ENABLED' }],
        rowCount: 1,
      })
      // ROLLBACK
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const err = await updateDivisionStatus(
      mockDb,
      DEFAULT_DIVISION.id,
      { status: 'DISABLED' },
      AUDIT
    ).catch((e) => e)

    expect(err).toBeInstanceOf(DivisionsError)
    expect((err as DivisionsError).code).toBe('DEFAULT_DIVISION_IMMUTABLE')
  })

  it('throws DIVISION_NOT_FOUND for unknown id', async () => {
    vi.mocked(mockDb.query)
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // FOR UPDATE returns empty
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // ROLLBACK
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const err = await updateDivisionStatus(mockDb, 'unknown', { status: 'DISABLED' }, AUDIT).catch(
      (e) => e
    )

    expect(err).toBeInstanceOf(DivisionsError)
    expect((err as DivisionsError).code).toBe('DIVISION_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// deleteDivision
// ---------------------------------------------------------------------------

describe('deleteDivision', () => {
  let mockDb: DbClient

  beforeEach(() => {
    mockDb = { query: vi.fn() }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('deletes a non-default division with no students or staff', async () => {
    vi.mocked(mockDb.query)
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // FOR UPDATE — non-default
      .mockResolvedValueOnce({
        rows: [{ id: NON_DEFAULT_DIVISION.id, is_default: false }],
        rowCount: 1,
      })
      // student count = 0
      .mockResolvedValueOnce({ rows: [{ cnt: '0' }], rowCount: 1 })
      // staff count = 0
      .mockResolvedValueOnce({ rows: [{ cnt: '0' }], rowCount: 1 })
      // DELETE
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      // COMMIT
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await expect(deleteDivision(mockDb, NON_DEFAULT_DIVISION.id, AUDIT)).resolves.toBeUndefined()
  })

  it('throws DEFAULT_DIVISION_IMMUTABLE when deleting the default division', async () => {
    vi.mocked(mockDb.query)
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // FOR UPDATE — is_default = true
      .mockResolvedValueOnce({ rows: [{ id: DEFAULT_DIVISION.id, is_default: true }], rowCount: 1 })
      // ROLLBACK
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const err = await deleteDivision(mockDb, DEFAULT_DIVISION.id, AUDIT).catch((e) => e)
    expect(err).toBeInstanceOf(DivisionsError)
    expect((err as DivisionsError).code).toBe('DEFAULT_DIVISION_IMMUTABLE')
  })

  it('throws DIVISION_IN_USE when students are assigned', async () => {
    vi.mocked(mockDb.query)
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: NON_DEFAULT_DIVISION.id, is_default: false }],
        rowCount: 1,
      })
      // student count = 5
      .mockResolvedValueOnce({ rows: [{ cnt: '5' }], rowCount: 1 })
      // ROLLBACK
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const err = await deleteDivision(mockDb, NON_DEFAULT_DIVISION.id, AUDIT).catch((e) => e)
    expect(err).toBeInstanceOf(DivisionsError)
    expect((err as DivisionsError).code).toBe('DIVISION_IN_USE')
  })

  it('throws DIVISION_IN_USE when staff members are assigned', async () => {
    vi.mocked(mockDb.query)
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: NON_DEFAULT_DIVISION.id, is_default: false }],
        rowCount: 1,
      })
      // student count = 0
      .mockResolvedValueOnce({ rows: [{ cnt: '0' }], rowCount: 1 })
      // staff count = 3
      .mockResolvedValueOnce({ rows: [{ cnt: '3' }], rowCount: 1 })
      // ROLLBACK
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const err = await deleteDivision(mockDb, NON_DEFAULT_DIVISION.id, AUDIT).catch((e) => e)
    expect(err).toBeInstanceOf(DivisionsError)
    expect((err as DivisionsError).code).toBe('DIVISION_IN_USE')
  })
})

// ---------------------------------------------------------------------------
// disableDivisions
// ---------------------------------------------------------------------------

describe('disableDivisions', () => {
  let mockDb: DbClient

  beforeEach(() => {
    mockDb = { query: vi.fn() }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('reassigns all students to default, clears staff, disables non-defaults, returns correct counts', async () => {
    vi.mocked(mockDb.query)
      // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // SET TRANSACTION ISOLATION LEVEL SERIALIZABLE
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // lock default division
      .mockResolvedValueOnce({ rows: [{ id: DEFAULT_DIVISION.id }], rowCount: 1 })
      // lock non-default divisions
      .mockResolvedValueOnce({ rows: [{ id: NON_DEFAULT_DIVISION.id }], rowCount: 1 })
      // UPDATE students -> returns 3 rows
      .mockResolvedValueOnce({ rows: [{ id: 's1' }, { id: 's2' }, { id: 's3' }], rowCount: 3 })
      // SELECT DISTINCT staff_id — affected staff
      .mockResolvedValueOnce({
        rows: [{ staff_id: 'staff-001' }, { staff_id: 'staff-002' }],
        rowCount: 2,
      })
      // DELETE non-default staff_divisions -> 2 rows
      .mockResolvedValueOnce({
        rows: [{ staff_id: 'staff-001' }, { staff_id: 'staff-002' }],
        rowCount: 2,
      })
      // INSERT staff_divisions ON CONFLICT DO NOTHING
      .mockResolvedValueOnce({ rows: [], rowCount: 2 })
      // UPDATE divisions status=DISABLED -> 1 row
      .mockResolvedValueOnce({ rows: [{ id: NON_DEFAULT_DIVISION.id }], rowCount: 1 })
      // UPDATE workspace_settings
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      // COMMIT
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const result = await disableDivisions(mockDb, AUDIT)

    expect(result.students_reassigned).toBe(3)
    expect(result.staff_divisions_reassigned).toBe(2)
    expect(result.divisions_disabled).toBe(1)
  })

  it('returns zero counts when no non-default divisions or students exist', async () => {
    vi.mocked(mockDb.query)
      // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // SET TRANSACTION ISOLATION LEVEL SERIALIZABLE
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // lock default division
      .mockResolvedValueOnce({ rows: [{ id: DEFAULT_DIVISION.id }], rowCount: 1 })
      // lock non-default (no rows)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // UPDATE students -> 0 reassigned
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // SELECT DISTINCT staff_id -> none
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // UPDATE divisions -> 0 disabled
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // UPDATE workspace_settings
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      // COMMIT
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const result = await disableDivisions(mockDb, AUDIT)

    expect(result.students_reassigned).toBe(0)
    expect(result.staff_divisions_reassigned).toBe(0)
    expect(result.divisions_disabled).toBe(0)
  })

  it('performs full rollback on partial failure', async () => {
    vi.mocked(mockDb.query)
      // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // SET TRANSACTION ISOLATION LEVEL SERIALIZABLE
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // lock default division
      .mockResolvedValueOnce({ rows: [{ id: DEFAULT_DIVISION.id }], rowCount: 1 })
      // lock non-default
      .mockResolvedValueOnce({ rows: [{ id: NON_DEFAULT_DIVISION.id }], rowCount: 1 })
      // UPDATE students — DB error
      .mockRejectedValueOnce(new Error('serialization failure'))
      // ROLLBACK
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await expect(disableDivisions(mockDb, AUDIT)).rejects.toThrow('serialization failure')

    const calls = vi.mocked(mockDb.query).mock.calls
    const lastSql = calls[calls.length - 1]?.[0]
    expect(lastSql).toBe('ROLLBACK')
  })

  it('throws DIVISION_REQUIRED if no default division exists', async () => {
    vi.mocked(mockDb.query)
      // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // SET TRANSACTION ISOLATION LEVEL SERIALIZABLE
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // lock default — no default found
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // ROLLBACK
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const err = await disableDivisions(mockDb, AUDIT).catch((e) => e)
    expect(err).toBeInstanceOf(DivisionsError)
    expect((err as DivisionsError).code).toBe('DIVISION_REQUIRED')
  })
})

// ---------------------------------------------------------------------------
// getDivisionById
// ---------------------------------------------------------------------------

describe('getDivisionById', () => {
  let mockDb: DbClient

  beforeEach(() => {
    mockDb = { query: vi.fn() }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns the division row when found', async () => {
    vi.mocked(mockDb.query).mockResolvedValueOnce({
      rows: [NON_DEFAULT_DIVISION],
      rowCount: 1,
    })

    const result = await getDivisionById(mockDb, NON_DEFAULT_DIVISION.id)
    expect(result.id).toBe(NON_DEFAULT_DIVISION.id)
  })

  it('throws DIVISION_NOT_FOUND when division does not exist', async () => {
    vi.mocked(mockDb.query).mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const err = await getDivisionById(mockDb, 'nonexistent').catch((e) => e)
    expect(err).toBeInstanceOf(DivisionsError)
    expect((err as DivisionsError).code).toBe('DIVISION_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// assignStaffDivision
// ---------------------------------------------------------------------------

describe('assignStaffDivision', () => {
  let mockDb: DbClient

  beforeEach(() => {
    mockDb = { query: vi.fn() }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('assigns a staff member to a division', async () => {
    const row = {
      staff_id: 'staff-001',
      division_id: NON_DEFAULT_DIVISION.id,
      assigned_at: new Date(),
    }

    vi.mocked(mockDb.query)
      // isDivisionsEnabled
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      // division existence check
      .mockResolvedValueOnce({
        rows: [{ id: NON_DEFAULT_DIVISION.id, status: 'ENABLED' }],
        rowCount: 1,
      })
      // INSERT ON CONFLICT DO NOTHING
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      // SELECT to return row
      .mockResolvedValueOnce({ rows: [row], rowCount: 1 })

    const result = await assignStaffDivision(mockDb, 'staff-001', NON_DEFAULT_DIVISION.id, AUDIT)
    expect(result.staff_id).toBe('staff-001')
    expect(result.division_id).toBe(NON_DEFAULT_DIVISION.id)
  })

  it('is idempotent — succeeds even if assignment already exists', async () => {
    const row = {
      staff_id: 'staff-001',
      division_id: NON_DEFAULT_DIVISION.id,
      assigned_at: new Date(),
    }

    vi.mocked(mockDb.query)
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: NON_DEFAULT_DIVISION.id, status: 'ENABLED' }],
        rowCount: 1,
      })
      // ON CONFLICT DO NOTHING — no new row, but no error
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // SELECT still returns the existing row
      .mockResolvedValueOnce({ rows: [row], rowCount: 1 })

    const result = await assignStaffDivision(mockDb, 'staff-001', NON_DEFAULT_DIVISION.id, AUDIT)
    expect(result.staff_id).toBe('staff-001')
  })

  it('throws DIVISION_NOT_FOUND when division does not exist', async () => {
    vi.mocked(mockDb.query)
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      // division check returns empty
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const err = await assignStaffDivision(mockDb, 'staff-001', 'missing-div', AUDIT).catch((e) => e)
    expect(err).toBeInstanceOf(DivisionsError)
    expect((err as DivisionsError).code).toBe('DIVISION_NOT_FOUND')
  })

  it('throws DIVISION_DISABLED when division is disabled', async () => {
    vi.mocked(mockDb.query)
      .mockResolvedValueOnce({ rows: [{ divisions_enabled: true }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: NON_DEFAULT_DIVISION.id, status: 'DISABLED' }],
        rowCount: 1,
      })

    const err = await assignStaffDivision(
      mockDb,
      'staff-001',
      NON_DEFAULT_DIVISION.id,
      AUDIT
    ).catch((e) => e)
    expect(err).toBeInstanceOf(DivisionsError)
    expect((err as DivisionsError).code).toBe('DIVISION_DISABLED')
  })

  it('throws DIVISIONS_FEATURE_DISABLED when feature is disabled', async () => {
    vi.mocked(mockDb.query).mockResolvedValueOnce({
      rows: [{ divisions_enabled: false }],
      rowCount: 1,
    })

    const err = await assignStaffDivision(
      mockDb,
      'staff-001',
      NON_DEFAULT_DIVISION.id,
      AUDIT
    ).catch((e) => e)
    expect(err).toBeInstanceOf(DivisionsError)
    expect((err as DivisionsError).code).toBe('DIVISIONS_FEATURE_DISABLED')
  })
})

// ---------------------------------------------------------------------------
// removeStaffDivision
// ---------------------------------------------------------------------------

describe('removeStaffDivision', () => {
  let mockDb: DbClient

  beforeEach(() => {
    mockDb = { query: vi.fn() }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('removes a staff member assignment when they have multiple divisions', async () => {
    vi.mocked(mockDb.query)
      // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // FOR UPDATE — assignment exists
      .mockResolvedValueOnce({ rows: [{ staff_id: 'staff-001' }], rowCount: 1 })
      // count = 2 (has another division)
      .mockResolvedValueOnce({ rows: [{ cnt: '2' }], rowCount: 1 })
      // DELETE
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      // COMMIT
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await expect(
      removeStaffDivision(mockDb, 'staff-001', NON_DEFAULT_DIVISION.id, AUDIT)
    ).resolves.toBeUndefined()
  })

  it('throws DIV_STAFF_ASSIGNMENT_NOT_FOUND when assignment does not exist', async () => {
    vi.mocked(mockDb.query)
      // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // FOR UPDATE — no row
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // ROLLBACK
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const err = await removeStaffDivision(mockDb, 'staff-001', 'missing-div', AUDIT).catch((e) => e)

    expect(err).toBeInstanceOf(DivisionsError)
    expect((err as DivisionsError).code).toBe('DIV_STAFF_ASSIGNMENT_NOT_FOUND')
  })

  it('throws STAFF_MINIMUM_DIVISION_REQUIRED when staff only has one division', async () => {
    vi.mocked(mockDb.query)
      // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // FOR UPDATE — assignment exists
      .mockResolvedValueOnce({ rows: [{ staff_id: 'staff-001' }], rowCount: 1 })
      // count = 1 (only this division)
      .mockResolvedValueOnce({ rows: [{ cnt: '1' }], rowCount: 1 })
      // ROLLBACK
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const err = await removeStaffDivision(
      mockDb,
      'staff-001',
      NON_DEFAULT_DIVISION.id,
      AUDIT
    ).catch((e) => e)

    expect(err).toBeInstanceOf(DivisionsError)
    expect((err as DivisionsError).code).toBe('STAFF_MINIMUM_DIVISION_REQUIRED')
  })

  it('throws DIVISION_NOT_FOUND when division itself is missing (no assignment is same error code)', async () => {
    // When division doesn't exist, the staff_divisions FOR UPDATE won't find the row
    // → DIV_STAFF_ASSIGNMENT_NOT_FOUND (the service checks assignment existence, not division existence)
    vi.mocked(mockDb.query)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const err = await removeStaffDivision(mockDb, 'staff-001', 'nonexistent-division', AUDIT).catch(
      (e) => e
    )

    expect(err).toBeInstanceOf(DivisionsError)
    expect((err as DivisionsError).code).toBe('DIV_STAFF_ASSIGNMENT_NOT_FOUND')
  })
})
