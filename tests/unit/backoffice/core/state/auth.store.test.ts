/**
 * Unit tests for apps/backoffice/src/core/state/auth.store.ts — expireSession() action
 * Covers FR-SEC-07, FR-SEC-08 (idempotency on session expiry).
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 * Task: T036
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'
import type { IAuthService } from '../../../../../apps/backoffice/src/core/auth/auth.service'
import type { IRefreshManager } from '../../../../../apps/backoffice/src/core/auth/refresh-manager'
import type { ITokenManager } from '../../../../../apps/backoffice/src/core/auth/token-manager'
import { defineAuthStore } from '../../../../../apps/backoffice/src/core/state/auth.store'

const LOGIN_ROUTE = 'bo-login'

function makeAuthService(): IAuthService {
  return {
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshToken: vi.fn(),
    fetchProfile: vi.fn(),
  } as unknown as IAuthService
}

function makeTokenManager(token: string | null = null): ITokenManager {
  let _token = token
  return {
    getToken: vi.fn(() => _token),
    setToken: vi.fn((t: string) => {
      _token = t
    }),
    clearToken: vi.fn(() => {
      _token = null
    }),
  }
}

function makeRouter(): Router {
  return {
    push: vi.fn().mockResolvedValue(undefined),
    replace: vi.fn().mockResolvedValue(undefined),
    currentRoute: { value: { name: 'bo-dashboard' } },
  } as unknown as Router
}

function makeRefreshManager(): IRefreshManager {
  return { refresh: vi.fn() } as unknown as IRefreshManager
}

describe('auth.store expireSession() (backoffice)', () => {
  let pinia: ReturnType<typeof createPinia>
  let authService: IAuthService
  let tokenManager: ITokenManager
  let router: Router
  let refreshManager: IRefreshManager

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    authService = makeAuthService()
    tokenManager = makeTokenManager('initial-token-value-12345678910')
    router = makeRouter()
    refreshManager = makeRefreshManager()
  })

  function makeStore(initiallyAuthenticated = true) {
    const useStore = defineAuthStore(
      authService,
      tokenManager,
      router,
      LOGIN_ROUTE,
      () => refreshManager
    )
    const store = useStore(pinia)
    if (initiallyAuthenticated) {
      store.isAuthenticated = true
      store.user = { id: 'user-1', email: 'test@example.com' } as never
    }
    return store
  }

  // ── expireSession() when authenticated ──────────────────────────────────

  it('clears token from memory when called while authenticated', async () => {
    const store = makeStore(true)
    await store.expireSession()
    expect(tokenManager.clearToken).toHaveBeenCalledTimes(1)
  })

  it('sets isAuthenticated to false when called while authenticated', async () => {
    const store = makeStore(true)
    await store.expireSession()
    expect(store.isAuthenticated).toBe(false)
  })

  it('sets user to null when called while authenticated', async () => {
    const store = makeStore(true)
    await store.expireSession()
    expect(store.user).toBeNull()
  })

  it('navigates to login route when called while authenticated', async () => {
    const store = makeStore(true)
    await store.expireSession()
    expect(router.push).toHaveBeenCalledWith({ name: LOGIN_ROUTE })
  })

  it('sets authError.code to AUTH_SESSION_EXPIRED after navigation', async () => {
    const store = makeStore(true)
    await store.expireSession()
    expect(store.authError).not.toBeNull()
    expect(store.authError?.code).toBe('AUTH_SESSION_EXPIRED')
    expect(store.authError?.message).toBeTruthy()
  })

  // ── expireSession() when NOT authenticated ───────────────────────────────

  it('is a no-op when called while not authenticated', async () => {
    const store = makeStore(false)
    await store.expireSession()
    expect(tokenManager.clearToken).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
    expect(store.authError).toBeNull()
  })

  // ── expireSession() idempotency ──────────────────────────────────────────

  it('executes only once when called twice concurrently (idempotency via isAuthenticated guard)', async () => {
    const store = makeStore(true)
    const calls = [store.expireSession(), store.expireSession()]
    await Promise.all(calls)
    expect(tokenManager.clearToken).toHaveBeenCalledTimes(1)
    expect(router.push).toHaveBeenCalledTimes(1)
  })
})
