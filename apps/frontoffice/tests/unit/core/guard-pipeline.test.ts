import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../../src/core/auth/token-store'

afterEach(() => vi.resetAllMocks())

// Frontoffice pipeline: authGuard → roleGuard ONLY (no workspaceGuard per spec §16)
async function runPipeline(
  authStore: ReturnType<typeof useAuthStore>,
  toMeta: Record<string, unknown>,
  toParams: Record<string, string> = {}
) {
  const { authGuard } = await import('../../../src/core/guards/auth.guard')
  const { roleGuard } = await import('../../../src/core/guards/role.guard')

  const to = {
    meta: toMeta,
    params: toParams,
    name: 'test',
    query: {},
    hash: '',
    path: '/test',
    redirectedFrom: undefined,
    matched: [],
    fullPath: '/test',
  } as Parameters<typeof authGuard>[0]['to']

  const from = {
    name: 'root',
    path: '/',
    params: {},
    query: {},
    hash: '',
    matched: [],
    fullPath: '/',
    meta: {},
    redirectedFrom: undefined,
  } as Parameters<typeof authGuard>[0]['from']

  const ctx = { to, from, authStore }

  const authResult = authGuard(ctx)
  if (authResult !== true) return authResult

  const roleResult = roleGuard(ctx)
  if (roleResult !== true) return roleResult

  return true
}

describe('Guard pipeline (Frontoffice): authGuard → roleGuard (NO workspaceGuard)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('unauthenticated student is redirected to login', async () => {
    const authStore = useAuthStore()

    const result = await runPipeline(authStore, { requiresAuth: true })

    expect(result).toMatchObject({ name: 'login' })
  })

  it('authenticated student passes authGuard', async () => {
    const authStore = useAuthStore()
    authStore.setAccessToken('token')
    authStore.setUser({ id: '1', email: 'student@school.com', role: 'student' })

    const result = await runPipeline(authStore, { requiresAuth: true })

    expect(result).toBe(true)
  })

  it('student with wrong role is redirected to forbidden', async () => {
    const authStore = useAuthStore()
    authStore.setAccessToken('token')
    authStore.setUser({ id: '1', email: 'student@school.com', role: 'student' })

    const result = await runPipeline(authStore, {
      requiresAuth: true,
      requiredRole: 'admin',
    })

    expect(result).toMatchObject({ name: 'forbidden' })
  })

  it('public route passes without authentication', async () => {
    const authStore = useAuthStore()

    const result = await runPipeline(authStore, {})

    expect(result).toBe(true)
  })
})
