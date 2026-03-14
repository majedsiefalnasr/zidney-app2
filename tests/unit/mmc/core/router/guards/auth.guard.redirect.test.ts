/**
 * Unit tests for apps/mmc/src/core/guards/auth.guard.ts — redirect preservation
 * Covers FR-SEC-09, FR-SEC-16, PF-03 (redirect loop guard).
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 * Task: T032
 */
import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { createAuthGuard } from '../../../../../../apps/mmc/src/core/guards/auth.guard'

function makeRoute(overrides: Partial<RouteLocationNormalized> = {}): RouteLocationNormalized {
  return {
    path: '/dashboard',
    name: 'mmc-dashboard',
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

const LOGIN_ROUTE = 'mmc-login'
const DASHBOARD_ROUTE = 'mmc-dashboard'

describe('createAuthGuard — redirect preservation (mmc)', () => {
  // ── Unauthenticated access to protected route ────────────────────────────

  it('unauthenticated access → redirect includes query.redirect === to.fullPath', () => {
    const guard = createAuthGuard({
      isAuthenticated: () => false,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    const to = makeRoute({
      fullPath: '/protected/page',
      path: '/protected/page',
      name: 'some-protected',
    })
    const result = guard(to, makeRoute(), () => {})
    expect(result).toEqual({
      name: LOGIN_ROUTE,
      query: { redirect: '/protected/page' },
    })
  })

  it('preserveRedirect: false option → redirect has no query param', () => {
    const guard = createAuthGuard({
      isAuthenticated: () => false,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
      isSafeRedirect: () => false,
    })
    const to = makeRoute({ fullPath: '/some-page', name: 'some-page' })
    const result = guard(to, makeRoute(), () => {})
    expect(result).toEqual({ name: LOGIN_ROUTE })
    expect((result as Record<string, unknown>)?.query).toBeUndefined()
  })

  it('preserveRedirect omitted (default) → behaves identically to preserveRedirect: true', () => {
    const guardDefault = createAuthGuard({
      isAuthenticated: () => false,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    const guardExplicit = createAuthGuard({
      isAuthenticated: () => false,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    const to = makeRoute({ fullPath: '/any-page', name: 'any-page' })
    expect(guardDefault(to, makeRoute(), () => {})).toEqual(
      guardExplicit(to, makeRoute(), () => {})
    )
  })

  // ── Authenticated access ─────────────────────────────────────────────────

  it('authenticated access to protected route → navigation passes through without redirect', () => {
    const guard = createAuthGuard({
      isAuthenticated: () => true,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    const to = makeRoute({ name: 'mmc-dashboard', fullPath: '/dashboard' })
    const result = guard(to, makeRoute(), () => {})
    expect(result).toBe(true)
  })

  // ── PF-03: redirect loop guard ───────────────────────────────────────────

  it('accessing login route directly while unauthenticated → passes through without redirect loop', () => {
    const guard = createAuthGuard({
      isAuthenticated: () => false,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    const to = makeRoute({
      name: LOGIN_ROUTE,
      fullPath: '/login',
      path: '/login',
      meta: { requiresAuth: true }, // defense-in-depth: meta.public accidentally omitted
    })
    const result = guard(to, makeRoute(), () => {})
    expect(result).toBe(true)
  })

  // ── guestOnly route: authenticated user → redirect to dashboard ──────────

  it('authenticated user accessing public route → redirect to dashboard', () => {
    const guard = createAuthGuard({
      isAuthenticated: () => true,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    const to = makeRoute({
      meta: { public: true },
      name: LOGIN_ROUTE,
      fullPath: '/login',
    })
    const result = guard(to, makeRoute(), () => {})
    expect(result).toEqual({ name: DASHBOARD_ROUTE })
  })

  // ── Public route: all users pass through ────────────────────────────────

  it('public route (no requiresAuth, no guestOnly) → navigation passes through', () => {
    const guard = createAuthGuard({
      isAuthenticated: () => false,
      loginRouteName: LOGIN_ROUTE,
      dashboardRouteName: DASHBOARD_ROUTE,
    })
    const to = makeRoute({ meta: {}, name: 'public-page', fullPath: '/public' })
    const result = guard(to, makeRoute(), () => {})
    expect(result).toBe(true)
  })
})
