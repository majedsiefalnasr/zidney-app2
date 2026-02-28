# Data Model: ENV Configuration

**Branch**: `ui-05-env-configuration` | **Date**: 2026-02-28

---

## Overview

This stage has no database entities. All entities are TypeScript-only compile-time and runtime types representing immutable configuration objects.

---

## Entity: EnvConfig

The core environment configuration object. One instance per app lifetime. Frozen at initialization.

### Fields

| Field        | Type                                         | Required | Default         | Source                       |
| ------------ | -------------------------------------------- | -------- | --------------- | ---------------------------- |
| `apiBaseUrl` | `string`                                     | Yes      | —               | `VITE_API_BASE_URL`          |
| `appEnv`     | `'development' \| 'staging' \| 'production'` | Yes      | `'development'` | `VITE_APP_ENV` / Vite `MODE` |
| `appName`    | `string`                                     | Yes      | —               | `VITE_APP_NAME`              |
| `debugMode`  | `boolean`                                    | No       | `false`         | `VITE_DEBUG_MODE`            |

### Validation Rules

- `apiBaseUrl` MUST be a non-empty string. Missing/empty → synchronous throw before mount.
- `appEnv` MUST be one of the three allowed values. Unrecognized value → defaults to `'development'`.
- `appName` is informational. Defaults to app identifier if missing (e.g., `'mmc'`, `'backoffice'`, `'frontoffice'`).
- `debugMode` normalized from string: `"true"` → `true`, all else → `false`.

### Immutability

`Object.freeze()` applied. No runtime mutation possible.

---

## Entity: EnvConfig (Backoffice Extension)

Backoffice extends the base config with optional workspace-scoped fields for development convenience.

### Additional Fields

| Field           | Type                  | Required | Default     | Source                |
| --------------- | --------------------- | -------- | ----------- | --------------------- |
| `workspaceSlug` | `string \| undefined` | No       | `undefined` | `VITE_WORKSPACE_SLUG` |

### Notes

- `workspaceSlug` is a development-only convenience (local dev against a specific workspace).
- In production, workspace context is derived from route/backend — never from env vars.

---

## Entity: FeatureFlags

Read-only boolean flag registry. Frozen at initialization.

### Fields

| Field              | Type      | Required | Default | Source                    |
| ------------------ | --------- | -------- | ------- | ------------------------- |
| `enableDebugPanel` | `boolean` | No       | `false` | `VITE_ENABLE_DEBUG_PANEL` |

### Validation Rules

- All flags default to `false` if the source variable is missing.
- String normalization: `"true"`, `"1"`, `"yes"` → `true`. All other values → `false`.
- Flags MUST NOT gate security, permission, or business logic.
- Flags control UI display behavior only.

### Immutability

`Object.freeze()` applied. Mutation attempts silently ignored.

### Extension Contract

New flags are added by:

1. Adding `VITE_` prefixed variable to `.env` / `.env.example`
2. Adding field to `FeatureFlags` interface
3. Reading and normalizing in `createFeatureFlags()`

---

## Entity: AppConfig (Aggregate)

Composite configuration exposed as the public API. This is what application code imports.

### Fields

| Field   | Type           | Source                 |
| ------- | -------------- | ---------------------- |
| `env`   | `EnvConfig`    | `createEnvConfig()`    |
| `flags` | `FeatureFlags` | `createFeatureFlags()` |

### Computed Properties (Mode Helpers)

| Helper         | Type      | Logic                          |
| -------------- | --------- | ------------------------------ |
| `isDev()`      | `boolean` | `env.appEnv === 'development'` |
| `isProd()`     | `boolean` | `env.appEnv === 'production'`  |
| `isStaging()`  | `boolean` | `env.appEnv === 'staging'`     |
| `getApiBase()` | `string`  | Returns `env.apiBaseUrl`       |

### Notes

- Mode helpers are standalone exported functions, not methods on the config object.
- `getApiBase()` is a function (not a property) to allow future resolution logic without breaking callers.
- All helpers are pure functions of the frozen `env` object.

---

## Shared TypeScript Interface

Located in `packages/types/src/env-config.ts`.

### Interface: `ZidneyEnvConfig`

```typescript
export interface ZidneyEnvConfig {
  readonly apiBaseUrl: string
  readonly appEnv: 'development' | 'staging' | 'production'
  readonly appName: string
  readonly debugMode: boolean
}
```

### Interface: `ZidneyFeatureFlags`

```typescript
export interface ZidneyFeatureFlags {
  readonly enableDebugPanel: boolean
}
```

### Interface: `ZidneyAppConfig`

```typescript
export interface ZidneyAppConfig {
  readonly env: ZidneyEnvConfig
  readonly flags: ZidneyFeatureFlags
}
```

### Notes

- These are **type-only exports** — zero runtime footprint
- Each app imports via `import type { ZidneyEnvConfig } from '@zidney/types'`
- Apps implement the interface; TypeScript compiler enforces conformance
- Additional app-specific fields (like Backoffice `workspaceSlug`) extend the base interface locally

---

## State Transitions

None. Configuration is immutable after initialization. There are no state machines or lifecycle transitions.

## Relationships

```
ZidneyAppConfig
├── env: ZidneyEnvConfig (1:1)
└── flags: ZidneyFeatureFlags (1:1)
```

No database relationships. No foreign keys. No persistence.
