/**
 * Unit tests for useFrontofficeUiStore — layout-related state extensions
 * Coverage: toggleSidebar, setMobile, sidebarCollapsed, isMobile
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 * Task: T036
 */
import { useFrontofficeUiStore } from '@/core/state/ui.store'
import { describe, expect, it } from 'vitest'
import { useIsolatedPinia } from '../store-test-helper'

describe('useFrontofficeUiStore — layout state', () => {
  useIsolatedPinia()

  it('initializes sidebarCollapsed as false', () => {
    expect(useFrontofficeUiStore().sidebarCollapsed).toBe(false)
  })

  it('initializes isMobile as false', () => {
    expect(useFrontofficeUiStore().isMobile).toBe(false)
  })

  it('toggleSidebar flips sidebarCollapsed from false to true', () => {
    const store = useFrontofficeUiStore()
    store.toggleSidebar()
    expect(store.sidebarCollapsed).toBe(true)
  })

  it('toggleSidebar flips sidebarCollapsed from true to false', () => {
    const store = useFrontofficeUiStore()
    store.toggleSidebar()
    store.toggleSidebar()
    expect(store.sidebarCollapsed).toBe(false)
  })

  it('setMobile(true) sets isMobile to true', () => {
    const store = useFrontofficeUiStore()
    store.setMobile(true)
    expect(store.isMobile).toBe(true)
  })

  it('setMobile(true) atomically sets sidebarCollapsed to true (CL-005)', () => {
    const store = useFrontofficeUiStore()
    store.setMobile(true)
    expect(store.sidebarCollapsed).toBe(true)
  })

  it('setMobile(false) resets isMobile to false', () => {
    const store = useFrontofficeUiStore()
    store.setMobile(true)
    store.setMobile(false)
    expect(store.isMobile).toBe(false)
  })

  it('setMobile(false) resets sidebarCollapsed to false', () => {
    const store = useFrontofficeUiStore()
    store.setMobile(true)
    store.setMobile(false)
    expect(store.sidebarCollapsed).toBe(false)
  })

  it('setMobile is a no-op when called with the same value (true → true)', () => {
    const store = useFrontofficeUiStore()
    store.setMobile(true)
    const beforeCollapsed = store.sidebarCollapsed
    store.setMobile(true)
    expect(store.isMobile).toBe(true)
    expect(store.sidebarCollapsed).toBe(beforeCollapsed)
  })

  it('setMobile is a no-op when called with the same value (false → false)', () => {
    const store = useFrontofficeUiStore()
    store.setMobile(false)
    expect(store.isMobile).toBe(false)
    expect(store.sidebarCollapsed).toBe(false)
  })

  it('$reset clears sidebarCollapsed to false', () => {
    const store = useFrontofficeUiStore()
    store.toggleSidebar()
    store.$reset()
    expect(store.sidebarCollapsed).toBe(false)
  })

  it('$reset clears isMobile to false', () => {
    const store = useFrontofficeUiStore()
    store.setMobile(true)
    store.$reset()
    expect(store.isMobile).toBe(false)
  })
})
