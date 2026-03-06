/**
 * FeatureFlagGuard unit tests for Frontoffice.
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */
import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { createFeatureFlagGuard } from '../feature-flag.guard'

function makeRoute(overrides: Partial<RouteLocationNormalized> = {}): RouteLocationNormalized {
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

describe('createFeatureFlagGuard (Frontoffice)', () => {
  it('always returns true for any route', () => {
    const guard = createFeatureFlagGuard()
    expect(guard(makeRoute({ meta: { requiresAuth: true } }), makeRoute(), () => {})).toBe(true)
  })

  it('always returns true for public routes', () => {
    const guard = createFeatureFlagGuard()
    expect(guard(makeRoute({ meta: { public: true } }), makeRoute(), () => {})).toBe(true)
  })

  it('never redirects — always passes navigation', () => {
    const guard = createFeatureFlagGuard()
    const result = guard(makeRoute(), makeRoute(), () => {})
    expect(result).toBe(true)
  })
})
