/**
 * WorkspaceGuard unit tests for Backoffice.
 * Tests the createWorkspaceGuard() factory with injected callbacks.
 * No DOM or mounted components required.
 *
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { createWorkspaceGuard } from '../workspace.guard'

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

const WORKSPACE_SELECTOR_ROUTE = 'bo-workspace-selector'

describe('createWorkspaceGuard (Backoffice)', () => {
  let isWorkspaceResolved: Mock<[], boolean>

  beforeEach(() => {
    isWorkspaceResolved = vi.fn().mockReturnValue(false)
  })

  // SC1: requiresWorkspace + resolved → allow
  it('SC1: requiresWorkspace + resolved → returns true', () => {
    isWorkspaceResolved.mockReturnValue(true)
    const guard = createWorkspaceGuard({
      isWorkspaceResolved,
      workspaceSelectorRouteName: WORKSPACE_SELECTOR_ROUTE,
    })
    const to = makeRoute({ meta: { requiresWorkspace: true } })
    expect(guard(to, makeRoute(), () => {})).toBe(true)
  })

  // SC2: requiresWorkspace + !resolved → redirect to workspace selector
  it('SC2: requiresWorkspace + !resolved → redirects to bo-workspace-selector', () => {
    isWorkspaceResolved.mockReturnValue(false)
    const guard = createWorkspaceGuard({
      isWorkspaceResolved,
      workspaceSelectorRouteName: WORKSPACE_SELECTOR_ROUTE,
    })
    const to = makeRoute({ meta: { requiresWorkspace: true } })
    expect(guard(to, makeRoute(), () => {})).toEqual({
      name: WORKSPACE_SELECTOR_ROUTE,
    })
  })

  // SC3: requiresWorkspace undefined → allow (guard does not activate)
  it('SC3: requiresWorkspace undefined → returns true (guard skips)', () => {
    isWorkspaceResolved.mockReturnValue(false)
    const guard = createWorkspaceGuard({
      isWorkspaceResolved,
      workspaceSelectorRouteName: WORKSPACE_SELECTOR_ROUTE,
    })
    const to = makeRoute({ meta: {} })
    expect(guard(to, makeRoute(), () => {})).toBe(true)
  })

  // SC4: to.name === 'bo-workspace-selector' → allow (loop prevention)
  it('SC4: already on workspace-selector route → returns true (loop prevention)', () => {
    isWorkspaceResolved.mockReturnValue(false)
    const guard = createWorkspaceGuard({
      isWorkspaceResolved,
      workspaceSelectorRouteName: WORKSPACE_SELECTOR_ROUTE,
    })
    const to = makeRoute({
      name: WORKSPACE_SELECTOR_ROUTE,
      meta: { requiresWorkspace: true },
    })
    expect(guard(to, makeRoute(), () => {})).toBe(true)
  })

  // SC5: isWorkspaceResolved() throws → log error + return true (fail-open)
  it('SC5: isWorkspaceResolved() throws → returns true (fail-open)', () => {
    isWorkspaceResolved.mockImplementation(() => {
      throw new Error('Store unavailable')
    })
    const guard = createWorkspaceGuard({
      isWorkspaceResolved,
      workspaceSelectorRouteName: WORKSPACE_SELECTOR_ROUTE,
    })
    const to = makeRoute({ meta: { requiresWorkspace: true } })
    expect(guard(to, makeRoute(), () => {})).toBe(true)
  })
})
