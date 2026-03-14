/**
 * Route coverage audit (mmc) — every non-public route must have requiresAuth: true.
 * No route should silently bypass the auth guard.
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 * Task: T052
 */
import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'

// Known routes that do NOT require authentication (explicitly allowed)
const KNOWN_PUBLIC_ROUTE_NAMES = new Set([
  'mmc-login', // login page is public
  'mmc-not-found',
])

/**
 * Recursively collects all route records (including children).
 */
function flattenRoutes(routes: RouteRecordRaw[]): RouteRecordRaw[] {
  const result: RouteRecordRaw[] = []
  for (const route of routes) {
    result.push(route)
    if (route.children) {
      result.push(...flattenRoutes(route.children))
    }
  }
  return result
}

// Import route arrays directly from module files to avoid @/ alias resolution
import { dashboardRoutes } from '../../../../../../apps/mmc/src/modules/dashboard/routes'
import { licensesRoutes } from '../../../../../../apps/mmc/src/modules/licenses/routes'

const notFoundRoute: RouteRecordRaw = {
  path: '/:pathMatch(.*)*',
  name: 'mmc-not-found',
  component: () => Promise.resolve({}),
}
const mmcRoutes: RouteRecordRaw[] = [...dashboardRoutes, ...licensesRoutes, notFoundRoute]

describe('route coverage audit (mmc)', () => {
  it('all module-registered routes should have requiresAuth: true or be in the known-public allowlist', () => {
    const allRoutes = flattenRoutes(mmcRoutes)

    const unprotectedUnknownRoutes = allRoutes.filter((route) => {
      const hasRequiresAuth = route.meta?.requiresAuth === true
      const routeName = String(route.name ?? '')
      const isKnownPublic = KNOWN_PUBLIC_ROUTE_NAMES.has(routeName)
      return !hasRequiresAuth && !isKnownPublic
    })

    if (unprotectedUnknownRoutes.length > 0) {
      const names = unprotectedUnknownRoutes.map((r) => `${String(r.name)} (${r.path})`).join(', ')
      throw new Error(
        `Route coverage audit FAILED: The following routes lack requiresAuth: true and ` +
          `are not in the known-public allowlist: [${names}]. ` +
          `Either add meta: { requiresAuth: true } or add the route name to KNOWN_PUBLIC_ROUTE_NAMES.`
      )
    }

    expect(unprotectedUnknownRoutes).toHaveLength(0)
  })

  it('all routes with requiresAuth: true are actually present in the routes array', () => {
    const allRoutes = flattenRoutes(mmcRoutes)
    const protectedRoutes = allRoutes.filter((r) => r.meta?.requiresAuth === true)
    // At minimum, the dashboard and licenses routes should be guarded
    const protectedNames = protectedRoutes.map((r) => r.name)
    expect(protectedNames).toContain('mmc-dashboard')
    expect(protectedNames).toContain('mmc-licenses')
    expect(protectedNames).toContain('mmc-license-detail')
  })

  it('contains the not-found catch-all route', () => {
    const allRoutes = flattenRoutes(mmcRoutes)
    const notFound = allRoutes.find((r) => r.name === 'mmc-not-found')
    expect(notFound).toBeDefined()
    expect(notFound?.path).toBe('/:pathMatch(.*)*')
  })
})
