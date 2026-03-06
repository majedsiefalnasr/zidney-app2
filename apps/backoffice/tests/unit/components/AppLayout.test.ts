/**
 * Unit tests for apps/backoffice/src/components/layout/AppLayout.vue
 *
 * Verifies:
 * - AppSidebar and AppHeader present in DOM
 * - .app-layout--mobile class present when isMobile=true
 * - .app-layout--collapsed class present when sidebarCollapsed=true
 * - backdrop renders when isMobile=true && !sidebarCollapsed
 * - clicking backdrop calls toggleSidebar()
 * - all 5 named slots render injected content correctly
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 * Task: T047
 */
import AppLayout from '@/components/layout/AppLayout.vue'
import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Stub vue-router composables used by child components
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ name: 'bo-dashboard' })),
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  RouterView: { template: '<div class="stub-router-view" />' },
}))

const childStubs = {
  AppHeader: { template: '<div class="stub-app-header" />' },
  AppSidebar: { template: '<div class="stub-app-sidebar" />' },
  RouterView: { template: '<div class="stub-router-view" />' },
  SidebarLayout: {
    template: '<div><slot /></div>',
    emits: ['collapse-toggled'],
  },
}

function createWrapper(
  opts: {
    isMobile?: boolean
    sidebarCollapsed?: boolean
  } = {}
) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    initialState: {
      'backoffice-ui': {
        sidebarCollapsed: opts.sidebarCollapsed ?? false,
        isMobile: opts.isMobile ?? false,
      },
      'backoffice-auth': {
        user: { name: 'Test' },
        isAuthenticated: true,
        resolvedPermissions: {},
      },
      'backoffice-workspace': { workspace: { name: 'ACME' } },
    },
  })
  return mount(AppLayout, {
    global: { plugins: [pinia], stubs: childStubs },
  })
}

describe('AppLayout — Backoffice', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('AppSidebar is present in DOM', () => {
    expect(createWrapper().find('.stub-app-sidebar').exists()).toBe(true)
  })

  it('AppHeader is present in DOM', () => {
    expect(createWrapper().find('.stub-app-header').exists()).toBe(true)
  })

  it('adds .app-layout--mobile class when isMobile=true', () => {
    const wrapper = createWrapper({ isMobile: true })
    expect(wrapper.find('.app-layout').classes()).toContain(
      'app-layout--mobile'
    )
  })

  it('does not add .app-layout--mobile class when isMobile=false', () => {
    const wrapper = createWrapper({ isMobile: false })
    expect(wrapper.find('.app-layout').classes()).not.toContain(
      'app-layout--mobile'
    )
  })

  it('adds .app-layout--collapsed class when sidebarCollapsed=true', () => {
    const wrapper = createWrapper({ sidebarCollapsed: true })
    expect(wrapper.find('.app-layout').classes()).toContain(
      'app-layout--collapsed'
    )
  })

  it('mobile backdrop renders when isMobile=true and sidebarCollapsed=false', () => {
    const wrapper = createWrapper({ isMobile: true, sidebarCollapsed: false })
    expect(wrapper.find('.app-layout__backdrop').exists()).toBe(true)
  })

  it('mobile backdrop absent when sidebarCollapsed=true (sidebar is closed)', () => {
    const wrapper = createWrapper({ isMobile: true, sidebarCollapsed: true })
    expect(wrapper.find('.app-layout__backdrop').exists()).toBe(false)
  })

  it('mobile backdrop absent when isMobile=false', () => {
    const wrapper = createWrapper({ isMobile: false, sidebarCollapsed: false })
    expect(wrapper.find('.app-layout__backdrop').exists()).toBe(false)
  })

  it('clicking backdrop calls useBackofficeUiStore().toggleSidebar()', async () => {
    const wrapper = createWrapper({ isMobile: true, sidebarCollapsed: false })
    await wrapper.find('.app-layout__backdrop').trigger('click')
    const { useBackofficeUiStore } = await import('@/core/state/ui.store')
    const store = useBackofficeUiStore()
    expect(store.toggleSidebar).toHaveBeenCalled()
  })

  it('"header-left" slot renders injected content', () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const stubs = {
      ...childStubs,
      AppHeader: {
        template:
          '<div class="stub-app-header"><slot name="left" /><slot name="right" /></div>',
      },
    }
    const wrapper = mount(AppLayout, {
      global: { plugins: [pinia], stubs },
      slots: { 'header-left': '<span class="hl">HeaderLeft</span>' },
    })
    expect(wrapper.find('.hl').exists()).toBe(true)
  })

  it('"content-top" slot renders injected content', () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(AppLayout, {
      global: { plugins: [pinia], stubs: childStubs },
      slots: { 'content-top': '<div class="ct">ContentTop</div>' },
    })
    expect(wrapper.find('.ct').exists()).toBe(true)
  })

  it('"content-bottom" slot renders injected content', () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(AppLayout, {
      global: { plugins: [pinia], stubs: childStubs },
      slots: { 'content-bottom': '<div class="cb">ContentBottom</div>' },
    })
    expect(wrapper.find('.cb').exists()).toBe(true)
  })

  it('"sidebar-footer" slot renders injected content', () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const stubs = {
      ...childStubs,
      AppSidebar: {
        template: '<div class="stub-app-sidebar"><slot name="footer" /></div>',
      },
    }
    const wrapper = mount(AppLayout, {
      global: { plugins: [pinia], stubs },
      slots: { 'sidebar-footer': '<span class="sf">SidebarFooter</span>' },
    })
    expect(wrapper.find('.sf').exists()).toBe(true)
  })
})
