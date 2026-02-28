import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../../src/core/auth/token-store'

afterEach(() => vi.resetAllMocks())

// Access guards directly to test pipeline ordering
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

describe('Guard pipeline (MMC): authGuard → roleGuard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('authGuard runs first — unauthenticated user is stopped before roleGuard', async () => {
    const authStore = useAuthStore()
    // not authenticated

    const result = await runPipeline(authStore, {
      requiresAuth: true,
      requiredRole: 'admin',
    })

    expect(result).toMatchObject({ name: 'login' })
  })

  it('authGuard passes → roleGuard blocks user with wrong role', async () => {
    const authStore = useAuthStore()
    authStore.setAccessToken('token')
    authStore.setUser({ id: '1', email: 'viewer@mmc.com', role: 'viewer' })

    const result = await runPipeline(authStore, {
      requiresAuth: true,
      requiredRole: 'admin',
    })

    expect(result).toMatchObject({ name: 'forbidden' })
  })

  it('both guards pass for authenticated admin', async () => {
    const authStore = useAuthStore()
    authStore.setAccessToken('token')
    authStore.setUser({ id: '1', email: 'admin@mmc.com', role: 'admin' })

    const result = await runPipeline(authStore, {
      requiresAuth: true,
      requiredRole: 'admin',
    })

    expect(result).toBe(true)
  })

  it('public route passes both guards without authentication', async () => {
    const authStore = useAuthStore()

    const result = await runPipeline(authStore, { requiresAuth: false })

    expect(result).toBe(true)
  })
})
