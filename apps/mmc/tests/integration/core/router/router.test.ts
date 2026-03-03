/**
 * Router integration tests for MMC.
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
        name: 'mmc-login',
        component: StubComponent,
        meta: { public: true },
      },
      {
        path: '/dashboard',
        name: 'mmc-dashboard',
        component: StubComponent,
        meta: { requiresAuth: true },
      },
      {
        path: '/unauthorized',
        name: 'mmc-unauthorized',
        component: StubComponent,
        meta: { public: true },
      },
      {
        path: '/error',
        name: 'mmc-error',
        component: StubComponent,
        meta: { public: true },
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'mmc-not-found',
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

describe('createAppRouter (MMC)', () => {
  it('returns a Router instance when called with createMemoryHistory()', () => {
    const router = createAppRouter(createMemoryHistory())
    expect(router).toBeDefined()
    expect(typeof router.push).toBe('function')
    expect(typeof router.beforeEach).toBe('function')
  })

  it('catch-all route resolves to mmc-not-found for undefined paths', () => {
    const router = createAppRouter(createMemoryHistory())
    const resolved = router.resolve('/this-path-does-not-exist')
    expect(resolved.name).toBe('mmc-not-found')
  })

  it('/unauthorized route resolves to mmc-unauthorized', () => {
    const router = createAppRouter(createMemoryHistory())
    const resolved = router.resolve('/unauthorized')
    expect(resolved.name).toBe('mmc-unauthorized')
    expect(resolved.meta['public']).toBe(true)
  })

  it('/error route resolves to mmc-error', () => {
    const router = createAppRouter(createMemoryHistory())
    const resolved = router.resolve('/error')
    expect(resolved.name).toBe('mmc-error')
    expect(resolved.meta['public']).toBe(true)
  })
})

describe('registerGuards (MMC)', () => {
  it('adds a beforeEach hook to the router', () => {
    const router = createTestRouter()
    const beforeEachSpy = vi.spyOn(router, 'beforeEach')

    registerGuards(router, {
      isAuthenticated: () => false,
      getUserRole: () => undefined,
      loginRouteName: 'mmc-login',
      dashboardRouteName: 'mmc-dashboard',
      unauthorizedRouteName: 'mmc-unauthorized',
      errorRouteName: 'mmc-error',
    })

    expect(beforeEachSpy).toHaveBeenCalledOnce()
  })

  it('guard pipeline: !authenticated + requiresAuth → returns mmc-login redirect', async () => {
    // Test guard behavior by directly invoking the guard factory.
    // Avoids router navigation entirely (no lazy-import timeouts).
    const guard = createAuthGuard({
      isAuthenticated: () => false,
      loginRouteName: 'mmc-login',
      dashboardRouteName: 'mmc-dashboard',
    })

    const router = createTestRouter()
    const to = router.resolve({ name: 'mmc-dashboard' })
    const from = router.resolve({ name: 'mmc-login' })

    const result = guard(to as never, from as never, vi.fn())

    expect(result).toMatchObject({
      name: 'mmc-login',
      query: { redirect: expect.any(String) },
    })
  })
})
