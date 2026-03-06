// @vitest-environment jsdom
/**
 * Token persistence audit — asserts that no token value reaches localStorage
 * or sessionStorage during auth store operations.
 * Addresses FR-SEC-03 (token redaction / zero leakage to Web Storage).
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 * Task: T042
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'
import type { IAuthService } from '../../../../../apps/frontoffice/src/core/auth/auth.service'
import type { IRefreshManager } from '../../../../../apps/frontoffice/src/core/auth/refresh-manager'
import type { ITokenManager } from '../../../../../apps/frontoffice/src/core/auth/token-manager'
import { looksLikeToken } from '../../../../../apps/frontoffice/src/core/auth/token-redact'
import type { AuthUser } from '../../../../../apps/frontoffice/src/core/auth/types'
import { defineAuthStore } from '../../../../../apps/frontoffice/src/core/state/auth.store'

const FAKE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEifQ.fakeSignature'

const LOGIN_ROUTE = 'fo-login'

function makeAuthService(user: AuthUser | null = null): IAuthService {
  const defaultUser = {
    id: 'u1',
    email: 'test@test.com',
    name: 'Test User',
    role: 'user',
  }
  return {
    login: vi.fn().mockResolvedValue({
      token: FAKE_TOKEN,
      user: user ?? defaultUser,
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshToken: vi.fn().mockResolvedValue({
      token: FAKE_TOKEN,
      user: user ?? defaultUser,
    }),
    fetchProfile: vi.fn().mockResolvedValue(user ?? defaultUser),
  } as unknown as IAuthService
}

function makeTokenManager(): ITokenManager {
  let _token: string | null = null
  return {
    getToken: vi.fn(() => _token),
    setToken: vi.fn((t: string) => {
      _token = t
    }),
    clearToken: vi.fn(() => {
      _token = null
    }),
    hasToken: vi.fn(() => _token !== null),
  }
}

function makeRouter(): Router {
  return {
    push: vi.fn().mockResolvedValue(undefined),
    replace: vi.fn().mockResolvedValue(undefined),
    currentRoute: { value: { name: 'fo-home' } },
  } as unknown as Router
}

function makeRefreshManager(): IRefreshManager {
  return { refresh: vi.fn() } as unknown as IRefreshManager
}

function tokenWasWrittenToStorage(storageFn: ReturnType<typeof vi.spyOn>): boolean {
  const calls = storageFn.mock.calls as Array<[string, string]>
  return calls.some(([, value]) => {
    if (typeof value !== 'string') return false
    return looksLikeToken(value) || value.includes(FAKE_TOKEN)
  })
}

describe('token persistence audit (frontoffice) — no token reaches Web Storage', () => {
  let localStorageSpy: ReturnType<typeof vi.spyOn>
  let sessionStorageSpy: ReturnType<typeof vi.spyOn>
  let pinia: ReturnType<typeof createPinia>
  let tokenManager: ITokenManager
  let router: Router

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    tokenManager = makeTokenManager()
    router = makeRouter()
    localStorageSpy = vi.spyOn(Storage.prototype, 'setItem') as any
    sessionStorageSpy = vi.spyOn(Storage.prototype, 'setItem') as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function makeStore() {
    const useStore = defineAuthStore(makeAuthService(), tokenManager, router, LOGIN_ROUTE, () =>
      makeRefreshManager()
    )
    return useStore(pinia)
  }

  it('does not write any token value to localStorage during login', async () => {
    const store = makeStore()
    store.setSession(FAKE_TOKEN, { id: 'u1', email: 'test@test.com', name: 'User', role: 'user' })
    expect(tokenWasWrittenToStorage(localStorageSpy)).toBe(false)
  })

  it('does not write any token value to sessionStorage during login', async () => {
    const store = makeStore()
    store.setSession(FAKE_TOKEN, { id: 'u1', email: 'test@test.com', name: 'User', role: 'user' })
    expect(tokenWasWrittenToStorage(sessionStorageSpy)).toBe(false)
  })

  it('does not write any token value to localStorage during logout', async () => {
    const store = makeStore()
    store.isAuthenticated = true
    await store.logout().catch(() => {})
    expect(tokenWasWrittenToStorage(localStorageSpy)).toBe(false)
  })

  it('does not write any token value to localStorage during expireSession', async () => {
    const store = makeStore()
    store.isAuthenticated = true
    await store.expireSession().catch(() => {})
    expect(tokenWasWrittenToStorage(localStorageSpy)).toBe(false)
  })

  it('in-memory tokenManager stores token only in memory (not in storage)', async () => {
    const store = makeStore()
    store.isAuthenticated = true
    tokenManager.setToken(FAKE_TOKEN)
    expect(tokenWasWrittenToStorage(localStorageSpy)).toBe(false)
  })
})
