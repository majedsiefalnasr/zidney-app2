/**
 * Categories Route Integration Tests — STAGE_30_CATEGORIES
 *
 * File: apps/api/src/routes/backoffice/categories/__tests__/categories.integration.test.ts
 *
 * Tests route handlers by mocking the domain service layer.
 * Verifies: request parsing, response shape, error mapping, HTTP status codes.
 */

import type { Context } from 'hono'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock domain service (must be hoisted before handler imports)
// ---------------------------------------------------------------------------

vi.mock('@zidney/domain-core/categories', () => ({
  CategoryError: class CategoryError extends Error {
    code: string
    constructor(code: string) {
      const messages: Record<string, string> = {
        CATEGORY_NOT_FOUND: 'Category not found.',
        CATEGORY_PARENT_NOT_FOUND: 'Parent category not found.',
        CATEGORY_NAME_DUPLICATE: 'A category with this name already exists.',
        CATEGORY_CODE_DUPLICATE: 'A category with this code already exists.',
        CATEGORY_CIRCULAR_REFERENCE: 'Setting this parent would create a circular reference.',
        CATEGORY_MAX_DEPTH_EXCEEDED: 'Maximum category depth of 3 levels exceeded.',
        CATEGORY_DISABLED: 'Category is disabled. Re-enable it before editing other fields.',
        CATEGORY_ALREADY_DISABLED: 'Category is already disabled.',
        CATEGORY_ALREADY_ENABLED: 'Category is already enabled.',
        CATEGORY_HAS_ENABLED_CHILDREN: 'Category has enabled subcategories and cannot be disabled.',
        CATEGORY_HAS_DEPENDENT_CONTENT: 'Category has dependent content and cannot be deleted.',
        CATEGORY_SUBJECT_NOT_FOUND: 'One or more subjects were not found.',
        CATEGORY_DIVISION_NOT_FOUND: 'One or more divisions were not found.',
        CATEGORY_LOCK_CONFLICT: 'Category is being modified by another request. Please retry.',
        VALIDATION_ERROR: 'Invalid request data.',
      }
      super(messages[code] ?? 'Unknown error.')
      this.name = 'CategoryError'
      this.code = code
    }
  },
  CATEGORY_ERROR_HTTP_STATUS: {
    CATEGORY_NOT_FOUND: 404,
    CATEGORY_PARENT_NOT_FOUND: 404,
    CATEGORY_SUBJECT_NOT_FOUND: 404,
    CATEGORY_DIVISION_NOT_FOUND: 404,
    CATEGORY_NAME_DUPLICATE: 409,
    CATEGORY_CODE_DUPLICATE: 409,
    CATEGORY_HAS_DEPENDENT_CONTENT: 409,
    CATEGORY_LOCK_CONFLICT: 409,
    CATEGORY_CIRCULAR_REFERENCE: 422,
    CATEGORY_MAX_DEPTH_EXCEEDED: 422,
    CATEGORY_DISABLED: 422,
    CATEGORY_ALREADY_DISABLED: 422,
    CATEGORY_ALREADY_ENABLED: 422,
    CATEGORY_HAS_ENABLED_CHILDREN: 422,
    VALIDATION_ERROR: 422,
  },
  CATEGORY_ERROR_MESSAGES: {
    CATEGORY_NOT_FOUND: 'Category not found.',
    CATEGORY_PARENT_NOT_FOUND: 'Parent category not found.',
    CATEGORY_NAME_DUPLICATE: 'A category with this name already exists.',
    CATEGORY_CODE_DUPLICATE: 'A category with this code already exists.',
    CATEGORY_CIRCULAR_REFERENCE: 'Setting this parent would create a circular reference.',
    CATEGORY_MAX_DEPTH_EXCEEDED: 'Maximum category depth of 3 levels exceeded.',
    CATEGORY_DISABLED: 'Category is disabled. Re-enable it before editing other fields.',
    CATEGORY_ALREADY_DISABLED: 'Category is already disabled.',
    CATEGORY_ALREADY_ENABLED: 'Category is already enabled.',
    CATEGORY_HAS_ENABLED_CHILDREN: 'Category has enabled subcategories and cannot be disabled.',
    CATEGORY_HAS_DEPENDENT_CONTENT: 'Category has dependent content and cannot be deleted.',
    CATEGORY_SUBJECT_NOT_FOUND: 'One or more subjects were not found.',
    CATEGORY_DIVISION_NOT_FOUND: 'One or more divisions were not found.',
    CATEGORY_LOCK_CONFLICT: 'Category is being modified by another request. Please retry.',
    VALIDATION_ERROR: 'Invalid request data.',
  },
  listCategories: vi.fn(),
  getCategory: vi.fn(),
  getCategoriesTree: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
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
// Mock helpers — bypass getDb/buildAuditCtx
// ---------------------------------------------------------------------------

const CATEGORIES_HTTP_STATUS: Record<string, number> = {
  CATEGORY_NOT_FOUND: 404,
  CATEGORY_PARENT_NOT_FOUND: 404,
  CATEGORY_SUBJECT_NOT_FOUND: 404,
  CATEGORY_DIVISION_NOT_FOUND: 404,
  CATEGORY_NAME_DUPLICATE: 409,
  CATEGORY_CODE_DUPLICATE: 409,
  CATEGORY_HAS_DEPENDENT_CONTENT: 409,
  CATEGORY_LOCK_CONFLICT: 409,
  CATEGORY_CIRCULAR_REFERENCE: 422,
  CATEGORY_MAX_DEPTH_EXCEEDED: 422,
  CATEGORY_DISABLED: 422,
  CATEGORY_ALREADY_DISABLED: 422,
  CATEGORY_ALREADY_ENABLED: 422,
  CATEGORY_HAS_ENABLED_CHILDREN: 422,
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
  categoriesErrorResponse: (
    c: { json: (data: unknown, status?: number) => unknown },
    err: unknown
  ) => {
    if (err !== null && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code
      const status = CATEGORIES_HTTP_STATUS[code] ?? 500
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
  CategoryError,
  createCategory,
  deleteCategory,
  getCategoriesTree,
  getCategory,
  listCategories,
  updateCategory,
} from '@zidney/domain-core/categories'

import { createCategoryHandler } from '../create-category'
import { deleteCategoryHandler } from '../delete-category'
import { getCategoryHandler } from '../get-category'
import { getCategoryTreeHandler } from '../get-category-tree'
import { listCategoriesHandler } from '../list-categories'
import { updateCategoryHandler } from '../update-category'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-22T12:00:00Z')

const CAT_ID = '11111111-1111-1111-1111-111111111111'
const PARENT_ID = '22222222-2222-2222-2222-222222222222'
const SUBJECT_ID = '33333333-3333-3333-3333-333333333333'
const DIVISION_ID = '44444444-4444-4444-4444-444444444444'

const mockCategory = {
  id: CAT_ID,
  name: 'Science',
  code: 'SCI',
  description: null,
  parent_id: null,
  status: 'ENABLED' as const,
  subject_ids: [SUBJECT_ID],
  division_ids: [DIVISION_ID],
  created_by: 'user-001',
  updated_by: 'user-001',
  created_at: NOW,
  updated_at: NOW,
}

function makeCategoryError(code: string): CategoryError {
  // @ts-expect-error — CategoryError may not match mocked class exactly
  return new CategoryError(code)
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
// listCategories
// ---------------------------------------------------------------------------

describe('GET /categories — listCategoriesHandler', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('returns 200 with paginated items', async () => {
    vi.mocked(listCategories).mockResolvedValueOnce({
      items: [mockCategory],
      total: 1,
      page: 1,
      limit: 20,
    })

    const c = makeCtx({ query: { page: '1', limit: '20' } })
    await listCategoriesHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          items: [expect.objectContaining({ id: CAT_ID })],
          total: 1,
        }),
      })
    )
  })

  it('filters by status when provided', async () => {
    vi.mocked(listCategories).mockResolvedValueOnce({
      items: [mockCategory],
      total: 1,
      page: 1,
      limit: 20,
    })

    const c = makeCtx({ query: { status: 'ENABLED' } })
    await listCategoriesHandler(c)

    expect(vi.mocked(listCategories)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'ENABLED' })
    )
  })

  it('filters by parent_id when provided', async () => {
    vi.mocked(listCategories).mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 20 })

    const c = makeCtx({ query: { parent_id: PARENT_ID } })
    await listCategoriesHandler(c)

    expect(vi.mocked(listCategories)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ parent_id: PARENT_ID })
    )
  })

  it('returns 500 on unexpected error', async () => {
    vi.mocked(listCategories).mockRejectedValueOnce(new Error('db down'))

    const c = makeCtx({ query: {} })
    await listCategoriesHandler(c)

    expect(vi.mocked(c.json).mock.calls[0]?.[0]).toMatchObject({ success: false })
  })
})

// ---------------------------------------------------------------------------
// createCategory
// ---------------------------------------------------------------------------

describe('POST /categories — createCategoryHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 on success', async () => {
    vi.mocked(createCategory).mockResolvedValueOnce(mockCategory)

    const c = makeCtx({ body: { name: 'Science' } })
    await createCategoryHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 201)
  })

  it('returns 409 on CATEGORY_NAME_DUPLICATE', async () => {
    vi.mocked(createCategory).mockRejectedValueOnce(makeCategoryError('CATEGORY_NAME_DUPLICATE'))

    const c = makeCtx({ body: { name: 'Science' } })
    await createCategoryHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'CATEGORY_NAME_DUPLICATE' }),
      }),
      409
    )
  })

  it('returns 409 on CATEGORY_CODE_DUPLICATE', async () => {
    vi.mocked(createCategory).mockRejectedValueOnce(makeCategoryError('CATEGORY_CODE_DUPLICATE'))

    const c = makeCtx({ body: { name: 'Science', code: 'SCI' } })
    await createCategoryHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_CODE_DUPLICATE' }),
      }),
      409
    )
  })

  it('returns 404 on CATEGORY_PARENT_NOT_FOUND', async () => {
    vi.mocked(createCategory).mockRejectedValueOnce(makeCategoryError('CATEGORY_PARENT_NOT_FOUND'))

    const c = makeCtx({ body: { name: 'Sub-science', parent_id: PARENT_ID } })
    await createCategoryHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })

  it('returns 422 on CATEGORY_MAX_DEPTH_EXCEEDED', async () => {
    vi.mocked(createCategory).mockRejectedValueOnce(
      makeCategoryError('CATEGORY_MAX_DEPTH_EXCEEDED')
    )

    const c = makeCtx({ body: { name: 'Deep category', parent_id: PARENT_ID } })
    await createCategoryHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })

  it('returns 404 on CATEGORY_SUBJECT_NOT_FOUND', async () => {
    vi.mocked(createCategory).mockRejectedValueOnce(makeCategoryError('CATEGORY_SUBJECT_NOT_FOUND'))

    const c = makeCtx({ body: { name: 'Science', subject_ids: [SUBJECT_ID] } })
    await createCategoryHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })
})

// ---------------------------------------------------------------------------
// getCategory
// ---------------------------------------------------------------------------

describe('GET /categories/:id — getCategoryHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with category data', async () => {
    vi.mocked(getCategory).mockResolvedValueOnce(mockCategory)

    const c = makeCtx({ params: { id: CAT_ID } })
    await getCategoryHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: CAT_ID }),
      })
    )
  })

  it('returns 404 on CATEGORY_NOT_FOUND', async () => {
    vi.mocked(getCategory).mockRejectedValueOnce(makeCategoryError('CATEGORY_NOT_FOUND'))

    const c = makeCtx({ params: { id: CAT_ID } })
    await getCategoryHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_NOT_FOUND' }),
      }),
      404
    )
  })

  it('returns 422 on invalid UUID param', async () => {
    const c = makeCtx({ params: { id: 'not-a-uuid' } })
    await getCategoryHandler(c)

    expect(vi.mocked(c.json).mock.calls[0]?.[1]).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// getCategoryTree
// ---------------------------------------------------------------------------

describe('GET /categories/tree — getCategoryTreeHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with tree array', async () => {
    vi.mocked(getCategoriesTree).mockResolvedValueOnce([{ ...mockCategory, children: [] }])

    const c = makeCtx()
    await getCategoryTreeHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.arrayContaining([expect.objectContaining({ id: CAT_ID })]),
      })
    )
  })

  it('returns 200 with empty array when no categories', async () => {
    vi.mocked(getCategoriesTree).mockResolvedValueOnce([])

    const c = makeCtx()
    await getCategoryTreeHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ data: [] }))
  })

  it('returns 500 on unexpected error', async () => {
    vi.mocked(getCategoriesTree).mockRejectedValueOnce(new Error('db timeout'))

    const c = makeCtx()
    await getCategoryTreeHandler(c)

    expect(vi.mocked(c.json).mock.calls[0]?.[0]).toMatchObject({ success: false })
  })
})

// ---------------------------------------------------------------------------
// updateCategory
// ---------------------------------------------------------------------------

describe('PATCH /categories/:id — updateCategoryHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 on success', async () => {
    vi.mocked(updateCategory).mockResolvedValueOnce({ ...mockCategory, name: 'Natural Science' })

    const c = makeCtx({ params: { id: CAT_ID }, body: { name: 'Natural Science' } })
    await updateCategoryHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
  })

  it('returns 422 on CATEGORY_DISABLED (editing structural field)', async () => {
    vi.mocked(updateCategory).mockRejectedValueOnce(makeCategoryError('CATEGORY_DISABLED'))

    const c = makeCtx({ params: { id: CAT_ID }, body: { name: 'New Name' } })
    await updateCategoryHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_DISABLED' }),
      }),
      422
    )
  })

  it('returns 409 on CATEGORY_LOCK_CONFLICT', async () => {
    vi.mocked(updateCategory).mockRejectedValueOnce(makeCategoryError('CATEGORY_LOCK_CONFLICT'))

    const c = makeCtx({ params: { id: CAT_ID }, body: { name: 'New Name' } })
    await updateCategoryHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_LOCK_CONFLICT' }),
      }),
      409
    )
  })

  it('returns 422 on CATEGORY_CIRCULAR_REFERENCE', async () => {
    vi.mocked(updateCategory).mockRejectedValueOnce(
      makeCategoryError('CATEGORY_CIRCULAR_REFERENCE')
    )

    const c = makeCtx({ params: { id: CAT_ID }, body: { parent_id: PARENT_ID } })
    await updateCategoryHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })

  it('returns 404 on CATEGORY_NOT_FOUND', async () => {
    vi.mocked(updateCategory).mockRejectedValueOnce(makeCategoryError('CATEGORY_NOT_FOUND'))

    const c = makeCtx({ params: { id: CAT_ID }, body: { name: 'New Name' } })
    await updateCategoryHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_NOT_FOUND' }),
      }),
      404
    )
  })

  it('returns 422 if no update fields provided (at-least-one refine)', async () => {
    const c = makeCtx({ params: { id: CAT_ID }, body: {} })
    await updateCategoryHandler(c)

    // Zod refine fires → ZodError → lessonsErrorResponse 422
    expect(vi.mocked(c.json).mock.calls[0]?.[1]).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// deleteCategory
// ---------------------------------------------------------------------------

describe('DELETE /categories/:id — deleteCategoryHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 204 on success', async () => {
    vi.mocked(deleteCategory).mockResolvedValueOnce(undefined)

    const c = makeCtx({ params: { id: CAT_ID } })
    await deleteCategoryHandler(c)

    // deleteCategoryHandler returns new Response(null, { status: 204 })
    // c.json is NOT called — just verify no error response was produced
    expect(vi.mocked(c.json)).not.toHaveBeenCalled()
  })

  it('returns 404 on CATEGORY_NOT_FOUND', async () => {
    vi.mocked(deleteCategory).mockRejectedValueOnce(makeCategoryError('CATEGORY_NOT_FOUND'))

    const c = makeCtx({ params: { id: CAT_ID } })
    await deleteCategoryHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_NOT_FOUND' }),
      }),
      404
    )
  })

  it('returns 422 on CATEGORY_HAS_ENABLED_CHILDREN', async () => {
    vi.mocked(deleteCategory).mockRejectedValueOnce(
      makeCategoryError('CATEGORY_HAS_ENABLED_CHILDREN')
    )

    const c = makeCtx({ params: { id: CAT_ID } })
    await deleteCategoryHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_HAS_ENABLED_CHILDREN' }),
      }),
      422
    )
  })

  it('returns 409 on CATEGORY_HAS_DEPENDENT_CONTENT', async () => {
    vi.mocked(deleteCategory).mockRejectedValueOnce(
      makeCategoryError('CATEGORY_HAS_DEPENDENT_CONTENT')
    )

    const c = makeCtx({ params: { id: CAT_ID } })
    await deleteCategoryHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_HAS_DEPENDENT_CONTENT' }),
      }),
      409
    )
  })

  it('returns 422 on CATEGORY_ALREADY_DISABLED', async () => {
    vi.mocked(deleteCategory).mockRejectedValueOnce(makeCategoryError('CATEGORY_ALREADY_DISABLED'))

    const c = makeCtx({ params: { id: CAT_ID } })
    await deleteCategoryHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CATEGORY_ALREADY_DISABLED' }),
      }),
      422
    )
  })

  it('returns 422 on invalid UUID param', async () => {
    const c = makeCtx({ params: { id: 'invalid' } })
    await deleteCategoryHandler(c)

    expect(vi.mocked(c.json).mock.calls[0]?.[1]).toBe(422)
  })
})
