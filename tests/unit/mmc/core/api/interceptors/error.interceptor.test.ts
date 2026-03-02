/**
 * Unit tests for apps/mmc/src/core/api/interceptors/error.interceptor.ts
 * Covers FR-SEC-07 (isAuthenticated guard) and FR-SEC-08 (idempotency).
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 * Task: T029
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createErrorInterceptor } from '../../../../../../apps/mmc/src/core/api/interceptors/error.interceptor'

describe('createErrorInterceptor (mmc)', () => {
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

  // ── handleAuthFailure: isAuthenticated guard ─────────────────────────────

  it('calls onSessionExpired when isAuthenticated = true', async () => {
    getIsAuthenticated.mockReturnValue(true)
    const interceptor = makeInterceptor()

    await interceptor.handleAuthFailure()

    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onSessionExpired when isAuthenticated = false', async () => {
    getIsAuthenticated.mockReturnValue(false)
    const interceptor = makeInterceptor()

    await interceptor.handleAuthFailure()

    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  // ── handleAuthFailure: isHandling401 storm guard ─────────────────────────

  it('calls onSessionExpired exactly once on concurrent calls (isHandling401 guard)', async () => {
    getIsAuthenticated.mockReturnValue(true)
    // Simulate a slow onSessionExpired (not resolved immediately)
    let resolveExpired!: () => void
    const slowExpired = new Promise<void>((res) => {
      resolveExpired = res
    })
    onSessionExpired.mockReturnValue(slowExpired)

    const interceptor = makeInterceptor()

    // Fire 3 concurrent handleAuthFailure calls
    const call1 = interceptor.handleAuthFailure()
    const call2 = interceptor.handleAuthFailure()
    const call3 = interceptor.handleAuthFailure()

    resolveExpired()
    await Promise.all([call1, call2, call3])

    // onSessionExpired must only be called once
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('isHandling401 resets to false after onSessionExpired resolves so a subsequent call can re-trigger', async () => {
    getIsAuthenticated.mockReturnValue(true)
    const interceptor = makeInterceptor()

    // First call
    await interceptor.handleAuthFailure()
    expect(interceptor.isHandling401).toBe(false)
    expect(onSessionExpired).toHaveBeenCalledTimes(1)

    // Second call after first completes — should fire again
    await interceptor.handleAuthFailure()
    expect(onSessionExpired).toHaveBeenCalledTimes(2)
  })

  it('isHandling401 is true while onSessionExpired is in progress', async () => {
    getIsAuthenticated.mockReturnValue(true)
    let resolveExpired!: () => void
    const slowExpired = new Promise<void>((res) => {
      resolveExpired = res
    })
    onSessionExpired.mockReturnValue(slowExpired)

    const interceptor = makeInterceptor()

    const callPromise = interceptor.handleAuthFailure()
    // isHandling401 should be true while the async call is in flight
    expect(interceptor.isHandling401).toBe(true)

    resolveExpired()
    await callPromise
    expect(interceptor.isHandling401).toBe(false)
  })

  // ── handleLicenseError ───────────────────────────────────────────────────

  it('calls onLicenseError with 423 on handleLicenseError(423)', () => {
    const interceptor = makeInterceptor()
    interceptor.handleLicenseError(423)
    expect(onLicenseError).toHaveBeenCalledWith(423)
    expect(onLicenseError).toHaveBeenCalledTimes(1)
  })

  it('calls onLicenseError with 426 on handleLicenseError(426)', () => {
    const interceptor = makeInterceptor()
    interceptor.handleLicenseError(426)
    expect(onLicenseError).toHaveBeenCalledWith(426)
    expect(onLicenseError).toHaveBeenCalledTimes(1)
  })

  // ── isHandling401 initial state ──────────────────────────────────────────

  it('isHandling401 is false initially', () => {
    const interceptor = makeInterceptor()
    expect(interceptor.isHandling401).toBe(false)
  })
})
