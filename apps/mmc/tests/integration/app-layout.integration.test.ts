/**
 * Integration tests: app-layout shell composition for MMC
 *
 * Verifies:
 * - Full shell mounts without error
 * - Sidebar toggle flow works end-to-end
 * - App.vue with standaloneLayout route → AppLayout absent
 * - App.vue with normal route → AppLayout present
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 * Task: T049
 */

import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '@/App.vue'
import AppLayout from '@/components/layout/AppLayout.vue'

const mockRoute = { meta: { standaloneLayout: false } }

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => mockRoute),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })),
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  RouterView: { template: '<div class="stub-router-view" />' },
}))

const topLevelStubs = {
  AppLayout: { template: '<div class="stub-app-layout" />' },
  RouterView: { template: '<div class="stub-router-view" />' },
}

const childStubs = {
  AppHeader: { template: '<div class="stub-app-header" />' },
  AppSidebar: { template: '<div class="stub-app-sidebar" />' },
  RouterView: { template: '<div class="stub-router-view" />' },
}

describe('MMC app-layout integration', () => {
  afterEach(() => {
    vi.clearAllMocks()
    mockRoute.meta.standaloneLayout = false
  })

  it('AppLayout mounts with stubs without error', () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'mmc-ui': { sidebarCollapsed: false, isMobile: false },
        'mmc-auth': {
          user: { name: 'Test' },
          isAuthenticated: true,
          resolvedPermissions: {},
        },
      },
    })
    expect(() =>
      mount(AppLayout, { global: { plugins: [pinia], stubs: childStubs } })
    ).not.toThrow()
  })

  it('App.vue renders AppLayout for normal routes', () => {
    mockRoute.meta.standaloneLayout = false
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(App, {
      global: { plugins: [pinia], stubs: topLevelStubs },
    })
    expect(wrapper.find('.stub-app-layout').exists()).toBe(true)
    expect(wrapper.find('.stub-router-view').exists()).toBe(false)
  })

  it('App.vue renders bare RouterView for standaloneLayout routes', () => {
    mockRoute.meta.standaloneLayout = true
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(App, {
      global: { plugins: [pinia], stubs: topLevelStubs },
    })
    expect(wrapper.find('.stub-router-view').exists()).toBe(true)
    expect(wrapper.find('.stub-app-layout').exists()).toBe(false)
  })

  it('sidebar backdrop click → toggleSidebar() called', async () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'mmc-ui': { sidebarCollapsed: false, isMobile: true },
        'mmc-auth': {
          user: { name: 'Test' },
          isAuthenticated: true,
          resolvedPermissions: {},
        },
      },
    })
    const wrapper = mount(AppLayout, {
      global: { plugins: [pinia], stubs: childStubs },
    })
    expect(wrapper.find('.app-layout__backdrop').exists()).toBe(true)
    await wrapper.find('.app-layout__backdrop').trigger('click')
    const { useMmcUiStore } = await import('@/core/state/ui.store')
    expect(useMmcUiStore().toggleSidebar).toHaveBeenCalled()
  })
})
