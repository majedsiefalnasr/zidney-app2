# Implementation Plan — STAGE_UI_00_RUNTIME_ARCHITECTURE

**Stage**: STAGE_UI_00_RUNTIME_ARCHITECTURE  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Generated**: 2026-02-28  
**Branch**: `ui-00-runtime-architecture`  
**Research**: `specs/runtime/ui-00-runtime-architecture/research.md`  
**Spec**: `specs/runtime/ui-00-runtime-architecture/spec.md`

---

## Constitution Check

| Rule                                       | Status  | Evidence                                    |
| ------------------------------------------ | ------- | ------------------------------------------- |
| Database-per-tenant only                   | ✅ PASS | UI has no DB access                         |
| License middleware for workspace routes    | ✅ PASS | No backend routes modified                  |
| Schema + product version compatibility     | ✅ PASS | No schema changes                           |
| Attempt configuration snapshotted at start | ✅ PASS | Attempt engine not modified                 |
| Server time is authoritative               | ✅ PASS | No client-side timers implemented           |
| No cross-tenant joins                      | ✅ PASS | No DB query in UI                           |
| No row-based multi-tenancy                 | ✅ PASS |                                             |
| No global DB singleton                     | ✅ PASS |                                             |
| All changes align with ADRs                | ✅ PASS | R-07 confirmed no ADR conflicts             |
| Stage lifecycle: spec has DRAFT status     | ✅ PASS | Clarifications at §16 confirm spec complete |

**Gate result: ALL PASS — Implementation authorized.**

---

## 1. Architecture Overview

### 1.1 Layer Map (per app)

```
┌─────────────────────────────────────────────────────────────────────┐
│  UI Layer (Vue SFC)                                                 │
│  modules/<feature>/views/*.vue                                      │
│  modules/<feature>/components/*.vue                                 │
│  shared/components/*.vue                                            │
│  → Consumes: composables, stores, typed props                       │
│  → NEVER imports: fetch, axios, import.meta.env                     │
├─────────────────────────────────────────────────────────────────────┤
│  Application Layer (Stores / Module API)                            │
│  modules/<feature>/store.ts     (Pinia store)                       │
│  modules/<feature>/api.ts       (calls core/api/client.ts)          │
│  → Consumes: core/api/client.ts, core/errors/error-normalizer.ts   │
│  → NEVER imports: fetch, axios                                      │
├─────────────────────────────────────────────────────────────────────┤
│  Infrastructure Layer (core/)                                       │
│  core/api/client.ts             HTTP client + interceptors          │
│  core/config/env.ts             Typed env access + validation       │
│  core/errors/error-normalizer.ts Pure error normalization           │
│  → Consumes: core/config/env.ts, core/auth/token-store.ts          │
│  → NEVER imports: Vue components                                    │
├─────────────────────────────────────────────────────────────────────┤
│  Auth Layer (core/auth/)                                            │
│  core/auth/token-store.ts       Pinia auth store (memory only)     │
│  core/auth/index.ts (useAuth)   Composable façade                  │
│  → Consumes: core/api/client.ts (for logout call)                  │
│  → NEVER writes to localStorage/sessionStorage                     │
├─────────────────────────────────────────────────────────────────────┤
│  Router + Guard Layer (core/router/, core/guards/)                  │
│  core/router/index.ts           Vue Router 4 instance               │
│  core/guards/auth.guard.ts      Auth check → redirect to /login    │
│  core/guards/role.guard.ts      Role check → redirect to /403      │
│  core/guards/workspace.guard.ts Workspace slug match (BO only)     │
│  → Consumes: core/auth/token-store.ts, route meta                  │
│  → NEVER contains business logic                                    │
└─────────────────────────────────────────────────────────────────────┘
         ↑
packages/ui-system   (shadcn-vue components, layout, shared utils)
         ↑
         ↑ All apps consume via @zidney/ui alias
```

### 1.2 Cross-App Shared Logic Boundary

| Where it lives                     | What goes there                                                 | Rationale                                                        |
| ---------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| `packages/ui-system`               | AppLayout, SidebarLayout, TopBar, DataTable, Dialogs, Filters   | Used by 2+ apps; already there                                   |
| `packages/ui-system`               | Any new layout wrapper shared by 2+ apps                        | Never copy layout across apps                                    |
| App-local `src/core/`              | API client, router, guards, auth, config, errors                | Per-app configuration differs (base URL, roles, workspace scope) |
| App-local `src/shared/`            | App-specific cross-cutting components (AuditTrailViewer in MMC) | Only used by one app                                             |
| App-local `src/modules/<feature>/` | All domain-specific components, views, stores, routes           | Feature isolation                                                |

**Rule**: If a composable or component is needed in 2+ apps → `packages/ui-system`. If only in 1 app → `src/shared/` or `src/modules/`.

---

## 2. Canonical Folder Structure (All Apps)

```
src/
├── main.ts                           App entry — bootstrap sequence
├── App.vue                           Root component — <RouterView /> only
│
├── core/
│   ├── api/
│   │   └── client.ts                 HTTP client factory + interceptors
│   ├── auth/
│   │   ├── index.ts                  useAuth() composable
│   │   └── token-store.ts            Pinia auth store (memory token)
│   ├── config/
│   │   └── env.ts                    AppConfig type + startup validation
│   ├── errors/
│   │   ├── error-normalizer.ts       normalizeError() pure function
│   │   └── types.ts                  NormalizedError, ApiErrorResponse
│   ├── guards/
│   │   ├── auth.guard.ts             AuthGuard
│   │   ├── role.guard.ts             RoleGuard
│   │   └── workspace.guard.ts        WorkspaceGuard (backoffice ONLY)
│   ├── router/
│   │   └── index.ts                  Vue Router 4 instance
│   └── state/
│       └── index.ts                  createPinia() initialization
│
├── modules/
│   └── <feature-name>/
│       ├── components/               Feature-scoped Vue components
│       ├── views/                    Routed page components
│       ├── api.ts                    Module API — calls core/api/client
│       ├── routes.ts                 RouteRecordRaw[] for this module
│       ├── store.ts                  Pinia store for this module
│       └── types.ts                  Module-local TypeScript types
│
└── shared/
    ├── components/                   App-internal cross-cutting components
    ├── composables/                  App-internal cross-cutting composables
    └── utils/                        App-internal utilities
```

---

## 3. Core Layer File Specifications

### 3.1 `core/config/env.ts`

**Purpose**: Single point of access for all environment variables. Validates at startup. No other file may reference `import.meta.env`.

```typescript
// Resolved at module initialization time
interface AppConfig {
  apiBaseUrl: string
  buildEnv: 'development' | 'staging' | 'production'
  debugMode: boolean
}

function resolveConfig(): AppConfig
// Throws: Error(`[env] Missing required variable: VITE_API_BASE_URL`) if missing

export const appConfig: AppConfig = resolveConfig()
```

**Validation pattern**: Check `import.meta.env.VITE_API_BASE_URL` — throw descriptive error if falsy. Derive `buildEnv` from `import.meta.env.MODE`. Set `debugMode` from `import.meta.env.VITE_DEBUG_MODE === 'true'`.

**Per-app env vars**:

- MMC: `VITE_API_BASE_URL` (master API base)
- Backoffice: `VITE_API_BASE_URL` (tenant API base), `VITE_WORKSPACE_SLUG` (optional for dev)
- Frontoffice: `VITE_API_BASE_URL` (student API base)

### 3.2 `core/errors/types.ts` and `core/errors/error-normalizer.ts`

**`types.ts`**:

```typescript
interface NormalizedError {
  code: string // e.g. 'AUTH_REFRESH_FAILED', 'NETWORK_ERROR', 'UNKNOWN_ERROR'
  message: string
  httpStatus: number // 0 = network error, -1 = unknown shape, 4xx/5xx = HTTP status
}

interface ApiErrorResponse {
  success: false
  data: null
  error: {
    code: string
    message: string
  }
}
```

**`error-normalizer.ts`**:

```typescript
function normalizeError(raw: unknown): NormalizedError
```

Three failure modes (from spec FR-28):

1. **Standard API error** (`{ success: false, error: { code, message } }` + HTTP status in response) → extract code, message, status
2. **Network error** (TypeError / no response / `httpStatus === 0`) → `{ code: 'NETWORK_ERROR', message: 'Network request failed', httpStatus: 0 }`
3. **Unknown shape** (anything else) → `{ code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred', httpStatus: -1 }`

**Purity constraint**: Pure function. No imports from Vue, Pinia, or Router. No side effects.

### 3.3 `core/api/client.ts`

**Structure**: Factory function — `createApiClient(config: AppConfig): ApiClient`. Not a singleton. Injectable for tests.

```typescript
interface RequestConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  params?: Record<string, unknown> // serialized via URLSearchParams (flat keys only; nested not supported in v1)
  data?: unknown
  idempotencyKey?: string
}

// Base fetch options applied to every request:
// - credentials: 'include' — REQUIRED so the browser sends the httpOnly refresh cookie
//   on cross-origin requests (e.g., app.mmc.zidney.com → api.zidney.com)
// - content-type defaults are set per-method by contentTypeInterceptor
const BASE_FETCH_OPTIONS: RequestInit = {
  credentials: 'include',
} as const

interface ApiResponse<T = unknown> {
  success: true
  data: T
}

interface ApiClient {
  get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>>
  post<T>(
    url: string,
    data: unknown,
    idempotencyKey?: string
  ): Promise<ApiResponse<T>>
  put<T>(url: string, data: unknown): Promise<ApiResponse<T>>
  patch<T>(url: string, data: unknown): Promise<ApiResponse<T>>
  delete<T>(url: string, data?: unknown): Promise<ApiResponse<T>> // data optional (bulk delete)
}
```

**Singleton export**: `client.ts` exports BOTH the factory AND a default application-scoped instance:

```typescript
// Factory (used in tests — inject custom tokenStore + fetch)
export function createApiClient(config: AppConfig, tokenStore: TokenStore, fetchFn = fetch): ApiClient { ... }

// Default singleton — created once at module load using appConfig
// All modules/*/api.ts files import this instance
export const apiClient: ApiClient = createApiClient(appConfig, useAuthStore())

// Test isolation: vi.mock('@/core/api/client', () => ({ apiClient: mockClient }))
```

**Interceptor implementation strategy**:

Request interceptors (applied in order):

1. `authInterceptor` — reads `tokenStore.getAccessToken()`, attaches `Authorization: Bearer <token>` if present. NEVER logs the token.
2. `contentTypeInterceptor` — attaches `Content-Type: application/json` for POST, PUT, PATCH only (not GET/DELETE).
3. `idempotencyInterceptor` — attaches `Idempotency-Key` header if `idempotencyKey` provided.
4. `correlationInterceptor` — attaches `X-Correlation-ID: crypto.randomUUID()` per request.

Response interceptors (applied in order):

1. `errorNormalizerInterceptor` — on non-2xx, calls `normalizeError(rawResponse)`, throws `NormalizedError`.
2. `refreshInterceptor` — on `httpStatus === 401` (via normalized error with code check), triggers single-flight token refresh.

**Single-flight refresh strategy**:

- Maintain a closure-scoped `let refreshPromise: Promise<void> | null = null` (factory closure, not module-level — one per instance).
- On 401: if `refreshPromise` is null, set it to the refresh request. Queue all concurrent failed requests.
- On refresh success: clear `refreshPromise`, drain queue, retry all queued requests.
- On refresh failure: clear `refreshPromise`, reject all queued with `{ code: 'AUTH_REFRESH_FAILED', message: 'Session expired. Please log in again.', httpStatus: 401 }`. Clear auth store. Redirect to login.

**Request queue type** (typed alongside `refreshPromise`):

```typescript
type QueueEntry = {
  resolve: (value: unknown) => void
  reject: (reason: NormalizedError) => void
  retry: () => Promise<unknown>
}
let requestQueue: QueueEntry[] = []
```

**Underlying transport**: Use native `fetch` with `credentials: 'include'` in base options (see `BASE_FETCH_OPTIONS` above). No axios. No ky. Avoids additional bundle weight.

**Mockability**: Factory pattern ensures tests can inject a mock `tokenStore` and mock `fetch` without module-level singletons.

### 3.4 `core/auth/token-store.ts`

**Pinia store** using `defineStore`:

```typescript
// Store ID: 'auth'
interface AuthState {
  accessToken: string | null
  user: AuthUser | null
}

interface AuthUser {
  id: string
  email: string
  role: string
  workspaceSlug?: string  // backoffice only
}

// Actions exposed:
setAccessToken(token: string): void
clearAccessToken(): void
getAccessToken(): string | null

// Getters:
isAuthenticated: boolean   // computed: accessToken !== null
```

**Critical constraint**: `accessToken` is ONLY ever in reactive Pinia state. No `localStorage.setItem`, `sessionStorage.setItem`, or cookie write is permitted. `workspaceSlug` is relevant only for Backoffice; MMC and Frontoffice set it to `undefined`.

### 3.5 `core/auth/index.ts` — `useAuth()` composable

```typescript
interface UseAuthReturn {
  isAuthenticated: ComputedRef<boolean>
  currentUser: ComputedRef<AuthUser | null>
  logout(): Promise<void>
}

export function useAuth(): UseAuthReturn
```

**Dependency injection for `useAuth()`**:

- `apiClient` is imported as the default singleton from `@/core/api/client`
- `router` is obtained via `useRouter()` (Vue Router composable — valid inside `setup()` context)
- `tokenStore` is obtained via `useAuthStore()` (Pinia)
- `useAuth()` delegates to the auth store's actions for any state mutations; does NOT mutate store state directly

**`logout()` contract**:

1. Call `DELETE /auth/logout` via `apiClient` (best-effort — do not block on failure; catch and discard error)
2. Call `tokenStore.clearAccessToken()`
3. Call `router.push('/login')` via `useRouter()`

### 3.6 `core/router/index.ts`

```typescript
// Exports single router instance
export const router: Router = createRouter({
  history: createWebHistory(),
  routes: [
    ...dashboardRoutes, // imported from modules/dashboard/routes.ts
    ...licensesRoutes, // imported from modules/licenses/routes.ts (MMC)
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/shared/views/NotFound.vue'),
    },
  ],
})

router.beforeEach(async (to, from) => {
  const authStore = useAuthStore()
  const authResult = await authGuard({ to, from, authStore })
  if (authResult !== true) return authResult

  const roleResult = await roleGuard({ to, from, authStore })
  if (roleResult !== true) return roleResult

  // workspaceGuard only in backoffice
  return true
})
```

**Route meta type extension**:

```typescript
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth: boolean
    requiredRole?: string
    requiresWorkspace?: boolean // backoffice only
  }
}
```

**Lazy-loading**: All module views use `() => import('@/modules/<feature>/views/<View>.vue')`. No eager imports.

### 3.7 `core/guards/auth.guard.ts`

```typescript
type GuardResult = true | RouteLocationRaw

interface GuardContext {
  to: RouteLocationNormalized
  from: RouteLocationNormalized
  authStore: ReturnType<typeof useAuthStore>
}

type Guard = (context: GuardContext) => GuardResult | Promise<GuardResult>

export const authGuard: Guard = ({ to, authStore }) => {
  if (!to.meta.requiresAuth) return true
  if (authStore.isAuthenticated) return true
  return { name: 'login' }
}
```

**Constraints**: No business logic. Reads only `to.meta.requiresAuth` and `authStore.isAuthenticated`. Returns redirect target, never throws.

### 3.8 `core/guards/role.guard.ts`

```typescript
export const roleGuard: Guard = ({ to, authStore }) => {
  if (!to.meta.requiredRole) return true
  if (authStore.user?.role === to.meta.requiredRole) return true
  return { name: 'forbidden' } // 403 route
}
```

### 3.9 `core/guards/workspace.guard.ts` (Backoffice only)

```typescript
export const workspaceGuard: Guard = ({ to, authStore }) => {
  if (!to.meta.requiresWorkspace) return true
  const routeSlug = to.params['slug']
  if (
    typeof routeSlug === 'string' &&
    routeSlug === authStore.user?.workspaceSlug
  )
    return true
  return { name: 'forbidden' }
}
```

### 3.10 `core/state/index.ts` — Pinia Initialization

```typescript
import { createPinia, markRaw } from 'pinia'
import type { Router } from 'vue-router'

export function createAppPinia(router: Router) {
  const pinia = createPinia()
  pinia.use(({ store }) => {
    store.router = markRaw(router)
  })
  return pinia
}
```

**Strict mode note**: Pinia v2 does not have a formal `strict` flag in `createPinia()`. Strict mode in Zidney context means: (a) stores do not call other stores' actions directly, (b) stores expose typed interfaces only, (c) no direct mutation outside actions. Enforced by convention + ESLint rules, not a Pinia API flag.

---

## 4. `main.ts` Bootstrap Sequence

All three apps follow FR-33 bootstrap order:

```typescript
// Step 1: Validate environment config (throws early if misconfigured)
import { appConfig } from '@/core/config/env'

// Step 2: Create Pinia
import { createAppPinia } from '@/core/state'

// Step 3: Create Router
import { router } from '@/core/router'

// Step 4: Create Vue app
import { createApp } from 'vue'
import App from './App.vue'

const pinia = createAppPinia(router)
const app = createApp(App)

// Step 5: Register Pinia
app.use(pinia)

// Step 6: Register Router
app.use(router)

// Step 7: Mount
app.mount('#app')
```

---

## 5. Per-App Implementation Plan

### 5.1 MMC (`apps/mmc/`)

**Status**: Partially scaffolded — delta migration required.

#### Files to CREATE

| Path                                  | Description                                  |
| ------------------------------------- | -------------------------------------------- |
| `src/main.ts`                         | App entry — bootstrap sequence per §4        |
| `src/App.vue`                         | Root component with `<RouterView />` only    |
| `src/core/config/env.ts`              | AppConfig + startup validation               |
| `src/core/errors/types.ts`            | NormalizedError, ApiErrorResponse interfaces |
| `src/core/errors/error-normalizer.ts` | normalizeError() pure function               |
| `src/core/api/client.ts`              | createApiClient() factory with interceptors  |
| `src/core/auth/token-store.ts`        | Pinia auth store (memory token)              |
| `src/core/auth/index.ts`              | useAuth() composable                         |
| `src/core/router/index.ts`            | Vue Router 4 instance with guard pipeline    |
| `src/core/guards/auth.guard.ts`       | Auth check guard                             |
| `src/core/guards/role.guard.ts`       | Role check guard                             |
| `src/core/state/index.ts`             | createAppPinia() factory                     |
| `src/modules/dashboard/routes.ts`     | Dashboard route definitions (lazy-loaded)    |
| `src/modules/dashboard/types.ts`      | Dashboard module types                       |
| `src/modules/licenses/routes.ts`      | Licenses route definitions (lazy-loaded)     |
| `src/modules/licenses/types.ts`       | Licenses module types                        |
| `src/shared/views/NotFound.vue`       | 404 page stub                                |
| `src/shared/views/ForbiddenView.vue`  | 403 page stub                                |

**Note**: No `workspace.guard.ts` for MMC — not applicable per spec §8.1.

#### Files to MOVE/RENAME (Delta Migration)

Full 34-file migration table from `research.md` R-01. All paths listed in the delta map apply.

Post-migration, the following empty directories are deleted:

- `src/api/`
- `src/stores/`
- `src/views/`
- `src/components/`
- `src/lib/`

#### Files to UPDATE

| File                                       | Change Required                                                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                             | Add `"pinia": "^2.2.0"` to dependencies; add `"@pinia/testing": "^0.1.6"`, `"@vue/test-utils": "^2.4.0"` to devDependencies |
| `tsconfig.json`                            | Add `"baseUrl": "."` and `"paths": { "@/*": ["./src/*"] }`                                                                  |
| `vite.config.ts`                           | No change needed — `@/` and `@zidney/ui` aliases already configured                                                         |
| `tests/audit/dashboard-compliance.test.ts` | Update import paths to `modules/dashboard/`                                                                                 |
| `tests/e2e/dashboard-errors.test.ts`       | Update import paths to `modules/dashboard/`                                                                                 |
| `tests/e2e/dashboard-integration.test.ts`  | Update import paths to `modules/dashboard/`                                                                                 |
| `tests/performance/dashboard-perf.test.ts` | Update import paths to `modules/dashboard/`                                                                                 |

#### New Test Files to CREATE

| Path                                       | Coverage                                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `tests/unit/core/error-normalizer.test.ts` | Standard API error, network error, unknown shape                                             |
| `tests/unit/core/api-client.test.ts`       | Token attach, 401 refresh trigger, error normalization passthrough, AUTH_REFRESH_FAILED path |
| `tests/unit/core/auth.guard.test.ts`       | Authenticated passes, unauthenticated redirects to login                                     |
| `tests/unit/core/role.guard.test.ts`       | Correct role passes, wrong role redirects to /403                                            |
| `tests/unit/core/token-store.test.ts`      | setAccessToken, clearAccessToken, getAccessToken, isAuthenticated reactivity                 |
| `tests/unit/core/env-config.test.ts`       | Valid config resolves, missing VITE_API_BASE_URL throws                                      |

#### Files to DELETE

None — old directories are removed after migration. No files are deleted without a canonical target.

---

### 5.2 Backoffice (`apps/backoffice/`)

**Status**: Empty — full scaffold from scratch.

#### Files to CREATE

**Configuration**:
| Path | Description |
|---|---|
| `package.json` | Vue 3.4, vue-router v4, pinia v2.2, @zidney/ui-system workspace:_ |
| `tsconfig.json` | Extends ../../tsconfig.base.json + `@/` paths |
| `tsconfig.app.json` | Scoped includes for src/\*\*/_.ts, src/\*_/_.vue |
| `vite.config.ts` | @vitejs/plugin-vue, @ alias, @zidney/ui alias |
| `index.html` | Vite entry HTML |
| `.env.example` | VITE_API_BASE_URL= template |

**Source**:
| Path | Description |
|---|---|
| `src/main.ts` | Bootstrap sequence per §4 |
| `src/App.vue` | Root component — `<RouterView />` only |
| `src/core/config/env.ts` | AppConfig + startup validation |
| `src/core/errors/types.ts` | NormalizedError, ApiErrorResponse |
| `src/core/errors/error-normalizer.ts` | normalizeError() pure function |
| `src/core/api/client.ts` | createApiClient() factory |
| `src/core/auth/token-store.ts` | Pinia auth store — includes `workspaceSlug` field |
| `src/core/auth/index.ts` | useAuth() composable |
| `src/core/router/index.ts` | Vue Router 4 with workspace guard in pipeline |
| `src/core/guards/auth.guard.ts` | Auth check guard |
| `src/core/guards/role.guard.ts` | Role check guard |
| `src/core/guards/workspace.guard.ts` | **Workspace slug match guard** (backoffice only) |
| `src/core/state/index.ts` | createAppPinia() factory |
| `src/shared/views/NotFound.vue` | 404 page stub |
| `src/shared/views/ForbiddenView.vue` | 403 page stub |

**Directories to scaffold** (empty, with `.gitkeep`):

- `src/modules/` — feature modules added in later stages
- `src/shared/components/`
- `src/shared/composables/`
- `src/shared/utils/`

**Test files**:
| Path | Coverage |
|---|---|
| `tests/unit/core/error-normalizer.test.ts` | Same 3 failure modes |
| `tests/unit/core/api-client.test.ts` | Token attach, refresh, AUTH_REFRESH_FAILED |
| `tests/unit/core/auth.guard.test.ts` | Auth redirect |
| `tests/unit/core/role.guard.test.ts` | Role redirect |
| `tests/unit/core/workspace.guard.test.ts` | Matching slug passes, mismatch redirects |
| `tests/unit/core/token-store.test.ts` | With workspaceSlug field |
| `tests/unit/core/env-config.test.ts` | Validation |

---

### 5.3 Frontoffice (`apps/frontoffice/`)

**Status**: Empty — full scaffold from scratch.

#### Files to CREATE

**Configuration** (same pattern as backoffice):
| Path | Description |
|---|---|
| `package.json` | Vue 3.4, vue-router v4, pinia v2.2, @zidney/ui-system workspace:\* |
| `tsconfig.json` | Extends ../../tsconfig.base.json + `@/` paths |
| `tsconfig.app.json` | Scoped includes |
| `vite.config.ts` | Plugin-vue, @ alias, @zidney/ui alias |
| `index.html` | Vite entry HTML |
| `.env.example` | VITE_API_BASE_URL= template |

**Source**:
| Path | Description |
|---|---|
| `src/main.ts` | Bootstrap sequence per §4 |
| `src/App.vue` | Root component — `<RouterView />` only |
| `src/core/config/env.ts` | AppConfig + startup validation |
| `src/core/errors/types.ts` | NormalizedError, ApiErrorResponse |
| `src/core/errors/error-normalizer.ts` | normalizeError() pure function |
| `src/core/api/client.ts` | createApiClient() factory |
| `src/core/auth/token-store.ts` | Pinia auth store — no `workspaceSlug` in student context |
| `src/core/auth/index.ts` | useAuth() composable |
| `src/core/router/index.ts` | Vue Router 4 — `auth.guard → role.guard` ONLY |
| `src/core/guards/auth.guard.ts` | Auth check guard |
| `src/core/guards/role.guard.ts` | Role check guard |
| `src/core/state/index.ts` | createAppPinia() factory |
| `src/shared/views/NotFound.vue` | 404 page stub |
| `src/shared/views/ForbiddenView.vue` | 403 page stub |

**Note**: Per spec §8.3 and clarification §16:

- No `workspace.guard.ts` in frontoffice for this stage
- No `AttemptGuard` — deferred to Exam Runtime stage
- Guard pipeline: `auth.guard → role.guard` only

**Test files**: Same pattern as MMC core tests (no workspace.guard test).

---

## 6. TypeScript Configuration Plan

### `tsconfig.json` per app (add `@/` alias)

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
    },
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "src/**/*.d.ts"],
  "exclude": [
    "node_modules",
    "dist",
    "tests/**/*",
    "**/*.test.ts",
    "**/*.spec.ts",
  ],
}
```

This aligns TypeScript's module resolver with Vite's runtime alias. The `tsconfig.base.json` already has global workspace aliases; this extends only for app-local `@/` resolution.

### `vite.config.ts` per app (identical pattern)

```typescript
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, 'src') },
      {
        find: '@zidney/ui',
        replacement: resolve(__dirname, '../../packages/ui-system/src'),
      },
    ],
  },
})
```

MMC already has this. Backoffice and frontoffice need it created.

---

## 7. Testing Plan

### 7.1 Unit Test Specifications

#### `error-normalizer.test.ts`

```typescript
describe('normalizeError', () => {
  it('handles standard API error response')
  // Input: { success: false, data: null, error: { code: 'LICENSE_NOT_FOUND', message: 'Not found' } } + 404 status
  // Expected: { code: 'LICENSE_NOT_FOUND', message: 'Not found', httpStatus: 404 }

  it('handles network error (TypeError / no response)')
  // Input: new TypeError('Failed to fetch') or { httpStatus: 0 }
  // Expected: { code: 'NETWORK_ERROR', message: 'Network request failed', httpStatus: 0 }

  it('handles unknown shape (fallback)')
  // Input: 'unexpected string', null, { foo: 'bar' }
  // Expected: { code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred', httpStatus: -1 }

  it('is a pure function — same input same output, no side effects')
})
```

#### `api-client.test.ts`

```typescript
describe('createApiClient', () => {
  it('attaches Authorization header when access token is set')
  it('omits Authorization header when no access token')
  it('attaches Idempotency-Key header when idempotencyKey provided')
  it('attaches X-Correlation-ID header on every request')
  it('normalizes error response on 4xx/5xx via error-normalizer')
  it('triggers single-flight token refresh on 401')
  it('retries original request after successful token refresh')
  it('rejects all queued requests with AUTH_REFRESH_FAILED when refresh fails')
  it('clears auth store on AUTH_REFRESH_FAILED')
  // Use mock fetch (vi.fn()), mock tokenStore, no real network calls
})
```

#### `auth.guard.test.ts`

```typescript
describe('authGuard', () => {
  it('returns true when route does not require auth')
  it('returns true when user is authenticated and route requires auth')
  it(
    'returns { name: "login" } when user is not authenticated and route requires auth'
  )
})
```

#### `role.guard.test.ts`

```typescript
describe('roleGuard', () => {
  it('returns true when route has no required role')
  it('returns true when user role matches required role')
  it('returns { name: "forbidden" } when user role does not match')
  it('returns { name: "forbidden" } when user is null')
})
```

#### `workspace.guard.test.ts` (backoffice only)

```typescript
describe('workspaceGuard', () => {
  it('returns true when route does not require workspace')
  it('returns true when route slug matches authStore.user.workspaceSlug')
  it('returns { name: "forbidden" } when slugs do not match')
  it('returns { name: "forbidden" } when user has no workspaceSlug')
})
```

#### `token-store.test.ts`

```typescript
describe('useAuthStore (token-store)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('initial state: accessToken is null, user is null')
  it('setAccessToken stores token in state only')
  it('getAccessToken returns current token')
  it('clearAccessToken sets token and user to null')
  it('isAuthenticated is false when token is null')
  it('isAuthenticated is true when token is set')
  it('never writes to localStorage or sessionStorage')
})
```

#### `env-config.test.ts`

```typescript
describe('resolveConfig', () => {
  it('returns valid AppConfig when all required env vars are present')
  it('throws descriptive error when VITE_API_BASE_URL is missing')
  it('sets buildEnv to "development" when MODE is development')
  it('sets debugMode to true when VITE_DEBUG_MODE is "true"')
})
```

### 7.2 Integration Test Specifications

#### Guard pipeline integration test

```typescript
describe('Router guard pipeline', () => {
  it('executes auth.guard before role.guard')
  it('stops at auth.guard and redirects to login before checking role')
  it('proceeds through auth.guard and checks role.guard when authenticated')
  it('backoffice only: executes workspace.guard last after role.guard')
  // Use createRouter + createPinia in isolation, no DOM mount needed
})
```

#### App boot test

```typescript
describe('App bootstrap', () => {
  it('mounts without console errors when env vars are valid')
  it('Pinia is registered before any store access')
  it('Router is registered before navigation')
  // Use @vue/test-utils mount with mocked env
})
```

### 7.3 Test Tool Requirements

| Tool                            | Purpose                       | Status                   |
| ------------------------------- | ----------------------------- | ------------------------ |
| `vitest`                        | Test runner                   | Already in devDeps (MMC) |
| `@vue/test-utils`               | App mount + component testing | Must add to all 3 apps   |
| `@pinia/testing`                | `createTestingPinia()` helper | Must add to all 3 apps   |
| `vi.fn()` / `vi.mock()`         | Mock fetch, mock tokenStore   | Built into Vitest        |
| `setActivePinia(createPinia())` | Store isolation per test      | Native Pinia API         |

---

## 8. Implementation Order

Recommended execution order to minimize breakage:

```
Phase A: Config + Infrastructure (no Vue deps)
  1. core/config/env.ts
  2. core/errors/types.ts
  3. core/errors/error-normalizer.ts
  → Run: unit tests for error-normalizer and env-config

Phase B: Auth Store
  4. core/auth/token-store.ts
  → Run: unit tests for token-store

Phase C: API Client
  5. core/api/client.ts (depends on: env.ts, error-normalizer.ts, token-store.ts)
  → Run: unit tests for api-client

Phase D: Router + Guards
  6. core/guards/auth.guard.ts
  7. core/guards/role.guard.ts
  8. core/guards/workspace.guard.ts (backoffice only)
  9. core/router/index.ts (depends on: guards, modules/*/routes.ts stubs)
  → Run: unit tests for guards

Phase E: State + Auth Composable
  10. core/state/index.ts
  11. core/auth/index.ts

Phase F: App Entry
  12. main.ts
  13. App.vue

Phase G: Module Structure
  14. modules/*/routes.ts (stub — no views yet)
  15. shared/views/NotFound.vue
  16. shared/views/ForbiddenView.vue

Phase H: MMC Delta Migration
  17. Move all 34 files per research.md R-01 delta map
  18. Update internal imports in moved files
  19. Delete empty legacy directories
  20. Update existing test import paths

Phase I: Package Config Updates
  21. Update package.json (add pinia, @pinia/testing, @vue/test-utils)
  22. Update tsconfig.json (add @/ paths)
  23. Create backoffice/frontoffice package.json, vite.config.ts, tsconfig.json, tsconfig.app.json
```

---

## 9. Completion Gate Checklist

Before marking this stage IN PROGRESS → BACKEND CLOSED:

- [ ] All three apps have canonical `src/` structure
- [ ] `core/api/client.ts` exists in all 3 apps — TypeScript strict passes, `credentials: 'include'` in base options
- [ ] `core/api/client.ts` exports both `createApiClient()` factory AND default `apiClient` singleton
- [ ] `core/router/index.ts` exists in all 3 apps — guard pipeline wired
- [ ] Pinia initialized in all 3 apps — `package.json` updated
- [ ] `core/auth/` skeleton present in all 3 apps
- [ ] `core/errors/error-normalizer.ts` in all 3 apps — unit tests pass
- [ ] `core/config/env.ts` in all 3 apps — startup validation test passes
- [ ] MMC delta migration complete — no legacy directory remaining
- [ ] All 3 apps boot: `vite dev` starts without console errors
- [ ] `vite build` passes for all 3 apps
- [ ] TypeScript strict passes: zero errors (`tsc --noEmit`)
- [ ] No `any` in `core/` layer
- [ ] No `TODO` / `FIXME` in `core/` layer files
- [ ] Unit tests exist: error-normalizer, api-client, guards, token-store, env-config
- [ ] No direct `fetch()` / `import.meta.env` outside designated core files
- [ ] Existing MMC test imports updated after delta migration
- [ ] `@pinia/testing` and `@vue/test-utils` in all 3 apps devDependencies
- [ ] `@/` alias in all 3 `tsconfig.json` files
- [ ] **ESLint `import/no-restricted-paths` rules configured per app** — prevents cross-app imports and `import.meta.env` outside `core/config/env.ts`
- [ ] ESLint passes with zero errors (`eslint src/`) for all 3 apps after import boundary rules are applied
- [ ] Pinia installed (via `app.use(pinia)`) **before** `apiClient` singleton is imported in all 3 `main.ts` files

---

## 10. Key Decisions Log

| Decision                       | Choice                                    | Rationale                                                                               |
| ------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| HTTP transport                 | Native `fetch`                            | No axios/ky bundle weight; spec says no axios                                           |
| API client pattern             | Factory + singleton export                | Factory for DI in tests; singleton (`apiClient`) for module consumption                 |
| `credentials: 'include'`       | All requests                              | httpOnly refresh cookie must be sent cross-origin for single-flight refresh to function |
| Content-Type header            | `contentTypeInterceptor` (POST/PUT/PATCH) | Native fetch doesn't auto-set; server middleware requires it                            |
| Token storage                  | Pinia state only                          | NFR-01: no browser storage                                                              |
| Pinia "strict mode"            | Convention + ESLint                       | Pinia v2 has no strict API flag                                                         |
| `@/` alias                     | Add to per-app tsconfig.json              | Vite alias exists; TS compiler needs path map                                           |
| `workspace.guard.ts`           | Backoffice only                           | Spec §8.1 and §8.3 explicitly exclude MMC + FO                                          |
| AttemptGuard                   | Deferred                                  | Spec §16 clarification — Exam Runtime stage                                             |
| `packages/ui-system` additions | None for this stage                       | Layout components exist; core layer is per-app                                          |
| No automatic retry             | Confirmed                                 | Spec §16 clarification and FR-28 note                                                   |
| NormalizedError shape          | Sealed at 3 fields                        | FR-26 — fieldErrors deferred                                                            |
| Pinia plugin: inject router    | Yes                                       | Stores may need router access for logout redirect                                       |
| ESLint import boundaries       | `import/no-restricted-paths` per app      | Enforces layer separation and prevents apps importing each other                        |
