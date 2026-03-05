/**
 * Unit tests for apps/frontoffice/src/components/layout/AppSidebar.vue
 *
 * Verifies:
 * - Items with met permissions are visible
 * - Items with unmet permissions are hidden
 * - Items without permission field are always visible
 * - Active route item has active CSS class
 * - Collapse toggle calls useFrontofficeUiStore().toggleSidebar()
 * - footer slot renders injected content
 * - Empty navigationConfig renders without error
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 * Task: T045
 */
import AppSidebar from '@/components/layout/AppSidebar.vue'
import type { NavigationConfig } from '@/core/navigation/index'
import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ name: 'fo-home' })),
  RouterLink: {
    props: ['to'],
    template: '<a class="stub-router-link" :class="$attrs.class"><slot /></a>',
    inheritAttrs: false,
  },
}))

const sidebarLayoutStub = {
  props: ['items', 'collapsed', 'collapsible', 'activeItem'],
  emits: ['collapse-toggled'],
  template:
    '<div class="stub-sidebar-layout" @click="$emit(\'collapse-toggled\')"><slot /><slot name="footer" /></div>',
}

const testNav: NavigationConfig = [
  {
    items: [
      { routeName: 'fo-home', label: 'Home' },
      { routeName: 'fo-exams', label: 'My Exams', permission: 'exam.attempt' },
    ],
  },
]

function createWrapper(
  opts: { resolvedPermissions?: Record<string, boolean> } = {}
) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    initialState: {
      'frontoffice-auth': {
        resolvedPermissions: opts.resolvedPermissions ?? {},
      },
      'frontoffice-ui': { sidebarCollapsed: false, isMobile: false },
    },
  })
  return mount(AppSidebar, {
    props: { navigationConfig: testNav },
    global: {
      plugins: [pinia],
      stubs: {
        SidebarLayout: sidebarLayoutStub,
        RouterLink: {
          props: ['to'],
          template:
            '<a class="stub-router-link" :class="$attrs.class"><slot /></a>',
          inheritAttrs: false,
        },
        Teleport: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('AppSidebar — Frontoffice', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders items without a permission field always (Home)', () => {
    expect(createWrapper().text()).toContain('Home')
  })

  it('shows items with resolvedPermissions[key] === true', () => {
    const wrapper = createWrapper({
      resolvedPermissions: { 'exam.attempt': true },
    })
    expect(wrapper.text()).toContain('My Exams')
  })

  it('hides items with resolvedPermissions[key] === false', () => {
    const wrapper = createWrapper({
      resolvedPermissions: { 'exam.attempt': false },
    })
    expect(wrapper.text()).not.toContain('My Exams')
  })

  it('hides items with missing permission key', () => {
    expect(createWrapper({ resolvedPermissions: {} }).text()).not.toContain(
      'My Exams'
    )
  })

  it('active route item has app-sidebar__nav-item--active class', () => {
    const wrapper = createWrapper()
    const homeLink = wrapper
      .findAll('.stub-router-link')
      .find((el) => el.text().includes('Home'))
    expect(homeLink?.classes()).toContain('app-sidebar__nav-item--active')
  })

  it('clicking collapse control calls useFrontofficeUiStore().toggleSidebar()', async () => {
    const wrapper = createWrapper()
    await wrapper.find('.stub-sidebar-layout').trigger('click')
    const { useFrontofficeUiStore } = await import('@/core/state/ui.store')
    const store = useFrontofficeUiStore()
    expect(store.toggleSidebar).toHaveBeenCalled()
  })

  it('footer slot renders injected content', () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(AppSidebar, {
      props: { navigationConfig: testNav },
      global: {
        plugins: [pinia],
        stubs: {
          SidebarLayout: sidebarLayoutStub,
          RouterLink: { props: ['to'], template: '<a><slot /></a>' },
          Teleport: { template: '<div><slot /></div>' },
        },
      },
      slots: { footer: '<span class="footer-slot">Footer</span>' },
    })
    expect(wrapper.find('.footer-slot').exists()).toBe(true)
  })

  it('empty navigationConfig renders without error', () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    expect(() =>
      mount(AppSidebar, {
        props: { navigationConfig: [] },
        global: {
          plugins: [pinia],
          stubs: {
            SidebarLayout: sidebarLayoutStub,
            RouterLink: { props: ['to'], template: '<a><slot /></a>' },
            Teleport: { template: '<div><slot /></div>' },
          },
        },
      })
    ).not.toThrow()
  })
})
