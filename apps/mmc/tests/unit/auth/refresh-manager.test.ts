/**
 * Unit tests for createRefreshManager().
 * Verifies: single-flight guarantee, concurrent caller resolution,
 * onLogout called exactly once on failure, isRefreshing lifecycle.
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRefreshManager } from '../../../src/core/auth/refresh-manager'
import { createMockTokenManager } from './setup'

// ─── Logger mock ─────────────────────────────────────────────────────────────
vi.mock('@zidney/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('createRefreshManager', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  // ── Single-flight guarantee ───────────────────────────────────────────────

  it('3 concurrent refresh() calls invoke refreshFn exactly once', async () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()

    let resolveRefresh!: (token: string) => void
    const refreshFn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRefresh = resolve
        })
    )

    const rm = createRefreshManager(refreshFn, onLogout, tokenManager)

    const p1 = rm.refresh()
    const p2 = rm.refresh()
    const p3 = rm.refresh()

    // all 3 waiting — refreshFn should only have been called once
    expect(refreshFn).toHaveBeenCalledTimes(1)

    resolveRefresh('new-token')
    await Promise.all([p1, p2, p3])

    expect(refreshFn).toHaveBeenCalledTimes(1)
  })

  it('all concurrent callers resolve when refresh succeeds', async () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()
    const refreshFn = vi.fn().mockResolvedValue('new-token')

    const rm = createRefreshManager(refreshFn, onLogout, tokenManager)

    const results = await Promise.allSettled([rm.refresh(), rm.refresh(), rm.refresh()])
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
  })

  it('all callers reject when refresh fails', async () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()
    const refreshFn = vi.fn().mockRejectedValue(new Error('refresh failed'))

    const rm = createRefreshManager(refreshFn, onLogout, tokenManager)

    const results = await Promise.allSettled([rm.refresh(), rm.refresh()])
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
  })

  it('onLogout called exactly once per failed refresh cycle', async () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()
    const refreshFn = vi.fn().mockRejectedValue(new Error('expired'))

    const rm = createRefreshManager(refreshFn, onLogout, tokenManager)

    await Promise.allSettled([rm.refresh(), rm.refresh(), rm.refresh()])

    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('onLogout NOT called on successful refresh', async () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()
    const refreshFn = vi.fn().mockResolvedValue('fresh-token')

    const rm = createRefreshManager(refreshFn, onLogout, tokenManager)

    await rm.refresh()
    expect(onLogout).not.toHaveBeenCalled()
  })

  // ── isRefreshing lifecycle ────────────────────────────────────────────────

  it('isRefreshing() is true while refresh is in flight', async () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()

    let resolveRefresh!: (token: string) => void
    const refreshFn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRefresh = resolve
        })
    )

    const rm = createRefreshManager(refreshFn, onLogout, tokenManager)
    const p = rm.refresh()

    expect(rm.isRefreshing()).toBe(true)

    resolveRefresh('token')
    await p

    expect(rm.isRefreshing()).toBe(false)
  })

  it('isRefreshing() is false before any refresh call', () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()
    const refreshFn = vi.fn()

    const rm = createRefreshManager(refreshFn, onLogout, tokenManager)
    expect(rm.isRefreshing()).toBe(false)
  })

  it('isRefreshing() is false after failed refresh', async () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()
    const refreshFn = vi.fn().mockRejectedValue(new Error('fail'))

    const rm = createRefreshManager(refreshFn, onLogout, tokenManager)
    await rm.refresh().catch(() => {})
    expect(rm.isRefreshing()).toBe(false)
  })

  // ── Sequential burst triggers new call ───────────────────────────────────

  it('second sequential refresh burst triggers a new refreshFn call', async () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()
    const refreshFn = vi.fn().mockResolvedValue('token')

    const rm = createRefreshManager(refreshFn, onLogout, tokenManager)

    await rm.refresh()
    await rm.refresh()

    expect(refreshFn).toHaveBeenCalledTimes(2)
  })

  // ── Token stored after success ────────────────────────────────────────────

  it('token is stored in tokenManager after successful refresh', async () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()
    const refreshFn = vi.fn().mockResolvedValue('fresh-token')

    const rm = createRefreshManager(refreshFn, onLogout, tokenManager)
    await rm.refresh()

    expect(tokenManager.setToken).toHaveBeenCalledWith('fresh-token')
  })
})
