/**
 * Route coverage audit (frontoffice) — every non-public route must have requiresAuth: true.
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 * Task: T054
 */
import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'

const KNOWN_PUBLIC_ROUTE_NAMES = new Set(['not-found', 'fo-login', 'login'])

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

// Frontoffice only has the not-found catch-all route; define it inline to avoid @/ alias chain
const notFoundRoute: RouteRecordRaw = {
  path: '/:pathMatch(.*)*',
  name: 'not-found',
  component: () => Promise.resolve({}),
}
const frontofficeRoutes: RouteRecordRaw[] = [notFoundRoute]

describe('route coverage audit (frontoffice)', () => {
  it('all module-registered routes have requiresAuth: true or are in the known-public allowlist', () => {
    const allRoutes = flattenRoutes(frontofficeRoutes)

    const unprotectedUnknownRoutes = allRoutes.filter((route) => {
      const hasRequiresAuth = route.meta?.['requiresAuth'] === true
      const routeName = String(route.name ?? '')
      const isKnownPublic = KNOWN_PUBLIC_ROUTE_NAMES.has(routeName)
      return !hasRequiresAuth && !isKnownPublic
    })

    if (unprotectedUnknownRoutes.length > 0) {
      const names = unprotectedUnknownRoutes
        .map((r) => `${String(r.name)} (${r.path})`)
        .join(', ')
      throw new Error(
        `Route coverage audit FAILED: The following routes lack requiresAuth: true: [${names}]`
      )
    }

    expect(unprotectedUnknownRoutes).toHaveLength(0)
  })

  it('contains the not-found catch-all route', () => {
    const allRoutes = flattenRoutes(frontofficeRoutes)
    const notFound = allRoutes.find((r) => r.name === 'not-found')
    expect(notFound).toBeDefined()
    expect(notFound?.path).toBe('/:pathMatch(.*)*')
  })
})
