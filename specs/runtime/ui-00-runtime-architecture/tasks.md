# Tasks — STAGE_UI_00_RUNTIME_ARCHITECTURE

**Stage**: STAGE_UI_00_RUNTIME_ARCHITECTURE  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Generated**: 2026-02-28  
**Spec**: `specs/runtime/ui-00-runtime-architecture/spec.md`  
**Plan**: `specs/runtime/ui-00-runtime-architecture/plan.md`  
**Research**: `specs/runtime/ui-00-runtime-architecture/research.md`

---

## Summary

| Phase     | Label                    | Tasks          |
| --------- | ------------------------ | -------------- |
| 1         | Dependencies & Config    | T001–T014 (14) |
| 2         | MMC Delta Migration      | T015–T057 (43) |
| 3         | Core Layer — All 3 Apps  | T058–T120 (63) |
| 4         | ESLint Import Boundaries | T121–T126 (6)  |
| 5         | Tests                    | T127–T154 (28) |
| 6         | Validation Gate          | T155–T166 (12) |
| **Total** |                          | **166 tasks**  |

---

## Dependency Order

```
Phase 1 (Config) → Phase 2 (Migration) → Phase 3 (Core Layer) → Phase 4 (ESLint) → Phase 5 (Tests) → Phase 6 (Gate)

Within Phase 3:
  Sub-A (env.ts, errors/) → Sub-B (token-store.ts) → Sub-C (client.ts) → Sub-D (guards) → Sub-E (router) → Sub-F (state, useAuth) → Sub-G (module stubs) → Sub-H (shared/) → Sub-I (main.ts, App.vue)
```

---

## Phase 1 — Dependencies & Config

> Foundation — must complete before all other phases. Adds Pinia to all apps and creates the missing project configs for backoffice and frontoffice.

**Independent test criteria**: All three apps have valid `package.json`, `tsconfig.json`, and `vite.config.ts`. Running `tsc --noEmit` resolves `@/` alias without errors.

- [ ] T001 [SCAFFOLD] Update apps/mmc/package.json — add `"pinia": "^2.2.0"` to dependencies and `"@pinia/testing": "^0.1.6"`, `"@vue/test-utils": "^2.4.0"` to devDependencies
- [ ] T002 [SCAFFOLD] Update apps/mmc/tsconfig.json — add `"baseUrl": "."` and `"paths": { "@/*": ["./src/*"] }` to compilerOptions to align TypeScript resolver with Vite runtime alias
- [ ] T003 [P] [SCAFFOLD] Create apps/backoffice/package.json — Vue 3.4, vue-router v4, pinia v2.2, @zidney/ui-system workspace:\*, devDeps: @vitejs/plugin-vue, @pinia/testing, @vue/test-utils, typescript, vite, vitest
- [ ] T004 [P] [SCAFFOLD] Create apps/backoffice/tsconfig.json — extends ../../tsconfig.base.json, adds `"baseUrl": "."` and `"paths": { "@/*": ["./src/*"] }`, includes src/\*\*
- [ ] T005 [P] [SCAFFOLD] Create apps/backoffice/tsconfig.app.json — scoped to `src/**/*.ts`, `src/**/*.vue`, `src/**/*.d.ts`
- [ ] T006 [P] [SCAFFOLD] Create apps/backoffice/vite.config.ts — @vitejs/plugin-vue, `@/` alias to `./src`, `@zidney/ui` alias to `../../packages/ui-system/src`
- [ ] T007 [P] [SCAFFOLD] Create apps/backoffice/index.html — Vite entry HTML with `<div id="app"></div>` and `<script type="module" src="/src/main.ts">`
- [ ] T008 [P] [SCAFFOLD] Create apps/backoffice/.env.example — `VITE_API_BASE_URL=` and `VITE_WORKSPACE_SLUG=` placeholders
- [ ] T009 [P] [SCAFFOLD] Create apps/frontoffice/package.json — Vue 3.4, vue-router v4, pinia v2.2, @zidney/ui-system workspace:\*, devDeps: @vitejs/plugin-vue, @pinia/testing, @vue/test-utils, typescript, vite, vitest
- [ ] T010 [P] [SCAFFOLD] Create apps/frontoffice/tsconfig.json — extends ../../tsconfig.base.json, adds `"baseUrl": "."` and `"paths": { "@/*": ["./src/*"] }`, includes src/\*\*
- [ ] T011 [P] [SCAFFOLD] Create apps/frontoffice/tsconfig.app.json — scoped to `src/**/*.ts`, `src/**/*.vue`, `src/**/*.d.ts`
- [ ] T012 [P] [SCAFFOLD] Create apps/frontoffice/vite.config.ts — @vitejs/plugin-vue, `@/` alias to `./src`, `@zidney/ui` alias to `../../packages/ui-system/src`
- [ ] T013 [P] [SCAFFOLD] Create apps/frontoffice/index.html — Vite entry HTML with `<div id="app"></div>` and `<script type="module" src="/src/main.ts">`
- [ ] T014 [P] [SCAFFOLD] Create apps/frontoffice/.env.example — `VITE_API_BASE_URL=` placeholder

---

## Phase 2 — MMC Delta Migration

> Migrate all 35 non-canonical MMC files to the canonical directory layout per the complete delta map in research.md §R-01. All moves within each sub-group are parallel. Sub-group order: dir scaffold → dashboard → licenses → shared/lib → import-updates → cleanup → test-fixes.

**Independent test criteria**: After migration, `apps/mmc/src/` contains no `api/`, `stores/`, `views/`, `components/`, or `lib/` directories. All 4 existing MMC test files import without broken path errors.

### 2A — Create Target Directory Structure

- [ ] T015 [MMC-DELTA] Create canonical module and shared directories in apps/mmc/src/ — mkdir `src/modules/dashboard/components/`, `src/modules/dashboard/views/`, `src/modules/licenses/components/`, `src/modules/licenses/views/`, `src/shared/components/`, `src/shared/composables/`, `src/shared/utils/`

### 2B — Move Dashboard Module Files

- [ ] T016 [P] [MMC-DELTA] Move apps/mmc/src/api/dashboard-client.ts → apps/mmc/src/modules/dashboard/api.ts
- [ ] T017 [P] [MMC-DELTA] Move apps/mmc/src/stores/dashboard-store.ts → apps/mmc/src/modules/dashboard/store.ts
- [ ] T018 [P] [MMC-DELTA] Move + rename apps/mmc/src/views/Dashboard.vue → apps/mmc/src/modules/dashboard/views/DashboardView.vue
- [ ] T019 [P] [MMC-DELTA] Move apps/mmc/src/components/Dashboard/AffiliateLeaderboard.vue → apps/mmc/src/modules/dashboard/components/AffiliateLeaderboard.vue
- [ ] T020 [P] [MMC-DELTA] Move apps/mmc/src/components/Dashboard/CommercialHealth.vue → apps/mmc/src/modules/dashboard/components/CommercialHealth.vue
- [ ] T021 [P] [MMC-DELTA] Move apps/mmc/src/components/Dashboard/DataExport.vue → apps/mmc/src/modules/dashboard/components/DataExport.vue
- [ ] T022 [P] [MMC-DELTA] Move apps/mmc/src/components/Dashboard/GeographicDistribution.vue → apps/mmc/src/modules/dashboard/components/GeographicDistribution.vue
- [ ] T023 [P] [MMC-DELTA] Move apps/mmc/src/components/Dashboard/GrowthTrends.vue → apps/mmc/src/modules/dashboard/components/GrowthTrends.vue
- [ ] T024 [P] [MMC-DELTA] Move apps/mmc/src/components/Dashboard/RevenueBreakdown.vue → apps/mmc/src/modules/dashboard/components/RevenueBreakdown.vue

### 2C — Move Licenses Module Files

- [ ] T025 [P] [MMC-DELTA] Move apps/mmc/src/views/licenses/LicenseDetailView.vue → apps/mmc/src/modules/licenses/views/LicenseDetailView.vue
- [ ] T026 [P] [MMC-DELTA] Move apps/mmc/src/views/licenses/LicenseList.vue → apps/mmc/src/modules/licenses/views/LicenseList.vue
- [ ] T027 [P] [MMC-DELTA] Move apps/mmc/src/views/licenses/LicenseListView.vue → apps/mmc/src/modules/licenses/views/LicenseListView.vue
- [ ] T028 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/AdminAccountDisplay.vue → apps/mmc/src/modules/licenses/components/AdminAccountDisplay.vue
- [ ] T029 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/AuditLogViewer.vue → apps/mmc/src/modules/licenses/components/AuditLogViewer.vue
- [ ] T030 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/ErrorMessage.vue → apps/mmc/src/modules/licenses/components/ErrorMessage.vue
- [ ] T031 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/GracePeriodProgress.vue → apps/mmc/src/modules/licenses/components/GracePeriodProgress.vue
- [ ] T032 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/LicenseActions.vue → apps/mmc/src/modules/licenses/components/LicenseActions.vue
- [ ] T033 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/LicenseBulkActions.vue → apps/mmc/src/modules/licenses/components/LicenseBulkActions.vue
- [ ] T034 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/LicenseCreateForm.vue → apps/mmc/src/modules/licenses/components/LicenseCreateForm.vue
- [ ] T035 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/LicenseEditForm.vue → apps/mmc/src/modules/licenses/components/LicenseEditForm.vue
- [ ] T036 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/LicensePagination.vue → apps/mmc/src/modules/licenses/components/LicensePagination.vue
- [ ] T037 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/LicenseQuotaDisplay.vue → apps/mmc/src/modules/licenses/components/LicenseQuotaDisplay.vue
- [ ] T038 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/LicenseReportExport.vue → apps/mmc/src/modules/licenses/components/LicenseReportExport.vue
- [ ] T039 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/LicenseSearch.vue → apps/mmc/src/modules/licenses/components/LicenseSearch.vue
- [ ] T040 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/LicenseStatusBadge.vue → apps/mmc/src/modules/licenses/components/LicenseStatusBadge.vue
- [ ] T041 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/LicenseStatusTransitionConfirm.vue → apps/mmc/src/modules/licenses/components/LicenseStatusTransitionConfirm.vue
- [ ] T042 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/ProvisioningStatus.vue → apps/mmc/src/modules/licenses/components/ProvisioningStatus.vue
- [ ] T043 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/RetryProvisioningButton.vue → apps/mmc/src/modules/licenses/components/RetryProvisioningButton.vue
- [ ] T044 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/RoleBasedMenu.vue → apps/mmc/src/modules/licenses/components/RoleBasedMenu.vue
- [ ] T045 [P] [MMC-DELTA] Move apps/mmc/src/components/licenses/SoftLockDisplay.vue → apps/mmc/src/modules/licenses/components/SoftLockDisplay.vue
- [ ] T046 [P] [MMC-DELTA] Move apps/mmc/src/components/LicenseDeletionDialog.vue → apps/mmc/src/modules/licenses/components/LicenseDeletionDialog.vue
- [ ] T047 [P] [MMC-DELTA] Move apps/mmc/src/components/LicenseDetailPage.vue → apps/mmc/src/modules/licenses/components/LicenseDetailPage.vue

### 2D — Move Shared / Lib Files

- [ ] T048 [P] [MMC-DELTA] Move apps/mmc/src/components/AuditTrailViewer.vue → apps/mmc/src/shared/components/AuditTrailViewer.vue
- [ ] T049 [P] [MMC-DELTA] Move apps/mmc/src/components/JobStatusMonitor.vue → apps/mmc/src/shared/components/JobStatusMonitor.vue
- [ ] T050 [P] [MMC-DELTA] Move apps/mmc/src/lib/utils.ts → apps/mmc/src/shared/utils/utils.ts

### 2E — Update Internal Imports in Moved Files

- [ ] T051 [MMC-DELTA] Update all cross-file imports inside moved apps/mmc/src/modules/ and apps/mmc/src/shared/ files — replace legacy relative paths pointing to `../../api/`, `../../stores/`, `../../components/`, `../../lib/` with new canonical `@/modules/` and `@/shared/` paths

### 2F — Delete Legacy Directories

- [ ] T052 [MMC-DELTA] Delete empty legacy directories from apps/mmc/src/ — remove `src/api/`, `src/stores/`, `src/views/`, `src/components/`, `src/lib/` after confirming all files migrated

### 2G — Fix Broken Test Import Paths

- [ ] T053 [P] [MMC-DELTA] Update import paths in apps/mmc/tests/audit/dashboard-compliance.test.ts — replace `../../src/api/dashboard-client` with `../../src/modules/dashboard/api` and `../../src/stores/dashboard-store` with `../../src/modules/dashboard/store`
- [ ] T054 [P] [MMC-DELTA] Update import paths in apps/mmc/tests/e2e/dashboard-errors.test.ts — replace all `../../src/api/` and `../../src/stores/` references with canonical `../../src/modules/dashboard/` paths
- [ ] T055 [P] [MMC-DELTA] Update import paths in apps/mmc/tests/e2e/dashboard-integration.test.ts — replace all `../../src/api/` and `../../src/stores/` references with canonical `../../src/modules/dashboard/` paths
- [ ] T056 [P] [MMC-DELTA] Update import paths in apps/mmc/tests/performance/dashboard-perf.test.ts — replace all `../../src/api/` and `../../src/stores/` references with canonical `../../src/modules/dashboard/` paths

### 2H — Verify MMC Entry Files

- [ ] T057 [MMC-DELTA] Verify or create apps/mmc/src/main.ts and apps/mmc/src/App.vue — research.md confirmed these are missing; create stubs if absent (will be replaced in Phase 3)

---

## Phase 3 — Core Layer: All 3 Apps

> Create the canonical core infrastructure files in dependency order. Sub-groups A–I match the implementation order from plan.md §8. All tasks marked [P] within a sub-group can execute concurrently across apps.

**Independent test criteria**: TypeScript strict-mode compile (`tsc --noEmit`) passes with zero errors in all three apps. Apps start without console errors under `vite dev`.

### 3A — Environment Config & Error Types

- [ ] T058 [P] [ENV] Create apps/mmc/src/core/config/env.ts — `AppConfig` interface, `resolveConfig()` with VITE_API_BASE_URL validation, throws descriptive error on missing var, exports `appConfig` singleton
- [ ] T059 [P] [ENV] Create apps/backoffice/src/core/config/env.ts — same pattern as MMC; also validates optional `VITE_WORKSPACE_SLUG` for dev environment
- [ ] T060 [P] [ENV] Create apps/frontoffice/src/core/config/env.ts — same pattern as MMC; Frontoffice has no workspace slug env var
- [ ] T061 [P] [ERROR] Create apps/mmc/src/core/errors/types.ts — `NormalizedError { code: string; message: string; httpStatus: number }` and `ApiErrorResponse { success: false; data: null; error: { code: string; message: string } }` interfaces
- [ ] T062 [P] [ERROR] Create apps/backoffice/src/core/errors/types.ts — identical to MMC errors/types.ts
- [ ] T063 [P] [ERROR] Create apps/frontoffice/src/core/errors/types.ts — identical to MMC errors/types.ts
- [ ] T064 [P] [ERROR] Create apps/mmc/src/core/errors/error-normalizer.ts — pure `normalizeError(raw: unknown): NormalizedError` handling standard API error shape, `TypeError`/network error → NETWORK_ERROR code, unknown shape → UNKNOWN_ERROR code; no Vue/Pinia/Router imports
- [ ] T065 [P] [ERROR] Create apps/backoffice/src/core/errors/error-normalizer.ts — identical pure function to MMC
- [ ] T066 [P] [ERROR] Create apps/frontoffice/src/core/errors/error-normalizer.ts — identical pure function to MMC

### 3B — Auth Token Store

- [ ] T067 [P] [AUTH] Create apps/mmc/src/core/auth/token-store.ts — Pinia `defineStore('auth')` with `accessToken: string | null`, `user: AuthUser | null`; actions: `setAccessToken`, `clearAccessToken`, `getAccessToken`; getter: `isAuthenticated: boolean`; never writes to localStorage/sessionStorage; `workspaceSlug` on `AuthUser` is undefined for MMC
- [ ] T068 [P] [AUTH] Create apps/backoffice/src/core/auth/token-store.ts — same as MMC but `AuthUser.workspaceSlug` is active (required for WorkspaceGuard)
- [ ] T069 [P] [AUTH] Create apps/frontoffice/src/core/auth/token-store.ts — same as MMC; no `workspaceSlug` in student context

### 3C — API Client

- [ ] T070 [P] [API-CLIENT] Create apps/mmc/src/core/api/client.ts — factory `createApiClient(config: AppConfig, tokenStore: TokenStore, fetchFn = fetch): ApiClient`; base options `credentials: 'include'`; request interceptors: authInterceptor (Bearer token attach, no logging), contentTypeInterceptor (POST/PUT/PATCH only), idempotencyInterceptor, correlationInterceptor (X-Correlation-ID via crypto.randomUUID()); response interceptors: errorNormalizerInterceptor, refreshInterceptor with single-flight strategy using closure-scoped `refreshPromise: Promise<void> | null` and `requestQueue: QueueEntry[]`; on AUTH_REFRESH_FAILED: reject all queued requests, clear auth store, redirect to login; exports both `createApiClient` factory and default `apiClient: ApiClient` singleton
- [ ] T071 [P] [API-CLIENT] Create apps/backoffice/src/core/api/client.ts — identical pattern to MMC; factory + singleton export
- [ ] T072 [P] [API-CLIENT] Create apps/frontoffice/src/core/api/client.ts — identical pattern to MMC; factory + singleton export

### 3D — Route Guards

- [ ] T073 [P] [ROUTER] Create apps/mmc/src/core/guards/auth.guard.ts — `Guard` type accepting `GuardContext { to, from, authStore }`; returns `true` if `!to.meta.requiresAuth`; returns `true` if `authStore.isAuthenticated`; returns `{ name: 'login' }` otherwise; no business logic; no exceptions thrown
- [ ] T074 [P] [ROUTER] Create apps/backoffice/src/core/guards/auth.guard.ts — identical logic to MMC
- [ ] T075 [P] [ROUTER] Create apps/frontoffice/src/core/guards/auth.guard.ts — identical logic to MMC
- [ ] T076 [P] [ROUTER] Create apps/mmc/src/core/guards/role.guard.ts — returns `true` if `!to.meta.requiredRole`; returns `true` if `authStore.user?.role === to.meta.requiredRole`; returns `{ name: 'forbidden' }` otherwise
- [ ] T077 [P] [ROUTER] Create apps/backoffice/src/core/guards/role.guard.ts — identical logic to MMC
- [ ] T078 [P] [ROUTER] Create apps/frontoffice/src/core/guards/role.guard.ts — identical logic to MMC
- [ ] T079 [ROUTER] Create apps/backoffice/src/core/guards/workspace.guard.ts — Backoffice ONLY; returns `true` if `!to.meta.requiresWorkspace`; validates `to.params['slug'] === authStore.user?.workspaceSlug`; returns `{ name: 'forbidden' }` on mismatch or missing slug; workspace_slug derived from route only, never from request body

### 3E — Vue Router

- [ ] T080 [P] [ROUTER] Create apps/mmc/src/core/router/index.ts — `createRouter({ history: createWebHistory(), routes: [...dashboardRoutes, ...licensesRoutes, { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/shared/views/NotFound.vue') }] })`; `beforeEach` pipeline: authGuard → roleGuard (no WorkspaceGuard for MMC); RouteMeta type extension with `requiresAuth`, `requiredRole`; all module views use lazy imports
- [ ] T081 [P] [ROUTER] Create apps/backoffice/src/core/router/index.ts — same pattern; `beforeEach` pipeline: authGuard → roleGuard → workspaceGuard; RouteMeta adds `requiresWorkspace?: boolean`
- [ ] T082 [P] [ROUTER] Create apps/frontoffice/src/core/router/index.ts — same pattern; `beforeEach` pipeline: authGuard → roleGuard ONLY (no WorkspaceGuard, no AttemptGuard per spec §16)

### 3F — Pinia State Init & useAuth Composable

- [ ] T083 [P] [PINIA] Create apps/mmc/src/core/state/index.ts — `createAppPinia(router: Router): Pinia`; uses `createPinia()` with `pinia.use(({ store }) => { store.router = markRaw(router) })` Pinia plugin; exported factory; no direct `createPinia()` module-level singleton
- [ ] T084 [P] [PINIA] Create apps/backoffice/src/core/state/index.ts — identical to MMC
- [ ] T085 [P] [PINIA] Create apps/frontoffice/src/core/state/index.ts — identical to MMC
- [ ] T086 [P] [AUTH] Create apps/mmc/src/core/auth/index.ts — `useAuth(): UseAuthReturn` composable; returns `{ isAuthenticated: ComputedRef<boolean>, currentUser: ComputedRef<AuthUser | null>, logout(): Promise<void> }`; logout: best-effort `DELETE /auth/logout` via apiClient (catch and discard), `tokenStore.clearAccessToken()`, `router.push('/login')`; delegates all state mutations to tokenStore; no direct store mutation
- [ ] T087 [P] [AUTH] Create apps/backoffice/src/core/auth/index.ts — identical pattern to MMC
- [ ] T088 [P] [AUTH] Create apps/frontoffice/src/core/auth/index.ts — identical pattern to MMC

### 3G — Module Scaffold Stubs (MMC: Dashboard & Licenses)

- [ ] T089 [P] [SCAFFOLD] Create apps/mmc/src/modules/dashboard/routes.ts — stub `RouteRecordRaw[]` array with lazy-loaded `DashboardView.vue`; exports `dashboardRoutes`
- [ ] T090 [P] [SCAFFOLD] Create apps/mmc/src/modules/dashboard/types.ts — stub TypeScript types file for dashboard module
- [ ] T091 [P] [SCAFFOLD] Create apps/mmc/src/modules/licenses/routes.ts — stub `RouteRecordRaw[]` array with lazy-loaded license views; exports `licensesRoutes`
- [ ] T092 [P] [SCAFFOLD] Create apps/mmc/src/modules/licenses/types.ts — stub TypeScript types file for licenses module
- [ ] T093 [P] [SCAFFOLD] Create apps/backoffice/src/modules/.gitkeep — placeholder for future backoffice feature modules
- [ ] T094 [P] [SCAFFOLD] Create apps/frontoffice/src/modules/.gitkeep — placeholder for future frontoffice feature modules

### 3H — Shared Views & Directory Scaffold

- [ ] T095 [P] [SCAFFOLD] Create apps/mmc/src/shared/views/NotFound.vue — minimal 404 page stub with `<template><div>404 — Not Found</div></template>`
- [ ] T096 [P] [SCAFFOLD] Create apps/mmc/src/shared/views/ForbiddenView.vue — minimal 403 page stub with `<template><div>403 — Forbidden</div></template>`
- [ ] T097 [P] [SCAFFOLD] Create apps/backoffice/src/shared/views/NotFound.vue — 404 stub
- [ ] T098 [P] [SCAFFOLD] Create apps/backoffice/src/shared/views/ForbiddenView.vue — 403 stub
- [ ] T099 [P] [SCAFFOLD] Create apps/frontoffice/src/shared/views/NotFound.vue — 404 stub
- [ ] T100 [P] [SCAFFOLD] Create apps/frontoffice/src/shared/views/ForbiddenView.vue — 403 stub
- [ ] T101 [P] [SCAFFOLD] Create .gitkeep placeholders for apps/backoffice/src/shared/components/, apps/backoffice/src/shared/composables/, apps/backoffice/src/shared/utils/
- [ ] T102 [P] [SCAFFOLD] Create .gitkeep placeholders for apps/frontoffice/src/shared/components/, apps/frontoffice/src/shared/composables/, apps/frontoffice/src/shared/utils/

### 3I — App Entry Points (main.ts + App.vue)

- [ ] T103 [P] [SCAFFOLD] Create apps/mmc/src/main.ts — bootstrap order per FR-33: (1) import appConfig from @/core/config/env (validates at import), (2) import createAppPinia from @/core/state, (3) import router from @/core/router, (4) createApp(App), (5) app.use(pinia), (6) app.use(router), (7) app.mount('#app'); Pinia registered before apiClient singleton is accessed
- [ ] T104 [P] [SCAFFOLD] Create apps/backoffice/src/main.ts — identical bootstrap order to MMC
- [ ] T105 [P] [SCAFFOLD] Create apps/frontoffice/src/main.ts — identical bootstrap order to MMC
- [ ] T106 [P] [SCAFFOLD] Create apps/mmc/src/App.vue — `<template><RouterView /></template>` only; no business logic; no inline styles
- [ ] T107 [P] [SCAFFOLD] Create apps/backoffice/src/App.vue — `<template><RouterView /></template>` only
- [ ] T108 [P] [SCAFFOLD] Create apps/frontoffice/src/App.vue — `<template><RouterView /></template>` only

---

## Phase 4 — ESLint Import Boundaries

> Add `eslint-plugin-import` (or `eslint-import-resolver-typescript`) and per-app ESLint configs enforcing `import/no-restricted-paths` rules. Prevents `import.meta.env` outside `core/config/env.ts` and cross-app imports.

**Independent test criteria**: `eslint src/` passes with zero errors for all 3 apps. Direct `import.meta.env` outside `core/config/env.ts` is flagged as an error.

- [ ] T109 [P] [LINT] Add `eslint-plugin-import` and `eslint-import-resolver-typescript` to devDependencies in apps/mmc/package.json
- [ ] T110 [P] [LINT] Add `eslint-plugin-import` and `eslint-import-resolver-typescript` to devDependencies in apps/backoffice/package.json
- [ ] T111 [P] [LINT] Add `eslint-plugin-import` and `eslint-import-resolver-typescript` to devDependencies in apps/frontoffice/package.json
- [ ] T112 [LINT] Create apps/mmc/eslint.config.js — configure `import/no-restricted-paths` to: (a) disallow `import.meta.env` references outside `src/core/config/env.ts`, (b) disallow direct `fetch()`/`axios` imports outside `src/core/api/client.ts`, (c) disallow cross-app imports from `apps/backoffice` or `apps/frontoffice`; use `eslint-import-resolver-typescript` for `@/` path resolution
- [ ] T113 [LINT] Create apps/backoffice/eslint.config.js — same rule set as MMC; also disallow imports from `apps/mmc` or `apps/frontoffice`
- [ ] T114 [LINT] Create apps/frontoffice/eslint.config.js — same rule set as MMC; also disallow imports from `apps/mmc` or `apps/backoffice`

---

## Phase 5 — Tests

> Create all test files per the test plan in plan.md §7. Each test file is independent and [P] with all others. Tests use Vitest + @vue/test-utils + @pinia/testing. No real network calls.

**Independent test criteria**: All new test files pass in isolation with `vitest run`. Each file tests one module. No cross-file state leakage.

### 5A — Error Normalizer Tests

- [ ] T115 [P] [TEST] Create apps/mmc/tests/unit/core/error-normalizer.spec.ts — standard API error (extracts code/message/httpStatus), network error TypeError → NETWORK_ERROR/0, unknown shape fallback → UNKNOWN_ERROR/-1, pure function (same input same output)
- [ ] T116 [P] [TEST] Create apps/backoffice/tests/unit/core/error-normalizer.spec.ts — identical test suite
- [ ] T117 [P] [TEST] Create apps/frontoffice/tests/unit/core/error-normalizer.spec.ts — identical test suite

### 5B — API Client Tests

- [ ] T118 [P] [TEST] Create apps/mmc/tests/unit/core/api-client.spec.ts — uses vi.fn() mock fetch and mock tokenStore injected via createApiClient factory; tests: Authorization header attached when token set, header omitted when no token, Idempotency-Key header attached when idempotencyKey provided, X-Correlation-ID present on every request, error normalized on 4xx/5xx, 401 triggers single-flight refresh (only one refresh request for concurrent 401s), original request retried after refresh success, all queued requests rejected with AUTH_REFRESH_FAILED when refresh request fails, auth store cleared on AUTH_REFRESH_FAILED
- [ ] T119 [P] [TEST] Create apps/backoffice/tests/unit/core/api-client.spec.ts — identical test suite
- [ ] T120 [P] [TEST] Create apps/frontoffice/tests/unit/core/api-client.spec.ts — identical test suite

### 5C — Environment Config Tests

- [ ] T121 [P] [TEST] Create apps/mmc/tests/unit/core/env-config.spec.ts — valid config resolves AppConfig, missing VITE_API_BASE_URL throws descriptive error, buildEnv derives from MODE, debugMode true when VITE_DEBUG_MODE = 'true'; mock `import.meta.env` via vi.stubEnv()
- [ ] T122 [P] [TEST] Create apps/backoffice/tests/unit/core/env-config.spec.ts — same tests plus VITE_WORKSPACE_SLUG optional check
- [ ] T123 [P] [TEST] Create apps/frontoffice/tests/unit/core/env-config.spec.ts — same tests as MMC

### 5D — Auth Guard Tests

- [ ] T124 [P] [TEST] Create apps/mmc/tests/unit/core/auth.guard.spec.ts — route without requiresAuth returns true, authenticated user + requiresAuth returns true, unauthenticated user + requiresAuth returns `{ name: 'login' }`; mock authStore via createTestingPinia()
- [ ] T125 [P] [TEST] Create apps/backoffice/tests/unit/core/auth.guard.spec.ts — identical
- [ ] T126 [P] [TEST] Create apps/frontoffice/tests/unit/core/auth.guard.spec.ts — identical

### 5E — Role Guard Tests

- [ ] T127 [P] [TEST] Create apps/mmc/tests/unit/core/role.guard.spec.ts — no requiredRole returns true, user role matches returns true, wrong role returns `{ name: 'forbidden' }`, null user returns `{ name: 'forbidden' }`
- [ ] T128 [P] [TEST] Create apps/backoffice/tests/unit/core/role.guard.spec.ts — identical
- [ ] T129 [P] [TEST] Create apps/frontoffice/tests/unit/core/role.guard.spec.ts — identical

### 5F — Auth Token Store Tests

- [ ] T130 [P] [TEST] Create apps/mmc/tests/unit/core/token-store.spec.ts — uses `setActivePinia(createPinia())` in beforeEach; initial state accessToken/user = null, setAccessToken stores in state only (verify no localStorage.setItem called via vi.spyOn), getAccessToken returns current, clearAccessToken sets both to null, isAuthenticated false/true based on token, never writes to localStorage or sessionStorage
- [ ] T131 [P] [TEST] Create apps/backoffice/tests/unit/core/token-store.spec.ts — same + test workspaceSlug field is present on AuthUser type
- [ ] T132 [P] [TEST] Create apps/frontoffice/tests/unit/core/token-store.spec.ts — same as MMC

### 5G — useAuth Composable Tests

- [ ] T133 [P] [TEST] Create apps/mmc/tests/unit/core/useAuth.spec.ts — isAuthenticated mirrors tokenStore.isAuthenticated, currentUser mirrors tokenStore.user, logout calls DELETE /auth/logout best-effort (mocked), logout calls clearAccessToken, logout calls router.push('/login'); mock apiClient and router
- [ ] T134 [P] [TEST] Create apps/backoffice/tests/unit/core/useAuth.spec.ts — identical
- [ ] T135 [P] [TEST] Create apps/frontoffice/tests/unit/core/useAuth.spec.ts — identical

### 5H — Workspace Guard Tests (Backoffice Only)

- [ ] T136 [TEST] Create apps/backoffice/tests/unit/core/workspace.guard.spec.ts — route without requiresWorkspace returns true, route slug matches authStore.user.workspaceSlug returns true, slugs mismatch returns `{ name: 'forbidden' }`, user has no workspaceSlug returns `{ name: 'forbidden' }`

### 5I — Guard Pipeline Integration Tests

- [ ] T137 [P] [TEST] Create apps/mmc/tests/unit/core/guard-pipeline.spec.ts — authGuard executes before roleGuard, stops and redirects to login before checking role when unauthenticated, proceeds through authGuard and evaluates roleGuard when authenticated; use createRouter + createPinia in isolation
- [ ] T138 [P] [TEST] Create apps/backoffice/tests/unit/core/guard-pipeline.spec.ts — same + workspaceGuard executes last after roleGuard
- [ ] T139 [P] [TEST] Create apps/frontoffice/tests/unit/core/guard-pipeline.spec.ts — authGuard → roleGuard only (no workspaceGuard)

### 5J — App Boot Tests

- [ ] T140 [P] [TEST] Create apps/mmc/tests/unit/core/app-boot.spec.ts — app mounts without console errors when env vars valid, Pinia registered before any store access, router registered before navigation; use @vue/test-utils mount with vi.stubEnv() for env mocking
- [ ] T141 [P] [TEST] Create apps/backoffice/tests/unit/core/app-boot.spec.ts — identical
- [ ] T142 [P] [TEST] Create apps/frontoffice/tests/unit/core/app-boot.spec.ts — identical

---

## Phase 6 — Validation Gate

> All items must pass before stage can be marked BACKEND CLOSED. Each validation task is [P] across apps.

**Gate criteria**: Zero lint errors, zero TypeScript errors, zero test failures, clean `vite build` for all 3 apps.

### 6A — ESLint

- [ ] T143 [P] [LINT] Run `eslint src/` in apps/mmc/ — must pass with zero errors; verify no direct `import.meta.env` outside `src/core/config/env.ts`
- [ ] T144 [P] [LINT] Run `eslint src/` in apps/backoffice/ — must pass with zero errors
- [ ] T145 [P] [LINT] Run `eslint src/` in apps/frontoffice/ — must pass with zero errors

### 6B — TypeScript Type Check

- [ ] T146 [P] [LINT] Run `tsc --noEmit` in apps/mmc/ — zero TypeScript errors in strict mode; verify `@/` alias resolution
- [ ] T147 [P] [LINT] Run `tsc --noEmit` in apps/backoffice/ — zero TypeScript errors
- [ ] T148 [P] [LINT] Run `tsc --noEmit` in apps/frontoffice/ — zero TypeScript errors

### 6C — Vite Build Dry Run

- [ ] T149 [P] [LINT] Run `vite build` in apps/mmc/ — must complete without errors
- [ ] T150 [P] [LINT] Run `vite build` in apps/backoffice/ — must complete without errors
- [ ] T151 [P] [LINT] Run `vite build` in apps/frontoffice/ — must complete without errors

### 6D — Test Suite

- [ ] T152 [P] [TEST] Run `vitest run tests/unit/core/` in apps/mmc/ — all 9 new test files pass; no test isolation failures
- [ ] T153 [P] [TEST] Run `vitest run tests/unit/core/` in apps/backoffice/ — all 10 new test files pass (includes workspace.guard.spec.ts)
- [ ] T154 [P] [TEST] Run `vitest run tests/unit/core/` in apps/frontoffice/ — all 9 new test files pass

### 6E — Completion Audit

- [ ] T155 [LINT] Audit apps/mmc/src/core/ — confirm zero `TODO`/`FIXME` markers, zero `any` in type signatures, zero direct `import.meta.env` references outside `env.ts`
- [ ] T156 [LINT] Audit apps/backoffice/src/core/ — same audit criteria
- [ ] T157 [LINT] Audit apps/frontoffice/src/core/ — same audit criteria
- [ ] T158 [LINT] Confirm no direct `fetch()` or `axios` imports exist in any file outside apps/\*/src/core/api/client.ts across all 3 apps

---

## Parallel Execution Guide

### Phase 1 — All parallel after T001+T002

```
T001 → T002 → [T003, T004, T005, T006, T007, T008, T009, T010, T011, T012, T013, T014] in parallel
```

### Phase 2 — Sequential sub-groups, parallel within each

```
T015 → [T016–T050 all in parallel] → T051 → T052 → [T053–T056 in parallel] → T057
```

### Phase 3 — Sub-group sequential, cross-app parallel

```
[T058–T066 parallel] →
[T067–T069 parallel] →
[T070–T072 parallel] →
[T073–T079 parallel] →
[T080–T082 parallel] →
[T083–T088 parallel] →
[T089–T108 parallel] →
done
```

### Phase 4 — Parallel across apps after Phase 3

```
[T109, T110, T111 parallel] → [T112, T113, T114 parallel]
```

### Phase 5 — All [P] within each sub-group, sub-groups order suggested only

```
[T115–T142 all parallel] — each spec file is independent
```

### Phase 6 — Parallel within each category

```
[T143–T148 parallel] → [T149–T151 parallel] → [T152–T154 parallel] → [T155–T158 parallel]
```

---

## Notes & Flagged Dependencies

| Dependency                       | Risk                                                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| T070–T072 depend on T058–T069    | `client.ts` imports `appConfig` (env.ts) and `useAuthStore` (token-store.ts) — both must exist before client compiles                           |
| T080–T082 depend on T073–T079    | Router imports guard functions — guards must exist before router compiles                                                                       |
| T103–T108 depend on T080–T088    | `main.ts` imports router, pinia factory, appConfig — all must exist first                                                                       |
| T051 depends on T016–T050        | Internal import updates can only happen after files are moved to new paths                                                                      |
| T052 depends on T051             | Deleting legacy dirs must happen after all imports are fixed                                                                                    |
| T137–T142 depend on T073–T108    | Integration + boot tests require source files to exist                                                                                          |
| T112–T114 depend on T109–T111    | ESLint configs require plugin packages installed first                                                                                          |
| Pinia before apiClient singleton | In `main.ts`, `app.use(pinia)` must occur before any store (including via client.ts singleton) is accessed — ensured by import order in main.ts |
