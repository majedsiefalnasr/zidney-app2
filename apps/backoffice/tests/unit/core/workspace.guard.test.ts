import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../../src/core/auth/token-store'
import type { WorkspaceGuardContext } from '../../../src/core/guards/workspace.guard'
import { workspaceGuard } from '../../../src/core/guards/workspace.guard'

afterEach(() => vi.resetAllMocks())

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
  } as unknown as WorkspaceGuardContext['from']
}

describe('workspaceGuard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns true when route does not require workspace', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()

    const ctx: WorkspaceGuardContext = {
      to: {
        meta: { requiresWorkspace: false },
        params: { slug: 'acme' },
        name: 'public',
        query: {},
        hash: '',
        path: '/public',
        redirectedFrom: undefined,
        matched: [],
        fullPath: '/public',
      } as unknown as WorkspaceGuardContext['to'],
      from: makeFrom(),
      authStore,
    }

    expect(workspaceGuard(ctx)).toBe(true)
  })

  it('returns true when slug from route params matches user workspaceSlug', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.setAccessToken('token')
    authStore.setUser({
      id: '1',
      email: 'admin@org.com',
      role: 'admin',
      workspaceSlug: 'acme-corp',
    })

    const ctx: WorkspaceGuardContext = {
      to: {
        meta: { requiresWorkspace: true },
        params: { slug: 'acme-corp' },
        name: 'ws-dashboard',
        query: {},
        hash: '',
        path: '/acme-corp/dashboard',
        redirectedFrom: undefined,
        matched: [],
        fullPath: '/acme-corp/dashboard',
      } as unknown as WorkspaceGuardContext['to'],
      from: makeFrom(),
      authStore,
    }

    expect(workspaceGuard(ctx)).toBe(true)
  })

  it('redirects to forbidden when slug from route params does NOT match user workspaceSlug', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.setAccessToken('token')
    authStore.setUser({
      id: '1',
      email: 'admin@org.com',
      role: 'admin',
      workspaceSlug: 'acme-corp',
    })

    const ctx: WorkspaceGuardContext = {
      to: {
        meta: { requiresWorkspace: true },
        params: { slug: 'other-org' },
        name: 'ws-dashboard',
        query: {},
        hash: '',
        path: '/other-org/dashboard',
        redirectedFrom: undefined,
        matched: [],
        fullPath: '/other-org/dashboard',
      } as unknown as WorkspaceGuardContext['to'],
      from: makeFrom(),
      authStore,
    }

    const result = workspaceGuard(ctx)
    expect(result).toMatchObject({ name: 'forbidden' })
  })

  it('redirects to forbidden when user has no workspaceSlug but route requiresWorkspace', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.setAccessToken('token')
    authStore.setUser({ id: '1', email: 'admin@org.com', role: 'admin' })

    const ctx: WorkspaceGuardContext = {
      to: {
        meta: { requiresWorkspace: true },
        params: { slug: 'acme-corp' },
        name: 'ws-dashboard',
        query: {},
        hash: '',
        path: '/acme-corp/dashboard',
        redirectedFrom: undefined,
        matched: [],
        fullPath: '/acme-corp/dashboard',
      } as unknown as WorkspaceGuardContext['to'],
      from: makeFrom(),
      authStore,
    }

    const result = workspaceGuard(ctx)
    expect(result).toMatchObject({ name: 'forbidden' })
  })

  it('workspace slug MUST come from route params only (not request body)', () => {
    // This test validates the enforcement: slug only comes from to.params.slug
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.setAccessToken('token')
    authStore.setUser({
      id: '1',
      email: 'admin@org.com',
      role: 'admin',
      workspaceSlug: 'real-org',
    })

    const ctx: WorkspaceGuardContext = {
      to: {
        meta: { requiresWorkspace: true },
        // params.slug is the only source — no query/body accepted
        params: { slug: 'real-org' },
        name: 'ws-settings',
        query: { slug: 'injected-from-query' },
        hash: '',
        path: '/real-org/settings',
        redirectedFrom: undefined,
        matched: [],
        fullPath: '/real-org/settings',
      } as unknown as WorkspaceGuardContext['to'],
      from: makeFrom(),
      authStore,
    }

    // Should succeed using params.slug only, ignoring query.slug
    expect(workspaceGuard(ctx)).toBe(true)
  })
})
