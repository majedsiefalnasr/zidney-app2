/**
 * Baskets Deletion Guard Route Tests — STAGE_33_MCQ_BASKETS
 *
 * File: apps/api/src/routes/backoffice/baskets/__tests__/baskets.deletion-guard.test.ts
 *
 * Verifies the full deletion guard contract:
 *   - BASKET_REFERENCED_IN_EXAM_CONFIG → 422 (basket cannot be deleted)
 *   - BASKET_REFERENCED_IN_AUTO_SELECTION → 422 (basket cannot be deleted)
 *   - Unreferenced basket → 200 { deleted: true }
 *   - BASKET_NOT_FOUND → 404
 *   - DB is scoped to Context (tenant isolation confirmed via getDb spy)
 */

import type { Context } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Service Mock
// ---------------------------------------------------------------------------

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
    BASKET_REFERENCED_IN_EXAM_CONFIG:
      'Basket cannot be deleted — referenced in exam configuration.',
    BASKET_REFERENCED_IN_AUTO_SELECTION: 'Basket cannot be deleted — referenced in auto-selection.',
  },
  createBasket: vi.fn(),
  listBaskets: vi.fn(),
  getBasket: vi.fn(),
  updateBasket: vi.fn(),
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

const mockGetDb = vi.fn()

vi.mock('../helpers', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
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
      BASKET_REFERENCED_IN_EXAM_CONFIG: 422,
      BASKET_REFERENCED_IN_AUTO_SELECTION: 422,
    } as Record<string, number>
    if (err && typeof err === 'object' && 'code' in err && (err as any).name === 'BasketError') {
      const code = (err as any).code as string
      const status = BASKET_ERROR_HTTP_STATUS[code] ?? 500
      return c.json(
        { success: false, data: null, error: { code, message: (err as any).message } },
        status as any
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

import { deleteBasketHandler } from '../delete-basket'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASKET_ID = '11111111-1111-1111-1111-111111111111'

function makeCtx({
  params = { basketId: BASKET_ID } as Record<string, string>,
  tenantPool = { query: vi.fn() },
}: {
  params?: Record<string, string>
  tenantPool?: { query: ReturnType<typeof vi.fn> }
} = {}) {
  // mockGetDb returns the pool tied to THIS context (simulates per-request scoping)
  mockGetDb.mockImplementation(() => tenantPool)

  return {
    req: {
      param: vi.fn((key?: string) => (key === undefined ? params : (params[key] ?? ''))),
      json: vi.fn(async () => ({})),
      query: vi.fn(() => ''),
    },
    get: vi.fn((key: string) => {
      if (key === 'tenant') return { pool: tenantPool }
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
// Tests
// ---------------------------------------------------------------------------

describe('deleteBasket handler — deletion guard', () => {
  it('returns 200 { deleted: true } when basket has no references', async () => {
    mockDeleteBasket.mockResolvedValueOnce(undefined)

    const ctx = makeCtx()
    await deleteBasketHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { deleted: true } }),
      200
    )
  })

  it('returns 422 when basket is referenced in exam configuration', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockDeleteBasket.mockRejectedValueOnce(
      new BasketError(
        'BASKET_REFERENCED_IN_EXAM_CONFIG',
        'Basket cannot be deleted — referenced in exam configuration.'
      )
    )

    const ctx = makeCtx()
    await deleteBasketHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'BASKET_REFERENCED_IN_EXAM_CONFIG' }),
      }),
      422
    )
  })

  it('returns 422 when basket is referenced in auto-selection rule', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockDeleteBasket.mockRejectedValueOnce(
      new BasketError(
        'BASKET_REFERENCED_IN_AUTO_SELECTION',
        'Basket cannot be deleted — referenced in auto-selection.'
      )
    )

    const ctx = makeCtx()
    await deleteBasketHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'BASKET_REFERENCED_IN_AUTO_SELECTION' }),
      }),
      422
    )
  })

  it('returns 404 when basket does not exist', async () => {
    const { BasketError } = await import('@zidney/domain-core/baskets')
    mockDeleteBasket.mockRejectedValueOnce(new BasketError('BASKET_NOT_FOUND'))

    const ctx = makeCtx()
    await deleteBasketHandler(ctx)

    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })

  it('receives the tenant-scoped DB pool from getDb (no cross-tenant leak)', async () => {
    mockDeleteBasket.mockResolvedValueOnce(undefined)

    const tenantPool = { query: vi.fn() }
    const ctx = makeCtx({ tenantPool })

    await deleteBasketHandler(ctx)

    // getDb must have been called once and returned the correct pool
    expect(mockGetDb).toHaveBeenCalledTimes(1)
    expect(mockGetDb).toHaveBeenCalledWith(ctx)

    // The service must have received that exact pool as the first argument
    expect(mockDeleteBasket).toHaveBeenCalledWith(tenantPool, BASKET_ID, expect.anything())
  })

  it('each context gets its own pool (isolation across tenants)', async () => {
    const pool1 = { query: vi.fn(), label: 'tenant-a' }
    const pool2 = { query: vi.fn(), label: 'tenant-b' }

    // First request
    mockDeleteBasket.mockResolvedValueOnce(undefined)
    const ctx1 = makeCtx({ tenantPool: pool1 })
    await deleteBasketHandler(ctx1)
    const firstCall = mockDeleteBasket.mock.calls[0]

    // Second request
    mockDeleteBasket.mockClear()
    mockGetDb.mockClear()
    mockDeleteBasket.mockResolvedValueOnce(undefined)
    const ctx2 = makeCtx({
      tenantPool: pool2,
      params: { basketId: '22222222-2222-2222-2222-222222222222' },
    })
    await deleteBasketHandler(ctx2)
    const secondCall = mockDeleteBasket.mock.calls[0]

    // Each call used a different pool
    expect(firstCall[0]).toBe(pool1)
    expect(secondCall[0]).toBe(pool2)
    expect(firstCall[0]).not.toBe(secondCall[0])
  })
})
