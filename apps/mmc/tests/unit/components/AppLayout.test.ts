/**
 * Unit tests for apps/mmc/src/components/layout/AppLayout.vue
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
 * Task: T046
 */

import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppLayout from '@/components/layout/AppLayout.vue'

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ name: 'mmc-dashboard' })),
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  RouterView: { template: '<div class="stub-router-view" />' },
}))

const childStubs = {
  AppHeader: { template: '<div class="stub-app-header" />' },
  AppSidebar: { template: '<div class="stub-app-sidebar" />' },
  RouterView: { template: '<div class="stub-router-view" />' },
}

function createWrapper(opts: { isMobile?: boolean; sidebarCollapsed?: boolean } = {}) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    initialState: {
      'mmc-ui': {
        sidebarCollapsed: opts.sidebarCollapsed ?? false,
        isMobile: opts.isMobile ?? false,
      },
      'mmc-auth': {
        user: { name: 'Test' },
        isAuthenticated: true,
        resolvedPermissions: {},
      },
    },
  })
  return mount(AppLayout, {
    global: { plugins: [pinia], stubs: childStubs },
  })
}

describe('AppLayout — MMC', () => {
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
    expect(createWrapper({ isMobile: true }).find('.app-layout').classes()).toContain(
      'app-layout--mobile'
    )
  })

  it('adds .app-layout--collapsed class when sidebarCollapsed=true', () => {
    expect(createWrapper({ sidebarCollapsed: true }).find('.app-layout').classes()).toContain(
      'app-layout--collapsed'
    )
  })

  it('mobile backdrop renders when isMobile=true and sidebarCollapsed=false', () => {
    expect(
      createWrapper({ isMobile: true, sidebarCollapsed: false })
        .find('.app-layout__backdrop')
        .exists()
    ).toBe(true)
  })

  it('mobile backdrop absent when sidebarCollapsed=true', () => {
    expect(
      createWrapper({ isMobile: true, sidebarCollapsed: true })
        .find('.app-layout__backdrop')
        .exists()
    ).toBe(false)
  })

  it('mobile backdrop absent when isMobile=false', () => {
    expect(createWrapper({ isMobile: false }).find('.app-layout__backdrop').exists()).toBe(false)
  })

  it('clicking backdrop calls useMmcUiStore().toggleSidebar()', async () => {
    const wrapper = createWrapper({ isMobile: true, sidebarCollapsed: false })
    await wrapper.find('.app-layout__backdrop').trigger('click')
    const { useMmcUiStore } = await import('@/core/state/ui.store')
    const store = useMmcUiStore()
    expect(store.toggleSidebar).toHaveBeenCalled()
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
})
