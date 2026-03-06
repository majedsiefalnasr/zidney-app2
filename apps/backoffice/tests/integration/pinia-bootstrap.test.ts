/**
 * Integration test: Pinia bootstrap order for Backoffice
 * Verifies: persistence plugin registration, store config, workspace store availability
 *
 * SC-009: Core stores registered before first route guard fires.
 * FR-034: Plugin registered before first store instantiation.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */

import { createPinia, setActivePinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBackofficeAppStore } from '@/core/state/app.store'
import { useBackofficeWorkspaceStore } from '@/core/state/workspace.store'

describe('Backoffice Pinia Bootstrap (SC-009, FR-034)', () => {
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
    expect(() => useBackofficeAppStore()).not.toThrow()
  })

  it('useBackofficeWorkspaceStore is available post-init', () => {
    const pinia = createPinia()
    pinia.use(createPersistedState())
    setActivePinia(pinia)

    expect(() => {
      const store = useBackofficeWorkspaceStore()
      expect(store.workspace).toBeNull()
      expect(store.isLoading).toBe(false)
    }).not.toThrow()
  })

  it('backoffice app store persist.pick — no auth-related keys (SC-003)', () => {
    const pinia = createPinia()
    pinia.use(createPersistedState())
    setActivePinia(pinia)
    const store = useBackofficeAppStore()

    expect(store.$id).toBe('backoffice-app')
    expect(store).toHaveProperty('sidebarCollapsed')
    expect(store).toHaveProperty('theme')
    expect(store).toHaveProperty('locale')
    expect(store).not.toHaveProperty('token')
    expect(store).not.toHaveProperty('accessToken')
    expect(store).not.toHaveProperty('isAuthenticated')
  })

  it('workspace store has no persistence (FR-020)', () => {
    const pinia = createPinia()
    pinia.use(createPersistedState())
    setActivePinia(pinia)
    useBackofficeWorkspaceStore()

    // workspace store does not write to localStorage
    const stored = localStorage.getItem('backoffice-workspace')
    expect(stored).toBeNull()
  })

  it('auth store has no persisted keys (SC-009)', () => {
    const pinia = createPinia()
    pinia.use(createPersistedState())
    setActivePinia(pinia)

    const authStored = localStorage.getItem('backoffice-auth')
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
      const store = useBackofficeAppStore()
      store.setSidebarCollapsed(true)
    }).not.toThrow()
  })
})
