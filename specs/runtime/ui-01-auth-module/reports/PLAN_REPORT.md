# Plan Report — STAGE_UI_01_AUTH_MODULE

**Step:** 3 — Plan  
**Stage:** STAGE_UI_01_AUTH_MODULE  
**Phase:** 06_UI_APPLICATION_RUNTIME  
**Generated:** 2026-03-01  
**Outcome:** Plan approved — guardian issues resolved — task generation authorized

---

## Guardian Verdicts

| Guardian                    | Verdict  | Notes                                                  |
| --------------------------- | -------- | ------------------------------------------------------ |
| Zidney Architecture Checker | **PASS** | No critical violations; HIGH-01 resolved before report |
| Zidney API Designer         | **PASS** | All 9 API integration contracts verified               |

**Final Gate: APPROVED — Implementation Authorized**

---

## Pre-Plan Issues Resolved

All guardian findings were resolved in plan artifacts before this report was written:

| ID        | Severity | Finding                                        | Resolution                                                                                                                                   |
| --------- | -------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| HIGH-01   | HIGH     | `authStore.refresh()` was an always-true stub  | Injected `getRefreshManager: () => IRefreshManager \| null` lazy accessor into `defineAuthStore` factory; `refresh()` now delegates properly |
| MEDIUM-01 | MEDIUM   | FR-32 retained ambiguous `onMounted` option    | FR-32 updated in spec.md to remove `onMounted` option; CL-01 referenced as authoritative                                                     |
| MEDIUM-02 | MEDIUM   | `logout()` `isLoading` sequencing off by one   | Acknowledged; implementation task will strictly follow FR-35 sequencing                                                                      |
| MEDIUM-03 | MEDIUM   | `RefreshManagerFactory` missing `tokenManager` | `data-model.md` type updated to include `tokenManager: ITokenManager` as third parameter                                                     |

---

## Technical Architecture Summary

### Core Design Decisions

**Token Storage** — Access token stored exclusively in a `ref<string | null>(null)` inside `token-manager.ts`. No browser storage APIs are ever written. Page reload destroys the in-memory token; `initSession()` restores the session via silent refresh.

**Single-Flight Refresh** — `createRefreshManager(refreshFn, onLogout, tokenManager)` uses a `let inFlight: Promise<void> | null` pattern. The first concurrent 401 claimant sets `inFlight`; all subsequent callers receive the same promise. On resolution or rejection, `inFlight = null` in `finally`. JavaScript's cooperative concurrency guarantees no race condition in this pattern.

**Circular Dependency Resolution (CL-02)** — The `onLogout` callback is passed to the refresh manager factory at bootstrap time from `main.ts`. The store provides `getRefreshManager: () => IRefreshManager | null` via a lazy accessor — `refreshManagerInstance` is set to `null` initially and populated after Step 6 of the bootstrap sequence. This breaks the module-level circular import.

**Bootstrap Ordering (CL-01)** — `initSession()` is called from a `router.beforeEach` guard in `main.ts` that runs once on the first navigation, before `app.mount()` enables any rendering. A `sessionInitialized` ref prevents re-running on subsequent navigations.

**API Client Interceptors (CL-03)** — Stage 00 provided empty extension points (`getAccessToken`, `onRefreshToken`, `onAuthFailure` callbacks). This stage wires them: `getAccessToken` → `tokenManager.getToken()`, `onRefreshToken` → `refreshManager.refresh()`, `onAuthFailure` → `authStore.logout()`.

---

## Scope of Changes

### New Files (6 per app × 3 apps = 18 files)

| File                               | Description                                                    |
| ---------------------------------- | -------------------------------------------------------------- |
| `core/auth/types.ts`               | All auth type definitions: `AuthUser`, `AuthError`, interfaces |
| `core/auth/token-manager.ts`       | In-memory access token holder (never touches browser storage)  |
| `core/auth/refresh-manager.ts`     | Single-flight refresh orchestrator (factory pattern)           |
| `core/auth/auth.service.ts`        | HTTP auth operations (login, logout, refresh, fetchProfile)    |
| `core/state/auth.store.ts`         | Pinia auth store with typed state and all FR-04 actions        |
| `core/router/guards/auth.guard.ts` | Configurable auth guard (requiresAuth / guestOnly)             |

### Modified Files (4 per app × 3 apps = 12 files)

| File                   | Change                                                                 |
| ---------------------- | ---------------------------------------------------------------------- |
| `core/api/client.ts`   | Wire `getAccessToken`, `onRefreshToken`, `onAuthFailure` callbacks     |
| `main.ts`              | Add `sessionInitialized` guard gate and bootstrap sequence (Steps 1-9) |
| `core/router/index.ts` | Register `createAuthGuard` in `beforeEach` pipeline                    |
| `core/auth/index.ts`   | Update re-exports to expose new module surface                         |

### Deleted Files (1 per app × 3 apps = 3 files)

| File                       | Reason                                                   |
| -------------------------- | -------------------------------------------------------- |
| `core/auth/token-store.ts` | Superseded by `token-manager.ts` + `auth.store.ts` split |

---

## Research Artifacts

[specs/runtime/ui-01-auth-module/research.md](../research.md) resolves:

- Vue Router guard timing pattern for CL-01 (`sessionInitialized` ref gate)
- Pinia `setActivePinia(createPinia())` test isolation pattern
- `@zidney/api-client` fetch adapter interceptor callback API
- Single-flight lock implementation (native `Promise<void> | null`)
- `UserRole = string` local alias pending shared enum migration

---

## Data Model Artifacts

[specs/runtime/ui-01-auth-module/data-model.md](../data-model.md) defines 12 TypeScript interfaces/types:

- `AuthUser`, `AuthError`, `AuthErrorCode` (enum)
- `AuthStoreState`, `LoginCredentials`, `LoginResponse`
- `IAuthService`, `ITokenManager`, `IRefreshManager`
- `AuthGuardOptions`, `AuthRouteMeta`
- `RefreshManagerFactory` (3-param: `refreshFn`, `onLogout`, `tokenManager`)

---

## Bootstrap Sequence (Critical Ordering)

```
1. createPinia()
2. createTokenManager()
3. createRouter()
4. createAuthService({ post, get } = forward-declared apiClient)
5. defineAuthStore(authService, tokenManager, router, LOGIN_ROUTE, () => refreshManagerInstance)
6. createRefreshManager(refreshFn, onLogout, tokenManager) → set refreshManagerInstance
7. createAppApiClient(tokenManager, refreshManager, onAuthFailure)
8. router.beforeEach(sessionInitialized gate + authGuard)
9. app.mount('#app')
```

---

## Test Strategy

| Test Suite             | Count | Key Scenarios                                               |
| ---------------------- | ----- | ----------------------------------------------------------- |
| `token-manager.test`   | 6     | Memory-only storage; no browser storage writes              |
| `auth.store.test`      | 8     | Initial state, setSession, logout reset, authError          |
| `refresh-manager.test` | 8     | Single-flight concurrency; all callers resolved/rejected    |
| `auth.guard.test`      | 5     | requiresAuth redirect; guestOnly redirect; no JWT decode    |
| `auth.service.test`    | 4     | logout resolves on error; fetchProfile typed return         |
| Integration tests      | 6     | Concurrent 401 burst; refresh failure; session init; reload |

---

## Plan Compliance Statement

The plan is compliant with Zidney Constitution v1.2.0. No architectural violations. No new ADRs required. The plan implements existing spec contracts without structural changes to the trust chain.
