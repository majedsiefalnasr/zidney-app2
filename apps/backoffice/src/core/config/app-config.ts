import type { ZidneyAppConfig } from '@zidney/types'
import { createEnvConfig, type EnvConfig } from './env'
import { createFeatureFlags, type FeatureFlags } from './feature-flags'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AppConfig extends ZidneyAppConfig {
  readonly env: EnvConfig
  readonly flags: FeatureFlags
}

// ─── Initialization ─────────────────────────────────────────────────────────

const envConfig = createEnvConfig()
const flags = createFeatureFlags()

/**
 * Frozen aggregate of environment config and feature flags.
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

export function isDev(): boolean {
  return envConfig.appEnv === 'development'
}

export function isProd(): boolean {
  return envConfig.appEnv === 'production'
}

export function isStaging(): boolean {
  return envConfig.appEnv === 'staging'
}

export function getApiBase(): string {
  return envConfig.apiBaseUrl
}

// ─── Re-exports ─────────────────────────────────────────────────────────────

export type { EnvConfig } from './env'
export type { FeatureFlags } from './feature-flags'
