# STAGE_UI_03_ROUTER_AND_GUARDS — Feature Specification

**Phase**: 06_UI_APPLICATION_RUNTIME **Stage**: STAGE_UI_03_ROUTER_AND_GUARDS **Stage File**:
specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_03_ROUTER_AND_GUARDS.md **Spec Status**: READY
**Created**: 2026-03-02 **Constitutional Compliance**: Zidney Constitution v1.2.0

---

## Feature Overview

This stage establishes the canonical routing system and guard pipeline across all three Zidney
frontend applications: **MMC** (Platform Admin), **Backoffice** (Tenant Admin), and **Frontoffice**
(Student Runtime).

It delivers:

- A standardized `RouteMeta` TypeScript interface used consistently across all three apps
- A deterministic guard execution pipeline: AuthGuard → WorkspaceGuard → RoleGuard →
  FeatureFlagGuard (future)
- App-specific router initialization (`core/router/index.ts`) using Vue Router 4 history mode
- Modular route definition structure (`modules/<feature>/routes.ts`)
- WorkspaceGuard (Backoffice-only) for workspace context resolution
- RoleGuard for UI-level navigation gating (non-authoritative — backend is still final authority)
- 404, Unauthorized, and GlobalError fallback views in every app
- Redirect-save strategy (save intended route before login, restore after)
- Migration of Backoffice from the current inline-guard approach (STAGE_17) to the canonical guard
  pipeline
- Migration and alignment of the existing MMC and Frontoffice RouteMeta schema (from STAGE_UI_01) to
  the canonical schema defined in this stage

### What this stage does NOT deliver

- Business-level page implementations (dashboards, product views, affiliate pages)
- License enforcement (license middleware is backend-only)
- JWT decoding or permission inference
- Subscription validation
- Any database access
- Backend RBAC duplication

---

## Constitutional Compliance Declaration

| Constraint                                | Status    | Detail                                                   |
| ----------------------------------------- | --------- | -------------------------------------------------------- |
| No cross-tenant access                    | CONFIRMED | Router is frontend-only; no DB access                    |
| No middleware bypass                      | CONFIRMED | No backend middleware involved                           |
| No license enforcement in router          | CONFIRMED | Guards MUST NOT check license state                      |
| No JWT decoding in guards                 | CONFIRMED | Guards read `AuthStore.isAuthenticated` only             |
| No grading outside worker                 | CONFIRMED | N/A for this stage                                       |
| No direct DB instantiation                | CONFIRMED | N/A for this stage                                       |
| No backend RBAC duplication               | CONFIRMED | RoleGuard is UI-hint only; backend remains authoritative |
| No permission inference from route params | CONFIRMED | Guards read meta flags only                              |
| No hardcoded workspace identifiers        | CONFIRMED | Workspace slug comes from WorkspaceStore/context         |
| No weakening of snapshot integrity        | CONFIRMED | N/A for this stage                                       |

> **Violation classification**: Any guard that reads JWT, calls an API, checks license status, or
> infers backend state from route params is an architectural violation and must be rejected in code
> review.

---

## Isolation Impact Analysis

- **Database accessed**: None (frontend-only stage)
- **Tenant resolution**: Not performed at router layer; WorkspaceGuard reads from WorkspaceStore
  which is pre-populated by the bootstrap sequence
- **Connection pool**: Not applicable
- **Resolver middleware**: Not applicable
- **New tables introduced**: None

---

## User Stories

### US1 — Authenticated Route Protection (All Apps)

**As a** user navigating to a protected route while unauthenticated, **I want** the application to
redirect me to the login page (preserving my intended URL), **So that** I can authenticate and be
sent directly to where I was trying to go.

**Acceptance Criteria**:

- AC1.1: Navigating to any route with `meta.requiresAuth = true` while not authenticated redirects
  to the app's login route
- AC1.2: The intended route is preserved as `?redirect=<intended-path>` in the login URL
- AC1.3: After successful login, the user is redirected to the preserved route
- AC1.4: If no redirect param exists after login, the user is sent to the default dashboard
- AC1.5: The guard MUST NOT decode the JWT to check authentication — it reads
  `AuthStore.isAuthenticated` only
- AC1.6: Navigation to the login route itself while already authenticated redirects to the dashboard
  (no loop)

---

### US2 — Guest-Only Route Protection (All Apps)

**As an** authenticated user navigating to a login page or public-only route, **I want** the
application to redirect me to the dashboard instead of showing the login form, **So that** I am not
presented with a login screen when already signed in.

**Acceptance Criteria**:

- AC2.1: Navigating to any route with `meta.public = true` while authenticated redirects to the
  dashboard
- AC2.2: The redirect goes to the app-specific dashboard route name
- AC2.3: No infinite loop occurs when the dashboard itself is reached

---

### US3 — Workspace Context Guard (Backoffice Only)

**As a** user accessing the Backoffice application, **I want** the router to verify that a workspace
context is available before granting access to any workspace-bound route, **So that** I am never
presented with a workspace-specific page without a resolved tenant context.

**Acceptance Criteria**:

- AC3.1: Any route with `meta.requiresWorkspace = true` in Backoffice triggers WorkspaceGuard
- AC3.2: If workspace context is NOT resolved (WorkspaceStore has no workspace), user is redirected
  to the workspace selector page
- AC3.3: WorkspaceGuard does NOT validate license status
- AC3.4: WorkspaceGuard does NOT make any API calls
- AC3.5: WorkspaceGuard reads workspace presence from a Pinia store (read-only)
- AC3.6: WorkspaceGuard only runs after AuthGuard passes (pipeline order enforced)
- AC3.7: MMC and Frontoffice do NOT have WorkspaceGuard registered

---

### US4 — Role-Based UI Navigation Gating (All Apps)

**As a** user with a role that does not match a route's allowed roles, **I want** the router to
redirect me to an Unauthorized page rather than allowing me to land on an inaccessible view, **So
that** the UI does not render views that the backend would reject anyway.

**Acceptance Criteria**:

- AC4.1: If `meta.roles` is defined and the current user's role is not in the list, the user is
  redirected to the unauthorized route
- AC4.2: The RoleGuard only runs after AuthGuard (and WorkspaceGuard in Backoffice) pass
- AC4.3: If `meta.roles` is not defined, RoleGuard MUST pass without any redirect
- AC4.4: Role is read from `AuthStore.user.role` — never derived from JWT
- AC4.5: This guard is explicitly non-authoritative: backend must independently validate permissions

---

### US5 — 404 Navigation Fallback (All Apps)

**As a** user navigating to an undefined route, **I want** the application to display a proper Not
Found page instead of a blank screen, **So that** the user experience is clear and consistent.

**Acceptance Criteria**:

- AC5.1: Any undefined route resolves to the `NotFoundView` component
- AC5.2: The 404 route uses a catch-all pattern `/:pathMatch(.*)*`
- AC5.3: The 404 route has `meta.public = true` (no auth required)
- AC5.4: No blank screen is ever rendered for unknown routes

---

### US6 — Unauthorized Navigation Fallback (All Apps)

**As a** user redirected by RoleGuard due to insufficient role, **I want** to see a clear
Unauthorized page, **So that** I understand why I cannot access the requested area.

**Acceptance Criteria**:

- AC6.1: Each app has an `/unauthorized` route rendering `UnauthorizedView`
- AC6.2: The UnauthorizedView is publicly accessible (no auth required to render it)
- AC6.3: UnauthorizedView provides a link back to the dashboard or home

---

### US7 — Modular Route Registration (All Apps)

**As a** developer adding a new feature module, **I want** to register routes in a dedicated
`modules/<feature>/routes.ts` file, **So that** routes are organized, discoverable, and never inline
within components.

**Acceptance Criteria**:

- AC7.1: Each feature module exports its routes from `modules/<feature>/routes.ts`
- AC7.2: The app-level `core/router/index.ts` imports and aggregates all module route arrays
- AC7.3: No inline `<router-link>` route objects defined inside `.vue` components
- AC7.4: All routes define a `meta` object with at minimum `requiresAuth` or `public`

---

### US8 — Route Meta Schema Standardization (All Apps)

**As a** developer working across MMC, Backoffice, and Frontoffice, **I want** a single canonical
`RouteMeta` TypeScript interface shared across all apps, **So that** guard logic and route
definitions are consistent and type-safe everywhere.

**Acceptance Criteria**:

- AC8.1: All three apps extend Vue Router's `RouteMeta` interface with the canonical schema fields:
  `requiresAuth`, `public`, `roles`, `requiresWorkspace`
- AC8.2: The legacy `guestOnly` field (from STAGE_UI_01) is replaced by `public` — `guestOnly` is
  removed from all three apps
- AC8.3: The legacy `requiredRole: string` field (from STAGE_UI_01) is replaced by `roles: string[]`
  — `requiredRole` is removed from all three apps
- AC8.4: TypeScript compilation passes with strict mode enabled
- AC8.5: All existing routes that used `guestOnly` are migrated to `public: true`
- AC8.6: All existing routes that used `requiredRole` are migrated to `roles: [...]`

---

### US9 — Logout Redirect Behavior (All Apps)

**As a** user who logs out, **I want** to be immediately redirected to the login page with no saved
redirect state, **So that** my session is cleanly terminated and I start fresh on next login.

**Acceptance Criteria**:

- AC9.1: After logout, the router always navigates to the app's login route
- AC9.2: Any saved redirect query param is cleared on logout
- AC9.3: No stale destination route is persisted after logout

---

### US10 — Router Testability (All Apps)

**As a** developer writing guard tests, **I want** to instantiate the router in a test environment
and inject mock auth/workspace state, **So that** all guard behaviors can be unit tested without
running a full browser or server.

**Acceptance Criteria**:

- AC10.1: `createAppRouter()` factory function is exported from each app's `core/router/index.ts`
  and returns a fresh router instance per call
- AC10.2: Guards are implemented as pure factory functions (e.g.,
  `createAuthGuard(getIsAuthenticated, options)`) allowing dependency injection
- AC10.3: Guards do NOT import stores directly — they receive auth state via injected callback or
  composable
- AC10.4: Guard unit tests can simulate: authenticated state, unauthenticated state, role mismatch,
  workspace missing, undefined routes
- AC10.5: Router can be instantiated in `jsdom` test environment without DOM errors

---

## Scope

### In Scope

- Canonical `RouteMeta` interface for all three apps (with migration from STAGE_UI_01 schema)
- `core/router/index.ts` (factory + instance) for MMC, Backoffice, Frontoffice
- `core/router/types.ts` (RouteMeta augmentation) for all three apps
- `core/guards/auth.guard.ts` for all three apps
- `core/guards/workspace.guard.ts` for Backoffice only
- `core/guards/role.guard.ts` for all three apps
- `core/guards/feature-flag.guard.ts` placeholder (not implemented — future stub only)
- Guard registration in `main.ts` (each app)
- `shared/views/NotFoundView.vue` (all three apps — if not already present)
- `shared/views/UnauthorizedView.vue` (all three apps)
- Modular route structure enforcement (`modules/<feature>/routes.ts`)
- Backoffice router refactoring: migrate from STAGE_17 inline-guard pattern to canonical guard
  pipeline
- Redirect-save strategy for login/logout
- Unit tests for each guard (all scenarios)

### Out of Scope

- Business page content (dashboard views, product pages, affiliate views)
- License enforcement (backend-only concern)
- JWT refresh logic (handled by STAGE_UI_01 auth module)
- API calls within guards
- FeatureFlagGuard implementation (future stage — stub only)
- Multi-factor authentication flows
- Subscription enforcement
- Any database access
- Server-side rendering (SSR)

---

## Functional Requirements

### FR-01 — Router Initialization

**FR-01.1**: Each app must export a `createAppRouter()` factory from `core/router/index.ts` that
returns a new `Router` instance configured with `createWebHistory()`.

**FR-01.2**: Guards must NOT be registered in `core/router/index.ts`. Guards are registered by the
caller (`main.ts`) after the router is created. This respects the app bootstrap sequence
(Constraint: CL-01 from STAGE_UI_01).

**FR-01.3**: Only one router instance is allowed per app. No multiple concurrent instances.

**FR-01.4**: The backoffice router must be migrated from `src/router/index.ts` to
`src/core/router/index.ts` to align with the canonical directory structure used by MMC and
Frontoffice.

---

### FR-02 — Route Meta Schema

**FR-02.1**: All three apps must augment the Vue Router `RouteMeta` interface with:

```typescript
declare module "vue-router" {
  interface RouteMeta {
    /** When true: route requires authentication; unauthenticated users are redirected to login */
    requiresAuth?: boolean;
    /** When true: route is publicly accessible; authenticated users are redirected to dashboard */
    public?: boolean;
    /** When defined: RoleGuard checks that user.role is in this list */
    roles?: string[];
    /** When true (Backoffice only): WorkspaceGuard validates workspace context is resolved */
    requiresWorkspace?: boolean;
  }
}
```

**FR-02.2**: Legacy fields `guestOnly` and `requiredRole` (from STAGE_UI_01) must be removed from
all RouteMeta augmentations.

**FR-02.3**: Route meta fields are not mutually exclusive: a route marked `requiresAuth: true` and
`roles: ['admin']` will trigger both AuthGuard and RoleGuard.

**FR-02.4**: Every route must define either `requiresAuth: true` or `public: true`. Omitting both is
treated as "private but not redirecting" — this is an ambiguous state and must be avoided. Linting
or TypeScript should warn developers.

---

### FR-03 — Guard Pipeline

**FR-03.1**: Guards must be registered as `beforeEach` hooks in this exact order:

1. `AuthGuard`
2. `WorkspaceGuard` (Backoffice only)
3. `RoleGuard`
4. `FeatureFlagGuard` (future placeholder — registered but immediately passes through)

**FR-03.2**: If AuthGuard redirects, subsequent guards must NOT execute for that navigation.

**FR-03.3**: Each guard must return a `RouteLocationRaw` to redirect, or `true` to continue. Guards
must never call `router.push()` internally and must never `throw`.

**FR-03.4**: Guards must be pure factory functions accepting injectable dependencies.

---

### FR-04 — AuthGuard

**FR-04.1**: If `to.meta.requiresAuth === true` and `isAuthenticated() === false`: redirect to login
route with `?redirect=<to.fullPath>`.

**FR-04.2**: If `to.meta.public === true` and `isAuthenticated() === true`: redirect to dashboard
route.

**FR-04.3**: If the target route IS the login route and user is unauthenticated, pass through
without redirect (defense against infinite loop when `requiresAuth` is accidentally set on login).

**FR-04.4**: The `isAuthenticated` callback is injected at registration time — never imported from a
store directly inside the guard factory.

**FR-04.5**: AuthGuard must NOT read JWT, decode token claims, or infer roles.

**FR-04.6**: App-specific route names are injected via options:

- MMC: `loginRouteName: 'mmc-login'`, `dashboardRouteName: 'mmc-dashboard'`
- Backoffice: `loginRouteName: 'bo-login'`, `dashboardRouteName: 'bo-dashboard'`
- Frontoffice: `loginRouteName: 'fo-login'`, `dashboardRouteName: 'fo-home'`

---

### FR-05 — WorkspaceGuard (Backoffice Only)

**FR-05.1**: WorkspaceGuard only activates if `to.meta.requiresWorkspace === true`.

**FR-05.2**: WorkspaceGuard reads a boolean `isWorkspaceResolved()` callback (injected). If `false`,
redirect to the workspace selector route (`'bo-workspace-selector'`).

**FR-05.3**: WorkspaceGuard MUST NOT call `fetch()` or any API.

**FR-05.4**: WorkspaceGuard MUST NOT read the license status or check subscription validity.

**FR-05.5**: WorkspaceGuard MUST NOT be registered in MMC or Frontoffice.

**FR-05.6**: The workspace selector route must have `meta.requiresAuth: true` and NOT
`meta.requiresWorkspace`, preventing a guard loop.

---

### FR-06 — RoleGuard

**FR-06.1**: RoleGuard only activates if `to.meta.roles` is defined and non-empty.

**FR-06.2**: If `to.meta.roles` is defined and `getUser()?.role` is not in `to.meta.roles`: redirect
to the unauthorized route (`'<app>-unauthorized'`).

**FR-06.3**: If `to.meta.roles` is not defined or is empty: pass through.

**FR-06.4**: The user object is injected via `getUser()` callback — never read from JWT.

**FR-06.5**: RoleGuard is explicitly documented as UI-convenience-only. Backend is the authoritative
RBAC layer.

---

### FR-07 — FeatureFlagGuard (Placeholder)

**FR-07.1**: A stub file `core/guards/feature-flag.guard.ts` must be created with a
`createFeatureFlagGuard()` factory that always returns `true` (pass-through).

**FR-07.2**: The stub must include a comment:
`// TODO(STAGE_UI_XX): Implement feature flag evaluation when feature flag service is ready.`

**FR-07.3**: The guard must be registerable in the pipeline (position 4) without causing test
failures.

---

### FR-08 — Navigation Error Handling

**FR-08.1**: Each app's router must register a catch-all `/:pathMatch(.*)*` route as the last route,
rendering `NotFoundView`.

**FR-08.2**: Each app must have an `/unauthorized` route rendering `UnauthorizedView`.

**FR-08.3**: If a navigation error occurs (e.g., component import failure), the router's `onError`
handler must redirect to `GlobalErrorView` without crashing.

**FR-08.4**: No navigation may result in a blank screen.

**FR-08.5**: All fallback views must be accessible without authentication (`public: true`).

---

### FR-09 — Redirect Strategy

**FR-09.1**: When AuthGuard redirects an unauthenticated user to login, the intended route's
`fullPath` is stored as `?redirect=<fullPath>` query param in the login URL.

**FR-09.2**: On successful login, the auth flow reads `?redirect` from `route.query.redirect`,
navigates there, and removes the param.

**FR-09.3**: On logout, the `?redirect` param must be cleared. The logout flow always redirects to
the login route without any redirect query.

**FR-09.4**: Redirect targets must be validated to prevent open-redirect vulnerabilities: only
relative paths starting with `/` are accepted.

**FR-09.5**: Infinite redirect loops are explicitly prevented:

- AuthGuard short-circuits when `to.name === loginRouteName`
- WorkspaceGuard short-circuits when `to.name === 'bo-workspace-selector'`
- RoleGuard short-circuits when `to.name === unauthorizedRouteName`

---

### FR-10 — Backoffice Router Migration

**FR-10.1**: The existing `apps/backoffice/src/router/index.ts` (STAGE_17) must be migrated to
`apps/backoffice/src/core/router/index.ts`.

**FR-10.2**: The existing inline `beforeEach` guard in the STAGE_17 router (which checks `isActive`
license status) must be removed entirely. License enforcement is a backend concern.

**FR-10.3**: The existing `contextStore.loadContext()` call inside the old router must be relocated
to the app bootstrap sequence in `main.ts` (or the equivalent plugin registration point), not inside
a navigation guard.

**FR-10.4**: All existing Backoffice routes must be migrated to module files:
`modules/<feature>/routes.ts`.

**FR-10.5**: The `WorkspaceLocked.vue` view (referenced by STAGE_17 for license-locked state) is
outside this stage's scope — it remains registerable as a route but the guard driving it is removed.
License-locked redirects are handled by the backend returning 423, not by a router guard.

---

## Non-Functional Requirements

### NFR-01 — Performance

- Guard execution must be synchronous where possible. No API calls inside guards under any
  condition.
- Guard pipeline overhead must be imperceptible to the user (< 5 ms total per navigation in typical
  conditions).
- Router lazy-loading: all route components must use dynamic `import()` to enable code splitting.
  Only fallback views (NotFound, Unauthorized, GlobalError) may be eager-loaded if bundle size
  justifies it.

### NFR-02 — Type Safety

- All router files must pass `tsc --noEmit` with `strict: true`.
- `RouteMeta` interface must be fully typed — no `any` or implicit `unknown` for meta fields.
- Guard return types must be explicitly declared as `RouteLocationRaw | boolean`.

### NFR-03 — Testability

- Guard factory functions must be independently unit-testable without a mounted Vue app.
- Router factory must create a fresh instance per test to avoid state bleed between tests.
- Test helpers must allow injection of mock auth state, workspace state, and role.

### NFR-04 — Observability

- AuthGuard must emit structured log entries (via `@zidney/logger`) on:
  - Unauthenticated access attempt (debug level)
  - Authenticated user redirected from guest-only route (debug level)
- WorkspaceGuard must log missing workspace context at debug level.
- RoleGuard must log role mismatch at debug level.
- No guard may log sensitive data (token values, password fields).

### NFR-05 — Maintainability

- Guards must be single-responsibility: one guard handles one concern.
- No business logic inside guards (no license checks, no subscription checks, no API calls).
- No inline route definitions inside `.vue` components.

### NFR-06 — Security

- Redirect target validation: `?redirect` param must be validated as a relative path only.
- Guards must not expose role logic that could be exploited for privilege escalation — backend is
  always authoritative.
- JWT must never be read in the router layer.

---

## API Contracts

This stage has **no direct API interactions**. Router guards are synchronous and read-only from
Pinia stores.

The following data must be available in Pinia stores BEFORE guards execute (populated by the app
bootstrap sequence from prior stages):

| Store                         | Field                            | Consumed by Guard           |
| ----------------------------- | -------------------------------- | --------------------------- |
| `AuthStore`                   | `isAuthenticated: boolean`       | AuthGuard                   |
| `AuthStore`                   | `user: { role: string } \| null` | RoleGuard                   |
| `WorkspaceStore` (Backoffice) | `isResolved: boolean`            | WorkspaceGuard (Backoffice) |

> The bootstrap sequence responsible for populating these stores is defined in
> STAGE_UI_01_AUTH_MODULE and STAGE_17_TENANT_BOOTSTRAP. This stage consumes those stores but does
> not define them.

---

## Data Model / Schema

**No database changes required.** This is a frontend-only stage. No migrations. No schema version
bump.

---

## Error Handling Contract

| Error Scenario                            | Guard Response           | Redirect Target                           | Notes                          |
| ----------------------------------------- | ------------------------ | ----------------------------------------- | ------------------------------ |
| User not authenticated on protected route | AuthGuard redirects      | `<app>-login` with `?redirect=<path>`     | Preserves intended destination |
| Authenticated user on public-only route   | AuthGuard redirects      | `<app>-dashboard`                         | Clears redirect param          |
| Workspace not resolved (Backoffice)       | WorkspaceGuard redirects | `bo-workspace-selector`                   | Backoffice only                |
| Role not in `meta.roles` list             | RoleGuard redirects      | `<app>-unauthorized`                      | UI-hint only                   |
| Route not found                           | Router catch-all         | `NotFoundView`                            | `/:pathMatch(.*)*`             |
| Component import failure                  | `router.onError` handler | `GlobalErrorView`                         | Prevents blank screen          |
| Invalid `?redirect` value (external URL)  | AuthGuard sanitizes      | Redirects to dashboard (ignores param)    | Open-redirect prevention       |
| Guard itself throws unexpectedly          | `try/catch` in guard     | Log error, return `true` to prevent crash | Never crash the pipeline       |

---

## Guard Pipeline Specification

### Execution Order (Authoritative)

```
beforeEach navigation
       │
       ▼
┌──────────────┐
│  AuthGuard   │ — runs for every navigation
└──────┬───────┘
       │ passes
       ▼
┌──────────────────────┐
│  WorkspaceGuard      │ — Backoffice only; skipped in MMC and Frontoffice
│  (Backoffice only)   │
└──────┬───────────────┘
       │ passes
       ▼
┌──────────────┐
│  RoleGuard   │ — runs when meta.roles is defined
└──────┬───────┘
       │ passes
       ▼
┌────────────────────┐
│ FeatureFlagGuard   │ — future placeholder; always passes
└──────┬─────────────┘
       │ passes
       ▼
  Route renders
```

### Guard Condition Matrix

| Guard               | Trigger Condition                                   | Pass Condition                   | Redirect Target               |
| ------------------- | --------------------------------------------------- | -------------------------------- | ----------------------------- |
| AuthGuard           | `meta.requiresAuth === true`                        | `isAuthenticated() === true`     | `<app>-login?redirect=<path>` |
| AuthGuard (reverse) | `meta.public === true`                              | `isAuthenticated() === false`    | `<app>-dashboard`             |
| WorkspaceGuard      | `meta.requiresWorkspace === true` (Backoffice only) | `isWorkspaceResolved() === true` | `bo-workspace-selector`       |
| RoleGuard           | `meta.roles` is defined and non-empty               | `user.role` is in `meta.roles`   | `<app>-unauthorized`          |
| FeatureFlagGuard    | `meta.featureFlag` defined (future)                 | Always passes                    | N/A (future)                  |

### Loop Prevention Rules

| Guard          | Short-Circuit Condition                                       |
| -------------- | ------------------------------------------------------------- |
| AuthGuard      | If `to.name === loginRouteName`, pass through unconditionally |
| WorkspaceGuard | If `to.name === 'bo-workspace-selector'`, pass through        |
| RoleGuard      | If `to.name === unauthorizedRouteName`, pass through          |

---

## Route Meta Schema

### Canonical TypeScript Interface

```typescript
// Extends Vue Router's built-in RouteMeta
declare module "vue-router" {
  interface RouteMeta {
    /**
     * When true: route is protected; unauthenticated users are redirected to login.
     * Mutually informative with `public` — define one or the other per route.
     */
    requiresAuth?: boolean;

    /**
     * When true: route is publicly accessible; authenticated users are redirected to dashboard.
     * Use for login pages, public landing pages, error views.
     */
    public?: boolean;

    /**
     * When defined: RoleGuard checks that AuthStore.user.role is in this list.
     * This is a UI-level hint only — backend remains the authoritative RBAC layer.
     */
    roles?: string[];

    /**
     * Backoffice only. When true: WorkspaceGuard validates that workspace context is resolved.
     * Has no effect in MMC or Frontoffice.
     */
    requiresWorkspace?: boolean;
  }
}
```

### Migration from STAGE_UI_01 Schema

| Legacy Field (STAGE_UI_01) | Canonical Replacement    | Migration Action                                           |
| -------------------------- | ------------------------ | ---------------------------------------------------------- |
| `guestOnly?: boolean`      | `public?: boolean`       | Replace all occurrences; remove `guestOnly` from interface |
| `requiredRole?: string`    | `roles?: string[]`       | Replace with array; wrap existing string value in `[...]`  |
| `requiresAuth?: boolean`   | `requiresAuth?: boolean` | Unchanged — no migration needed                            |

### Route Meta Usage Examples

```typescript
// Protected route requiring authentication
meta: { requiresAuth: true }

// Public/guest-only route (login page)
meta: { public: true }

// Protected route with role gating (UI hint)
meta: { requiresAuth: true, roles: ['admin', 'staff'] }

// Backoffice route requiring workspace context
meta: { requiresAuth: true, requiresWorkspace: true }

// 404 fallback — always public
meta: { public: true }

// Unauthorized view — always public
meta: { public: true }
```

---

## Multi-App Variation Matrix

| Feature                       | MMC                                 | Backoffice                           | Frontoffice                         |
| ----------------------------- | ----------------------------------- | ------------------------------------ | ----------------------------------- |
| Router location               | `core/router/index.ts`              | `core/router/index.ts`               | `core/router/index.ts`              |
| Types location                | `core/router/types.ts`              | `core/router/types.ts`               | `core/router/types.ts`              |
| Guards location               | `core/guards/`                      | `core/guards/`                       | `core/guards/`                      |
| `AuthGuard` registered        | Yes                                 | Yes                                  | Yes                                 |
| `WorkspaceGuard` registered   | **No**                              | **Yes**                              | **No**                              |
| `RoleGuard` registered        | Yes                                 | Yes                                  | Yes                                 |
| `FeatureFlagGuard` registered | Yes (stub)                          | Yes (stub)                           | Yes (stub)                          |
| Login route name              | `mmc-login`                         | `bo-login`                           | `fo-login`                          |
| Dashboard route name          | `mmc-dashboard`                     | `bo-dashboard`                       | `fo-home`                           |
| Unauthorized route name       | `mmc-unauthorized`                  | `bo-unauthorized`                    | `fo-unauthorized`                   |
| `NotFoundView`                | `shared/views/NotFoundView.vue`     | `shared/views/NotFoundView.vue`      | `shared/views/NotFoundView.vue`     |
| `UnauthorizedView`            | `shared/views/UnauthorizedView.vue` | `shared/views/UnauthorizedView.vue`  | `shared/views/UnauthorizedView.vue` |
| Route sources                 | `modules/*/routes.ts`               | `modules/*/routes.ts`                | `modules/*/routes.ts`               |
| Backoffice migration required | No                                  | **Yes** (from STAGE_17 inline guard) | No                                  |

### App-Specific Guard Constraints

**MMC**:

- No WorkspaceGuard (platform admin, not tenant-bound)
- Platform-level routes only
- Roles expected: `['platform-admin', 'platform-staff']` (illustrative — not hardcoded in guard)

**Backoffice**:

- WorkspaceGuard runs between AuthGuard and RoleGuard
- All workspace-bound routes set `requiresWorkspace: true`
- Workspace selector route: `requiresAuth: true`, no `requiresWorkspace` (prevents loop)
- Requires migration from existing STAGE_17 inline `beforeEach` pattern

**Frontoffice**:

- Student-facing auth only
- Attempt-related routes protected via `requiresAuth: true` only
- No role-gating expected currently (reserved for future student vs. guest distinction)
- `fo-home` is the post-login landing route

---

## Testability Contract

### Guard Unit Test Requirements

Each guard factory must have a corresponding unit test file at:

- `apps/<app>/tests/unit/core/guards/<guard-name>.test.ts`

Or alternatively in the shared test per app:

- `tests/unit/<app>/guards/<guard-name>.test.ts`

### Required Test Scenarios per Guard

**AuthGuard**:

| Scenario                           | Input                                                  | Expected Output                     |
| ---------------------------------- | ------------------------------------------------------ | ----------------------------------- |
| Protected route, unauthenticated   | `requiresAuth: true`, `isAuthenticated: false`         | Redirect to login with `?redirect`  |
| Protected route, authenticated     | `requiresAuth: true`, `isAuthenticated: true`          | `true` (pass)                       |
| Public route, unauthenticated      | `public: true`, `isAuthenticated: false`               | `true` (pass)                       |
| Public route, authenticated        | `public: true`, `isAuthenticated: true`                | Redirect to dashboard               |
| Login route, unauthenticated       | `to.name === loginRouteName`, `isAuthenticated: false` | `true` (pass — loop prevention)     |
| Route with no meta, authenticated  | no `requiresAuth` or `public`                          | `true` (pass)                       |
| Invalid `?redirect` (external URL) | `?redirect=http://evil.com`                            | Redirect to dashboard, ignore param |

**WorkspaceGuard**:

| Scenario                          | Input                                          | Expected Output                     |
| --------------------------------- | ---------------------------------------------- | ----------------------------------- |
| Workspace route, context resolved | `requiresWorkspace: true`, `isResolved: true`  | `true` (pass)                       |
| Workspace route, context missing  | `requiresWorkspace: true`, `isResolved: false` | Redirect to `bo-workspace-selector` |
| Non-workspace route               | `requiresWorkspace: undefined`                 | `true` (pass)                       |
| Workspace selector route itself   | `to.name === 'bo-workspace-selector'`          | `true` (loop prevention)            |

**RoleGuard**:

| Scenario                               | Input                                     | Expected Output          |
| -------------------------------------- | ----------------------------------------- | ------------------------ |
| Route with roles, user role matches    | `roles: ['admin']`, `user.role: 'admin'`  | `true` (pass)            |
| Route with roles, user role mismatches | `roles: ['admin']`, `user.role: 'viewer'` | Redirect to unauthorized |
| Route with no roles                    | `roles: undefined`                        | `true` (pass)            |
| Route with roles, no user              | `roles: ['admin']`, `user: null`          | Redirect to unauthorized |
| Unauthorized route itself              | `to.name === unauthorizedRouteName`       | `true` (loop prevention) |

### Router Integration Test Requirements

| Test                 | Description                                                           |
| -------------------- | --------------------------------------------------------------------- |
| Router instantiation | `createAppRouter()` returns a valid Router instance in jsdom          |
| 404 fallback         | Navigation to `/absolutely/undefined/path` resolves to `NotFoundView` |
| Guard registration   | Registered `beforeEach` count matches expected pipeline length        |
| Redirect flow        | After login simulation, `?redirect` is honored                        |
| No blank screens     | All fallback routes render a named component                          |

### Test Infrastructure Requirements

- `createAppRouter()` creates a fresh instance per test call
- Guards accept mock callback functions (injectable)
- No global store state bleeds between test cases
- Pinia `createTestingPinia()` must be used for store isolation

---

## Constitutional Compliance Declarations (v1.2.0)

### CCD-01 — No Cross-Tenant Access

**Status**: COMPLIANT Router is frontend-only. No database access. No cross-tenant data possible.

### CCD-02 — No Middleware Bypass

**Status**: N/A (frontend stage) No backend middleware involved.

### CCD-03 — No License Enforcement in Router

**Status**: COMPLIANT — enforced by stage contract Guards explicitly MUST NOT read license status.
The STAGE_17 Backoffice router's license-based redirect is removed by FR-10.2.

### CCD-04 — No JWT Decoding

**Status**: COMPLIANT — enforced by guard contract FR-04.5 explicitly prohibits JWT inspection.
Guards read `AuthStore.isAuthenticated` and `AuthStore.user.role` only.

### CCD-05 — No Backend RBAC Duplication

**Status**: COMPLIANT FR-06.5 explicitly documents RoleGuard as UI-convenience-only. Backend
validates roles independently.

### CCD-06 — Tenant Isolation

**Status**: COMPLIANT WorkspaceGuard reads workspace presence only (boolean). It does not validate
subscription, license, or make API calls. Tenant DB is not accessed.

### CCD-07 — No Hardcoded Workspace Identifiers

**Status**: COMPLIANT Workspace context is read from WorkspaceStore, not hardcoded. Route names are
injected as options, not hardcoded inside guards.

### CCD-08 — Structured Logging Only

**Status**: COMPLIANT Guards use `@zidney/logger` (NFR-04). `console.log` is forbidden.

### CCD-09 — Trust Chain Order Respected

**Status**: COMPLIANT Guard registration in `main.ts` is downstream of store initialization. Pinia
and auth bootstrap happen before router.beforeEach fires.

---

## Assumptions Documented

| #   | Assumption                                                                         | Rationale                                                                                                             |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| A1  | `AuthStore` (Pinia) is available and populated before first navigation fires       | Required by app bootstrap sequence from STAGE_UI_01; this stage depends on it                                         |
| A2  | `WorkspaceStore` (Backoffice) is available before navigation fires                 | Bootstrap sequence from STAGE_17 populates it before router guards execute                                            |
| A3  | App-specific route names follow the naming convention: `<app-prefix>-<route-name>` | Consistent with existing MMC auth guard implementation in STAGE_UI_01                                                 |
| A4  | `FeatureFlagGuard` stub is registered but always returns `true`                    | Feature flag service is a future stage; stub ensures pipeline position is reserved                                    |
| A5  | Backoffice's `WorkspaceLocked.vue` route remains registered                        | License-locked state is handled by backend 423 response, not router guard; view stays but guard driving it is removed |
| A6  | `NotFoundView.vue` already exists in MMC and Frontoffice `shared/views/`           | Observed from existing STAGE_UI_01 router code; confirmed in file structure                                           |
| A7  | The `?redirect` query param is consumed by the login page's post-auth logic        | Login form reads `route.query.redirect` after successful authentication                                               |

---

## Completion Criteria

Stage is considered complete when ALL of the following are true:

- [ ] Router initialized in all 3 apps using `createAppRouter()` factory pattern at
      `core/router/index.ts`
- [ ] `core/router/types.ts` updated in all 3 apps with canonical `RouteMeta` schema
- [ ] Legacy `guestOnly` and `requiredRole` fields removed from all RouteMeta augmentations
- [ ] All existing routes migrated to use `public` and `roles[]` canonical fields
- [ ] `core/guards/auth.guard.ts` present and passing in all 3 apps
- [ ] `core/guards/workspace.guard.ts` created for Backoffice only
- [ ] `core/guards/role.guard.ts` created for all 3 apps
- [ ] `core/guards/feature-flag.guard.ts` stub created for all 3 apps
- [ ] Backoffice router migrated from `src/router/index.ts` to `src/core/router/index.ts`
- [ ] Backoffice STAGE_17 inline license guard removed
- [ ] `NotFoundView.vue` present in all 3 apps
- [ ] `UnauthorizedView.vue` present in all 3 apps
- [ ] Redirect logic tested: save/restore, logout clear, open-redirect protection
- [ ] Guard unit tests cover all scenarios from Testability Contract
- [ ] No inline route definitions in `.vue` components
- [ ] CI passes: `tsc --noEmit`, `eslint`, `vitest`
- [ ] No `TODO` placeholders in router or guard files (except the intentional FeatureFlagGuard stub
      comment)
- [ ] `console.log` absent from all router/guard files

---

## Related Documents

- Stage file: `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_03_ROUTER_AND_GUARDS.md`
- STAGE_UI_01_AUTH_MODULE (established AuthGuard pattern and RouteMeta v1)
- STAGE_17_TENANT_BOOTSTRAP (Backoffice context store and router being migrated)
- Zidney Constitution v1.2.0
- `docs/PROJECT_CONTEXT_PRIMER.md`
- `docs/architecture/` (ADR files for authoritative decisions)

---

## Clarifications

### Session 2026-03-02

**CL-01: GlobalErrorView Is In Scope (Scope Gap)**

- **Context**: FR-08.3 requires a `GlobalErrorView` component wired to `router.onError()` to prevent
  blank screens on component import failure. However, the "In Scope" section lists only
  `NotFoundView.vue` and `UnauthorizedView.vue` — `GlobalErrorView.vue` is absent from the In Scope
  list and from the Completion Criteria checklist.
- **Resolution**: `GlobalErrorView.vue` is explicitly added to scope for all three apps
  (`shared/views/GlobalErrorView.vue`). It must be registered as a reachable route (`/error` or
  equivalent with `meta: { public: true }`) so `router.onError()` can call
  `router.replace({ name: '<app>-error' })`. The Completion Criteria checklist must include:
  `GlobalErrorView.vue` present in all 3 apps and `router.onError()` registered. The In Scope
  section is updated accordingly.
- **Impact**: FR-08.3, FR-08.4, In Scope, Completion Criteria, Multi-App Variation Matrix.

**CL-02: Guard try/catch Requirement Is Mandatory**

- **Context**: The Error Handling Contract table states "Guard itself throws unexpectedly →
  `try/catch` in guard → Log error, return `true` to prevent crash". However, FR-03 through FR-07
  contain no explicit instruction to wrap guard logic in try/catch. The existing MMC `auth.guard.ts`
  (from STAGE_UI_01) does not include try/catch. This creates an ambiguity: is try/catch required or
  merely recommended?
- **Resolution**: try/catch is **mandatory** for all guard factory implementations. Each guard's
  returned `NavigationGuard` function must wrap its logic in a try/catch block. On catch: log at
  `error` level using `@zidney/logger` with `correlation_id` and `route` context, then return `true`
  to prevent pipeline crash (never `false` or a broken redirect). This is the authoritative
  enforcement of FR-03.3 ("must never throw"). FR-03.3 is updated to make this explicit.
- **Impact**: FR-03.3, FR-04, FR-05, FR-06, FR-07 implementations; guard unit test scenarios must
  include a "guard callback throws" test case for AuthGuard, WorkspaceGuard, and RoleGuard.

**CL-03: Canonical Route Names for 404 and Unauthorized Routes**

- **Context**: The Multi-App Variation Matrix specifies `<app>-login`, `<app>-dashboard`, and
  `<app>-unauthorized` route names but does not specify the route name for the 404 catch-all route.
  Existing MMC and Frontoffice code (from STAGE_UI_01) uses `name: 'not-found'` (no app prefix),
  which violates Assumption A3 (`<app-prefix>-<route-name>` convention). This creates inconsistency
  and risks the RoleGuard short-circuit pattern (which checks `to.name === unauthorizedRouteName`)
  failing silently if names diverge.
- **Resolution**: Canonical 404 route names per app are: `mmc-not-found` (MMC), `bo-not-found`
  (Backoffice), `fo-not-found` (Frontoffice). The existing `name: 'not-found'` route definitions in
  MMC and Frontoffice must be renamed as part of this migration. The error-route name for
  GlobalErrorView (CL-01) follows the same pattern: `mmc-error`, `bo-error`, `fo-error`. The
  Multi-App Variation Matrix is updated to include these rows.
- **Impact**: FR-08.1, FR-08.2, FR-08.3; Route module definitions for all 3 apps; loop-prevention
  short-circuit checks in guards must use injected `notFoundRouteName` and `errorRouteName` options
  if the guard needs to reference them (currently only RoleGuard and WorkspaceGuard short-circuit on
  specific names — no change needed there, but error/404 route name injection is now canonically
  defined).

**CL-04: Test Environment Router History Mode**

- **Context**: `createAppRouter()` uses `createWebHistory()`, which requires browser DOM APIs
  (`window.history`, `location`). AC10.5 requires the router to be instantiable in the `jsdom` test
  environment without DOM errors. These goals are in tension. The spec does not specify how to
  reconcile `createWebHistory()` with jsdom, nor whether a separate test factory or history override
  is needed.
- **Resolution**: Guard unit tests do **not** need a full router instance — they call the
  `NavigationGuard` function directly with mock `to`/`from` route objects (standard Vue Router
  testing pattern). Guard factory functions (FR-03.4) return a plain function; tests invoke that
  function with mocked args and assert the return value. For router integration tests (e.g., "404
  fallback resolves to NotFoundView"), `createMemoryHistory()` must be used instead of
  `createWebHistory()`. Each app's `createAppRouter()` must accept an optional `history` parameter
  (defaulting to `createWebHistory()`) so tests can inject `createMemoryHistory()`. This pattern
  satisfies AC10.1 and AC10.5 without altering production behavior.
- **Impact**: FR-01.1, AC10.1, AC10.5, NFR-03, Testability Contract; `createAppRouter` signatures
  updated to `createAppRouter(history?: RouterHistory): Router`.

**CL-05: Legacy Singleton Router Export Must Be Removed**

- **Context**: Both MMC and Frontoffice currently export a build-time singleton
  `export const router: Router = createAppRouter()` alongside the factory, with the comment "Legacy
  export for backward compatibility — same as createAppRouter()". FR-01.3 states only one router
  instance is allowed per app. Two exports (factory + eagerly-created singleton) create a second
  instance at module-load time. FR-01.2 requires guards to be registered by the caller (`main.ts`),
  which assumes `main.ts` creates the single instance via `createAppRouter()`.
- **Resolution**: The singleton `export const router = createAppRouter()` must be **removed** from
  all three apps as part of this stage. All current callers must be updated to call
  `createAppRouter()` in `main.ts` and hold the instance there. The default export
  (`export default router`) must also be removed; all imports of the router must use the named
  `createAppRouter` export. This is a breaking change scoped to this migration stage and is
  acceptable given no business pages reference the router directly yet.
- **Impact**: FR-01.1, FR-01.3; `main.ts` in MMC and Frontoffice must be updated; Backoffice (new
  file) starts clean without singleton; Completion Criteria updated.

**CL-06: `requiredModule` Meta Field Must Be Removed in Backoffice Migration**

- **Context**: The existing STAGE_17 Backoffice router defines
  `meta: { requiredModule: Module.MCQ }` for license-module gating. FR-10.2 removes the module gate
  guard, but no spec section explicitly states whether the `requiredModule` field itself should be
  purged from `RouteMeta` or left as a dormant no-op annotation after migration.
- **Resolution**: `requiredModule` is NOT part of the canonical `RouteMeta` schema defined in
  FR-02.1 and must be removed from Backoffice's `RouteMeta` augmentation. Any route definitions
  using `requiredModule` must have the field stripped. No guard reads `requiredModule` in the
  canonical pipeline. Leaving it as a phantom field would create confusion and violate FR-02.4's
  intent (no ambiguous meta states). Removal aligns with FR-10.2's goal of eliminating all
  license-logic remnants from the router layer.
- **Impact**: FR-10.2, FR-02.1, FR-02.2; Backoffice `core/router/types.ts` and all route definitions
  that set `requiredModule`.
