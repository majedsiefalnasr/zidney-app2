# STAGE_UI_00_RUNTIME_ARCHITECTURE

## Stage Type

UI Foundation — Cross-Application Runtime Blueprint

---

## Stage Status

Status: DRAFT
Risk Level: LOW
Last Updated: 2026-02-28T00:35:00Z

Scope Planned:

- Full canonical `src/` scaffold for MMC (delta), Backoffice (fresh), Frontoffice (fresh)
- API client with `credentials: 'include'`, single-flight refresh, typed queue, factory + singleton
- Vue Router guard pipeline: `auth → role → workspace` (workspace Backoffice-only)
- Pinia added to all 3 apps + typed stores
- Auth module skeleton (`core/auth/`) in all 3 apps
- Error normalizer sealed at 3 fields
- Env config with startup validation
- ESLint import boundary rules as concrete deliverable
- MMC delta migration: 28 files mapped to canonical targets
- `@/` alias added to all 3 `tsconfig.json` files

Deferred Scope:

- `AttemptGuard` implementation (deferred to Exam Runtime stage)
- Full authentication UI flow (deferred to Stage UI-01)
- Feature modules and business pages (out of scope)

Constitutional Compliance:

- Technical plan compliant — task generation authorized

Notes:
Technical plan complete. Task breakdown in progress.

---

## Purpose

Define the canonical SPA runtime architecture shared across:

- MMC (Platform Admin App)
- Backoffice (Tenant Admin App)
- Frontoffice (Student Runtime App)

This stage establishes:

- Folder structure standards
- Layer boundaries
- Runtime responsibilities
- Cross-app consistency rules
- Enforcement constraints

No feature implementation occurs in this stage.

---

## Architectural Principles

### Single Responsibility Per Layer

Frontend layers must be strictly separated:

- UI Layer → Components, Views, Layouts
- Application Layer → State, orchestration, guards
- Infrastructure Layer → API client, storage, environment
- Auth Layer → Token handling + session lifecycle
- Error Layer → Global error normalization

No cross-layer leakage allowed.

---

### No Business Logic in UI

Frontend must NOT:

- Calculate license limits
- Validate subscription eligibility
- Perform grading logic
- Enforce tenant isolation
- Trust client-side time

All business rules remain server-authoritative.

---

### Centralized API Boundary

All HTTP communication must pass through:

```
/src/core/api/client.ts
```

Rules:

- No direct fetch() or axios calls inside components
- Interceptors must attach auth tokens centrally
- Errors normalized before reaching UI
- Idempotency headers added only through client layer

---

### Deterministic Folder Structure (Per App)

Each frontend app (mmc / backoffice / frontoffice) must follow:

```
src/
  main.ts
  App.vue

  core/
    api/
    auth/
    router/
    guards/
    state/
    config/
    errors/

  modules/
    <feature-name>/
      components/
      views/
      routes.ts
      types.ts
      api.ts

  shared/
    components/
    composables/
    utils/
```

No deviation allowed.

---

## Runtime Security Model

### Token Storage Strategy

- Access tokens → memory (preferred)
- Refresh tokens → httpOnly cookie (backend-controlled)
- No localStorage token persistence unless explicitly justified

### Token Lifecycle

- Attach access token via API client interceptor
- Auto-refresh on 401 (single-flight refresh strategy)
- Logout clears memory + triggers backend invalidation

---

## Router Architecture

Single router per app:

```
core/router/index.ts
```

Guards pipeline:

1. AuthGuard
2. RoleGuard
3. WorkspaceGuard (Backoffice only)
4. FeatureFlagGuard (optional future)

No inline guard logic inside views.

---

## State Management Strategy

Pinia required (strict mode).

Rules:

- One store per domain
- No API calls inside components
- Stores call services, not HTTP directly
- No cross-store direct mutation
- Typed store interfaces mandatory

---

## Environment Configuration

Environment config must be centralized:

```
core/config/env.ts
```

Responsibilities:

- API base URL resolution
- Build-time flags
- Feature flags (read-only)
- Debug toggles

No process.env usage inside components.

---

## Global Error Handling

Central error normalization layer:

```
core/errors/error-normalizer.ts
```

Must convert backend errors to:

```
{
  code: string
  message: string
  httpStatus: number
}
```

UI must not depend on raw backend structure.

---

## Cross-App Reuse Policy

Shared logic belongs in:

```
packages/ui-system
```

NOT inside individual apps.

Apps may not duplicate:

- Layout logic
- Pagination helpers
- Filter builders
- Notification systems

---

## Testability Requirements

This stage must enable:

- API client unit testing
- Store unit testing
- Guard integration testing
- Token refresh simulation testing
- Error normalization testing

No tightly coupled global state allowed.

---

## Explicit Non-Goals

This stage does NOT:

- Implement login UI
- Implement business pages
- Implement dashboard views
- Implement product tables
- Implement exam UI
- Implement affiliate flows

Only architecture.

---

## Dependencies

Consumes:

- STAGE_03_AUTHENTICATION_SYSTEM
- STAGE_09_PRODUCTS
- STAGE_10_LICENSES
- STAGE_11_LICENSE_LIFECYCLE
- STAGE_13_AFFILIATES

But does not modify backend.

---

## Completion Criteria

Stage considered complete when:

- Folder structure scaffolded in all 3 apps
- API client abstraction implemented
- Router initialized
- Pinia installed and configured
- Auth module skeleton present
- Global error handler wired
- App boots without console errors
- CI passes lint + TypeScript
- No TODO placeholders in runtime layer

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
