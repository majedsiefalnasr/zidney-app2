/**
 * Unit Tests: backoffice-rbac-guard middleware — STAGE_17
 *
 * File: tests/unit/middleware/backoffice-rbac-guard.test.ts
 * Task: T025
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 *
 * Scenarios:
 * (a) 403 + RBAC_PERMISSION_DENIED when user lacks permission
 * (b) next() called on valid role (DB returns has_permission=true)
 * (c) correlationId present in all 403 error bodies
 * (d) Redis cache hit returning '1' calls next() without DB query
 * (e) Redis cache hit returning '0' returns 403 without DB query
 * (f) Cache miss executes DB query and stores result in Redis
 * (g) Stale role (role deleted mid-session, DB returns no rows) → 403
 */

import type { ActionEnum, Module } from '@zidney/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBackofficeRBACGuard } from '../../../apps/api/src/middleware/backoffice-rbac-guard'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}

function makeTenant(
  overrides: Partial<{
    redisCachedValue: string | null
    dbHasPermission: boolean
  }> = {}
) {
  const { redisCachedValue = null, dbHasPermission = false } = overrides

  const redisGet = vi.fn().mockResolvedValue(redisCachedValue)
  const redisSet = vi.fn().mockResolvedValue('OK')
  const dbQuery = vi.fn().mockResolvedValue({
    rows: [{ has_permission: dbHasPermission }],
  })

  return {
    id: 'tenant-uuid-123',
    slug: 'test-workspace',
    pool: { query: dbQuery },
    redis: { get: redisGet, set: redisSet },
    _mocks: { redisGet, redisSet, dbQuery },
  }
}

function makeContext(
  overrides: Partial<{
    correlationId: string
    staffUser: { user_id: string; role_id: string }
    tenant: ReturnType<typeof makeTenant>
    enabledModules: string[]
  }> = {}
) {
  const {
    correlationId = 'corr-123',
    staffUser = { user_id: 'user-uuid', role_id: 'role-uuid' },
    tenant = makeTenant(),
    enabledModules = ['MCQ'],
  } = overrides

  const jsonFn = vi.fn().mockReturnValue({})
  const ctx = {
    get: vi.fn((key: string) => {
      const map: Record<string, unknown> = {
        correlationId,
        staff_user: staffUser,
        tenant,
        enabled_modules: enabledModules,
      }
      return map[key]
    }),
    json: jsonFn,
    req: {
      routePath: 'GET /api/v1/backoffice/mcq',
    },
  }
  return { ctx, jsonFn }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const MODULE_MCQ = 'MCQ' as Module
const ACTION_VIEW = 'view' as unknown as ActionEnum

describe('createBackofficeRBACGuard', () => {
  let logger: ReturnType<typeof makeLogger>

  beforeEach(() => {
    logger = makeLogger()
  })

  it('(a) returns 403 RBAC_PERMISSION_DENIED when DB says no permission', async () => {
    const tenant = makeTenant({ dbHasPermission: false })
    const { ctx, jsonFn } = makeContext({ tenant, enabledModules: ['MCQ'] })
    const next = vi.fn()

    const guard = createBackofficeRBACGuard(logger as any, MODULE_MCQ, ACTION_VIEW)
    await guard(ctx as any, next, undefined as any)

    expect(next).not.toHaveBeenCalled()
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'RBAC_PERMISSION_DENIED' }),
      }),
      403
    )
  })

  it('(b) calls next() when DB returns has_permission=true', async () => {
    const tenant = makeTenant({ dbHasPermission: true })
    const { ctx } = makeContext({ tenant, enabledModules: ['MCQ'] })
    const next = vi.fn()

    const guard = createBackofficeRBACGuard(logger as any, MODULE_MCQ, ACTION_VIEW)
    await guard(ctx as any, next, undefined as any)

    expect(next).toHaveBeenCalled()
  })

  it('(c) correlationId is present in 403 error body', async () => {
    const tenant = makeTenant({ dbHasPermission: false })
    const { ctx, jsonFn } = makeContext({
      tenant,
      correlationId: 'test-corr-id',
      enabledModules: ['MCQ'],
    })
    const next = vi.fn()

    const guard = createBackofficeRBACGuard(logger as any, MODULE_MCQ, ACTION_VIEW)
    await guard(ctx as any, next, undefined as any)

    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ correlationId: 'test-corr-id' }),
      }),
      403
    )
  })

  it("(d) cache hit returning '1' calls next() without DB query", async () => {
    const tenant = makeTenant({ redisCachedValue: '1' })
    const { ctx } = makeContext({ tenant, enabledModules: ['MCQ'] })
    const next = vi.fn()

    const guard = createBackofficeRBACGuard(logger as any, MODULE_MCQ, ACTION_VIEW)
    await guard(ctx as any, next, undefined as any)

    expect(next).toHaveBeenCalled()
    // DB should not be queried on cache hit
    expect(tenant._mocks.dbQuery).not.toHaveBeenCalled()
  })

  it("(e) cache hit returning '0' returns 403 without DB query", async () => {
    const tenant = makeTenant({ redisCachedValue: '0' })
    const { ctx, jsonFn } = makeContext({ tenant, enabledModules: ['MCQ'] })
    const next = vi.fn()

    const guard = createBackofficeRBACGuard(logger as any, MODULE_MCQ, ACTION_VIEW)
    await guard(ctx as any, next, undefined as any)

    expect(next).not.toHaveBeenCalled()
    expect(tenant._mocks.dbQuery).not.toHaveBeenCalled()
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'RBAC_PERMISSION_DENIED' }),
      }),
      403
    )
  })

  it('(f) cache miss executes DB query and stores result in Redis', async () => {
    const tenant = makeTenant({ redisCachedValue: null, dbHasPermission: true })
    const { ctx } = makeContext({ tenant, enabledModules: ['MCQ'] })
    const next = vi.fn()

    const guard = createBackofficeRBACGuard(logger as any, MODULE_MCQ, ACTION_VIEW)
    await guard(ctx as any, next, undefined as any)

    expect(tenant._mocks.dbQuery).toHaveBeenCalledOnce()
    expect(tenant._mocks.redisSet).toHaveBeenCalledWith(
      expect.stringContaining('rbac:'),
      '1',
      expect.objectContaining({ EX: 30 })
    )
    expect(next).toHaveBeenCalled()
  })

  it('(g) stale role (DB returns no rows) returns 403', async () => {
    const tenant = makeTenant({ redisCachedValue: null })
    // Override dbQuery to return empty rows (no rows = no permission)
    tenant._mocks.dbQuery.mockResolvedValue({ rows: [] })
    const { ctx, jsonFn } = makeContext({ tenant, enabledModules: ['MCQ'] })
    const next = vi.fn()

    const guard = createBackofficeRBACGuard(logger as any, MODULE_MCQ, ACTION_VIEW)
    await guard(ctx as any, next, undefined as any)

    expect(next).not.toHaveBeenCalled()
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'RBAC_PERMISSION_DENIED' }),
      }),
      403
    )
  })

  it('returns 403 MODULE_NOT_LICENSED when module not in enabled_modules', async () => {
    const tenant = makeTenant({ dbHasPermission: true })
    const { ctx, jsonFn } = makeContext({ tenant, enabledModules: [] })
    const next = vi.fn()

    const guard = createBackofficeRBACGuard(logger as any, MODULE_MCQ, ACTION_VIEW)
    await guard(ctx as any, next, undefined as any)

    expect(next).not.toHaveBeenCalled()
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'MODULE_NOT_LICENSED' }),
      }),
      403
    )
  })
})
