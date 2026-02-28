import type { ZidneyFeatureFlags } from '@zidney/types'
import { parseBooleanFlag, readRawFeatureFlags } from './env'

// ─── Types ──────────────────────────────────────────────────────────────────

export type FeatureFlags = ZidneyFeatureFlags

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create an immutable feature flags object.
 *
 * GUARDIAN FIX: This function does NOT read `import.meta.env` directly.
 * All env reads go through `env.ts` via `readRawFeatureFlags()` (design decision D3).
 *
 * GUARDIAN FIX: Accepts and uses its `overrides` parameter for testability.
 *
 * @param overrides - Optional partial overrides for testing
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
