/**
 * RoleGuard factory for Frontoffice.
 * Gates navigation by user role (UI-hint only — non-authoritative).
 *
 * INVARIANTS:
 * - Guards MUST NOT call APIs or fetch().
 * - Guards read ONLY from injected getUserRole() callback.
 * - Role check is UI-hint only; backend is the final authority.
 * - Skips if to.meta.roles is undefined or empty.
 * - Redirects to unauthorizedRouteName on role mismatch or null user.
 * - Loop prevention: pass through if already on unauthorized route.
 * - On error: log via @zidney/logger, return true.
 *
 * Default route names (Frontoffice):
 *   unauthorizedRouteName: 'fo-unauthorized'
 *
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */
import { createLogger } from '@zidney/logger'
import type {
  NavigationGuard,
  RouteLocationNormalized,
  RouteLocationRaw,
} from 'vue-router'

const logger = createLogger('frontoffice:role-guard')

// ─── Options Interface ────────────────────────────────────────────────────────

export interface RoleGuardOptions {
  /**
   * Name of the unauthorized route.
   * Frontoffice: 'fo-unauthorized'
   */
  unauthorizedRouteName: string
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a role guard NavigationGuard.
 *
 * @param options - Injected callbacks and app-specific route names
 */
export function createRoleGuard(options: {
  getUserRole: () => string | undefined
  unauthorizedRouteName: string
}): NavigationGuard {
  return (to: RouteLocationNormalized): RouteLocationRaw | boolean => {
    try {
      const roles = to.meta['roles'] as string[] | undefined

      // Skip if no roles required for this route
      if (!roles || roles.length === 0) return true

      // Loop prevention: if already on unauthorized route, allow
      if (to.name === options.unauthorizedRouteName) return true

      const userRole = options.getUserRole()

      if (!userRole || !roles.includes(userRole)) {
        logger.debug(
          'Role guard: role mismatch or null user, redirecting to unauthorized',
          {
            route: to.name?.toString() ?? to.path,
            requiredRoles: roles,
            userRole: userRole ?? 'null',
          }
        )
        return { name: options.unauthorizedRouteName }
      }

      return true
    } catch (err) {
      logger.error({ msg: 'Role guard error', err })
      return true
    }
  }
}
