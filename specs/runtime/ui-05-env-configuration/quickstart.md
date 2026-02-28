# Quickstart: ENV Configuration

**Branch**: `ui-05-env-configuration` | **Date**: 2026-02-28

---

## What This Stage Does

Establishes a standardized, immutable environment configuration system across all three Zidney frontend apps (MMC, Backoffice, Frontoffice). After this stage:

- All environment variable access goes through `core/config/env.ts`
- Mode helpers (`isDev`, `isProd`, `isStaging`) replace scattered string comparisons
- Feature flags are read-only and frozen
- A lint rule prevents direct `import.meta.env` usage
- Tests use a factory function instead of `vi.stubEnv()`

---

## Files Created / Modified Per App

Each app (MMC, Backoffice, Frontoffice) gets these files:

```
src/core/config/
├── env.ts              # MODIFIED: createEnvConfig(overrides?) factory
├── app-config.ts       # NEW: aggregates env + flags, exports public API
└── feature-flags.ts    # NEW: read-only boolean flags from VITE_ vars
```

Shared types (compile-time only):

```
packages/types/src/
└── env-config.ts       # NEW: ZidneyEnvConfig, ZidneyFeatureFlags, ZidneyAppConfig interfaces
```

---

## Usage

### Importing Configuration

```typescript
// In any component or service:
import { appConfig, isDev, isProd, getApiBase } from '@/core/config/app-config'

// Access values
const baseUrl = getApiBase()
const env = appConfig.env.appEnv

// Conditional debug behavior
if (isDev()) {
  // development-only tooling
}

// Feature flags
if (appConfig.flags.enableDebugPanel) {
  // render debug panel
}
```

### In Tests

```typescript
import { createEnvConfig } from '@/core/config/env'

const testConfig = createEnvConfig({
  apiBaseUrl: 'http://test.local',
  appEnv: 'development',
})

// testConfig is a full EnvConfig object with defaults + overrides
```

---

## Forbidden Patterns

```typescript
// FORBIDDEN — will fail lint:
const url = import.meta.env.VITE_API_BASE_URL

// CORRECT:
import { getApiBase } from '@/core/config/app-config'
const url = getApiBase()
```

---

## Adding a New Environment Variable

1. Add `VITE_NEW_VAR=value` to `.env` and `.env.example`
2. Add field to `EnvConfig` interface in `env.ts`
3. Read it inside `createEnvConfig()`
4. If it's a feature flag, add it to `feature-flags.ts` instead
5. Update shared interface in `packages/types/src/env-config.ts` if applicable
