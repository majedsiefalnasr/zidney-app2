/**
 * WorkspaceGuard factory for Backoffice.
 * Blocks access to workspace-bound routes when no workspace context is resolved.
 *
 * INVARIANTS:
 * - MUST NOT call any API or read license status.
 * - Reads ONLY from isWorkspaceResolved() callback.
 * - WorkspaceGuard reads contextStore.context !== null (presence only).
 * - Only activates when to.meta.requiresWorkspace === true.
 * - Redirects to 'bo-workspace-selector' when workspace not resolved.
 * - On error: log via @zidney/logger, return true.
 *
 * Default route names (Backoffice):
 *   workspaceSelectorRouteName: 'bo-workspace-selector'
 *
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */
import { createLogger } from '@zidney/logger'
import type {
  NavigationGuard,
  RouteLocationNormalized,
  RouteLocationRaw,
} from 'vue-router'

const logger = createLogger('backoffice:workspace-guard')

// ─── Options Interface ────────────────────────────────────────────────────────

export interface WorkspaceGuardOptions {
  /**
   * Name of the workspace selector route.
   * Backoffice: 'bo-workspace-selector'
   */
  workspaceSelectorRouteName: string
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a workspace guard NavigationGuard.
 *
 * Maps to: () => contextStore.context !== null
 *
 * @param isWorkspaceResolved - Callback returning whether workspace context is resolved
 * @param options - App-specific route names
 */
export function createWorkspaceGuard(options: {
  isWorkspaceResolved: () => boolean
  workspaceSelectorRouteName: string
}): NavigationGuard {
  return (to: RouteLocationNormalized): RouteLocationRaw | boolean => {
    try {
      // Only activates for workspace-bound routes
      if (to.meta['requiresWorkspace'] !== true) return true

      // Loop prevention: if already navigating to selector, allow
      if (to.name === options.workspaceSelectorRouteName) return true

      const resolved = options.isWorkspaceResolved()

      if (!resolved) {
        logger.debug(
          'Workspace guard: workspace not resolved, redirecting to selector',
          {
            route: to.name?.toString() ?? to.path,
          }
        )
        return { name: options.workspaceSelectorRouteName }
      }

      return true
    } catch (err) {
      logger.error({ msg: 'Workspace guard error', err })
      return true
    }
  }
}
