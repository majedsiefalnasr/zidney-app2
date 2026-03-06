/**
 * Integration test: session initialization scenarios.
 * Verifies the full initSession() flow:
 *   A) authenticated reload: refresh succeeds → isAuthenticated: true
 *   B) unauthenticated reload: refresh fails → isAuthenticated: false, no redirect
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineAuthStore } from '../../../src/core/state/auth.store'
import {
  createMockAuthService,
  createMockTokenManager,
  createTestRouter,
} from '../../unit/auth/setup'

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
function buildStore() {
  const pinia = createPinia()
  setActivePinia(pinia)

  const authService = createMockAuthService()
  const tokenManager = createMockTokenManager()
  const router = createTestRouter()

  const useAuthStore = defineAuthStore(authService, tokenManager, router, 'mmc-login', () => null)

  const store = useAuthStore(pinia)
  return { store, authService, tokenManager, router }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('session initialization integration', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  // ── Scenario A: Authenticated reload ─────────────────────────────────────

  describe('Scenario A — authenticated reload (refresh succeeds)', () => {
    it('sets isAuthenticated to true', async () => {
      const { store, authService } = buildStore()
      vi.mocked(authService.refreshToken).mockResolvedValue({
        accessToken: 'bearer-tok',
      })
      vi.mocked(authService.fetchProfile).mockResolvedValue({
        id: '1',
        email: 'user@test.com',
        name: 'User',
        role: 'admin',
      })

      await store.initSession()
      expect(store.isAuthenticated).toBe(true)
    })

    it('populates user profile', async () => {
      const { store, authService } = buildStore()
      vi.mocked(authService.refreshToken).mockResolvedValue({
        accessToken: 'bearer-tok',
      })
      vi.mocked(authService.fetchProfile).mockResolvedValue({
        id: '99',
        email: 'u@t.com',
        name: 'Jane',
        role: 'viewer',
      })

      await store.initSession()
      expect(store.user?.id).toBe('99')
      expect(store.user?.email).toBe('u@t.com')
    })

    it('isLoading is false after completion', async () => {
      const { store } = buildStore()
      await store.initSession()
      expect(store.isLoading).toBe(false)
    })

    it('authError is null on success', async () => {
      const { store } = buildStore()
      await store.initSession()
      expect(store.authError).toBeNull()
    })

    it('stores token in tokenManager', async () => {
      const { store, authService, tokenManager } = buildStore()
      vi.mocked(authService.refreshToken).mockResolvedValue({
        accessToken: 'stored-tok',
      })
      vi.mocked(authService.fetchProfile).mockResolvedValue({
        id: '1',
        email: 'e@t.com',
        name: 'X',
        role: 'admin',
      })

      await store.initSession()
      expect(tokenManager.setToken).toHaveBeenCalledWith('stored-tok')
    })
  })

  // ── Scenario B: Unauthenticated reload ───────────────────────────────────

  describe('Scenario B — unauthenticated reload (refresh fails)', () => {
    it('isAuthenticated remains false', async () => {
      const { store, authService } = buildStore()
      vi.mocked(authService.refreshToken).mockRejectedValue(new Error('401'))

      await store.initSession()
      expect(store.isAuthenticated).toBe(false)
    })

    it('user remains null', async () => {
      const { store, authService } = buildStore()
      vi.mocked(authService.refreshToken).mockRejectedValue(new Error('401'))

      await store.initSession()
      expect(store.user).toBeNull()
    })

    it('sets authError.code to AUTH_INIT_FAILED', async () => {
      const { store, authService } = buildStore()
      vi.mocked(authService.refreshToken).mockRejectedValue(new Error('401'))

      await store.initSession()
      expect(store.authError?.code).toBe('AUTH_INIT_FAILED')
    })

    it('isLoading is false after failure', async () => {
      const { store, authService } = buildStore()
      vi.mocked(authService.refreshToken).mockRejectedValue(new Error('401'))

      await store.initSession()
      expect(store.isLoading).toBe(false)
    })

    it('router.push is NOT called (no redirect on session init failure)', async () => {
      const { store, authService, router } = buildStore()
      vi.mocked(authService.refreshToken).mockRejectedValue(new Error('401'))
      const pushSpy = vi.spyOn(router, 'push')

      await store.initSession()
      expect(pushSpy).not.toHaveBeenCalled()
    })
  })
})
