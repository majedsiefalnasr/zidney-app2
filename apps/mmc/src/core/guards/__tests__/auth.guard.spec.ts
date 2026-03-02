/**
 * AuthGuard unit tests for MMC.
 * Tests the createAuthGuard() factory with injected callbacks.
 * No DOM or mounted components required.
 *
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { createAuthGuard } from '../auth.guard'

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeRoute(
  overrides: Partial<RouteLocationNormalized> = {}
): RouteLocationNormalized {
  return {
    path: '/test',
    fullPath: '/test',
    name: 'test-route',
    params: {},
    query: {},
    hash: '',
    matched: [],
    meta: {},
    redirectedFrom: undefined,
    ...overrides,
  } as RouteLocationNormalized
}

const LOGIN_ROUTE = 'mmc-login'
const DASHBOARD_ROUTE = 'mmc-dashboard'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createAuthGuard (MMC)', () => {
  let isAuthenticated: Mock<[], boolean>

  beforeEach(() => {
    isAuthenticated = vi.fn().mockReturnValue(false)
  })

  // SC1: requiresAuth + !auth → login + ?redirect
  it('SC1: requiresAuth + !auth → redirects to login with ?redirect', () => {
    isAuthenticated.mockReturnValue(false)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })

    const to = makeRoute({
      path: '/dashboard',
      fullPath: '/dashboard',
      name: 'mmc-dashboard',
      meta: { requiresAuth: true },
    })

    const result = guard(to, makeRoute(), () => {})
    expect(result).toEqual({
      name: LOGIN_ROUTE,
      query: { redirect: '/dashboard' },
    })
  })

  // SC2: requiresAuth + auth → allow
  it('SC2: requiresAuth + auth → returns true', () => {
    isAuthenticated.mockReturnValue(true)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })

    const to = makeRoute({ meta: { requiresAuth: true } })
    expect(guard(to, makeRoute(), () => {})).toBe(true)
  })

  // SC3: public + !auth → allow
  it('SC3: public + !auth → returns true', () => {
    isAuthenticated.mockReturnValue(false)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })

    const to = makeRoute({ meta: { public: true } })
    expect(guard(to, makeRoute(), () => {})).toBe(true)
  })

  // SC4: public + auth → redirect to dashboard
  it('SC4: public + auth → redirects to dashboard', () => {
    isAuthenticated.mockReturnValue(true)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })

    const to = makeRoute({ meta: { public: true } })
    expect(guard(to, makeRoute(), () => {})).toEqual({ name: DASHBOARD_ROUTE })
  })

  // SC5: to.name === loginRouteName + !auth → allow (loop prevention)
  it('SC5: already on login route + !auth → returns true (loop prevention)', () => {
    isAuthenticated.mockReturnValue(false)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })

    const to = makeRoute({ name: LOGIN_ROUTE, meta: { requiresAuth: false } })
    expect(guard(to, makeRoute(), () => {})).toBe(true)
  })

  // SC6: no meta + auth → allow
  it('SC6: no meta + auth → returns true', () => {
    isAuthenticated.mockReturnValue(true)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })

    const to = makeRoute({ meta: {} })
    expect(guard(to, makeRoute(), () => {})).toBe(true)
  })

  // SC7: no meta + !auth → allow
  it('SC7: no meta + !auth → returns true', () => {
    isAuthenticated.mockReturnValue(false)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })

    const to = makeRoute({ meta: {} })
    expect(guard(to, makeRoute(), () => {})).toBe(true)
  })

  // SC8: redirect param with external URL → login without param (unsafe redirect rejected)
  it('SC8: external URL redirect → login without ?redirect param', () => {
    isAuthenticated.mockReturnValue(false)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
      isSafeRedirect: (path) => path.startsWith('/') && !path.startsWith('//'),
    })

    const to = makeRoute({
      meta: { requiresAuth: true },
      fullPath: 'https://evil.com/steal',
    })

    const result = guard(to, makeRoute(), () => {})
    expect(result).toEqual({ name: LOGIN_ROUTE })
  })

  // SC9: redirect param with relative path → login + ?redirect
  it('SC9: relative path redirect → login with ?redirect param', () => {
    isAuthenticated.mockReturnValue(false)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })

    const to = makeRoute({
      meta: { requiresAuth: true },
      fullPath: '/protected/page?q=1',
    })

    const result = guard(to, makeRoute(), () => {})
    expect(result).toEqual({
      name: LOGIN_ROUTE,
      query: { redirect: '/protected/page?q=1' },
    })
  })

  // SC10: getIsAuthenticated() throws → log error + return true (fail-open)
  it('SC10: isAuthenticated() throws → returns true (fail-open)', () => {
    isAuthenticated.mockImplementation(() => {
      throw new Error('Auth check failed')
    })

    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })

    const to = makeRoute({ meta: { requiresAuth: true } })
    expect(guard(to, makeRoute(), () => {})).toBe(true)
  })

  // US9 logout test: redirect to login after logout
  it('US9: after logout (isAuthenticated=false), protected route → login redirect', () => {
    isAuthenticated.mockReturnValue(false)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })

    const to = makeRoute({
      meta: { requiresAuth: true },
      fullPath: '/licenses',
    })

    const result = guard(to, makeRoute(), () => {})
    expect(result).toEqual({
      name: LOGIN_ROUTE,
      query: { redirect: '/licenses' },
    })
  })
})
