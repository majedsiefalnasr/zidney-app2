/**
 * Integration test: session clear wiring (frontoffice) — clearUserSpecificStores() is called after expireSession().
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 * Task: T057
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'
import { createErrorInterceptor } from '../../../../apps/frontoffice/src/core/api/interceptors/error.interceptor'
import type { IAuthService } from '../../../../apps/frontoffice/src/core/auth/auth.service'
import type { IRefreshManager } from '../../../../apps/frontoffice/src/core/auth/refresh-manager'
import type { ITokenManager } from '../../../../apps/frontoffice/src/core/auth/token-manager'
import { defineAuthStore } from '../../../../apps/frontoffice/src/core/state/auth.store'

vi.mock('@zidney/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

const LOGIN_ROUTE = 'fo-login'

function makePinia() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}

function makeTokenManager(): ITokenManager {
  return {
    getToken: vi.fn(() => null),
    setToken: vi.fn(),
    clearToken: vi.fn(),
    hasToken: vi.fn(() => false),
  }
}

function makeRouter(): Router {
  return {
    push: vi.fn().mockResolvedValue(undefined),
    replace: vi.fn().mockResolvedValue(undefined),
    currentRoute: { value: { name: 'fo-home' } },
  } as unknown as Router
}

function makeAuthService(): IAuthService {
  return {
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshToken: vi.fn(),
    fetchProfile: vi.fn(),
  } as unknown as IAuthService
}

function makeRefreshManager(): IRefreshManager {
  return { refresh: vi.fn() } as unknown as IRefreshManager
}

describe('session clear wiring (frontoffice)', () => {
  let pinia: ReturnType<typeof makePinia>
  let tokenManager: ITokenManager
  let router: Router
  let clearUserSpecificStores: ReturnType<typeof vi.fn>

  beforeEach(() => {
    pinia = makePinia()
    tokenManager = makeTokenManager()
    router = makeRouter()
    clearUserSpecificStores = vi.fn()
  })

  function buildWiredSetup() {
    const useAuthStore = defineAuthStore(makeAuthService(), tokenManager, router, LOGIN_ROUTE, () =>
      makeRefreshManager()
    )
    const authStore = useAuthStore(pinia)
    const getIsAuthenticated = () => authStore.isAuthenticated
    const onSessionExpired = async () => {
      await authStore.expireSession()
      clearUserSpecificStores()
    }
    const interceptor = createErrorInterceptor({
      getIsAuthenticated,
      onSessionExpired,
      onLicenseError: vi.fn(),
    })
    return { authStore, interceptor }
  }

  it('clearUserSpecificStores() is called exactly once after handleAuthFailure()', async () => {
    const { authStore, interceptor } = buildWiredSetup()
    authStore.isAuthenticated = true
    await interceptor.handleAuthFailure()
    expect(clearUserSpecificStores).toHaveBeenCalledTimes(1)
  })

  it('clearUserSpecificStores() is NOT called when user is already unauthenticated', async () => {
    const { authStore, interceptor } = buildWiredSetup()
    authStore.isAuthenticated = false
    await interceptor.handleAuthFailure()
    expect(clearUserSpecificStores).not.toHaveBeenCalled()
  })

  it('clearUserSpecificStores() is called exactly once even with 3 concurrent 401s', async () => {
    const { authStore, interceptor } = buildWiredSetup()
    authStore.isAuthenticated = true
    const calls = [
      interceptor.handleAuthFailure(),
      interceptor.handleAuthFailure(),
      interceptor.handleAuthFailure(),
    ]
    await Promise.all(calls)
    expect(clearUserSpecificStores).toHaveBeenCalledTimes(1)
  })
})
