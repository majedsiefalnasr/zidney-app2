/**
 * Unit tests for apps/mmc/src/components/layout/AppSidebar.vue
 *
 * Verifies:
 * - Items with met permissions are visible
 * - Items with unmet permissions are hidden
 * - Items without permission field are always visible
 * - Active route item has active CSS class
 * - Collapse toggle calls useMmcUiStore().toggleSidebar()
 * - footer slot renders injected content
 * - Empty navigationConfig renders without error
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 * Task: T043
 */
import AppSidebar from '@/components/layout/AppSidebar.vue'
import type { NavigationConfig } from '@/core/navigation/index'
import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ name: 'mmc-dashboard' })),
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
    label: 'Platform',
    items: [
      { routeName: 'mmc-dashboard', label: 'Dashboard' },
      {
        routeName: 'mmc-workspaces',
        label: 'Workspaces',
        permission: 'workspace.list',
      },
    ],
  },
]

function createWrapper(
  opts: { resolvedPermissions?: Record<string, boolean> } = {}
) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    initialState: {
      'mmc-auth': { resolvedPermissions: opts.resolvedPermissions ?? {} },
      'mmc-ui': { sidebarCollapsed: false, isMobile: false },
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

describe('AppSidebar — MMC', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders items without a permission field always (Dashboard)', () => {
    expect(createWrapper().text()).toContain('Dashboard')
  })

  it('shows items with resolvedPermissions[key] === true', () => {
    const wrapper = createWrapper({
      resolvedPermissions: { 'workspace.list': true },
    })
    expect(wrapper.text()).toContain('Workspaces')
  })

  it('hides items with resolvedPermissions[key] === false', () => {
    const wrapper = createWrapper({
      resolvedPermissions: { 'workspace.list': false },
    })
    expect(wrapper.text()).not.toContain('Workspaces')
  })

  it('hides items with missing permission key', () => {
    expect(createWrapper({ resolvedPermissions: {} }).text()).not.toContain(
      'Workspaces'
    )
  })

  it('active route item has app-sidebar__nav-item--active class', () => {
    const wrapper = createWrapper()
    const dashboardLink = wrapper
      .findAll('.stub-router-link')
      .find((el) => el.text().includes('Dashboard'))
    expect(dashboardLink?.classes()).toContain('app-sidebar__nav-item--active')
  })

  it('clicking collapse control calls useMmcUiStore().toggleSidebar()', async () => {
    const wrapper = createWrapper()
    await wrapper.find('.stub-sidebar-layout').trigger('click')
    const { useMmcUiStore } = await import('@/core/state/ui.store')
    const store = useMmcUiStore()
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
