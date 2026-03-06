/**
 * Unit tests for apps/backoffice/src/components/layout/AppHeader.vue
 *
 * Verifies:
 * - User initials rendered from user.name
 * - Workspace name shown when showWorkspace=true
 * - Workspace name absent when showWorkspace=false (default)
 * - Null workspace renders fallback without crash
 * - Logout DropdownMenuItem click calls authStore.logout()
 * - Named slots (left, right) render injected content
 * - Null user state renders without error
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 * Task: T041
 */

import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppHeader from '@/components/layout/AppHeader.vue'

const uiStubs = {
  TopBar: {
    props: ['appName', 'subtitle'],
    template:
      '<div class="stub-top-bar" :data-app-name="appName" :data-subtitle="subtitle"><slot /></div>',
  },
  Avatar: { template: '<div class="stub-avatar"><slot /></div>' },
  AvatarFallback: {
    template: '<div class="stub-avatar-fallback"><slot /></div>',
  },
  DropdownMenu: { template: '<div class="stub-dropdown-menu"><slot /></div>' },
  DropdownMenuTrigger: { template: '<div><slot /></div>' },
  DropdownMenuContent: {
    template: '<div class="stub-dropdown-content"><slot /></div>',
  },
  DropdownMenuItem: {
    template:
      '<button type="button" class="stub-dropdown-item" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click'],
  },
  DropdownMenuSeparator: { template: '<hr />' },
}

function createWrapper(
  opts: { userName?: string | null; workspaceName?: string | null; showWorkspace?: boolean } = {}
) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    initialState: {
      'backoffice-auth': {
        user: opts.userName !== null ? { name: opts.userName ?? 'Test User' } : null,
        isAuthenticated: opts.userName !== null,
      },
      'backoffice-workspace': {
        workspace:
          opts.workspaceName !== undefined && opts.workspaceName !== null
            ? { name: opts.workspaceName }
            : null,
      },
    },
  })
  return mount(AppHeader, {
    props: { showWorkspace: opts.showWorkspace ?? false },
    global: {
      plugins: [pinia],
      stubs: uiStubs,
    },
  })
}

describe('AppHeader — Backoffice', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders user initials from user.name ("Test User" → "TU")', () => {
    const wrapper = createWrapper({ userName: 'Test User' })
    expect(wrapper.find('.stub-avatar-fallback').text()).toBe('TU')
  })

  it('renders single-word initials ("Alice" → "A")', () => {
    const wrapper = createWrapper({ userName: 'Alice' })
    expect(wrapper.find('.stub-avatar-fallback').text()).toBe('A')
  })

  it('renders without error when user is null', () => {
    expect(() => createWrapper({ userName: null })).not.toThrow()
  })

  it('shows workspace name in TopBar subtitle when showWorkspace=true', () => {
    const wrapper = createWrapper({
      showWorkspace: true,
      workspaceName: 'ACME Corp',
    })
    const topBar = wrapper.find('.stub-top-bar')
    expect(topBar.attributes('data-subtitle')).toBe('ACME Corp')
  })

  it('does not show workspace name when showWorkspace=false (default)', () => {
    const wrapper = createWrapper({
      showWorkspace: false,
      workspaceName: 'ACME Corp',
    })
    const topBar = wrapper.find('.stub-top-bar')
    expect(topBar.attributes('data-subtitle')).toBeUndefined()
  })

  it('renders empty subtitle when workspace is null (no crash)', () => {
    expect(() => createWrapper({ showWorkspace: true, workspaceName: null })).not.toThrow()
  })

  it('clicking "Sign out" item calls authStore.logout()', async () => {
    const wrapper = createWrapper()
    const signOutButton = wrapper
      .findAll('.stub-dropdown-item')
      .find((el) => el.text() === 'Sign out')
    expect(signOutButton).toBeDefined()
    await signOutButton?.trigger('click')
    const { useBackofficeAuthStore } = await import('@/core/state/auth.store')
    const authStore = useBackofficeAuthStore()
    expect(authStore.logout).toHaveBeenCalled()
  })

  it('renders content injected into "left" slot', () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(AppHeader, {
      global: { plugins: [pinia], stubs: uiStubs },
      slots: { left: '<span class="left-slot-content">Left</span>' },
    })
    expect(wrapper.find('.left-slot-content').exists()).toBe(true)
  })

  it('renders content injected into "right" slot', () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(AppHeader, {
      global: { plugins: [pinia], stubs: uiStubs },
      slots: { right: '<span class="right-slot-content">Right</span>' },
    })
    expect(wrapper.find('.right-slot-content').exists()).toBe(true)
  })
})
