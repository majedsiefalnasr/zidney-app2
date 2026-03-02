/**
 * Configurable navigation guard for MMC.
 * Factory that returns a NavigationGuard configured with per-app route names.
 *
 * INVARIANTS:
 * - FR-24: Uses getIsAuthenticated() callback — no JWT inspection.
 * - FR-25: RETURNS redirect locations; never calls router.push().
 * - FR-26: Never throws — pure synchronous discriminator.
 * - FR-27: loginRouteName and dashboardRouteName are app-specific (injected).
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */
import { createLogger } from '@zidney/logger'
import type {
  NavigationGuard,
  RouteLocationNormalized,
  RouteLocationRaw,
} from 'vue-router'

const logger = createLogger('auth:auth-guard')

// ─── Options Interface ────────────────────────────────────────────────────────
export interface AuthGuardOptions {
  /**
   * Name of the login route for this app.
   * MMC: 'mmc-login' | Backoffice: 'bo-login' | Frontoffice: 'fo-login'
   */
  loginRouteName: string
  /**
   * Name of the default authenticated landing route.
   * MMC: 'mmc-dashboard' | Backoffice: 'bo-dashboard' | Frontoffice: 'fo-home'
   */
  dashboardRouteName: string
  /**
   * When true (default), preserves the intended route as ?redirect query param
   * on unauthenticated access so the login page can redirect back after auth.
   * Set to false to omit the query param entirely (FR-SEC-09, FR-SEC-16).
   */
  preserveRedirect?: boolean
}

// ─── Factory ─────────────────────────────────────────────────────────────────
/**
 * Creates an auth guard NavigationGuard.
 *
 * @param getIsAuthenticated - Callback returning current auth state (no JWT inspection)
 * @param options - App-specific route names
 */
export function createAuthGuard(
  getIsAuthenticated: () => boolean,
  options: AuthGuardOptions
): NavigationGuard {
  return (to: RouteLocationNormalized): RouteLocationRaw | boolean => {
    const isAuthenticated = getIsAuthenticated()

    // requiresAuth: unauthenticated users → redirect to login
    if (to.meta['requiresAuth'] === true) {
      if (!isAuthenticated) {
        logger.debug('Auth guard: unauthenticated access to protected route', {
          route: to.name?.toString() ?? to.path,
        })

        // PF-03: Defense-in-depth redirect-loop guard.
        // If the target IS already the login route, pass through without redirect.
        // This handles the edge case where meta.public is accidentally omitted.
        if (to.name === options.loginRouteName) return true

        // FR-SEC-09/FR-SEC-16: Preserve intended destination for post-login redirect
        if (options.preserveRedirect !== false) {
          return {
            name: options.loginRouteName,
            query: { redirect: to.fullPath },
          }
        }
        return { name: options.loginRouteName }
      }
      return true
    }

    // guestOnly: authenticated users → redirect to dashboard
    if (to.meta['guestOnly'] === true) {
      if (isAuthenticated) {
        logger.debug(
          'Auth guard: authenticated user accessing guest-only route',
          {
            route: to.name?.toString() ?? to.path,
          }
        )
        return { name: options.dashboardRouteName }
      }
      return true
    }

    // No relevant meta — allow navigation
    return true
  }
}
