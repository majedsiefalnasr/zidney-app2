/**
 * Baskets CRUD Route Integration Tests — STAGE_33_MCQ_BASKETS
 *
 * File: apps/api/src/routes/backoffice/baskets/__tests__/baskets.crud.test.ts
 *
 * Covers: createBasket, listBaskets, getBasket, updateBasket, deleteBasket handlers
 * Uses vi.mock to isolate the domain service and Hono context factories.
 */

import type { Context } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Service Mock
// ---------------------------------------------------------------------------

const mockCreateBasket = vi.fn()
const mockListBaskets = vi.fn()
const mockGetBasket = vi.fn()
const mockUpdateBasket = vi.fn()
const mockDeleteBasket = vi.fn()

vi.mock('@zidney/domain-core/baskets', () => ({
  BasketError: class BasketError extends Error {
    code: string
    constructor(code: string, message?: string) {
      super(message ?? code)
      this.code = code
      this.name = 'BasketError'
    }
  },
  BASKET_ERROR_HTTP_STATUS: {
    BASKET_NOT_FOUND: 404,
    BASKET_CODE_DUPLICATE: 409,
    BASKET_QUESTION_DUPLICATE: 409,
    BASKET_QUESTION_NOT_FOUND: 404,
    BASKET_MAX_QUESTIONS_REACHED: 422,
    BASKET_EMPTY_CANNOT_ENABLE: 422,
    BASKET_EXCEEDS_MAX_QUESTIONS: 422,
    BASKET_REFERENCED_IN_EXAM_CONFIG: 422,
    BASKET_REFERENCED_IN_AUTO_SELECTION: 422,
    QUESTION_NOT_FOUND: 404,
    INVALID_STATE_TRANSITION: 400,
    VALIDATION_ERROR: 422,
    FORBIDDEN: 403,
  },
  BASKET_ERROR_MESSAGES: {
    BASKET_NOT_FOUND: 'Basket not found.',
    BASKET_CODE_DUPLICATE: 'A basket with this code already exists.',
    BASKET_REFERENCED_IN_EXAM_CONFIG: 'Basket cannot be deleted.',
    BASKET_REFERENCED_IN_AUTO_SELECTION: 'Basket cannot be deleted.',
    INVALID_STATE_TRANSITION: 'Invalid transition.',
    BASKET_EMPTY_CANNOT_ENABLE: 'Basket is empty.',
    BASKET_EXCEEDS_MAX_QUESTIONS: 'Exceeds max questions.',
    BASKET_MAX_QUESTIONS_REACHED: 'Max questions reached.',
    BASKET_QUESTION_DUPLICATE: 'Already linked.',
    BASKET_QUESTION_NOT_FOUND: 'Link not found.',
    QUESTION_NOT_FOUND: 'Question not found.',
    FORBIDDEN: 'Forbidden.',
    VALIDATION_ERROR: 'Validation failed.',
  },
  createBasket: (...args: unknown[]) => mockCreateBasket(...args),
  listBaskets: (...args: unknown[]) => mockListBaskets(...args),
  getBasket: (...args: unknown[]) => mockGetBasket(...args),
  updateBasket: (...args: unknown[]) => mockUpdateBasket(...args),
  deleteBasket: (...args: unknown[]) => mockDeleteBasket(...args),
  transitionStatus: vi.fn(),
  linkQuestion: vi.fn(),
  unlinkQuestion: vi.fn(),
  listBasketQuestions: vi.fn(),
}))

vi.mock('@zidney/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

const mockGetDb = vi.fn(() => ({}))
const mockBuildAuditCtx = vi.fn(() => ({
  user_id: 'user-001',
  correlation_id: 'corr-001',
  workspace_slug: 'test-ws',
  workspace_id: 'ws-001',
  caller_permissions: [],
}))
const mockBuildBasketWorkflowPermissions = vi.fn(() => [])

vi.mock('../helpers', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
  buildAuditCtx: (...args: unknown[]) => mockBuildAuditCtx(...args),
  buildBasketWorkflowPermissions: (...args: unknown[]) =>
    mockBuildBasketWorkflowPermissions(...args),
  successResponse: (data: unknown) => ({ success: true, data, error: null }),
  basketsErrorResponse: (c: Context, err: unknown) => {
    const BASKET_ERROR_HTTP_STATUS: Record<string, number> = {
      BASKET_NOT_FOUND: 404,
      BASKET_CODE_DUPLICATE: 409,
      BASKET_QUESTION_DUPLICATE: 409,
      BASKET_QUESTION_NOT_FOUND: 404,
      BASKET_MAX_QUESTIONS_REACHED: 422,
      BASKET_EMPTY_CANNOT_ENABLE: 422,
      BASKET_EXCEEDS_MAX_QUESTIONS: 422,
      BASKET_REFERENCED_IN_EXAM_CONFIG: 422,
      BASKET_REFERENCED_IN_AUTO_SELECTION: 422,
      QUESTION_NOT_FOUND: 404,
      INVALID_STATE_TRANSITION: 400,
      VALIDATION_ERROR: 422,
      FORBIDDEN: 403,
    }
    if (err && typeof err === 'object' && 'code' in err && (err as any).name === 'BasketError') {
      const code = (err as any).code as string
      const status = BASKET_ERROR_HTTP_STATUS[code] ?? 500
      return c.json(
        { success: false, data: null, error: { code, message: (err as any).message } },
        status as any
      )
    }
    if (err instanceof Error && err.name === 'ZodError') {
      return c.json(
        {
          success: false,
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'Validation failed' },
        },
        422
      )
    }
    return c.json(
      {
        success: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' },
      },
      500
    )
  },
}))

// ---------------------------------------------------------------------------
// Handler imports (after mocks)
// ---------------------------------------------------------------------------

import { createBasketHandler } from '../create-basket'
import { deleteBasketHandler } from '../delete-basket'
import { getBasketHandler } from '../get-basket'
import { listBasketsHandler } from '../list-baskets'
import { updateBasketHandler } from '../update-basket'

// ---------------------------------------------------------------------------
// Context factory
// ---------------------------------------------------------------------------

const BASKET_ID = '11111111-1111-1111-1111-111111111111'
const NOW = new Date('2026-03-23T10:00:00Z')

function makeBasket(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: BASKET_ID,
    name: 'Chemistry Q-Bank',
    code: 'CHEM-001',
    type: 'LINKED',
    max_questions: null,
    description: null,
    status: 'DRAFT',
    question_count: 0,
    created_at: NOW,
    updated_at: NOW,
    created_by: 'user-001',
    updated_by: 'user-001',
    ...overrides,
  }
}

function makeCtx({
  params = {} as Record<string, string>,
  query = {} as Record<string, string>,
  body = {} as Record<string, unknown>,
} = {}) {
  const jsonResponses: { data: unknown; status?: number }[] = []
  const ctx = {
    req: {
      param: vi.fn((key?: string) => (key === undefined ? params : (params[key] ?? ''))),
      json: vi.fn(async () => body),
      query: vi.fn((key?: string) => (key === undefined ? query : (query[key] ?? ''))),
    },
    get: vi.fn((key: string) => {
      const map: Record<string, unknown> = {
        correlation_id: 'corr-001',
        workspace_id: 'ws-001',
        workspace_slug: 'test-ws',
        user: { id: 'user-001' },
        rbacContext: { permissions: ['question_manage'] },
      }
      return map[key] ?? ''
    }),
    set: vi.fn(),
    json: vi.fn((data: unknown, status?: number) => {
      jsonResponses.push({ data, status })
      return { data, status }
    }),
  } as unknown as Context

  return { ctx, jsonResponses }
}

// ---------------------------------------------------------------------------
// afterEach reset
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// createBasket handler
// ---------------------------------------------------------------------------

describe('createBasket handler', () => {
  it('returns 201 with created basket', async () => {
    const basket = makeBasket()
    mockCreateBasket.mockResolvedValueOnce(basket)

    const { ctx } = makeCtx({
      body: { name: 'Chemistry Q-Bank', code: 'CHEM-001', type: 'LINKED' },
    })

    await createBasketHandler(ctx)
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: basket }),
      201
    )
  })

  it('returns 409 when BASKET_CODE_DUPLICATE', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockCreateBasket.mockRejectedValueOnce(new BasketError('BASKET_CODE_DUPLICATE'))

    const { ctx } = makeCtx({ body: { name: 'X', code: 'CHEM-001', type: 'LINKED' } })
    await createBasketHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 409)
  })

  it('returns 422 when body fails validation', async () => {
    const { ctx } = makeCtx({ body: {} }) // missing required fields
    // Will fail Zod parse — basketsErrorResponse maps to 422
    await createBasketHandler(ctx)
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })
})

// ---------------------------------------------------------------------------
// listBaskets handler
// ---------------------------------------------------------------------------

describe('listBaskets handler', () => {
  it('returns 200 with paginated baskets', async () => {
    const result = { items: [makeBasket()], total: 1, page: 1, perPage: 20 }
    mockListBaskets.mockResolvedValueOnce(result)

    const { ctx } = makeCtx({ query: { page: '1', per_page: '20' } })
    await listBasketsHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: result }),
      200
    )
  })

  it('returns 200 with empty list', async () => {
    mockListBaskets.mockResolvedValueOnce({ items: [], total: 0, page: 1, perPage: 20 })
    const { ctx } = makeCtx()
    await listBasketsHandler(ctx)
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })
})

// ---------------------------------------------------------------------------
// getBasket handler
// ---------------------------------------------------------------------------

describe('getBasket handler', () => {
  it('returns 200 with basket data', async () => {
    const basket = makeBasket()
    mockGetBasket.mockResolvedValueOnce(basket)

    const { ctx } = makeCtx({ params: { basketId: BASKET_ID } })
    await getBasketHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: basket }),
      200
    )
  })

  it('returns 404 when BASKET_NOT_FOUND', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockGetBasket.mockRejectedValueOnce(new BasketError('BASKET_NOT_FOUND'))

    const { ctx } = makeCtx({ params: { basketId: BASKET_ID } })
    await getBasketHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })

  it('returns 422 when basketId param is invalid', async () => {
    const { ctx } = makeCtx({ params: {} }) // missing basketId
    await getBasketHandler(ctx)
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })
})

// ---------------------------------------------------------------------------
// updateBasket handler
// ---------------------------------------------------------------------------

describe('updateBasket handler', () => {
  it('returns 200 with updated basket', async () => {
    const basket = makeBasket({ name: 'Updated' })
    mockUpdateBasket.mockResolvedValueOnce(basket)

    const { ctx } = makeCtx({
      params: { basketId: BASKET_ID },
      body: { name: 'Updated' },
    })
    await updateBasketHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: basket }),
      200
    )
  })

  it('returns 404 when BASKET_NOT_FOUND', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockUpdateBasket.mockRejectedValueOnce(new BasketError('BASKET_NOT_FOUND'))

    const { ctx } = makeCtx({
      params: { basketId: BASKET_ID },
      body: { name: 'Updated' },
    })
    await updateBasketHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })

  it('returns 409 when BASKET_CODE_DUPLICATE', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockUpdateBasket.mockRejectedValueOnce(new BasketError('BASKET_CODE_DUPLICATE'))

    const { ctx } = makeCtx({
      params: { basketId: BASKET_ID },
      body: { code: 'CHEM-002' },
    })
    await updateBasketHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 409)
  })
})

// ---------------------------------------------------------------------------
// deleteBasket handler
// ---------------------------------------------------------------------------

describe('deleteBasket handler', () => {
  it('returns 200 with { deleted: true }', async () => {
    mockDeleteBasket.mockResolvedValueOnce(undefined)

    const { ctx } = makeCtx({ params: { basketId: BASKET_ID } })
    await deleteBasketHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { deleted: true } }),
      200
    )
  })

  it('returns 404 when BASKET_NOT_FOUND', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockDeleteBasket.mockRejectedValueOnce(new BasketError('BASKET_NOT_FOUND'))

    const { ctx } = makeCtx({ params: { basketId: BASKET_ID } })
    await deleteBasketHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })

  it('returns 422 when BASKET_REFERENCED_IN_EXAM_CONFIG', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockDeleteBasket.mockRejectedValueOnce(new BasketError('BASKET_REFERENCED_IN_EXAM_CONFIG'))

    const { ctx } = makeCtx({ params: { basketId: BASKET_ID } })
    await deleteBasketHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })
})
