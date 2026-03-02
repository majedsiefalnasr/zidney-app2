/**
 * FeatureFlagGuard stub for Frontoffice.
 * Reserves pipeline position 4 for future feature flag evaluation.
 * Always passes — no navigation is blocked.
 *
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */
import type { NavigationGuard } from 'vue-router'

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a feature flag guard NavigationGuard stub.
 * Always returns true — reserved for future flag evaluation.
 *
 * TODO(STAGE_UI_XX): Implement feature flag evaluation when feature flag service is ready.
 */
export function createFeatureFlagGuard(): NavigationGuard {
  // TODO(STAGE_UI_XX): Implement feature flag evaluation when feature flag service is ready.
  return (): boolean => {
    return true
  }
}
