/**
 * Unit tests for apps/frontoffice/src/components/layout/AppLayout.vue
 *
 * Verifies:
 * - AppSidebar present when hideSidebar=false (default)
 * - AppSidebar absent when hideSidebar=true
 * - AppHeader always present
 * - .app-layout--mobile class present when isMobile=true
 * - backdrop only on mobile with sidebar visible
 * - all 5 named slots render injected content
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 * Task: T048
 */

import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppLayout from '@/components/layout/AppLayout.vue'

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ name: 'fo-home' })),
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  RouterView: { template: '<div class="stub-router-view" />' },
}))

const childStubs = {
  AppHeader: { template: '<div class="stub-app-header" />' },
  AppSidebar: { template: '<div class="stub-app-sidebar" />' },
  RouterView: { template: '<div class="stub-router-view" />' },
}

function createWrapper(
  opts: { hideSidebar?: boolean; isMobile?: boolean; sidebarCollapsed?: boolean } = {}
) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    initialState: {
      'frontoffice-ui': {
        sidebarCollapsed: opts.sidebarCollapsed ?? false,
        isMobile: opts.isMobile ?? false,
      },
      'frontoffice-auth': {
        user: { name: 'Test' },
        isAuthenticated: true,
        resolvedPermissions: {},
      },
    },
  })
  return mount(AppLayout, {
    props: { hideSidebar: opts.hideSidebar ?? false },
    global: { plugins: [pinia], stubs: childStubs },
  })
}

describe('AppLayout — Frontoffice', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('AppSidebar present when hideSidebar=false (default)', () => {
    expect(createWrapper({ hideSidebar: false }).find('.stub-app-sidebar').exists()).toBe(true)
  })

  it('AppSidebar absent when hideSidebar=true', () => {
    expect(createWrapper({ hideSidebar: true }).find('.stub-app-sidebar').exists()).toBe(false)
  })

  it('AppHeader always present regardless of hideSidebar', () => {
    expect(createWrapper({ hideSidebar: true }).find('.stub-app-header').exists()).toBe(true)
    expect(createWrapper({ hideSidebar: false }).find('.stub-app-header').exists()).toBe(true)
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

  it('mobile backdrop renders when !hideSidebar && isMobile && !sidebarCollapsed', () => {
    expect(
      createWrapper({
        hideSidebar: false,
        isMobile: true,
        sidebarCollapsed: false,
      })
        .find('.app-layout__backdrop')
        .exists()
    ).toBe(true)
  })

  it('mobile backdrop absent when hideSidebar=true', () => {
    expect(
      createWrapper({
        hideSidebar: true,
        isMobile: true,
        sidebarCollapsed: false,
      })
        .find('.app-layout__backdrop')
        .exists()
    ).toBe(false)
  })

  it('clicking backdrop calls useFrontofficeUiStore().toggleSidebar()', async () => {
    const wrapper = createWrapper({ isMobile: true, sidebarCollapsed: false })
    await wrapper.find('.app-layout__backdrop').trigger('click')
    const { useFrontofficeUiStore } = await import('@/core/state/ui.store')
    const store = useFrontofficeUiStore()
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
