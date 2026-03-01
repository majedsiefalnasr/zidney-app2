/**
 * Integration test: concurrent refresh single-flight guarantee.
 * Verifies that N concurrent callers under 401 conditions only trigger
 * one refreshFn call and all resolve after the single refresh completes.
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRefreshManager } from '../../../src/core/auth/refresh-manager'
import { createTokenManager } from '../../../src/core/auth/token-manager'

// ─── Logger mock ─────────────────────────────────────────────────────────────
vi.mock('@zidney/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// ─── Delay helper ─────────────────────────────────────────────────────────────
function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

describe('concurrent token refresh — single-flight guarantee', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('5 concurrent refresh() calls → refreshFn called exactly once', async () => {
    const tokenManager = createTokenManager()
    const onLogout = vi.fn()

    // refreshFn with 50ms delay to force overlap
    const refreshFn = vi.fn(async () => {
      await delay(50)
      return 'new-token-from-server'
    })

    const rm = createRefreshManager(refreshFn, onLogout, tokenManager)

    // Fire 5 concurrent refresh() calls
    const results = await Promise.all([
      rm.refresh(),
      rm.refresh(),
      rm.refresh(),
      rm.refresh(),
      rm.refresh(),
    ])

    // refreshFn must have been called exactly once
    expect(refreshFn).toHaveBeenCalledTimes(1)

    // All 5 must have resolved successfully
    expect(results.length).toBe(5)
    results.forEach((r) => expect(r).toBeUndefined())
  })

  it('tokenManager.getToken() returns new token after concurrent burst', async () => {
    const tokenManager = createTokenManager()
    const onLogout = vi.fn()

    const refreshFn = vi.fn(async () => {
      await delay(50)
      return 'fresh-token-concurrent'
    })

    const rm = createRefreshManager(refreshFn, onLogout, tokenManager)

    await Promise.all([rm.refresh(), rm.refresh(), rm.refresh()])

    expect(tokenManager.getToken()).toBe('fresh-token-concurrent')
  })

  it('all callers reject on refresh failure — no partial resolution', async () => {
    const tokenManager = createTokenManager()
    const onLogout = vi.fn()

    const refreshFn = vi.fn(async () => {
      await delay(20)
      throw new Error('server returned 401')
    })

    const rm = createRefreshManager(refreshFn, onLogout, tokenManager)

    const results = await Promise.allSettled([
      rm.refresh(),
      rm.refresh(),
      rm.refresh(),
      rm.refresh(),
      rm.refresh(),
    ])

    expect(refreshFn).toHaveBeenCalledTimes(1)
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
  })

  it('onLogout called exactly once when burst refresh fails', async () => {
    const tokenManager = createTokenManager()
    const onLogout = vi.fn()

    const refreshFn = vi.fn(async () => {
      await delay(20)
      throw new Error('expired')
    })

    const rm = createRefreshManager(refreshFn, onLogout, tokenManager)

    await Promise.allSettled([rm.refresh(), rm.refresh(), rm.refresh()])

    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('second sequential burst triggers a new refreshFn call', async () => {
    const tokenManager = createTokenManager()
    const onLogout = vi.fn()

    const refreshFn = vi.fn(async () => {
      await delay(10)
      return 'token'
    })

    const rm = createRefreshManager(refreshFn, onLogout, tokenManager)

    // First burst
    await Promise.all([rm.refresh(), rm.refresh()])
    expect(refreshFn).toHaveBeenCalledTimes(1)

    // Second burst (after first completes)
    await Promise.all([rm.refresh(), rm.refresh()])
    expect(refreshFn).toHaveBeenCalledTimes(2)
  })
})
