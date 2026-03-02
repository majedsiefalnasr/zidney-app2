/**
 * Unit tests for apps/backoffice/src/core/router/guards/auth.guard.ts — redirect preservation
 * Covers FR-SEC-09, FR-SEC-16, PF-03 (redirect loop guard).
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 * Task: T033
 */
import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { createAuthGuard } from '../../../../../../apps/backoffice/src/core/router/guards/auth.guard'

function makeRoute(
  overrides: Partial<RouteLocationNormalized> = {}
): RouteLocationNormalized {
  return {
    path: '/dashboard',
    name: 'bo-dashboard',
    fullPath: '/dashboard',
    params: {},
    query: {},
    hash: '',
    meta: { requiresAuth: true },
    matched: [],
    redirectedFrom: undefined,
    ...overrides,
  } as unknown as RouteLocationNormalized
}

const LOGIN_ROUTE = 'bo-login'
const DASHBOARD_ROUTE = 'bo-dashboard'

describe('createAuthGuard — redirect preservation (backoffice)', () => {
  it('unauthenticated access → redirect includes query.redirect === to.fullPath', () => {
    const guard = createAuthGuard(() => false, {
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    const to = makeRoute({
      fullPath: '/protected/page',
      name: 'some-protected',
    })
    expect(guard(to, makeRoute(), () => {})).toEqual({
      name: LOGIN_ROUTE,
      query: { redirect: '/protected/page' },
    })
  })

  it('preserveRedirect: false option → redirect has no query param', () => {
    const guard = createAuthGuard(() => false, {
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
      preserveRedirect: false,
    })
    const to = makeRoute({ fullPath: '/some-page', name: 'some-page' })
    const result = guard(to, makeRoute(), () => {})
    expect(result).toEqual({ name: LOGIN_ROUTE })
  })

  it('preserveRedirect omitted → same as preserveRedirect: true', () => {
    const g1 = createAuthGuard(() => false, {
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    const g2 = createAuthGuard(() => false, {
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
      preserveRedirect: true,
    })
    const to = makeRoute({ fullPath: '/page', name: 'page' })
    expect(g1(to, makeRoute(), () => {})).toEqual(g2(to, makeRoute(), () => {}))
  })

  it('authenticated access to protected route → passes through', () => {
    const guard = createAuthGuard(() => true, {
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    expect(guard(makeRoute(), makeRoute(), () => {})).toBe(true)
  })

  it('accessing login route directly while unauthenticated → no redirect loop (PF-03)', () => {
    const guard = createAuthGuard(() => false, {
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    const to = makeRoute({
      name: LOGIN_ROUTE,
      fullPath: '/login',
      meta: { requiresAuth: true },
    })
    expect(guard(to, makeRoute(), () => {})).toBe(true)
  })
})
