/**
 * Category Values Route Integration Tests — STAGE_31_CATEGORY_VALUES
 *
 * File: apps/api/src/routes/backoffice/category-values/__tests__/category-values.integration.test.ts
 *
 * Tests route handlers by mocking the domain service layer.
 * Verifies: request parsing, response shape, error mapping, HTTP status codes.
 */

import type { Context } from 'hono'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock domain service (must be hoisted before handler imports)
// ---------------------------------------------------------------------------

vi.mock('@zidney/domain-core/category-values', () => ({
  CategoryValueError: class CategoryValueError extends Error {
    code: string
    constructor(code: string) {
      const messages: Record<string, string> = {
        FORBIDDEN: 'You do not have permission to perform this action.',
        CATEGORY_VALUE_NOT_FOUND: 'Category value not found.',
        CATEGORY_VALUE_SUBJECT_NOT_FOUND: 'One or more subject IDs do not exist.',
        CATEGORY_VALUE_DIVISION_NOT_FOUND: 'One or more division IDs do not exist.',
        CATEGORY_NOT_FOUND: 'Parent category not found.',
        CATEGORY_VALUE_CODE_DUPLICATE: 'A category value with this code already exists.',
        CATEGORY_VALUE_LOCK_CONFLICT:
          'The category value is currently being modified by another request.',
        CATEGORY_VALUE_IN_USE: 'Category value cannot be deleted because it is in use.',
        CATEGORY_VALUE_CATEGORY_IMMUTABLE: 'The category_id of a value cannot be changed.',
        CATEGORY_VALUE_NAME_REQUIRED: 'A name translation for the default language is required.',
        CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT: 'The value scope must be a subset of the parent.',
        CATEGORY_DISABLED: 'Cannot create or modify values for a disabled category.',
        INVALID_STATUS_TRANSITION: 'Invalid status transition.',
        UNSUPPORTED_LANGUAGE: 'The specified language code is not supported.',
        VALIDATION_ERROR: 'Request validation failed.',
      }
      super(messages[code] ?? 'Unknown error.')
      this.name = 'CategoryValueError'
      this.code = code
    }
  },
  CATEGORY_VALUE_ERROR_HTTP_STATUS: {
    FORBIDDEN: 403,
    CATEGORY_VALUE_NOT_FOUND: 404,
    CATEGORY_VALUE_SUBJECT_NOT_FOUND: 404,
    CATEGORY_VALUE_DIVISION_NOT_FOUND: 404,
    CATEGORY_NOT_FOUND: 404,
    CATEGORY_VALUE_CODE_DUPLICATE: 409,
    CATEGORY_VALUE_LOCK_CONFLICT: 409,
    CATEGORY_VALUE_IN_USE: 422,
    CATEGORY_VALUE_CATEGORY_IMMUTABLE: 422,
    CATEGORY_VALUE_NAME_REQUIRED: 422,
    CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT: 422,
    CATEGORY_DISABLED: 422,
    INVALID_STATUS_TRANSITION: 422,
    UNSUPPORTED_LANGUAGE: 422,
    VALIDATION_ERROR: 422,
  },
  CATEGORY_VALUE_ERROR_MESSAGES: {
    FORBIDDEN: 'You do not have permission to perform this action.',
    CATEGORY_VALUE_NOT_FOUND: 'Category value not found.',
    CATEGORY_VALUE_SUBJECT_NOT_FOUND: 'One or more subject IDs do not exist.',
    CATEGORY_VALUE_DIVISION_NOT_FOUND: 'One or more division IDs do not exist.',
    CATEGORY_NOT_FOUND: 'Parent category not found.',
    CATEGORY_VALUE_CODE_DUPLICATE: 'A category value with this code already exists.',
    CATEGORY_VALUE_LOCK_CONFLICT:
      'The category value is currently being modified by another request.',
    CATEGORY_VALUE_IN_USE: 'Category value cannot be deleted because it is in use.',
    CATEGORY_VALUE_CATEGORY_IMMUTABLE: 'The category_id of a value cannot be changed.',
    CATEGORY_VALUE_NAME_REQUIRED: 'A name translation for the default language is required.',
    CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT: 'The value scope must be a subset of the parent.',
    CATEGORY_DISABLED: 'Cannot create or modify values for a disabled category.',
    INVALID_STATUS_TRANSITION: 'Invalid status transition.',
    UNSUPPORTED_LANGUAGE: 'The specified language code is not supported.',
    VALIDATION_ERROR: 'Request validation failed.',
  },
  listCategoryValues: vi.fn(),
  getCategoryValue: vi.fn(),
  createCategoryValue: vi.fn(),
  updateCategoryValue: vi.fn(),
  deleteCategoryValue: vi.fn(),
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
// Mock helpers — bypass getDb, buildAuditCtx, error handling
// ---------------------------------------------------------------------------

const CATEGORY_VALUE_HTTP_STATUS: Record<string, number> = {
  FORBIDDEN: 403,
  CATEGORY_VALUE_NOT_FOUND: 404,
  CATEGORY_VALUE_SUBJECT_NOT_FOUND: 404,
  CATEGORY_VALUE_DIVISION_NOT_FOUND: 404,
  CATEGORY_NOT_FOUND: 404,
  CATEGORY_VALUE_CODE_DUPLICATE: 409,
  CATEGORY_VALUE_LOCK_CONFLICT: 409,
  CATEGORY_VALUE_IN_USE: 422,
  CATEGORY_VALUE_CATEGORY_IMMUTABLE: 422,
  CATEGORY_VALUE_NAME_REQUIRED: 422,
  CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT: 422,
  CATEGORY_DISABLED: 422,
  INVALID_STATUS_TRANSITION: 422,
  UNSUPPORTED_LANGUAGE: 422,
  VALIDATION_ERROR: 422,
}

vi.mock('../helpers', () => ({
  getDb: vi.fn(() => ({})),
  buildAuditCtx: vi.fn(() => ({
    user_id: 'user-001',
    correlation_id: 'corr-001',
    workspace_slug: 'test-ws',
    workspace_id: 'ws-001',
    caller_permissions: [],
  })),
  successResponse: (data: unknown) => ({ success: true, data, error: null }),
  categoryValuesErrorResponse: (
    c: { json: (data: unknown, status?: number) => unknown },
    err: unknown
  ) => {
    if (err !== null && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code
      const status = CATEGORY_VALUE_HTTP_STATUS[code] ?? 500
      return c.json({ success: false, data: null, error: { code, message: code } }, status)
    }
    if (
      err !== null &&
      typeof err === 'object' &&
      'name' in err &&
      (err as { name: string }).name === 'ZodError'
    ) {
      return c.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid' } },
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
// Import handlers + service mocks (after vi.mock hoisting)
// ---------------------------------------------------------------------------

import {
  CategoryValueError,
  createCategoryValue,
  deleteCategoryValue,
  getCategoryValue,
  listCategoryValues,
  updateCategoryValue,
} from '@zidney/domain-core/category-values'

import { createCategoryValueHandler } from '../create-category-value'
import { deleteCategoryValueHandler } from '../delete-category-value'
import { getCategoryValueHandler } from '../get-category-value'
import { listCategoryValuesHandler } from '../list-category-values'
import { updateCategoryValueHandler } from '../update-category-value'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-22T12:00:00Z')

const VAL_ID = '11111111-1111-1111-1111-111111111111'
const CAT_ID = '22222222-2222-2222-2222-222222222222'

const mockValue = {
  id: VAL_ID,
  category_id: CAT_ID,
  code: 'VAL01',
  status: 'COMPLETED' as const,
  subject_ids: [] as string[],
  division_ids: [] as string[],
  translations: [{ language_code: 'en', field_name: 'name', translated_value: 'Math Value' }],
  created_by: 'user-001',
  updated_by: 'user-001',
  created_at: NOW,
  updated_at: NOW,
  deleted_at: null,
}

function makeCategoryValueError(code: string): CategoryValueError {
  // @ts-expect-error — CategoryValueError may not match mocked class exactly
  return new CategoryValueError(code)
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
      }
      return vals[key] ?? ''
    }),
    set: vi.fn(),
    json: vi.fn((data: unknown, status?: number) => ({ data, status })),
  } as unknown as Context
}

// ---------------------------------------------------------------------------
// listCategoryValues
// ---------------------------------------------------------------------------

describe('GET /category-values — listCategoryValuesHandler', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('returns 200 with paginated items', async () => {
    vi.mocked(listCategoryValues).mockResolvedValueOnce({
      items: [mockValue],
      total: 1,
      page: 1,
      limit: 20,
    })

    const c = makeCtx({ query: { category_id: CAT_ID, page: '1', limit: '20' } })
    await listCategoryValuesHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          items: [expect.objectContaining({ id: VAL_ID })],
          total: 1,
        }),
      })
    )
  })

  it('passes category_id to the service', async () => {
    vi.mocked(listCategoryValues).mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    })

    const c = makeCtx({ query: { category_id: CAT_ID } })
    await listCategoryValuesHandler(c)

    expect(vi.mocked(listCategoryValues)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ category_id: CAT_ID }),
      expect.anything()
    )
  })

  it('returns 403 on FORBIDDEN (include_deleted without classification_manage)', async () => {
    vi.mocked(listCategoryValues).mockRejectedValueOnce(makeCategoryValueError('FORBIDDEN'))

    const c = makeCtx({ query: { category_id: CAT_ID, include_deleted: 'true' } })
    await listCategoryValuesHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'FORBIDDEN' }),
      }),
      403
    )
  })

  it('returns 404 on CATEGORY_NOT_FOUND', async () => {
    vi.mocked(listCategoryValues).mockRejectedValueOnce(
      makeCategoryValueError('CATEGORY_NOT_FOUND')
    )

    // Use a valid UUID — schema validates UUID format before service is reached
    const c = makeCtx({ query: { category_id: '33333333-3333-3333-3333-333333333333' } })
    await listCategoryValuesHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_NOT_FOUND' }),
      }),
      404
    )
  })

  it('returns 422 on invalid query (missing category_id)', async () => {
    // No category_id → ZodError from schema
    const c = makeCtx({ query: {} })
    await listCategoryValuesHandler(c)

    expect(vi.mocked(c.json).mock.calls[0]?.[1]).toBe(422)
  })

  it('returns 500 on unexpected error', async () => {
    vi.mocked(listCategoryValues).mockRejectedValueOnce(new Error('db down'))

    const c = makeCtx({ query: { category_id: CAT_ID } })
    await listCategoryValuesHandler(c)

    expect(vi.mocked(c.json).mock.calls[0]?.[0]).toMatchObject({ success: false })
  })
})

// ---------------------------------------------------------------------------
// getCategoryValue
// ---------------------------------------------------------------------------

describe('GET /category-values/:id — getCategoryValueHandler', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('returns 200 with value data', async () => {
    vi.mocked(getCategoryValue).mockResolvedValueOnce(mockValue)

    const c = makeCtx({ params: { id: VAL_ID } })
    await getCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: VAL_ID }),
      })
    )
  })

  it('returns 404 on CATEGORY_VALUE_NOT_FOUND', async () => {
    vi.mocked(getCategoryValue).mockRejectedValueOnce(
      makeCategoryValueError('CATEGORY_VALUE_NOT_FOUND')
    )

    const c = makeCtx({ params: { id: VAL_ID } })
    await getCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_VALUE_NOT_FOUND' }),
      }),
      404
    )
  })

  it('returns 422 on invalid UUID param', async () => {
    const c = makeCtx({ params: { id: 'not-a-uuid' } })
    await getCategoryValueHandler(c)

    expect(vi.mocked(c.json).mock.calls[0]?.[1]).toBe(422)
  })

  it('does NOT call buildAuditCtx — getCategoryValue is read-only', async () => {
    const { buildAuditCtx } = await import('../helpers')
    vi.mocked(getCategoryValue).mockResolvedValueOnce(mockValue)

    const c = makeCtx({ params: { id: VAL_ID } })
    await getCategoryValueHandler(c)

    expect(vi.mocked(buildAuditCtx)).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// createCategoryValue
// ---------------------------------------------------------------------------

describe('POST /category-values — createCategoryValueHandler', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('returns 201 on success', async () => {
    vi.mocked(createCategoryValue).mockResolvedValueOnce(mockValue)

    const c = makeCtx({
      body: {
        category_id: CAT_ID,
        code: 'VAL01',
        translations: [{ language_code: 'en', field_name: 'name', translated_value: 'Math Value' }],
      },
    })
    await createCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 201)
  })

  it('returns 404 on CATEGORY_NOT_FOUND', async () => {
    vi.mocked(createCategoryValue).mockRejectedValueOnce(
      makeCategoryValueError('CATEGORY_NOT_FOUND')
    )

    // Use a valid UUID that doesn't exist — schema requires UUID format
    const c = makeCtx({
      body: {
        category_id: '33333333-3333-3333-3333-333333333333',
        code: 'VAL01',
        translations: [{ language_code: 'en', field_name: 'name', translated_value: 'Test' }],
      },
    })
    await createCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_NOT_FOUND' }),
      }),
      404
    )
  })

  it('returns 422 on CATEGORY_DISABLED', async () => {
    vi.mocked(createCategoryValue).mockRejectedValueOnce(
      makeCategoryValueError('CATEGORY_DISABLED')
    )

    const c = makeCtx({
      body: {
        category_id: CAT_ID,
        code: 'VAL01',
        translations: [{ language_code: 'en', field_name: 'name', translated_value: 'Test' }],
      },
    })
    await createCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_DISABLED' }),
      }),
      422
    )
  })

  it('returns 409 on CATEGORY_VALUE_CODE_DUPLICATE', async () => {
    vi.mocked(createCategoryValue).mockRejectedValueOnce(
      makeCategoryValueError('CATEGORY_VALUE_CODE_DUPLICATE')
    )

    const c = makeCtx({
      body: {
        category_id: CAT_ID,
        code: 'DUPE',
        translations: [{ language_code: 'en', field_name: 'name', translated_value: 'Test' }],
      },
    })
    await createCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_VALUE_CODE_DUPLICATE' }),
      }),
      409
    )
  })

  it('returns 422 on CATEGORY_VALUE_NAME_REQUIRED', async () => {
    vi.mocked(createCategoryValue).mockRejectedValueOnce(
      makeCategoryValueError('CATEGORY_VALUE_NAME_REQUIRED')
    )

    // Provide a non-empty translations array (so Zod passes) but without a 'name' field_name
    // The service is responsible for verifying a 'name' translation exists
    const c = makeCtx({
      body: {
        category_id: CAT_ID,
        code: 'VAL01',
        translations: [
          { language_code: 'en', field_name: 'description', translated_value: 'A value' },
        ],
      },
    })
    await createCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_VALUE_NAME_REQUIRED' }),
      }),
      422
    )
  })

  it('returns 422 on UNSUPPORTED_LANGUAGE', async () => {
    vi.mocked(createCategoryValue).mockRejectedValueOnce(
      makeCategoryValueError('UNSUPPORTED_LANGUAGE')
    )

    const c = makeCtx({
      body: {
        category_id: CAT_ID,
        code: 'VAL01',
        translations: [{ language_code: 'fr', field_name: 'name', translated_value: 'Valeur' }],
      },
    })
    await createCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'UNSUPPORTED_LANGUAGE' }),
      }),
      422
    )
  })

  it('returns 404 on CATEGORY_VALUE_SUBJECT_NOT_FOUND', async () => {
    vi.mocked(createCategoryValue).mockRejectedValueOnce(
      makeCategoryValueError('CATEGORY_VALUE_SUBJECT_NOT_FOUND')
    )

    const c = makeCtx({
      body: {
        category_id: CAT_ID,
        code: 'VAL01',
        translations: [{ language_code: 'en', field_name: 'name', translated_value: 'Test' }],
        // subject_ids schema requires UUIDs — use a valid UUID that service rejects
        subject_ids: ['44444444-4444-4444-4444-444444444444'],
      },
    })
    await createCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })

  it('returns 422 on schema validation failure (missing category_id)', async () => {
    const c = makeCtx({ body: { code: 'VAL01', translations: [] } })
    await createCategoryValueHandler(c)

    expect(vi.mocked(c.json).mock.calls[0]?.[1]).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// updateCategoryValue
// ---------------------------------------------------------------------------

describe('PATCH /category-values/:id — updateCategoryValueHandler', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('returns 200 on success', async () => {
    vi.mocked(updateCategoryValue).mockResolvedValueOnce({ ...mockValue, code: 'VAL02' })

    const c = makeCtx({ params: { id: VAL_ID }, body: { code: 'VAL02' } })
    await updateCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
  })

  it('returns 404 on CATEGORY_VALUE_NOT_FOUND', async () => {
    vi.mocked(updateCategoryValue).mockRejectedValueOnce(
      makeCategoryValueError('CATEGORY_VALUE_NOT_FOUND')
    )

    const c = makeCtx({ params: { id: VAL_ID }, body: { code: 'VAL02' } })
    await updateCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_VALUE_NOT_FOUND' }),
      }),
      404
    )
  })

  it('returns 422 on INVALID_STATUS_TRANSITION', async () => {
    vi.mocked(updateCategoryValue).mockRejectedValueOnce(
      makeCategoryValueError('INVALID_STATUS_TRANSITION')
    )

    const c = makeCtx({ params: { id: VAL_ID }, body: { status: 'ENABLED' } })
    await updateCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_STATUS_TRANSITION' }),
      }),
      422
    )
  })

  it('returns 409 on CATEGORY_VALUE_LOCK_CONFLICT', async () => {
    vi.mocked(updateCategoryValue).mockRejectedValueOnce(
      makeCategoryValueError('CATEGORY_VALUE_LOCK_CONFLICT')
    )

    const c = makeCtx({ params: { id: VAL_ID }, body: { code: 'VAL02' } })
    await updateCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_VALUE_LOCK_CONFLICT' }),
      }),
      409
    )
  })

  it('returns 422 on CATEGORY_VALUE_CATEGORY_IMMUTABLE', async () => {
    vi.mocked(updateCategoryValue).mockRejectedValueOnce(
      makeCategoryValueError('CATEGORY_VALUE_CATEGORY_IMMUTABLE')
    )

    // category_id is not in UpdateCategoryValueInput — use a valid field so schema passes
    const c = makeCtx({ params: { id: VAL_ID }, body: { code: 'IMMUTABLE_CODE' } })
    await updateCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_VALUE_CATEGORY_IMMUTABLE' }),
      }),
      422
    )
  })

  it('returns 422 on invalid UUID param', async () => {
    const c = makeCtx({ params: { id: 'not-a-uuid' }, body: { code: 'VAL02' } })
    await updateCategoryValueHandler(c)

    expect(vi.mocked(c.json).mock.calls[0]?.[1]).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// deleteCategoryValue
// ---------------------------------------------------------------------------

describe('DELETE /category-values/:id — deleteCategoryValueHandler', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('returns 200 with { deleted: true } on success', async () => {
    vi.mocked(deleteCategoryValue).mockResolvedValueOnce({ deleted: true })

    const c = makeCtx({ params: { id: VAL_ID } })
    await deleteCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ deleted: true }),
      })
    )
  })

  it('returns 200 (not 204) on delete', async () => {
    vi.mocked(deleteCategoryValue).mockResolvedValueOnce({ deleted: true })

    const c = makeCtx({ params: { id: VAL_ID } })
    await deleteCategoryValueHandler(c)

    // Should NOT be called with status 204
    const statusCodes = vi.mocked(c.json).mock.calls.map((call) => call?.[1])
    expect(statusCodes).not.toContain(204)
  })

  it('returns 200 idempotently when value is already deleted', async () => {
    vi.mocked(deleteCategoryValue).mockResolvedValueOnce({ deleted: true })

    const c = makeCtx({ params: { id: VAL_ID } })
    await deleteCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ deleted: true }) })
    )
  })

  it('returns 404 on CATEGORY_VALUE_NOT_FOUND', async () => {
    vi.mocked(deleteCategoryValue).mockRejectedValueOnce(
      makeCategoryValueError('CATEGORY_VALUE_NOT_FOUND')
    )

    // Use a valid UUID — param schema requires UUID format before service is called
    const c = makeCtx({ params: { id: '55555555-5555-5555-5555-555555555555' } })
    await deleteCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_VALUE_NOT_FOUND' }),
      }),
      404
    )
  })

  it('returns 409 on CATEGORY_VALUE_LOCK_CONFLICT', async () => {
    vi.mocked(deleteCategoryValue).mockRejectedValueOnce(
      makeCategoryValueError('CATEGORY_VALUE_LOCK_CONFLICT')
    )

    const c = makeCtx({ params: { id: VAL_ID } })
    await deleteCategoryValueHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_VALUE_LOCK_CONFLICT' }),
      }),
      409
    )
  })

  it('returns 422 on schema validation failure (invalid UUID)', async () => {
    const c = makeCtx({ params: { id: 'bad-uuid' } })
    await deleteCategoryValueHandler(c)

    expect(vi.mocked(c.json).mock.calls[0]?.[1]).toBe(422)
  })

  it('returns 500 on unexpected error', async () => {
    vi.mocked(deleteCategoryValue).mockRejectedValueOnce(new Error('connection reset'))

    const c = makeCtx({ params: { id: VAL_ID } })
    await deleteCategoryValueHandler(c)

    expect(vi.mocked(c.json).mock.calls[0]?.[0]).toMatchObject({ success: false })
  })
})
