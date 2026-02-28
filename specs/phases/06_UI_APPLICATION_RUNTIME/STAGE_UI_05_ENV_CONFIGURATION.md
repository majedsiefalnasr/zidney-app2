# STAGE_UI_05_ENV_CONFIGURATION

## Stage Type

UI Foundation — Environment & Runtime Configuration Layer

---

## Stage Status

Status: PRODUCTION READY
Risk Level: LOW
Closure Date: 2026-02-28

Scope Closed:

- Centralized env config via createEnvConfig() factory in each app
- API base URL resolution per app via getApiBase()
- Mode helpers (isDev, isProd, isStaging) in app-config.ts
- Feature flags module (read-only, frozen) via createFeatureFlags()
- ESLint no-restricted-syntax rule for import.meta.env isolation
- Shared TypeScript interfaces in packages/types/src/env-config.ts
- Backoffice extension with optional workspaceSlug
- 105 unit tests across 12 test files
- 54 / 54 tasks completed

Deferred Scope:

- None

Constitutional Compliance:

- ADR-0001 Database-per-tenant isolation enforced (N/A — frontend-only)
- ADR-0006 Server-authoritative time enforced (N/A — no time ops)
- ADR-0007 Version compatibility enforced (N/A — no schema changes)
- ADR-0008 Semantic versioning enforced (N/A — no version bumps)
- Import boundaries enforced (apps/_ → packages/_ only)
- Feature flags scoped to UI display only
- No secrets exposure, no console.log in production path

Notes:
Stage is production ready. No structural backend modifications allowed.
Modifications require a new migration stage.

Notes:
Backend implementation complete. No structural backend modifications allowed.

---

## Purpose

Define the standardized environment configuration strategy for all Zidney frontend applications:

- MMC
- Backoffice
- Frontoffice

This stage establishes:

- Centralized environment variable access
- API base URL resolution
- Workspace-aware base resolution (Backoffice)
- Build-time vs runtime configuration boundaries
- Feature flag injection model (read-only)
- Secure exposure policy (no secret leakage)

No component may access import.meta.env or process.env directly after this stage.

---

## Constitutional Constraints

Environment layer must:

- Never expose secrets to browser runtime
- Never embed database credentials
- Never embed private API keys
- Never bypass backend authority
- Never compute license logic
- Never infer tenant isolation rules

Frontend config is read-only and non-sensitive.

---

## Architectural Design

### Single Configuration Entry Point

All environment access must pass through:

```
core/config/env.ts
```

No direct usage of:

- import.meta.env
- process.env
- window.**ENV** (unless formally defined)

Components and modules must import from env.ts only.

---

## Folder Structure

```
core/
  config/
    env.ts
    app-config.ts
    feature-flags.ts
```

No environment logic allowed inside modules/.

---

## Environment Variable Policy

Only variables prefixed with:

```
VITE_
```

may be exposed to frontend (Vite convention).

Examples:

- VITE_API_BASE_URL
- VITE_APP_NAME
- VITE_APP_ENV
- VITE_ENABLE_DEBUG

No secret tokens allowed.

---

## API Base Resolution

env.ts must resolve:

```
getApiBase(): string
```

Behavior:

MMC:

- Uses VITE_API_BASE_URL directly

Backoffice:

- May derive workspace prefix from:
  - subdomain
  - path segment
- Must not compute workspace ID manually
- Must rely on backend-issued context

Frontoffice:

- Uses runtime API base
- No workspace manipulation in frontend

---

## Environment Modes

Must support:

- development
- staging
- production

Expose helper:

```
isDev()
isProd()
isStaging()
```

No string comparisons scattered across codebase.

---

## Feature Flags

Feature flags must:

- Be read-only
- Defined in feature-flags.ts
- Sourced from VITE\_ variables
- Never control security logic
- Never replace backend enforcement

Feature flags allowed only for:

- UI experiments
- UI toggles
- Non-security display behavior

No role/permission logic via feature flags.

---

## Security Rules

Environment layer must ensure:

- No console logging of config in production
- No secret leakage via window object
- No dynamic evaluation of config
- No runtime modification of config
- No merging of user input into config

Configuration is immutable at runtime.

---

## Testability Requirements

Must support:

- Mocked env injection for tests
- Mode simulation (dev/staging/prod)
- Feature flag toggling in unit tests
- API base override in test environment

env.ts must not rely on global window during unit tests.

---

## Multi-App Consistency

All three apps must:

- Use identical env.ts contract
- Share feature-flags.ts pattern
- Follow same naming conventions
- Avoid duplicating environment helpers

App-specific differences handled via:

- Separate .env files
- Not via code branching

---

## Explicit Non-Goals

This stage does NOT:

- Implement API client logic
- Implement auth logic
- Implement router guards
- Implement workspace resolution logic
- Implement business feature toggles

Only environment plumbing.

---

## Completion Criteria

Stage considered complete when:

- env.ts implemented
- No direct import.meta.env usage in codebase
- API base resolution working
- Feature flag helper implemented
- Mode helpers implemented
- No secret leakage
- Unit tests can mock environment
- CI passes lint + TypeScript
- No TODO placeholders in config layer

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
