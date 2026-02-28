# Contract: Environment Configuration Module API

**Branch**: `ui-05-env-configuration` | **Date**: 2026-02-28

---

## Overview

This contract defines the public API surface that all three Zidney frontend apps (MMC, Backoffice, Frontoffice) must implement for environment configuration.

Each app implements the contract independently. Conformance is enforced at compile time via shared TypeScript interfaces in `packages/types`.

---

## Shared TypeScript Interfaces

### `ZidneyEnvConfig`

```typescript
export interface ZidneyEnvConfig {
  readonly apiBaseUrl: string
  readonly appEnv: 'development' | 'staging' | 'production'
  readonly appName: string
  readonly debugMode: boolean
}
```

### `ZidneyFeatureFlags`

```typescript
export interface ZidneyFeatureFlags {
  readonly enableDebugPanel: boolean
}
```

### `ZidneyAppConfig`

```typescript
export interface ZidneyAppConfig {
  readonly env: ZidneyEnvConfig
  readonly flags: ZidneyFeatureFlags
}
```

---

## Required Exports from `core/config/env.ts`

| Export            | Signature                                       | Description                                                              |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| `createEnvConfig` | `(overrides?: Partial<EnvConfig>) => EnvConfig` | Factory. Reads `import.meta.env`, applies overrides, validates, freezes. |
| `EnvConfig`       | type                                            | App-specific interface extending `ZidneyEnvConfig`                       |

---

## Required Exports from `core/config/feature-flags.ts`

| Export               | Signature                          | Description                                               |
| -------------------- | ---------------------------------- | --------------------------------------------------------- |
| `createFeatureFlags` | `(env: EnvConfig) => FeatureFlags` | Factory. Reads flag vars, normalizes to boolean, freezes. |
| `FeatureFlags`       | type                               | App-specific interface extending `ZidneyFeatureFlags`     |

---

## Required Exports from `core/config/app-config.ts`

| Export         | Signature       | Description                                     |
| -------------- | --------------- | ----------------------------------------------- |
| `appConfig`    | `AppConfig`     | Frozen aggregate of `env` + `flags`. Singleton. |
| `isDev`        | `() => boolean` | `true` when `appEnv === 'development'`          |
| `isProd`       | `() => boolean` | `true` when `appEnv === 'production'`           |
| `isStaging`    | `() => boolean` | `true` when `appEnv === 'staging'`              |
| `getApiBase`   | `() => string`  | Returns `env.apiBaseUrl`                        |
| `featureFlags` | `FeatureFlags`  | Re-export of frozen feature flags.              |

---

## Behavioral Contract

### Initialization

- `createEnvConfig()` MUST be called synchronously at the top of `main.ts`, before `createApp()`
- Missing required variables MUST throw a synchronous `Error` with the variable name in the message
- The returned object MUST be frozen via `Object.freeze()`

### Immutability

- All exported config objects MUST be `Object.freeze()`-ed
- `appConfig`, `featureFlags`, and the underlying `envConfig` are all frozen
- Mutation attempts are silently ignored (standard `Object.freeze` behavior)

### Security

- Only `VITE_`-prefixed variables may be read (enforced by Vite convention)
- No config values logged in production mode
- No secrets may appear in env config (convention + code review)
- Config is never attached to `window` in production

### Testing

- `createEnvConfig(overrides)` accepts partial overrides for test injection
- `createFeatureFlags(envConfig)` accepts any `EnvConfig` (including test instances)
- Tests must NOT rely on `vi.stubEnv()` for the primary mock pattern — factory overrides are preferred

### Lint Enforcement

- `no-restricted-syntax` ESLint rule MUST target `import.meta.env` MemberExpression
- Rule MUST be configured in each app's `eslint.config.js`
- `core/config/env.ts` MUST be excluded from this rule

---

## App-Specific Extensions

### Backoffice

`BackofficeEnvConfig` extends `ZidneyEnvConfig` with:

```typescript
interface BackofficeEnvConfig extends ZidneyEnvConfig {
  readonly workspaceSlug?: string // development convenience only
}
```

### MMC & Frontoffice

No additional fields beyond the base `ZidneyEnvConfig`.

---

## Environment Variable Inventory

### Required (all apps)

| Variable            | Type     | Description                                              |
| ------------------- | -------- | -------------------------------------------------------- |
| `VITE_API_BASE_URL` | `string` | API server base URL                                      |
| `VITE_APP_ENV`      | `string` | Environment mode: `development`, `staging`, `production` |
| `VITE_APP_NAME`     | `string` | Application identifier                                   |

### Optional (all apps)

| Variable                  | Type     | Default   | Description               |
| ------------------------- | -------- | --------- | ------------------------- |
| `VITE_DEBUG_MODE`         | `string` | `"false"` | Enable debug behaviors    |
| `VITE_ENABLE_DEBUG_PANEL` | `string` | `"false"` | Feature flag: debug panel |

### Optional (Backoffice only)

| Variable              | Type     | Default     | Description                 |
| --------------------- | -------- | ----------- | --------------------------- |
| `VITE_WORKSPACE_SLUG` | `string` | `undefined` | Dev-only workspace override |
