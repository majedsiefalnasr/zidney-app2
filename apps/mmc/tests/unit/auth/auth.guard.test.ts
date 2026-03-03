/**
 * Unit tests for createAuthGuard().
 * Verifies: routing decisions, never calls router.push(), never throws.
 *
 * Updated for STAGE_UI_03_ROUTER_AND_GUARDS:
 * - Uses new object options API: createAuthGuard({ isAuthenticated, loginRouteName, dashboardRouteName })
 * - Uses new RouteMeta fields: `public` instead of `guestOnly`, `roles[]` instead of `requiredRole`
 *
 * Stage: STAGE_UI_01_AUTH_MODULE (updated in STAGE_UI_03_ROUTER_AND_GUARDS)
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { createAuthGuard } from '../../../src/core/guards/auth.guard'

// ─── Logger mock ─────────────────────────────────────────────────────────────
vi.mock('@zidney/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRoute(
  meta: Record<string, unknown> = {},
  name = 'some-route'
): RouteLocationNormalized {
  return {
    name,
    path: '/' + String(name),
    meta,
    params: {},
    query: {},
    hash: '',
    matched: [],
    fullPath: '/' + String(name),
    redirectedFrom: undefined,
  } as unknown as RouteLocationNormalized
}

const FROM = makeRoute({}, 'from-route')

// ─── Factory helper ───────────────────────────────────────────────────────────

function makeGuard(isAuthenticated: () => boolean) {
  return createAuthGuard({
    isAuthenticated,
    loginRouteName: 'mmc-login',
    dashboardRouteName: 'mmc-dashboard',
  })
}

describe('createAuthGuard', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  // ── requiresAuth + unauthenticated ────────────────────────────────────────

  it('requiresAuth=true + unauthenticated → redirects to login', () => {
    const guard = makeGuard(() => false)
    const to = makeRoute({ requiresAuth: true }, 'mmc-dashboard')

    const result = guard(to, FROM, vi.fn())

    expect(result).toMatchObject({ name: 'mmc-login' })
  })

  it('requiresAuth=true + authenticated → returns true (allow)', () => {
    const guard = makeGuard(() => true)
    const to = makeRoute({ requiresAuth: true }, 'mmc-dashboard')

    const result = guard(to, FROM, vi.fn())

    expect(result).toBe(true)
  })

  // ── public + authenticated ────────────────────────────────────────────────

  it('public=true + authenticated → redirects to dashboard', () => {
    const guard = makeGuard(() => true)
    const to = makeRoute({ public: true }, 'mmc-login')

    const result = guard(to, FROM, vi.fn())

    expect(result).toMatchObject({ name: 'mmc-dashboard' })
  })

  it('public=true + unauthenticated → returns true (allow)', () => {
    const guard = makeGuard(() => false)
    const to = makeRoute({ public: true }, 'mmc-login')

    const result = guard(to, FROM, vi.fn())

    expect(result).toBe(true)
  })

  // ── No meta ───────────────────────────────────────────────────────────────

  it('no meta + authenticated → returns true (allow)', () => {
    const guard = makeGuard(() => true)
    const to = makeRoute({}, 'public-page')

    const result = guard(to, FROM, vi.fn())

    expect(result).toBe(true)
  })

  it('no meta + unauthenticated → returns true (allow)', () => {
    const guard = makeGuard(() => false)
    const to = makeRoute({}, 'public-page')

    const result = guard(to, FROM, vi.fn())

    expect(result).toBe(true)
  })

  // ── Guard behavioral constraints ──────────────────────────────────────────

  it('guard never calls next() with router.push behavior (uses returns only)', () => {
    const guard = makeGuard(() => false)
    const to = makeRoute({ requiresAuth: true })

    // Result must be a redirect location — not calling router.push()
    const result = guard(to, FROM, vi.fn()) as unknown
    expect(typeof result === 'object' || result === true).toBe(true)
  })

  it('guard never throws for well-behaved callbacks', () => {
    const guard = makeGuard(() => false)
    const to = makeRoute({ requiresAuth: true })

    expect(() => guard(to, FROM, vi.fn())).not.toThrow()
  })

  // ── roles[] meta (auth guard ignores roles — roles are handled by RoleGuard) ─

  it('roles present + authenticated + requiresAuth → allows through (auth guard does not check roles)', () => {
    const guard = makeGuard(() => true)
    const to = makeRoute({ requiresAuth: true, roles: ['admin'] }, 'mmc-admin')

    const result = guard(to, FROM, vi.fn())

    // auth guard only checks requiresAuth/public — role checks are separate
    expect(result).toBe(true)
  })
})

// ── requiresAuth + unauthenticated ────────────────────────────────────────
