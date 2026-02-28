import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../../src/core/auth/token-store'
import type { GuardContext } from '../../../src/core/guards/auth.guard'
import { authGuard } from '../../../src/core/guards/auth.guard'

afterEach(() => vi.resetAllMocks())

function makeContext(overrides: Partial<GuardContext> = {}): GuardContext {
  const pinia = createPinia()
  setActivePinia(pinia)
  const authStore = useAuthStore()
  return {
    to: {
      meta: { requiresAuth: false },
      name: 'home',
      params: {},
      query: {},
      hash: '',
      path: '/',
      redirectedFrom: undefined,
      matched: [],
      fullPath: '/',
    } as unknown as GuardContext['to'],
    from: {
      name: 'root',
      path: '/',
      params: {},
      query: {},
      hash: '',
      matched: [],
      fullPath: '/',
      meta: {},
      redirectedFrom: undefined,
    } as unknown as GuardContext['from'],
    authStore,
    ...overrides,
  }
}

describe('authGuard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns true when route does not require auth', () => {
    const ctx = makeContext({
      to: {
        meta: { requiresAuth: false },
        name: 'public',
        params: {},
        query: {},
        hash: '',
        path: '/public',
        redirectedFrom: undefined,
        matched: [],
        fullPath: '/public',
      } as unknown as GuardContext['to'],
    })
    expect(authGuard(ctx)).toBe(true)
  })

  it('returns true when route requires auth and user is authenticated', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.setAccessToken('valid-token')

    const ctx = makeContext({
      to: {
        meta: { requiresAuth: true },
        name: 'exam',
        params: {},
        query: {},
        hash: '',
        path: '/exam',
        redirectedFrom: undefined,
        matched: [],
        fullPath: '/exam',
      } as unknown as GuardContext['to'],
      authStore,
    })

    expect(authGuard(ctx)).toBe(true)
  })

  it('redirects to login when route requires auth and student is not authenticated', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()

    const ctx = makeContext({
      to: {
        meta: { requiresAuth: true },
        name: 'exam',
        params: {},
        query: {},
        hash: '',
        path: '/exam',
        redirectedFrom: undefined,
        matched: [],
        fullPath: '/exam',
      } as unknown as GuardContext['to'],
      authStore,
    })

    const result = authGuard(ctx)
    expect(result).toMatchObject({ name: 'login' })
  })

  it('passes through when requiresAuth is undefined (no meta set)', () => {
    const ctx = makeContext({
      to: {
        meta: {},
        name: 'about',
        params: {},
        query: {},
        hash: '',
        path: '/about',
        redirectedFrom: undefined,
        matched: [],
        fullPath: '/about',
      } as unknown as GuardContext['to'],
    })
    expect(authGuard(ctx)).toBe(true)
  })
})
