/**
 * RoleGuard unit tests for Frontoffice.
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { createRoleGuard } from '../role.guard'

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

const UNAUTHORIZED_ROUTE = 'fo-unauthorized'

describe('createRoleGuard (Frontoffice)', () => {
  let getUserRole: Mock<[], string | undefined>

  beforeEach(() => {
    getUserRole = vi.fn().mockReturnValue(undefined)
  })

  it('SC1: roles:["instructor"] + user.role:"instructor" → returns true', () => {
    getUserRole.mockReturnValue('instructor')
    const guard = createRoleGuard({
      getUserRole,
      unauthorizedRouteName: UNAUTHORIZED_ROUTE,
    })
    expect(guard(makeRoute({ meta: { roles: ['instructor'] } }), makeRoute(), () => {})).toBe(true)
  })

  it('SC2: roles:["instructor"] + user.role:"student" → redirects to fo-unauthorized', () => {
    getUserRole.mockReturnValue('student')
    const guard = createRoleGuard({
      getUserRole,
      unauthorizedRouteName: UNAUTHORIZED_ROUTE,
    })
    expect(guard(makeRoute({ meta: { roles: ['instructor'] } }), makeRoute(), () => {})).toEqual({
      name: UNAUTHORIZED_ROUTE,
    })
  })

  it('SC3: roles undefined → returns true (guard skips)', () => {
    getUserRole.mockReturnValue('student')
    const guard = createRoleGuard({
      getUserRole,
      unauthorizedRouteName: UNAUTHORIZED_ROUTE,
    })
    expect(guard(makeRoute({ meta: {} }), makeRoute(), () => {})).toBe(true)
  })

  it('SC4: roles:["instructor"] + user:null → redirects to fo-unauthorized', () => {
    getUserRole.mockReturnValue(undefined)
    const guard = createRoleGuard({
      getUserRole,
      unauthorizedRouteName: UNAUTHORIZED_ROUTE,
    })
    expect(guard(makeRoute({ meta: { roles: ['instructor'] } }), makeRoute(), () => {})).toEqual({
      name: UNAUTHORIZED_ROUTE,
    })
  })

  it('SC5: already on unauthorized route → returns true (loop prevention)', () => {
    getUserRole.mockReturnValue(undefined)
    const guard = createRoleGuard({
      getUserRole,
      unauthorizedRouteName: UNAUTHORIZED_ROUTE,
    })
    expect(
      guard(
        makeRoute({
          name: UNAUTHORIZED_ROUTE,
          meta: { roles: ['instructor'] },
        }),
        makeRoute(),
        () => {}
      )
    ).toBe(true)
  })

  it('SC6: getUserRole() throws → returns true (fail-open)', () => {
    getUserRole.mockImplementation(() => {
      throw new Error('Store unavailable')
    })
    const guard = createRoleGuard({
      getUserRole,
      unauthorizedRouteName: UNAUTHORIZED_ROUTE,
    })
    expect(guard(makeRoute({ meta: { roles: ['instructor'] } }), makeRoute(), () => {})).toBe(true)
  })
})
