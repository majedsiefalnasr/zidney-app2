import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../../src/core/auth/token-store'

afterEach(() => vi.resetAllMocks())

// Runs authGuard → roleGuard → workspaceGuard in sequence (backoffice pipeline)
async function runPipeline(
  authStore: ReturnType<typeof useAuthStore>,
  toMeta: Record<string, unknown>,
  toParams: Record<string, string> = {}
) {
  const { authGuard } = await import('../../../src/core/guards/auth.guard')
  const { roleGuard } = await import('../../../src/core/guards/role.guard')
  const { workspaceGuard } =
    await import('../../../src/core/guards/workspace.guard')

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

  const wsResult = workspaceGuard(ctx)
  if (wsResult !== true) return wsResult

  return true
}

describe('Guard pipeline (Backoffice): authGuard → roleGuard → workspaceGuard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('authGuard runs first — unauthenticated user stops at login redirect', async () => {
    const authStore = useAuthStore()

    const result = await runPipeline(
      authStore,
      {
        requiresAuth: true,
        requiredRole: 'instructor',
        requiresWorkspace: true,
      },
      { slug: 'acme' }
    )

    expect(result).toMatchObject({ name: 'login' })
  })

  it('authGuard passes → roleGuard blocks user with wrong role', async () => {
    const authStore = useAuthStore()
    authStore.setAccessToken('token')
    authStore.setUser({
      id: '1',
      email: 'viewer@org.com',
      role: 'viewer',
      workspaceSlug: 'acme',
    })

    const result = await runPipeline(
      authStore,
      {
        requiresAuth: true,
        requiredRole: 'instructor',
        requiresWorkspace: true,
      },
      { slug: 'acme' }
    )

    expect(result).toMatchObject({ name: 'forbidden' })
  })

  it('authGuard → roleGuard pass → workspaceGuard blocks wrong slug', async () => {
    const authStore = useAuthStore()
    authStore.setAccessToken('token')
    authStore.setUser({
      id: '1',
      email: 'instructor@org.com',
      role: 'instructor',
      workspaceSlug: 'acme',
    })

    const result = await runPipeline(
      authStore,
      {
        requiresAuth: true,
        requiredRole: 'instructor',
        requiresWorkspace: true,
      },
      { slug: 'different-org' }
    )

    expect(result).toMatchObject({ name: 'forbidden' })
  })

  it('all three guards pass for valid instructor with correct workspace', async () => {
    const authStore = useAuthStore()
    authStore.setAccessToken('token')
    authStore.setUser({
      id: '1',
      email: 'instructor@org.com',
      role: 'instructor',
      workspaceSlug: 'acme',
    })

    const result = await runPipeline(
      authStore,
      {
        requiresAuth: true,
        requiredRole: 'instructor',
        requiresWorkspace: true,
      },
      { slug: 'acme' }
    )

    expect(result).toBe(true)
  })

  it('public route bypasses all three guards', async () => {
    const authStore = useAuthStore()

    const result = await runPipeline(authStore, {})

    expect(result).toBe(true)
  })
})
