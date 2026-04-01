/**
 * Unit tests for createRefreshManager().
 * Mirrors MMC coverage for the Frontoffice refresh manager implementation.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRefreshManager } from '../../../src/core/auth/refresh-manager'
import type { ITokenManager } from '../../../src/core/auth/token-manager'

vi.mock('@zidney/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

function createMockTokenManager(): ITokenManager {
  let token: string | null = null
  return {
    getToken: vi.fn(() => token),
    setToken: vi.fn((next: string) => {
      token = next
    }),
    clearToken: vi.fn(() => {
      token = null
    }),
    hasToken: vi.fn(() => token !== null),
  }
}

describe('createRefreshManager', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

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

    const manager = createRefreshManager(refreshFn, onLogout, tokenManager)

    const p1 = manager.refresh()
    const p2 = manager.refresh()
    const p3 = manager.refresh()

    expect(refreshFn).toHaveBeenCalledTimes(1)

    resolveRefresh('new-token')
    await Promise.all([p1, p2, p3])

    expect(refreshFn).toHaveBeenCalledTimes(1)
  })

  it('all concurrent callers resolve when refresh succeeds', async () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()
    const refreshFn = vi.fn().mockResolvedValue('new-token')

    const manager = createRefreshManager(refreshFn, onLogout, tokenManager)

    const results = await Promise.allSettled([
      manager.refresh(),
      manager.refresh(),
      manager.refresh(),
    ])
    expect(results.every((result) => result.status === 'fulfilled')).toBe(true)
  })

  it('all callers reject when refresh fails', async () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()
    const refreshFn = vi.fn().mockRejectedValue(new Error('refresh failed'))

    const manager = createRefreshManager(refreshFn, onLogout, tokenManager)

    const results = await Promise.allSettled([manager.refresh(), manager.refresh()])
    expect(results.every((result) => result.status === 'rejected')).toBe(true)
  })

  it('onLogout called exactly once per failed refresh cycle', async () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()
    const refreshFn = vi.fn().mockRejectedValue(new Error('expired'))

    const manager = createRefreshManager(refreshFn, onLogout, tokenManager)

    await Promise.allSettled([manager.refresh(), manager.refresh(), manager.refresh()])

    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('onLogout is not called on successful refresh', async () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()
    const refreshFn = vi.fn().mockResolvedValue('fresh-token')

    const manager = createRefreshManager(refreshFn, onLogout, tokenManager)

    await manager.refresh()
    expect(onLogout).not.toHaveBeenCalled()
  })

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

    const manager = createRefreshManager(refreshFn, onLogout, tokenManager)
    const pending = manager.refresh()

    expect(manager.isRefreshing()).toBe(true)

    resolveRefresh('token')
    await pending

    expect(manager.isRefreshing()).toBe(false)
  })

  it('isRefreshing() is false before any refresh call', () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()
    const refreshFn = vi.fn()

    const manager = createRefreshManager(refreshFn, onLogout, tokenManager)
    expect(manager.isRefreshing()).toBe(false)
  })

  it('isRefreshing() is false after failed refresh', async () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()
    const refreshFn = vi.fn().mockRejectedValue(new Error('fail'))

    const manager = createRefreshManager(refreshFn, onLogout, tokenManager)
    await manager.refresh().catch(() => {})
    expect(manager.isRefreshing()).toBe(false)
  })

  it('second sequential refresh burst triggers a new refreshFn call', async () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()
    const refreshFn = vi.fn().mockResolvedValue('token')

    const manager = createRefreshManager(refreshFn, onLogout, tokenManager)

    await manager.refresh()
    await manager.refresh()

    expect(refreshFn).toHaveBeenCalledTimes(2)
  })

  it('token is stored in tokenManager after successful refresh', async () => {
    const tokenManager = createMockTokenManager()
    const onLogout = vi.fn()
    const refreshFn = vi.fn().mockResolvedValue('fresh-token')

    const manager = createRefreshManager(refreshFn, onLogout, tokenManager)
    await manager.refresh()

    expect(tokenManager.setToken).toHaveBeenCalledWith('fresh-token')
  })
})
