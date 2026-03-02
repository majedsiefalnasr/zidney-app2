/**
 * AuthGuard unit tests for Frontoffice.
 * Tests the createAuthGuard() factory with injected callbacks.
 * No DOM or mounted components required.
 *
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { createAuthGuard } from '../auth.guard'

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

const LOGIN_ROUTE = 'fo-login'
const DASHBOARD_ROUTE = 'fo-home'

describe('createAuthGuard (Frontoffice)', () => {
  let isAuthenticated: Mock<[], boolean>

  beforeEach(() => {
    isAuthenticated = vi.fn().mockReturnValue(false)
  })

  it('SC1: requiresAuth + !auth → redirects to login with ?redirect', () => {
    isAuthenticated.mockReturnValue(false)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    const to = makeRoute({
      path: '/home',
      fullPath: '/home',
      name: DASHBOARD_ROUTE,
      meta: { requiresAuth: true },
    })
    expect(guard(to, makeRoute(), () => {})).toEqual({
      name: LOGIN_ROUTE,
      query: { redirect: '/home' },
    })
  })

  it('SC2: requiresAuth + auth → returns true', () => {
    isAuthenticated.mockReturnValue(true)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    expect(
      guard(makeRoute({ meta: { requiresAuth: true } }), makeRoute(), () => {})
    ).toBe(true)
  })

  it('SC3: public + !auth → returns true', () => {
    isAuthenticated.mockReturnValue(false)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    expect(
      guard(makeRoute({ meta: { public: true } }), makeRoute(), () => {})
    ).toBe(true)
  })

  it('SC4: public + auth → redirects to dashboard', () => {
    isAuthenticated.mockReturnValue(true)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    expect(
      guard(makeRoute({ meta: { public: true } }), makeRoute(), () => {})
    ).toEqual({ name: DASHBOARD_ROUTE })
  })

  it('SC5: already on login route + !auth → returns true (loop prevention)', () => {
    isAuthenticated.mockReturnValue(false)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    expect(guard(makeRoute({ name: LOGIN_ROUTE }), makeRoute(), () => {})).toBe(
      true
    )
  })

  it('SC6: no meta + auth → returns true', () => {
    isAuthenticated.mockReturnValue(true)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    expect(guard(makeRoute({ meta: {} }), makeRoute(), () => {})).toBe(true)
  })

  it('SC7: no meta + !auth → returns true', () => {
    isAuthenticated.mockReturnValue(false)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    expect(guard(makeRoute({ meta: {} }), makeRoute(), () => {})).toBe(true)
  })

  it('SC8: external URL redirect → login without ?redirect param', () => {
    isAuthenticated.mockReturnValue(false)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
      isSafeRedirect: (p) => p.startsWith('/') && !p.startsWith('//'),
    })
    const to = makeRoute({
      meta: { requiresAuth: true },
      fullPath: 'https://evil.com',
    })
    expect(guard(to, makeRoute(), () => {})).toEqual({ name: LOGIN_ROUTE })
  })

  it('SC9: relative path redirect → login with ?redirect param', () => {
    isAuthenticated.mockReturnValue(false)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    const to = makeRoute({
      meta: { requiresAuth: true },
      fullPath: '/exam/1?mode=practice',
    })
    expect(guard(to, makeRoute(), () => {})).toEqual({
      name: LOGIN_ROUTE,
      query: { redirect: '/exam/1?mode=practice' },
    })
  })

  it('SC10: isAuthenticated() throws → returns true (fail-open)', () => {
    isAuthenticated.mockImplementation(() => {
      throw new Error('Auth check failed')
    })
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    expect(
      guard(makeRoute({ meta: { requiresAuth: true } }), makeRoute(), () => {})
    ).toBe(true)
  })

  it('US9: after logout, protected route → login redirect', () => {
    isAuthenticated.mockReturnValue(false)
    const guard = createAuthGuard({
      isAuthenticated,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    const to = makeRoute({ meta: { requiresAuth: true }, fullPath: '/exams' })
    expect(guard(to, makeRoute(), () => {})).toEqual({
      name: LOGIN_ROUTE,
      query: { redirect: '/exams' },
    })
  })
})
