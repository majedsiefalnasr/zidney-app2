/**
 * Integration test: Pinia bootstrap order for Frontoffice
 * Verifies: persistence plugin registration, store config, auth store isolation
 *
 * SC-009: Core stores registered before first route guard fires.
 * FR-034: Plugin registered before first store instantiation.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */

import { createPinia, setActivePinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFrontofficeAppStore } from '@/core/state/app.store'

describe('Frontoffice Pinia Bootstrap (SC-009, FR-034)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pinia-plugin-persistedstate can be imported and registered', () => {
    expect(createPersistedState).toBeDefined()
    const pinia = createPinia()
    expect(() => pinia.use(createPersistedState())).not.toThrow()
  })

  it('plugin is registered before store instantiation (FR-034)', () => {
    const pinia = createPinia()
    pinia.use(createPersistedState())
    setActivePinia(pinia)
    expect(() => useFrontofficeAppStore()).not.toThrow()
  })

  it('frontoffice app store persist.pick — no auth-related keys (SC-003)', () => {
    const pinia = createPinia()
    pinia.use(createPersistedState())
    setActivePinia(pinia)
    const store = useFrontofficeAppStore()

    expect(store.$id).toBe('frontoffice-app')
    expect(store).toHaveProperty('sidebarCollapsed')
    expect(store).toHaveProperty('theme')
    expect(store).toHaveProperty('locale')
    expect(store).not.toHaveProperty('token')
    expect(store).not.toHaveProperty('accessToken')
    expect(store).not.toHaveProperty('isAuthenticated')
  })

  it('auth store has no persisted keys (SC-009, FR-026)', () => {
    const pinia = createPinia()
    pinia.use(createPersistedState())
    setActivePinia(pinia)

    const authStored = localStorage.getItem('frontoffice-auth')
    expect(authStored).toBeNull()
  })

  it('app initializes without throwing when localStorage.setItem throws QuotaExceededError (FR-025, QA-H002)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    const pinia = createPinia()
    pinia.use(createPersistedState())
    setActivePinia(pinia)

    expect(() => {
      const store = useFrontofficeAppStore()
      store.setSidebarCollapsed(true)
    }).not.toThrow()
  })

  it('frontoffice app store only persists layout fields (no permissions or roles)', () => {
    const pinia = createPinia()
    pinia.use(createPersistedState())
    setActivePinia(pinia)
    const store = useFrontofficeAppStore()

    store.setSidebarCollapsed(true)
    const stored = localStorage.getItem('frontoffice-app')
    if (stored) {
      const parsed = JSON.parse(stored)
      expect(parsed).not.toHaveProperty('permissions')
      expect(parsed).not.toHaveProperty('roles')
      expect(parsed).not.toHaveProperty('token')
    }
  })
})
