/**
 * Subjects Domain Unit Tests — STAGE_28
 *
 * File: packages/domain-core/src/subjects/__tests__/subjects.service.test.ts
 *
 * Tests for business logic: FK guards, name/code uniqueness enforcement,
 * state machine transitions, CAS conflict detection, soft-delete, and error-guard paths.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  type AuditContext,
  type CreateSubjectInput,
  createSubject,
  deleteSubject,
  getSubjectById,
  listSubjects,
  SubjectsError,
  type TransitionSubjectInput,
  transitionSubjectStatus,
  type UpdateSubjectInput,
  updateSubject,
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

const NOW = new Date('2026-03-20T12:00:00Z')

const makeSubject = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'sub-001',
  name: 'Mathematics',
  code: 'MATH101',
  division_id: null,
  semester_id: null,
  is_multilanguage: false,
  default_language: 'en',
  description: null,
  status: 'DRAFT' as const,
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
// 1. listSubjects — pagination
// ---------------------------------------------------------------------------

describe('listSubjects', () => {
  it('returns items, total, page, and limit', async () => {
    const subjects = [makeSubject()]

    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '1' }], rowCount: 1 }
      return { rows: subjects, rowCount: 1 }
    })

    const result = await listSubjects(db as any, { page: 1, limit: 20 })

    expect(result.items).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
  })

  it('returns empty items when no subjects exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '0' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await listSubjects(db as any, { page: 1, limit: 20 })

    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 2. createSubject — FK guards + name/code uniqueness
// ---------------------------------------------------------------------------

describe('createSubject', () => {
  it('throws SUBJECT_DIVISION_NOT_FOUND when division does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('divisions')) return { rows: [{ exists: false }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createSubject(
        db as any,
        { name: 'Math', default_language: 'en', division_id: 'div-001' } as CreateSubjectInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof SubjectsError && err.code === 'SUBJECT_DIVISION_NOT_FOUND'
    )
  })

  it('throws SUBJECT_SEMESTER_NOT_FOUND when semester does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('divisions')) return { rows: [{ exists: true }], rowCount: 1 }
      if (sql.includes('semesters')) return { rows: [{ exists: false }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createSubject(
        db as any,
        {
          name: 'Math',
          default_language: 'en',
          division_id: 'div-001',
          semester_id: 'sem-001',
        } as CreateSubjectInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof SubjectsError && err.code === 'SUBJECT_SEMESTER_NOT_FOUND'
    )
  })

  it('throws SUBJECT_NAME_DUPLICATE when name already exists', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createSubject(
        db as any,
        { name: 'Mathematics', default_language: 'en' } as CreateSubjectInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof SubjectsError && err.code === 'SUBJECT_NAME_DUPLICATE'
    )
  })

  it('throws SUBJECT_CODE_DUPLICATE when code already exists', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: false }], rowCount: 1 }
      if (sql.includes('WHERE code =')) return { rows: [{ exists: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createSubject(
        db as any,
        { name: 'Mathematics', code: 'MATH101', default_language: 'en' } as CreateSubjectInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof SubjectsError && err.code === 'SUBJECT_CODE_DUPLICATE'
    )
  })

  it('creates and returns the new subject when valid', async () => {
    const newSubject = makeSubject({ id: 'sub-new' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: false }], rowCount: 1 }
      if (sql.includes('WHERE code =')) return { rows: [{ exists: false }], rowCount: 1 }
      if (sql.includes('INSERT INTO subjects')) return { rows: [newSubject], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await createSubject(
      db as any,
      { name: 'Mathematics', code: 'MATH101', default_language: 'en' } as CreateSubjectInput,
      auditCtx
    )

    expect(result.id).toBe('sub-new')
    expect(result.status).toBe('DRAFT')
  })
})

// ---------------------------------------------------------------------------
// 3. getSubjectById
// ---------------------------------------------------------------------------

describe('getSubjectById', () => {
  it('throws SUBJECT_NOT_FOUND when subject does not exist', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))

    await expect(getSubjectById(db as any, 'missing')).rejects.toSatisfy(
      (err: unknown) => err instanceof SubjectsError && err.code === 'SUBJECT_NOT_FOUND'
    )
  })

  it('returns the subject when found', async () => {
    const subject = makeSubject()

    const db = makeDb(() => ({ rows: [subject], rowCount: 1 }))

    const result = await getSubjectById(db as any, 'sub-001')
    expect(result.id).toBe('sub-001')
    expect(result.name).toBe('Mathematics')
  })
})

// ---------------------------------------------------------------------------
// 4. updateSubject — not found, archived guard, name duplicate, happy path
// ---------------------------------------------------------------------------

describe('updateSubject', () => {
  it('throws SUBJECT_NOT_FOUND when subject does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateSubject(db as any, { id: 'missing', name: 'New Name' } as UpdateSubjectInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof SubjectsError && err.code === 'SUBJECT_NOT_FOUND'
    )
  })

  it('throws SUBJECT_ARCHIVED when subject is archived', async () => {
    const archived = makeSubject({ status: 'ARCHIVED' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [archived], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateSubject(db as any, { id: 'sub-001', name: 'New Name' } as UpdateSubjectInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof SubjectsError && err.code === 'SUBJECT_ARCHIVED'
    )
  })

  it('throws SUBJECT_NAME_DUPLICATE when new name is already taken', async () => {
    const existing = makeSubject()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [existing], rowCount: 1 }
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateSubject(
        db as any,
        { id: 'sub-001', name: 'Other Math' } as UpdateSubjectInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof SubjectsError && err.code === 'SUBJECT_NAME_DUPLICATE'
    )
  })

  it('updates the subject when inputs are valid', async () => {
    const existing = makeSubject()
    const updated = makeSubject({ name: 'Advanced Mathematics' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [existing], rowCount: 1 }
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: false }], rowCount: 1 }
      if (sql.includes('UPDATE subjects')) return { rows: [updated], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await updateSubject(
      db as any,
      { id: 'sub-001', name: 'Advanced Mathematics' } as UpdateSubjectInput,
      auditCtx
    )

    expect(result.name).toBe('Advanced Mathematics')
  })
})

// ---------------------------------------------------------------------------
// 5. transitionSubjectStatus — not found, invalid transition, CAS conflict, happy path
// ---------------------------------------------------------------------------

describe('transitionSubjectStatus', () => {
  it('throws SUBJECT_NOT_FOUND when subject does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      transitionSubjectStatus(
        db as any,
        {
          id: 'missing',
          target_status: 'ACTIVE',
          expected_current_status: 'DRAFT',
        } as TransitionSubjectInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof SubjectsError && err.code === 'SUBJECT_NOT_FOUND'
    )
  })

  it('throws SUBJECT_INVALID_TRANSITION for disallowed state change', async () => {
    // ARCHIVED → DRAFT is not in ALLOWED_TRANSITIONS
    const archived = makeSubject({ status: 'ARCHIVED' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [archived], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      transitionSubjectStatus(
        db as any,
        {
          id: 'sub-001',
          target_status: 'DRAFT',
          expected_current_status: 'ARCHIVED',
        } as TransitionSubjectInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof SubjectsError && err.code === 'SUBJECT_INVALID_TRANSITION'
    )
  })

  it('throws SUBJECT_TRANSITION_CONFLICT when CAS update matches zero rows', async () => {
    const locked = makeSubject({ status: 'DRAFT' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [locked], rowCount: 1 }
      // CAS UPDATE — rowCount 0 means concurrent modification won
      if (sql.includes('UPDATE subjects')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      transitionSubjectStatus(
        db as any,
        {
          id: 'sub-001',
          target_status: 'ACTIVE',
          expected_current_status: 'DRAFT',
        } as TransitionSubjectInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof SubjectsError && err.code === 'SUBJECT_TRANSITION_CONFLICT'
    )
  })

  it('transitions DRAFT → ACTIVE successfully', async () => {
    const locked = makeSubject({ status: 'DRAFT' })
    const active = makeSubject({ status: 'ACTIVE' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [locked], rowCount: 1 }
      if (sql.includes('UPDATE subjects')) return { rows: [], rowCount: 1 }
      // findSubjectById after COMMIT
      return { rows: [active], rowCount: 1 }
    })

    const result = await transitionSubjectStatus(
      db as any,
      {
        id: 'sub-001',
        target_status: 'ACTIVE',
        expected_current_status: 'DRAFT',
      } as TransitionSubjectInput,
      auditCtx
    )

    expect(result.status).toBe('ACTIVE')
  })
})

// ---------------------------------------------------------------------------
// 6. deleteSubject — not found, happy path
// ---------------------------------------------------------------------------

describe('deleteSubject', () => {
  it('throws SUBJECT_NOT_FOUND when subject does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteSubject(db as any, 'missing', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof SubjectsError && err.code === 'SUBJECT_NOT_FOUND'
    )
  })

  it('soft-deletes the subject when there are no dependencies', async () => {
    const existing = makeSubject()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [existing], rowCount: 1 }
      if (sql.includes('UPDATE subjects')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteSubject(db as any, 'sub-001', auditCtx)).resolves.toBeUndefined()
  })
})
