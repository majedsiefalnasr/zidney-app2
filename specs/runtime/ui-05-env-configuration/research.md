# Research: ENV Configuration

**Branch**: `ui-05-env-configuration` | **Date**: 2026-02-28

---

## Research Task 1: Factory Function Pattern for Environment Configuration

**Context**: The spec requires `createEnvConfig(overrides?)` — a factory function pattern that supports testability. The current codebase uses `resolveConfig()` + module-level `appConfig` singleton.

**Decision**: Adopt named factory function `createEnvConfig(overrides?)` that:

- Reads from `import.meta.env` by default
- Accepts optional partial overrides for testing
- Returns a frozen `EnvConfig` object
- Replaces the current `resolveConfig()` pattern

**Rationale**:

- Factory enables test isolation without `vi.stubEnv()` or `vi.resetModules()`
- `Object.freeze()` on the returned object satisfies FR-015 (immutability)
- Single call in `main.ts` with no overrides for production; callers pass mocks in tests
- Pattern is idiomatic TypeScript — no DI framework required

**Alternatives considered**:

- **vi.stubEnv pattern** (current): Requires `vi.resetModules()` and dynamic `import()` in every test. Fragile and couples tests to Vitest internals.
- **Dependency injection via Vue provide/inject**: Over-engineered for static config. Would require Vue context in tests.
- **Module-level mocking via `vi.mock()`**: Possible but less explicit. Factory gives callers full control.

---

## Research Task 2: ESLint Rule to Prohibit Direct `import.meta.env`

**Context**: FR-002 requires lint enforcement to prevent `import.meta.env` outside `core/config/env.ts`. Current ESLint configs already have an `import/no-restricted-paths` zone attempting this but the zone-based approach has limitations for intra-file token matching.

**Decision**: Use `no-restricted-syntax` ESLint rule with AST selector targeting `MemberExpression` on `import.meta.env`. This is more precise than path-based restrictions.

**Implementation**:

```javascript
'no-restricted-syntax': [
  'error',
  {
    selector: "MemberExpression[object.type='MetaProperty'][object.meta.name='import'][object.property.name='meta'][property.name='env']",
    message: 'Direct import.meta.env access is forbidden. Use appConfig from @/core/config/env instead.'
  }
]
```

Applied to all files **except** `core/config/env.ts` via ESLint file-level overrides.

**Rationale**:

- AST-based selector catches all usages at parse time, not path inference
- Works with flat ESLint config (`eslint.config.js`)
- Can be combined with existing `import/no-restricted-paths` for redundant safety
- Zero additional dependencies

**Alternatives considered**:

- **eslint-plugin-no-restricted-globals**: Doesn't cover `import.meta` patterns
- **Path-based restriction only**: Current approach. Glob patterns for intra-file tokens are unreliable.
- **Custom ESLint plugin**: Over-engineered for a single rule

---

## Research Task 3: Feature Flags Module Design

**Context**: FR-005/FR-006 require a read-only feature flags module sourced from `VITE_` prefixed env vars. Flags must be boolean, frozen, and limited to UI display behavior.

**Decision**: Implement `core/config/feature-flags.ts` that:

- Exports `createFeatureFlags(env: EnvConfig)` factory
- Normalizes string values (`"true"`, `"1"`, `"yes"` → `true`; everything else → `false`)
- Returns `Object.freeze()`-ed record
- Typed as `Readonly<Record<string, boolean>>`

**Rationale**:

- Separate file from `env.ts` keeps concerns separated (infrastructure vs. feature toggles)
- Factory receives already-validated env config — no duplicate `import.meta.env` access
- Normalization handles edge case of `"1"`, `"yes"` values
- Freeze ensures FR-006 (runtime immutability)

**Alternatives considered**:

- **Inline in env.ts**: Would bloat the env module and conflate concerns
- **Proxy-based immutability**: Adds complexity; `Object.freeze()` is browser-native and sufficient
- **Map-based instead of object**: Less ergonomic; object access `flags.debugPanel` is cleaner

---

## Research Task 4: Shared TypeScript Interface Location

**Context**: FR-012 requires a shared TypeScript interface for multi-app consistency. The spec explicitly states "no shared runtime package" — each app implements independently.

**Decision**: Place the shared interface in `packages/types/src/env-config.ts` and export from the package index. Each app imports the type (type-only import) and implements it. This is a **compile-time-only** dependency.

**Rationale**:

- `packages/types` is the existing shared types package — this is the natural home
- Type-only imports add zero runtime bytes
- TypeScript compiler enforces conformance at build time
- Follows existing import boundary rules: `apps/* → packages/*` is allowed
- No shared runtime code — only shared type definitions

**Alternatives considered**:

- **Duplicated interfaces per app**: Drift risk. No compiler enforcement across apps.
- **Documentation-only contract**: No automated enforcement. Relies on code review.
- **Shared runtime package**: Explicitly excluded by spec. Each app has its own Vite pipeline.

---

## Research Task 5: Vite Environment Variable Loading & Precedence

**Context**: The spec mentions Vite's standard `.env` file precedence. Need to confirm behavior.

**Decision**: Rely on Vite's built-in `.env` loading. No custom merging logic.

**Findings**:
Vite loads env files in this order (later wins):

1. `.env` — always loaded
2. `.env.local` — always loaded, gitignored
3. `.env.[mode]` — loaded for specified mode (development, staging, production)
4. `.env.[mode].local` — loaded for specified mode, gitignored

For staging mode: Vite needs `--mode staging` CLI flag. The `VITE_APP_ENV` variable is a custom application-level variable, separate from Vite's `MODE`.

**Rationale**:

- No custom env loading. Vite handles precedence.
- `VITE_APP_ENV` is the application's own concept (maps to `development | staging | production`)
- Vite's `MODE` is used for file loading; `VITE_APP_ENV` is what the app reads for mode helpers

**Alternatives considered**:

- **dotenv manual loading**: Unnecessary; Vite handles this
- **Custom merge logic**: Spec explicitly forbids this (Edge Cases section)

---

## Research Task 6: `app-config.ts` Aggregation Module

**Context**: FR-014 requires an aggregation module that combines env config + feature flags into a single typed object.

**Decision**: Implement `core/config/app-config.ts` as the public API surface. This module:

- Calls `createEnvConfig()`
- Calls `createFeatureFlags(envConfig)`
- Exports `appConfig` (frozen aggregate) and `featureFlags` (frozen flags)
- Re-exports mode helpers (`isDev`, `isProd`, `isStaging`)
- Is the **only** module other files import from

**Rationale**:

- Single import for consumers: `import { appConfig, isDev } from '@/core/config/app-config'`
- Keeps `env.ts` focused on raw env parsing and validation
- Keeps `feature-flags.ts` focused on flag normalization
- `app-config.ts` acts as the composition root for configuration

**Alternatives considered**:

- **Everything in env.ts**: Monolithic. Hard to test individual concerns.
- **Barrel re-export via index.ts**: Adds another file. `app-config.ts` is already the aggregator.

---

## Research Task 7: Build-Time Validation of Required Variables

**Context**: FR-010 requires startup failure on missing required vars. Edge cases mention build-time failure too.

**Decision**: Two-layer validation:

1. **Runtime (synchronous in main.ts)**: `createEnvConfig()` throws if `VITE_API_BASE_URL` is missing or empty. This is the primary enforcement.
2. **Build-time (.env.example documentation)**: Each app maintains `.env.example` documenting required variables. CI can validate presence via script.

No Vite plugin or custom build validation — the runtime throw in `main.ts` catches misconfiguration before any Vue code runs.

**Rationale**:

- Runtime check is guaranteed to fire in every environment
- Build-time validation is documentation + CI script, not code
- Vite doesn't error on missing `VITE_` vars by default — they're just `undefined`
- Custom Vite plugins add complexity with minimal value given the runtime check

**Alternatives considered**:

- **Vite plugin for env validation**: Over-engineered. Runtime check is sufficient.
- **TypeScript type narrowing only**: Types don't exist at runtime. Missing vars would still be `undefined`.
