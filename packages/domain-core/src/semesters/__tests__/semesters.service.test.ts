/**
 * Semesters Domain Unit Tests — STAGE_27
 *
 * File: packages/domain-core/src/semesters/__tests__/semesters.service.test.ts
 *
 * Tests for business logic: date range validation, name uniqueness enforcement,
 * student count guard, soft-delete, and error-guard paths.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  type AuditContext,
  type CreateSemesterInput,
  createSemester,
  deleteSemester,
  getSemesterById,
  listSemesters,
  SemesterStatus,
  SemestersError,
  type UpdateSemesterInput,
  updateSemester,
} from '../index'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const auditCtx: AuditContext = {
  user_id: 'user-001',
  correlation_id: 'corr-001',
  workspace_slug: 'test-ws',
  workspace_id: 'ws-001',
}

const NOW = new Date('2026-03-19T12:00:00Z')

const makeSemester = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'sem-001',
  name: 'Fall 2026',
  description: null,
  status: SemesterStatus.ENABLED as const,
  start_date: '2026-09-01',
  end_date: '2026-12-31',
  deleted_at: null,
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb(
  matcher: (sql: string, params?: unknown[]) => { rows: unknown[]; rowCount: number | null }
) {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => matcher(sql, params)),
  }
}

// ---------------------------------------------------------------------------
// 1. listSemesters — pagination
// ---------------------------------------------------------------------------

describe('listSemesters', () => {
  it('returns items, total, page, and limit', async () => {
    const semesters = [makeSemester()]

    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '1' }], rowCount: 1 }
      return { rows: semesters, rowCount: 1 }
    })

    const result = await listSemesters(db as any, { page: 1, limit: 20 })

    expect(result.items).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
  })

  it('returns empty items when no semesters exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '0' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await listSemesters(db as any, { page: 1, limit: 20 })

    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('applies page/limit offset correctly', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '50' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await listSemesters(db as any, { page: 3, limit: 10 })

    expect(result.page).toBe(3)
    expect(result.limit).toBe(10)
    expect(result.total).toBe(50)
  })
})

// ---------------------------------------------------------------------------
// 2. createSemester — date range + name uniqueness
// ---------------------------------------------------------------------------

describe('createSemester', () => {
  it('throws SEMESTER_DATE_RANGE_INVALID when start_date is after end_date', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))

    await expect(
      createSemester(
        db as any,
        {
          name: 'Bad Range',
          start_date: '2026-12-31',
          end_date: '2026-09-01',
        } as CreateSemesterInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof SemestersError && err.code === 'SEMESTER_DATE_RANGE_INVALID'
    )
  })

  it('throws SEMESTER_NAME_DUPLICATE when name already exists', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      // semesterNameExists uses SELECT EXISTS (...) AS exists
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createSemester(
        db as any,
        {
          name: 'Fall 2026',
          start_date: '2026-09-01',
          end_date: '2026-12-31',
        } as CreateSemesterInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof SemestersError && err.code === 'SEMESTER_NAME_DUPLICATE'
    )
  })

  it('creates and returns the new semester when valid', async () => {
    const newSemester = makeSemester({ id: 'sem-new' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('LOWER(name)')) return { rows: [], rowCount: 0 } // no duplicate
      if (sql.includes('INSERT INTO semesters')) return { rows: [newSemester], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await createSemester(
      db as any,
      {
        name: 'Fall 2026',
        start_date: '2026-09-01',
        end_date: '2026-12-31',
      } as CreateSemesterInput,
      auditCtx
    )

    expect(result.id).toBe('sem-new')
    expect(result.status).toBe(SemesterStatus.ENABLED)
  })
})

// ---------------------------------------------------------------------------
// 3. getSemesterById — not found
// ---------------------------------------------------------------------------

describe('getSemesterById', () => {
  it('throws SEMESTER_NOT_FOUND when semester does not exist', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))

    await expect(getSemesterById(db as any, 'missing')).rejects.toSatisfy(
      (err: unknown) => err instanceof SemestersError && err.code === 'SEMESTER_NOT_FOUND'
    )
  })

  it('returns the semester when found', async () => {
    const semester = makeSemester()

    const db = makeDb(() => ({ rows: [semester], rowCount: 1 }))

    const result = await getSemesterById(db as any, 'sem-001')

    expect(result.id).toBe('sem-001')
    expect(result.name).toBe('Fall 2026')
  })
})

// ---------------------------------------------------------------------------
// 4. updateSemester — not found, name duplicate, date range
// ---------------------------------------------------------------------------

describe('updateSemester', () => {
  it('throws SEMESTER_NOT_FOUND when semester does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateSemester(db as any, 'missing', { name: 'Updated' } as UpdateSemesterInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof SemestersError && err.code === 'SEMESTER_NOT_FOUND'
    )
  })

  it('throws SEMESTER_NAME_DUPLICATE when new name is already taken', async () => {
    const existing = makeSemester()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      // semesterNameExists uses SELECT EXISTS (...) AS exists
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: true }], rowCount: 1 }
      return { rows: [existing], rowCount: 1 }
    })

    await expect(
      updateSemester(db as any, 'sem-001', { name: 'Spring 2026' } as UpdateSemesterInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof SemestersError && err.code === 'SEMESTER_NAME_DUPLICATE'
    )
  })

  it('throws SEMESTER_DATE_RANGE_INVALID when effective dates are invalid', async () => {
    const existing = makeSemester()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('LOWER(name)')) return { rows: [], rowCount: 0 }
      return { rows: [existing], rowCount: 1 }
    })

    await expect(
      updateSemester(
        db as any,
        'sem-001',
        {
          start_date: '2027-01-01', // after existing end_date 2026-12-31
        } as UpdateSemesterInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof SemestersError && err.code === 'SEMESTER_DATE_RANGE_INVALID'
    )
  })

  it('updates the semester when inputs are valid', async () => {
    const existing = makeSemester()
    const updated = makeSemester({ name: 'Updated Fall 2026' })

    let callCount = 0
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('LOWER(name)')) return { rows: [], rowCount: 0 }
      if (sql.includes('UPDATE semesters')) return { rows: [updated], rowCount: 1 }
      callCount++
      return { rows: [existing], rowCount: 1 }
    })

    void callCount
    const result = await updateSemester(
      db as any,
      'sem-001',
      { name: 'Updated Fall 2026' } as UpdateSemesterInput,
      auditCtx
    )

    expect(result.name).toBe('Updated Fall 2026')
  })
})

// ---------------------------------------------------------------------------
// 5. deleteSemester — not found, has students, soft-delete
// ---------------------------------------------------------------------------

describe('deleteSemester', () => {
  it('throws SEMESTER_NOT_FOUND when semester does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      // lockSemesterForUpdate returns nothing
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteSemester(db as any, 'missing', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof SemestersError && err.code === 'SEMESTER_NOT_FOUND'
    )
  })

  it('throws SEMESTER_HAS_STUDENTS when semester has students enrolled', async () => {
    const existing = makeSemester()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      // lockSemesterForUpdate uses FOR UPDATE (not NOWAIT)
      if (sql.includes('FOR UPDATE')) return { rows: [existing], rowCount: 1 }
      // countStudentsForSemester returns total column (COUNT(*)::text AS total)
      if (sql.includes('students') && sql.includes('semester_id')) {
        return { rows: [{ total: '5' }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteSemester(db as any, 'sem-001', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof SemestersError && err.code === 'SEMESTER_HAS_STUDENTS'
    )
  })

  it('soft-deletes the semester when no students are assigned', async () => {
    const existing = makeSemester()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      // lockSemesterForUpdate uses FOR UPDATE (not NOWAIT)
      if (sql.includes('FOR UPDATE')) return { rows: [existing], rowCount: 1 }
      // countStudentsForSemester — total column
      if (sql.includes('students') && sql.includes('semester_id')) {
        return { rows: [{ total: '0' }], rowCount: 1 }
      }
      if (sql.includes('UPDATE semesters')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    // deleteSemester returns void
    await expect(deleteSemester(db as any, 'sem-001', auditCtx)).resolves.toBeUndefined()
  })
})
