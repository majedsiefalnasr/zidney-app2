/**
 * AuthGuard factory for MMC.
 *
 * INVARIANTS:
 * - Guards MUST NOT decode JWT tokens.
 * - Guards MUST NOT call APIs or fetch().
 * - Guards MUST NOT validate license state.
 * - Guards read ONLY from injected callbacks.
 * - isSafeRedirect rejects non-'/' start and '//' start paths.
 * - On error: log via @zidney/logger, return true.
 *
 * Default route names (MMC):
 *   loginRouteName: 'mmc-login'
 *   dashboardRouteName: 'mmc-dashboard'
 *
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */
import { createLogger } from '@zidney/logger'
import type { NavigationGuard, RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

const logger = createLogger('mmc:auth-guard')

// ─── Options Interface ────────────────────────────────────────────────────────

export interface AuthGuardOptions {
  /**
   * Name of the login route for this app.
   * MMC: 'mmc-login'
   */
  loginRouteName: string
  /**
   * Name of the default authenticated landing route.
   * MMC: 'mmc-dashboard'
   */
  dashboardRouteName: string
  /**
   * Validates redirect path safety. Rejects non-'/' and '//'-start paths.
   * Defaults to built-in isSafeRedirect if not provided.
   */
  isSafeRedirect?: (path: string) => boolean
  /**
   * When true (default), preserves the intended route as ?redirect query param
   * on unauthenticated access so the login page can redirect back after auth.
   * Set to false to omit the query param entirely.
   */
  preserveRedirect?: boolean
}

// ─── Safe Redirect Validator ──────────────────────────────────────────────────

/**
 * Validates that a redirect path is safe (internal).
 * Rejects paths that don't start with '/' or start with '//'.
 */
export function isSafeRedirect(path: string): boolean {
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  return true
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates an auth guard NavigationGuard.
 *
 * @param isAuthenticated - Callback returning current auth state (no JWT inspection)
 * @param options - App-specific route names and configuration
 */
export function createAuthGuard(options: {
  isAuthenticated: () => boolean
  loginRouteName: string
  dashboardRouteName: string
  isSafeRedirect?: (path: string) => boolean
}): NavigationGuard {
  const safeRedirect = options.isSafeRedirect ?? isSafeRedirect

  return (to: RouteLocationNormalized): RouteLocationRaw | boolean => {
    try {
      const authenticated = options.isAuthenticated()

      // Loop prevention: if already on login route and not authenticated, allow
      if (to.name === options.loginRouteName && !authenticated) return true

      // requiresAuth: unauthenticated users → redirect to login with optional ?redirect
      if (to.meta.requiresAuth === true) {
        if (!authenticated) {
          logger.debug('Auth guard: unauthenticated access to protected route', {
            route: to.name?.toString() ?? to.path,
          })

          const redirect = to.fullPath
          if (safeRedirect(redirect)) {
            return {
              name: options.loginRouteName,
              query: { redirect },
            }
          }
          return { name: options.loginRouteName }
        }
        return true
      }

      // public: authenticated users → redirect to dashboard
      if (to.meta.public === true) {
        if (authenticated) {
          logger.debug('Auth guard: authenticated user accessing public route', {
            route: to.name?.toString() ?? to.path,
          })
          return { name: options.dashboardRouteName }
        }
        return true
      }

      // No relevant meta — allow navigation
      return true
    } catch (err) {
      logger.error({ msg: 'Auth guard error', err })
      return true
    }
  }
}
