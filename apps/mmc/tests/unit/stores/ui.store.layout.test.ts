/**
 * Unit tests for useMmcUiStore — layout-related state extensions
 * Coverage: toggleSidebar, setMobile, sidebarCollapsed, isMobile
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 * Task: T034
 */
import { useMmcUiStore } from '@/core/state/ui.store'
import { describe, expect, it } from 'vitest'
import { useIsolatedPinia } from '../store-test-helper'

describe('useMmcUiStore — layout state', () => {
  useIsolatedPinia()

  // ── Initial state ──────────────────────────────────────────────────────

  it('initializes sidebarCollapsed as false', () => {
    const store = useMmcUiStore()
    expect(store.sidebarCollapsed).toBe(false)
  })

  it('initializes isMobile as false', () => {
    const store = useMmcUiStore()
    expect(store.isMobile).toBe(false)
  })

  // ── toggleSidebar ──────────────────────────────────────────────────────

  it('toggleSidebar flips sidebarCollapsed from false to true', () => {
    const store = useMmcUiStore()
    store.toggleSidebar()
    expect(store.sidebarCollapsed).toBe(true)
  })

  it('toggleSidebar flips sidebarCollapsed from true to false', () => {
    const store = useMmcUiStore()
    store.toggleSidebar()
    store.toggleSidebar()
    expect(store.sidebarCollapsed).toBe(false)
  })

  // ── setMobile ──────────────────────────────────────────────────────────

  it('setMobile(true) sets isMobile to true', () => {
    const store = useMmcUiStore()
    store.setMobile(true)
    expect(store.isMobile).toBe(true)
  })

  it('setMobile(true) atomically sets sidebarCollapsed to true (CL-005)', () => {
    const store = useMmcUiStore()
    store.setMobile(true)
    expect(store.sidebarCollapsed).toBe(true)
  })

  it('setMobile(false) resets isMobile to false', () => {
    const store = useMmcUiStore()
    store.setMobile(true)
    store.setMobile(false)
    expect(store.isMobile).toBe(false)
  })

  it('setMobile(false) resets sidebarCollapsed to false', () => {
    const store = useMmcUiStore()
    store.setMobile(true)
    store.setMobile(false)
    expect(store.sidebarCollapsed).toBe(false)
  })

  it('setMobile is a no-op when called with the same value (true → true)', () => {
    const store = useMmcUiStore()
    store.setMobile(true)
    const collapsedBefore = store.sidebarCollapsed
    store.setMobile(true)
    expect(store.isMobile).toBe(true)
    expect(store.sidebarCollapsed).toBe(collapsedBefore)
  })

  it('setMobile is a no-op when called with the same value (false → false)', () => {
    const store = useMmcUiStore()
    store.setMobile(false)
    expect(store.isMobile).toBe(false)
    expect(store.sidebarCollapsed).toBe(false)
  })

  // ── $reset ─────────────────────────────────────────────────────────────

  it('$reset clears sidebarCollapsed to false', () => {
    const store = useMmcUiStore()
    store.toggleSidebar()
    expect(store.sidebarCollapsed).toBe(true)
    store.$reset()
    expect(store.sidebarCollapsed).toBe(false)
  })

  it('$reset clears isMobile to false', () => {
    const store = useMmcUiStore()
    store.setMobile(true)
    expect(store.isMobile).toBe(true)
    store.$reset()
    expect(store.isMobile).toBe(false)
  })
})
