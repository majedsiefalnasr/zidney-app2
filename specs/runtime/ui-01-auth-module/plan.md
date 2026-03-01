# Implementation Plan: STAGE_UI_01_AUTH_MODULE

**Stage**: STAGE_UI_01_AUTH_MODULE  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Branch**: `ui-01-auth-module`  
**Generated**: 2026-03-01  
**Status**: READY FOR IMPLEMENTATION  
**Constitution**: Zidney v1.2.0 — Verified Compliant

---

## 0. Constitution Check

| Rule                                  | Gate Result | Evidence                                               |
| ------------------------------------- | ----------- | ------------------------------------------------------ |
| No cross-tenant access                | ✅ PASS     | UI layer; no DB access; workspace slug from route only |
| No middleware bypass                  | ✅ PASS     | No backend changes in scope                            |
| No grading outside worker             | ✅ PASS     | Not in scope                                           |
| No direct DB instantiation            | ✅ PASS     | UI layer                                               |
| No client-time trust                  | ✅ PASS     | Expiry via 401 only; no `Date.now()`                   |
| No JWT payload decoding               | ✅ PASS     | Profile from `/me` endpoint only                       |
| No token in browser storage           | ✅ PASS     | `ref<string \| null>` in memory only                   |
| No apps/_ importing from other apps/_ | ✅ PASS     | Identical self-contained `core/auth/` per app          |
| No `any` in public interfaces         | ✅ PASS     | All interfaces typed; `UserRole = string` explicit     |
| No circular imports                   | ✅ PASS     | Factory injection pattern (CL-02)                      |
| Packages/types → apps: forbidden      | ✅ PASS     | types.ts defined per-app; no reverse import            |
| Structured logging only               | ✅ PASS     | `@zidney/logger` with `LOG_FORMAT=console`             |

No gate violations found. Implementation may proceed.

---

## 1. Technical Context

### Existing Scaffolding (from STAGE_UI_00)

The following files already exist with stub/partial implementations. This stage **modifies** them:

- `apps/{mmc,backoffice,frontoffice}/src/core/api/client.ts` — has inline `onRefreshToken` / `onAuthFailure`; replaced by proper delegation
- `apps/{mmc,backoffice,frontoffice}/src/core/auth/token-store.ts` — partial Pinia store; superseded by `auth.store.ts`
- `apps/{mmc,backoffice,frontoffice}/src/core/auth/index.ts` — re-exports `useAuth` composable
- `apps/{mmc,backoffice,frontoffice}/src/core/router/index.ts` — wires guards; updated to add `sessionInitialized` gate
- `apps/{mmc,backoffice,frontoffice}/src/main.ts` — updated to add `initSession` bootstrap sequence
- `apps/mmc/src/core/guards/auth.guard.ts` — existing guard; replaced by `core/router/guards/auth.guard.ts`

The following files are **new**:

- `core/auth/types.ts` — all auth type definitions (per app)
- `core/auth/token-manager.ts` — in-memory token holder (per app)
- `core/auth/refresh-manager.ts` — single-flight refresh factory (per app)
- `core/auth/auth.service.ts` — AuthService composable (per app)
- `core/state/auth.store.ts` — Pinia auth store (per app)
- `core/router/guards/auth.guard.ts` — configurable auth guard (per app)

### Tech Stack

| Concern    | Technology                                      |
| ---------- | ----------------------------------------------- |
| State      | Pinia 2.x (composition API stores)              |
| Routing    | Vue Router 4.x                                  |
| HTTP       | `@zidney/api-client` with fetch adapter         |
| Reactivity | Vue 3 `ref`, `computed`                         |
| Types      | TypeScript strict mode                          |
| Logging    | `@zidney/logger` (`createLogger`)               |
| Testing    | Vitest, `createMemoryHistory`, `setActivePinia` |

---

## 2. File Structure: Complete List

### 2.1 Files to CREATE (new in this stage)

```
apps/mmc/src/
  core/
    auth/
      types.ts                       ← AuthUser, AuthError, AuthErrorCode, IAuthService, etc.
      token-manager.ts               ← ITokenManager + createTokenManager()
      refresh-manager.ts             ← IRefreshManager + createRefreshManager(factory)
      auth.service.ts                ← createAuthService(apiClient): IAuthService
    state/
      auth.store.ts                  ← useAuthStore (Pinia, composition API)
    router/
      guards/
        auth.guard.ts                ← createAuthGuard(options): NavigationGuard

apps/backoffice/src/
  core/
    auth/
      types.ts
      token-manager.ts
      refresh-manager.ts
      auth.service.ts
    state/
      auth.store.ts
    router/
      guards/
        auth.guard.ts

apps/frontoffice/src/
  core/
    auth/
      types.ts
      token-manager.ts
      refresh-manager.ts
      auth.service.ts
    state/
      auth.store.ts
    router/
      guards/
        auth.guard.ts
```

### 2.2 Files to MODIFY (exist from Stage 00)

```
apps/mmc/src/
  core/
    api/client.ts                    ← Replace inline refresh/auth callbacks
    auth/index.ts                    ← Update re-exports to point to new modules
    router/index.ts                  ← Add sessionInitialized gate + new guard path
  main.ts                            ← Add bootstrap sequence (initSession before mount)

apps/backoffice/src/
  core/
    api/client.ts
    auth/index.ts
    router/index.ts
  main.ts

apps/frontoffice/src/
  core/
    api/client.ts
    auth/index.ts
    router/index.ts
  main.ts
```

### 2.3 Test Files to CREATE

```
tests/unit/
  auth/
    token-manager.test.ts
    refresh-manager.test.ts
    auth.store.test.ts
    auth.guard.test.ts
    auth.service.test.ts

tests/integration/
  auth/
    concurrent-refresh.test.ts
    session-init.test.ts
    logout-flow.test.ts
```

---

## 3. Module Implementation Design

### 3.1 `core/auth/types.ts`

**Purpose**: Single source of all auth-layer TypeScript types. No runtime logic.

**Exports**:

- `type UserRole = string`
- `type AuthErrorCode = 'AUTH_REFRESH_FAILED' | 'AUTH_SESSION_EXPIRED' | 'AUTH_LOGOUT_FAILED' | 'AUTH_INIT_FAILED' | 'AUTH_PROFILE_FETCH_FAILED'`
- `interface AuthError { code: AuthErrorCode; message: string }`
- `interface AuthUser { id: string; email: string; name: string; role: UserRole }`
- `interface AuthStoreState { isAuthenticated: boolean; user: AuthUser | null; isLoading: boolean; authError: AuthError | null }`
- `interface LoginCredentials { email: string; password: string }`
- `interface LoginResponse { accessToken: string; user: AuthUser }`

**Imports**: None (pure type definitions, no runtime imports)

**Key constraint**: No import from `vue`, `pinia`, `vue-router`, or `@zidney/*`. This file must be importable in test environments without any framework setup.

---

### 3.2 `core/auth/token-manager.ts`

**Purpose**: Holds the access token exclusively in reactive memory. The single source of truth for the token.

**Exports**:

```typescript
export interface ITokenManager {
  getToken(): string | null
  setToken(token: string): void
  clearToken(): void
  hasToken(): boolean
}

export function createTokenManager(): ITokenManager
```

**Implementation Design**:

```typescript
import { ref } from 'vue'
import { createLogger } from '@zidney/logger'

const logger = createLogger('token-manager')

export function createTokenManager(): ITokenManager {
  const _token = ref<string | null>(null)

  return {
    getToken(): string | null {
      return _token.value
    },
    setToken(token: string): void {
      // NEVER log token value
      logger.debug('Access token stored in memory')
      _token.value = token
    },
    clearToken(): void {
      logger.debug('Access token cleared from memory')
      _token.value = null
    },
    hasToken(): boolean {
      return _token.value !== null
    },
  }
}
```

**Bootstrap** (in `main.ts`):

```typescript
export const tokenManager = createTokenManager()
```

**Singleton pattern**: Created once in `main.ts`, passed to `createApiClient` and `createRefreshManager` via argument. Not a module-level singleton exported from this file — prevents import-time side effects and aids test isolation.

**Invariants**:

- `_token` ref is never exposed directly.
- `setToken` / `clearToken` log only debug-level metadata — never the token value.
- No `localStorage`, `sessionStorage`, `document.cookie`, `indexedDB` access.

---

### 3.3 `core/auth/refresh-manager.ts`

**Purpose**: Single-flight refresh orchestration. Guarantees exactly one parallel refresh HTTP call regardless of concurrent 401 triggers.

**Exports**:

```typescript
export interface IRefreshManager {
  refresh(): Promise<void>
  isRefreshing(): boolean
}

export function createRefreshManager(
  refreshFn: () => Promise<string>,
  onLogout: () => void,
  tokenManager: ITokenManager
): IRefreshManager
```

**Implementation Design**:

```typescript
import { createLogger } from '@zidney/logger'
import type { ITokenManager } from './token-manager'

const logger = createLogger('refresh-manager')

export function createRefreshManager(
  refreshFn: () => Promise<string>,
  onLogout: () => void,
  tokenManager: ITokenManager
): IRefreshManager {
  let inFlight: Promise<void> | null = null

  function refresh(): Promise<void> {
    if (inFlight !== null) {
      logger.debug('Refresh already in flight — joining existing promise')
      return inFlight
    }

    logger.debug('Initiating new token refresh')

    inFlight = refreshFn()
      .then((newToken: string) => {
        tokenManager.setToken(newToken)
        logger.info('Token refresh succeeded')
      })
      .catch((err: unknown) => {
        logger.error('Token refresh failed — triggering logout', {
          error: err instanceof Error ? err.message : 'unknown',
        })
        onLogout()
        return Promise.reject(err)
      })
      .finally(() => {
        inFlight = null
      })

    return inFlight
  }

  function isRefreshing(): boolean {
    return inFlight !== null
  }

  return { refresh, isRefreshing }
}
```

**Single-Flight Guarantee**:

- JavaScript's cooperative concurrency means `inFlight !== null` check + assignment before first `await` is atomic within the current microtask tick.
- All concurrent callers receive the same `Promise<void>` reference.
- `finally` clears the lock after completion (success or failure).
- `onLogout` is called exactly once inside `catch`.

**Circular Dependency Resolution (CL-02)**:

- `refresh-manager.ts` has zero imports from `auth.store.ts` or `pinia`.
- `onLogout` is a runtime callback injected in `main.ts` after store creation.

---

### 3.4 `core/auth/auth.service.ts`

**Purpose**: All backend HTTP interactions for auth flow. Implements `IAuthService`. Created via factory to enable test injection.

**Exports**:

```typescript
export interface IAuthService {
  login(credentials: LoginCredentials): Promise<LoginResponse>
  logout(): Promise<void>
  refreshToken(): Promise<{ accessToken: string }>
  fetchProfile(): Promise<AuthUser>
}

export function createAuthService(apiClient: ApiClient): IAuthService
```

**Implementation Design**:

```typescript
import { createLogger } from '@zidney/logger'
import type { ApiClient } from '@/core/api/client'
import type { AuthUser, LoginCredentials, LoginResponse } from './types'

const logger = createLogger('auth-service')

export function createAuthService(apiClient: ApiClient): IAuthService {
  return {
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
      const result = await apiClient.post<LoginResponse>(
        '/auth/login',
        credentials
      )
      // accessToken must never be logged — log only presence
      logger.info('Login response received', { hasToken: true })
      return result.data
    },

    async logout(): Promise<void> {
      try {
        await apiClient.post('/auth/logout', {})
        logger.info('Backend logout completed')
      } catch (err: unknown) {
        // FR-30: logout always resolves — backend error is non-fatal
        logger.warn(
          'Backend logout failed — proceeding with local state teardown',
          {
            error: err instanceof Error ? err.message : 'unknown',
          }
        )
        // Intentionally swallowed — do not rethrow
      }
    },

    async refreshToken(): Promise<{ accessToken: string }> {
      const result = await apiClient.post<{ accessToken: string }>(
        '/auth/refresh',
        {}
      )
      return result.data
    },

    async fetchProfile(): Promise<AuthUser> {
      const result = await apiClient.get<AuthUser>('/auth/me')
      return result.data
    },
  }
}
```

**Invariants**:

- `logout()` is `async` and always resolves. `try/catch` swallows errors intentionally.
- `login()` logs receipt but never logs the `accessToken` value.
- All HTTP calls go through the injected `apiClient` — no direct `fetch()`.

---

### 3.5 `core/state/auth.store.ts`

**Purpose**: Pinia reactive auth state. Single source of truth for `isAuthenticated`, `user`, `isLoading`, `authError`. Delegates all network operations to the injected `IAuthService`.

**Exports**:

```typescript
export const useAuthStore: (
  authService: IAuthService,
  tokenManager: ITokenManager,
  router: Router
) => ReturnType<typeof _defineAuthStore>
```

> Note: The store uses a **factory-style definition** to accept injected dependencies instead of importing them as module-level singletons. This enables test isolation without module-level mocking.

**Full Implementation Design**:

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createLogger } from '@zidney/logger'
import type { Router } from 'vue-router'
import type { IAuthService } from '../auth/auth.service'
import type { ITokenManager } from '../auth/token-manager'
import type { IRefreshManager } from '../auth/refresh-manager'
import type { AuthUser, AuthError, AuthStoreState } from '../auth/types'

const logger = createLogger('auth-store')

// Store ID constant — consistent across all three apps
const AUTH_STORE_ID = 'auth' as const

export function defineAuthStore(
  authService: IAuthService,
  tokenManager: ITokenManager,
  router: Router,
  loginRouteName: string,
  getRefreshManager: () => IRefreshManager | null
) {
  return defineStore(AUTH_STORE_ID, () => {
    // ── State ─────────────────────────────────────────────────────────────
    const isAuthenticated = ref<boolean>(false)
    const user = ref<AuthUser | null>(null)
    const isLoading = ref<boolean>(false)
    const authError = ref<AuthError | null>(null)

    // ── Helpers ───────────────────────────────────────────────────────────
    function resetState(): void {
      isAuthenticated.value = false
      user.value = null
      isLoading.value = false
      authError.value = null
    }

    function setError(code: AuthError['code'], message: string): void {
      authError.value = { code, message }
    }

    // ── Actions ───────────────────────────────────────────────────────────

    /**
     * FR-32/FR-33: Called at bootstrap in main.ts before router resolves.
     * Silently attempts to refresh the session via httpOnly cookie.
     * Does NOT redirect on failure — user was not previously logged in.
     */
    async function initSession(): Promise<void> {
      isLoading.value = true
      authError.value = null

      try {
        const { accessToken } = await authService.refreshToken()
        tokenManager.setToken(accessToken)
        const profile = await authService.fetchProfile()
        user.value = profile
        isAuthenticated.value = true
        logger.info('Session initialized', { userId: profile.id })
      } catch (err: unknown) {
        logger.info(
          'Session initialization failed — treating as unauthenticated',
          {
            error: err instanceof Error ? err.message : 'unknown',
          }
        )
        // FR-33: failure sets unauthenticated state — no redirect at this point
        resetState()
        setError('AUTH_INIT_FAILED', 'Session initialization failed')
      } finally {
        isLoading.value = false
      }
    }

    /**
     * FR-04: Called after successful login — receives token + profile from login response.
     */
    function setSession(accessToken: string, profile: AuthUser): void {
      tokenManager.setToken(accessToken)
      user.value = profile
      isAuthenticated.value = true
      isLoading.value = false
      authError.value = null
      logger.info('Session established', { userId: profile.id })
    }

    /**
     * FR-04: Delegates to refresh-manager (single-flight protected).
     * Called by API client's onRefreshToken handler or directly by feature modules.
     * Returns true on successful refresh, false on failure (never throws).
     */
    async function refresh(): Promise<boolean> {
      const rm = getRefreshManager()
      if (!rm) {
        logger.warn('refresh() called before refreshManager was initialized')
        return false
      }
      try {
        await rm.refresh()
        logger.debug('Token refreshed via store action')
        return true
      } catch (err: unknown) {
        logger.error('Token refresh failed via store action', { error: err })
        return false
      }
    }

    /**
     * FR-35: Coordinated logout — backend invalidation + unconditional state teardown.
     * FR-36: Idempotent — no effect if already logged out.
     */
    async function logout(): Promise<void> {
      // FR-36: idempotent guard
      if (!isAuthenticated.value && !isLoading.value) {
        logger.debug('logout() called when already logged out — no-op')
        return
      }

      isLoading.value = true

      // Step 1: Backend logout (fire and forget — FR-30)
      await authService.logout()

      // Step 2: Clear token from memory
      tokenManager.clearToken()

      // Step 3: Reset all state
      resetState()

      // Step 4: Redirect to login
      await router.push({ name: loginRouteName })

      logger.info('User logged out')
    }

    /**
     * FR-04: Clears the authError field.
     */
    function clearAuthError(): void {
      authError.value = null
    }

    return {
      // State (readonly refs exposed to components)
      isAuthenticated,
      user,
      isLoading,
      authError,
      // Actions
      initSession,
      setSession,
      refresh,
      logout,
      clearAuthError,
    }
  })
}
```

**Design Notes**:

- FR-07: Token is never exposed as a getter. `tokenManager` is injected but not returned.
- FR-05: No direct HTTP calls — all delegated to `authService`.
- FR-06: No permission checks or role comparisons.
- `loginRouteName` is injected at store definition time per app (MMC: `'mmc-login'`, etc.).
- The store uses composition API (`defineStore(id, () => {...})`) for testability.
- `logout()` `isLoading` is reset inside `resetState()` — guarantees clean state regardless of router outcome.

---

### 3.6 `core/router/guards/auth.guard.ts`

**Purpose**: Factory that returns a `NavigationGuard` function configured with per-app route names.

**Exports**:

```typescript
export interface AuthGuardOptions {
  loginRouteName: string
  dashboardRouteName: string
}

export function createAuthGuard(
  authStore: ReturnType<typeof defineAuthStore>,
  options: AuthGuardOptions
): NavigationGuard
```

**Implementation Design**:

```typescript
import type {
  NavigationGuard,
  RouteLocationNormalized,
  RouteLocationRaw,
} from 'vue-router'
import { createLogger } from '@zidney/logger'
import type { AuthGuardOptions } from './types'

const logger = createLogger('auth-guard')

export function createAuthGuard(
  getIsAuthenticated: () => boolean,
  options: AuthGuardOptions
): NavigationGuard {
  return (to: RouteLocationNormalized): RouteLocationRaw | boolean => {
    const isAuthenticated = getIsAuthenticated()

    // FR-23: requiresAuth logic
    if (to.meta['requiresAuth'] === true) {
      if (!isAuthenticated) {
        logger.debug('Auth guard: unauthenticated access to protected route', {
          route: to.name?.toString() ?? to.path,
        })
        return { name: options.loginRouteName }
      }
      return true
    }

    // FR-23: guestOnly logic
    if (to.meta['guestOnly'] === true) {
      if (isAuthenticated) {
        logger.debug(
          'Auth guard: authenticated user accessing guest-only route',
          {
            route: to.name?.toString() ?? to.path,
          }
        )
        return { name: options.dashboardRouteName }
      }
      return true
    }

    // FR-23: no relevant meta — allow
    return true
  }
}
```

**Invariants**:

- FR-24: Uses `getIsAuthenticated()` callback (passes `() => authStore.isAuthenticated`). No direct token manager access.
- FR-25: **Returns** redirect locations; never calls `router.push()`.
- FR-26: No exceptions thrown — guard is a pure (sync) discriminator.
- FR-27: `options.loginRouteName` and `options.dashboardRouteName` are app-specific.
- No JWT payload inspection of any kind.

---

### 3.7 `core/api/client.ts` — Updated Wiring (CL-03)

**Purpose**: Replace inline stub callbacks with proper `token-manager` and `refresh-manager` delegation.

**Current (Stage 00 stub) → Replacement Pattern**:

```typescript
// BEFORE (current token-store.ts based implementation):
getAccessToken: () => auth.getAccessToken(),
onRefreshToken: async () => {
  // inline fetch — no single-flight protection
  const response = await fetch(...)
  auth.setAccessToken(data.data.accessToken)
  return data.data.accessToken
},
onAuthFailure: () => {
  auth.clearAccessToken()
  storeWithRouter.router?.push('/login')
}

// AFTER (this stage — factory-wired):
getAccessToken: () => tokenManager.getToken(),
onRefreshToken: async () => {
  await refreshManager.refresh()      // single-flight protected; sets token internally
  const token = tokenManager.getToken()
  if (!token) throw new Error('No token after refresh')
  return token
},
onAuthFailure: () => {
  // onLogout callback wired to authStore.logout() at bootstrap
  // invoked synchronously — authStore.logout() handles async internally
  void authStore.logout()
}
```

**Key Change**: The `getApiClient()` singleton factory now accepts `tokenManager` and `refreshManager` as arguments rather than importing the legacy `token-store`.

```typescript
// Updated signature:
export function createAppApiClient(
  tokenManager: ITokenManager,
  refreshManager: IRefreshManager,
  onAuthFailure: () => void
): ApiClient
```

---

### 3.8 `main.ts` — Bootstrap Sequence (CL-01)

**Bootstrap order is critical** — dependencies must be wired in the correct sequence.

**Updated `main.ts` pattern** (identical for all three apps, with app-specific route names):

```typescript
// 1. Config validation (throws early if misconfigured)
import '@/core/config/app-config'

import { createApp, ref } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from '@/core/router/routes'
import { appConfig } from '@/core/config/app-config'
import { createTokenManager } from '@/core/auth/token-manager'
import { createRefreshManager } from '@/core/auth/refresh-manager'
import { createAuthService } from '@/core/auth/auth.service'
import { createAppApiClient } from '@/core/api/client'
import { defineAuthStore } from '@/core/state/auth.store'
import { createAuthGuard } from '@/core/router/guards/auth.guard'

// App-specific route name constants (per-app — NOT shared in core/auth/)
const LOGIN_ROUTE = 'mmc-login' // 'bo-login' in backoffice, 'fo-login' in frontoffice
const DASHBOARD_ROUTE = 'mmc-dashboard' // 'bo-dashboard' in backoffice, 'fo-home' in frontoffice

// ── Step 1: Create Pinia ────────────────────────────────────────────────────
const pinia = createPinia()

// ── Step 2: Create Router (without guards yet) ─────────────────────────────
const router = createRouter({
  history: createWebHistory(),
  routes,
})

// ── Step 3: Create Token Manager ───────────────────────────────────────────
const tokenManager = createTokenManager()

// ── Step 4: Create Auth Service (needs api client — forward declare) ────────
// apiClient is created next; authService references it by closure
let apiClient: ReturnType<typeof createAppApiClient>

const authService = createAuthService({
  post: (...args) => apiClient.post(...args),
  get: (...args) => apiClient.get(...args),
})

// ── Step 5: Create Auth Store ──────────────────────────────────────────────
// refreshManager is created in Step 6 — use lazy accessor to avoid creation-order circular dep
let refreshManagerInstance: IRefreshManager | null = null
const useAuthStore = defineAuthStore(
  authService,
  tokenManager,
  router,
  LOGIN_ROUTE,
  () => refreshManagerInstance
)
const authStore = useAuthStore(pinia)

// ── Step 6: Create Refresh Manager (needs authStore.logout for onLogout) ───
const refreshManager = createRefreshManager(
  () => authService.refreshToken().then((r) => r.accessToken),
  () => void authStore.logout(),
  tokenManager
)
refreshManagerInstance = refreshManager // wire lazy accessor

// ── Step 7: Create API Client (wires token + refresh) ──────────────────────
apiClient = createAppApiClient(
  tokenManager,
  refreshManager,
  () => void authStore.logout()
)

// ── Step 8: Register Auth Guard with sessionInitialized gate (CL-01) ────────
const sessionInitialized = ref(false)
const authGuard = createAuthGuard(() => authStore.isAuthenticated, {
  loginRouteName: LOGIN_ROUTE,
  dashboardRouteName: DASHBOARD_ROUTE,
})

router.beforeEach(async (to, from) => {
  // CL-01: Gate — wait for initSession() to complete before evaluating guards
  if (!sessionInitialized.value) {
    await authStore.initSession()
    sessionInitialized.value = true
  }
  return authGuard(to, from)
})

// ── Step 9: Mount ──────────────────────────────────────────────────────────
const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')
```

**Critical Ordering Rationale**:

1. `pinia` created before any store access.
2. `tokenManager` created before `refreshManager` (tokenManager injected into refresh manager).
3. `authStore` created before `refreshManager` (authStore.logout injected into refresh manager).
4. `refreshManager` + `apiClient` created after `authStore` exists — breaks circular ref chain.
5. `router.beforeEach` registered with `sessionInitialized` gate **before** `app.mount()`.
6. `app.mount()` is the last step — all wiring complete before rendering begins.

---

## 4. Per-App Configuration Matrix

| Config Item                          | MMC                                     | Backoffice                              | Frontoffice                              |
| ------------------------------------ | --------------------------------------- | --------------------------------------- | ---------------------------------------- |
| `LOGIN_ROUTE`                        | `'mmc-login'`                           | `'bo-login'`                            | `'fo-login'`                             |
| `DASHBOARD_ROUTE`                    | `'mmc-dashboard'`                       | `'bo-dashboard'`                        | `'fo-home'`                              |
| API Base URL                         | `appConfig.env.apiBaseUrl` (master API) | `appConfig.env.apiBaseUrl` (tenant API) | `appConfig.env.apiBaseUrl` (student API) |
| `AuthUser.role` type                 | `MMCUserRole` (from `@zidney/types`)    | `string` (pending BO stage)             | `string` (pending FO stage)              |
| Login endpoint                       | `POST /auth/login`                      | `POST /auth/login`                      | `POST /auth/login`                       |
| No workspace context in token module | ✅                                      | ✅ (workspace from route, not token)    | ✅                                       |

**App-agnosticism rule enforced**: All app-specific values live in `main.ts` only — never inside `core/auth/`.

---

## 5. Test Strategy

### 5.1 Test Infrastructure Setup

```typescript
// tests/unit/auth/setup.ts
import { setActivePinia, createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { vi } from 'vitest'
import type { IAuthService } from '@/core/auth/auth.service'
import type { AuthUser } from '@/core/auth/types'

export function createMockAuthService(): IAuthService {
  return {
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshToken: vi.fn().mockResolvedValue({ accessToken: 'mock-token' }),
    fetchProfile: vi.fn().mockResolvedValue<AuthUser>({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
    }),
  }
}

export function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: {} },
      {
        path: '/login',
        name: 'mmc-login',
        component: {},
        meta: { guestOnly: true },
      },
      {
        path: '/dashboard',
        name: 'mmc-dashboard',
        component: {},
        meta: { requiresAuth: true },
      },
    ],
  })
}

export function setupTestPinia() {
  setActivePinia(createPinia())
}
```

### 5.2 Unit Test Cases

#### `token-manager.test.ts`

| Test                                                        | Assertion                                             |
| ----------------------------------------------------------- | ----------------------------------------------------- |
| `getToken()` returns `null` before any `setToken` call      | `expect(tm.getToken()).toBeNull()`                    |
| `setToken(value)` stores value retrievable via `getToken()` | `expect(tm.getToken()).toBe('my-token')`              |
| `hasToken()` returns `false` before set                     | `expect(tm.hasToken()).toBe(false)`                   |
| `hasToken()` returns `true` after set                       | `expect(tm.hasToken()).toBe(true)`                    |
| `clearToken()` destroys value                               | `tm.clearToken(); expect(tm.getToken()).toBeNull()`   |
| `setToken` does not write to `localStorage`                 | `expect(localStorage.setItem).not.toHaveBeenCalled()` |
| `setToken` does not write to `sessionStorage`               | similar                                               |
| `setToken` does not write to `document.cookie`              | check `document.cookie` unchanged                     |

#### `refresh-manager.test.ts`

| Test                                                    | Assertion                                              |
| ------------------------------------------------------- | ------------------------------------------------------ |
| Single refresh call for concurrent invocations          | 3 parallel `refresh()` → `refreshFn` called once       |
| All callers resolve when refresh succeeds               | All 3 promises resolve                                 |
| All callers reject when refresh fails                   | All 3 promises reject                                  |
| `onLogout` called exactly once on failure               | `onLogoutSpy` called 1 time                            |
| `isRefreshing()` true during refresh, false after       |                                                        |
| Second burst after first completes triggers new refresh | `refreshFn` called twice total for 2 sequential bursts |

```typescript
// Concurrency test pattern:
it('issues exactly one refresh for 3 concurrent 401s', async () => {
  const refreshFn = vi.fn().mockResolvedValue('new-token')
  const rm = createRefreshManager(refreshFn, vi.fn(), tokenManager)

  const [p1, p2, p3] = await Promise.allSettled([
    rm.refresh(),
    rm.refresh(),
    rm.refresh(),
  ])

  expect(refreshFn).toHaveBeenCalledTimes(1)
  expect(p1.status).toBe('fulfilled')
  expect(p2.status).toBe('fulfilled')
  expect(p3.status).toBe('fulfilled')
})
```

#### `auth.store.test.ts`

| Test                                                                                           | Assertion                                    |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Initial state matches `AuthStoreState` defaults                                                | `isAuthenticated: false`, `user: null`, etc. |
| `setSession()` sets `isAuthenticated: true` and `user`                                         |                                              |
| `initSession()` on success → `isAuthenticated: true`                                           |                                              |
| `initSession()` on failure → `isAuthenticated: false`, `authError.code === 'AUTH_INIT_FAILED'` |                                              |
| `logout()` resets state to initial values                                                      | post-logout state equals initial state       |
| `logout()` when already logged out → no-op                                                     | `authService.logout` not called              |
| `clearAuthError()` clears `authError`                                                          |                                              |

#### `auth.guard.test.ts`

| Test                                                                  | Assertion                           |
| --------------------------------------------------------------------- | ----------------------------------- |
| `requiresAuth: true` + unauthenticated → redirect to `loginRouteName` | returns `{ name: 'mmc-login' }`     |
| `requiresAuth: true` + authenticated → allow                          | returns `true`                      |
| `guestOnly: true` + authenticated → redirect to `dashboardRouteName`  | returns `{ name: 'mmc-dashboard' }` |
| `guestOnly: true` + unauthenticated → allow                           | returns `true`                      |
| No meta fields → allow (any auth state)                               | returns `true`                      |
| Guard never calls `router.push()`                                     | mock router.push not called         |
| Guard never throws                                                    | no exception raised                 |

#### `auth.service.test.ts`

| Test                                         | Assertion                                               |
| -------------------------------------------- | ------------------------------------------------------- |
| `logout()` resolves when api client throws   | `expect(authService.logout()).resolves.toBeUndefined()` |
| `fetchProfile()` returns typed `AuthUser`    | shape matches interface                                 |
| `login()` forwards credentials to api client | api client called with correct endpoint                 |

### 5.3 Integration Tests

#### `concurrent-refresh.test.ts`

```
Setup: Create auth store with mock authService
       Configure refreshToken to resolve after 50ms delay
       Set initial authenticated state with old token
Test:  Simulate 5 concurrent API calls all receiving 401
       → Assert refreshManager.refresh() called once
       → Assert all 5 calls eventually succeed
       → Assert final token in tokenManager is new token
```

#### `session-init.test.ts`

```
Scenario A (authenticated reload):
  refreshToken mock → resolves with token
  fetchProfile mock → resolves with user
  Assert: isAuthenticated = true, user populated, isLoading = false

Scenario B (unauthenticated reload):
  refreshToken mock → rejects (401 from server)
  Assert: isAuthenticated = false, user = null, authError.code = 'AUTH_INIT_FAILED'
  Assert: router.push NOT called (no redirect on init failure)
```

#### `logout-flow.test.ts`

```
Scenario A (normal logout):
  isAuthenticated = true
  logout() called
  Assert: authService.logout() called once
  Assert: tokenManager.clearToken() called
  Assert: isAuthenticated = false, user = null
  Assert: router.push called with { name: loginRouteName }

Scenario B (logout with backend error):
  authService.logout rejects
  logout() still resolves
  Assert: isAuthenticated = false (state cleared despite backend error)

Scenario C (double logout):
  logout() called twice
  Assert: authService.logout called exactly once
```

---

## 6. Migration / Cleanup Plan

### Files Being Superseded

The following Stage 00 scaffolding files are **replaced** by this stage's implementation. They must be cleaned up:

| Old File                                 | Status         | Replacement                                               |
| ---------------------------------------- | -------------- | --------------------------------------------------------- |
| `apps/*/src/core/auth/token-store.ts`    | **DELETED**    | `core/auth/token-manager.ts` + `core/state/auth.store.ts` |
| `apps/*/src/core/auth/index.ts`          | **UPDATED**    | Re-exports from new modules                               |
| `apps/mmc/src/core/guards/auth.guard.ts` | **SUPERSEDED** | `core/router/guards/auth.guard.ts`                        |
| `apps/mmc/src/core/state/index.ts`       | **UPDATED**    | Remove router injection into Pinia plugin                 |

### Migration Steps Per App

1. Create `core/auth/types.ts`
2. Create `core/auth/token-manager.ts`
3. Create `core/auth/refresh-manager.ts`
4. Create `core/auth/auth.service.ts`
5. Create `core/state/auth.store.ts`
6. Create `core/router/guards/auth.guard.ts`
7. Update `core/api/client.ts` — replace inline callbacks
8. Update `core/router/index.ts` — remove old guard import, add gate logic
9. Update `main.ts` — full bootstrap sequence
10. Update `core/auth/index.ts` — re-export from new modules
11. Delete `core/auth/token-store.ts`
12. Remove `core/guards/` directory if empty (MMC only)
13. Run `tsc --noEmit` — verify zero type errors
14. Run `eslint` — verify zero lint errors
15. Run unit tests — verify all pass

---

## 7. ESLint & TypeScript Constraints

### TypeScript Strict Mode Requirements

- `strict: true` must remain in each app's `tsconfig.app.json`
- No `any` in public interfaces of `types.ts`, `token-manager.ts`, `refresh-manager.ts`, `auth.service.ts`, `auth.store.ts`, `auth.guard.ts`
- `unknown` used in catch clauses: `catch (err: unknown)` with `instanceof Error` narrowing
- `void` used for fire-and-forget async calls: `void authStore.logout()`

### ESLint Rules Enforced

- `no-restricted-globals`: `fetch` must not be called in `core/auth/` — only via api client
- `no-restricted-syntax`: no `console.log|warn|error` — use `@zidney/logger`
- Token value must not appear in string template literals passed to logger calls (enforced by code review + grep CI check)

### CI Verification Commands

```bash
# Type checking (per app)
pnpm --filter @zidney/mmc tsc --noEmit
pnpm --filter @zidney/backoffice tsc --noEmit
pnpm --filter @zidney/frontoffice tsc --noEmit

# Lint
pnpm --filter @zidney/mmc lint
pnpm --filter @zidney/backoffice lint
pnpm --filter @zidney/frontoffice lint

# Token leak check (CI grep)
grep -r "accessToken" apps/*/src/core/auth/ --include="*.ts" | grep -v "types.ts\|auth.service.ts"
# Expected: zero matches in logger calls
```

---

## 8. Completion Criteria Checklist

| Criterion                             | Verification                                            |
| ------------------------------------- | ------------------------------------------------------- |
| Auth store typed state                | `tsc --noEmit` passes; store type tests pass            |
| Token in memory only                  | Unit test: no storage API calls                         |
| Single-flight refresh                 | Concurrency test: 3 parallel calls → 1 HTTP request     |
| Queued requests retry                 | Integration: 3 concurrent 401s all succeed post-refresh |
| Failed refresh forces logout          | Unit: refresh reject → store reset → router redirect    |
| Logout clears all state               | Unit: post-logout state === initial state               |
| Guard protects requiresAuth routes    | Nav test: unauthenticated → login redirect              |
| Guard redirects from guestOnly routes | Nav test: authenticated → dashboard redirect            |
| No token logged                       | Grep CI: no token in logger calls                       |
| `initSession()` prevents login flash  | Integration: auth reload → no login redirect            |
| Test coverage across all three apps   | CI: tests green for mmc, backoffice, frontoffice        |
| ESLint zero errors                    | CI: lint passes                                         |
| TypeScript strict passes              | CI: tsc passes                                          |

---

## 9. Artifacts Produced

| Artifact            | Path                                            |
| ------------------- | ----------------------------------------------- |
| Research            | `specs/runtime/ui-01-auth-module/research.md`   |
| Data Model          | `specs/runtime/ui-01-auth-module/data-model.md` |
| Implementation Plan | `specs/runtime/ui-01-auth-module/plan.md`       |
