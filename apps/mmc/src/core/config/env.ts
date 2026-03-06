import type { ZidneyEnvConfig } from '@zidney/types'

// ─── Types ──────────────────────────────────────────────────────────────────

export type EnvConfig = ZidneyEnvConfig

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normalize VITE_APP_ENV to a known value or preserve the raw string.
 *
 * GUARDIAN FIX: Unrecognized values are NOT defaulted to 'development'.
 * Instead, the raw value is returned so mode helpers (`isDev`, `isProd`,
 * `isStaging`) all return `false` for unrecognized environments.
 */
export function normalizeAppEnv(value: string | undefined): string {
  const v = (value ?? '').trim().toLowerCase()
  if (v === 'staging') return 'staging'
  if (v === 'production') return 'production'
  if (v === 'development') return 'development'
  // Unrecognized → return raw value (or empty string) so all mode helpers return false
  return v || 'development'
}

/**
 * Boolean flag parser for VITE_ string env vars.
 * 'true', '1', 'yes' → true; everything else → false.
 */
export function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) return false
  return ['true', '1', 'yes'].includes(value.toLowerCase())
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create an immutable environment configuration.
 *
 * - Production: called once with no args from `app-config.ts`
 * - Tests: called with overrides for isolated, deterministic testing
 *
 * @throws {Error} if VITE_API_BASE_URL is missing (unless overridden)
 */
export function createEnvConfig(overrides?: Partial<EnvConfig>): EnvConfig {
  const raw = {
    apiBaseUrl: (import.meta.env as any)['VITE_API_BASE_URL'] as string | undefined,
    appEnv: (import.meta.env as any)['VITE_APP_ENV'] as string | undefined,
    appName: (import.meta.env as any)['VITE_APP_NAME'] as string | undefined,
    debugMode: (import.meta.env as any)['VITE_DEBUG_MODE'] as string | undefined,
  }

  const merged: EnvConfig = {
    apiBaseUrl: overrides?.apiBaseUrl ?? raw.apiBaseUrl ?? '',
    appEnv: overrides?.appEnv ?? normalizeAppEnv(raw.appEnv),
    appName: overrides?.appName ?? raw.appName ?? 'mmc',
    debugMode: overrides?.debugMode ?? parseBooleanFlag(raw.debugMode),
  }

  if (!merged.apiBaseUrl) {
    throw new Error('[env] Missing required variable: VITE_API_BASE_URL')
  }

  return Object.freeze(merged)
}

/**
 * Read raw feature flag values from import.meta.env.
 * Only env.ts is allowed to touch import.meta.env (design decision D3).
 */
export function readRawFeatureFlags(): {
  enableDebugPanel: string | undefined
} {
  return {
    enableDebugPanel: (import.meta.env as any)['VITE_ENABLE_DEBUG_PANEL'] as string | undefined,
  }
}
