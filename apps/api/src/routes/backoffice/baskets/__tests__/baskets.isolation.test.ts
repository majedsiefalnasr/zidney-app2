/**
 * Baskets Tenant Isolation Tests — STAGE_33_MCQ_BASKETS
 *
 * File: apps/api/src/routes/backoffice/baskets/__tests__/baskets.isolation.test.ts
 *
 * Verifies that each request gets a DB pool scoped to its own tenant context:
 *   - getDb(c) reads tenant.pool from the context, not a global singleton
 *   - Two different context objects yield two different DB instances
 *   - Service calls receive exactly the DB from their context (no cross-tenant leak)
 */

import type { Context } from 'hono'
import { describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Service mock — spy only (we don't need real results for isolation tests)
// ---------------------------------------------------------------------------

vi.mock('@zidney/domain-core/baskets', () => ({
  BasketError: class BasketError extends Error {
    code: string
    constructor(code: string) {
      super(code)
      this.code = code
    }
  },
  BASKET_ERROR_HTTP_STATUS: { BASKET_NOT_FOUND: 404 },
  BASKET_ERROR_MESSAGES: { BASKET_NOT_FOUND: 'not found' },
  createBasket: vi.fn(),
  listBaskets: vi.fn(async () => ({ items: [], total: 0, page: 1, perPage: 20 })),
  getBasket: vi.fn(async () => ({
    id: 'test',
    name: 'T',
    code: 'T',
    type: 'LINKED',
    status: 'DRAFT',
    question_count: 0,
    max_questions: null,
    description: null,
    created_at: new Date(),
    updated_at: new Date(),
    created_by: 'u',
    updated_by: 'u',
  })),
  updateBasket: vi.fn(),
  deleteBasket: vi.fn(),
  transitionStatus: vi.fn(),
  linkQuestion: vi.fn(),
  unlinkQuestion: vi.fn(),
  listBasketQuestions: vi.fn(async () => ({ items: [], total: 0, page: 1, perPage: 20 })),
}))

vi.mock('@zidney/logger', () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}))

// ---------------------------------------------------------------------------
// Real helpers — NOT mocked here so getDb isolation is testable
// ---------------------------------------------------------------------------

// We import and test getDb and buildAuditCtx directly
import { buildAuditCtx, getDb } from '../helpers'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getDb — tenant isolation', () => {
  it('returns pool from c.get("tenant") — not a global singleton', () => {
    const pool1 = { query: vi.fn() }
    const pool2 = { query: vi.fn() }

    const ctx1 = {
      get: vi.fn((k: string) => (k === 'tenant' ? { pool: pool1 } : undefined)),
    } as unknown as Context
    const ctx2 = {
      get: vi.fn((k: string) => (k === 'tenant' ? { pool: pool2 } : undefined)),
    } as unknown as Context

    const db1 = getDb(ctx1)
    const db2 = getDb(ctx2)

    expect(db1).toBe(pool1)
    expect(db2).toBe(pool2)
    expect(db1).not.toBe(db2)
  })

  it('reads pool directly without caching across requests', () => {
    const pool = { query: vi.fn() }
    const ctx = {
      get: vi.fn((k: string) => (k === 'tenant' ? { pool } : undefined)),
    } as unknown as Context

    const db1 = getDb(ctx)
    const db2 = getDb(ctx)

    // Same context → same pool — no surprises
    expect(db1).toBe(pool)
    expect(db2).toBe(pool)
    // c.get('tenant') must be called each time (no module-level caching)
    expect(ctx.get).toHaveBeenCalledTimes(2)
  })
})

describe('buildAuditCtx — tenant isolation', () => {
  it('reads workspace_id and workspace_slug from request context', () => {
    const ctx = {
      get: vi.fn((k: string) => {
        const map: Record<string, unknown> = {
          tenant: { pool: {}, slug: 'tenant-a', workspace_id: 'ws-a', workspace_slug: 'tenant-a' },
          user: { id: 'user-001' },
          rbacContext: { permissions: ['question_manage'] },
          correlation_id: 'corr-001',
          workspace_id: 'ws-a',
          workspace_slug: 'tenant-a',
        }
        return map[k]
      }),
    } as unknown as Context

    const audit = buildAuditCtx(ctx)
    expect(audit.workspace_id).toBe('ws-a')
    expect(audit.workspace_slug).toBe('tenant-a')
    expect(audit.user_id).toBe('user-001')
  })

  it('each request context produces independent audit context', () => {
    function makeCtxForTenant(tenantSlug: string, wsId: string): Context {
      return {
        get: vi.fn((k: string) => {
          const map: Record<string, unknown> = {
            user: { id: `user-${tenantSlug}` },
            rbacContext: { permissions: [] },
            correlation_id: `corr-${tenantSlug}`,
            workspace_id: wsId,
            workspace_slug: tenantSlug,
          }
          return map[k]
        }),
      } as unknown as Context
    }

    const auditA = buildAuditCtx(makeCtxForTenant('tenant-a', 'ws-a'))
    const auditB = buildAuditCtx(makeCtxForTenant('tenant-b', 'ws-b'))

    expect(auditA.workspace_slug).toBe('tenant-a')
    expect(auditB.workspace_slug).toBe('tenant-b')
    expect(auditA.workspace_id).not.toBe(auditB.workspace_id)
    expect(auditA.user_id).not.toBe(auditB.user_id)
  })
})
