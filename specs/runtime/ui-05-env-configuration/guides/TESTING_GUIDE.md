# Testing Guide — ENV Configuration

**Stage:** ENV Configuration **Phase:** 06_UI_APPLICATION_RUNTIME **Stage Directory:**
ui-05-env-configuration **Generated On:** 2026-02-28

---

## Purpose

This guide explains how to validate the environment configuration implementation across all 3 Zidney
frontend apps (MMC, Backoffice, Frontoffice).

---

## Summary of Delivered Behavior

Each frontend app now has a centralized, immutable configuration layer that:

- Reads all environment variables through a single factory function (`createEnvConfig`)
- Exposes feature flags through a separate factory (`createFeatureFlags`)
- Aggregates both into a frozen `appConfig` object with mode helpers
- Enforces `import.meta.env` isolation via ESLint — only `env.ts` may touch it

Key outcomes:

- All environment access is centralized in `core/config/env.ts` per app
- Configuration is immutable — `Object.freeze` prevents runtime mutation
- Missing `VITE_API_BASE_URL` throws before app mounts (fail-fast)
- Unrecognized `VITE_APP_ENV` values cause all mode helpers to return `false`
- Tests use factory overrides instead of mocking `import.meta.env`

---

## Prerequisites

| Requirement                | Validation Command / Check                                 |
| -------------------------- | ---------------------------------------------------------- |
| Bun installed              | `bun --version` (v1+)                                      |
| Dependencies installed     | `bun install`                                              |
| Correct branch checked out | `git branch` includes `ui-05-env-configuration`            |
| `.env` files present       | Each app needs `.env` or `.env.local` (see `.env.example`) |

---

## Files in Scope

```text
# Shared Types
packages/types/src/env-config.ts          # ZidneyEnvConfig, ZidneyFeatureFlags, ZidneyAppConfig
packages/types/src/index.ts               # Re-exports

# MMC
apps/mmc/src/core/config/env.ts           # createEnvConfig, normalizeAppEnv, readRawFeatureFlags
apps/mmc/src/core/config/feature-flags.ts # createFeatureFlags
apps/mmc/src/core/config/app-config.ts    # appConfig, featureFlags, isDev, isProd, isStaging, getApiBase
apps/mmc/src/vite-env.d.ts                # ImportMetaEnv augmentation
apps/mmc/eslint.config.js                 # no-restricted-syntax rule
apps/mmc/.env.example                     # Template
apps/mmc/src/main.ts                      # Imports from app-config
apps/mmc/src/core/api/client.ts           # Imports from app-config

# Backoffice (extends with workspaceSlug)
apps/backoffice/src/core/config/env.ts
apps/backoffice/src/core/config/feature-flags.ts
apps/backoffice/src/core/config/app-config.ts
apps/backoffice/src/vite-env.d.ts
apps/backoffice/eslint.config.js
apps/backoffice/.env.example
apps/backoffice/src/main.ts
apps/backoffice/src/core/api/client.ts

# Frontoffice
apps/frontoffice/src/core/config/env.ts
apps/frontoffice/src/core/config/feature-flags.ts
apps/frontoffice/src/core/config/app-config.ts
apps/frontoffice/src/vite-env.d.ts
apps/frontoffice/eslint.config.js
apps/frontoffice/.env.example
apps/frontoffice/src/main.ts
apps/frontoffice/src/core/api/client.ts

# Tests (12 files)
apps/mmc/tests/unit/core/{env-config,feature-flags,app-config,app-boot}.test.ts
apps/backoffice/tests/unit/core/{env-config,feature-flags,app-config,app-boot}.test.ts
apps/frontoffice/tests/unit/core/{env-config,feature-flags,app-config,app-boot}.test.ts
```

---

## Local Run Commands

```bash
# Install dependencies
bun install

# Start MMC dev server
cd apps/mmc && bun run dev

# Start Backoffice dev server
cd apps/backoffice && bun run dev

# Start Frontoffice dev server
cd apps/frontoffice && bun run dev
```

---

## Automated Validation Commands

```bash
# Run all env config unit tests (MMC)
bunx vitest run apps/mmc/tests/unit/core/env-config.test.ts \
  apps/mmc/tests/unit/core/feature-flags.test.ts \
  apps/mmc/tests/unit/core/app-config.test.ts \
  apps/mmc/tests/unit/core/app-boot.test.ts

# Run all env config unit tests (Backoffice)
bunx vitest run apps/backoffice/tests/unit/core/env-config.test.ts \
  apps/backoffice/tests/unit/core/feature-flags.test.ts \
  apps/backoffice/tests/unit/core/app-config.test.ts \
  apps/backoffice/tests/unit/core/app-boot.test.ts

# Run all env config unit tests (Frontoffice)
bunx vitest run apps/frontoffice/tests/unit/core/env-config.test.ts \
  apps/frontoffice/tests/unit/core/feature-flags.test.ts \
  apps/frontoffice/tests/unit/core/app-config.test.ts \
  apps/frontoffice/tests/unit/core/app-boot.test.ts

# Lint (verify import.meta.env isolation rule)
bun run lint

# TypeScript type-check
bun run typecheck
```

Expected outcome: 105 tests pass, 0 lint errors, 0 new typecheck errors.

---

## Manual Test Scenarios

### Scenario 1 — App Starts Successfully with Valid Environment

**Purpose:** Verify the app boots with all required env vars set.

1. Copy `.env.example` to `.env` in any app directory (e.g., `apps/mmc/`)
2. Set `VITE_API_BASE_URL=http://localhost:3000/api`
3. Set `VITE_APP_ENV=development`
4. Run `bun run dev` in that app directory
5. Open the browser — app should load without errors

Expected: App mounts successfully. No console errors about missing environment variables.

Troubleshooting: If the app fails to start, check that `VITE_API_BASE_URL` is set in `.env`. The
config layer throws `[env] Missing required variable: VITE_API_BASE_URL` if it's missing.

### Scenario 2 — App Fails Fast Without VITE_API_BASE_URL

**Purpose:** Verify fail-fast behavior when the required API base URL is missing.

1. Remove or comment out `VITE_API_BASE_URL` from `.env`
2. Run `bun run dev`
3. Open the browser console

Expected: An error is thrown: `[env] Missing required variable: VITE_API_BASE_URL`. The app does not
mount.

Troubleshooting: If the app mounts anyway, check that `createEnvConfig()` is being called before
`createApp()` in `main.ts`.

### Scenario 3 — Unrecognized VITE_APP_ENV Value (Edge Case)

**Purpose:** Verify that unrecognized environment values don't silently default to development.

1. Set `VITE_APP_ENV=custom-env` in `.env`
2. Run `bun run dev`
3. In the browser console, check: `isDev()` → `false`, `isProd()` → `false`, `isStaging()` → `false`

Expected: All three mode helpers return `false` for unrecognized values. The value `custom-env` is
preserved in `appConfig.env.appEnv`.

### Scenario 4 — Feature Flag Toggle

**Purpose:** Verify feature flags are readable and immutable.

1. Set `VITE_ENABLE_DEBUG_PANEL=true` in `.env`
2. Run `bun run dev`
3. Verify `appConfig.flags.enableDebugPanel === true`
4. Try to mutate: `appConfig.flags.enableDebugPanel = false` → should throw in strict mode or
   silently fail

Expected: Feature flag reads correctly. Mutation is prevented by `Object.freeze`.

### Scenario 5 — Backoffice workspaceSlug Extension

**Purpose:** Verify Backoffice-specific env config extension.

1. Set `VITE_WORKSPACE_SLUG=test-workspace` in `apps/backoffice/.env`
2. Run `bun run dev` in `apps/backoffice/`
3. Verify `appConfig.env.workspaceSlug === 'test-workspace'`

Expected: The optional `workspaceSlug` field is available in Backoffice config but not in MMC or
Frontoffice.

---

## Negative Cases

| Scenario                                     | Trigger                                             | Expected Response                                           |
| -------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| Missing VITE_API_BASE_URL                    | Remove from .env                                    | `Error: [env] Missing required variable: VITE_API_BASE_URL` |
| Attempt to mutate appConfig                  | `appConfig.env.apiBaseUrl = 'x'`                    | TypeError (Object.freeze)                                   |
| Attempt to mutate featureFlags               | `featureFlags.enableDebugPanel = false`             | TypeError (Object.freeze)                                   |
| Direct import.meta.env access outside env.ts | Add `import.meta.env.VITE_*` in any non-env.ts file | ESLint error: `no-restricted-syntax`                        |

---

## ESLint Import.meta.env Isolation Verification

This is a critical enforcement point. Verify it works:

```bash
# Temporarily add import.meta.env access in a non-env.ts file
echo "const x = import.meta.env.VITE_API_BASE_URL;" >> apps/mmc/src/main.ts

# Run lint — should produce an error
bun run lint -- apps/mmc/src/main.ts

# Clean up
git checkout apps/mmc/src/main.ts
```

Expected: ESLint reports a `no-restricted-syntax` error for `import.meta.env` usage.

---

## Sign-Off Checklist

- [ ] All 105 automated tests pass
- [ ] Manual scenarios 1-5 pass
- [ ] Negative cases return correct errors
- [ ] ESLint blocks `import.meta.env` outside `env.ts`
- [ ] No `console.log` in config modules
- [ ] Config objects are immutable (Object.freeze verified)
- [ ] Backoffice extends with `workspaceSlug` correctly
- [ ] All 3 apps use consistent pattern

---

## References

- `specs/runtime/ui-05-env-configuration/reports/IMPLEMENT_REPORT.md`
- `specs/runtime/ui-05-env-configuration/reports/PLAN_REPORT.md`
- `specs/runtime/ui-05-env-configuration/audits/VALIDATION_REPORT.md`
- `specs/runtime/ui-05-env-configuration/spec.md`
- `specs/runtime/ui-05-env-configuration/plan.md`

---

Generated by Zidney Orchestrator Hard Mode v1.2.0.
