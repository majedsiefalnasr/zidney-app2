/**
 * Configurable navigation guard for Backoffice.
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
