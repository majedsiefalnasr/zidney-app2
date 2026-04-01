/**
 * Router integration tests for Frontoffice.
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
import { createAppRouter, routes } from '../../../../src/core/router'

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
        name: 'fo-login',
        component: StubComponent,
        meta: { public: true },
      },
      {
        path: '/',
        name: 'fo-home',
        component: StubComponent,
        meta: { requiresAuth: true },
      },
      {
        path: '/unauthorized',
        name: 'fo-unauthorized',
        component: StubComponent,
        meta: { public: true },
      },
      {
        path: '/error',
        name: 'fo-error',
        component: StubComponent,
        meta: { public: true },
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'fo-not-found',
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

describe('createAppRouter (Frontoffice)', () => {
  it('returns a Router instance when called with createMemoryHistory()', () => {
    const router = createAppRouter(createMemoryHistory())
    expect(router).toBeDefined()
    expect(typeof router.push).toBe('function')
    expect(typeof router.beforeEach).toBe('function')
  })

  it('catch-all route resolves to fo-not-found for undefined paths', () => {
    const router = createAppRouter(createMemoryHistory())
    const resolved = router.resolve('/this-path-does-not-exist')
    expect(resolved.name).toBe('fo-not-found')
  })

  it('/unauthorized route resolves to fo-unauthorized', () => {
    const router = createAppRouter(createMemoryHistory())
    const resolved = router.resolve('/unauthorized')
    expect(resolved.name).toBe('fo-unauthorized')
    expect(resolved.meta.public).toBe(true)
  })

  it('/error route resolves to fo-error', () => {
    const router = createAppRouter(createMemoryHistory())
    const resolved = router.resolve('/error')
    expect(resolved.name).toBe('fo-error')
    expect(resolved.meta.public).toBe(true)
  })

  it('loads every lazy route component', async () => {
    for (const route of routes) {
      expect(typeof route.component).toBe('function')
      const componentModule = await (route.component as () => Promise<{ default: unknown }>)()
      expect(componentModule.default).toBeDefined()
    }
  })
})

describe('registerGuards (Frontoffice)', () => {
  it('adds a beforeEach hook to the router', () => {
    const router = createTestRouter()
    const beforeEachSpy = vi.spyOn(router, 'beforeEach')

    registerGuards(router, {
      isAuthenticated: () => false,
      getUserRole: () => undefined,
      loginRouteName: 'fo-login',
      dashboardRouteName: 'fo-home',
      unauthorizedRouteName: 'fo-unauthorized',
      errorRouteName: 'fo-error',
    })

    expect(beforeEachSpy).toHaveBeenCalledOnce()
  })

  it('guard pipeline: !authenticated + requiresAuth → returns fo-login redirect', async () => {
    // Test guard behavior by directly invoking the guard factory.
    // Avoids router navigation entirely (no lazy-import timeouts).
    const guard = createAuthGuard({
      isAuthenticated: () => false,
      loginRouteName: 'fo-login',
      dashboardRouteName: 'fo-home',
    })

    const router = createTestRouter()
    const to = router.resolve({ name: 'fo-home' })
    const from = router.resolve({ name: 'fo-login' })

    const result = guard(to as never, from as never, vi.fn())

    expect(result).toMatchObject({
      name: 'fo-login',
      query: { redirect: expect.any(String) },
    })
  })
})
