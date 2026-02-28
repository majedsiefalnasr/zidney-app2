/**
 * Shared Environment Configuration Types
 *
 * Compile-time-only interfaces for cross-app consistency.
 * Zero runtime footprint — type-only exports.
 *
 * Each app (MMC, Backoffice, Frontoffice) implements these interfaces
 * independently in its own `core/config/` directory.
 */

/** Known application environment values */
export type AppEnvKnown = 'development' | 'staging' | 'production'

/**
 * Base environment configuration contract.
 *
 * All apps must implement this interface in their `EnvConfig`.
 * `appEnv` is typed as `string` to support the guardian correction:
 * unrecognized values are preserved (not defaulted to 'development'),
 * causing all mode helpers to return `false`.
 */
export interface ZidneyEnvConfig {
  readonly apiBaseUrl: string
  readonly appEnv: string
  readonly appName: string
  readonly debugMode: boolean
}

/**
 * Base feature flags contract.
 *
 * Feature flags control UI display behavior only.
 * They MUST NOT gate security, permission, or business logic.
 */
export interface ZidneyFeatureFlags {
  readonly enableDebugPanel: boolean
}

/**
 * Aggregate application configuration contract.
 *
 * Composed from `env` (environment config) and `flags` (feature flags).
 * Both sub-objects are independently frozen.
 */
export interface ZidneyAppConfig {
  readonly env: ZidneyEnvConfig
  readonly flags: ZidneyFeatureFlags
}
