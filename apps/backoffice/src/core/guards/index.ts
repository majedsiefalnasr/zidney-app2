/**
 * Guard pipeline barrel for Backoffice.
 * Registers all navigation guards in the correct pipeline order.
 *
 * Pipeline order:
 * 1. sessionInitialized gate (initSession once on first navigation)
 * 2. AuthGuard
 * 3. WorkspaceGuard
 * 4. RoleGuard
 * 5. FeatureFlagGuard
 *
 * OBS-02 fix: router.onError redirects to errorRouteName ('bo-error'), NOT unauthorizedRouteName.
 * OBS-04 fix: initSession() is wrapped in try/catch; on error, logs and sets sessionInitialized=true.
 *
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */
import { createLogger } from '@zidney/logger'
import type { Router } from 'vue-router'
import { createAuthGuard } from './auth.guard'
import { createFeatureFlagGuard } from './feature-flag.guard'
import { createRoleGuard } from './role.guard'
import { createWorkspaceGuard } from './workspace.guard'

const logger = createLogger('backoffice:guards')

// ─── Options Interface ────────────────────────────────────────────────────────

export interface RegisterGuardsOptions {
  /** Callback returning whether the user is authenticated */
  isAuthenticated: () => boolean
  /** Login route name. Backoffice: 'bo-login' */
  loginRouteName: string
  /** Dashboard route name. Backoffice: 'bo-dashboard' */
  dashboardRouteName: string
  /** Callback returning the user's role, or undefined if not authenticated */
  getUserRole: () => string | undefined
  /** Unauthorized route name. Backoffice: 'bo-unauthorized' */
  unauthorizedRouteName: string
  /** Error route name. Backoffice: 'bo-error' (OBS-02: used for router.onError redirect) */
  errorRouteName: string
  /** Optional session initializer. Called exactly once on first navigation. */
  initSession?: () => Promise<void>
  /** Backoffice: callback returning whether workspace context is resolved (contextStore.context !== null) */
  isWorkspaceResolved: () => boolean
  /** Workspace selector route name. Backoffice: 'bo-workspace-selector' */
  workspaceSelectorRouteName: string
}

// ─── registerGuards ───────────────────────────────────────────────────────────

/**
 * Registers all navigation guards on the given router instance.
 * Must be called after router creation and before app.mount().
 *
 * @param router - The Vue Router instance
 * @param options - Guard configuration options
 */
export function registerGuards(router: Router, options: RegisterGuardsOptions): void {
  let sessionInitialized = false

  const authGuard = createAuthGuard({
    isAuthenticated: options.isAuthenticated,
    loginRouteName: options.loginRouteName,
    dashboardRouteName: options.dashboardRouteName,
  })

  const workspaceGuard = createWorkspaceGuard({
    isWorkspaceResolved: options.isWorkspaceResolved,
    workspaceSelectorRouteName: options.workspaceSelectorRouteName,
  })

  const roleGuard = createRoleGuard({
    getUserRole: options.getUserRole,
    unauthorizedRouteName: options.unauthorizedRouteName,
  })

  const featureFlagGuard = createFeatureFlagGuard()

  router.beforeEach(async (to, from) => {
    // OBS-04: Wrap initSession in try/catch; always set sessionInitialized=true
    if (!sessionInitialized) {
      try {
        await options.initSession?.()
      } catch (err) {
        logger.error({ msg: 'Session init failed', err })
      } finally {
        sessionInitialized = true
      }
    }

    // Pipeline: AuthGuard → WorkspaceGuard → RoleGuard → FeatureFlagGuard
    const authResult = await Promise.resolve(authGuard(to, from, () => {}))
    if (authResult !== true && authResult !== undefined) return authResult

    const workspaceResult = await Promise.resolve(workspaceGuard(to, from, () => {}))
    if (workspaceResult !== true && workspaceResult !== undefined) return workspaceResult

    const roleResult = await Promise.resolve(roleGuard(to, from, () => {}))
    if (roleResult !== true && roleResult !== undefined) return roleResult

    const featureResult = await Promise.resolve(featureFlagGuard(to, from, () => {}))
    if (featureResult !== true && featureResult !== undefined) return featureResult

    return true
  })

  // OBS-02: Redirect to errorRouteName on router errors (NOT unauthorizedRouteName)
  router.onError((err, to) => {
    logger.error({ msg: 'Router error', err, to: to?.fullPath })
    void router.push({ name: options.errorRouteName })
  })
}
