import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../../src/core/auth/token-store'
import type { GuardContext } from '../../../src/core/guards/role.guard'
import { roleGuard } from '../../../src/core/guards/role.guard'

afterEach(() => vi.resetAllMocks())

function makeRoute(requiredRole?: string, extraMeta: Record<string, unknown> = {}) {
  return {
    meta: { ...(requiredRole ? { requiredRole } : {}), ...extraMeta },
    name: 'test',
    params: {},
    query: {},
    hash: '',
    path: '/test',
    redirectedFrom: undefined,
    matched: [],
    fullPath: '/test',
  } as unknown as GuardContext['to']
}

function makeFrom() {
  return {
    name: 'root',
    path: '/',
    params: {},
    query: {},
    hash: '',
    matched: [],
    fullPath: '/',
    meta: {},
    redirectedFrom: undefined,
  } as unknown as GuardContext['from']
}

describe('roleGuard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns true when no requiredRole in route meta', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()

    const ctx: GuardContext = {
      to: makeRoute(),
      from: makeFrom(),
      authStore,
    }

    expect(roleGuard(ctx)).toBe(true)
  })

  it('returns true when student role matches requiredRole', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.setAccessToken('token')
    authStore.setUser({
      id: '1',
      email: 'student@example.com',
      role: 'student',
    })

    const ctx: GuardContext = {
      to: makeRoute('student'),
      from: makeFrom(),
      authStore,
    }

    expect(roleGuard(ctx)).toBe(true)
  })

  it('redirects to forbidden when student role does not match required role', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.setAccessToken('token')
    authStore.setUser({
      id: '1',
      email: 'student@example.com',
      role: 'student',
    })

    const ctx: GuardContext = {
      to: makeRoute('admin'),
      from: makeFrom(),
      authStore,
    }

    const result = roleGuard(ctx)
    expect(result).toMatchObject({ name: 'forbidden' })
  })

  it('redirects to forbidden when student is not authenticated but requiredRole is set', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()

    const ctx: GuardContext = {
      to: makeRoute('student'),
      from: makeFrom(),
      authStore,
    }

    const result = roleGuard(ctx)
    expect(result).toMatchObject({ name: 'forbidden' })
  })
})
