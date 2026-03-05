/**
 * Guard pipeline barrel for MMC.
 * Registers all navigation guards in the correct pipeline order.
 *
 * Pipeline order:
 * 1. sessionInitialized gate (initSession once on first navigation)
 * 2. AuthGuard
 * 3. RoleGuard
 * 4. FeatureFlagGuard
 *
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */
import { createLogger } from '@zidney/logger'
import type { Router } from 'vue-router'
import { createAuthGuard } from './auth.guard'
import { createFeatureFlagGuard } from './feature-flag.guard'
import { createRoleGuard } from './role.guard'

const logger = createLogger('mmc:guards')

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  createAuthGuard,
  isSafeRedirect,
  type AuthGuardOptions,
} from './auth.guard'
export { createFeatureFlagGuard } from './feature-flag.guard'
export { createRoleGuard, type RoleGuardOptions } from './role.guard'

// ─── Options Interface ────────────────────────────────────────────────────────

export interface RegisterGuardsOptions {
  /** Callback returning whether the user is authenticated */
  isAuthenticated: () => boolean
  /** Login route name. MMC: 'mmc-login' */
  loginRouteName: string
  /** Dashboard route name. MMC: 'mmc-dashboard' */
  dashboardRouteName: string
  /** Callback returning the user's role, or undefined if not authenticated */
  getUserRole: () => string | undefined
  /** Unauthorized route name. MMC: 'mmc-unauthorized' */
  unauthorizedRouteName: string
  /** Error route name. MMC: 'mmc-error' */
  errorRouteName: string
  /** Optional session initializer. Called exactly once on first navigation. */
  initSession?: () => Promise<void>
}

// ─── registerGuards ───────────────────────────────────────────────────────────

/**
 * Registers all navigation guards on the given router instance.
 * Must be called after router creation and before app.mount().
 *
 * @param router - The Vue Router instance
 * @param options - Guard configuration options
 */
export function registerGuards(
  router: Router,
  options: RegisterGuardsOptions
): void {
  let sessionInitialized = false

  const authGuard = createAuthGuard({
    isAuthenticated: options.isAuthenticated,
    loginRouteName: options.loginRouteName,
    dashboardRouteName: options.dashboardRouteName,
  })

  const roleGuard = createRoleGuard({
    getUserRole: options.getUserRole,
    unauthorizedRouteName: options.unauthorizedRouteName,
  })

  const featureFlagGuard = createFeatureFlagGuard()

  router.beforeEach(async (to, from) => {
    // Wrap initSession in try/catch; always set sessionInitialized=true
    if (!sessionInitialized) {
      try {
        await options.initSession?.()
      } catch (err) {
        logger.error({ msg: 'Session init failed', err })
      } finally {
        sessionInitialized = true
      }
    }

    // Pipeline: AuthGuard → RoleGuard → FeatureFlagGuard
    const authResult = await Promise.resolve(authGuard(to, from, () => {}))
    if (authResult !== true && authResult !== undefined) return authResult

    const roleResult = await Promise.resolve(roleGuard(to, from, () => {}))
    if (roleResult !== true && roleResult !== undefined) return roleResult

    const featureResult = await Promise.resolve(
      featureFlagGuard(to, from, () => {})
    )
    if (featureResult !== true && featureResult !== undefined)
      return featureResult

    return true
  })

  // Redirect to errorRouteName on router errors
  router.onError((err, to) => {
    logger.error({ msg: 'Router error', err, to: to?.fullPath })
    void router.push({ name: options.errorRouteName })
  })
}
