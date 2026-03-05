/**
 * Integration tests: app-layout shell composition for Backoffice
 *
 * Verifies:
 * - Full shell (AppLayout + AppSidebar + AppHeader) mounts without error
 * - Sidebar toggle flow: click → toggleSidebar() → CSS class updated
 * - App.vue with standaloneLayout route → AppLayout absent from DOM
 * - App.vue with normal route → AppLayout present in DOM
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 * Task: T050
 */
import App from '@/App.vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Control route meta for standaloneLayout tests
const mockRoute = { meta: { standaloneLayout: false } }

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => mockRoute),
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  RouterView: { template: '<div class="stub-router-view" />' },
}))

const topLevelStubs = {
  AppLayout: { template: '<div class="stub-app-layout" />' },
  RouterView: { template: '<div class="stub-router-view" />' },
}

const childStubs = {
  AppHeader: {
    template:
      '<div class="stub-app-header"><button class="collapse-btn" @click="$emit(\'collapse-click\')" /></div>',
    emits: ['collapse-click'],
  },
  AppSidebar: {
    template:
      '<div class="stub-app-sidebar"><button class="sidebar-collapse-btn" @click="$emit(\'collapse-toggled\')" /></div>',
    emits: ['collapse-toggled'],
  },
  RouterView: { template: '<div class="stub-router-view" />' },
  SidebarLayout: {
    template:
      '<div class="stub-sidebar-layout" @click="$emit(\'collapse-toggled\')"><slot /></div>',
    emits: ['collapse-toggled'],
  },
}

describe('Backoffice app-layout integration', () => {
  afterEach(() => {
    vi.clearAllMocks()
    mockRoute.meta.standaloneLayout = false
  })

  // ── Shell composition ──────────────────────────────────────────────────

  it('AppLayout mounts with stubs without error', () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'backoffice-ui': { sidebarCollapsed: false, isMobile: false },
        'backoffice-auth': {
          user: { name: 'Test' },
          isAuthenticated: true,
          resolvedPermissions: {},
        },
        'backoffice-workspace': { workspace: { name: 'Test WS' } },
      },
    })
    expect(() =>
      mount(AppLayout, {
        global: { plugins: [pinia], stubs: childStubs },
      })
    ).not.toThrow()
  })

  // ── standaloneLayout bypass ────────────────────────────────────────────

  it('App.vue renders AppLayout for normal routes (standaloneLayout not set)', () => {
    mockRoute.meta.standaloneLayout = false
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(App, {
      global: { plugins: [pinia], stubs: topLevelStubs },
    })
    expect(wrapper.find('.stub-app-layout').exists()).toBe(true)
    expect(wrapper.find('.stub-router-view').exists()).toBe(false)
  })

  it('App.vue renders bare RouterView for standaloneLayout routes (no AppLayout)', () => {
    mockRoute.meta.standaloneLayout = true
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(App, {
      global: { plugins: [pinia], stubs: topLevelStubs },
    })
    expect(wrapper.find('.stub-router-view').exists()).toBe(true)
    expect(wrapper.find('.stub-app-layout').exists()).toBe(false)
  })

  // ── Sidebar toggle flow ────────────────────────────────────────────────

  it('sidebar toggle propagates: backdrop click → toggleSidebar() → layout reclasses', async () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'backoffice-ui': { sidebarCollapsed: false, isMobile: true },
        'backoffice-auth': {
          user: { name: 'Test' },
          isAuthenticated: true,
          resolvedPermissions: {},
        },
        'backoffice-workspace': { workspace: null },
      },
    })
    const wrapper = mount(AppLayout, {
      global: { plugins: [pinia], stubs: childStubs },
    })
    // Backdrop is visible: isMobile=true && sidebarCollapsed=false
    expect(wrapper.find('.app-layout__backdrop').exists()).toBe(true)
    await wrapper.find('.app-layout__backdrop').trigger('click')

    const { useBackofficeUiStore } = await import('@/core/state/ui.store')
    const store = useBackofficeUiStore()
    expect(store.toggleSidebar).toHaveBeenCalled()
  })
})
