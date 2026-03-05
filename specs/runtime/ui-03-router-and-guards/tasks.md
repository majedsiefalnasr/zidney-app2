# Tasks — STAGE_UI_03_ROUTER_AND_GUARDS

**Stage**: STAGE_UI_03_ROUTER_AND_GUARDS
**Phase**: 06_UI_APPLICATION_RUNTIME
**Branch**: `ui-03-router-and-guards`
**Generated**: 2026-03-02
**Status**: READY FOR IMPLEMENTATION

---

## Implementation Strategy

**MVP Scope**: US8 (RouteMeta foundation) → US1+US2 (AuthGuard) → US3 (WorkspaceGuard) → US4 (RoleGuard) → US5+US6 (Fallback views) → Migrations → Tests → Validation.

Each phase is an independently committable increment. Run `bun run tsc --noEmit` after each phase.

---

## Phase 0: Setup — Branch & Dependency Audit

- [x] T001 Verify branch `ui-03-router-and-guards` is checked out and confirm `vue-router` version is ≥ 4.0.0 in all three apps (`apps/mmc/package.json`, `apps/backoffice/package.json`, `apps/frontoffice/package.json`)
- [x] T002 Run `grep -r "guestOnly\|requiredRole\|requiredModule\|name: '" apps/mmc/src apps/backoffice/src apps/frontoffice/src` and save output for use during route migration tasks (T031–T038)

---

## Phase 1: US8 — RouteMeta Schema Standardization (Type Foundation)

> **Story Goal**: Replace legacy `guestOnly`/`requiredRole`/`requiredModule` fields with canonical `public`/`roles[]`/`requiresWorkspace` in all three apps. This phase is the prerequisite for all guard and router tasks.
>
> **Independent Test Criteria**: `bun run tsc --noEmit` passes with zero errors in all three apps after this phase.

- [x] T003 [P] [US8] Rewrite `apps/mmc/src/core/router/types.ts` — replace `guestOnly` with `public`, replace `requiredRole: string` with `roles?: string[]`, add `requiresWorkspace?: boolean`, rename alias `AuthRouteMeta` → `AppRouteMeta`, add canonical JSDoc comments per spec §4
- [x] T004 [P] [US8] Rewrite `apps/backoffice/src/core/router/types.ts` — replace `guestOnly` with `public`, replace `requiredRole: string` with `roles?: string[]`, keep `requiresWorkspace?: boolean`, remove `requiredModule` field entirely, rename alias to `AppRouteMeta`
- [x] T005 [P] [US8] Rewrite `apps/frontoffice/src/core/router/types.ts` — replace `guestOnly` with `public`, replace `requiredRole: string` with `roles?: string[]`, add `requiresWorkspace?: boolean`, rename alias `AuthRouteMeta` → `AppRouteMeta`

---

## Phase 2: US1 + US2 — AuthGuard (All Apps)

> **Story Goal**: Protect authenticated routes and redirect authenticated users away from public routes. All three apps get a rewritten `auth.guard.ts` in the canonical `core/guards/` location.
>
> **Independent Test Criteria**: `createAuthGuard()` unit tests pass for all 10 required scenarios (T046–T048) with no DOM required.

- [x] T006 [P] [US1] Create `apps/mmc/src/core/guards/auth.guard.ts` — implement `createAuthGuard(getIsAuthenticated, options: AuthGuardOptions): NavigationGuard`; handle `requiresAuth + !auth → login+?redirect`, `public + auth → dashboard`, open-redirect validation via `isSafeRedirect()`, short-circuit if `to.name === loginRouteName`, wrap in `try/catch` with `@zidney/logger` on error
- [x] T007 [P] [US1] Create `apps/backoffice/src/core/guards/auth.guard.ts` — identical implementation to T006 with Backoffice-specific loginRouteName `'bo-login'` and dashboardRouteName `'bo-dashboard'` documented in JSDoc
- [x] T008 [P] [US1] Create `apps/frontoffice/src/core/guards/auth.guard.ts` — identical implementation to T006 with Frontoffice-specific loginRouteName `'fo-login'` and dashboardRouteName `'fo-home'` documented in JSDoc

---

## Phase 3: US3 — WorkspaceGuard (Backoffice Only)

> **Story Goal**: Block access to workspace-bound routes if no workspace context is resolved. Backoffice only.
>
> **Independent Test Criteria**: `createWorkspaceGuard()` unit test passes all 5 required scenarios (T049) without any API calls.

- [x] T009 [US3] Create `apps/backoffice/src/core/guards/workspace.guard.ts` — implement `createWorkspaceGuard(isWorkspaceResolved: () => boolean, options?: WorkspaceGuardOptions): NavigationGuard`; only activates when `to.meta.requiresWorkspace === true`; redirects to `'bo-workspace-selector'` if `!isWorkspaceResolved()`; short-circuit if `to.name === 'bo-workspace-selector'`; MUST NOT call any API or read license status; wrap in `try/catch` with structured logging

---

## Phase 4: US4 — RoleGuard + FeatureFlagGuard (All Apps)

> **Story Goal**: Gate navigation by user role (UI-hint only). Register a FeatureFlagGuard stub that always passes to reserve pipeline position 4.
>
> **Independent Test Criteria**: `createRoleGuard()` and `createFeatureFlagGuard()` unit tests pass all required scenarios (T050–T057) for all three apps.

- [x] T010 [P] [US4] Create `apps/mmc/src/core/guards/role.guard.ts` — implement `createRoleGuard(getUser: () => { role: string } | null, options: RoleGuardOptions): NavigationGuard`; skip if `to.meta.roles` is undefined/empty; redirect to `'mmc-unauthorized'` on role mismatch or null user; short-circuit if `to.name === unauthorizedRouteName`; wrap in `try/catch`
- [x] T011 [P] [US4] Create `apps/backoffice/src/core/guards/role.guard.ts` — identical implementation with `'bo-unauthorized'` as default unauthorizedRouteName in JSDoc
- [x] T012 [P] [US4] Create `apps/frontoffice/src/core/guards/role.guard.ts` — identical implementation with `'fo-unauthorized'` as default unauthorizedRouteName in JSDoc
- [x] T013 [P] [US4] Create `apps/mmc/src/core/guards/feature-flag.guard.ts` — implement `createFeatureFlagGuard(): NavigationGuard` stub that always returns `true`; include required comment `// TODO(STAGE_UI_XX): Implement feature flag evaluation when feature flag service is ready.`
- [x] T014 [P] [US4] Create `apps/backoffice/src/core/guards/feature-flag.guard.ts` — identical stub to T013
- [x] T015 [P] [US4] Create `apps/frontoffice/src/core/guards/feature-flag.guard.ts` — identical stub to T013

---

## Phase 5: Guard Pipeline Barrels (All Apps)

> **Story Goal**: Encapsulate the full guard pipeline in a single `registerGuards()` function per app, callable from `main.ts`.
>
> **Independent Test Criteria**: `registerGuards()` can be called in a test with a `createMemoryHistory()` router without errors.

- [x] T016 [P] Create `apps/mmc/src/core/guards/index.ts` — export `RegisterGuardsOptions` interface and `registerGuards(router, options)` function; pipeline order: sessionInitialized gate → AuthGuard → RoleGuard → FeatureFlagGuard; register `router.onError` handler redirecting to `errorRouteName` (MMC: `'mmc-error'`); add `errorRouteName` to `RegisterGuardsOptions`
- [x] T017 [P] Create `apps/backoffice/src/core/guards/index.ts` — export `RegisterGuardsOptions` interface and `registerGuards(router, options)` function; pipeline order: sessionInitialized gate → AuthGuard → WorkspaceGuard → RoleGuard → FeatureFlagGuard; include `isWorkspaceResolved: () => boolean` in options; register `router.onError` handler redirecting to `'bo-error'`
- [x] T018 [P] Create `apps/frontoffice/src/core/guards/index.ts` — export `RegisterGuardsOptions` interface and `registerGuards(router, options)` function; pipeline: sessionInitialized gate → AuthGuard → RoleGuard → FeatureFlagGuard; register `router.onError` handler redirecting to `'fo-error'`

---

## Phase 6: US7 — Router Factory Updates (All Apps)

> **Story Goal**: Each app exports a `createAppRouter(history?)` factory with no singleton. Fallback routes added. Guards NOT registered here.
>
> **Independent Test Criteria**: `createAppRouter(createMemoryHistory())` returns a Router instance; catch-all route resolves to NotFoundView; unauthorized and error routes exist.

- [x] T019 [P] [US7] Update `apps/mmc/src/core/router/index.ts` — remove `export const router = createAppRouter()` singleton export and any `export default router`; add `history?: RouterHistory` parameter to factory; add route for `mmc-unauthorized` (`/unauthorized`, NotFoundView, `meta: { public: true }`); add route for `mmc-error` (`/error`, GlobalErrorView, `meta: { public: true }`); update catch-all route name to `'mmc-not-found'` and component to `NotFoundView.vue`; update import path for NotFoundView; ensure NO guards are registered inside this file
- [x] T020 [P] [US7] Update `apps/backoffice/src/core/router/index.ts` — remove singleton exports; add `history?: RouterHistory` param; add route `bo-unauthorized` (`/unauthorized`, UnauthorizedView, `meta: { public: true }`); add route `bo-error` (`/error`, GlobalErrorView, `meta: { public: true }`); add route `bo-workspace-selector` (`/select-workspace`, placeholder component or deferred import, `meta: { requiresAuth: true }`); add route `bo-workspace-unavailable` (`/unavailable`, `meta: { requiresAuth: true }`); update catch-all to `'bo-not-found'` + `NotFoundView.vue`; add dashboard route `'bo-dashboard'` (`/`, `meta: { requiresAuth: true, requiresWorkspace: true }`) if not covered by module route
- [x] T021 [P] [US7] Update `apps/frontoffice/src/core/router/index.ts` — remove singleton export (`export const router`) and default export (`export default router`); add `history?: RouterHistory` param; add route `fo-unauthorized` (`/unauthorized`, UnauthorizedView, `meta: { public: true }`); add route `fo-error` (`/error`, GlobalErrorView, `meta: { public: true }`); update catch-all to `'fo-not-found'` + `NotFoundView.vue`; ensure NO guards are registered inside this file

---

## Phase 7: US5 + US6 — Fallback Views (All Apps)

> **Story Goal**: Each app has NotFoundView, UnauthorizedView, and GlobalErrorView in `shared/views/`. All are publicly accessible.
>
> **Independent Test Criteria**: Navigating to `/undefined-path` renders NotFoundView; navigating to `/unauthorized` renders UnauthorizedView; navigating to `/error` renders GlobalErrorView — all without authentication.

- [x] T022 [P] [US5] Rename `apps/mmc/src/shared/views/NotFound.vue` → `apps/mmc/src/shared/views/NotFoundView.vue` and update all import references within the MMC app
- [x] T023 [P] [US5] Rename `apps/backoffice/src/shared/views/NotFound.vue` → `apps/backoffice/src/shared/views/NotFoundView.vue` and update all import references within the Backoffice app
- [x] T024 [P] [US5] Rename `apps/frontoffice/src/shared/views/NotFound.vue` → `apps/frontoffice/src/shared/views/NotFoundView.vue` and update all import references within the Frontoffice app
- [x] T025 [P] [US6] Create `apps/mmc/src/shared/views/UnauthorizedView.vue` — display "You don't have permission to access this page"; include `<RouterLink :to="{ name: 'mmc-dashboard' }">` back to dashboard; no `requiresAuth` meta needed (component is public)
- [x] T026 [P] [US6] Create `apps/backoffice/src/shared/views/UnauthorizedView.vue` — display unauthorized message; include link to `'bo-dashboard'`
- [x] T027 [P] [US6] Create `apps/frontoffice/src/shared/views/UnauthorizedView.vue` — display unauthorized message; include link to `'fo-home'`
- [x] T028 [P] Create `apps/mmc/src/shared/views/GlobalErrorView.vue` — display generic error message "Something went wrong"; include "Return to Dashboard" link to `'mmc-dashboard'`; do NOT expose error details; component-level `<script setup>` only (CL-01)
- [x] T029 [P] Create `apps/backoffice/src/shared/views/GlobalErrorView.vue` — same pattern as T028, link to `'bo-dashboard'`
- [x] T030 [P] Create `apps/frontoffice/src/shared/views/GlobalErrorView.vue` — same pattern as T028, link to `'fo-home'`

---

## Phase 8: Route Meta Migrations (US8 Completion)

> **Story Goal**: All existing route definitions use canonical meta fields. `guestOnly` and `requiredRole` removed from all route files.
>
> **Independent Test Criteria**: `grep -r "guestOnly\|requiredRole\|requiredModule" apps/` returns zero results.

- [x] T031 [P] [US8] Update `apps/mmc/src/modules/dashboard/routes.ts` — rename route name `'dashboard'` → `'mmc-dashboard'`; verify `meta: { requiresAuth: true }` is present
- [x] T032 [P] [US8] Update `apps/mmc/src/modules/licenses/routes.ts` — rename all route names to `'mmc-*'` prefix; replace any `guestOnly: true` with `public: true`; replace any `requiredRole: '<value>'` with `roles: ['<value>']`
- [x] T033 [US8] Audit all Backoffice module route files (`apps/backoffice/src/modules/**/routes.ts`) — replace `guestOnly: true` with `public: true`; replace `requiredRole: '<value>'` with `roles: ['<value>']`; remove `requiredModule` field from every route meta; rename any non-prefixed route names to `'bo-*'` prefix
- [x] T034 [US8] Audit all Frontoffice module route files (`apps/frontoffice/src/modules/**/routes.ts`) — replace `guestOnly: true` with `public: true`; replace `requiredRole: '<value>'` with `roles: ['<value>']`; rename any non-prefixed route names to `'fo-*'` prefix
- [x] T035 Audit remaining component and store files that call `router.push({ name: '<old-name>' })` — specifically check `apps/mmc/src`, `apps/backoffice/src`, `apps/frontoffice/src` for hardcoded route names `'dashboard'`, `'not-found'`, `'login'` and update all callers to use the canonical `mmc-*`/`bo-*`/`fo-*` prefixed names

---

## Phase 9: Backoffice STAGE_17 Migration (FR-10, Sequential)

> **Story Goal**: Remove the legacy inline license guard (`apps/backoffice/src/router/index.ts`) and migrate its routes and bootstrap logic to the canonical system. Guards must NOT check license status.
>
> **Independent Test Criteria**: Application mounts without importing from `src/router/index.ts`; `isActive` check is absent from all guard code; `contextStore.loadContext()` is called in `main.ts`.

- [x] T036 Extract routes from `apps/backoffice/src/router/index.ts` — document the `'dashboard'` route (component: `Dashboard.vue`) and `'workspace-unavailable'` route (component: `WorkspaceLocked.vue`) so they can be verified as covered by the updated `core/router/index.ts` in T020
- [x] T037 Remove the entire `router.beforeEach` guard block from `apps/backoffice/src/router/index.ts` — delete the `contextLoaded` sentinel variable, the dynamic `import('../stores/context')` call inside the guard, and the `isActive` license status check (FR-10.2); this file will be deleted in T039 but the inline guard must be explicitly noted as removed
- [x] T038 Verify `apps/backoffice/src/core/router/index.ts` (updated in T020) includes `'bo-dashboard'`, `'bo-workspace-unavailable'`, and `'bo-workspace-selector'` routes, confirming all STAGE_17 routes are migrated
- [x] T039 Delete `apps/backoffice/src/router/index.ts` — entire STAGE_17 legacy file is now superseded (FR-10.1); confirm no remaining imports reference this file before deletion

---

## Phase 10: Singleton Export Removal + main.ts Updates (All Apps)

> **Story Goal**: All three apps call `createAppRouter()` in `main.ts` directly (no singleton import); `registerGuards()` replaces manual `router.beforeEach` wiring.
>
> **Independent Test Criteria**: TypeScript compilation shows no "missing export" errors; `grep -r "export const router\|export default router" apps/*/src/core/router/index.ts` returns zero results.

- [x] T040 [P] Delete `apps/mmc/src/core/router/guards/auth.guard.ts` — superseded by `apps/mmc/src/core/guards/auth.guard.ts` created in T006; confirm no remaining imports reference the old path before deletion
- [x] T041 [P] Delete `apps/backoffice/src/core/router/guards/auth.guard.ts` — superseded by T007; confirm no remaining imports reference the old path
- [x] T042 [P] Delete `apps/frontoffice/src/core/router/guards/auth.guard.ts` — superseded by T008; confirm no remaining imports reference the old path
- [x] T043 [P] Update `apps/mmc/src/main.ts` — replace `import { router } from '@/core/router'` with `import { createAppRouter } from '@/core/router'` and `const router = createAppRouter()`; import `registerGuards` from `@/core/guards`; replace all manual `router.beforeEach(...)` calls with `registerGuards(router, { isAuthenticated: () => authStore.isAuthenticated, getUser: () => authStore.user, loginRouteName: 'mmc-login', dashboardRouteName: 'mmc-dashboard', unauthorizedRouteName: 'mmc-unauthorized', errorRouteName: 'mmc-error', initSession: () => authStore.initSession() })`
- [x] T044 Update `apps/backoffice/src/main.ts` — replace singleton `import { router }` with `createAppRouter()` call; import `useContextStore` and add `try/catch`-wrapped `await contextStore.loadContext()` AFTER Pinia setup and BEFORE `registerGuards()` call; call `registerGuards(router, { isAuthenticated: ..., isWorkspaceResolved: () => contextStore.context !== null, getUser: ..., loginRouteName: 'bo-login', dashboardRouteName: 'bo-dashboard', unauthorizedRouteName: 'bo-unauthorized', errorRouteName: 'bo-error', initSession: () => authStore.initSession() })`
- [x] T045 [P] Update `apps/frontoffice/src/main.ts` — replace `import { router }` and any `import router from` with `createAppRouter()` call; replace manual `router.beforeEach(...)` with `registerGuards(router, { isAuthenticated: () => authStore.isAuthenticated, getUser: () => authStore.user, loginRouteName: 'fo-login', dashboardRouteName: 'fo-home', unauthorizedRouteName: 'fo-unauthorized', errorRouteName: 'fo-error', initSession: () => authStore.initSession() })`

---

## Phase 11: US10 — Unit Tests (Guards, All Apps)

> **Story Goal**: Every guard factory is independently unit-testable via injected callbacks. All scenarios from the test matrix (plan.md §11) are covered.
>
> **Independent Test Criteria**: `bun run test` passes all guard unit tests with no real stores or mounted components.

### AuthGuard Tests (US1 + US2)

- [x] T046 [P] [US10] Create `apps/mmc/src/core/guards/__tests__/auth.guard.spec.ts` — cover all 10 required scenarios: `requiresAuth+!auth→login+?redirect`, `requiresAuth+auth→true`, `public+!auth→true`, `public+auth→dashboard`, `to.name===loginRouteName+!auth→true (loop prevention)`, `no meta+auth→true`, `no meta+!auth→true`, `redirect param with external URL→login without param`, `redirect param with relative path→login+?redirect`, `getIsAuthenticated() throws→log error+return true`
- [x] T047 [P] [US10] Create `apps/backoffice/src/core/guards/__tests__/auth.guard.spec.ts` — same 10 scenarios with Backoffice route names (`bo-login`, `bo-dashboard`)
- [x] T048 [P] [US10] Create `apps/frontoffice/src/core/guards/__tests__/auth.guard.spec.ts` — same 10 scenarios with Frontoffice route names (`fo-login`, `fo-home`)

### WorkspaceGuard Tests (US3, Backoffice Only)

- [x] T049 [US10] Create `apps/backoffice/src/core/guards/__tests__/workspace.guard.spec.ts` — cover all 5 required scenarios: `requiresWorkspace+resolved→true`, `requiresWorkspace+!resolved→bo-workspace-selector`, `requiresWorkspace undefined→true`, `to.name==='bo-workspace-selector'→true (loop prevention)`, `isWorkspaceResolved() throws→log error+return true`

### RoleGuard Tests (US4)

- [x] T050 [P] [US10] Create `apps/mmc/src/core/guards/__tests__/role.guard.spec.ts` — cover all 6 required scenarios: `roles:['admin']+user.role:'admin'→true`, `roles:['admin']+user.role:'viewer'→mmc-unauthorized`, `roles undefined→true`, `roles:['admin']+user:null→mmc-unauthorized`, `to.name===unauthorizedRouteName→true (loop prevention)`, `getUser() throws→log error+return true`
- [x] T051 [P] [US10] Create `apps/backoffice/src/core/guards/__tests__/role.guard.spec.ts` — same 6 scenarios with `bo-unauthorized`
- [x] T052 [P] [US10] Create `apps/frontoffice/src/core/guards/__tests__/role.guard.spec.ts` — same 6 scenarios with `fo-unauthorized`

### FeatureFlagGuard Tests

- [x] T053 [P] [US10] Create `apps/mmc/src/core/guards/__tests__/feature-flag.guard.spec.ts` — single scenario: any route returns `true`; verify guard never redirects
- [x] T054 [P] [US10] Create `apps/backoffice/src/core/guards/__tests__/feature-flag.guard.spec.ts` — same scenario
- [x] T055 [P] [US10] Create `apps/frontoffice/src/core/guards/__tests__/feature-flag.guard.spec.ts` — same scenario

---

## Phase 12: US10 — Integration Tests (Router Factory, All Apps)

> **Story Goal**: `createAppRouter()` is verifiable in a jsdom environment with memory history. Guard registration and fallback route behavior are confirmed end-to-end.
>
> **Independent Test Criteria**: All router integration tests pass with `createMemoryHistory()` and `createTestingPinia()`; no real browser or DOM required.

- [x] T056 [P] [US10] Create `apps/mmc/tests/integration/core/router/router.test.ts` — cover: `createAppRouter(createMemoryHistory())` returns Router instance; navigation to undefined path resolves `NotFoundView`; navigation to `/unauthorized` renders `UnauthorizedView` without auth; navigation to `/error` renders `GlobalErrorView` without auth; `registerGuards()` adds `beforeEach` hook; redirect flow: navigate to protected route while `isAuthenticated=false` → redirect to `mmc-login` with `?redirect=/protected-path`
- [x] T057 [P] [US10] Create `apps/backoffice/tests/integration/core/router/router.test.ts` — same structure plus: navigation to workspace-bound route while `isWorkspaceResolved=false → bo-workspace-selector`; WorkspaceGuard not triggered on non-`requiresWorkspace` routes
- [x] T058 [P] [US10] Create `apps/frontoffice/tests/integration/core/router/router.test.ts` — same structure as MMC with Frontoffice route names

---

## Phase 13: Validation

> All phases complete. Run full validation suite.

- [x] T059 Run `bun run tsc --noEmit` in workspace root — zero TypeScript errors expected; all RouteMeta augmentations valid under strict mode; all router factories return typed Router instances
- [x] T060 Run `bun run lint` in workspace root — zero ESLint errors expected; no `console.log`, no `any` in guard files, no import boundary violations
- [x] T061 Run `grep -r "guestOnly\|requiredRole\|requiredModule" apps/mmc/src apps/backoffice/src apps/frontoffice/src` — must return zero results confirming complete migration of legacy meta fields (AC8.2, AC8.3)
- [x] T062 Run `grep -r "export const router\|export default router" apps/mmc/src/core/router apps/backoffice/src/core/router apps/frontoffice/src/core/router` — must return zero results confirming singleton removal (CL-05)
- [x] T063 Run `grep -r "isActive" apps/backoffice/src/core/guards apps/backoffice/src/core/router` — must return zero results confirming license status check is absent from all guard and router code (FR-10.2)

---

## Dependencies (Completion Order)

```
T001–T002 (setup audit)
    │
    ▼
T003–T005 (RouteMeta types — US8 foundation)
    │
    ├─▶ T006–T008 (AuthGuard — all apps)
    │       │
    │       ▼
    │   T009 (WorkspaceGuard — Backoffice)
    │       │
    │       ▼
    │   T010–T015 (RoleGuard + FeatureFlagGuard — all apps)
    │       │
    │       ▼
    │   T016–T018 (Guard barrels — registerGuards)
    │
    ├─▶ T019–T021 (Router factory updates — depends on T003–T005)
    │
    ├─▶ T022–T030 (Fallback views — independent after T003)
    │
    ├─▶ T031–T035 (Route meta migrations — depends on T003–T005)
    │
    └─▶ T036–T039 (Backoffice STAGE_17 migration — sequential, depends on T020)
            │
            ▼
        T040–T045 (Old guard deletion + main.ts updates — depends on T016–T018, T019–T021, T036–T039)
            │
            ▼
        T046–T055 (Unit tests — depends on T006–T015)
            │
            ▼
        T056–T058 (Integration tests — depends on T016–T021)
            │
            ▼
        T059–T063 (Validation — all prior phases complete)
```

---

## Parallel Execution Groups

### Group A (after T001–T005 complete — all independent):

T006, T007, T008, T010, T011, T012, T013, T014, T015, T019, T020, T021, T022, T023, T024, T025, T026, T027, T028, T029, T030, T031, T032

### Group B (after Group A — sequential within Backoffice):

T009 (after T008), T016 (after T006+T010+T013), T017 (after T007+T009+T011+T014), T018 (after T008+T012+T015)

### Group C (after T036–T039):

T040, T041, T042 (parallel deletions), then T043, T044, T045 (main.ts updates — T044 sequential, T043/T045 parallel)

### Group D (after all implementation — run in parallel):

T046–T055 (unit tests), T056–T058 (integration tests)

---

## Task Count Summary

| Phase                                 | Tasks     | Parallel | Sequential |
| ------------------------------------- | --------- | -------- | ---------- |
| Phase 0: Setup                        | T001–T002 | 0        | 2          |
| Phase 1: RouteMeta (US8 foundation)   | T003–T005 | 3        | 0          |
| Phase 2: AuthGuard (US1+US2)          | T006–T008 | 3        | 0          |
| Phase 3: WorkspaceGuard (US3)         | T009      | 0        | 1          |
| Phase 4: RoleGuard + FFGuard (US4)    | T010–T015 | 6        | 0          |
| Phase 5: Guard Barrels                | T016–T018 | 3        | 0          |
| Phase 6: Router Factory (US7)         | T019–T021 | 3        | 0          |
| Phase 7: Fallback Views (US5+US6)     | T022–T030 | 9        | 0          |
| Phase 8: Route Migrations (US8)       | T031–T035 | 2        | 3          |
| Phase 9: Backoffice STAGE_17 (FR-10)  | T036–T039 | 0        | 4          |
| Phase 10: Singleton Removal + main.ts | T040–T045 | 4        | 2          |
| Phase 11: Unit Tests (US10)           | T046–T055 | 9        | 1          |
| Phase 12: Integration Tests (US10)    | T056–T058 | 3        | 0          |
| Phase 13: Validation                  | T059–T063 | 0        | 5          |
| **TOTAL**                             | **63**    | **45**   | **18**     |
