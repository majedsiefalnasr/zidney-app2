/**
 * Integration test: full logout flow scenarios.
 * Verifies:
 *   A) Normal logout: state cleared, router redirected
 *   B) Backend error: logout still resolves, state cleared (FR-30)
 *   C) Double logout: idempotent — authService.logout called exactly once
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineAuthStore } from '../../../src/core/state/auth.store'
import {
  createMockAuthService,
  createMockTokenManager,
  createTestRouter,
} from '../../unit/auth/setup'
import type { AuthUser } from '../../../src/core/auth/types'

// ─── Logger mock ─────────────────────────────────────────────────────────────
vi.mock('@zidney/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_USER: AuthUser = { id: '1', email: 'user@test.com', name: 'User', role: 'admin' }

function buildStore() {
  const pinia = createPinia()
  setActivePinia(pinia)

  const authService = createMockAuthService()
  const tokenManager = createMockTokenManager()
  const router = createTestRouter()

  const useAuthStore = defineAuthStore(
    authService,
    tokenManager,
    router,
    'mmc-login',
    () => null
  )

  const store = useAuthStore(pinia)
  const pushSpy = vi.spyOn(router, 'push')

  return { store, authService, tokenManager, router, pushSpy }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('logout flow integration', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  // ── Scenario A: Normal logout ─────────────────────────────────────────────

  describe('Scenario A — normal logout (authenticated user)', () => {
    it('authService.logout() called exactly once', async () => {
      const { store, authService } = buildStore()
      store.setSession('tok', TEST_USER)

      await store.logout()
      expect(authService.logout).toHaveBeenCalledOnce()
    })

    it('tokenManager.clearToken() called', async () => {
      const { store, tokenManager } = buildStore()
      store.setSession('tok', TEST_USER)

      await store.logout()
      expect(tokenManager.clearToken).toHaveBeenCalledOnce()
    })

    it('isAuthenticated is false after logout', async () => {
      const { store } = buildStore()
      store.setSession('tok', TEST_USER)

      await store.logout()
      expect(store.isAuthenticated).toBe(false)
    })

    it('user is null after logout', async () => {
      const { store } = buildStore()
      store.setSession('tok', TEST_USER)

      await store.logout()
      expect(store.user).toBeNull()
    })

    it('router.push({ name: loginRouteName }) called', async () => {
      const { store, pushSpy } = buildStore()
      store.setSession('tok', TEST_USER)

      await store.logout()
      expect(pushSpy).toHaveBeenCalledWith({ name: 'mmc-login' })
    })

    it('isLoading is false after logout completes (MEDIUM-02)', async () => {
      const { store } = buildStore()
      store.setSession('tok', TEST_USER)

      await store.logout()
      expect(store.isLoading).toBe(false)
    })
  })

  // ── Scenario B: Backend error during logout ───────────────────────────────

  describe('Scenario B — backend logout fails (FR-30)', () => {
    it('logout() still resolves when authService.logout() rejects', async () => {
      const { store, authService } = buildStore()
      store.setSession('tok', TEST_USER)
      vi.mocked(authService.logout).mockRejectedValue(new Error('500'))

      await expect(store.logout()).resolves.toBeUndefined()
    })

    it('state is cleared even when backend logout fails', async () => {
      const { store, authService } = buildStore()
      store.setSession('tok', TEST_USER)
      vi.mocked(authService.logout).mockRejectedValue(new Error('500'))

      await store.logout()
      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
    })

    it('tokenManager is cleared even when backend logout fails', async () => {
      const { store, authService, tokenManager } = buildStore()
      store.setSession('tok', TEST_USER)
      vi.mocked(authService.logout).mockRejectedValue(new Error('500'))

      await store.logout()
      expect(tokenManager.clearToken).toHaveBeenCalledOnce()
    })

    it('router still redirects even when backend logout fails', async () => {
      const { store, authService, pushSpy } = buildStore()
      store.setSession('tok', TEST_USER)
      vi.mocked(authService.logout).mockRejectedValue(new Error('500'))

      await store.logout()
      expect(pushSpy).toHaveBeenCalledWith({ name: 'mmc-login' })
    })
  })

  // ── Scenario C: Double logout idempotency ────────────────────────────────

  describe('Scenario C — double logout (FR-36 idempotency)', () => {
    it('authService.logout() called exactly once on concurrent double call', async () => {
      const { store, authService } = buildStore()
      store.setSession('tok', TEST_USER)

      // Fire two concurrent logout calls
      await Promise.all([store.logout(), store.logout()])

      // Idempotency: only one backend call despite two invocations
      expect(authService.logout).toHaveBeenCalledTimes(1)
    })

    it('second sequential logout (after first completes) is a no-op', async () => {
      const { store, authService } = buildStore()
      store.setSession('tok', TEST_USER)

      await store.logout()
      // Now logged out — second call should be no-op
      await store.logout()

      expect(authService.logout).toHaveBeenCalledTimes(1)
    })

    it('router.push called exactly once on double logout', async () => {
      const { store, pushSpy } = buildStore()
      store.setSession('tok', TEST_USER)

      await Promise.all([store.logout(), store.logout()])
      expect(pushSpy).toHaveBeenCalledTimes(1)
    })
  })
})
