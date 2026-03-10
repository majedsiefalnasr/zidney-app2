# Tasks: STAGE_UI_01_AUTH_MODULE

**Stage**: STAGE_UI_01_AUTH_MODULE  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Branch**: `ui-01-auth-module`  
**Generated**: 2026-03-01  
**Related Plan**: `specs/runtime/ui-01-auth-module/plan.md`  
**Related Spec**: `specs/runtime/ui-01-auth-module/spec.md`  
**Related Data Model**: `specs/runtime/ui-01-auth-module/data-model.md`  
**Related Research**: `specs/runtime/ui-01-auth-module/research.md`

---

## Constitutional Validation

| Rule                                | Gate Result | Notes                                         |
| ----------------------------------- | ----------- | --------------------------------------------- |
| No cross-tenant access              | ✅ PASS     | UI layer; no DB access; no cross-app imports  |
| No client-time trust                | ✅ PASS     | Token expiry via 401 only                     |
| No JWT payload decoding             | ✅ PASS     | Profile from `/me` endpoint only              |
| No token in browser storage         | ✅ PASS     | `ref<string \| null>` in reactive memory only |
| No `any` in public interfaces       | ✅ PASS     | Strict-typed interfaces; `unknown` in catch   |
| No circular imports at module level | ✅ PASS     | Factory injection pattern (CL-02)             |
| Structured logging only             | ✅ PASS     | `@zidney/logger` throughout; no `console.*`   |
| apps/_ → other apps/_ forbidden     | ✅ PASS     | Each app's `core/auth/` is self-contained     |

**Stage Status**: IN PROGRESS — Implementation may proceed.

---

## User Story Map

The spec defines Architectural Stories (AS-01–AS-07). Tasks reference these via story labels:

| Story Label | Architectural Story                    | Key Module                                               |
| ----------- | -------------------------------------- | -------------------------------------------------------- |
| [US1]       | AS-01 — Memory-Only Access Token       | `core/auth/token-manager.ts`                             |
| [US2]       | AS-02 — Server-Authoritative Session   | `core/state/auth.store.ts`                               |
| [US3]       | AS-03 — Single-Flight Refresh          | `core/auth/refresh-manager.ts`                           |
| [US4]       | AS-04 — Coordinated Logout             | `core/state/auth.store.ts` + `core/auth/auth.service.ts` |
| [US5]       | AS-05 — Route Protection via AuthGuard | `core/router/guards/auth.guard.ts`                       |
| [US6]       | AS-06 — Auth Module App-Agnosticism    | All `core/auth/` modules                                 |
| [US7]       | AS-07 — Auth State Observability       | `core/state/auth.store.ts`                               |

---

## Bootstrap Wiring Order (Critical Dependency Chain)

```
1. pinia
2. router (no guards yet)
3. tokenManager  ← createTokenManager()
4. authService   ← createAuthService({ post, get } via forward-ref to apiClient)
5. authStore     ← defineAuthStore(authService, tokenManager, router, loginRoute, () => refreshManagerRef.value)
6. refreshManager← createRefreshManager(refreshFn, () => authStore.logout(), tokenManager)
   refreshManagerRef.value = refreshManager   ← wire lazy accessor
7. apiClient     ← createAppApiClient(tokenManager, refreshManager, () => void authStore.logout())
8. router guards ← createAuthGuard(() => authStore.isAuthenticated, options)
9. router.beforeEach with sessionInitialized gate
10. app.mount('#app')
```

---

## Phase A — Types (Foundational Types, Per App)

**Goal**: Create all auth-layer TypeScript type definitions. These files have zero runtime imports
and enable all subsequent phases.  
**Independent test criteria**: `tsc --noEmit` passes on each app's `core/auth/types.ts` in
isolation.

- [x] T001 [P] Create `apps/mmc/src/core/auth/types.ts` — define `UserRole`, `AuthErrorCode`,
      `AuthError`, `AuthUser`, `AuthStoreState`, `LoginCredentials`, `LoginResponse` with zero
      runtime imports
- [x] T002 [P] Create `apps/backoffice/src/core/auth/types.ts` — identical to MMC types;
      `UserRole = string` (pending BO stage enum); zero runtime imports
- [x] T003 [P] Create `apps/frontoffice/src/core/auth/types.ts` — identical to MMC types;
      `UserRole = string` (pending FO stage enum); zero runtime imports

---

## Phase B — Token Manager (Per App) [US1]

**Goal**: Implement the in-memory access token holder. Single source of truth for the runtime access
token.  
**Story**: AS-01 — Memory-Only Access Token Storage  
**Independent test criteria**: `createTokenManager()` instantiable in tests without Pinia or Vue
Router setup; all four interface methods verifiable without browser storage calls.  
**Depends on**: Phase A (types.ts must exist)

- [x] T004 [P] [US1] Create `apps/mmc/src/core/auth/token-manager.ts` — implement `ITokenManager`
      interface + `createTokenManager()` factory; uses Vue `ref<string | null>(null)`; uses
      `@zidney/logger`; zero browser storage writes
- [x] T005 [P] [US1] Create `apps/backoffice/src/core/auth/token-manager.ts` — identical
      implementation to MMC; uses Vue `ref<string | null>(null)`; uses `@zidney/logger`; zero
      browser storage writes
- [x] T006 [P] [US1] Create `apps/frontoffice/src/core/auth/token-manager.ts` — identical
      implementation to MMC; uses Vue `ref<string | null>(null)`; uses `@zidney/logger`; zero
      browser storage writes

---

## Phase C — Refresh Manager (Per App) [US3]

**Goal**: Implement single-flight token refresh orchestration. Guarantees at most one in-flight
refresh HTTP call regardless of concurrent 401s.  
**Story**: AS-03 — Single-Flight Refresh Orchestration  
**Independent test criteria**: Three concurrent `refresh()` calls with a delayed `refreshFn` →
`refreshFn` invoked exactly once; all three promises resolve on success; all three reject and
`onLogout` called once on failure.  
**Depends on**: Phase B (token-manager.ts must exist)

- [x] T007 [P] [US3] Create `apps/mmc/src/core/auth/refresh-manager.ts` — implement
      `IRefreshManager` interface + `createRefreshManager(refreshFn, onLogout, tokenManager)`
      factory; `let inFlight: Promise<void> | null = null` pattern; `onLogout` called once in
      `catch`; `inFlight` cleared in `finally`; uses `@zidney/logger`; zero imports from Pinia or
      auth.store
- [x] T008 [P] [US3] Create `apps/backoffice/src/core/auth/refresh-manager.ts` — identical
      implementation to MMC; same single-flight guarantee; zero imports from Pinia or auth.store
- [x] T009 [P] [US3] Create `apps/frontoffice/src/core/auth/refresh-manager.ts` — identical
      implementation to MMC; same single-flight guarantee; zero imports from Pinia or auth.store

---

## Phase D — Auth Service (Per App) [US4]

**Goal**: Implement all backend HTTP interactions for the auth flow. Factory pattern enables test
injection without real HTTP client.  
**Story**: AS-04 — Coordinated Logout  
**Independent test criteria**: `logout()` resolves (does not reject) when injected `apiClient.post`
throws; `fetchProfile()` returns typed `AuthUser`; `refreshToken()` returns
`{ accessToken: string }`.  
**Depends on**: Phase A (types.ts must exist)

- [x] T010 [P] [US4] Create `apps/mmc/src/core/auth/auth.service.ts` — implement `IAuthService`
      interface + `createAuthService(apiClient)` factory; endpoints: `POST /auth/login`,
      `POST /auth/logout` (always resolves), `POST /auth/refresh`, `GET /auth/me`; uses
      `@zidney/logger`; no direct `fetch()` calls; no `any` return types
- [x] T011 [P] [US4] Create `apps/backoffice/src/core/auth/auth.service.ts` — identical
      implementation to MMC; uses injected `apiClient`; logout swallows backend errors per FR-30
- [x] T012 [P] [US4] Create `apps/frontoffice/src/core/auth/auth.service.ts` — identical
      implementation to MMC; uses injected `apiClient`; logout swallows backend errors per FR-30

---

## Phase E — Auth Store (Per App) [US2] [US4] [US7]

**Goal**: Implement the Pinia reactive auth state store. Single source of truth for
`isAuthenticated`, `user`, `isLoading`, `authError`.  
**Stories**: AS-02 — Server-Authoritative Session, AS-04 — Coordinated Logout, AS-07 — Auth State
Observability  
**Independent test criteria**: Initial state matches `AuthStoreState` defaults; `setSession()` sets
`isAuthenticated: true`; `logout()` resets state to initial values; `logout()` is idempotent;
`initSession()` failure sets `authError.code === 'AUTH_INIT_FAILED'` without router redirect.  
**Depends on**: Phase A (types.ts), Phase B (token-manager.ts), Phase D (auth.service.ts)

- [x] T013 [P] [US2] [US4] [US7] Create `apps/mmc/src/core/state/auth.store.ts` — implement
      `defineAuthStore(authService, tokenManager, router, loginRouteName, getRefreshManager)`
      factory; composition API `defineStore('auth', () => {...})`; expose `isAuthenticated`, `user`,
      `isLoading`, `authError` as reactive refs; expose actions `initSession`, `setSession`,
      `refresh`, `logout`, `clearAuthError`; token never exposed as getter; no direct HTTP calls; no
      permission checks; uses `@zidney/logger`; FR-36 idempotency guard on `logout()`
- [x] T014 [P] [US2] [US4] [US7] Create `apps/backoffice/src/core/state/auth.store.ts` — identical
      implementation to MMC; `loginRouteName` resolves to `'bo-login'` at bootstrap injection; same
      idempotency guard
- [x] T015 [P] [US2] [US4] [US7] Create `apps/frontoffice/src/core/state/auth.store.ts` — identical
      implementation to MMC; `loginRouteName` resolves to `'fo-login'` at bootstrap injection; same
      idempotency guard

---

## Phase F — Auth Guard (Per App) [US5]

**Goal**: Implement the configurable navigation guard and extend Vue Router's RouteMeta type for
auth fields.  
**Story**: AS-05 — Route Protection via Auth Guard  
**Independent test criteria**: Guard returns `{ name: loginRouteName }` for unauthenticated access
to `requiresAuth: true` routes; returns `true` for authenticated; returns
`{ name: dashboardRouteName }` for authenticated on `guestOnly: true` routes; never throws; never
calls `router.push()`.  
**Depends on**: Phase E (auth.store.ts must exist)

- [x] T016 [P] [US5] Create `apps/mmc/src/core/router/guards/auth.guard.ts` — implement
      `createAuthGuard(getIsAuthenticated: () => boolean, options: AuthGuardOptions): NavigationGuard`;
      export `AuthGuardOptions` interface; returns `RouteLocationRaw | boolean`; never calls
      `router.push()`; never throws; never decodes JWT; uses `@zidney/logger`
- [x] T017 [P] [US5] Create `apps/backoffice/src/core/router/guards/auth.guard.ts` — identical
      implementation to MMC; `loginRouteName: 'bo-login'`, `dashboardRouteName: 'bo-dashboard'`
      injected at bootstrap
- [x] T018 [P] [US5] Create `apps/frontoffice/src/core/router/guards/auth.guard.ts` — identical
      implementation to MMC; `loginRouteName: 'fo-login'`, `dashboardRouteName: 'fo-home'` injected
      at bootstrap
- [x] T019 [P] [US5] Extend Vue Router `RouteMeta` in `apps/mmc/src/core/router/types.ts` — add
      `requiresAuth?: boolean` and `guestOnly?: boolean` via `declare module 'vue-router'`; export
      `AuthRouteMeta` convenience type alias
- [x] T020 [P] [US5] Extend Vue Router `RouteMeta` in `apps/backoffice/src/core/router/types.ts` —
      identical `RouteMeta` augmentation as MMC; export `AuthRouteMeta` alias
- [x] T021 [P] [US5] Extend Vue Router `RouteMeta` in `apps/frontoffice/src/core/router/types.ts` —
      identical `RouteMeta` augmentation as MMC; export `AuthRouteMeta` alias

---

## Phase G — API Client Interceptor Wiring (Per App) [US3]

**Goal**: Replace Stage 00 inline stub callbacks in `core/api/client.ts` with proper delegation to
`token-manager` and `refresh-manager`. Update `core/auth/index.ts` re-exports.  
**Story**: AS-03 — Single-Flight Refresh Orchestration  
**Independent test criteria**: `getAccessToken` callback returns `tokenManager.getToken()`;
`onRefreshToken` awaits `refreshManager.refresh()` then returns current token; `onAuthFailure` calls
`authStore.logout()` without throwing; no direct token value in log calls.  
**Depends on**: Phase B (token-manager.ts), Phase C (refresh-manager.ts), Phase E (auth.store.ts)

- [x] T022 [P] [US3] Modify `apps/mmc/src/core/api/client.ts` — update
      `createAppApiClient(tokenManager, refreshManager, onAuthFailure)` signature; replace inline
      `getAccessToken`, `onRefreshToken`, `onAuthFailure` stubs with `tokenManager.getToken()`,
      `refreshManager.refresh() → tokenManager.getToken()!`, `void authStore.logout()` delegation;
      no direct fetch(); no token in log calls
- [x] T023 [P] [US3] Modify `apps/backoffice/src/core/api/client.ts` — identical interceptor
      replacement as MMC; same `createAppApiClient` signature update
- [x] T024 [P] [US3] Modify `apps/frontoffice/src/core/api/client.ts` — identical interceptor
      replacement as MMC; same `createAppApiClient` signature update
- [x] T025 [P] [US6] Update `apps/mmc/src/core/auth/index.ts` — update re-exports to point to new
      modules: `token-manager.ts`, `refresh-manager.ts`, `auth.service.ts`, `types.ts`; remove any
      re-export of superseded `token-store.ts`
- [x] T026 [P] [US6] Update `apps/backoffice/src/core/auth/index.ts` — identical re-export updates
      as MMC; remove `token-store.ts` re-export
- [x] T027 [P] [US6] Update `apps/frontoffice/src/core/auth/index.ts` — identical re-export updates
      as MMC; remove `token-store.ts` re-export

---

## Phase H — main.ts Bootstrap Wiring (Per App)

**Goal**: Wire the full bootstrap sequence per plan.md §3.8 / CL-01. Connect all modules via factory
injection in the correct dependency order. Register auth guard with `sessionInitialized` gate.  
**Independent test criteria**: App mounts without errors; `initSession` called exactly once during
initial navigation; no double-refresh on simultaneous startup navigations.  
**Depends on**: All previous phases (A–G must be complete)

- [x] T028 [P] Update `apps/mmc/src/main.ts` — implement full bootstrap sequence: (1) create pinia,
      (2) create router, (3) `createTokenManager()`, (4) forward-declare `apiClient` +
      `createAuthService`, (5)
      `defineAuthStore(authService, tokenManager, router, 'mmc-login', () => refreshManagerRef)` +
      `authStore = useAuthStore(pinia)`, (6)
      `createRefreshManager(refreshFn, logout cb, tokenManager)` + set `refreshManagerRef.value`,
      (7) `createAppApiClient(tokenManager, refreshManager, logout cb)`, (8)
      `createAuthGuard(() => authStore.isAuthenticated, { loginRouteName: 'mmc-login', dashboardRouteName: 'mmc-dashboard' })`,
      (9) `router.beforeEach` with `sessionInitialized` ref gate per CL-01, (10)
      `app.use(pinia).use(router).mount('#app')`
- [x] T029 [P] Update `apps/backoffice/src/main.ts` — identical bootstrap sequence as MMC;
      `LOGIN_ROUTE = 'bo-login'`, `DASHBOARD_ROUTE = 'bo-dashboard'`; same `sessionInitialized` gate
- [x] T030 [P] Update `apps/frontoffice/src/main.ts` — identical bootstrap sequence as MMC;
      `LOGIN_ROUTE = 'fo-login'`, `DASHBOARD_ROUTE = 'fo-home'`; same `sessionInitialized` gate
- [x] T031 [P] Update `apps/mmc/src/core/router/index.ts` — remove old guard import path
      (`core/guards/auth.guard.ts`); add `sessionInitialized` gate type annotation if router factory
      exported; ensure router factory does not self-register guards (guards registered in `main.ts`
      only)
- [x] T032 [P] Update `apps/backoffice/src/core/router/index.ts` — identical router updates as MMC;
      remove legacy guard wiring if present; export clean router factory only
- [x] T033 [P] Update `apps/frontoffice/src/core/router/index.ts` — identical router updates as MMC;
      remove legacy guard wiring if present; export clean router factory only

---

## Phase I — Unit Tests (Per Module)

**Goal**: Implement unit tests for each auth module. Tests run in isolation using Vitest,
`setActivePinia`, `createMemoryHistory`, and mock `IAuthService`. No real HTTP calls.  
**Independent test criteria**: Each test file passes in isolation with `vitest run`; zero real HTTP
calls; zero browser navigation; token value never appears in assertions.  
**Depends on**: Phase A–G (implementation modules must exist before tests cover them)

- [x] T034 Create `tests/unit/auth/setup.ts` — test helper factory: `createMockAuthService()` →
      `IAuthService` with `vi.fn()` methods; `createTestRouter()` →
      `createRouter(createMemoryHistory(), routes)`; `setupTestPinia()` →
      `setActivePinia(createPinia())`; `createMockTokenManager()` → stub `ITokenManager`
- [x] T035 [P] [US1] Create `tests/unit/auth/token-manager.test.ts` — test cases: `getToken()`
      returns null before set; `setToken(val)` stores retrievable value; `hasToken()` false before
      set, true after; `clearToken()` destroys value; `setToken` does not write `localStorage`;
      `setToken` does not write `sessionStorage`; `setToken` does not write `document.cookie`;
      `setToken` does not write `indexedDB`; token value not emitted to logger
- [x] T036 [P] [US3] Create `tests/unit/auth/refresh-manager.test.ts` — test cases: single refresh
      for N concurrent calls (3 parallel `refresh()` → `refreshFn` called once); all callers resolve
      on success; all callers reject on failure; `onLogout` called exactly once on failure;
      `isRefreshing()` true during, false after; second sequential burst triggers new call;
      `onLogout` not called on success
- [x] T037 [P] [US2] [US4] [US7] Create `tests/unit/auth/auth.store.test.ts` — test cases: initial
      state shape (`isAuthenticated: false`, `user: null`, `isLoading: false`, `authError: null`);
      `setSession()` sets `isAuthenticated: true` and `user`; `initSession()` success →
      `isAuthenticated: true`, `user` populated, `isLoading: false`; `initSession()` failure →
      `isAuthenticated: false`, `authError.code === 'AUTH_INIT_FAILED'`, no router redirect;
      `logout()` resets to initial state; `logout()` idempotent (already-logged-out → no-op,
      `authService.logout` not called); `clearAuthError()` clears error; token never exposed as
      getter
- [x] T038 [P] [US5] Create `tests/unit/auth/auth.guard.test.ts` — test cases:
      `requiresAuth: true` + unauthenticated → `{ name: 'mmc-login' }`; `requiresAuth: true` +
      authenticated → `true`; `guestOnly: true` + authenticated → `{ name: 'mmc-dashboard' }`;
      `guestOnly: true` + unauthenticated → `true`; no meta → `true` (any auth state); guard never
      calls mock `router.push()`; guard never throws; guard never decodes JWT
- [x] T039 [P] [US4] Create `tests/unit/auth/auth.service.test.ts` — test cases: `logout()` resolves
      when `apiClient.post` rejects (error swallowed, per FR-30); `logout()` resolves when
      `apiClient.post` succeeds; `fetchProfile()` returns typed `AuthUser`; `login()` forwards
      credentials to `apiClient.post('/auth/login', credentials)`; `refreshToken()` returns
      `{ accessToken: string }`; no `any` in return types

---

## Phase J — Integration Tests

**Goal**: Verify multi-module interactions under realistic concurrency and session lifecycle
scenarios. Tests use mock API surface but test cross-module wiring.  
**Depends on**: Phase I (unit tests must pass first); full bootstrap wiring in Phase H

- [x] T040 [US3] Create `tests/integration/auth/concurrent-refresh.test.ts` — scenario: 5 concurrent
      API calls all receive 401; assert `refreshManager.refresh()` called exactly once; assert all 5
      original calls resolve after refresh; assert `tokenManager.getToken()` returns new token after
      burst; assert `refreshFn` (mock) called once total; 50ms delay in `refreshFn` to force overlap
- [x] T041 [US3] [US4] Create `tests/integration/auth/session-init.test.ts` — scenario A
      (authenticated reload): `refreshToken` resolves with token, `fetchProfile` resolves with user
      → assert `isAuthenticated: true`, `user` populated, `isLoading: false`; scenario B
      (unauthenticated reload): `refreshToken` rejects → assert `isAuthenticated: false`,
      `user: null`, `authError.code === 'AUTH_INIT_FAILED'`, `router.push` NOT called; assert
      `isLoading: false` in both cases after completion
- [x] T042 [US4] Create `tests/integration/auth/logout-flow.test.ts` — scenario A (normal logout):
      `isAuthenticated: true` → `logout()` → assert `authService.logout()` called once,
      `tokenManager.clearToken()` called, `isAuthenticated: false`, `user: null`,
      `router.push({ name: loginRouteName })` called; scenario B (backend error):
      `authService.logout` rejects → `logout()` still resolves, state cleared; scenario C (double
      logout): `logout()` called twice → `authService.logout` called exactly once (idempotency)

---

## Phase K — Cleanup

**Goal**: Delete Stage 00 scaffolding superseded by this stage's implementation. Remove stale
imports and empty directories.  
**Depends on**: Phase G (auth/index.ts updated to remove token-store.ts re-exports), Phase H
(main.ts no longer imports token-store.ts)

- [x] T043 [P] Delete `apps/mmc/src/core/auth/token-store.ts` — file superseded by
      `token-manager.ts` + `auth.store.ts`; verify no remaining imports in the app before deletion
- [x] T044 [P] Delete `apps/backoffice/src/core/auth/token-store.ts` — file superseded by
      `token-manager.ts` + `auth.store.ts`; verify no remaining imports before deletion
- [x] T045 [P] Delete `apps/frontoffice/src/core/auth/token-store.ts` — file superseded by
      `token-manager.ts` + `auth.store.ts`; verify no remaining imports before deletion
- [x] T046 Remove `apps/mmc/src/core/guards/` directory — directory superseded by
      `core/router/guards/`; only remove if directory is empty after guard file has been relocated;
      check for any remaining non-auth guard files first
- [x] T047 Update `apps/mmc/src/core/state/index.ts` — remove router injection into Pinia plugin if
      present (bootstrap now handled in `main.ts`); retain any other state index exports; run
      `tsc --noEmit` on MMC after change to verify zero type errors

---

## Phase L — Verification Checks

**Goal**: Confirm zero lint errors, zero TypeScript errors, and zero token-leak patterns across all
three apps.  
**Depends on**: All phases A–K complete

- [x] T048 Run `pnpm --filter @zidney/mmc tsc --noEmit` — must exit with code 0; zero TypeScript
      strict mode errors in MMC `core/auth/` and `core/state/`
- [x] T049 [P] Run `pnpm --filter @zidney/backoffice tsc --noEmit` — must exit with code 0; zero
      TypeScript strict mode errors in Backoffice `core/auth/` and `core/state/`
- [x] T050 [P] Run `pnpm --filter @zidney/frontoffice tsc --noEmit` — must exit with code 0; zero
      TypeScript strict mode errors in Frontoffice `core/auth/` and `core/state/`
- [x] T051 Run `pnpm --filter @zidney/mmc lint` — must exit with code 0; zero ESLint errors; no
      `console.*` calls; no direct `fetch()` in `core/auth/`
- [x] T052 [P] Run `pnpm --filter @zidney/backoffice lint` — must exit with code 0; same ESLint
      constraints
- [x] T053 [P] Run `pnpm --filter @zidney/frontoffice lint` — must exit with code 0; same ESLint
      constraints
- [x] T054 Run token-leak grep:
      `grep -r "accessToken" apps/*/src/core/auth/ --include="*.ts" | grep -v "types.ts\|auth.service.ts"`
      — expected: zero matches in logger calls and request/response logs; verify token value never
      passed as a logger argument
- [x] T055 Run storage-API grep:
      `grep -r "localStorage\|sessionStorage\|document\.cookie\|indexedDB" apps/*/src/core/auth/ --include="*.ts"`
      — expected: zero matches; token-manager.ts must contain no browser storage writes
- [x] T056 Run all auth unit tests: `pnpm vitest run tests/unit/auth/` — all tests must pass; zero
      failures; zero skipped
- [x] T057 Run all auth integration tests: `pnpm vitest run tests/integration/auth/` — all tests
      must pass; verify concurrent-refresh, session-init, logout-flow scenarios all green

---

## Dependency Graph

```
Phase A (Types)
    └─→ Phase B (Token Manager)          [Phases A required]
    └─→ Phase D (Auth Service)           [Phase A required]
Phase B (Token Manager)
    └─→ Phase C (Refresh Manager)        [Phase B required]
    └─→ Phase E (Auth Store)             [Phases A, B, D required]
    └─→ Phase G (API Client wiring)      [Phases B, C required]
Phase C (Refresh Manager)
    └─→ Phase E (Auth Store)             [Phase C available via lazy ref]
    └─→ Phase G (API Client wiring)      [Phase C required]
Phase D (Auth Service)
    └─→ Phase E (Auth Store)             [Phase D required]
Phase E (Auth Store)
    └─→ Phase F (Auth Guard)             [Phase E required]
    └─→ Phase G (API Client wiring)      [Phase E required for onAuthFailure]
Phase F (Auth Guard)
    └─→ Phase H (main.ts bootstrap)      [Phase F required]
Phase G (API Client wiring)
    └─→ Phase H (main.ts bootstrap)      [Phase G required]
Phase H (main.ts bootstrap)
    └─→ Phase I (Unit Tests)             [All implementation phases complete]
Phase I (Unit Tests)
    └─→ Phase J (Integration Tests)      [Unit tests passing]
Phase H + Phase I
    └─→ Phase K (Cleanup)                [Safe to delete token-store.ts]
Phase K (Cleanup)
    └─→ Phase L (Verification)           [Clean slate for final checks]
```

### Critical Ordering Notes

1. **Token Manager before Refresh Manager**: `createRefreshManager` receives `tokenManager` as
   argument.
2. **Auth Store before Refresh Manager (in bootstrap)**: `refreshManager` receives
   `() => authStore.logout()` as `onLogout` callback; store must exist first to capture `logout`
   reference.
3. **Lazy accessor pattern**: Auth store's `getRefreshManager: () => IRefreshManager | null`
   receives `() => refreshManagerRef.value` — the ref is mutated after refresh manager creation,
   breaking the creation-order circular dependency without circular module imports.
4. **API Client after both Token Manager and Refresh Manager**: `createAppApiClient` requires both
   as arguments.
5. **router.beforeEach registered before app.mount()**: Guards must be registered before Vue Router
   starts its initial navigation resolution.
6. **token-store.ts deletion only after index.ts is updated** (Phase K after Phase G).

---

## Parallel Execution Opportunities

### Phases A–D (all parallelizable within and across apps)

```
Parallel batch 1 — All three apps simultaneously:
  T001  apps/mmc/src/core/auth/types.ts
  T002  apps/backoffice/src/core/auth/types.ts
  T003  apps/frontoffice/src/core/auth/types.ts

(after T001-T003 complete)
Parallel batch 2 — Token Manager + Auth Service (no inter-dependency):
  T004  apps/mmc/src/core/auth/token-manager.ts
  T005  apps/backoffice/src/core/auth/token-manager.ts
  T006  apps/frontoffice/src/core/auth/token-manager.ts
  T010  apps/mmc/src/core/auth/auth.service.ts
  T011  apps/backoffice/src/core/auth/auth.service.ts
  T012  apps/frontoffice/src/core/auth/auth.service.ts

(after T004-T006 complete)
Parallel batch 3 — Refresh Manager (needs token-manager):
  T007  apps/mmc/src/core/auth/refresh-manager.ts
  T008  apps/backoffice/src/core/auth/refresh-manager.ts
  T009  apps/frontoffice/src/core/auth/refresh-manager.ts

(after T007-T012 complete)
Parallel batch 4 — Auth Store (needs token-manager + auth.service):
  T013  apps/mmc/src/core/state/auth.store.ts
  T014  apps/backoffice/src/core/state/auth.store.ts
  T015  apps/frontoffice/src/core/state/auth.store.ts

(after T013-T015 complete)
Parallel batch 5 — Auth Guard + RouteMeta types + API Client:
  T016–T021  (six tasks across three apps, two each: guard + types)
  T022–T027  (six tasks across three apps: client + index)

(after batch 5 complete)
Parallel batch 6 — main.ts + router/index.ts:
  T028–T033  (six tasks, two per app)

(after all implementation complete)
Parallel batch 7 — Unit Tests (all independent):
  T034–T039  (setup + five test files)

(after unit tests pass)
Parallel batch 8 — Integration Tests + Cleanup:
  T040–T042  (integration tests — independent scenarios)
  T043–T045  (delete token-store.ts × 3 apps)

(after cleanup)
Parallel batch 9 — Verification (independent per app):
  T048–T057  (typecheck × 3, lint × 3, greps × 2, test runs × 2)
```

---

## Implementation Strategy

### MVP Scope (Minimum Viable Increment)

Implement MMC app first (T001, T004, T007, T010, T013, T016, T019, T022, T025, T028, T031) as a
single end-to-end vertical. Validates the full auth module lifecycle on one app before replicating
to Backoffice and Frontoffice.

### Incremental Delivery Order

1. **Increment 1** — MMC full vertical (one app, all phases A–H)
2. **Increment 2** — Backoffice replication (copy-adapt MMC implementation)
3. **Increment 3** — Frontoffice replication (copy-adapt MMC implementation)
4. **Increment 4** — Tests (unit → integration, all apps together)
5. **Increment 5** — Cleanup + Verification (K + L)

### App-Agnosticism Enforcement

All `core/auth/` module implementations must be functionally identical across all three apps.
App-specific values (`LOGIN_ROUTE`, `DASHBOARD_ROUTE`, role types) live exclusively in `main.ts`. If
any `if (app === 'mmc')` branching appears in `core/auth/`, it must be removed and replaced with a
configuration injection.

---

## Risk Register

| Risk                                                                        | Severity | Mitigation                                                                                            |
| --------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| Circular import at module level (auth.store ↔ refresh-manager)              | HIGH     | Lazy accessor `() => refreshManagerRef.value` in `main.ts`; verified by tsc import graph              |
| Token value leaked to logger                                                | HIGH     | `setToken` logs only `'Access token stored in memory'` (no value); verified by T054 grep              |
| `initSession()` called multiple times (guard fires N times before resolved) | HIGH     | `sessionInitialized` ref gate in `router.beforeEach`; only first navigation triggers `initSession`    |
| `token-store.ts` still imported somewhere after deletion                    | MEDIUM   | T025–T027 update index.ts first; T043–T045 delete only after grep confirms zero imports               |
| Multiple refresh calls under concurrent 401s                                | HIGH     | Single-flight lock verified by T036 + T040; `inFlight = null` assignment is atomic pre-`await`        |
| Refresh manager `onLogout` called >1× per failed refresh cycle              | MEDIUM   | `onLogout` called in `catch` before `finally`; `inFlight` cleared in `finally`; single promise shared |
| `isLoading` not reset on `initSession()` failure                            | MEDIUM   | `resetState()` in `catch` sets `isLoading: false`; verified by T037                                   |
| `localStorage`/`sessionStorage` access in tests via JSDOM                   | LOW      | T035 explicit spy: `localStorage.setItem` / `sessionStorage.setItem` not called                       |
| `any` type slipping into public interfaces                                  | MEDIUM   | `tsc --noEmit` with `strict: true` + T048–T050 verify; catch clauses use `unknown`                    |

---

## Completion Criteria

This task list is complete when:

- [ ] All 57 tasks checked off
- [ ] `tsc --noEmit` exits 0 for MMC, Backoffice, Frontoffice
- [ ] `eslint` exits 0 for MMC, Backoffice, Frontoffice
- [ ] Token-leak grep returns zero matches
- [ ] Storage-API grep returns zero matches
- [ ] All unit tests green (`tests/unit/auth/`)
- [ ] All integration tests green (`tests/integration/auth/`)
- [ ] `token-store.ts` does not exist in any of the three apps
- [ ] `core/guards/` directory removed from MMC (if confirmed empty)
- [ ] No `console.log`, `console.warn`, `console.error` in any `core/auth/` file
