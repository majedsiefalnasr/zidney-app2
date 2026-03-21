/**
 * Lessons Domain Unit Tests — STAGE_29_LESSONS
 *
 * File: packages/domain-core/src/lessons/__tests__/lessons.service.test.ts
 *
 * Tests for business logic: subject FK guards, name uniqueness enforcement,
 * Q7 DISABLED edit guard, status idempotency guards, soft-delete, and error-guard paths.
 */

import { describe, expect, it, vi } from 'vitest'

import type { AuditContext, CreateLessonInput, UpdateLessonInput } from '../index'

import {
  createLesson,
  deleteLesson,
  getActiveLessons,
  getLesson,
  LessonError,
  listLessons,
  updateLesson,
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

const NOW = new Date('2026-03-21T12:00:00Z')

const LESSON_ID = 'lesson-001'
const SUBJECT_ID = 'subject-001'

const makeLesson = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: LESSON_ID,
  subject_id: SUBJECT_ID,
  name: 'Introduction to Algebra',
  description: null,
  status: 'ENABLED' as const,
  created_by: 'user-001',
  updated_by: 'user-001',
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
// 1. listLessons — pagination and filtering
// ---------------------------------------------------------------------------

describe('listLessons', () => {
  it('returns items, total, page, and limit', async () => {
    const lessons = [makeLesson()]

    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '1' }], rowCount: 1 }
      return { rows: lessons, rowCount: 1 }
    })

    const result = await listLessons(db as any, { page: 1, limit: 20 })

    expect(result.items).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
  })

  it('returns empty items when no lessons exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '0' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await listLessons(db as any, { page: 1, limit: 20 })

    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 2. getLesson — not found guard
// ---------------------------------------------------------------------------

describe('getLesson', () => {
  it('throws LESSON_NOT_FOUND when lesson does not exist', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))

    await expect(getLesson(db as any, 'missing')).rejects.toSatisfy(
      (err: unknown) => err instanceof LessonError && err.code === 'LESSON_NOT_FOUND'
    )
  })

  it('returns the lesson when found', async () => {
    const lesson = makeLesson()

    const db = makeDb(() => ({ rows: [lesson], rowCount: 1 }))

    const result = await getLesson(db as any, LESSON_ID)
    expect(result.id).toBe(LESSON_ID)
    expect(result.name).toBe('Introduction to Algebra')
  })
})

// ---------------------------------------------------------------------------
// 3. getActiveLessons — subject guard
// ---------------------------------------------------------------------------

describe('getActiveLessons', () => {
  it('throws LESSON_SUBJECT_NOT_FOUND when subject does not exist', async () => {
    const db = makeDb((sql) => {
      // subjectExists check returns false
      if (sql.includes('subjects')) return { rows: [{ exists: false }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(getActiveLessons(db as any, 'no-such-subject')).rejects.toSatisfy(
      (err: unknown) => err instanceof LessonError && err.code === 'LESSON_SUBJECT_NOT_FOUND'
    )
  })

  it('returns active lessons when subject exists', async () => {
    const activeLesson = { id: LESSON_ID, name: 'Introduction to Algebra', description: null }

    const db = makeDb((sql) => {
      if (sql.includes('subjects')) return { rows: [{ exists: true }], rowCount: 1 }
      return { rows: [activeLesson], rowCount: 1 }
    })

    const result = await getActiveLessons(db as any, SUBJECT_ID)

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(LESSON_ID)
  })
})

// ---------------------------------------------------------------------------
// 4. createLesson — FK guards + name uniqueness
// ---------------------------------------------------------------------------

describe('createLesson', () => {
  it('throws LESSON_SUBJECT_NOT_FOUND when subject does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('subjects')) return { rows: [{ exists: false }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createLesson(
        db as any,
        { subject_id: SUBJECT_ID, name: 'Lesson 1' } as CreateLessonInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof LessonError && err.code === 'LESSON_SUBJECT_NOT_FOUND'
    )
  })

  it('throws LESSON_NAME_DUPLICATE when name already exists in subject', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('subjects')) return { rows: [{ exists: true }], rowCount: 1 }
      // lessonNameExistsInSubject → name already taken
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createLesson(
        db as any,
        { subject_id: SUBJECT_ID, name: 'Introduction to Algebra' } as CreateLessonInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof LessonError && err.code === 'LESSON_NAME_DUPLICATE'
    )
  })

  it('creates and returns the new lesson when inputs are valid', async () => {
    const newLesson = makeLesson({ id: 'lesson-new' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('subjects')) return { rows: [{ exists: true }], rowCount: 1 }
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: false }], rowCount: 1 }
      if (sql.includes('INSERT INTO lessons')) return { rows: [newLesson], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await createLesson(
      db as any,
      { subject_id: SUBJECT_ID, name: 'Introduction to Algebra' } as CreateLessonInput,
      auditCtx
    )

    expect(result.id).toBe('lesson-new')
    expect(result.status).toBe('ENABLED')
  })
})

// ---------------------------------------------------------------------------
// 5. updateLesson — Q7 DISABLED guard, idempotency, name duplicate, happy path
// ---------------------------------------------------------------------------

describe('updateLesson', () => {
  it('throws LESSON_NOT_FOUND when lesson does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      // findLessonById returns nothing
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateLesson(db as any, 'missing', { name: 'New Name' } as UpdateLessonInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof LessonError && err.code === 'LESSON_NOT_FOUND'
    )
  })

  it('throws LESSON_DISABLED when editing non-status fields on a DISABLED lesson (Q7)', async () => {
    const disabled = makeLesson({ status: 'DISABLED' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('WHERE id = $1::uuid')) return { rows: [disabled], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateLesson(db as any, LESSON_ID, { name: 'New Name' } as UpdateLessonInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof LessonError && err.code === 'LESSON_DISABLED'
    )
  })

  it('throws LESSON_DISABLED even when status: ENABLED is also present in payload (Q7)', async () => {
    const disabled = makeLesson({ status: 'DISABLED' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('WHERE id = $1::uuid')) return { rows: [disabled], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    // Non-status field (name) + status ENABLED combined — Q7 still fires
    await expect(
      updateLesson(
        db as any,
        LESSON_ID,
        { name: 'New Name', status: 'ENABLED' } as UpdateLessonInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof LessonError && err.code === 'LESSON_DISABLED'
    )
  })

  it('throws LESSON_ALREADY_ENABLED when lesson is ENABLED and status: ENABLED', async () => {
    const enabled = makeLesson({ status: 'ENABLED' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('WHERE id = $1::uuid')) return { rows: [enabled], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateLesson(db as any, LESSON_ID, { status: 'ENABLED' } as UpdateLessonInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof LessonError && err.code === 'LESSON_ALREADY_ENABLED'
    )
  })

  it('throws LESSON_ALREADY_DISABLED when lesson is DISABLED and status: DISABLED', async () => {
    const disabled = makeLesson({ status: 'DISABLED' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('WHERE id = $1::uuid')) return { rows: [disabled], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateLesson(db as any, LESSON_ID, { status: 'DISABLED' } as UpdateLessonInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof LessonError && err.code === 'LESSON_ALREADY_DISABLED'
    )
  })

  it('throws LESSON_NAME_DUPLICATE when new name is already taken', async () => {
    const existing = makeLesson()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('WHERE id = $1::uuid')) return { rows: [existing], rowCount: 1 }
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: true }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateLesson(db as any, LESSON_ID, { name: 'Already Exists' } as UpdateLessonInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof LessonError && err.code === 'LESSON_NAME_DUPLICATE'
    )
  })

  it('updates the lesson when inputs are valid', async () => {
    const existing = makeLesson()
    const updated = makeLesson({ name: 'Advanced Algebra' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('WHERE id = $1::uuid')) return { rows: [existing], rowCount: 1 }
      if (sql.includes('LOWER(name)')) return { rows: [{ exists: false }], rowCount: 1 }
      if (sql.includes('UPDATE lessons')) return { rows: [updated], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await updateLesson(
      db as any,
      LESSON_ID,
      { name: 'Advanced Algebra' } as UpdateLessonInput,
      auditCtx
    )

    expect(result.name).toBe('Advanced Algebra')
  })
})

// ---------------------------------------------------------------------------
// 6. deleteLesson — not found, already disabled, happy path
// ---------------------------------------------------------------------------

describe('deleteLesson', () => {
  it('throws LESSON_NOT_FOUND when lesson does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteLesson(db as any, 'missing', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof LessonError && err.code === 'LESSON_NOT_FOUND'
    )
  })

  it('throws LESSON_ALREADY_DISABLED when lesson is already DISABLED', async () => {
    const disabled = makeLesson({ status: 'DISABLED' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('WHERE id = $1::uuid')) return { rows: [disabled], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteLesson(db as any, LESSON_ID, auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof LessonError && err.code === 'LESSON_ALREADY_DISABLED'
    )
  })

  it('soft-deletes the lesson (sets status = DISABLED) when lesson is ENABLED', async () => {
    const enabled = makeLesson({ status: 'ENABLED' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('WHERE id = $1::uuid')) return { rows: [enabled], rowCount: 1 }
      if (sql.includes('UPDATE lessons'))
        return { rows: [{ ...enabled, status: 'DISABLED' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await deleteLesson(db as any, LESSON_ID, auditCtx)

    expect(result).toEqual({ deleted: true })
  })
})
