/**
 * Subjects Route Integration Tests — STAGE_28
 *
 * File: apps/api/src/routes/backoffice/subjects/__tests__/subjects.integration.test.ts
 *
 * Tests route handlers by mocking the domain service layer.
 * Verifies: request parsing, response shape, error mapping, HTTP status codes.
 */

import type { Context } from 'hono'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock domain service (must be hoisted before handler imports)
// ---------------------------------------------------------------------------

vi.mock('@zidney/domain-core/subjects', () => ({
  SubjectsError: class SubjectsError extends Error {
    code: string
    httpStatus: number
    constructor(code: string) {
      const messages: Record<string, [string, number]> = {
        SUBJECT_NOT_FOUND: ['Subject not found.', 404],
        SUBJECT_NAME_DUPLICATE: ['A subject with this name already exists.', 409],
        SUBJECT_CODE_DUPLICATE: ['A subject with this code already exists.', 409],
        SUBJECT_DIVISION_NOT_FOUND: ['Division not found.', 404],
        SUBJECT_SEMESTER_NOT_FOUND: ['Semester not found.', 404],
        SUBJECT_SEMESTER_DIVISION_MISMATCH: [
          'Semester does not belong to the specified division.',
          422,
        ],
        SUBJECT_INVALID_TRANSITION: ['Invalid status transition.', 422],
        SUBJECT_TRANSITION_CONFLICT: ['Subject status was updated concurrently.', 409],
        SUBJECT_ARCHIVED: ['Subject is archived and cannot be modified.', 422],
        SUBJECT_HAS_DEPENDENT_CONTENT: [
          'Subject has dependent content and cannot be deleted.',
          422,
        ],
        SUBJECT_DIVISION_DISABLED: ['Divisions are disabled for this workspace.', 422],
        SUBJECT_MISSING_TRANSLATIONS: ['Subject is missing required translations.', 422],
        SUBJECT_INVALID_DEFAULT_LANGUAGE: ['The specified default language is not valid.', 422],
        VALIDATION_ERROR: ['Invalid request data.', 422],
      }
      const [msg, status] = messages[code] ?? ['Unknown error.', 500]
      super(msg)
      this.name = 'SubjectsError'
      this.code = code
      this.httpStatus = status
    }
  },
  SubjectStatus: { DRAFT: 'DRAFT', ACTIVE: 'ACTIVE', ARCHIVED: 'ARCHIVED' },
  listSubjects: vi.fn(),
  createSubject: vi.fn(),
  getSubjectById: vi.fn(),
  updateSubject: vi.fn(),
  transitionSubjectStatus: vi.fn(),
  deleteSubject: vi.fn(),
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
// Mock helpers — bypass getDb/buildAuditCtx; replace subjectsErrorResponse
// with a code-based dispatcher so the mock SubjectsError works correctly
// ---------------------------------------------------------------------------

const SUBJECTS_HTTP_STATUS: Record<string, number> = {
  SUBJECT_NOT_FOUND: 404,
  SUBJECT_NAME_DUPLICATE: 409,
  SUBJECT_CODE_DUPLICATE: 409,
  SUBJECT_DIVISION_NOT_FOUND: 404,
  SUBJECT_SEMESTER_NOT_FOUND: 404,
  SUBJECT_SEMESTER_DIVISION_MISMATCH: 422,
  SUBJECT_INVALID_TRANSITION: 422,
  SUBJECT_TRANSITION_CONFLICT: 409,
  SUBJECT_ARCHIVED: 422,
  SUBJECT_HAS_DEPENDENT_CONTENT: 422,
  SUBJECT_DIVISION_DISABLED: 422,
  SUBJECT_MISSING_TRANSLATIONS: 422,
  SUBJECT_INVALID_DEFAULT_LANGUAGE: 422,
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
  subjectsErrorResponse: (
    c: { json: (data: unknown, status?: number) => unknown },
    err: unknown
  ) => {
    if (err !== null && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code
      const status = SUBJECTS_HTTP_STATUS[code] ?? 500
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
  createSubject,
  deleteSubject,
  getSubjectById,
  listSubjects,
  SubjectsError,
  transitionSubjectStatus,
  updateSubject,
} from '@zidney/domain-core/subjects'

import { createSubjectHandler } from '../create-subject'
import { deleteSubjectHandler } from '../delete-subject'
import { getActiveSubjectsHandler } from '../get-active-subjects'
import { getSubjectHandler } from '../get-subject'
import { listSubjectsHandler } from '../list-subjects'
import { transitionSubjectHandler } from '../transition-subject'
import { updateSubjectHandler } from '../update-subject'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-20T12:00:00Z')

// Valid UUIDs required by zod .uuid() validation
const SUBJ_ID = '22222222-2222-2222-2222-222222222222'

const mockSubject = {
  id: SUBJ_ID,
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
}

const mockActiveSubject = { ...mockSubject, status: 'ACTIVE' as const }

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

function makeSubjectsError(code: string): SubjectsError {
  // @ts-expect-error — SubjectsError may not match the mocked class type exactly
  return new SubjectsError(code)
}

// ---------------------------------------------------------------------------
// listSubjects
// ---------------------------------------------------------------------------

describe('GET /subjects — listSubjectsHandler', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('returns 200 with paginated items', async () => {
    vi.mocked(listSubjects).mockResolvedValueOnce({
      items: [mockSubject],
      total: 1,
      page: 1,
      limit: 20,
    })

    const c = makeCtx({ query: { page: '1', limit: '20' } })
    await listSubjectsHandler(c)

    expect(vi.mocked(c.json).mock.calls[0]?.[0]).toMatchObject({
      success: true,
      data: { items: [expect.objectContaining({ id: SUBJ_ID })], total: 1 },
    })
  })

  it('returns 500 on unexpected error', async () => {
    vi.mocked(listSubjects).mockRejectedValueOnce(new Error('db down'))

    const c = makeCtx({ query: {} })
    await listSubjectsHandler(c)

    expect(vi.mocked(c.json).mock.calls[0]?.[0]).toMatchObject({ success: false })
  })
})

// ---------------------------------------------------------------------------
// getActiveSubjects (runtime)
// ---------------------------------------------------------------------------

describe('GET /subjects/runtime — getActiveSubjectsHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with results (status forced to ACTIVE)', async () => {
    vi.mocked(listSubjects).mockResolvedValueOnce({
      items: [mockActiveSubject],
      total: 1,
      page: 1,
      limit: 20,
    })

    const c = makeCtx({ query: { page: '1', limit: '20' } })
    await getActiveSubjectsHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })
})

// ---------------------------------------------------------------------------
// createSubject
// ---------------------------------------------------------------------------

describe('POST /subjects — createSubjectHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 on success', async () => {
    vi.mocked(createSubject).mockResolvedValueOnce(mockSubject)

    const c = makeCtx({
      body: { name: 'Mathematics', default_language: 'en' },
    })
    await createSubjectHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 201)
  })

  it('returns 409 on SUBJECT_NAME_DUPLICATE', async () => {
    vi.mocked(createSubject).mockRejectedValueOnce(makeSubjectsError('SUBJECT_NAME_DUPLICATE'))

    const c = makeCtx({ body: { name: 'Mathematics', default_language: 'en' } })
    await createSubjectHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'SUBJECT_NAME_DUPLICATE' }),
      }),
      409
    )
  })

  it('returns 404 on SUBJECT_DIVISION_NOT_FOUND', async () => {
    vi.mocked(createSubject).mockRejectedValueOnce(makeSubjectsError('SUBJECT_DIVISION_NOT_FOUND'))

    const c = makeCtx({
      body: { name: 'Mathematics', default_language: 'en', division_id: SUBJ_ID },
    })
    await createSubjectHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })
})

// ---------------------------------------------------------------------------
// getSubjectById
// ---------------------------------------------------------------------------

describe('GET /subjects/:id — getSubjectHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with subject data', async () => {
    vi.mocked(getSubjectById).mockResolvedValueOnce(mockSubject)

    const c = makeCtx({ params: { id: SUBJ_ID } })
    await getSubjectHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: SUBJ_ID }),
      }),
      200
    )
  })

  it('returns 404 on SUBJECT_NOT_FOUND', async () => {
    vi.mocked(getSubjectById).mockRejectedValueOnce(makeSubjectsError('SUBJECT_NOT_FOUND'))

    const c = makeCtx({ params: { id: SUBJ_ID } })
    await getSubjectHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'SUBJECT_NOT_FOUND' }),
      }),
      404
    )
  })

  it('returns 422 on invalid UUID param', async () => {
    const c = makeCtx({ params: { id: 'not-a-uuid' } })
    await getSubjectHandler(c)

    // ZodError triggers subjectsErrorResponse → 422
    expect(vi.mocked(c.json).mock.calls[0]?.[1]).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// updateSubject
// ---------------------------------------------------------------------------

describe('PATCH /subjects/:id — updateSubjectHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 on success', async () => {
    vi.mocked(updateSubject).mockResolvedValueOnce({ ...mockSubject, name: 'Advanced Math' })

    const c = makeCtx({ params: { id: SUBJ_ID }, body: { name: 'Advanced Math' } })
    await updateSubjectHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })

  it('returns 422 on SUBJECT_ARCHIVED', async () => {
    vi.mocked(updateSubject).mockRejectedValueOnce(makeSubjectsError('SUBJECT_ARCHIVED'))

    const c = makeCtx({ params: { id: SUBJ_ID }, body: { name: 'New Name' } })
    await updateSubjectHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'SUBJECT_ARCHIVED' }),
      }),
      422
    )
  })

  it('returns 404 on SUBJECT_NOT_FOUND', async () => {
    vi.mocked(updateSubject).mockRejectedValueOnce(makeSubjectsError('SUBJECT_NOT_FOUND'))

    const c = makeCtx({ params: { id: SUBJ_ID }, body: { name: 'New Name' } })
    await updateSubjectHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'SUBJECT_NOT_FOUND' }) }),
      404
    )
  })
})

// ---------------------------------------------------------------------------
// transitionSubjectStatus
// ---------------------------------------------------------------------------

describe('POST /subjects/:id/transition — transitionSubjectHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 on DRAFT → ACTIVE transition', async () => {
    vi.mocked(transitionSubjectStatus).mockResolvedValueOnce(mockActiveSubject)

    const c = makeCtx({
      params: { id: SUBJ_ID },
      body: { target_status: 'ACTIVE', expected_current_status: 'DRAFT' },
    })
    await transitionSubjectHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })

  it('returns 422 on SUBJECT_INVALID_TRANSITION', async () => {
    vi.mocked(transitionSubjectStatus).mockRejectedValueOnce(
      makeSubjectsError('SUBJECT_INVALID_TRANSITION')
    )

    const c = makeCtx({
      params: { id: SUBJ_ID },
      body: { target_status: 'DRAFT', expected_current_status: 'ARCHIVED' },
    })
    await transitionSubjectHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'SUBJECT_INVALID_TRANSITION' }),
      }),
      422
    )
  })

  it('returns 409 on SUBJECT_TRANSITION_CONFLICT', async () => {
    vi.mocked(transitionSubjectStatus).mockRejectedValueOnce(
      makeSubjectsError('SUBJECT_TRANSITION_CONFLICT')
    )

    const c = makeCtx({
      params: { id: SUBJ_ID },
      body: { target_status: 'ACTIVE', expected_current_status: 'DRAFT' },
    })
    await transitionSubjectHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'SUBJECT_TRANSITION_CONFLICT' }),
      }),
      409
    )
  })
})

// ---------------------------------------------------------------------------
// deleteSubject
// ---------------------------------------------------------------------------

describe('DELETE /subjects/:id — deleteSubjectHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with deleted: true', async () => {
    vi.mocked(deleteSubject).mockResolvedValueOnce(undefined as any)

    const c = makeCtx({ params: { id: SUBJ_ID } })
    await deleteSubjectHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deleted: true }) }),
      200
    )
  })

  it('returns 404 on SUBJECT_NOT_FOUND', async () => {
    vi.mocked(deleteSubject).mockRejectedValueOnce(makeSubjectsError('SUBJECT_NOT_FOUND'))

    const c = makeCtx({ params: { id: SUBJ_ID } })
    await deleteSubjectHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'SUBJECT_NOT_FOUND' }),
      }),
      404
    )
  })
})
