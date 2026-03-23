/**
 * Baskets Workflow Route Integration Tests — STAGE_33_MCQ_BASKETS
 *
 * File: apps/api/src/routes/backoffice/baskets/__tests__/baskets.workflow.test.ts
 *
 * Covers the transitionBasket handler:
 *   - Successful state transitions
 *   - Error paths (BASKET_NOT_FOUND, BASKET_EMPTY_CANNOT_ENABLE, INVALID_STATE_TRANSITION)
 *   - RBAC permission bridging via buildBasketWorkflowPermissions
 *   - Request body validation
 */

import type { Context } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Service Mock
// ---------------------------------------------------------------------------

const mockTransitionStatus = vi.fn()

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
    INVALID_STATE_TRANSITION: 'Invalid workflow transition.',
    BASKET_EMPTY_CANNOT_ENABLE: 'Basket is empty.',
    BASKET_EXCEEDS_MAX_QUESTIONS: 'Exceeds max questions.',
  },
  createBasket: vi.fn(),
  listBaskets: vi.fn(),
  getBasket: vi.fn(),
  updateBasket: vi.fn(),
  deleteBasket: vi.fn(),
  transitionStatus: (...args: unknown[]) => mockTransitionStatus(...args),
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

const mockBuildBasketWorkflowPermissions = vi.fn(() => ['mcq_basket.complete', 'mcq_basket.review'])

vi.mock('../helpers', () => ({
  getDb: vi.fn(() => ({})),
  buildAuditCtx: vi.fn(() => ({
    user_id: 'user-001',
    correlation_id: 'corr-001',
    workspace_slug: 'test-ws',
    workspace_id: 'ws-001',
    caller_permissions: ['question_manage', 'content_manage'],
  })),
  buildBasketWorkflowPermissions: (...args: unknown[]) =>
    mockBuildBasketWorkflowPermissions(...args),
  successResponse: (data: unknown) => ({ success: true, data, error: null }),
  basketsErrorResponse: (c: Context, err: unknown) => {
    const BASKET_ERROR_HTTP_STATUS = {
      BASKET_NOT_FOUND: 404,
      INVALID_STATE_TRANSITION: 400,
      BASKET_EMPTY_CANNOT_ENABLE: 422,
      BASKET_EXCEEDS_MAX_QUESTIONS: 422,
    } as Record<string, number>
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
// Handler import (after mocks)
// ---------------------------------------------------------------------------

import { transitionBasketHandler } from '../transition-basket'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASKET_ID = '11111111-1111-1111-1111-111111111111'
const NOW = new Date('2026-03-23T10:00:00Z')

function makeTransitionResult(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tr-001',
    entityType: 'mcq_basket',
    entityId: BASKET_ID,
    previousState: 'DRAFT',
    newState: 'COMPLETED',
    transitionedAt: NOW.toISOString(),
    actorId: 'user-001',
    ...overrides,
  }
}

function makeCtx({
  params = {} as Record<string, string>,
  body = {} as Record<string, unknown>,
} = {}) {
  return {
    req: {
      param: vi.fn((key?: string) => (key === undefined ? params : (params[key] ?? ''))),
      json: vi.fn(async () => body),
      query: vi.fn((key?: string) => (key === undefined ? {} : '')),
    },
    get: vi.fn((key: string) => {
      const map: Record<string, unknown> = {
        correlation_id: 'corr-001',
        workspace_id: 'ws-001',
        workspace_slug: 'test-ws',
        user: { id: 'user-001' },
        rbacContext: { permissions: ['question_manage', 'content_manage'] },
      }
      return map[key] ?? ''
    }),
    set: vi.fn(),
    json: vi.fn((data: unknown, status?: number) => ({ data, status })),
  } as unknown as Context
}

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('transitionBasket handler', () => {
  it('returns 200 with transition result on success', async () => {
    const result = makeTransitionResult()
    mockTransitionStatus.mockResolvedValueOnce(result)

    const ctx = makeCtx({
      params: { basketId: BASKET_ID },
      body: { to: 'COMPLETED' },
    })

    await transitionBasketHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: result }),
      200
    )
  })

  it('calls buildBasketWorkflowPermissions with rbac caller_permissions', async () => {
    mockTransitionStatus.mockResolvedValueOnce(makeTransitionResult())

    const ctx = makeCtx({
      params: { basketId: BASKET_ID },
      body: { to: 'COMPLETED' },
    })

    await transitionBasketHandler(ctx)
    expect(mockBuildBasketWorkflowPermissions).toHaveBeenCalledWith(
      expect.arrayContaining(['question_manage', 'content_manage'])
    )
  })

  it('passes enginePermissions to transitionStatus', async () => {
    mockBuildBasketWorkflowPermissions.mockReturnValueOnce(['mcq_basket.complete'])
    mockTransitionStatus.mockResolvedValueOnce(makeTransitionResult())

    const ctx = makeCtx({
      params: { basketId: BASKET_ID },
      body: { to: 'COMPLETED' },
    })

    await transitionBasketHandler(ctx)
    expect(mockTransitionStatus).toHaveBeenCalledWith(
      expect.anything(), // db
      BASKET_ID,
      'COMPLETED',
      expect.objectContaining({ enginePermissions: ['mcq_basket.complete'] })
    )
  })

  it('returns 404 when BASKET_NOT_FOUND', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockTransitionStatus.mockRejectedValueOnce(new BasketError('BASKET_NOT_FOUND'))

    const ctx = makeCtx({ params: { basketId: BASKET_ID }, body: { to: 'COMPLETED' } })
    await transitionBasketHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })

  it('returns 400 when INVALID_STATE_TRANSITION', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockTransitionStatus.mockRejectedValueOnce(new BasketError('INVALID_STATE_TRANSITION'))

    const ctx = makeCtx({ params: { basketId: BASKET_ID }, body: { to: 'ENABLED' } })
    await transitionBasketHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 400)
  })

  it('returns 422 when BASKET_EMPTY_CANNOT_ENABLE', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockTransitionStatus.mockRejectedValueOnce(new BasketError('BASKET_EMPTY_CANNOT_ENABLE'))

    const ctx = makeCtx({ params: { basketId: BASKET_ID }, body: { to: 'ENABLED' } })
    await transitionBasketHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })

  it('returns 422 when body fails validation (missing "to" field)', async () => {
    const ctx = makeCtx({ params: { basketId: BASKET_ID }, body: {} })
    await transitionBasketHandler(ctx)
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })

  it('returns 422 when basketId param is missing', async () => {
    const ctx = makeCtx({ params: {}, body: { to: 'COMPLETED' } })
    await transitionBasketHandler(ctx)
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })
})
