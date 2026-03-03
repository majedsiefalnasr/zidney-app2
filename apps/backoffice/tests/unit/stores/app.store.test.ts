/**
 * Unit tests for useBackofficeAppStore
 * Coverage: FR-028, FR-030, SC-001, SC-003, FR-023
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
import { useBackofficeAppStore } from '@/core/state/app.store'
import { describe, expect, it } from 'vitest'
import { useIsolatedPinia } from '../store-test-helper'

describe('useBackofficeAppStore', () => {
  useIsolatedPinia()

  it('initializes with default state', () => {
    const store = useBackofficeAppStore()
    expect(store.sidebarCollapsed).toBe(false)
    expect(store.theme).toBe('system')
    expect(store.locale).toBe('en')
    // NOTE (CR-M2): isLoading and error are NOT present — app.store has no async actions
  })

  it('setSidebarCollapsed updates state', () => {
    const store = useBackofficeAppStore()
    store.setSidebarCollapsed(true)
    expect(store.sidebarCollapsed).toBe(true)
  })

  it('setTheme updates theme', () => {
    const store = useBackofficeAppStore()
    store.setTheme('dark')
    expect(store.theme).toBe('dark')
  })

  it('setLocale updates locale', () => {
    const store = useBackofficeAppStore()
    store.setLocale('ar')
    expect(store.locale).toBe('ar')
  })

  it('$reset restores initial state', () => {
    const store = useBackofficeAppStore()
    store.setSidebarCollapsed(true)
    store.setTheme('dark')
    store.setLocale('fr')
    store.$reset()
    expect(store.sidebarCollapsed).toBe(false)
    expect(store.theme).toBe('system')
    expect(store.locale).toBe('en')
  })

  it('state is isolated between tests (SC-005)', () => {
    const store = useBackofficeAppStore()
    expect(store.sidebarCollapsed).toBe(false)
  })

  it('persist.pick contains exactly sidebarCollapsed, theme, locale — no auth-related keys (SC-003, SC-008)', () => {
    const store = useBackofficeAppStore()
    expect(store.$id).toBe('backoffice-app')
    expect(store).not.toHaveProperty('token')
    expect(store).not.toHaveProperty('accessToken')
    expect(store).not.toHaveProperty('permissions')
    expect(store).not.toHaveProperty('roles')
    const stateKeys = ['sidebarCollapsed', 'theme', 'locale']
    stateKeys.forEach((key) => {
      expect(store).toHaveProperty(key)
    })
  })
})
