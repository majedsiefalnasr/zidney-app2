/**
 * Unit tests for defineAuthStore().
 * Verifies: initial state, setSession, initSession, logout idempotency,
 * MEDIUM-02 compliance (isLoading after router.push), token not exposed.
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IRefreshManager } from '../../../src/core/auth/refresh-manager'
import { defineAuthStore } from '../../../src/core/state/auth.store'
import {
  createMockAuthService,
  createMockTokenManager,
  createTestRouter,
} from './setup'

// ─── Logger mock ─────────────────────────────────────────────────────────────
vi.mock('@zidney/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// ─── Helper ──────────────────────────────────────────────────────────────────

function buildStore(
  overrides: {
    refreshManager?: IRefreshManager | null
  } = {}
) {
  const pinia = createPinia()
  setActivePinia(pinia)

  const authService = createMockAuthService()
  const tokenManager = createMockTokenManager()
  const router = createTestRouter()
  const loginRouteName = 'mmc-login'

  let rm: IRefreshManager | null = overrides.refreshManager ?? null
  const getRefreshManager = () => rm

  const useAuthStore = defineAuthStore(
    authService,
    tokenManager,
    router,
    loginRouteName,
    getRefreshManager
  )

  const store = useAuthStore(pinia)

  return {
    store,
    authService,
    tokenManager,
    router,
    setRefreshManager: (v: IRefreshManager | null) => {
      rm = v
    },
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('defineAuthStore', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  // ── Initial state ─────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('isAuthenticated is false', () => {
      const { store } = buildStore()
      expect(store.isAuthenticated).toBe(false)
    })

    it('user is null', () => {
      const { store } = buildStore()
      expect(store.user).toBeNull()
    })

    it('isLoading is false', () => {
      const { store } = buildStore()
      expect(store.isLoading).toBe(false)
    })

    it('authError is null', () => {
      const { store } = buildStore()
      expect(store.authError).toBeNull()
    })

    it('token is NOT exposed as a store getter', () => {
      const { store } = buildStore()
      expect(
        (store as unknown as Record<string, unknown>)['token']
      ).toBeUndefined()
      expect(
        (store as unknown as Record<string, unknown>)['accessToken']
      ).toBeUndefined()
    })
  })

  // ── setSession ────────────────────────────────────────────────────────────

  describe('setSession()', () => {
    it('sets isAuthenticated to true', () => {
      const { store, tokenManager } = buildStore()
      store.setSession('tok-123', {
        id: '1',
        email: 'a@b.com',
        name: 'Alice',
        role: 'admin',
      })
      expect(store.isAuthenticated).toBe(true)
    })

    it('sets user profile', () => {
      const { store } = buildStore()
      const user = { id: '1', email: 'a@b.com', name: 'Alice', role: 'admin' }
      store.setSession('tok-123', user)
      expect(store.user).toEqual(user)
    })

    it('clears isLoading', () => {
      const { store } = buildStore()
      store.setSession('tok-123', {
        id: '1',
        email: 'a@b.com',
        name: 'Alice',
        role: 'admin',
      })
      expect(store.isLoading).toBe(false)
    })

    it('stores token in tokenManager', () => {
      const { store, tokenManager } = buildStore()
      store.setSession('tok-abc', {
        id: '1',
        email: 'a@b.com',
        name: 'Alice',
        role: 'admin',
      })
      expect(tokenManager.setToken).toHaveBeenCalledWith('tok-abc')
    })
  })

  // ── initSession ───────────────────────────────────────────────────────────

  describe('initSession()', () => {
    it('sets isAuthenticated true and populates user on success', async () => {
      const { store, authService } = buildStore()
      vi.mocked(authService.refreshToken).mockResolvedValue({
        accessToken: 'fresh',
      })
      vi.mocked(authService.fetchProfile).mockResolvedValue({
        id: '1',
        email: 'a@b.com',
        name: 'Alice',
        role: 'admin',
      })

      await store.initSession()

      expect(store.isAuthenticated).toBe(true)
      expect(store.user).not.toBeNull()
    })

    it('isLoading is false after successful initSession()', async () => {
      const { store } = buildStore()
      await store.initSession()
      expect(store.isLoading).toBe(false)
    })

    it('sets authError.code to AUTH_INIT_FAILED on failure', async () => {
      const { store, authService } = buildStore()
      vi.mocked(authService.refreshToken).mockRejectedValue(
        new Error('expired')
      )

      await store.initSession()

      expect(store.authError?.code).toBe('AUTH_INIT_FAILED')
    })

    it('isAuthenticated remains false on failure', async () => {
      const { store, authService } = buildStore()
      vi.mocked(authService.refreshToken).mockRejectedValue(
        new Error('expired')
      )

      await store.initSession()

      expect(store.isAuthenticated).toBe(false)
    })

    it('user remains null on failure', async () => {
      const { store, authService } = buildStore()
      vi.mocked(authService.refreshToken).mockRejectedValue(
        new Error('expired')
      )

      await store.initSession()

      expect(store.user).toBeNull()
    })

    it('isLoading is false after failed initSession()', async () => {
      const { store, authService } = buildStore()
      vi.mocked(authService.refreshToken).mockRejectedValue(
        new Error('expired')
      )

      await store.initSession()

      expect(store.isLoading).toBe(false)
    })

    it('router.push is NOT called on failure', async () => {
      const { store, authService, router } = buildStore()
      vi.mocked(authService.refreshToken).mockRejectedValue(
        new Error('expired')
      )
      const pushSpy = vi.spyOn(router, 'push')

      await store.initSession()

      expect(pushSpy).not.toHaveBeenCalled()
    })
  })

  // ── logout ────────────────────────────────────────────────────────────────

  describe('logout()', () => {
    beforeEach(() => {
      vi.resetAllMocks()
    })

    it('resets isAuthenticated to false', async () => {
      const { store } = buildStore()
      store.setSession('tok', {
        id: '1',
        email: 'a@b.com',
        name: 'Alice',
        role: 'admin',
      })
      await store.logout()
      expect(store.isAuthenticated).toBe(false)
    })

    it('resets user to null', async () => {
      const { store } = buildStore()
      store.setSession('tok', {
        id: '1',
        email: 'a@b.com',
        name: 'Alice',
        role: 'admin',
      })
      await store.logout()
      expect(store.user).toBeNull()
    })

    it('clears token in tokenManager', async () => {
      const { store, tokenManager } = buildStore()
      store.setSession('tok', {
        id: '1',
        email: 'a@b.com',
        name: 'Alice',
        role: 'admin',
      })
      await store.logout()
      expect(tokenManager.clearToken).toHaveBeenCalledOnce()
    })

    it('calls authService.logout() once when authenticated', async () => {
      const { store, authService } = buildStore()
      store.setSession('tok', {
        id: '1',
        email: 'a@b.com',
        name: 'Alice',
        role: 'admin',
      })
      await store.logout()
      expect(authService.logout).toHaveBeenCalledOnce()
    })

    // MEDIUM-02: isLoading false AFTER navigation
    it('isLoading is false after logout() completes (MEDIUM-02)', async () => {
      const { store } = buildStore()
      store.setSession('tok', {
        id: '1',
        email: 'a@b.com',
        name: 'Alice',
        role: 'admin',
      })
      await store.logout()
      expect(store.isLoading).toBe(false)
    })

    // FR-36: idempotency
    it('is a no-op when already logged out (idempotency FR-36)', async () => {
      const { store, authService } = buildStore()
      // Do NOT call setSession — store is in logged-out state
      await store.logout()
      expect(authService.logout).not.toHaveBeenCalled()
    })

    it('navigates to loginRouteName after logout', async () => {
      const { store, router } = buildStore()
      store.setSession('tok', {
        id: '1',
        email: 'a@b.com',
        name: 'Alice',
        role: 'admin',
      })
      const pushSpy = vi.spyOn(router, 'push')
      await store.logout()
      expect(pushSpy).toHaveBeenCalledWith({ name: 'mmc-login' })
    })

    it('still resolves when authService.logout() rejects (FR-30)', async () => {
      const { store, authService } = buildStore()
      store.setSession('tok', {
        id: '1',
        email: 'a@b.com',
        name: 'Alice',
        role: 'admin',
      })
      vi.mocked(authService.logout).mockRejectedValue(
        new Error('network error')
      )

      await expect(store.logout()).resolves.toBeUndefined()
    })

    it('still resets state when authService.logout() rejects', async () => {
      const { store, authService } = buildStore()
      store.setSession('tok', {
        id: '1',
        email: 'a@b.com',
        name: 'Alice',
        role: 'admin',
      })
      vi.mocked(authService.logout).mockRejectedValue(
        new Error('network error')
      )

      await store.logout()

      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
    })
  })

  // ── clearAuthError ────────────────────────────────────────────────────────

  describe('clearAuthError()', () => {
    it('clears an existing authError', async () => {
      const { store, authService } = buildStore()
      vi.mocked(authService.refreshToken).mockRejectedValue(new Error('error'))
      await store.initSession()

      expect(store.authError).not.toBeNull()
      store.clearAuthError()
      expect(store.authError).toBeNull()
    })

    it('is a no-op when authError is already null', () => {
      const { store } = buildStore()
      expect(() => store.clearAuthError()).not.toThrow()
      expect(store.authError).toBeNull()
    })
  })
})
