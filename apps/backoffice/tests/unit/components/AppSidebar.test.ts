/**
 * Unit tests for apps/backoffice/src/components/layout/AppSidebar.vue
 *
 * Verifies:
 * - Items with met permissions are visible
 * - Items with unmet permissions are hidden
 * - Items without permission field are always visible
 * - Active route item has active CSS class
 * - Collapse toggle calls useBackofficeUiStore().toggleSidebar()
 * - footer slot renders injected content
 * - Empty navigationConfig renders without error
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 * Task: T044
 */

import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import type { NavigationConfig } from '@/core/navigation/index'

// Mock vue-router's useRoute so we control the active route
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ name: 'bo-dashboard' })),
  RouterLink: {
    props: ['to'],
    template: '<a class="stub-router-link" :class="$attrs.class"><slot /></a>',
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
    label: 'Management',
    items: [
      { routeName: 'bo-dashboard', label: 'Dashboard' },
      { routeName: 'bo-exams', label: 'Exams', permission: 'exam.list' },
      { routeName: 'bo-roles', label: 'Roles', permission: 'role.view' },
    ],
  },
]

function createWrapper(
  opts: {
    resolvedPermissions?: Record<string, boolean>
    sidebarCollapsed?: boolean
    isMobile?: boolean
  } = {}
) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    initialState: {
      'backoffice-auth': {
        resolvedPermissions: opts.resolvedPermissions ?? {},
      },
      'backoffice-ui': {
        sidebarCollapsed: opts.sidebarCollapsed ?? false,
        isMobile: opts.isMobile ?? false,
      },
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
          template: '<a class="stub-router-link" :class="$attrs.class"><slot /></a>',
          inheritAttrs: false,
        },
        Teleport: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('AppSidebar — Backoffice', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders items without a permission field always (Dashboard)', () => {
    const wrapper = createWrapper({ resolvedPermissions: {} })
    expect(wrapper.text()).toContain('Dashboard')
  })

  it('shows items with resolvedPermissions[key] === true', () => {
    const wrapper = createWrapper({
      resolvedPermissions: { 'exam.list': true },
    })
    expect(wrapper.text()).toContain('Exams')
  })

  it('hides items with resolvedPermissions[key] === false', () => {
    const wrapper = createWrapper({
      resolvedPermissions: { 'exam.list': false },
    })
    expect(wrapper.text()).not.toContain('Exams')
  })

  it('hides items with missing permission key', () => {
    const wrapper = createWrapper({ resolvedPermissions: {} })
    expect(wrapper.text()).not.toContain('Roles')
    expect(wrapper.text()).not.toContain('Exams')
  })

  it('active route item has app-sidebar__nav-item--active class', () => {
    const wrapper = createWrapper()
    const activeLinks = wrapper.findAll('.stub-router-link')
    const dashboardLink = activeLinks.find((el) => el.text().includes('Dashboard'))
    expect(dashboardLink?.classes()).toContain('app-sidebar__nav-item--active')
  })

  it('non-active items do not have app-sidebar__nav-item--active class', () => {
    const wrapper = createWrapper({
      resolvedPermissions: { 'exam.list': true },
    })
    const examsLink = wrapper.findAll('.stub-router-link').find((el) => el.text().includes('Exams'))
    expect(examsLink?.classes()).not.toContain('app-sidebar__nav-item--active')
  })

  it('clicking collapse control calls useBackofficeUiStore().toggleSidebar()', async () => {
    const wrapper = createWrapper()
    await wrapper.find('.stub-sidebar-layout').trigger('click')
    const { useBackofficeUiStore } = await import('@/core/state/ui.store')
    const store = useBackofficeUiStore()
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
      slots: { footer: '<span class="footer-slot">Footer Content</span>' },
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
