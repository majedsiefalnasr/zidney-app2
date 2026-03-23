/**
 * Baskets Questions Route Integration Tests — STAGE_33_MCQ_BASKETS
 *
 * File: apps/api/src/routes/backoffice/baskets/__tests__/baskets.questions.test.ts
 *
 * Covers: linkQuestion, unlinkQuestion, listBasketQuestions handlers
 */

import type { Context } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Service Mocks
// ---------------------------------------------------------------------------

const mockLinkQuestion = vi.fn()
const mockUnlinkQuestion = vi.fn()
const mockListBasketQuestions = vi.fn()

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
    BASKET_QUESTION_DUPLICATE: 'Already linked.',
    BASKET_QUESTION_NOT_FOUND: 'Link not found.',
    BASKET_MAX_QUESTIONS_REACHED: 'Max questions reached.',
    QUESTION_NOT_FOUND: 'Question not found.',
  },
  createBasket: vi.fn(),
  listBaskets: vi.fn(),
  getBasket: vi.fn(),
  updateBasket: vi.fn(),
  deleteBasket: vi.fn(),
  transitionStatus: vi.fn(),
  linkQuestion: (...args: unknown[]) => mockLinkQuestion(...args),
  unlinkQuestion: (...args: unknown[]) => mockUnlinkQuestion(...args),
  listBasketQuestions: (...args: unknown[]) => mockListBasketQuestions(...args),
}))

vi.mock('@zidney/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

vi.mock('../helpers', () => ({
  getDb: vi.fn(() => ({})),
  buildAuditCtx: vi.fn(() => ({
    user_id: 'user-001',
    correlation_id: 'corr-001',
    workspace_slug: 'test-ws',
    workspace_id: 'ws-001',
    caller_permissions: [],
  })),
  buildBasketWorkflowPermissions: vi.fn(() => []),
  successResponse: (data: unknown) => ({ success: true, data, error: null }),
  basketsErrorResponse: (c: Context, err: unknown) => {
    const BASKET_ERROR_HTTP_STATUS = {
      BASKET_NOT_FOUND: 404,
      QUESTION_NOT_FOUND: 404,
      BASKET_QUESTION_NOT_FOUND: 404,
      BASKET_QUESTION_DUPLICATE: 409,
      BASKET_MAX_QUESTIONS_REACHED: 422,
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
// Handler imports
// ---------------------------------------------------------------------------

import { linkQuestionHandler } from '../link-question'
import { listBasketQuestionsHandler } from '../list-questions'
import { unlinkQuestionHandler } from '../unlink-question'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASKET_ID = '11111111-1111-1111-1111-111111111111'
const QUESTION_ID = '22222222-2222-2222-2222-222222222222'
const LINK_ID = '33333333-3333-3333-3333-333333333333'
const NOW = new Date('2026-03-23T10:00:00Z')

function makeLinkRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: LINK_ID,
    basket_id: BASKET_ID,
    question_id: QUESTION_ID,
    created_at: NOW,
    ...overrides,
  }
}

function makeCtx({
  params = {} as Record<string, string>,
  query = {} as Record<string, string>,
  body = {} as Record<string, unknown>,
} = {}) {
  return {
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
    json: vi.fn((data: unknown, status?: number) => ({ data, status })),
  } as unknown as Context
}

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// linkQuestion handler
// ---------------------------------------------------------------------------

describe('linkQuestion handler', () => {
  it('returns 201 with created link on success', async () => {
    mockLinkQuestion.mockResolvedValueOnce(makeLinkRow())

    const ctx = makeCtx({
      params: { basketId: BASKET_ID },
      body: { questionId: QUESTION_ID },
    })

    await linkQuestionHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 201)
  })

  it('passes basket_id and question_id to service', async () => {
    mockLinkQuestion.mockResolvedValueOnce(makeLinkRow())

    const ctx = makeCtx({
      params: { basketId: BASKET_ID },
      body: { questionId: QUESTION_ID },
    })

    await linkQuestionHandler(ctx)

    expect(mockLinkQuestion).toHaveBeenCalledWith(
      expect.anything(), // db
      expect.objectContaining({ basket_id: BASKET_ID, question_id: QUESTION_ID }),
      expect.anything() // audit
    )
  })

  it('returns 404 when BASKET_NOT_FOUND', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockLinkQuestion.mockRejectedValueOnce(new BasketError('BASKET_NOT_FOUND'))

    const ctx = makeCtx({
      params: { basketId: BASKET_ID },
      body: { questionId: QUESTION_ID },
    })
    await linkQuestionHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })

  it('returns 404 when QUESTION_NOT_FOUND', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockLinkQuestion.mockRejectedValueOnce(new BasketError('QUESTION_NOT_FOUND'))

    const ctx = makeCtx({
      params: { basketId: BASKET_ID },
      body: { questionId: QUESTION_ID },
    })
    await linkQuestionHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })

  it('returns 409 when BASKET_QUESTION_DUPLICATE', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockLinkQuestion.mockRejectedValueOnce(new BasketError('BASKET_QUESTION_DUPLICATE'))

    const ctx = makeCtx({
      params: { basketId: BASKET_ID },
      body: { questionId: QUESTION_ID },
    })
    await linkQuestionHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 409)
  })

  it('returns 422 when BASKET_MAX_QUESTIONS_REACHED', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockLinkQuestion.mockRejectedValueOnce(new BasketError('BASKET_MAX_QUESTIONS_REACHED'))

    const ctx = makeCtx({
      params: { basketId: BASKET_ID },
      body: { questionId: QUESTION_ID },
    })
    await linkQuestionHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })

  it('returns 422 when body fails validation', async () => {
    const ctx = makeCtx({ params: { basketId: BASKET_ID }, body: {} })
    await linkQuestionHandler(ctx)
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })
})

// ---------------------------------------------------------------------------
// unlinkQuestion handler
// ---------------------------------------------------------------------------

describe('unlinkQuestion handler', () => {
  it('returns 200 with { deleted: true }', async () => {
    mockUnlinkQuestion.mockResolvedValueOnce(undefined)

    const ctx = makeCtx({ params: { basketId: BASKET_ID, questionId: QUESTION_ID } })
    await unlinkQuestionHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { deleted: true } }),
      200
    )
  })

  it('returns 404 when BASKET_NOT_FOUND', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockUnlinkQuestion.mockRejectedValueOnce(new BasketError('BASKET_NOT_FOUND'))

    const ctx = makeCtx({ params: { basketId: BASKET_ID, questionId: QUESTION_ID } })
    await unlinkQuestionHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })

  it('returns 404 when BASKET_QUESTION_NOT_FOUND', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockUnlinkQuestion.mockRejectedValueOnce(new BasketError('BASKET_QUESTION_NOT_FOUND'))

    const ctx = makeCtx({ params: { basketId: BASKET_ID, questionId: QUESTION_ID } })
    await unlinkQuestionHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })

  it('returns 422 when params missing', async () => {
    const ctx = makeCtx({ params: { basketId: BASKET_ID } }) // missing questionId
    await unlinkQuestionHandler(ctx)
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })
})

// ---------------------------------------------------------------------------
// listBasketQuestions handler
// ---------------------------------------------------------------------------

describe('listBasketQuestions handler', () => {
  it('returns 200 with paginated question links', async () => {
    const result = { items: [makeLinkRow()], total: 1, page: 1, perPage: 20 }
    mockListBasketQuestions.mockResolvedValueOnce(result)

    const ctx = makeCtx({
      params: { basketId: BASKET_ID },
      query: { page: '1', per_page: '20' },
    })
    await listBasketQuestionsHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: result }),
      200
    )
  })

  it('returns 200 with defaults when no pagination query params', async () => {
    const result = { items: [], total: 0, page: 1, perPage: 20 }
    mockListBasketQuestions.mockResolvedValueOnce(result)

    const ctx = makeCtx({ params: { basketId: BASKET_ID } })
    await listBasketQuestionsHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })

  it('returns 404 when BASKET_NOT_FOUND', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockListBasketQuestions.mockRejectedValueOnce(new BasketError('BASKET_NOT_FOUND'))

    const ctx = makeCtx({ params: { basketId: BASKET_ID } })
    await listBasketQuestionsHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })
})
