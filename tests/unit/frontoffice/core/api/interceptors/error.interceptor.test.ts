/**
 * Unit tests for apps/frontoffice/src/core/api/interceptors/error.interceptor.ts
 * Covers FR-SEC-07 (isAuthenticated guard) and FR-SEC-08 (idempotency).
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 * Task: T031
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createErrorInterceptor } from '../../../../../../apps/frontoffice/src/core/api/interceptors/error.interceptor'

describe('createErrorInterceptor (frontoffice)', () => {
  let getIsAuthenticated: ReturnType<typeof vi.fn>
  let onSessionExpired: ReturnType<typeof vi.fn>
  let onLicenseError: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getIsAuthenticated = vi.fn()
    onSessionExpired = vi.fn().mockResolvedValue(undefined)
    onLicenseError = vi.fn()
  })

  function makeInterceptor() {
    return createErrorInterceptor({
      getIsAuthenticated,
      onSessionExpired,
      onLicenseError,
    })
  }

  it('calls onSessionExpired when isAuthenticated = true', async () => {
    getIsAuthenticated.mockReturnValue(true)
    await makeInterceptor().handleAuthFailure()
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onSessionExpired when isAuthenticated = false', async () => {
    getIsAuthenticated.mockReturnValue(false)
    await makeInterceptor().handleAuthFailure()
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('calls onSessionExpired exactly once on concurrent calls', async () => {
    getIsAuthenticated.mockReturnValue(true)
    let resolveExpired!: () => void
    const slowExpired = new Promise<void>((res) => {
      resolveExpired = res
    })
    onSessionExpired.mockReturnValue(slowExpired)
    const interceptor = makeInterceptor()
    const calls = [
      interceptor.handleAuthFailure(),
      interceptor.handleAuthFailure(),
      interceptor.handleAuthFailure(),
    ]
    resolveExpired()
    await Promise.all(calls)
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('isHandling401 resets after onSessionExpired resolves', async () => {
    getIsAuthenticated.mockReturnValue(true)
    const interceptor = makeInterceptor()
    await interceptor.handleAuthFailure()
    expect(interceptor.isHandling401).toBe(false)
    await interceptor.handleAuthFailure()
    expect(onSessionExpired).toHaveBeenCalledTimes(2)
  })

  it('calls onLicenseError with 423', () => {
    const interceptor = makeInterceptor()
    interceptor.handleLicenseError(423)
    expect(onLicenseError).toHaveBeenCalledWith(423)
  })

  it('calls onLicenseError with 426', () => {
    const interceptor = makeInterceptor()
    interceptor.handleLicenseError(426)
    expect(onLicenseError).toHaveBeenCalledWith(426)
  })

  it('isHandling401 is false initially', () => {
    expect(makeInterceptor().isHandling401).toBe(false)
  })
})
