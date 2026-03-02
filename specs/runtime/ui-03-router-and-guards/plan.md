# Implementation Plan — STAGE_UI_03_ROUTER_AND_GUARDS

**Stage**: STAGE_UI_03_ROUTER_AND_GUARDS
**Phase**: 06_UI_APPLICATION_RUNTIME
**Branch**: `ui-03-router-and-guards`
**Planned**: 2026-03-02
**Status**: PLAN COMPLETE

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Current State Audit](#2-current-state-audit)
3. [Component Inventory — All Changes](#3-component-inventory--all-changes)
4. [RouteMeta TypeScript Interface](#4-routemeta-typescript-interface)
5. [Guard Factory Signatures](#5-guard-factory-signatures)
6. [Guard Pipeline Registration Pattern](#6-guard-pipeline-registration-pattern)
7. [App-Specific Router Plan](#7-app-specific-router-plan)
   - [7.1 MMC](#71-mmc)
   - [7.2 Backoffice](#72-backoffice)
   - [7.3 Frontoffice](#73-frontoffice)
8. [Backoffice STAGE_17 Migration Plan](#8-backoffice-stage_17-migration-plan)
9. [Fallback Views Plan](#9-fallback-views-plan)
10. [Redirect Strategy Implementation](#10-redirect-strategy-implementation)
11. [Test Strategy](#11-test-strategy)
12. [Migration Risks & Mitigations](#12-migration-risks--mitigations)

---

## 1. Architecture Overview

### How the Router/Guard System Fits

```
main.ts (Bootstrap)
  │
  ├─ Step 1: createPinia()
  ├─ Step 2: createAppRouter(history?)          ← NEW: factory, no singleton
  ├─ Step 3-7: auth infra setup (unchanged)
  ├─ Step 8: registerGuards(router, { ... })   ← NEW: replaces manual router.beforeEach
  │    │
  │    ├─ router.beforeEach → sessionInitialized gate → AuthGuard
  │    ├─ router.beforeEach → WorkspaceGuard (Backoffice only)
  │    ├─ router.beforeEach → RoleGuard
  │    ├─ router.beforeEach → FeatureFlagGuard (stub)
  │    └─ router.onError → redirect to <app>-error
  └─ Step 9: mount
```

### Guard Execution (per navigation)

```
beforeEach
   │
   ├─ sessionInitialized gate (async, once)
   │
   ▼
AuthGuard
   │ redirects: <app>-login?redirect=<path>  (if requiresAuth + unauth)
   │ redirects: <app>-dashboard              (if public + auth)
   │ passes ▼
WorkspaceGuard  (Backoffice ONLY)
   │ redirects: bo-workspace-selector        (if requiresWorkspace + no context)
   │ passes ▼
RoleGuard
   │ redirects: <app>-unauthorized           (if roles[] mismatch)
   │ passes ▼
FeatureFlagGuard (stub — always passes)
   │ passes ▼
Route renders
```

### Directory Structure (Post-Implementation, All Apps)

```
apps/<app>/src/
├── core/
│   ├── router/
│   │   ├── index.ts        ← createAppRouter(history?) factory (no singleton)
│   │   └── types.ts        ← RouteMeta augmentation (canonical schema)
│   └── guards/
│       ├── auth.guard.ts         ← createAuthGuard()
│       ├── workspace.guard.ts    ← createWorkspaceGuard() [Backoffice only]
│       ├── role.guard.ts         ← createRoleGuard()
│       └── feature-flag.guard.ts ← createFeatureFlagGuard() [stub]
├── shared/
│   └── views/
│       ├── NotFound.vue          ← RENAME → NotFoundView.vue; route: <app>-not-found
│       ├── UnauthorizedView.vue  ← NEW in all 3 apps
│       └── GlobalErrorView.vue   ← NEW in all 3 apps
└── main.ts                       ← updated: registerGuards() pattern
```

---

## 2. Current State Audit

### MMC — Current State

| File                                    | Status                           | Issue                                                                                                                                                   |
| --------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/router/index.ts`              | EXISTS                           | Has `createAppRouter()` ✓; has legacy singleton `export const router = createAppRouter()` ✗; uses `createWebHistory()` without optional history param ✗ |
| `src/core/router/types.ts`              | EXISTS                           | Uses legacy `guestOnly`, `requiredRole` ✗; missing `public`, `roles[]`, `requiresWorkspace` ✗                                                           |
| `src/core/router/guards/auth.guard.ts`  | EXISTS                           | Uses `guestOnly` meta ✗; no try/catch ✗; no open-redirect protection ✗; missing `public` meta support                                                   |
| `src/core/guards/`                      | MISSING                          | Entire directory does not exist                                                                                                                         |
| `src/shared/views/NotFound.vue`         | EXISTS (wrong name + route name) | Path is `NotFound.vue` (should be `NotFoundView.vue`); route name `'not-found'` → must become `'mmc-not-found'`                                         |
| `src/shared/views/UnauthorizedView.vue` | MISSING                          |                                                                                                                                                         |
| `src/shared/views/GlobalErrorView.vue`  | MISSING                          |                                                                                                                                                         |
| `src/main.ts`                           | EXISTS                           | Imports singleton `{ router }` ✗; manually calls `router.beforeEach` ✗; must use `registerGuards()`                                                     |

**MMC Module Routes (existing)**:

- `modules/dashboard/routes.ts` — route name `'dashboard'` (must become `'mmc-dashboard'`), uses `meta: { requiresAuth: true }` ✓
- `modules/licenses/routes.ts` — must be inspected for route names and meta

### Backoffice — Current State

| File                                    | Status                           | Issue                                                                                                                                                                                     |
| --------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/router/index.ts`              | EXISTS (STAGE_UI_01)             | Has `createAppRouter()` ✓; has legacy singleton `export const router = createAppRouter()` ✗; missing history param ✗                                                                      |
| `src/core/router/types.ts`              | EXISTS                           | Has `guestOnly`, `requiredRole` ✗; has `requiresWorkspace` ✓; missing `public`, `roles[]`; must strip `guestOnly` and `requiredRole`                                                      |
| `src/core/router/guards/auth.guard.ts`  | EXISTS                           | Same issues as MMC: uses `guestOnly`, no try/catch, no open-redirect protection                                                                                                           |
| `src/core/guards/`                      | MISSING                          |                                                                                                                                                                                           |
| `src/router/index.ts`                   | EXISTS (STAGE_17 LEGACY)         | Inline license guard using `contextStore.isActive` ✗; module gate using `requiredModule` ✗; direct `import('../stores/context')` inside guard ✗; uses singleton pattern — must be DELETED |
| `src/stores/context.ts`                 | EXISTS                           | Has `isActive`, `loadContext()`, `clearContext()`. Note: spec wants `isResolved: boolean` in WorkspaceStore — but `isActive` is license status (not workspace context). See §8.           |
| `src/shared/views/NotFound.vue`         | EXISTS (wrong name + route name) | Same issues as MMC; route name `'not-found'` → `'bo-not-found'`                                                                                                                           |
| `src/shared/views/UnauthorizedView.vue` | MISSING                          |                                                                                                                                                                                           |
| `src/shared/views/GlobalErrorView.vue`  | MISSING                          |                                                                                                                                                                                           |
| `src/main.ts`                           | EXISTS                           | Imports singleton `{ router }` ✗; manually calls `router.beforeEach` ✗; must load context store in bootstrap, not guard                                                                   |

### Frontoffice — Current State

| File                                    | Status                           | Issue                                                                                                                                          |
| --------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/router/index.ts`              | EXISTS                           | Has `createAppRouter()` ✓; has legacy singleton `export const router = createAppRouter()` + `export default router` ✗; missing history param ✗ |
| `src/core/router/types.ts`              | EXISTS                           | Uses legacy `guestOnly`, `requiredRole` ✗; missing `public`, `roles[]`, `requiresWorkspace` ✗                                                  |
| `src/core/router/guards/auth.guard.ts`  | EXISTS                           | Same issues as MMC/Backoffice: uses `guestOnly`, no try/catch, no open-redirect protection                                                     |
| `src/core/guards/`                      | MISSING                          |                                                                                                                                                |
| `src/shared/views/NotFound.vue`         | EXISTS (wrong name + route name) | Route name `'not-found'` → `'fo-not-found'`                                                                                                    |
| `src/shared/views/UnauthorizedView.vue` | MISSING                          |                                                                                                                                                |
| `src/shared/views/GlobalErrorView.vue`  | MISSING                          |                                                                                                                                                |
| `src/main.ts`                           | EXISTS                           | Imports singleton `{ router }` ✗; manually calls `router.beforeEach` ✗; must use `registerGuards()`                                            |

---

## 3. Component Inventory — All Changes

### Key: `CREATE` | `MODIFY` | `DELETE` | `RENAME`

---

### MMC (`apps/mmc/src/`)

| Action     | File                                                          | Reason                                                                                                                                           |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **MODIFY** | `core/router/index.ts`                                        | Remove legacy singleton exports; add `history?` param; update 404 route name to `mmc-not-found`; update 404 component path to `NotFoundView.vue` |
| **MODIFY** | `core/router/types.ts`                                        | Replace `guestOnly`/`requiredRole` with canonical `public`/`roles[]`/`requiresWorkspace`; update `AuthRouteMeta` alias                           |
| **RENAME** | `shared/views/NotFound.vue` → `shared/views/NotFoundView.vue` | Canonical naming; update all imports                                                                                                             |
| **CREATE** | `shared/views/UnauthorizedView.vue`                           | New; `meta: { public: true }`                                                                                                                    |
| **CREATE** | `shared/views/GlobalErrorView.vue`                            | New; `meta: { public: true }`                                                                                                                    |
| **DELETE** | `core/router/guards/auth.guard.ts`                            | Replaced by `core/guards/auth.guard.ts` (relocated + fully rewritten)                                                                            |
| **CREATE** | `core/guards/auth.guard.ts`                                   | Rewritten: canonical `public` meta, try/catch, open-redirect protection                                                                          |
| **CREATE** | `core/guards/role.guard.ts`                                   | New                                                                                                                                              |
| **CREATE** | `core/guards/feature-flag.guard.ts`                           | New stub                                                                                                                                         |
| **CREATE** | `core/guards/index.ts`                                        | Barrel: `registerGuards()` function                                                                                                              |
| **MODIFY** | `main.ts`                                                     | Replace `import { router }` with `createAppRouter()`; replace manual `router.beforeEach` with `registerGuards()`                                 |
| **MODIFY** | `modules/dashboard/routes.ts`                                 | Rename route `'dashboard'` → `'mmc-dashboard'`                                                                                                   |
| **MODIFY** | `modules/licenses/routes.ts`                                  | Rename route names to `mmc-*` prefix; migrate any `guestOnly` → `public`, `requiredRole` → `roles[]`                                             |

**MMC Totals**: 5 CREATE, 6 MODIFY, 1 DELETE, 1 RENAME

---

### Backoffice (`apps/backoffice/src/`)

| Action     | File                                                          | Reason                                                                                                                                                                |
| ---------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MODIFY** | `core/router/index.ts`                                        | Remove legacy singleton exports; add `history?` param; update 404 route name to `bo-not-found`; add fallback routes for unauthorized + error; aggregate module routes |
| **MODIFY** | `core/router/types.ts`                                        | Strip `guestOnly`, `requiredRole`; add `public`, `roles[]`; keep `requiresWorkspace`; remove `requiredModule` (CL-06)                                                 |
| **RENAME** | `shared/views/NotFound.vue` → `shared/views/NotFoundView.vue` | Canonical naming                                                                                                                                                      |
| **CREATE** | `shared/views/UnauthorizedView.vue`                           | New                                                                                                                                                                   |
| **CREATE** | `shared/views/GlobalErrorView.vue`                            | New                                                                                                                                                                   |
| **DELETE** | `core/router/guards/auth.guard.ts`                            | Replaced by `core/guards/auth.guard.ts`                                                                                                                               |
| **CREATE** | `core/guards/auth.guard.ts`                                   | Rewritten canonical version                                                                                                                                           |
| **CREATE** | `core/guards/workspace.guard.ts`                              | New (Backoffice-only)                                                                                                                                                 |
| **CREATE** | `core/guards/role.guard.ts`                                   | New                                                                                                                                                                   |
| **CREATE** | `core/guards/feature-flag.guard.ts`                           | New stub                                                                                                                                                              |
| **CREATE** | `core/guards/index.ts`                                        | Barrel: `registerGuards()` function (includes WorkspaceGuard)                                                                                                         |
| **DELETE** | `router/index.ts`                                             | STAGE_17 legacy file removed; inline license guard eliminated (FR-10.2)                                                                                               |
| **MODIFY** | `main.ts`                                                     | Replace `import { router }` with `createAppRouter()`; replace manual guard with `registerGuards()`; add `loadContext()` to bootstrap (relocated from router guard)    |

**Backoffice Totals**: 5 CREATE, 4 MODIFY, 2 DELETE, 1 RENAME

---

### Frontoffice (`apps/frontoffice/src/`)

| Action     | File                                                          | Reason                                                                                                                                     |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **MODIFY** | `core/router/index.ts`                                        | Remove legacy singleton exports + default export; add `history?` param; update 404 route name to `fo-not-found`; update 404 component path |
| **MODIFY** | `core/router/types.ts`                                        | Same as MMC: replace legacy fields with canonical                                                                                          |
| **RENAME** | `shared/views/NotFound.vue` → `shared/views/NotFoundView.vue` | Canonical naming                                                                                                                           |
| **CREATE** | `shared/views/UnauthorizedView.vue`                           | New                                                                                                                                        |
| **CREATE** | `shared/views/GlobalErrorView.vue`                            | New                                                                                                                                        |
| **DELETE** | `core/router/guards/auth.guard.ts`                            | Replaced by `core/guards/auth.guard.ts`                                                                                                    |
| **CREATE** | `core/guards/auth.guard.ts`                                   | Rewritten canonical version                                                                                                                |
| **CREATE** | `core/guards/role.guard.ts`                                   | New                                                                                                                                        |
| **CREATE** | `core/guards/feature-flag.guard.ts`                           | New stub                                                                                                                                   |
| **CREATE** | `core/guards/index.ts`                                        | Barrel: `registerGuards()` function                                                                                                        |
| **MODIFY** | `main.ts`                                                     | Replace `import { router }` with `createAppRouter()`; replace manual guard with `registerGuards()`                                         |

**Frontoffice Totals**: 5 CREATE, 4 MODIFY, 1 DELETE, 1 RENAME

---

### Grand Total

| App         | CREATE | MODIFY | DELETE | RENAME |
| ----------- | ------ | ------ | ------ | ------ |
| MMC         | 5      | 6      | 1      | 1      |
| Backoffice  | 5      | 4      | 2      | 1      |
| Frontoffice | 5      | 4      | 1      | 1      |
| **Total**   | **15** | **14** | **4**  | **3**  |

---

## 4. RouteMeta TypeScript Interface

Canonical definition for all three apps. Place in `core/router/types.ts` of each app.

```typescript
// apps/<app>/src/core/router/types.ts

/**
 * Vue Router RouteMeta augmentation — canonical schema for all Zidney frontend apps.
 *
 * Migration from STAGE_UI_01 schema:
 *   guestOnly   → public       (rename + semantic clarification)
 *   requiredRole → roles[]     (promote to array)
 *   requiresWorkspace          (Backoffice already had it; now canonical)
 *
 * Stage: STAGE_UI_03_ROUTER_AND_GUARDS
 */
declare module 'vue-router' {
  interface RouteMeta {
    /**
     * When true: route is protected. Unauthenticated users are redirected to
     * the app's login route with `?redirect=<to.fullPath>`.
     * Mutually informative with `public` — define one per route.
     */
    requiresAuth?: boolean

    /**
     * When true: route is publicly accessible (login pages, error pages, landing).
     * Authenticated users are redirected to the dashboard.
     */
    public?: boolean

    /**
     * When defined and non-empty: RoleGuard checks `AuthStore.user.role` is
     * present in this list. UI-hint only — backend is the authoritative RBAC layer.
     */
    roles?: string[]

    /**
     * Backoffice only. When true: WorkspaceGuard validates workspace context
     * is resolved before allowing access. Has no effect in MMC or Frontoffice.
     */
    requiresWorkspace?: boolean
  }
}

/**
 * Convenience type alias — safe to use in route definitions and guard files.
 */
export interface AppRouteMeta {
  requiresAuth?: boolean
  public?: boolean
  roles?: string[]
  requiresWorkspace?: boolean
}
```

### Removed Fields (Breaking Migration)

| Legacy Field              | Replacement        | Migration Action                                             |
| ------------------------- | ------------------ | ------------------------------------------------------------ |
| `guestOnly?: boolean`     | `public?: boolean` | Find+replace in all route definitions; remove from interface |
| `requiredRole?: string`   | `roles?: string[]` | Wrap existing value in `[...]`; remove from interface        |
| `requiredModule?: Module` | _(removed)_        | Strip from Backoffice routes; guard that read it is deleted  |

---

## 5. Guard Factory Signatures

All guards placed in `apps/<app>/src/core/guards/`.

### 5.1 `createAuthGuard`

```typescript
// apps/<app>/src/core/guards/auth.guard.ts

import type {
  NavigationGuard,
  RouteLocationNormalized,
  RouteLocationRaw,
} from 'vue-router'

export interface AuthGuardOptions {
  /** App-specific login route name. e.g. 'mmc-login', 'bo-login', 'fo-login' */
  loginRouteName: string
  /** App-specific post-login landing route. e.g. 'mmc-dashboard', 'bo-dashboard', 'fo-home' */
  dashboardRouteName: string
  /** Default true. Set false to omit ?redirect param on redirect to login. */
  preserveRedirect?: boolean
}

export function createAuthGuard(
  getIsAuthenticated: () => boolean,
  options: AuthGuardOptions
): NavigationGuard
```

**Behavioral Contract**:

- If `to.meta.requiresAuth === true` and `!isAuthenticated()`:
  - Short-circuit: `to.name === loginRouteName` → return `true`
  - Otherwise: return `{ name: loginRouteName, query: { redirect: to.fullPath } }`
  - Redirect `to.fullPath` is validated (must start with `/`, no external URLs) — else redirect to dashboard without param
- If `to.meta.public === true` and `isAuthenticated()`:
  - return `{ name: dashboardRouteName }`
- Otherwise: return `true`
- Wrapped in `try/catch`; on error: log at `error` level, return `true`

---

### 5.2 `createWorkspaceGuard` (Backoffice only)

```typescript
// apps/backoffice/src/core/guards/workspace.guard.ts

import type {
  NavigationGuard,
  RouteLocationNormalized,
  RouteLocationRaw,
} from 'vue-router'

export interface WorkspaceGuardOptions {
  /** Short-circuit: if already on selector, pass through */
  selectorRouteName: 'bo-workspace-selector'
}

export function createWorkspaceGuard(
  isWorkspaceResolved: () => boolean,
  options?: WorkspaceGuardOptions
): NavigationGuard
```

**Behavioral Contract**:

- If `to.meta.requiresWorkspace !== true`: return `true`
- Short-circuit: `to.name === 'bo-workspace-selector'` → return `true`
- If `!isWorkspaceResolved()`: return `{ name: 'bo-workspace-selector' }`
- Otherwise: return `true`
- MUST NOT call any API; MUST NOT read license status
- Wrapped in `try/catch`; on error: log at `error` level, return `true`

**WorkspaceStore Mapping**: The existing `contextStore` has `isActive` (license status) but NOT `isResolved` (workspace presence). The `isWorkspaceResolved` callback must be based on `!!(contextStore.context)` — i.e., whether a context object is loaded (not whether it's active). This is wired in `main.ts`:

```typescript
isWorkspaceResolved: () => contextStore.context !== null
```

This avoids coupling the guard to license state while correctly representing "workspace context is available".

---

### 5.3 `createRoleGuard`

```typescript
// apps/<app>/src/core/guards/role.guard.ts

import type {
  NavigationGuard,
  RouteLocationNormalized,
  RouteLocationRaw,
} from 'vue-router'

export interface RoleGuardOptions {
  /** App-specific unauthorized route name. e.g. 'mmc-unauthorized', 'bo-unauthorized', 'fo-unauthorized' */
  unauthorizedRouteName: string
}

export function createRoleGuard(
  getUser: () => { role: string } | null,
  options: RoleGuardOptions
): NavigationGuard
```

**Behavioral Contract**:

- If `to.meta.roles` is undefined or empty: return `true`
- Short-circuit: `to.name === unauthorizedRouteName` → return `true`
- If `getUser()` is null OR `getUser()!.role` not in `to.meta.roles`: return `{ name: unauthorizedRouteName }`
- Otherwise: return `true`
- Wrapped in `try/catch`; on error: log at `error` level, return `true`

---

### 5.4 `createFeatureFlagGuard` (Stub)

```typescript
// apps/<app>/src/core/guards/feature-flag.guard.ts

import type { NavigationGuard } from 'vue-router'

export function createFeatureFlagGuard(): NavigationGuard
```

**Behavioral Contract**:

- Always returns `true`
- Contains the required comment: `// TODO(STAGE_UI_XX): Implement feature flag evaluation when feature flag service is ready.`
- Stub is registered in the pipeline at position 4 to reserve the slot

---

## 6. Guard Pipeline Registration Pattern

### `registerGuards()` Barrel (`core/guards/index.ts`)

Each app exports a `registerGuards()` function that encapsulates the full pipeline setup.

**MMC / Frontoffice** (`core/guards/index.ts`):

```typescript
import type { Router } from 'vue-router'
import { createAuthGuard } from './auth.guard'
import { createRoleGuard } from './role.guard'
import { createFeatureFlagGuard } from './feature-flag.guard'

export interface RegisterGuardsOptions {
  isAuthenticated: () => boolean
  getUser: () => { role: string } | null
  loginRouteName: string
  dashboardRouteName: string
  unauthorizedRouteName: string
  /** Async hook called once before the first navigation — initializes session */
  initSession: () => Promise<void>
}

export function registerGuards(
  router: Router,
  options: RegisterGuardsOptions
): void {
  let sessionInitialized = false

  const authGuard = createAuthGuard(options.isAuthenticated, {
    loginRouteName: options.loginRouteName,
    dashboardRouteName: options.dashboardRouteName,
  })
  const roleGuard = createRoleGuard(options.getUser, {
    unauthorizedRouteName: options.unauthorizedRouteName,
  })
  const featureGuard = createFeatureFlagGuard()

  router.beforeEach(async (to, from) => {
    if (!sessionInitialized) {
      await options.initSession()
      sessionInitialized = true
    }
    const authResult = await authGuard(to, from, () => {})
    if (authResult !== true) return authResult

    const roleResult = await roleGuard(to, from, () => {})
    if (roleResult !== true) return roleResult

    return featureGuard(to, from, () => {})
  })

  router.onError((error) => {
    // Prevent blank screen on component import failure
    router.replace({ name: options.unauthorizedRouteName }).catch(() => {
      // If even the redirect fails, there is nothing safe to do
    })
  })
}
```

**Backoffice** (`core/guards/index.ts`) — includes WorkspaceGuard between Auth and Role:

```typescript
import type { Router } from 'vue-router'
import { createAuthGuard } from './auth.guard'
import { createWorkspaceGuard } from './workspace.guard'
import { createRoleGuard } from './role.guard'
import { createFeatureFlagGuard } from './feature-flag.guard'

export interface RegisterGuardsOptions {
  isAuthenticated: () => boolean
  isWorkspaceResolved: () => boolean
  getUser: () => { role: string } | null
  loginRouteName: string
  dashboardRouteName: string
  unauthorizedRouteName: string
  initSession: () => Promise<void>
}

export function registerGuards(
  router: Router,
  options: RegisterGuardsOptions
): void {
  let sessionInitialized = false

  const authGuard = createAuthGuard(options.isAuthenticated, {
    loginRouteName: options.loginRouteName,
    dashboardRouteName: options.dashboardRouteName,
  })
  const workspaceGuard = createWorkspaceGuard(options.isWorkspaceResolved)
  const roleGuard = createRoleGuard(options.getUser, {
    unauthorizedRouteName: options.unauthorizedRouteName,
  })
  const featureGuard = createFeatureFlagGuard()

  router.beforeEach(async (to, from) => {
    if (!sessionInitialized) {
      await options.initSession()
      sessionInitialized = true
    }
    const authResult = await authGuard(to, from, () => {})
    if (authResult !== true) return authResult

    const wsResult = await workspaceGuard(to, from, () => {})
    if (wsResult !== true) return wsResult

    const roleResult = await roleGuard(to, from, () => {})
    if (roleResult !== true) return roleResult

    return featureGuard(to, from, () => {})
  })

  router.onError(() => {
    router.replace({ name: 'bo-error' }).catch(() => {})
  })
}
```

### `main.ts` Registration Call

```typescript
// Step 8: Register guards (replaces manual router.beforeEach)
import { registerGuards } from '@/core/guards'

registerGuards(router, {
  isAuthenticated: () => authStore.isAuthenticated,
  getUser: () => authStore.user,
  loginRouteName: LOGIN_ROUTE, // 'mmc-login' / 'bo-login' / 'fo-login'
  dashboardRouteName: DASHBOARD_ROUTE, // 'mmc-dashboard' / 'bo-dashboard' / 'fo-home'
  unauthorizedRouteName: UNAUTHORIZED_ROUTE, // 'mmc-unauthorized' / 'bo-unauthorized' / 'fo-unauthorized'
  initSession: () => authStore.initSession(),
  // Backoffice only:
  isWorkspaceResolved: () => contextStore.context !== null,
})
```

---

## 7. App-Specific Router Plan

### 7.1 MMC

#### Files to Create

| File                                    | Content                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/core/guards/auth.guard.ts`         | Full rewrite — canonical `public` meta, try/catch, open-redirect protection, structured logging |
| `src/core/guards/role.guard.ts`         | New — `createRoleGuard()` factory                                                               |
| `src/core/guards/feature-flag.guard.ts` | New stub — `createFeatureFlagGuard()`                                                           |
| `src/core/guards/index.ts`              | Barrel — `registerGuards()` (no WorkspaceGuard)                                                 |
| `src/shared/views/UnauthorizedView.vue` | New — `meta: { public: true }`; link back to `mmc-dashboard`                                    |
| `src/shared/views/GlobalErrorView.vue`  | New — `meta: { public: true }`                                                                  |

#### Files to Modify

| File                              | Change                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/core/router/index.ts`        | Remove `export const router` and `export default router`; add `history?: RouterHistory` param; update 404 route: name `mmc-not-found`, component `NotFoundView.vue`; add unauthorized route (`/unauthorized`, name `mmc-unauthorized`); add error route (`/error`, name `mmc-error`); import canonical types |
| `src/core/router/types.ts`        | Replace `guestOnly`/`requiredRole` with `public`/`roles[]`/`requiresWorkspace`; update `AppRouteMeta` alias                                                                                                                                                                                                  |
| `src/main.ts`                     | Remove `import { router }` (singleton); call `const router = createAppRouter()`; replace manual `router.beforeEach` block with `registerGuards(router, { ... })`                                                                                                                                             |
| `src/modules/dashboard/routes.ts` | Rename: `'dashboard'` → `'mmc-dashboard'`                                                                                                                                                                                                                                                                    |
| `src/modules/licenses/routes.ts`  | Rename routes to `mmc-*` prefix; migrate any legacy meta fields                                                                                                                                                                                                                                              |

#### Files to Delete

| File                                   | Reason                                                              |
| -------------------------------------- | ------------------------------------------------------------------- |
| `src/core/router/guards/auth.guard.ts` | Replaced by `src/core/guards/auth.guard.ts` (relocated + rewritten) |

#### Files to Rename

| From                            | To                                  |
| ------------------------------- | ----------------------------------- |
| `src/shared/views/NotFound.vue` | `src/shared/views/NotFoundView.vue` |

#### Route Migration

```typescript
// BEFORE (STAGE_UI_01)
meta: { requiresAuth: true }               // ✓ unchanged
meta: { guestOnly: true }                  // login pages
meta: { requiredRole: 'platform-admin' }   // role-gated pages (if any)

// AFTER (STAGE_UI_03)
meta: { requiresAuth: true }               // unchanged
meta: { public: true }                     // replaces guestOnly
meta: { requiresAuth: true, roles: ['platform-admin'] }  // replaces requiredRole
```

---

### 7.2 Backoffice

#### Files to Create

| File                                    | Content                                               |
| --------------------------------------- | ----------------------------------------------------- |
| `src/core/guards/auth.guard.ts`         | Full rewrite — canonical version                      |
| `src/core/guards/workspace.guard.ts`    | New — `createWorkspaceGuard()` factory                |
| `src/core/guards/role.guard.ts`         | New — `createRoleGuard()` factory                     |
| `src/core/guards/feature-flag.guard.ts` | New stub                                              |
| `src/core/guards/index.ts`              | Barrel — `registerGuards()` (includes WorkspaceGuard) |
| `src/shared/views/UnauthorizedView.vue` | New                                                   |
| `src/shared/views/GlobalErrorView.vue`  | New                                                   |

#### Files to Modify

| File                       | Change                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/router/index.ts` | Remove singleton exports; add `history?` param; 404 route → `bo-not-found`; add unauthorized/error routes; aggregate any existing module routes; import canonical types                              |
| `src/core/router/types.ts` | Strip `guestOnly`, `requiredRole`, `requiredModule`; add `public`, `roles[]`; keep `requiresWorkspace`; update type alias                                                                            |
| `src/main.ts`              | Transition: replace `import { router }` with `createAppRouter()`; import `useContextStore` and call `contextStore.loadContext()` in bootstrap (see §8); replace manual guard with `registerGuards()` |

#### Files to Delete

| File                                   | Reason                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `src/router/index.ts`                  | STAGE_17 legacy — inline license guard; entire file removed (FR-10.1, FR-10.2) |
| `src/core/router/guards/auth.guard.ts` | Replaced by `src/core/guards/auth.guard.ts`                                    |

#### Files to Rename

| From                            | To                                  |
| ------------------------------- | ----------------------------------- |
| `src/shared/views/NotFound.vue` | `src/shared/views/NotFoundView.vue` |

---

### 7.3 Frontoffice

#### Files to Create

| File                                    | Content                                                |
| --------------------------------------- | ------------------------------------------------------ |
| `src/core/guards/auth.guard.ts`         | Full rewrite — canonical version                       |
| `src/core/guards/role.guard.ts`         | New (placeholder for future student/guest distinction) |
| `src/core/guards/feature-flag.guard.ts` | New stub                                               |
| `src/core/guards/index.ts`              | Barrel — `registerGuards()` (no WorkspaceGuard)        |
| `src/shared/views/UnauthorizedView.vue` | New                                                    |
| `src/shared/views/GlobalErrorView.vue`  | New                                                    |

#### Files to Modify

| File                       | Change                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/router/index.ts` | Remove singleton + default exports; add `history?` param; 404 route → `fo-not-found`, `NotFoundView.vue`; add unauthorized/error routes |
| `src/core/router/types.ts` | Same as MMC                                                                                                                             |
| `src/main.ts`              | Replace `import { router }` with `createAppRouter()`; replace manual guard with `registerGuards()`                                      |

#### Files to Delete

| File                                   | Reason                                      |
| -------------------------------------- | ------------------------------------------- |
| `src/core/router/guards/auth.guard.ts` | Replaced by `src/core/guards/auth.guard.ts` |

#### Files to Rename

| From                            | To                                  |
| ------------------------------- | ----------------------------------- |
| `src/shared/views/NotFound.vue` | `src/shared/views/NotFoundView.vue` |

---

## 8. Backoffice STAGE_17 Migration Plan

### Overview

Backoffice currently has TWO router systems in parallel:

1. `src/router/index.ts` — STAGE_17: runtime singleton with inline license + module guard
2. `src/core/router/index.ts` — STAGE_UI_01: factory without guards (what `main.ts` already imports)

The `main.ts` already imports from `@/core/router` (STAGE_UI_01). The STAGE_17 file (`src/router/index.ts`) is **not referenced by main.ts** — it is an orphaned legacy file. However, it defines routes that must be evaluated during migration.

### Step-by-Step

**Step 1: Audit `src/router/index.ts`**

- Extract existing routes: `'dashboard'` (path `/`) and `'workspace-unavailable'` (path `/unavailable`)
- Note: `Dashboard.vue` component and `WorkspaceLocked.vue` component

**Step 2: Migrate routes to `core/router/index.ts`**

- `'dashboard'` route → must align with canonical naming. If a module-based route at `modules/dashboard/routes.ts` is planned, register it there. Route name: `'bo-dashboard'`
- `'workspace-unavailable'` route (WorkspaceLocked.vue) → this view remains (A5 assumption) but is NOT driven by a guard; route meta becomes `meta: { requiresAuth: true, requiresWorkspace: false }` (or simply `requiresAuth: true` since WorkspaceLocked is backend-driven via 423). This view is accessible once authenticated.

**Step 3: Add workspace-selector route**

- FR-05.6 requires a route named `'bo-workspace-selector'` with `meta: { requiresAuth: true }` (no `requiresWorkspace`)
- This route renders a workspace selection page (or the existing context loader)

**Step 4: Remove inline `beforeEach` guard**

- Delete the entire `router.beforeEach` block from `src/router/index.ts`
- Delete the `contextLoaded` sentinel variable
- Delete the dynamic `import('../stores/context')` from inside the guard

**Step 5: Relocate `contextStore.loadContext()` to `main.ts`**

- The context loading logic that was in the STAGE_17 guard must move to `main.ts` bootstrap
- Placement: after Pinia is set up, before `registerGuards()` call (so context is available when guards evaluate)

```typescript
// main.ts — new Step 7.5 (between API client creation and guard registration)
const contextStore = useContextStore(pinia)
await contextStore.loadContext() // loads workspace context once at bootstrap
```

**Step 6: Wire WorkspaceGuard**

- In `registerGuards()` call in `main.ts`:
  ```typescript
  isWorkspaceResolved: () => contextStore.context !== null
  ```
- This reads workspace **presence** (is context loaded?), NOT `isActive` (license status)

**Step 7: Strip `requiredModule` meta**

- Scan all Backoffice route definitions for `requiredModule: Module.MCQ` (or similar)
- Remove the `requiredModule` field from those route meta objects
- Remove `requiredModule` from `RouteMeta` augmentation in `types.ts`

**Step 8: Delete `src/router/index.ts`**

- File is now fully superseded; delete it

**Step 9: Remove `contextLoaded` flag**

- This state was a one-time load sentinel inside the guard; it is no longer needed since context loads at bootstrap

### Route Name Mapping

| Legacy (STAGE_17)           | Canonical (UI_03)                                                    |
| --------------------------- | -------------------------------------------------------------------- |
| `'dashboard'`               | `'bo-dashboard'`                                                     |
| `'workspace-unavailable'`   | `'bo-workspace-unavailable'` (name rename only; component unchanged) |
| _(none)_                    | `'bo-workspace-selector'` (new)                                      |
| _(catch-all `'not-found'`)_ | `'bo-not-found'`                                                     |

---

## 9. Fallback Views Plan

All three apps get three fallback view components in `shared/views/`.

### NotFoundView.vue

- **Route**: `path: '/:pathMatch(.*)*'`, `name: '<app>-not-found'`
- **Meta**: `{ public: true }`
- **Content**: "Page not found" message; link to dashboard (if authenticated) or login
- **Existing**: `NotFound.vue` exists in all apps — **rename file** to `NotFoundView.vue`; **update route definition** for new name

### UnauthorizedView.vue

- **Route**: `path: '/unauthorized'`, `name: '<app>-unauthorized'`
- **Meta**: `{ public: true }`
- **Content**: "You don't have permission to access this page" message; link to dashboard
- **Existing**: None — CREATE in all apps

### GlobalErrorView.vue

- **Route**: `path: '/error'`, `name: '<app>-error'`
- **Meta**: `{ public: true }`
- **Content**: Generic error message; "Return to dashboard" link; no error details exposed
- **Existing**: None — CREATE in all apps

### Route Name Table

| App         | NotFoundView    | UnauthorizedView   | GlobalErrorView |
| ----------- | --------------- | ------------------ | --------------- |
| MMC         | `mmc-not-found` | `mmc-unauthorized` | `mmc-error`     |
| Backoffice  | `bo-not-found`  | `bo-unauthorized`  | `bo-error`      |
| Frontoffice | `fo-not-found`  | `fo-unauthorized`  | `fo-error`      |

### `router.onError` Wiring

Registered inside `registerGuards()` in `core/guards/index.ts`:

```typescript
router.onError((_error, to) => {
  // Prevent blank screen on dynamic import failure
  router.replace({ name: errorRouteName }).catch(() => {})
})
```

`errorRouteName` is passed as an option to `registerGuards()` (e.g., `'mmc-error'`, `'bo-error'`, `'fo-error'`).

---

## 10. Redirect Strategy Implementation

### Save/Restore Pattern (AuthGuard)

**Save** (on unauthenticated access to protected route):

```typescript
// In createAuthGuard — if requiresAuth + !isAuthenticated + not already on login page
const redirectPath = to.fullPath

// Validate: only allow relative paths starting with '/'
const safeRedirect =
  redirectPath.startsWith('/') && !redirectPath.startsWith('//')
    ? redirectPath
    : undefined

return {
  name: options.loginRouteName,
  query: safeRedirect ? { redirect: safeRedirect } : undefined,
}
```

**Restore** (post-login in auth store / login page component):

```typescript
// In auth store's login() action or LoginView.vue onSubmit handler
const redirectTarget = route.query.redirect as string | undefined

if (
  redirectTarget &&
  redirectTarget.startsWith('/') &&
  !redirectTarget.startsWith('//')
) {
  await router.push(redirectTarget)
} else {
  await router.push({ name: dashboardRouteName })
}
```

Note: This implementation is in the login flow (auth store or login page), which is within STAGE_UI_01 territory. STAGE_UI_03 defines the guard half (save); the restore half is documented here for completeness but wired in the login component.

### Logout Redirect (Clear `?redirect`)

```typescript
// In auth store logout() action (already exists in STAGE_UI_01)
// After clearing state, navigate to login WITHOUT any redirect query param
await router.push({ name: loginRouteName })
// No `query: { redirect: ... }` — clean navigation clears any prior session param
```

### Open-Redirect Protection

Validation function (defined in `auth.guard.ts`, used at guard level):

```typescript
function isSafeRedirect(path: unknown): path is string {
  if (typeof path !== 'string') return false
  // Allow only relative paths: must start with '/' and not with '//'
  // '//' is a protocol-relative URL and must be rejected
  return path.startsWith('/') && !path.startsWith('//')
}
```

---

## 11. Test Strategy

### Unit Test Files (per guard, per app)

All guard unit tests are co-located in:

```
apps/<app>/tests/unit/core/guards/<guard>.test.ts
```

Or globally:

```
tests/unit/<app>/guards/<guard>.test.ts
```

**Preferred**: `apps/<app>/tests/unit/core/guards/` for locality.

#### `auth.guard.test.ts` (all 3 apps)

```
Required scenarios:
┌─────────────────────────────────────────────────────┬────────────────────────┐
│ Scenario                                            │ Expected               │
├─────────────────────────────────────────────────────┼────────────────────────┤
│ requiresAuth: true, not authenticated               │ Redirect to login+?redirect│
│ requiresAuth: true, authenticated                   │ true                   │
│ public: true, not authenticated                     │ true                   │
│ public: true, authenticated                         │ Redirect to dashboard  │
│ to.name === loginRouteName, not authenticated       │ true (loop prevention) │
│ No meta, authenticated                              │ true                   │
│ No meta, not authenticated                          │ true                   │
│ Redirect param with external URL (http://evil.com)  │ Redirect to dashboard, no redirect param│
│ Redirect param with relative path (/some/path)      │ Redirect with ?redirect=/some/path│
│ getIsAuthenticated() throws                         │ log error, return true │
└─────────────────────────────────────────────────────┴────────────────────────┘
```

#### `workspace.guard.test.ts` (Backoffice only)

```
Required scenarios:
┌─────────────────────────────────────────────────────┬────────────────────────┐
│ Scenario                                            │ Expected               │
├─────────────────────────────────────────────────────┼────────────────────────┤
│ requiresWorkspace: true, context resolved           │ true                   │
│ requiresWorkspace: true, context not resolved       │ Redirect to bo-workspace-selector│
│ requiresWorkspace: undefined                        │ true                   │
│ to.name === 'bo-workspace-selector'                 │ true (loop prevention) │
│ isWorkspaceResolved() throws                        │ log error, return true │
└─────────────────────────────────────────────────────┴────────────────────────┘
```

#### `role.guard.test.ts` (all 3 apps)

```
Required scenarios:
┌─────────────────────────────────────────────────────┬────────────────────────┐
│ Scenario                                            │ Expected               │
├─────────────────────────────────────────────────────┼────────────────────────┤
│ meta.roles: ['admin'], user.role: 'admin'           │ true                   │
│ meta.roles: ['admin'], user.role: 'viewer'          │ Redirect to unauthorized│
│ meta.roles: undefined                               │ true                   │
│ meta.roles: ['admin'], user: null                   │ Redirect to unauthorized│
│ to.name === unauthorizedRouteName                   │ true (loop prevention) │
│ getUser() throws                                    │ log error, return true │
└─────────────────────────────────────────────────────┴────────────────────────┘
```

#### `feature-flag.guard.test.ts` (all 3 apps)

```
Required scenarios:
┌─────────────────────────────────────────────────────┬────────────────────────┐
│ Scenario                                            │ Expected               │
├─────────────────────────────────────────────────────┼────────────────────────┤
│ Any route                                           │ true (always pass)     │
└─────────────────────────────────────────────────────┴────────────────────────┘
```

### Router Integration Test Files

```
apps/<app>/tests/integration/core/router/router.test.ts
```

| Test Case                                                                                      | Infrastructure                                           |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `createAppRouter()` returns a Router instance in jsdom                                         | `createMemoryHistory()` injected                         |
| Navigation to `/absolutely/undefined/path` resolves to `NotFoundView`                          | `createMemoryHistory()`, no auth                         |
| Unauthorized route renders without auth                                                        | `createMemoryHistory()`                                  |
| Error route renders without auth                                                               | `createMemoryHistory()`                                  |
| Guard registration: `beforeEach` count matches expected pipeline                               | Inspect `router.beforeEach` registrations                |
| Redirect flow: navigate to protected route while unauth → redirected to login with `?redirect` | Mock `isAuthenticated = false`, navigate to `/dashboard` |

### Test Infrastructure Requirements

- All guard unit tests call `NavigationGuard` directly (no full router instance needed)
- Create mock route objects: `createMockRoute({ name, path, meta })`
- `createAppRouter(createMemoryHistory())` for integration tests
- `createTestingPinia()` for Pinia isolation
- No global store state between tests (fresh pinia + fresh router per test)
- Guards receive mock callbacks, not stores

---

## 12. Migration Risks & Mitigations

### RISK-01: Route names used in `router.push()` across the apps

**Risk**: Several places in components and stores use `router.push({ name: 'dashboard' })` or `router.push({ name: 'not-found' })`. Renaming routes will break silent-fail navigation calls.

**Mitigation**:

- Run a codebase-wide grep for all route name strings before implementation
- Update all callers at the same time as the route definitions
- TypeScript will NOT catch string literals in `router.push()` calls — manual search required
- Specifically check: auth store `logout()` calls, post-login redirect, any component-level navigation

**Search pattern**: `grep -r "name: '" apps/mmc/src apps/backoffice/src apps/frontoffice/src`

---

### RISK-02: Backoffice `contextStore.loadContext()` relocation

**Risk**: The STAGE_17 `beforeEach` guard loaded context lazily (only on first navigation). Moving `loadContext()` to bootstrap synchronizes it at mount time. If `loadContext()` is slow or fails, the app may take longer to become interactive, or fail to mount.

**Mitigation**:

- `contextStore.loadContext()` in `main.ts` must be non-blocking for the mount step (use `await` before `registerGuards` but after API client creation)
- Error handling: if `loadContext()` throws, the error should be caught and logged; the app should still mount and redirect to an error page
- WorkspaceGuard treats `context === null` as "not resolved" — so a failed load naturally redirects to workspace-selector

```typescript
// main.ts — safe context loading
try {
  await contextStore.loadContext()
} catch (e) {
  logger.error('Failed to load workspace context at bootstrap', { error: e })
  // Guard will redirect naturally since contextStore.context === null
}
```

---

### RISK-03: Legacy singleton `export const router` removal in MMC and Frontoffice

**Risk**: The current `main.ts` in both apps imports `{ router }` (the singleton). Removing the singleton and switching to `const router = createAppRouter()` in `main.ts` requires coordinating the import change.

**Mitigation**:

- The `main.ts` change and the `router/index.ts` change must be applied atomically (same commit)
- After removing the exports, TypeScript will immediately surface any unresolved imports at compile time — run `tsc --noEmit` before marking complete

---

### RISK-04: `ForbiddenView.vue` in `shared/views/`

**Risk**: All three apps have `shared/views/ForbiddenView.vue`. The spec requires `UnauthorizedView.vue`. These may overlap in purpose.

**Mitigation**:

- `ForbiddenView.vue` is not referenced by the canonical guard pipeline (guards redirect to `<app>-unauthorized`, which uses `UnauthorizedView.vue`)
- `ForbiddenView.vue` is kept as-is (not deleted); if any existing component links to it, that link is preserved
- New `UnauthorizedView.vue` is created alongside it — no naming conflict

---

### RISK-05: `requiredModule` meta in Backoffice routes

**Risk**: The STAGE_17 router file comments out an example route with `meta: { requiredModule: Module.MCQ }`. If similar fields exist in routes that are not commented out, stripping them is a safe no-op (no guard reads them post-migration) but requires audit.

**Mitigation**:

- Since `modules/` in Backoffice currently only has `.gitkeep`, there are no module routes with `requiredModule` in active code
- The only live routes in STAGE_17 are `dashboard` and `workspace-unavailable` — neither uses `requiredModule`
- Safe to proceed; strip `requiredModule` from `RouteMeta` type definition and leave a comment noting removal in `types.ts`

---

### RISK-06: `AuthRouteMeta` alias downstream references

**Risk**: The `types.ts` convenience alias `AuthRouteMeta` (exported in all 3 apps) may be imported elsewhere.

**Mitigation**:

- Rename to `AppRouteMeta` in new implementation to signal the schema change
- Grep for `AuthRouteMeta` imports before removing — update any callers
- The `AuthRouteMeta` interface was largely unexported to tests/guards (guards use `RouteMeta` directly), so impact should be minimal

---

## Appendix A: Route Name Reference

| App         | Route                 | Name                       | Path                | Meta                                              |
| ----------- | --------------------- | -------------------------- | ------------------- | ------------------------------------------------- |
| MMC         | Dashboard             | `mmc-dashboard`            | `/`                 | `{ requiresAuth: true }`                          |
| MMC         | Login                 | `mmc-login`                | `/login`            | `{ public: true }`                                |
| MMC         | Not Found             | `mmc-not-found`            | `/:pathMatch(.*)*`  | `{ public: true }`                                |
| MMC         | Unauthorized          | `mmc-unauthorized`         | `/unauthorized`     | `{ public: true }`                                |
| MMC         | Global Error          | `mmc-error`                | `/error`            | `{ public: true }`                                |
| Backoffice  | Dashboard             | `bo-dashboard`             | `/`                 | `{ requiresAuth: true, requiresWorkspace: true }` |
| Backoffice  | Login                 | `bo-login`                 | `/login`            | `{ public: true }`                                |
| Backoffice  | Workspace Selector    | `bo-workspace-selector`    | `/select-workspace` | `{ requiresAuth: true }`                          |
| Backoffice  | Workspace Unavailable | `bo-workspace-unavailable` | `/unavailable`      | `{ requiresAuth: true }`                          |
| Backoffice  | Not Found             | `bo-not-found`             | `/:pathMatch(.*)*`  | `{ public: true }`                                |
| Backoffice  | Unauthorized          | `bo-unauthorized`          | `/unauthorized`     | `{ public: true }`                                |
| Backoffice  | Global Error          | `bo-error`                 | `/error`            | `{ public: true }`                                |
| Frontoffice | Home (dashboard)      | `fo-home`                  | `/`                 | `{ requiresAuth: true }`                          |
| Frontoffice | Login                 | `fo-login`                 | `/login`            | `{ public: true }`                                |
| Frontoffice | Not Found             | `fo-not-found`             | `/:pathMatch(.*)*`  | `{ public: true }`                                |
| Frontoffice | Unauthorized          | `fo-unauthorized`          | `/unauthorized`     | `{ public: true }`                                |
| Frontoffice | Global Error          | `fo-error`                 | `/error`            | `{ public: true }`                                |

---

## Appendix B: Constitutional Compliance

| Constraint                               | Status     | Implementation Detail                                                    |
| ---------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| Guards MUST NOT decode JWT               | ✓ ENFORCED | `createAuthGuard` reads `getIsAuthenticated()` callback only             |
| Guards MUST NOT call APIs                | ✓ ENFORCED | All callbacks are synchronous; no `fetch()` in any guard                 |
| Guards MUST NOT validate license         | ✓ ENFORCED | `WorkspaceGuard` reads `context !== null` (presence), not license status |
| Guards read AuthStore only               | ✓ ENFORCED | Injected callbacks wrap `authStore.isAuthenticated` and `authStore.user` |
| WorkspaceGuard reads WorkspaceStore only | ✓ ENFORCED | `isWorkspaceResolved: () => contextStore.context !== null`               |
| No business logic in guards              | ✓ ENFORCED | Single-responsibility: each guard evaluates one meta field               |
| Structured logging only                  | ✓ ENFORCED | `@zidney/logger` used; `console.log` absent                              |
| try/catch mandatory                      | ✓ ENFORCED | All guard factories wrap in try/catch; on error return `true`            |
| Open-redirect protection                 | ✓ ENFORCED | `isSafeRedirect()` validates paths before use                            |
