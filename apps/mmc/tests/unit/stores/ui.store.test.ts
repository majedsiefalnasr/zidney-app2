/**
 * Unit tests for useMmcUiStore
 * Coverage: FR-020
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
import { useMmcUiStore } from '@/core/state/ui.store'
import { describe, expect, it } from 'vitest'
import { useIsolatedPinia } from '../store-test-helper'

describe('useMmcUiStore', () => {
  useIsolatedPinia()

  it('initializes with default state', () => {
    const store = useMmcUiStore()
    expect(store.modals).toEqual({})
    expect(store.drawers).toEqual({})
    expect(store.overlayVisible).toBe(false)
  })

  it('openModal sets modal to true', () => {
    const store = useMmcUiStore()
    store.openModal('confirm')
    expect(store.modals['confirm']).toBe(true)
  })

  it('closeModal sets modal to false', () => {
    const store = useMmcUiStore()
    store.openModal('confirm')
    store.closeModal('confirm')
    expect(store.modals['confirm']).toBe(false)
  })

  it('toggleModal toggles modal state', () => {
    const store = useMmcUiStore()
    store.toggleModal('settings')
    expect(store.modals['settings']).toBe(true)
    store.toggleModal('settings')
    expect(store.modals['settings']).toBe(false)
  })

  it('openDrawer sets drawer to true', () => {
    const store = useMmcUiStore()
    store.openDrawer('sidebar')
    expect(store.drawers['sidebar']).toBe(true)
  })

  it('closeDrawer sets drawer to false', () => {
    const store = useMmcUiStore()
    store.openDrawer('sidebar')
    store.closeDrawer('sidebar')
    expect(store.drawers['sidebar']).toBe(false)
  })

  it('toggleDrawer toggles drawer state', () => {
    const store = useMmcUiStore()
    store.toggleDrawer('nav')
    expect(store.drawers['nav']).toBe(true)
    store.toggleDrawer('nav')
    expect(store.drawers['nav']).toBe(false)
  })

  it('showOverlay sets overlayVisible to true', () => {
    const store = useMmcUiStore()
    store.showOverlay()
    expect(store.overlayVisible).toBe(true)
  })

  it('hideOverlay sets overlayVisible to false', () => {
    const store = useMmcUiStore()
    store.showOverlay()
    store.hideOverlay()
    expect(store.overlayVisible).toBe(false)
  })

  it('closeAll clears all modals, drawers, and overlay', () => {
    const store = useMmcUiStore()
    store.openModal('a')
    store.openDrawer('b')
    store.showOverlay()
    store.closeAll()
    expect(store.modals).toEqual({})
    expect(store.drawers).toEqual({})
    expect(store.overlayVisible).toBe(false)
  })

  it('$reset restores initial state', () => {
    const store = useMmcUiStore()
    store.openModal('x')
    store.openDrawer('y')
    store.showOverlay()
    store.$reset()
    expect(store.modals).toEqual({})
    expect(store.drawers).toEqual({})
    expect(store.overlayVisible).toBe(false)
  })

  it('state is isolated between tests (SC-005)', () => {
    const store = useMmcUiStore()
    expect(store.modals).toEqual({})
  })
})
