/**
 * Integration test: 401 storm guard — concurrent 401s trigger onSessionExpired exactly once.
 * Validates FR-SEC-08: _isHandling401 flag prevents duplicate session expiry calls.
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 * Task: T047
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createErrorInterceptor } from '../../../../apps/backoffice/src/core/api/interceptors/error.interceptor'

vi.mock('@zidney/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

describe('401 storm guard (backoffice) — FR-SEC-08', () => {
  let onSessionExpiredCount: number
  let onSessionExpired: ReturnType<typeof vi.fn>
  let getIsAuthenticated: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onSessionExpiredCount = 0
    onSessionExpired = vi.fn(async () => {
      onSessionExpiredCount++
      await new Promise<void>((resolve) => setTimeout(resolve, 10))
    })
    getIsAuthenticated = vi.fn(() => true)
  })

  it('fires onSessionExpired exactly once when 3 concurrent 401 responses arrive', async () => {
    const interceptor = createErrorInterceptor({
      getIsAuthenticated,
      onSessionExpired,
      onLicenseError: vi.fn(),
    })

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

  it('resets the _isHandling401 guard after completion', async () => {
    const interceptor = createErrorInterceptor({
      getIsAuthenticated,
      onSessionExpired,
      onLicenseError: vi.fn(),
    })

    await interceptor.handleAuthFailure()
    expect(onSessionExpiredCount).toBe(1)
    expect(interceptor.isHandling401).toBe(false)

    await interceptor.handleAuthFailure()
    expect(onSessionExpiredCount).toBe(2)
  })
})
