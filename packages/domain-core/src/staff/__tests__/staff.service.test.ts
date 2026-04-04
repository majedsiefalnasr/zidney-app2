/**
 * Staff Domain Unit Tests — STAGE_43_LIMIT_ENFORCEMENT
 *
 * File: packages/domain-core/src/staff/__tests__/staff.service.test.ts
 *
 * Tests for limit-enforcement paths:
 *   - createStaff: staffLimit=null allows, staffLimit=N blocks at N, email conflict
 *   - enableStaff: NOT_FOUND, ALREADY_ACTIVE, STAFF_LIMIT_EXCEEDED with metadata,
 *                  null limit allows, below-limit allows, client.release() called
 */

import { describe, expect, it, vi } from 'vitest'

import { StaffError } from '../staff.errors'
import { createStaff, enableStaff } from '../staff.service'
import type { AuditContext, StaffRow } from '../staff.types'

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted
// ---------------------------------------------------------------------------

vi.mock('../auth/staff-password', () => ({
  hashStaffPassword: vi.fn(async () => '$argon2id$mock-hash'),
}))

vi.mock('./staff.bulk-import', () => ({
  processStaffBulkImport: vi.fn(async () => ({ inserted: 0, skipped: 0, errors: [] })),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORKSPACE_ID = 'ws-00000000-0000-0000-0000-000000000001'
const STAFF_ID = 'sf-00000000-0000-0000-0000-000000000001'
const NOW = new Date('2026-04-06T10:00:00Z')

const audit: AuditContext = {
  user_id: 'user-001',
  workspace_id: WORKSPACE_ID,
  workspace_slug: 'test-ws',
  correlation_id: 'corr-001',
}

const createInput = {
  workspace_id: WORKSPACE_ID,
  email: 'staff@example.com',
  name: 'John Staff',
  password: 'secret1234',
  role_id: null,
  division_ids: [],
}

function makeStaffRow(overrides: Partial<StaffRow> = {}): StaffRow {
  return {
    id: STAFF_ID,
    workspace_id: WORKSPACE_ID,
    email: 'staff@example.com',
    name: 'John Staff',
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
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Pool / client mock factory
// ---------------------------------------------------------------------------

type QueryMatcher = (
  sql: string,
  params?: unknown[]
) => { rows: unknown[]; rowCount: number | null }

/**
 * Pool mock that supports both pool-level queries (createStaff) and
 * client-checkout pattern (enableStaff / processStaffBulkImport).
 */
function makePool(matcher: QueryMatcher) {
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const txCmds = ['BEGIN', 'BEGIN ISOLATION LEVEL SERIALIZABLE', 'COMMIT', 'ROLLBACK']
      if (txCmds.includes(sql.trim())) {
        return { rows: [], rowCount: 0 }
      }
      return matcher(sql, params)
    }),
    release: vi.fn(),
  }

  const pool = {
    connect: vi.fn(async () => client),
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const txCmds = ['BEGIN', 'BEGIN ISOLATION LEVEL SERIALIZABLE', 'COMMIT', 'ROLLBACK']
      if (txCmds.includes(sql.trim())) {
        return { rows: [], rowCount: 0 }
      }
      return matcher(sql, params)
    }),
    _client: client,
  }

  return pool
}

// ---------------------------------------------------------------------------
// 1. createStaff — limit enforcement
// ---------------------------------------------------------------------------

describe('createStaff', () => {
  it('throws STAFF_EMAIL_CONFLICT when email is already registered', async () => {
    const existing = makeStaffRow()
    const pool = makePool((sql) => {
      // findStaffByEmailForUpdate — returns a row
      if (sql.includes('email = $')) return { rows: [existing], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const err = await createStaff(pool as any, createInput, null, audit).catch((e) => e)
    expect(err).toBeInstanceOf(StaffError)
    expect((err as StaffError).code).toBe('STAFF_EMAIL_CONFLICT')
  })

  it('throws STAFF_LIMIT_EXCEEDED with metadata when activeCount >= staffLimit', async () => {
    const pool = makePool((sql) => {
      // findStaffByEmailForUpdate — no conflict
      if (sql.includes('email = $')) return { rows: [], rowCount: 0 }
      // countActiveStaff — returns 5
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '5' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const err = await createStaff(pool as any, createInput, 5, audit).catch((e) => e)
    expect(err).toBeInstanceOf(StaffError)
    expect((err as StaffError).code).toBe('STAFF_LIMIT_EXCEEDED')
    expect((err as StaffError).limit_value).toBe(5)
    expect((err as StaffError).current_value).toBe(5)
  })

  it('allows creation when staffLimit is null (unlimited)', async () => {
    const { password_hash, failed_login_count, locked_until, token_version, ...publicRecord } =
      makeStaffRow()
    const pool = makePool((sql) => {
      if (sql.includes('email = $')) return { rows: [], rowCount: 0 }
      if (sql.includes('INSERT INTO backoffice_staff_users'))
        return { rows: [publicRecord], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const record = await createStaff(pool as any, createInput, null, audit)
    expect(record.email).toBe('staff@example.com')
    expect('password_hash' in record).toBe(false)
  })

  it('allows creation when activeCount is below staffLimit', async () => {
    const { password_hash, failed_login_count, locked_until, token_version, ...publicRecord } =
      makeStaffRow()
    const pool = makePool((sql) => {
      if (sql.includes('email = $')) return { rows: [], rowCount: 0 }
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '4' }], rowCount: 1 }
      if (sql.includes('INSERT INTO backoffice_staff_users'))
        return { rows: [publicRecord], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const record = await createStaff(pool as any, createInput, 5, audit)
    expect(record.email).toBe('staff@example.com')
  })
})

// ---------------------------------------------------------------------------
// 2. enableStaff — limit enforcement
// ---------------------------------------------------------------------------

describe('enableStaff', () => {
  it('throws STAFF_NOT_FOUND when staff does not exist', async () => {
    const pool = makePool(() => ({ rows: [], rowCount: 0 }))

    const err = await enableStaff(pool as any, WORKSPACE_ID, STAFF_ID, null, audit).catch((e) => e)
    expect(err).toBeInstanceOf(StaffError)
    expect((err as StaffError).code).toBe('STAFF_NOT_FOUND')
  })

  it('throws STAFF_ALREADY_ACTIVE when status is already ACTIVE', async () => {
    const active = makeStaffRow({ status: 'ACTIVE' })
    const pool = makePool((sql) => {
      if (sql.includes('AND id = $')) {
        return { rows: [active], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const err = await enableStaff(pool as any, WORKSPACE_ID, STAFF_ID, null, audit).catch((e) => e)
    expect(err).toBeInstanceOf(StaffError)
    expect((err as StaffError).code).toBe('STAFF_ALREADY_ACTIVE')
  })

  it('throws STAFF_LIMIT_EXCEEDED with metadata when activeCount >= staffLimit', async () => {
    const inactive = makeStaffRow({ status: 'INACTIVE', is_active: false })
    const pool = makePool((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '10' }], rowCount: 1 }
      if (sql.includes('AND id = $')) {
        return { rows: [inactive], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const err = await enableStaff(pool as any, WORKSPACE_ID, STAFF_ID, 10, audit).catch((e) => e)
    expect(err).toBeInstanceOf(StaffError)
    expect((err as StaffError).code).toBe('STAFF_LIMIT_EXCEEDED')
    expect((err as StaffError).limit_value).toBe(10)
    expect((err as StaffError).current_value).toBe(10)
  })

  it('allows enable when staffLimit is null (unlimited)', async () => {
    const inactive = makeStaffRow({ status: 'INACTIVE', is_active: false })
    const active = makeStaffRow({ status: 'ACTIVE', is_active: true })
    const pool = makePool((sql) => {
      if (sql.includes('UPDATE backoffice_staff_users')) return { rows: [active], rowCount: 1 }
      if (sql.includes('AND id = $')) {
        return { rows: [inactive], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const record = await enableStaff(pool as any, WORKSPACE_ID, STAFF_ID, null, audit)
    expect(record.status).toBe('ACTIVE')
    expect(pool._client.release).toHaveBeenCalled()
  })

  it('allows enable when activeCount is below staffLimit', async () => {
    const inactive = makeStaffRow({ status: 'INACTIVE', is_active: false })
    const active = makeStaffRow({ status: 'ACTIVE', is_active: true })
    const pool = makePool((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ count: '9' }], rowCount: 1 }
      if (sql.includes('UPDATE backoffice_staff_users')) return { rows: [active], rowCount: 1 }
      if (sql.includes('AND id = $')) {
        return { rows: [inactive], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const record = await enableStaff(pool as any, WORKSPACE_ID, STAFF_ID, 10, audit)
    expect(record.status).toBe('ACTIVE')
    expect(pool._client.release).toHaveBeenCalled()
  })

  it('calls client.release() even when an error is thrown', async () => {
    // No staff found — triggers STAFF_NOT_FOUND, release must still be called
    const pool = makePool(() => ({ rows: [], rowCount: 0 }))

    await enableStaff(pool as any, WORKSPACE_ID, STAFF_ID, null, audit).catch(() => {})
    expect(pool._client.release).toHaveBeenCalled()
  })
})
