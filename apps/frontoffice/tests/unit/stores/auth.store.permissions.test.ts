/**
 * Unit tests for Frontoffice auth.store — resolvedPermissions extensions
 *
 * Verifies:
 * - resolvedPermissions defaults to {}
 * - setSession() with permissions array maps each key to true
 * - setSession() with Record<string, boolean> passes through unchanged
 * - setSession() with no permissions → returns {}
 * - logout() clears resolvedPermissions to {}
 * - expireSession() clears resolvedPermissions to {}
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 * Task: T054
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@/core/auth/types'
import { defineAuthStore } from '@/core/state/auth.store'
import { useIsolatedPinia } from '../store-test-helper'

function createStubAuthService() {
  return {
    login: vi.fn().mockResolvedValue({ accessToken: 'tok', user: null }),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshToken: vi.fn().mockResolvedValue({ accessToken: 'new-tok' }),
    fetchProfile: vi.fn().mockResolvedValue({
      id: 'u1',
      email: 'u@example.com',
      name: 'User',
      role: 'student',
    } satisfies AuthUser),
  }
}

function createStubTokenManager() {
  return {
    getToken: vi.fn().mockReturnValue(null),
    setToken: vi.fn(),
    clearToken: vi.fn(),
    hasToken: vi.fn().mockReturnValue(false),
  }
}

function createStubRouter() {
  return {
    push: vi.fn().mockResolvedValue(undefined),
    replace: vi.fn().mockResolvedValue(undefined),
    currentRoute: { value: { name: 'home' } },
  } as any
}

const baseUser: AuthUser = {
  id: 'u1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'student',
}

describe('Frontoffice auth.store — resolvedPermissions', () => {
  useIsolatedPinia()

  let useAuthStore: ReturnType<typeof defineAuthStore>

  beforeEach(() => {
    useAuthStore = defineAuthStore(
      createStubAuthService(),
      createStubTokenManager(),
      createStubRouter(),
      'fo-login',
      () => null
    )
  })

  it('resolvedPermissions defaults to {}', () => {
    const store = useAuthStore()
    expect(store.resolvedPermissions).toEqual({})
  })

  it('setSession() with permissions array maps each key to true', () => {
    const store = useAuthStore()
    const user = {
      ...baseUser,
      permissions: ['exam.attempt', 'exam.view'],
    } as any
    store.setSession('tok', user)
    expect(store.resolvedPermissions).toEqual({
      'exam.attempt': true,
      'exam.view': true,
    })
  })

  it('setSession() with Record<string, boolean> passes through unchanged', () => {
    const store = useAuthStore()
    const user = {
      ...baseUser,
      permissions: { 'exam.attempt': true, 'exam.create': false },
    } as any
    store.setSession('tok', user)
    expect(store.resolvedPermissions).toEqual({
      'exam.attempt': true,
      'exam.create': false,
    })
  })

  it('setSession() with no permissions field returns {}', () => {
    const store = useAuthStore()
    store.setSession('tok', baseUser)
    expect(store.resolvedPermissions).toEqual({})
  })

  it('setSession() with null permissions returns {} without throwing', () => {
    const store = useAuthStore()
    const user = { ...baseUser, permissions: null } as any
    expect(() => store.setSession('tok', user)).not.toThrow()
    expect(store.resolvedPermissions).toEqual({})
  })

  it('logout() clears resolvedPermissions to {}', async () => {
    const store = useAuthStore()
    const user = { ...baseUser, permissions: ['exam.attempt'] } as any
    store.setSession('tok', user)
    expect(store.resolvedPermissions['exam.attempt']).toBe(true)
    await store.logout()
    expect(store.resolvedPermissions).toEqual({})
  })

  it('expireSession() clears resolvedPermissions to {}', async () => {
    const store = useAuthStore()
    const user = { ...baseUser, permissions: ['exam.attempt'] } as any
    store.setSession('tok', user)
    store.isAuthenticated = true
    expect(store.resolvedPermissions['exam.attempt']).toBe(true)
    await store.expireSession()
    expect(store.resolvedPermissions).toEqual({})
  })
})
