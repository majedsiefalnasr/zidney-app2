/**
 * Router integration tests for Backoffice.
 * Tests createAppRouter() factory and registerGuards() pipeline.
 *
 * Uses createMemoryHistory() — no real browser or DOM required.
 *
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { registerGuards } from '../../../../src/core/guards'
import { createAuthGuard } from '../../../../src/core/guards/auth.guard'
import { createWorkspaceGuard } from '../../../../src/core/guards/workspace.guard'
import { createAppRouter } from '../../../../src/core/router'

// ─── Stub component for test router ──────────────────────────────────────────
const StubComponent = defineComponent({ template: '<div/>' })

/**
 * Creates a minimal test router with synchronous components to avoid
 * lazy-import timeouts in jsdom/vitest. Used for guard behavior tests.
 */
function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/login',
        name: 'bo-login',
        component: StubComponent,
        meta: { public: true },
      },
      {
        path: '/',
        name: 'bo-dashboard',
        component: StubComponent,
        meta: { requiresAuth: true, requiresWorkspace: true },
      },
      {
        path: '/select-workspace',
        name: 'bo-workspace-selector',
        component: StubComponent,
        meta: { requiresAuth: true },
      },
      {
        path: '/unauthorized',
        name: 'bo-unauthorized',
        component: StubComponent,
        meta: { public: true },
      },
      {
        path: '/error',
        name: 'bo-error',
        component: StubComponent,
        meta: { public: true },
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'bo-not-found',
        component: StubComponent,
        meta: { public: true },
      },
    ],
  })
}

vi.mock('@zidney/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('createAppRouter (Backoffice)', () => {
  it('returns a Router instance when called with createMemoryHistory()', () => {
    const router = createAppRouter(createMemoryHistory())
    expect(router).toBeDefined()
    expect(typeof router.push).toBe('function')
    expect(typeof router.beforeEach).toBe('function')
  })

  it('catch-all route resolves to bo-not-found for undefined paths', () => {
    const router = createAppRouter(createMemoryHistory())
    const resolved = router.resolve('/this-path-does-not-exist')
    expect(resolved.name).toBe('bo-not-found')
  })

  it('/unauthorized route resolves to bo-unauthorized', () => {
    const router = createAppRouter(createMemoryHistory())
    const resolved = router.resolve('/unauthorized')
    expect(resolved.name).toBe('bo-unauthorized')
    expect(resolved.meta.public).toBe(true)
  })

  it('/error route resolves to bo-error', () => {
    const router = createAppRouter(createMemoryHistory())
    const resolved = router.resolve('/error')
    expect(resolved.name).toBe('bo-error')
    expect(resolved.meta.public).toBe(true)
  })

  it('/select-workspace route resolves to bo-workspace-selector', () => {
    const router = createAppRouter(createMemoryHistory())
    const resolved = router.resolve('/select-workspace')
    expect(resolved.name).toBe('bo-workspace-selector')
  })
})

describe('registerGuards (Backoffice)', () => {
  it('adds a beforeEach hook to the router', () => {
    const router = createTestRouter()
    const beforeEachSpy = vi.spyOn(router, 'beforeEach')

    registerGuards(router, {
      isAuthenticated: () => false,
      getUserRole: () => undefined,
      loginRouteName: 'bo-login',
      dashboardRouteName: 'bo-dashboard',
      unauthorizedRouteName: 'bo-unauthorized',
      errorRouteName: 'bo-error',
      isWorkspaceResolved: () => false,
      workspaceSelectorRouteName: 'bo-workspace-selector',
    })

    expect(beforeEachSpy).toHaveBeenCalledOnce()
  })

  it('guard pipeline: !authenticated + requiresAuth → returns bo-login redirect', async () => {
    // Test guard behavior by directly invoking the guard factory.
    // Avoids router navigation entirely (no lazy-import timeouts).
    const guard = createAuthGuard({
      isAuthenticated: () => false,
      loginRouteName: 'bo-login',
      dashboardRouteName: 'bo-dashboard',
    })

    const router = createTestRouter()
    const to = router.resolve({ name: 'bo-dashboard' })
    const from = router.resolve({ name: 'bo-login' })

    const result = guard(to as never, from as never, vi.fn())

    expect(result).toMatchObject({
      name: 'bo-login',
      query: { redirect: expect.any(String) },
    })
  })

  it('WorkspaceGuard: auth=true + requiresWorkspace + !isWorkspaceResolved → returns bo-workspace-selector redirect', async () => {
    const guard = createWorkspaceGuard({
      isWorkspaceResolved: () => false,
      workspaceSelectorRouteName: 'bo-workspace-selector',
    })

    const router = createTestRouter()
    const to = router.resolve({ name: 'bo-dashboard' })
    const from = router.resolve({ name: 'bo-login' })

    const result = guard(to as never, from as never, vi.fn())

    expect(result).toMatchObject({ name: 'bo-workspace-selector' })
  })

  it('WorkspaceGuard: non-requiresWorkspace route → returns true (no redirect)', async () => {
    const guard = createWorkspaceGuard({
      isWorkspaceResolved: () => false,
      workspaceSelectorRouteName: 'bo-workspace-selector',
    })

    const router = createTestRouter()
    const to = router.resolve({ name: 'bo-workspace-selector' })
    const from = router.resolve({ name: 'bo-login' })

    const result = guard(to as never, from as never, vi.fn())

    expect(result).toBe(true)
  })
})
