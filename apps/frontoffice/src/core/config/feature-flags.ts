import type { ZidneyFeatureFlags } from '@zidney/types'
import { parseBooleanFlag, readRawFeatureFlags } from './env'

// ─── Types ──────────────────────────────────────────────────────────────────

export type FeatureFlags = ZidneyFeatureFlags

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create an immutable feature flags object for Frontoffice.
 *
 * GUARDIAN FIX: Does NOT read `import.meta.env` directly.
 * Accepts and uses `overrides` parameter for testability.
 */
export function createFeatureFlags(
  overrides?: Partial<FeatureFlags>
): FeatureFlags {
  const raw = readRawFeatureFlags()

  return Object.freeze({
    enableDebugPanel:
      overrides?.enableDebugPanel ?? parseBooleanFlag(raw.enableDebugPanel),
  })
}
