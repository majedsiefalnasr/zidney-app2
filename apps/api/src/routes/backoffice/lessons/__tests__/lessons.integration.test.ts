/**
 * Lessons Route Integration Tests — STAGE_29_LESSONS
 *
 * File: apps/api/src/routes/backoffice/lessons/__tests__/lessons.integration.test.ts
 *
 * Tests route handlers by mocking the domain service layer.
 * Verifies: request parsing, response shape, error mapping, HTTP status codes.
 */

import type { Context } from 'hono'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock domain service (must be hoisted before handler imports)
// ---------------------------------------------------------------------------

vi.mock('@zidney/domain-core/lessons', () => ({
  LessonError: class LessonError extends Error {
    code: string
    constructor(code: string) {
      const messages: Record<string, string> = {
        LESSON_NOT_FOUND: 'Lesson not found.',
        LESSON_SUBJECT_NOT_FOUND: 'Subject not found.',
        LESSON_NAME_DUPLICATE: 'A lesson with this name already exists in this subject.',
        LESSON_DISABLED: 'Lesson is disabled. Re-enable it before editing other fields.',
        LESSON_ALREADY_DISABLED: 'Lesson is already disabled.',
        LESSON_ALREADY_ENABLED: 'Lesson is already enabled.',
        LESSON_HAS_DEPENDENT_CONTENT: 'Lesson has dependent content and cannot be deleted.',
        VALIDATION_ERROR: 'Invalid request data.',
      }
      super(messages[code] ?? 'Unknown error.')
      this.name = 'LessonError'
      this.code = code
    }
  },
  LESSON_ERROR_HTTP_STATUS: {
    LESSON_NOT_FOUND: 404,
    LESSON_SUBJECT_NOT_FOUND: 404,
    LESSON_NAME_DUPLICATE: 409,
    LESSON_DISABLED: 422,
    LESSON_ALREADY_DISABLED: 422,
    LESSON_ALREADY_ENABLED: 422,
    LESSON_HAS_DEPENDENT_CONTENT: 409,
    VALIDATION_ERROR: 422,
  },
  LESSON_ERROR_MESSAGES: {
    LESSON_NOT_FOUND: 'Lesson not found.',
    LESSON_SUBJECT_NOT_FOUND: 'Subject not found.',
    LESSON_NAME_DUPLICATE: 'A lesson with this name already exists in this subject.',
    LESSON_DISABLED: 'Lesson is disabled. Re-enable it before editing other fields.',
    LESSON_ALREADY_DISABLED: 'Lesson is already disabled.',
    LESSON_ALREADY_ENABLED: 'Lesson is already enabled.',
    LESSON_HAS_DEPENDENT_CONTENT: 'Lesson has dependent content and cannot be deleted.',
    VALIDATION_ERROR: 'Invalid request data.',
  },
  listLessons: vi.fn(),
  getLesson: vi.fn(),
  getActiveLessons: vi.fn(),
  createLesson: vi.fn(),
  updateLesson: vi.fn(),
  deleteLesson: vi.fn(),
}))

vi.mock('@zidney/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

// ---------------------------------------------------------------------------
// Mock helpers — bypass getDb/buildAuditCtx; provide a code-dispatching
// lessonsErrorResponse so the mock LessonError works correctly
// ---------------------------------------------------------------------------

const LESSONS_HTTP_STATUS: Record<string, number> = {
  LESSON_NOT_FOUND: 404,
  LESSON_SUBJECT_NOT_FOUND: 404,
  LESSON_NAME_DUPLICATE: 409,
  LESSON_DISABLED: 422,
  LESSON_ALREADY_DISABLED: 422,
  LESSON_ALREADY_ENABLED: 422,
  LESSON_HAS_DEPENDENT_CONTENT: 409,
  VALIDATION_ERROR: 422,
}

vi.mock('../helpers', () => ({
  getDb: vi.fn(() => ({})),
  buildAuditCtx: vi.fn(() => ({
    user_id: 'user-001',
    correlation_id: 'corr-001',
    workspace_slug: 'test-ws',
    workspace_id: 'ws-001',
  })),
  successResponse: (data: unknown) => ({ success: true, data, error: null }),
  lessonsErrorResponse: (
    c: { json: (data: unknown, status?: number) => unknown },
    err: unknown
  ) => {
    if (err !== null && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code
      const status = LESSONS_HTTP_STATUS[code] ?? 500
      return c.json({ success: false, data: null, error: { code, message: code } }, status)
    }
    if (
      err !== null &&
      typeof err === 'object' &&
      'name' in err &&
      (err as { name: string }).name === 'ZodError'
    ) {
      return c.json(
        {
          success: false,
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request data' },
        },
        422
      )
    }
    return c.json(
      {
        success: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      },
      500
    )
  },
}))

// ---------------------------------------------------------------------------
// Import handlers and service mocks (after vi.mock hoisting)
// ---------------------------------------------------------------------------

import {
  createLesson,
  deleteLesson,
  getActiveLessons,
  getLesson,
  LessonError,
  listLessons,
  updateLesson,
} from '@zidney/domain-core/lessons'

import { createLessonHandler } from '../create-lesson'
import { deleteLessonHandler } from '../delete-lesson'
import { getActiveLessonsHandler } from '../get-active-lessons'
import { getLessonHandler } from '../get-lesson'
import { listLessonsHandler } from '../list-lessons'
import { updateLessonHandler } from '../update-lesson'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-21T12:00:00Z')

// Valid UUIDs required by zod .uuid() validation
const LESSON_ID = '11111111-1111-1111-1111-111111111111'
const SUBJECT_ID = '22222222-2222-2222-2222-222222222222'

const mockLesson = {
  id: LESSON_ID,
  subject_id: SUBJECT_ID,
  name: 'Introduction to Algebra',
  description: null,
  status: 'ENABLED' as const,
  created_by: 'user-001',
  updated_by: 'user-001',
  created_at: NOW,
  updated_at: NOW,
}

// ---------------------------------------------------------------------------
// Context factory
// ---------------------------------------------------------------------------

function makeCtx(
  overrides: {
    params?: Record<string, string>
    query?: Record<string, string>
    body?: Record<string, unknown>
  } = {}
): Context {
  const params = overrides.params ?? {}
  const query = overrides.query ?? {}
  return {
    req: {
      param: vi.fn((key?: string) => (key === undefined ? params : (params[key] ?? ''))),
      json: vi.fn(async () => overrides.body ?? {}),
      query: vi.fn((key?: string) => (key === undefined ? query : (query[key] ?? ''))),
    },
    get: vi.fn((key: string) => {
      const vals: Record<string, string> = {
        correlation_id: 'corr-001',
        workspace_id: 'ws-001',
        workspace_slug: 'test-ws',
        user_id: 'user-001',
        user_type: 'ADMIN',
      }
      return vals[key] ?? ''
    }),
    set: vi.fn(),
    json: vi.fn((data: unknown, status?: number) => ({ data, status })),
  } as unknown as Context
}

function makeLessonError(code: string): LessonError {
  // @ts-expect-error — LessonError may not match the mocked class type exactly
  return new LessonError(code)
}

// ---------------------------------------------------------------------------
// listLessons
// ---------------------------------------------------------------------------

describe('GET /lessons — listLessonsHandler', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('returns 200 with paginated items', async () => {
    vi.mocked(listLessons).mockResolvedValueOnce({
      items: [mockLesson],
      total: 1,
      page: 1,
      limit: 20,
    })

    const c = makeCtx({ query: { page: '1', limit: '20' } })
    await listLessonsHandler(c)

    expect(vi.mocked(c.json).mock.calls[0]?.[0]).toMatchObject({
      success: true,
      data: { items: [expect.objectContaining({ id: LESSON_ID })], total: 1 },
    })
  })

  it('filters by subject_id when provided', async () => {
    vi.mocked(listLessons).mockResolvedValueOnce({
      items: [mockLesson],
      total: 1,
      page: 1,
      limit: 20,
    })

    const c = makeCtx({ query: { subject_id: SUBJECT_ID } })
    await listLessonsHandler(c)

    expect(vi.mocked(listLessons)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ subject_id: SUBJECT_ID })
    )
  })

  it('returns 500 on unexpected error', async () => {
    vi.mocked(listLessons).mockRejectedValueOnce(new Error('db down'))

    const c = makeCtx({ query: {} })
    await listLessonsHandler(c)

    expect(vi.mocked(c.json).mock.calls[0]?.[0]).toMatchObject({ success: false })
  })
})

// ---------------------------------------------------------------------------
// getActiveLessons (runtime)
// ---------------------------------------------------------------------------

describe('GET /lessons/runtime — getActiveLessonsHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with active lessons for a valid subject_id', async () => {
    vi.mocked(getActiveLessons).mockResolvedValueOnce([
      { id: LESSON_ID, name: 'Introduction to Algebra', description: null },
    ])

    const c = makeCtx({ query: { subject_id: SUBJECT_ID } })
    await getActiveLessonsHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })

  it('returns 404 on LESSON_SUBJECT_NOT_FOUND', async () => {
    vi.mocked(getActiveLessons).mockRejectedValueOnce(makeLessonError('LESSON_SUBJECT_NOT_FOUND'))

    const c = makeCtx({ query: { subject_id: SUBJECT_ID } })
    await getActiveLessonsHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })
})

// ---------------------------------------------------------------------------
// createLesson
// ---------------------------------------------------------------------------

describe('POST /lessons — createLessonHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 on success', async () => {
    vi.mocked(createLesson).mockResolvedValueOnce(mockLesson)

    const c = makeCtx({
      body: { subject_id: SUBJECT_ID, name: 'Introduction to Algebra' },
    })
    await createLessonHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 201)
  })

  it('returns 409 on LESSON_NAME_DUPLICATE', async () => {
    vi.mocked(createLesson).mockRejectedValueOnce(makeLessonError('LESSON_NAME_DUPLICATE'))

    const c = makeCtx({ body: { subject_id: SUBJECT_ID, name: 'Introduction to Algebra' } })
    await createLessonHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'LESSON_NAME_DUPLICATE' }),
      }),
      409
    )
  })

  it('returns 404 on LESSON_SUBJECT_NOT_FOUND', async () => {
    vi.mocked(createLesson).mockRejectedValueOnce(makeLessonError('LESSON_SUBJECT_NOT_FOUND'))

    const c = makeCtx({ body: { subject_id: SUBJECT_ID, name: 'Introduction to Algebra' } })
    await createLessonHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })
})

// ---------------------------------------------------------------------------
// getLesson
// ---------------------------------------------------------------------------

describe('GET /lessons/:id — getLessonHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with lesson data', async () => {
    vi.mocked(getLesson).mockResolvedValueOnce(mockLesson)

    const c = makeCtx({ params: { id: LESSON_ID } })
    await getLessonHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: LESSON_ID }),
      }),
      200
    )
  })

  it('returns 404 on LESSON_NOT_FOUND', async () => {
    vi.mocked(getLesson).mockRejectedValueOnce(makeLessonError('LESSON_NOT_FOUND'))

    const c = makeCtx({ params: { id: LESSON_ID } })
    await getLessonHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'LESSON_NOT_FOUND' }),
      }),
      404
    )
  })

  it('returns 422 on invalid UUID param', async () => {
    const c = makeCtx({ params: { id: 'not-a-uuid' } })
    await getLessonHandler(c)

    // ZodError triggers lessonsErrorResponse → 422
    expect(vi.mocked(c.json).mock.calls[0]?.[1]).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// updateLesson
// ---------------------------------------------------------------------------

describe('PATCH /lessons/:id — updateLessonHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 on success', async () => {
    vi.mocked(updateLesson).mockResolvedValueOnce({ ...mockLesson, name: 'Advanced Algebra' })

    const c = makeCtx({ params: { id: LESSON_ID }, body: { name: 'Advanced Algebra' } })
    await updateLessonHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })

  it('returns 422 on LESSON_DISABLED (editing non-status field)', async () => {
    vi.mocked(updateLesson).mockRejectedValueOnce(makeLessonError('LESSON_DISABLED'))

    const c = makeCtx({ params: { id: LESSON_ID }, body: { name: 'New Name' } })
    await updateLessonHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'LESSON_DISABLED' }),
      }),
      422
    )
  })

  it('returns 409 on LESSON_NAME_DUPLICATE', async () => {
    vi.mocked(updateLesson).mockRejectedValueOnce(makeLessonError('LESSON_NAME_DUPLICATE'))

    const c = makeCtx({ params: { id: LESSON_ID }, body: { name: 'Existing Lesson' } })
    await updateLessonHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'LESSON_NAME_DUPLICATE' }),
      }),
      409
    )
  })

  it('returns 404 on LESSON_NOT_FOUND', async () => {
    vi.mocked(updateLesson).mockRejectedValueOnce(makeLessonError('LESSON_NOT_FOUND'))

    const c = makeCtx({ params: { id: LESSON_ID }, body: { name: 'New Name' } })
    await updateLessonHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'LESSON_NOT_FOUND' }) }),
      404
    )
  })
})

// ---------------------------------------------------------------------------
// deleteLesson
// ---------------------------------------------------------------------------

describe('DELETE /lessons/:id — deleteLessonHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with deleted: true', async () => {
    vi.mocked(deleteLesson).mockResolvedValueOnce({ deleted: true })

    const c = makeCtx({ params: { id: LESSON_ID } })
    await deleteLessonHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deleted: true }) }),
      200
    )
  })

  it('returns 404 on LESSON_NOT_FOUND', async () => {
    vi.mocked(deleteLesson).mockRejectedValueOnce(makeLessonError('LESSON_NOT_FOUND'))

    const c = makeCtx({ params: { id: LESSON_ID } })
    await deleteLessonHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'LESSON_NOT_FOUND' }),
      }),
      404
    )
  })

  it('returns 422 on LESSON_ALREADY_DISABLED', async () => {
    vi.mocked(deleteLesson).mockRejectedValueOnce(makeLessonError('LESSON_ALREADY_DISABLED'))

    const c = makeCtx({ params: { id: LESSON_ID } })
    await deleteLessonHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'LESSON_ALREADY_DISABLED' }),
      }),
      422
    )
  })
})
