/**
 * RoleGuard unit tests for MMC.
 * Tests the createRoleGuard() factory with injected callbacks.
 * No DOM or mounted components required.
 *
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { createRoleGuard } from '../role.guard'

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

const UNAUTHORIZED_ROUTE = 'mmc-unauthorized'

describe('createRoleGuard (MMC)', () => {
  let getUserRole: Mock<[], string | undefined>

  beforeEach(() => {
    getUserRole = vi.fn().mockReturnValue(undefined)
  })

  // SC1: roles:['admin'] + user.role:'admin' → allow
  it('SC1: roles:["admin"] + user.role:"admin" → returns true', () => {
    getUserRole.mockReturnValue('admin')
    const guard = createRoleGuard({
      getUserRole,
      unauthorizedRouteName: UNAUTHORIZED_ROUTE,
    })
    const to = makeRoute({ meta: { roles: ['admin'] } })
    expect(guard(to, makeRoute(), () => {})).toBe(true)
  })

  // SC2: roles:['admin'] + user.role:'viewer' → redirect to unauthorized
  it('SC2: roles:["admin"] + user.role:"viewer" → redirects to mmc-unauthorized', () => {
    getUserRole.mockReturnValue('viewer')
    const guard = createRoleGuard({
      getUserRole,
      unauthorizedRouteName: UNAUTHORIZED_ROUTE,
    })
    const to = makeRoute({ meta: { roles: ['admin'] } })
    expect(guard(to, makeRoute(), () => {})).toEqual({
      name: UNAUTHORIZED_ROUTE,
    })
  })

  // SC3: roles undefined → allow (guard skips)
  it('SC3: roles undefined → returns true (guard skips)', () => {
    getUserRole.mockReturnValue('viewer')
    const guard = createRoleGuard({
      getUserRole,
      unauthorizedRouteName: UNAUTHORIZED_ROUTE,
    })
    const to = makeRoute({ meta: {} })
    expect(guard(to, makeRoute(), () => {})).toBe(true)
  })

  // SC4: roles:['admin'] + user:null → redirect to unauthorized
  it('SC4: roles:["admin"] + user:null → redirects to mmc-unauthorized', () => {
    getUserRole.mockReturnValue(undefined)
    const guard = createRoleGuard({
      getUserRole,
      unauthorizedRouteName: UNAUTHORIZED_ROUTE,
    })
    const to = makeRoute({ meta: { roles: ['admin'] } })
    expect(guard(to, makeRoute(), () => {})).toEqual({
      name: UNAUTHORIZED_ROUTE,
    })
  })

  // SC5: to.name === unauthorizedRouteName → allow (loop prevention)
  it('SC5: already on unauthorized route → returns true (loop prevention)', () => {
    getUserRole.mockReturnValue(undefined)
    const guard = createRoleGuard({
      getUserRole,
      unauthorizedRouteName: UNAUTHORIZED_ROUTE,
    })
    const to = makeRoute({
      name: UNAUTHORIZED_ROUTE,
      meta: { roles: ['admin'] },
    })
    expect(guard(to, makeRoute(), () => {})).toBe(true)
  })

  // SC6: getUser() throws → log error + return true (fail-open)
  it('SC6: getUserRole() throws → returns true (fail-open)', () => {
    getUserRole.mockImplementation(() => {
      throw new Error('Store unavailable')
    })
    const guard = createRoleGuard({
      getUserRole,
      unauthorizedRouteName: UNAUTHORIZED_ROUTE,
    })
    const to = makeRoute({ meta: { roles: ['admin'] } })
    expect(guard(to, makeRoute(), () => {})).toBe(true)
  })
})
