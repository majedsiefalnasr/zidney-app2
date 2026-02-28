import type { ZidneyAppConfig } from '@zidney/types'
import { createEnvConfig, type EnvConfig } from './env'
import { createFeatureFlags, type FeatureFlags } from './feature-flags'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AppConfig extends ZidneyAppConfig {
  readonly env: EnvConfig
  readonly flags: FeatureFlags
}

// ─── Initialization ─────────────────────────────────────────────────────────

// Initialize synchronously — throws before mount if env is invalid
const envConfig = createEnvConfig()
const flags = createFeatureFlags()

/**
 * Frozen aggregate of environment config and feature flags.
 * Import this from anywhere in the app to access configuration.
 */
export const appConfig: AppConfig = Object.freeze({
  env: envConfig,
  flags,
})

/**
 * Standalone feature flags export (GUARDIAN FIX: per contract requirement).
 */
export const featureFlags: FeatureFlags = flags

// ─── Mode Helpers ───────────────────────────────────────────────────────────

/** Returns `true` when `appEnv === 'development'` */
export function isDev(): boolean {
  return envConfig.appEnv === 'development'
}

/** Returns `true` when `appEnv === 'production'` */
export function isProd(): boolean {
  return envConfig.appEnv === 'production'
}

/** Returns `true` when `appEnv === 'staging'` */
export function isStaging(): boolean {
  return envConfig.appEnv === 'staging'
}

/** Returns the API base URL */
export function getApiBase(): string {
  return envConfig.apiBaseUrl
}

// ─── Re-exports ─────────────────────────────────────────────────────────────

export { type EnvConfig } from './env'
export { type FeatureFlags } from './feature-flags'
