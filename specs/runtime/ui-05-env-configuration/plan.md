# Implementation Plan: ENV Configuration

**Branch**: `ui-05-env-configuration` | **Date**: 2026-02-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/runtime/ui-05-env-configuration/spec.md`

---

## Summary

Establish a standardized, immutable environment configuration strategy across all three Zidney frontend apps (MMC, Backoffice, Frontoffice). The implementation replaces the existing `resolveConfig()` pattern with a factory function (`createEnvConfig(overrides?)`) that supports testability, adds feature flags and mode helpers, enforces `import.meta.env` prohibition via lint rules, and shares a TypeScript interface contract via `packages/types` for compile-time consistency across apps.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Vue 3, Vite 6.x, ESLint (flat config)
**Storage**: N/A (no database entities — pure frontend configuration)
**Testing**: Vitest + jsdom
**Target Platform**: Browser (Chrome, Firefox, Safari, Edge — all modern)
**Project Type**: Frontend web applications (3 Vue SPA apps)
**Performance Goals**: N/A (configuration is synchronous, one-time initialization)
**Constraints**: Configuration must be synchronous, frozen, and initialized before `createApp().mount()`
**Scale/Scope**: 3 apps, ~6 files per app modified/created, 1 shared types file

---

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| #   | Gate                                 | Status | Notes                                                                  |
| --- | ------------------------------------ | ------ | ---------------------------------------------------------------------- |
| 1   | **No business logic in UI**          | PASS   | Env config is infrastructure. No domain logic.                         |
| 2   | **No DB imports in UI**              | PASS   | No database access. Pure config module.                                |
| 3   | **No secrets in frontend**           | PASS   | Only `VITE_`-prefixed non-sensitive vars. FR-007/FR-009 enforce.       |
| 4   | **No cross-app imports**             | PASS   | Each app implements independently. Shared types are type-only.         |
| 5   | **Import boundary: apps → packages** | PASS   | `packages/types` provides type-only exports. No runtime dependency.    |
| 6   | **Import boundary: packages ↛ apps** | PASS   | `packages/types` has no knowledge of apps.                             |
| 7   | **shadcn-vue / Tailwind rules**      | N/A    | No UI components in this stage.                                        |
| 8   | **No console.log in production**     | PASS   | FR-008 explicitly forbids console logging in production.               |
| 9   | **Structured logging**               | N/A    | Frontend config layer. No log calls.                                   |
| 10  | **No tenant isolation violation**    | PASS   | No cross-tenant logic. Workspace slug is development-only convenience. |
| 11  | **Stage lifecycle respected**        | PASS   | Stage status is DRAFT — planning authorized.                           |

**Post-Design Re-check**: All gates remain PASS. The design introduces no new violations. Shared types in `packages/types` are type-only exports (zero runtime) — no import boundary violation.

---

## Project Structure

### Documentation (this feature)

```text
specs/runtime/ui-05-env-configuration/
├── plan.md              # This file
├── research.md          # Phase 0 output — all unknowns resolved
├── data-model.md        # Phase 1 output — TypeScript entity definitions
├── quickstart.md        # Phase 1 output — developer usage guide
├── contracts/
│   └── env-module-api.md  # Phase 1 output — public API contract
└── spec.md              # Input specification
```

### Source Code (repository root)

```text
# Shared types (compile-time only)
packages/types/src/
├── env-config.ts                    # NEW: ZidneyEnvConfig, ZidneyFeatureFlags, ZidneyAppConfig
└── index.ts                         # MODIFIED: re-export env-config types

# Per-app structure (repeated for mmc, backoffice, frontoffice)
apps/{app}/src/core/config/
├── env.ts                           # MODIFIED: createEnvConfig(overrides?) factory
├── app-config.ts                    # NEW: aggregate config + mode helpers + public API
└── feature-flags.ts                 # NEW: read-only feature flags

apps/{app}/
├── eslint.config.js                 # MODIFIED: add no-restricted-syntax rule
├── .env.example                     # NEW or MODIFIED: document all VITE_ vars
└── src/vite-env.d.ts                # MODIFIED: add ImportMetaEnv interface

# Tests
apps/{app}/tests/unit/core/
├── env-config.test.ts               # MODIFIED: rewrite for factory pattern
├── feature-flags.test.ts            # NEW: feature flags tests
└── app-config.test.ts               # NEW: aggregate + mode helper tests
```

**Structure Decision**: Per-app implementation with shared type-only contract. Each app owns its `core/config/` directory. No shared runtime package. `packages/types` provides compile-time interfaces only.

---

## Complexity Tracking

No constitution violations requiring justification. The design is minimal:

- No new packages
- No new dependencies
- No cross-app runtime coupling
- No database entities

---

## Design Decisions

### D1: Factory Function Pattern (from research.md)

**Current state**: `resolveConfig()` is called at module scope, creating `appConfig` singleton. Tests use `vi.stubEnv()` + `vi.resetModules()` + dynamic `import()`.

**New pattern**: `createEnvConfig(overrides?)` factory.

- Production: called once in `main.ts` with no args → frozen result stored as module-level `appConfig`
- Tests: called with `{ apiBaseUrl: 'http://test.local', appEnv: 'development' }` → testable instance

**Migration**: The existing `resolveConfig()` function in each app becomes `createEnvConfig()`. The module-level `appConfig` singleton is preserved but now computed via the factory. Existing call sites that import `appConfig` continue to work unchanged.

### D2: Lint Rule — `no-restricted-syntax` (from research.md)

Each app's `eslint.config.js` gets:

```javascript
// For all files EXCEPT core/config/env.ts
{
  files: ['**/*.ts', '**/*.vue'],
  ignores: ['src/core/config/env.ts'],
  rules: {
    'no-restricted-syntax': ['error', {
      selector: "MemberExpression[object.type='MetaProperty'][object.meta.name='import'][object.property.name='meta'][property.name='env']",
      message: 'Direct import.meta.env access is forbidden. Use appConfig from @/core/config/app-config instead.'
    }]
  }
}
```

This catches `import.meta.env` and `import.meta.env.VITE_*` patterns via AST selector. The existing `import/no-restricted-paths` zones are preserved for redundancy.

### D3: Module Dependency Graph

```
main.ts
  └── imports @/core/config/app-config.ts (side-effect: validates + freezes)
        ├── imports ./env.ts → createEnvConfig()
        └── imports ./feature-flags.ts → createFeatureFlags(envConfig)

All other modules:
  └── import { appConfig, isDev, getApiBase } from '@/core/config/app-config'
```

Only `env.ts` touches `import.meta.env`. `feature-flags.ts` receives parsed env config. `app-config.ts` composes both.

### D4: Backoffice Extension

Backoffice's `env.ts` extends the base interface:

```typescript
interface BackofficeEnvConfig extends ZidneyEnvConfig {
  readonly workspaceSlug?: string
}
```

The `createEnvConfig()` in Backoffice reads `VITE_WORKSPACE_SLUG` additionally. This is a development-only convenience — in production, workspace context comes from the route/backend.

### D5: Feature Flag Normalization

```typescript
function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) return false
  return ['true', '1', 'yes'].includes(value.toLowerCase())
}
```

This handles the edge case from the spec: non-standard truthy strings.

### D6: `ImportMetaEnv` Type Augmentation

Each app's `vite-env.d.ts` is augmented with:

```typescript
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_ENV: string
  readonly VITE_APP_NAME: string
  readonly VITE_DEBUG_MODE?: string
  readonly VITE_ENABLE_DEBUG_PANEL?: string
}
```

This gives TypeScript awareness of available `import.meta.env` keys inside `env.ts`.

---

## Implementation Sequence

### Phase 1: Shared Types

1. Create `packages/types/src/env-config.ts` with `ZidneyEnvConfig`, `ZidneyFeatureFlags`, `ZidneyAppConfig` interfaces
2. Export from `packages/types/src/index.ts`

### Phase 2: MMC (Reference Implementation)

1. Update `vite-env.d.ts` — add `ImportMetaEnv` interface
2. Refactor `env.ts` — replace `resolveConfig()` with `createEnvConfig(overrides?)`
3. Create `feature-flags.ts` — `createFeatureFlags()` factory
4. Create `app-config.ts` — aggregate, mode helpers, public API
5. Update `main.ts` — import from `app-config` instead of `env`
6. Update `eslint.config.js` — add `no-restricted-syntax` rule
7. Create/update `.env.example`
8. Rewrite `env-config.test.ts` — factory pattern tests
9. Create `feature-flags.test.ts`
10. Create `app-config.test.ts`

### Phase 3: Backoffice (Extension Pattern)

Same as MMC, plus:

- `BackofficeEnvConfig` extending `ZidneyEnvConfig` with `workspaceSlug`
- `createEnvConfig()` reads `VITE_WORKSPACE_SLUG`

### Phase 4: Frontoffice

Same as MMC — no extensions needed.

### Phase 5: Cross-App Validation

1. Verify all three apps export the same public API surface
2. Run ESLint across all apps — no `import.meta.env` outside `env.ts`
3. Run TypeScript compiler — all apps satisfy `ZidneyEnvConfig` interface
4. Run all unit tests

---

## File-Level Specifications

### `packages/types/src/env-config.ts`

```typescript
// Type-only exports — zero runtime footprint
export interface ZidneyEnvConfig {
  readonly apiBaseUrl: string
  readonly appEnv: 'development' | 'staging' | 'production'
  readonly appName: string
  readonly debugMode: boolean
}

export interface ZidneyFeatureFlags {
  readonly enableDebugPanel: boolean
}

export interface ZidneyAppConfig {
  readonly env: ZidneyEnvConfig
  readonly flags: ZidneyFeatureFlags
}
```

### `core/config/env.ts` (MMC / Frontoffice variant)

```typescript
import type { ZidneyEnvConfig } from '@zidney/types'

export interface EnvConfig extends ZidneyEnvConfig {}

export function createEnvConfig(overrides?: Partial<EnvConfig>): EnvConfig {
  const raw = {
    apiBaseUrl: import.meta.env['VITE_API_BASE_URL'] as string | undefined,
    appEnv: import.meta.env['VITE_APP_ENV'] as string | undefined,
    appName: import.meta.env['VITE_APP_NAME'] as string | undefined,
    debugMode: import.meta.env['VITE_DEBUG_MODE'] as string | undefined,
  }

  const merged = {
    apiBaseUrl: overrides?.apiBaseUrl ?? raw.apiBaseUrl ?? '',
    appEnv: normalizeAppEnv(overrides?.appEnv ?? raw.appEnv),
    appName: overrides?.appName ?? raw.appName ?? 'mmc', // default per app
    debugMode: overrides?.debugMode ?? raw.debugMode === 'true',
  }

  if (!merged.apiBaseUrl) {
    throw new Error('[env] Missing required variable: VITE_API_BASE_URL')
  }

  return Object.freeze(merged)
}

function normalizeAppEnv(value: string | undefined): EnvConfig['appEnv'] {
  if (value === 'staging') return 'staging'
  if (value === 'production') return 'production'
  return 'development'
}
```

### `core/config/feature-flags.ts`

```typescript
import type { ZidneyFeatureFlags } from '@zidney/types'
import type { EnvConfig } from './env'

export interface FeatureFlags extends ZidneyFeatureFlags {}

export function createFeatureFlags(_env?: EnvConfig): FeatureFlags {
  return Object.freeze({
    enableDebugPanel: parseBooleanFlag(
      import.meta.env['VITE_ENABLE_DEBUG_PANEL'] as string | undefined
    ),
  })
}

function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) return false
  return ['true', '1', 'yes'].includes(value.toLowerCase())
}
```

### `core/config/app-config.ts`

```typescript
import type { ZidneyAppConfig } from '@zidney/types'
import { createEnvConfig, type EnvConfig } from './env'
import { createFeatureFlags, type FeatureFlags } from './feature-flags'

export interface AppConfig extends ZidneyAppConfig {
  readonly env: EnvConfig
  readonly flags: FeatureFlags
}

// Initialize synchronously — throws before mount if invalid
const envConfig = createEnvConfig()
const flags = createFeatureFlags(envConfig)

export const appConfig: AppConfig = Object.freeze({
  env: envConfig,
  flags,
})

// Mode helpers
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

// Re-export for convenience
export { type EnvConfig } from './env'
export { type FeatureFlags } from './feature-flags'
```

### `main.ts` Changes

```typescript
// Step 1: Validate environment config at import time — throws early if misconfigured
import '@/core/config/app-config'
// (replaces: import '@/core/config/env')
```

---

## Test Strategy

### Unit Tests: `env-config.test.ts` (per app)

| Test                                                      | Description |
| --------------------------------------------------------- | ----------- |
| Factory returns valid config with all vars set            | Happy path  |
| Factory throws on missing `VITE_API_BASE_URL`             | FR-010      |
| Factory normalizes `appEnv` to valid values               | FR-004      |
| Factory defaults unrecognized `appEnv` to `'development'` | Edge case   |
| Factory applies overrides for testing                     | FR-011      |
| Returned config is frozen                                 | FR-015      |
| Mutation attempt has no effect                            | FR-015      |

### Unit Tests: `feature-flags.test.ts` (per app)

| Test                           | Description             |
| ------------------------------ | ----------------------- |
| Parses `"true"` → `true`       | FR-005                  |
| Parses `"1"` → `true`          | Edge case normalization |
| Parses `"yes"` → `true`        | Edge case normalization |
| Parses `"false"` → `false`     | FR-005                  |
| Parses `undefined` → `false`   | Missing var default     |
| Returned flags are frozen      | FR-006                  |
| Mutation attempt has no effect | FR-006                  |

### Unit Tests: `app-config.test.ts` (per app)

| Test                                                  | Description |
| ----------------------------------------------------- | ----------- |
| `isDev()` returns `true` in development               | FR-004      |
| `isProd()` returns `true` in production               | FR-004      |
| `isStaging()` returns `true` in staging               | FR-004      |
| All mode helpers return `false` for unrecognized mode | Edge case   |
| `getApiBase()` returns `apiBaseUrl`                   | FR-003      |
| `appConfig` is frozen                                 | FR-015      |
| `appConfig.env` is frozen                             | FR-015      |
| `appConfig.flags` is frozen                           | FR-006      |

### Lint Tests

| Test                                               | Description      |
| -------------------------------------------------- | ---------------- |
| `import.meta.env` in a component file → lint error | FR-002           |
| `import.meta.env` in `env.ts` → no lint error      | FR-002 exception |

---

## Migration Notes

### Breaking Changes

- `resolveConfig()` renamed to `createEnvConfig()` — internal to `core/config/`, no external callers expected
- `appConfig` import path changes from `@/core/config/env` to `@/core/config/app-config` — all existing call sites must be updated
- `appConfig.buildEnv` renamed to `appConfig.env.appEnv` — existing consumers must update
- `appConfig.debugMode` moves to `appConfig.env.debugMode` — single-level access changes to nested

### Backwards Compatibility

- Module-level `appConfig` export preserved (different source module)
- Throw-on-missing-env behavior preserved
- `VITE_API_BASE_URL` and `VITE_DEBUG_MODE` variables remain the same

### Migration Checklist Per App

1. Update all `import { appConfig } from '@/core/config/env'` → `import { appConfig } from '@/core/config/app-config'`
2. Update `appConfig.apiBaseUrl` → `appConfig.env.apiBaseUrl` or `getApiBase()`
3. Update `appConfig.buildEnv` → `appConfig.env.appEnv`
4. Update `appConfig.debugMode` → `appConfig.env.debugMode`
5. Update test files to use factory pattern
6. Verify lint passes with new rule

---

## Risk Assessment

| Risk                                            | Likelihood | Impact | Mitigation                                         |
| ----------------------------------------------- | ---------- | ------ | -------------------------------------------------- |
| Existing code references `import.meta.env`      | High       | Low    | Lint rule catches all violations at CI             |
| Migration of `appConfig` import paths           | Medium     | Low    | Search-and-replace. Small codebase per app.        |
| Backoffice `workspaceSlug` misuse in production | Low        | Medium | Code review + documentation. Var is optional.      |
| Feature flag used for security gating           | Low        | High   | Code review enforcement. Lint cannot catch intent. |

---

## Generated Artifacts

| Artifact     | Path                                                       | Status   |
| ------------ | ---------------------------------------------------------- | -------- |
| Research     | [research.md](research.md)                                 | Complete |
| Data Model   | [data-model.md](data-model.md)                             | Complete |
| Quickstart   | [quickstart.md](quickstart.md)                             | Complete |
| API Contract | [contracts/env-module-api.md](contracts/env-module-api.md) | Complete |
| Plan         | [plan.md](plan.md) (this file)                             | Complete |
