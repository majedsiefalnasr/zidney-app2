/**
 * Integration test: 401 storm guard — concurrent 401s trigger onSessionExpired exactly once.
 * Validates FR-SEC-08: _isHandling401 flag prevents duplicate session expiry calls.
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 * Task: T046
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createErrorInterceptor } from '../../../../apps/mmc/src/core/api/interceptors/error.interceptor'

vi.mock('@zidney/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

describe('401 storm guard (mmc) — FR-SEC-08', () => {
  let onSessionExpiredCount: number
  let onSessionExpired: ReturnType<typeof vi.fn<[], Promise<void>>>
  let getIsAuthenticated: ReturnType<typeof vi.fn<[], boolean>>

  beforeEach(() => {
    onSessionExpiredCount = 0
    onSessionExpired = vi.fn<[], Promise<void>>(async () => {
      onSessionExpiredCount++
      // Simulate async work (e.g., router navigation + store update)
      await new Promise<void>((resolve) => setTimeout(resolve, 10))
    })
    getIsAuthenticated = vi.fn<[], boolean>(() => true)
  })

  it('fires onSessionExpired exactly once when 3 concurrent 401 responses arrive', async () => {
    const interceptor = createErrorInterceptor({
      getIsAuthenticated,
      onSessionExpired,
      onLicenseError: vi.fn(),
    })

    // Simulate 3 concurrent auth failure calls (mirroring 3 simultaneous 401 API responses)
    const calls = [
      interceptor.handleAuthFailure(),
      interceptor.handleAuthFailure(),
      interceptor.handleAuthFailure(),
    ]
    await Promise.all(calls)

    expect(onSessionExpiredCount).toBe(1)
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('fires onSessionExpired exactly once when 5 concurrent 401 responses arrive', async () => {
    const interceptor = createErrorInterceptor({
      getIsAuthenticated,
      onSessionExpired,
      onLicenseError: vi.fn(),
    })

    const calls = Array.from({ length: 5 }, () => interceptor.handleAuthFailure())
    await Promise.all(calls)

    expect(onSessionExpiredCount).toBe(1)
  })

  it('does NOT fire onSessionExpired when user is not authenticated', async () => {
    getIsAuthenticated.mockReturnValue(false)
    const interceptor = createErrorInterceptor({
      getIsAuthenticated,
      onSessionExpired,
      onLicenseError: vi.fn(),
    })

    await interceptor.handleAuthFailure()
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('resets the _isHandling401 guard after completion (allows re-execution on new events)', async () => {
    const interceptor = createErrorInterceptor({
      getIsAuthenticated,
      onSessionExpired,
      onLicenseError: vi.fn(),
    })

    // First wave
    await interceptor.handleAuthFailure()
    expect(onSessionExpiredCount).toBe(1)

    // Simulate re-login and new auth failure occurrence
    // isHandling401 should be reset after first wave
    expect(interceptor.isHandling401).toBe(false)

    // Second wave (e.g., user refreshes and gets another 401)
    await interceptor.handleAuthFailure()
    expect(onSessionExpiredCount).toBe(2)
  })
})
