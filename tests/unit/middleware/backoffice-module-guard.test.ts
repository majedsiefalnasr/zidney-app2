/**
 * Unit Tests: backoffice-module-guard middleware — STAGE_17
 *
 * File: tests/unit/middleware/backoffice-module-guard.test.ts
 * Task: T026
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 *
 * Scenarios:
 * (a) 403 + MODULE_NOT_LICENSED when module absent from enabled_modules
 * (b) next() called when module present in enabled_modules
 * (c) correlationId present in 403 error body
 * (d) logger.warn emitted with all 6 required fields on every denial (M-02 verification)
 */

import type { Module } from '@zidney/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createModuleGuard } from '../../../apps/api/src/middleware/backoffice-module-guard'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}

function makeContext(
  overrides: Partial<{
    correlationId: string
    workspaceId: string
    workspaceSlug: string
    userId: string
    enabledModules: string[]
    method: string
    path: string
  }> = {}
) {
  const {
    correlationId = 'corr-abc',
    workspaceId = 'ws-uuid-123',
    workspaceSlug = 'test-workspace',
    userId = 'user-uuid-456',
    enabledModules = [],
    method = 'GET',
    path = '/api/v1/backoffice/mcq',
  } = overrides

  const jsonFn = vi.fn().mockReturnValue({})
  const ctx = {
    get: vi.fn((key: string) => {
      const map: Record<string, unknown> = {
        correlationId,
        workspace_id: workspaceId,
        workspace_slug: workspaceSlug,
        enabled_modules: enabledModules,
        staff_user: { user_id: userId },
      }
      return map[key]
    }),
    json: jsonFn,
    req: {
      method,
      path,
    },
  }
  return { ctx, jsonFn }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const MODULE_MCQ = 'MCQ' as Module

describe('createModuleGuard', () => {
  let logger: ReturnType<typeof makeLogger>

  beforeEach(() => {
    logger = makeLogger()
  })

  it('(a) returns 403 MODULE_NOT_LICENSED when module absent from enabled_modules', async () => {
    const { ctx, jsonFn } = makeContext({ enabledModules: [] })
    const next = vi.fn()

    const guard = createModuleGuard(logger as any, MODULE_MCQ)
    await guard(ctx as any, next)

    expect(next).not.toHaveBeenCalled()
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        data: null,
        error: expect.objectContaining({ code: 'MODULE_NOT_LICENSED' }),
      }),
      403
    )
  })

  it('(b) calls next() when module present in enabled_modules', async () => {
    const { ctx } = makeContext({ enabledModules: ['MCQ', 'LIBRARY'] })
    const next = vi.fn()

    const guard = createModuleGuard(logger as any, MODULE_MCQ)
    await guard(ctx as any, next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('(c) correlationId is present in 403 error body', async () => {
    const { ctx, jsonFn } = makeContext({
      enabledModules: [],
      correlationId: 'my-corr-id',
    })
    const next = vi.fn()

    const guard = createModuleGuard(logger as any, MODULE_MCQ)
    await guard(ctx as any, next)

    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ correlationId: 'my-corr-id' }),
      }),
      403
    )
  })

  it('(d) M-02 — logger.warn emitted with all 6 required fields on denial', async () => {
    const { ctx } = makeContext({
      enabledModules: [],
      correlationId: 'warn-corr',
      workspaceId: 'ws-id',
      workspaceSlug: 'ws-slug',
      userId: 'u-id',
      method: 'POST',
      path: '/api/v1/backoffice/mcq/create',
    })
    const next = vi.fn()

    const guard = createModuleGuard(logger as any, MODULE_MCQ)
    await guard(ctx as any, next)

    expect(logger.warn).toHaveBeenCalledOnce()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        module: MODULE_MCQ,
        workspace_id: 'ws-id',
        workspace_slug: 'ws-slug',
        correlation_id: 'warn-corr',
        user_id: 'u-id',
        route_name: expect.stringContaining('POST'),
      })
    )
  })

  it('does NOT call logger.warn when module is present', async () => {
    const { ctx } = makeContext({ enabledModules: ['MCQ'] })
    const next = vi.fn()

    const guard = createModuleGuard(logger as any, MODULE_MCQ)
    await guard(ctx as any, next)

    expect(logger.warn).not.toHaveBeenCalled()
  })
})
