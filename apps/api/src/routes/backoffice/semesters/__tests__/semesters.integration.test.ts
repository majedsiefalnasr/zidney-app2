/**
 * Semesters Route Integration Tests — STAGE_27
 *
 * File: apps/api/src/routes/backoffice/semesters/__tests__/semesters.integration.test.ts
 *
 * Tests route handlers by mocking the domain service layer.
 * Verifies: request parsing, response shape, error mapping, HTTP status codes.
 */

import type { Context } from 'hono'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock domain service (must be hoisted before handler imports)
// ---------------------------------------------------------------------------

vi.mock('@zidney/domain-core/semesters', () => ({
  SemestersError: class SemestersError extends Error {
    code: string
    httpStatus: number
    constructor(code: string) {
      const messages: Record<string, [string, number]> = {
        SEMESTER_NOT_FOUND: ['Semester not found.', 404],
        SEMESTER_NAME_DUPLICATE: ['Semester name already exists.', 409],
        SEMESTER_DATE_RANGE_INVALID: ['Date range is invalid.', 422],
        SEMESTER_DISABLED: ['Semester is disabled.', 422],
        SEMESTER_HAS_STUDENTS: ['Semester has enrolled students.', 422],
        SEMESTER_HAS_SUBJECTS: ['Semester has assigned subjects.', 422],
        VALIDATION_ERROR: ['Validation error.', 422],
      }
      const [msg, status] = messages[code] ?? ['Unknown error.', 500]
      super(msg)
      this.name = 'SemestersError'
      this.code = code
      this.httpStatus = status
    }
  },
  SemesterStatus: { ENABLED: 'ENABLED', DISABLED: 'DISABLED' },
  listSemesters: vi.fn(),
  createSemester: vi.fn(),
  getSemesterById: vi.fn(),
  updateSemester: vi.fn(),
  deleteSemester: vi.fn(),
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
// Mock helpers — bypass getDb/buildAuditCtx; replace semestersErrorResponse
// with a code-based dispatcher so the mock SemestersError works correctly
// ---------------------------------------------------------------------------

const SEMESTERS_HTTP_STATUS: Record<string, number> = {
  SEMESTER_NOT_FOUND: 404,
  SEMESTER_NAME_DUPLICATE: 409,
  SEMESTER_DATE_RANGE_INVALID: 422,
  SEMESTER_DISABLED: 422,
  SEMESTER_HAS_STUDENTS: 422,
  SEMESTER_HAS_SUBJECTS: 422,
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
  semestersErrorResponse: (
    c: { json: (data: unknown, status?: number) => unknown },
    err: unknown
  ) => {
    if (err !== null && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code
      const status = SEMESTERS_HTTP_STATUS[code] ?? 500
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
  createSemester,
  deleteSemester,
  getSemesterById,
  listSemesters,
  SemestersError,
  updateSemester,
} from '@zidney/domain-core/semesters'

import { createSemesterHandler } from '../create-semester'
import { deleteSemesterHandler } from '../delete-semester'
import { getSemesterHandler } from '../get-semester'
import { listSemestersHandler } from '../list-semesters'
import { updateSemesterHandler } from '../update-semester'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-19T12:00:00Z')

// Valid UUIDs required by zod .uuid() validation
const SEM_ID = '11111111-1111-1111-1111-111111111111'

const mockSemester = {
  id: SEM_ID,
  name: 'Fall 2026',
  description: null,
  status: 'ENABLED' as const,
  start_date: '2026-09-01',
  end_date: '2026-12-31',
  deleted_at: null,
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

function makeSemestersError(code: string): SemestersError {
  // @ts-expect-error — SemestersError may not match the mocked class type exactly
  return new SemestersError(code)
}

// ---------------------------------------------------------------------------
// listSemesters
// ---------------------------------------------------------------------------

describe('GET /semesters — listSemestersHandler', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('returns 200 with paginated items', async () => {
    vi.mocked(listSemesters).mockResolvedValueOnce({
      items: [mockSemester],
      total: 1,
      page: 1,
      limit: 20,
    })

    const c = makeCtx({ query: { page: '1', limit: '20' } })
    const res = (await listSemestersHandler(c)) as any

    expect(res.status).toBe(200)
    expect(vi.mocked(c.json).mock.calls[0]?.[0]).toMatchObject({
      success: true,
      data: { items: [expect.objectContaining({ id: SEM_ID })], total: 1 },
    })
  })

  it('returns 500 on unexpected error', async () => {
    vi.mocked(listSemesters).mockRejectedValueOnce(new Error('db down'))

    const c = makeCtx({ query: {} })
    await listSemestersHandler(c)

    expect(vi.mocked(c.json).mock.calls[0]?.[0]).toMatchObject({ success: false })
  })
})

// ---------------------------------------------------------------------------
// createSemester
// ---------------------------------------------------------------------------

describe('POST /semesters — createSemesterHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 on success', async () => {
    vi.mocked(createSemester).mockResolvedValueOnce(mockSemester)

    const c = makeCtx({
      body: { name: 'Fall 2026', start_date: '2026-09-01', end_date: '2026-12-31' },
    })
    await createSemesterHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 201)
  })

  it('returns 409 on SEMESTER_NAME_DUPLICATE', async () => {
    vi.mocked(createSemester).mockRejectedValueOnce(makeSemestersError('SEMESTER_NAME_DUPLICATE'))

    const c = makeCtx({ body: { name: 'Fall 2026' } })
    await createSemesterHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'SEMESTER_NAME_DUPLICATE' }),
      }),
      409
    )
  })

  it('returns 422 on SEMESTER_DATE_RANGE_INVALID', async () => {
    vi.mocked(createSemester).mockRejectedValueOnce(
      makeSemestersError('SEMESTER_DATE_RANGE_INVALID')
    )

    const c = makeCtx({
      body: { name: 'Bad Range', start_date: '2026-12-31', end_date: '2026-01-01' },
    })
    await createSemesterHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })
})

// ---------------------------------------------------------------------------
// getSemesterById
// ---------------------------------------------------------------------------

describe('GET /semesters/:id — getSemesterHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with semester data', async () => {
    vi.mocked(getSemesterById).mockResolvedValueOnce(mockSemester)

    const c = makeCtx({ params: { id: SEM_ID } })
    await getSemesterHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: SEM_ID }),
      }),
      200
    )
  })

  it('returns 404 on SEMESTER_NOT_FOUND', async () => {
    vi.mocked(getSemesterById).mockRejectedValueOnce(makeSemestersError('SEMESTER_NOT_FOUND'))

    const c = makeCtx({ params: { id: SEM_ID } })
    await getSemesterHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'SEMESTER_NOT_FOUND' }),
      }),
      404
    )
  })

  it('returns 422 on invalid UUID param', async () => {
    const c = makeCtx({ params: { id: 'not-a-uuid' } })
    await getSemesterHandler(c)

    // ZodError triggers semestersErrorResponse → 422
    expect(vi.mocked(c.json).mock.calls[0]?.[1]).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// updateSemester
// ---------------------------------------------------------------------------

describe('PATCH /semesters/:id — updateSemesterHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 on success', async () => {
    vi.mocked(updateSemester).mockResolvedValueOnce(mockSemester)

    const c = makeCtx({ params: { id: SEM_ID }, body: { name: 'Updated Fall 2026' } })
    await updateSemesterHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })

  it('returns 409 on SEMESTER_NAME_DUPLICATE', async () => {
    vi.mocked(updateSemester).mockRejectedValueOnce(makeSemestersError('SEMESTER_NAME_DUPLICATE'))

    const c = makeCtx({ params: { id: SEM_ID }, body: { name: 'Spring 2026' } })
    await updateSemesterHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'SEMESTER_NAME_DUPLICATE' }),
      }),
      409
    )
  })
})

// ---------------------------------------------------------------------------
// deleteSemester
// ---------------------------------------------------------------------------

describe('DELETE /semesters/:id — deleteSemesterHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with deleted: true', async () => {
    vi.mocked(deleteSemester).mockResolvedValueOnce({ deleted: true })

    const c = makeCtx({ params: { id: SEM_ID } })
    await deleteSemesterHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deleted: true }) }),
      200
    )
  })

  it('returns 422 on SEMESTER_HAS_STUDENTS', async () => {
    vi.mocked(deleteSemester).mockRejectedValueOnce(makeSemestersError('SEMESTER_HAS_STUDENTS'))

    const c = makeCtx({ params: { id: SEM_ID } })
    await deleteSemesterHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'SEMESTER_HAS_STUDENTS' }),
      }),
      422
    )
  })

  it('returns 404 on SEMESTER_NOT_FOUND', async () => {
    vi.mocked(deleteSemester).mockRejectedValueOnce(makeSemestersError('SEMESTER_NOT_FOUND'))

    const c = makeCtx({ params: { id: SEM_ID } })
    await deleteSemesterHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'SEMESTER_NOT_FOUND' }) }),
      404
    )
  })
})
