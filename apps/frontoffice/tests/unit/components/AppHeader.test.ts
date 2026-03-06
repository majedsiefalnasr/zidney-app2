/**
 * Unit tests for apps/frontoffice/src/components/layout/AppHeader.vue
 *
 * Verifies:
 * - User initials rendered from user.name
 * - Logout DropdownMenuItem click calls authStore.logout()
 * - Named slots (left, right) render injected content
 * - Null user state renders without error
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 * Task: T042
 */

import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppHeader from '@/components/layout/AppHeader.vue'

const uiStubs = {
  TopBar: { template: '<div class="stub-top-bar"><slot /></div>' },
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

function createWrapper(userState: Record<string, unknown> | null = { name: 'Test User' }) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    initialState: {
      'frontoffice-auth': {
        user: userState,
        isAuthenticated: userState !== null,
      },
    },
  })
  return mount(AppHeader, {
    global: {
      plugins: [pinia],
      stubs: uiStubs,
    },
  })
}

describe('AppHeader — Frontoffice', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders user initials from user.name ("Test User" → "TU")', () => {
    const wrapper = createWrapper({ name: 'Test User' })
    expect(wrapper.find('.stub-avatar-fallback').text()).toBe('TU')
  })

  it('renders single-word initials ("Alice" → "A")', () => {
    const wrapper = createWrapper({ name: 'Alice' })
    expect(wrapper.find('.stub-avatar-fallback').text()).toBe('A')
  })

  it('renders without error when user is null', () => {
    expect(() => createWrapper(null)).not.toThrow()
  })

  it('clicking "Sign out" item calls authStore.logout()', async () => {
    const wrapper = createWrapper()
    const signOutButton = wrapper
      .findAll('.stub-dropdown-item')
      .find((el) => el.text() === 'Sign out')
    expect(signOutButton).toBeDefined()
    await signOutButton?.trigger('click')
    const { useFrontofficeAuthStore } = await import('@/core/state/auth.store')
    const authStore = useFrontofficeAuthStore()
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
