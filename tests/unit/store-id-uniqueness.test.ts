/**
 * Store ID Uniqueness Test (SC-010, FR-032, CR-H2)
 *
 * Tests that all store $id values are unique across all three apps.
 * Instantiates actual stores and reads runtime $id — does NOT use hardcoded strings.
 * Factory-pattern auth stores are instantiated with stub dependencies.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
// Backoffice stores
import { useBackofficeAppStore } from '../../apps/backoffice/src/core/state/app.store'
import { defineAuthStore as defineBackofficeAuthStore } from '../../apps/backoffice/src/core/state/auth.store'
import { useBackofficeNotificationStore } from '../../apps/backoffice/src/core/state/notification.store'
import { useBackofficeUiStore } from '../../apps/backoffice/src/core/state/ui.store'
import { useBackofficeWorkspaceStore } from '../../apps/backoffice/src/core/state/workspace.store'
// Frontoffice stores
import { useFrontofficeAppStore } from '../../apps/frontoffice/src/core/state/app.store'
import { defineAuthStore as defineFrontofficeAuthStore } from '../../apps/frontoffice/src/core/state/auth.store'
import { useFrontofficeNotificationStore } from '../../apps/frontoffice/src/core/state/notification.store'
import { useFrontofficeUiStore } from '../../apps/frontoffice/src/core/state/ui.store'
// MMC stores
import { useMmcAppStore } from '../../apps/mmc/src/core/state/app.store'
import { defineAuthStore as defineMmcAuthStore } from '../../apps/mmc/src/core/state/auth.store'
import { useMmcNotificationStore } from '../../apps/mmc/src/core/state/notification.store'
import { useMmcUiStore } from '../../apps/mmc/src/core/state/ui.store'

// ── Stub factories ─────────────────────────────────────────────────────────────
function createStubAuthDeps() {
  const authService = {
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn().mockResolvedValue({ accessToken: 'stub' }),
    fetchProfile: vi.fn().mockResolvedValue({ id: 'stub-id' }),
  }
  const tokenManager = {
    getToken: vi.fn().mockReturnValue(null),
    setToken: vi.fn(),
    clearToken: vi.fn(),
  }
  const router = {
    push: vi.fn().mockResolvedValue(undefined),
  }
  return { authService, tokenManager, router }
}

describe('Store ID Uniqueness (SC-010, FR-032)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('all core store $id values are unique across all apps', () => {
    const {
      authService: mmcAuthService,
      tokenManager: mmcTokenManager,
      router: mmcRouter,
    } = createStubAuthDeps()
    const {
      authService: boAuthService,
      tokenManager: boTokenManager,
      router: boRouter,
    } = createStubAuthDeps()
    const {
      authService: foAuthService,
      tokenManager: foTokenManager,
      router: foRouter,
    } = createStubAuthDeps()

    // Instantiate all stores and read their actual $id at runtime
    const storeIds = [
      // MMC auth store (factory pattern — instantiate with stubs)
      defineMmcAuthStore(
        mmcAuthService as any,
        mmcTokenManager as any,
        mmcRouter as any,
        'mmc-login',
        () => null
      )().$id,
      useMmcAppStore().$id,
      useMmcUiStore().$id,
      useMmcNotificationStore().$id,
      // Backoffice stores
      defineBackofficeAuthStore(
        boAuthService as any,
        boTokenManager as any,
        boRouter as any,
        'bo-login',
        () => null
      )().$id,
      useBackofficeAppStore().$id,
      useBackofficeUiStore().$id,
      useBackofficeNotificationStore().$id,
      useBackofficeWorkspaceStore().$id,
      // Frontoffice stores
      defineFrontofficeAuthStore(
        foAuthService as any,
        foTokenManager as any,
        foRouter as any,
        'fo-login',
        () => null
      )().$id,
      useFrontofficeAppStore().$id,
      useFrontofficeUiStore().$id,
      useFrontofficeNotificationStore().$id,
    ]

    // All 13 store ids must be unique (no duplicates across apps)
    const uniqueIds = new Set(storeIds)
    expect(uniqueIds.size).toBe(storeIds.length)
  })

  it('no store uses the reserved single-word id (must be namespaced)', () => {
    const { authService, tokenManager, router } = createStubAuthDeps()

    const allIds = [
      defineMmcAuthStore(
        authService as any,
        tokenManager as any,
        router as any,
        'mmc-login',
        () => null
      )().$id,
      useMmcAppStore().$id,
      useMmcNotificationStore().$id,
      useBackofficeAppStore().$id,
      useBackofficeWorkspaceStore().$id,
      useFrontofficeAppStore().$id,
    ]

    // No store should use a bare (non-namespaced) id
    expect(allIds).not.toContain('auth')
    expect(allIds).not.toContain('app')
    expect(allIds).not.toContain('workspace')
    expect(allIds).not.toContain('notification')
    expect(allIds).not.toContain('ui')
  })

  it('each app uses its own namespace prefix', () => {
    const { authService: a1, tokenManager: t1, router: r1 } = createStubAuthDeps()
    const { authService: a2, tokenManager: t2, router: r2 } = createStubAuthDeps()
    const { authService: a3, tokenManager: t3, router: r3 } = createStubAuthDeps()

    const mmcIds = [
      defineMmcAuthStore(a1 as any, t1 as any, r1 as any, 'mmc-login', () => null)().$id,
      useMmcAppStore().$id,
    ]
    const boIds = [
      defineBackofficeAuthStore(a2 as any, t2 as any, r2 as any, 'bo-login', () => null)().$id,
      useBackofficeAppStore().$id,
    ]
    const foIds = [
      defineFrontofficeAuthStore(a3 as any, t3 as any, r3 as any, 'fo-login', () => null)().$id,
      useFrontofficeAppStore().$id,
    ]

    mmcIds.forEach((id) => {
      expect(id).toMatch(/^mmc-/)
    })
    boIds.forEach((id) => {
      expect(id).toMatch(/^backoffice-/)
    })
    foIds.forEach((id) => {
      expect(id).toMatch(/^frontoffice-/)
    })
  })
})
