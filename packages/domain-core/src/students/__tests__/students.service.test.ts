/**
 * Students Domain Unit Tests — STAGE_42_STUDENT_MANAGEMENT
 *
 * File: packages/domain-core/src/students/__tests__/students.service.test.ts
 *
 * Tests for business-logic enforcement:
 *   - toStudentRecord strips sensitive fields
 *   - createStudent: email conflict, limit enforcement, division validation, success
 *   - listStudents: pagination
 *   - getStudentById: not-found guard
 *   - updateStudent: not-found, email conflict
 *   - disableStudent / enableStudent: idempotency guards
 *   - deleteStudent: has-attempts guard
 *   - updateStudentSubscriptionStatus: not-found guard
 */

import { describe, expect, it, vi } from 'vitest'

import { StudentError } from '../students.errors'
import {
  createStudent,
  deleteStudent,
  disableStudent,
  enableStudent,
  getStudentById,
  listStudents,
  toStudentRecord,
  updateStudent,
  updateStudentSubscriptionStatus,
} from '../students.service'
import type { AuditContext, StudentRow } from '../students.types'

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted
// ---------------------------------------------------------------------------

vi.mock('../../auth/staff-password', () => ({
  hashStaffPassword: vi.fn(async () => '$argon2id$mock-hash'),
}))

vi.mock('../students.bulk-import', () => ({
  processBulkImport: vi.fn(async () => ({ inserted: 0, skipped: 0, errors: [] })),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORKSPACE_ID = 'ws-00000000-0000-0000-0000-000000000001'
const STUDENT_ID = 'st-00000000-0000-0000-0000-000000000001'
const DIVISION_ID = 'div-00000000-0000-0000-0000-000000000001'
const NOW = new Date('2026-04-06T10:00:00Z')

const audit: AuditContext = {
  user_id: 'user-001',
  workspace_id: WORKSPACE_ID,
  workspace_slug: 'test-ws',
  correlation_id: 'corr-001',
}

function makeStudentRow(overrides: Partial<StudentRow> = {}): StudentRow {
  return {
    id: STUDENT_ID,
    external_id: null,
    email: 'student@example.com',
    first_name: 'Jane',
    last_name: 'Doe',
    phone: null,
    password_hash: '$argon2id$mock-hash',
    division_id: DIVISION_ID,
    department_id: null,
    group_id: null,
    semester_id: null,
    subscription_status: 'NONE',
    status: 'ACTIVE',
    token_version: 0,
    failed_login_count: 0,
    locked_until: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Pool mock factory
// ---------------------------------------------------------------------------

type QueryMatcher = (
  sql: string,
  params?: unknown[]
) => { rows: unknown[]; rowCount: number | null }

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
    query: vi.fn(async (sql: string, params?: unknown[]) => matcher(sql, params)),
    _client: client,
  }

  return pool
}

// ---------------------------------------------------------------------------
// 1. toStudentRecord
// ---------------------------------------------------------------------------

describe('toStudentRecord', () => {
  it('strips password_hash, failed_login_count, locked_until from StudentRow', () => {
    const row = makeStudentRow()
    const record = toStudentRecord(row)

    expect('password_hash' in record).toBe(false)
    expect('failed_login_count' in record).toBe(false)
    expect('locked_until' in record).toBe(false)
    expect(record.email).toBe(row.email)
    expect(record.id).toBe(row.id)
    expect(record.status).toBe('ACTIVE')
  })
})

// ---------------------------------------------------------------------------
// 2. createStudent
// ---------------------------------------------------------------------------

describe('createStudent', () => {
  it('throws STUDENT_EMAIL_CONFLICT when email already exists', async () => {
    const pool = makePool((sql) => {
      // findStudentByEmailForUpdate returns existing row
      if (sql.includes('FOR UPDATE')) {
        return { rows: [makeStudentRow()], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const err = await createStudent(
      pool as any,
      {
        workspace_id: WORKSPACE_ID,
        email: 'student@example.com',
        password: 'Password123!',
        division_id: DIVISION_ID,
      },
      audit
    ).catch((e) => e)
    expect(err).toBeInstanceOf(StudentError)
    expect((err as StudentError).code).toBe('STUDENT_EMAIL_CONFLICT')
  })

  it('throws STUDENT_LIMIT_EXCEEDED when active student count >= license limit', async () => {
    const pool = makePool((sql) => {
      // No email conflict
      if (sql.includes('FOR UPDATE') && sql.includes('WHERE email = $1')) {
        return { rows: [], rowCount: 0 }
      }
      // countActiveStudents returns limit
      if (sql.includes('COUNT(*)') || sql.includes('count(*)')) {
        return { rows: [{ count: '50' }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const err = await createStudent(
      pool as any,
      {
        workspace_id: WORKSPACE_ID,
        email: 'new@example.com',
        password: 'Password123!',
        division_id: DIVISION_ID,
      },
      audit,
      50 // studentLimit
    ).catch((e) => e)

    expect(err).toBeInstanceOf(StudentError)
    expect((err as StudentError).code).toBe('STUDENT_LIMIT_EXCEEDED')
  })

  it('throws STUDENT_DIVISION_INACTIVE when division is not ENABLED', async () => {
    const pool = makePool((sql) => {
      if (sql.includes('FOR UPDATE') && sql.includes('students WHERE email')) {
        return { rows: [], rowCount: 0 }
      }
      if (sql.includes('COUNT(*)') || sql.includes('count(*)')) {
        return { rows: [{ count: '0' }], rowCount: 1 }
      }
      if (sql.includes('divisions WHERE id')) {
        return { rows: [{ id: DIVISION_ID, status: 'DISABLED' }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const err = await createStudent(
      pool as any,
      {
        workspace_id: WORKSPACE_ID,
        email: 'new@example.com',
        password: 'Password123!',
        division_id: DIVISION_ID,
      },
      audit
    ).catch((e) => e)

    expect(err).toBeInstanceOf(StudentError)
    expect((err as StudentError).code).toBe('STUDENT_DIVISION_INACTIVE')
  })

  it('inserts and returns StudentRecord on success', async () => {
    const inserted = makeStudentRow()
    const pool = makePool((sql) => {
      if (sql.includes('FOR UPDATE') && sql.includes('students WHERE email')) {
        return { rows: [], rowCount: 0 }
      }
      if (sql.includes('COUNT(*)') || sql.includes('count(*)')) {
        return { rows: [{ count: '0' }], rowCount: 1 }
      }
      if (sql.includes('divisions WHERE id')) {
        return { rows: [{ id: DIVISION_ID, status: 'ENABLED' }], rowCount: 1 }
      }
      if (sql.includes('INSERT INTO students')) {
        return { rows: [inserted], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const record = await createStudent(
      pool as any,
      {
        workspace_id: WORKSPACE_ID,
        email: 'new@example.com',
        password: 'Password123!',
        division_id: DIVISION_ID,
      },
      audit
    )

    expect(record.id).toBe(STUDENT_ID)
    expect('password_hash' in record).toBe(false)
    expect(pool._client.release).toHaveBeenCalled()
  })

  it('validates department and group when both provided', async () => {
    const DEPT_ID = 'dept-00000000-0000-0000-0000-000000000001'
    const GROUP_ID = 'grp-00000000-0000-0000-0000-000000000001'
    const inserted = makeStudentRow({ department_id: DEPT_ID, group_id: GROUP_ID })
    const pool = makePool((sql) => {
      if (sql.includes('FOR UPDATE') && sql.includes('students WHERE email')) {
        return { rows: [], rowCount: 0 }
      }
      if (sql.includes('COUNT(*)') || sql.includes('count(*)')) {
        return { rows: [{ count: '0' }], rowCount: 1 }
      }
      if (sql.includes('divisions WHERE id')) {
        return { rows: [{ id: DIVISION_ID, status: 'ENABLED' }], rowCount: 1 }
      }
      if (sql.includes('departments')) {
        return { rows: [{ id: DEPT_ID }], rowCount: 1 }
      }
      if (sql.includes('groups')) {
        return { rows: [{ id: GROUP_ID }], rowCount: 1 }
      }
      if (sql.includes('INSERT INTO students')) {
        return { rows: [inserted], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const record = await createStudent(
      pool as any,
      {
        workspace_id: WORKSPACE_ID,
        email: 'new@example.com',
        password: 'Password123!',
        division_id: DIVISION_ID,
        department_id: DEPT_ID,
        group_id: GROUP_ID,
      },
      audit
    )

    expect(record.id).toBe(STUDENT_ID)
    expect(record.department_id).toBe(DEPT_ID)
    expect('password_hash' in record).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 3. listStudents
// ---------------------------------------------------------------------------

describe('listStudents', () => {
  it('returns paginated result from listStudentRows', async () => {
    const row = makeStudentRow()
    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('COUNT(*)') || sql.includes('count(*)')) {
          return { rows: [{ count: '3' }], rowCount: 1 }
        }
        return { rows: [row], rowCount: 1 }
      }),
    }

    const result = await listStudents(
      db as any,
      { workspace_id: WORKSPACE_ID, page: 1, limit: 20 },
      audit
    )

    expect(result.total).toBe(3)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.id).toBe(STUDENT_ID)
    expect('password_hash' in result.items[0]!).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 4. getStudentById
// ---------------------------------------------------------------------------

describe('getStudentById', () => {
  it('returns StudentRecord when found', async () => {
    const row = makeStudentRow()
    const db = { query: vi.fn(async () => ({ rows: [row], rowCount: 1 })) }

    const record = await getStudentById(db as any, WORKSPACE_ID, STUDENT_ID, audit)
    expect(record.id).toBe(STUDENT_ID)
    expect('password_hash' in record).toBe(false)
  })

  it('throws STUDENT_NOT_FOUND when student does not exist', async () => {
    const db = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) }

    const err = await getStudentById(db as any, WORKSPACE_ID, STUDENT_ID, audit).catch((e) => e)
    expect(err).toBeInstanceOf(StudentError)
    expect((err as StudentError).code).toBe('STUDENT_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// 5. updateStudent
// ---------------------------------------------------------------------------

describe('updateStudent', () => {
  it('throws STUDENT_NOT_FOUND when student does not exist', async () => {
    const pool = makePool(() => ({ rows: [], rowCount: 0 }))

    const err = await updateStudent(
      pool as any,
      WORKSPACE_ID,
      STUDENT_ID,
      { first_name: 'Updated' },
      audit
    ).catch((e) => e)

    expect(err).toBeInstanceOf(StudentError)
    expect((err as StudentError).code).toBe('STUDENT_NOT_FOUND')
  })

  it('throws STUDENT_EMAIL_CONFLICT when new email already registered', async () => {
    const existing = makeStudentRow({ id: 'other-student-id' })
    const target = makeStudentRow()

    const pool = makePool((sql) => {
      if (sql.includes('WHERE id = $1') && !sql.includes('FOR UPDATE')) {
        return { rows: [target], rowCount: 1 }
      }
      if (sql.includes('FOR UPDATE') && sql.includes('WHERE email = $1')) {
        return { rows: [existing], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const err = await updateStudent(
      pool as any,
      WORKSPACE_ID,
      STUDENT_ID,
      { email: 'taken@example.com' },
      audit
    ).catch((e) => e)

    expect(err).toBeInstanceOf(StudentError)
    expect((err as StudentError).code).toBe('STUDENT_EMAIL_CONFLICT')
  })

  it('returns updated StudentRecord on success', async () => {
    const current = makeStudentRow()
    const updated = makeStudentRow({ first_name: 'Updated' })

    const pool = makePool((sql) => {
      if (sql.includes('UPDATE students')) {
        return { rows: [updated], rowCount: 1 }
      }
      if (sql.includes('WHERE id = $1')) {
        return { rows: [current], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const record = await updateStudent(
      pool as any,
      WORKSPACE_ID,
      STUDENT_ID,
      { first_name: 'Updated' },
      audit
    )

    expect(record.first_name).toBe('Updated')
    expect('password_hash' in record).toBe(false)
    expect(pool._client.release).toHaveBeenCalled()
  })

  it('skips email conflict check when new email is available', async () => {
    const current = makeStudentRow()
    const updated = makeStudentRow({ email: 'new-unique@example.com' })

    const pool = makePool((sql) => {
      if (sql.includes('FOR UPDATE') && sql.includes('WHERE email')) {
        return { rows: [], rowCount: 0 } // no conflict found
      }
      if (sql.includes('UPDATE students')) {
        return { rows: [updated], rowCount: 1 }
      }
      if (sql.includes('WHERE id = $1')) {
        return { rows: [current], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const record = await updateStudent(
      pool as any,
      WORKSPACE_ID,
      STUDENT_ID,
      { email: 'new-unique@example.com' },
      audit
    )

    expect(record.email).toBe('new-unique@example.com')
    expect('password_hash' in record).toBe(false)
  })

  it('validates department and group when both provided in update', async () => {
    const DEPT_ID = 'dept-00000000-0000-0000-0000-000000000001'
    const GROUP_ID = 'grp-00000000-0000-0000-0000-000000000001'
    const current = makeStudentRow()
    const updated = makeStudentRow({ department_id: DEPT_ID, group_id: GROUP_ID })

    const pool = makePool((sql) => {
      if (sql.includes('UPDATE students')) {
        return { rows: [updated], rowCount: 1 }
      }
      if (sql.includes('departments')) {
        return { rows: [{ id: DEPT_ID }], rowCount: 1 }
      }
      if (sql.includes('groups')) {
        return { rows: [{ id: GROUP_ID }], rowCount: 1 }
      }
      if (sql.includes('WHERE id = $1')) {
        return { rows: [current], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const record = await updateStudent(
      pool as any,
      WORKSPACE_ID,
      STUDENT_ID,
      { department_id: DEPT_ID, group_id: GROUP_ID },
      audit
    )

    expect(record.department_id).toBe(DEPT_ID)
    expect('password_hash' in record).toBe(false)
    expect(pool._client.release).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 6. disableStudent
// ---------------------------------------------------------------------------

describe('disableStudent', () => {
  it('throws STUDENT_NOT_FOUND when student does not exist', async () => {
    const pool = makePool(() => ({ rows: [], rowCount: 0 }))

    const err = await disableStudent(pool as any, WORKSPACE_ID, STUDENT_ID, audit).catch((e) => e)
    expect(err).toBeInstanceOf(StudentError)
    expect((err as StudentError).code).toBe('STUDENT_NOT_FOUND')
  })

  it('throws STUDENT_ALREADY_DISABLED when status is already DISABLED', async () => {
    const disabled = makeStudentRow({ status: 'DISABLED' })
    const pool = makePool((sql) => {
      if (sql.includes('WHERE id = $1') && !sql.includes('FOR UPDATE')) {
        return { rows: [disabled], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const err = await disableStudent(pool as any, WORKSPACE_ID, STUDENT_ID, audit).catch((e) => e)
    expect(err).toBeInstanceOf(StudentError)
    expect((err as StudentError).code).toBe('STUDENT_ALREADY_DISABLED')
  })

  it('returns StudentRecord with DISABLED status on success', async () => {
    const active = makeStudentRow({ status: 'ACTIVE' })
    const disabledRow = makeStudentRow({ status: 'DISABLED', token_version: 1 })
    const pool = makePool((sql) => {
      if (sql.includes('UPDATE students')) {
        return { rows: [disabledRow], rowCount: 1 }
      }
      if (sql.includes('WHERE id = $1')) {
        return { rows: [active], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const record = await disableStudent(pool as any, WORKSPACE_ID, STUDENT_ID, audit)
    expect(record.status).toBe('DISABLED')
    expect('password_hash' in record).toBe(false)
    expect(pool._client.release).toHaveBeenCalled()
  })

  it('throws STUDENT_NOT_FOUND when UPDATE returns null (concurrent delete)', async () => {
    const active = makeStudentRow({ status: 'ACTIVE' })
    const pool = makePool((sql) => {
      if (sql.includes('UPDATE students')) {
        return { rows: [], rowCount: 0 } // UPDATE finds nothing (student was deleted concurrently)
      }
      if (sql.includes('WHERE id = $1')) {
        return { rows: [active], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const err = await disableStudent(pool as any, WORKSPACE_ID, STUDENT_ID, audit).catch((e) => e)
    expect(err).toBeInstanceOf(StudentError)
    expect((err as StudentError).code).toBe('STUDENT_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// 7. enableStudent
// ---------------------------------------------------------------------------

describe('enableStudent', () => {
  it('throws STUDENT_NOT_FOUND when student does not exist', async () => {
    const pool = makePool(() => ({ rows: [], rowCount: 0 }))

    const err = await enableStudent(pool as any, WORKSPACE_ID, STUDENT_ID, audit).catch((e) => e)
    expect(err).toBeInstanceOf(StudentError)
    expect((err as StudentError).code).toBe('STUDENT_NOT_FOUND')
  })

  it('throws STUDENT_ALREADY_ACTIVE when status is already ACTIVE', async () => {
    const active = makeStudentRow({ status: 'ACTIVE' })
    const pool = makePool((sql) => {
      if (sql.includes('WHERE id = $1') && !sql.includes('FOR UPDATE')) {
        return { rows: [active], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const err = await enableStudent(pool as any, WORKSPACE_ID, STUDENT_ID, audit).catch((e) => e)
    expect(err).toBeInstanceOf(StudentError)
    expect((err as StudentError).code).toBe('STUDENT_ALREADY_ACTIVE')
  })

  it('returns StudentRecord with ACTIVE status on success', async () => {
    const disabled = makeStudentRow({ status: 'DISABLED' })
    const enabledRow = makeStudentRow({ status: 'ACTIVE' })
    const pool = makePool((sql) => {
      if (sql.includes('UPDATE students')) {
        return { rows: [enabledRow], rowCount: 1 }
      }
      if (sql.includes('WHERE id = $1')) {
        return { rows: [disabled], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const record = await enableStudent(pool as any, WORKSPACE_ID, STUDENT_ID, audit)
    expect(record.status).toBe('ACTIVE')
    expect('password_hash' in record).toBe(false)
    expect(pool._client.release).toHaveBeenCalled()
  })

  it('throws STUDENT_NOT_FOUND when UPDATE returns null (concurrent delete)', async () => {
    const disabled = makeStudentRow({ status: 'DISABLED' })
    const pool = makePool((sql) => {
      if (sql.includes('UPDATE students')) {
        return { rows: [], rowCount: 0 } // UPDATE finds nothing (student was deleted concurrently)
      }
      if (sql.includes('WHERE id = $1')) {
        return { rows: [disabled], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const err = await enableStudent(pool as any, WORKSPACE_ID, STUDENT_ID, audit).catch((e) => e)
    expect(err).toBeInstanceOf(StudentError)
    expect((err as StudentError).code).toBe('STUDENT_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// 8. deleteStudent
// ---------------------------------------------------------------------------

describe('deleteStudent', () => {
  it('throws STUDENT_NOT_FOUND when student does not exist', async () => {
    const pool = makePool(() => ({ rows: [], rowCount: 0 }))

    const err = await deleteStudent(pool as any, WORKSPACE_ID, STUDENT_ID, audit).catch((e) => e)
    expect(err).toBeInstanceOf(StudentError)
    expect((err as StudentError).code).toBe('STUDENT_NOT_FOUND')
  })

  it('throws STUDENT_HAS_ATTEMPTS when student has submitted attempts', async () => {
    const row = makeStudentRow()
    const pool = makePool((sql) => {
      if (sql.includes('WHERE id = $1') && !sql.includes('FOR UPDATE')) {
        return { rows: [row], rowCount: 1 }
      }
      // checkStudentHasAttempts — has at least one attempt
      if (sql.includes('FROM attempts')) {
        return { rows: [{ exists: true }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const err = await deleteStudent(pool as any, WORKSPACE_ID, STUDENT_ID, audit).catch((e) => e)
    expect(err).toBeInstanceOf(StudentError)
    expect((err as StudentError).code).toBe('STUDENT_HAS_ATTEMPTS')
  })

  it('soft-deletes student successfully when no attempts exist', async () => {
    const row = makeStudentRow()
    const pool = makePool((sql) => {
      if (sql.includes('WHERE id = $1') && !sql.includes('FOR UPDATE')) {
        return { rows: [row], rowCount: 1 }
      }
      if (sql.includes('FROM attempts')) {
        return { rows: [{ exists: false }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      deleteStudent(pool as any, WORKSPACE_ID, STUDENT_ID, audit)
    ).resolves.toBeUndefined()
    expect(pool._client.release).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 9. updateStudentSubscriptionStatus
// ---------------------------------------------------------------------------

describe('updateStudentSubscriptionStatus', () => {
  it('throws STUDENT_NOT_FOUND when student does not exist', async () => {
    const db = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) }

    const err = await updateStudentSubscriptionStatus(
      db as any,
      WORKSPACE_ID,
      STUDENT_ID,
      { subscription_status: 'ACTIVE' },
      audit
    ).catch((e) => e)

    expect(err).toBeInstanceOf(StudentError)
    expect((err as StudentError).code).toBe('STUDENT_NOT_FOUND')
  })

  it('returns updated StudentRecord on success', async () => {
    const updated = makeStudentRow({ subscription_status: 'ACTIVE' })
    const db = { query: vi.fn(async () => ({ rows: [updated], rowCount: 1 })) }

    const record = await updateStudentSubscriptionStatus(
      db as any,
      WORKSPACE_ID,
      STUDENT_ID,
      { subscription_status: 'ACTIVE' },
      audit
    )
    expect(record.subscription_status).toBe('ACTIVE')
    expect('password_hash' in record).toBe(false)
  })

  it('throws STUDENT_NOT_FOUND when UPDATE returns null (concurrent delete)', async () => {
    const current = makeStudentRow()
    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.trim().includes('UPDATE')) {
          return { rows: [], rowCount: 0 } // UPDATE finds nothing (concurrent delete)
        }
        return { rows: [current], rowCount: 1 } // SELECT finds student
      }),
    }

    const err = await updateStudentSubscriptionStatus(
      db as any,
      WORKSPACE_ID,
      STUDENT_ID,
      { subscription_status: 'ACTIVE' },
      audit
    ).catch((e) => e)

    expect(err).toBeInstanceOf(StudentError)
    expect((err as StudentError).code).toBe('STUDENT_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// 10. HIGH-VALUE ADDITIONAL TESTS — Coverage gap focus
// ---------------------------------------------------------------------------

describe('createStudent — group_id edge cases', () => {
  it('validates group_id (workspace-level group without department)', async () => {
    const GROUP_ID = 'grp-00000000-0000-0000-0000-000000000001'
    const inserted = makeStudentRow({ department_id: null, group_id: GROUP_ID })

    const pool = makePool((sql) => {
      if (sql === 'BEGIN ISOLATION LEVEL SERIALIZABLE' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [], rowCount: 0 }
      }
      if (sql.includes('FOR UPDATE')) {
        return { rows: [], rowCount: 0 }
      }
      if (sql.includes('COUNT(*)') || sql.includes('count(*)')) {
        return { rows: [{ count: '0' }], rowCount: 1 }
      }
      if (sql.includes('divisions WHERE')) {
        return { rows: [{ id: DIVISION_ID, status: 'ENABLED' }], rowCount: 1 }
      }
      if (sql.includes('groups WHERE')) {
        return { rows: [{ id: GROUP_ID }], rowCount: 1 }
      }
      if (sql.includes('INSERT INTO students')) {
        return { rows: [inserted], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const record = await createStudent(
      pool as any,
      {
        workspace_id: WORKSPACE_ID,
        email: 'new@example.com',
        password: 'Password123!',
        division_id: DIVISION_ID,
        group_id: GROUP_ID,
      },
      audit
    )

    expect(record.group_id).toBe(GROUP_ID)
  })
})

describe('updateStudent — email conflict edge cases', () => {
  it('throws STUDENT_EMAIL_CONFLICT when another student already has the email', async () => {
    const current = makeStudentRow()
    const other = makeStudentRow({ id: 'other' })

    const pool = makePool((sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [], rowCount: 0 }
      }
      if (sql.includes('WHERE id = $1') && !sql.includes('FOR UPDATE')) {
        return { rows: [current], rowCount: 1 }
      }
      if (sql.includes('FOR UPDATE')) {
        return { rows: [other], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const err = await updateStudent(
      pool as any,
      WORKSPACE_ID,
      STUDENT_ID,
      { email: 'taken@example.com' },
      audit
    ).catch((e) => e)

    expect(err).toBeInstanceOf(StudentError)
    expect((err as StudentError).code).toBe('STUDENT_EMAIL_CONFLICT')
  })
})
