# Specification: STAGE_UI_00_RUNTIME_ARCHITECTURE

**Stage**: STAGE_UI_00_RUNTIME_ARCHITECTURE  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Stage Type**: UI Foundation — Cross-Application Runtime Blueprint  
**Stage File**: `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_00_RUNTIME_ARCHITECTURE.md`  
**Created**: 2026-02-28  
**Constitutional Alignment**: Zidney Constitution v1.2.0  
**Status**: DRAFT

---

## 1. Feature Overview

This stage defines the canonical SPA runtime architecture shared across all three Zidney frontend applications:

| Application | Directory           | Description                                    | Current Maturity                                                                                                            |
| ----------- | ------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| MMC         | `apps/mmc/`         | Platform Admin Control Panel (master DB scope) | Partially scaffolded — has `src/api/`, `src/stores/`, `src/views/`, `src/components/`, `src/lib/` (non-canonical structure) |
| Backoffice  | `apps/backoffice/`  | Institutional Tenant Admin Panel               | Not scaffolded                                                                                                              |
| Frontoffice | `apps/frontoffice/` | Student Runtime Exam App                       | Not scaffolded                                                                                                              |

This stage establishes:

- Deterministic folder structure per app
- Layer boundaries with strict separation rules
- Centralized API client abstraction
- Pinia state management configuration
- Vue Router initialization with guard pipeline
- Auth module skeleton (token lifecycle, session management)
- Global error normalization layer
- Environment configuration centralization
- Cross-app reuse boundaries (`packages/ui-system`)

**No feature implementation occurs in this stage.** This is architectural scaffolding only.

---

## 2. Constitutional Compliance Declaration

This stage is UI-only and does **not** touch backend systems. Declarations:

| Rule                                   | Status       | Notes                                          |
| -------------------------------------- | ------------ | ---------------------------------------------- |
| No cross-tenant access                 | ✅ Compliant | Frontend reads workspace_slug from router only |
| No middleware bypass                   | ✅ Compliant | No backend middleware involved                 |
| No grading outside worker              | ✅ Compliant | Grading not scoped to this stage               |
| No direct DB instantiation             | ✅ Compliant | UI has no DB access by design                  |
| No weakening of snapshot integrity     | ✅ Compliant | Attempt engine not modified                    |
| No weakening of transaction boundaries | ✅ Compliant | No backend transactions involved               |
| No weakening of version enforcement    | ✅ Compliant | Version enforcement is server-side middleware  |

This stage is a UI scaffolding stage. All business rules remain server-authoritative. License enforcement, tenant isolation, and attempt integrity are untouched.

---

## 3. Scope Definition

### 3.1 In Scope

- Scaffolding canonical `src/` folder structure in all three apps (mmc, backoffice, frontoffice)
- Defining and implementing `core/api/client.ts` — centralized HTTP client with interceptor support
- Defining and implementing `core/router/index.ts` — Vue Router initialization
- Defining and implementing `core/guards/` — AuthGuard, RoleGuard, and WorkspaceGuard skeletons
- Defining and implementing `core/state/` — Pinia initialization in strict mode
- Defining and implementing `core/auth/` — token memory store and session management skeleton
- Defining and implementing `core/errors/error-normalizer.ts` — backend error normalization
- Defining and implementing `core/config/env.ts` — environment variable centralization
- Defining `main.ts` and `App.vue` bootstrapping per app
- Defining module scaffold template: `modules/<feature>/`
- Defining `shared/` directory with composables, utilities, and layout components
- Aligning MMC existing structure to the canonical layout (delta migration)
- Establishing test stubs for API client, stores, guards, and error normalizer

### 3.2 Out of Scope

- Login UI implementation
- Any feature or business page (dashboard, product table, exam UI, affiliate flows)
- Authentication flows (login, logout, token refresh — only skeleton stubs)
- Any backend API changes or additions
- API contract definitions for business endpoints
- Real guard logic (roles resolved from real API calls)
- Student exam runtime interactions
- Notification system implementation
- Form validation library integration (beyond Vee-Validate skeleton if needed)
- i18n / localization setup

---

## 4. Cross-App Architecture Stories

This stage is infrastructure-level, driven by architectural stories rather than user stories.

### AS-01 — Deterministic Folder Structure

**As a** developer working across MMC, Backoffice, or Frontoffice,  
**I need** each app to follow the same canonical `src/` layout,  
**So that** context switching between apps has zero structural cognitive overhead.

**Acceptance**:

- All three apps have identical `core/`, `modules/`, `shared/` directory layout
- No app has top-level domain folders outside `modules/`
- No business logic files exist at `src/` root level (only `main.ts` and `App.vue`)

---

### AS-02 — Centralized API Client

**As a** frontend developer,  
**I need** all HTTP calls to pass through a single client layer,  
**So that** auth tokens are consistently attached, errors are normalized, and no raw `fetch()` or `axios` calls leak into components.

**Acceptance**:

- `core/api/client.ts` exists in all three apps
- Client attaches Authorization header via request interceptor
- Client normalizes 4xx/5xx responses through `error-normalizer.ts`
- Components and stores never import `fetch` or `axios` directly
- Idempotency headers can be attached per-request optionally via client configuration

---

### AS-03 — Router with Guard Pipeline

**As a** platform operator,  
**I need** each app's Vue Router to enforce an ordered guard pipeline,  
**So that** unauthenticated or unauthorized access is blocked consistently before any view renders.

**Acceptance**:

- `core/router/index.ts` exists in all three apps
- Guard execution order is: AuthGuard → RoleGuard → WorkspaceGuard (Backoffice only)
- No inline guard logic appears in view components or route definitions
- Guards return redirect targets, never throw exceptions

---

### AS-04 — Pinia Strict State Management

**As a** developer,  
**I need** Pinia configured in strict mode across all apps,  
**So that** store mutations are traceable, testable, and free of cross-store coupling.

**Acceptance**:

- Pinia is installed in strict mode in all three apps
- One store per domain — no omnibus stores
- Stores call service functions, never `fetch()` directly
- Stores expose typed interfaces (no `any` return types)
- No component directly triggers cross-store mutations

---

### AS-05 — Auth Module Skeleton

**As a** security reviewer,  
**I need** access tokens stored in memory and refresh tokens managed via httpOnly cookie,  
**So that** token exposure via XSS is minimized.

**Acceptance**:

- `core/auth/` directory exists in all three apps
- Access token is stored in a reactive Pinia auth store (memory only — no localStorage)
- Refresh token lifecycle is managed by backend httpOnly cookie (frontend does not read it)
- Auto-refresh on 401 is wired in the API client using single-flight strategy
- Logout clears memory state and triggers backend invalidation endpoint

---

### AS-06 — Global Error Normalization

**As a** frontend developer,  
**I need** backend errors normalized to a consistent shape before reaching UI components,  
**So that** components never depend on raw API error structures.

**Acceptance**:

- `core/errors/error-normalizer.ts` exists in all three apps
- Normalizer converts API error responses to `{ code: string, message: string, httpStatus: number }`
- Components receive only normalized error objects
- Normalizer test coverage exists

---

### AS-07 — Centralized Environment Configuration

**As a** developer,  
**I need** all environment variables accessed through `core/config/env.ts`,  
**So that** no component or store calls `import.meta.env` directly.

**Acceptance**:

- `core/config/env.ts` exports typed config accessors
- No component, store, or composable imports `import.meta.env` directly
- Build-time flags, API base URL, and debug toggles are all accessed via this module
- Config module validates presence of required env vars at startup

---

### AS-08 — Cross-App Shared Logic Boundary

**As a** platform architect,  
**I need** shared layout logic, pagination helpers, and notification systems to live in `packages/ui-system`,  
**So that** apps do not duplicate shared runtime utilities.

**Acceptance**:

- Any component or composable shared between two or more apps is placed in `packages/ui-system`
- No app copies layout wrappers from another app
- `packages/ui-system` is a declared dependency in the `package.json` of each app

---

### AS-09 — App Bootstrap Without Errors

**As a** CI system,  
**I need** all three apps to boot without console errors under `vite build` and `vite dev`,  
**So that** the architecture is verifiably correct before feature development begins.

**Acceptance**:

- `npm run dev` (or equivalent) in each app starts without runtime errors
- `npm run build` passes for all three apps
- TypeScript strict mode passes with zero errors
- ESLint passes with zero errors
- No TODO or FIXME markers exist in `core/` layer files

---

## 5. Functional Requirements

### 5.1 Folder Structure Standard

**FR-01** — Each app must contain exactly this top-level `src/` layout:

```
src/
  main.ts
  App.vue

  core/
    api/
      client.ts
    auth/
      index.ts
      token-store.ts
    router/
      index.ts
    guards/
      auth.guard.ts
      role.guard.ts
      workspace.guard.ts   (backoffice only)
    state/
      index.ts             (Pinia initialization)
    config/
      env.ts
    errors/
      error-normalizer.ts
      types.ts

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

**FR-02** — No directory outside this structure exists at `src/` root for any new file.

**FR-03** — For MMC, existing `src/api/`, `src/stores/`, `src/views/`, `src/components/`, `src/lib/` must be migrated into the canonical structure or wrapped:

- `src/api/dashboard-client.ts` → `src/modules/dashboard/api.ts`
- `src/stores/dashboard-store.ts` → `src/modules/dashboard/store.ts`
- `src/views/Dashboard.vue` + `src/views/licenses/` → `src/modules/dashboard/views/` and `src/modules/licenses/views/`
- `src/components/` → distributed to `src/modules/<feature>/components/` or `src/shared/components/`
- `src/lib/` → `src/shared/utils/` or `src/core/` depending on content

### 5.2 API Client

**FR-04** — `core/api/client.ts` must export a configured HTTP client instance.

**FR-05** — The client must set `credentials: 'include'` on every fetch request. This is required so the browser sends the backend-issued httpOnly refresh cookie on cross-origin requests (e.g., `app.mmc.zidney.com` → `api.zidney.com`). Without this, the single-flight refresh mechanism is non-functional.

The client must support request interceptors for:

- Setting `Content-Type: application/json` on POST, PUT, PATCH requests
- Attaching `Authorization: Bearer <token>` from memory
- Attaching optional `Idempotency-Key` headers
- Attaching `X-Correlation-ID` headers for traceability

**FR-06** — The client must support response interceptors for:

- Normalizing error responses via `error-normalizer.ts`
- Triggering token refresh on 401 using single-flight strategy
- Re-queueing failed requests after token refresh
- If the token refresh request itself fails (e.g., refresh token expired or revoked), all queued requests must be rejected with a normalized `{ code: 'AUTH_REFRESH_FAILED', message: 'Session expired. Please log in again.', httpStatus: 401 }` error, the auth store must be cleared, and the app must redirect to the login route

**FR-07** — No component, store, composable, or module-level `api.ts` is permitted to import `fetch`, `axios`, or `ky` directly. All HTTP calls must use the exported client instance.

### 5.3 Vue Router

**FR-08** — `core/router/index.ts` must create and export the Vue Router instance.

**FR-09** — Router must use `createWebHistory` mode.

**FR-10** — Route definitions must be imported from `modules/<feature>/routes.ts` and registered declaratively.

**FR-11** — `core/guards/auth.guard.ts` must redirect unauthenticated users to the login route.

**FR-12** — `core/guards/role.guard.ts` must redirect users without the required role to a 403 route.

**FR-13** — `core/guards/workspace.guard.ts` (Backoffice only) must validate that `workspace_slug` from the route matches the authenticated session's workspace context.

**FR-14** — Guard execution order is enforced as a pipeline: `auth.guard → role.guard → workspace.guard` (where applicable).

**FR-15** — Guards must not contain business logic. They may only read state from the auth store and route meta.

### 5.4 State Management (Pinia)

**FR-16** — Pinia must be installed in strict mode (`createPinia()` with `markRaw` wrapping for non-reactive items).

**FR-17** — Each domain module defines its own store in `modules/<feature>/store.ts` or `modules/<feature>/stores/<sub-domain>.ts`.

**FR-18** — Stores must expose typed `State`, `Getters`, and `Actions` interfaces.

**FR-19** — No store may dispatch actions into another store directly. Cross-store communication must flow through service/composable intermediaries.

**FR-20** — Auth store lives at `core/auth/token-store.ts` (not inside a module).

### 5.5 Auth Module

**FR-21** — `core/auth/token-store.ts` must expose:

- `setAccessToken(token: string): void`
- `clearAccessToken(): void`
- `getAccessToken(): string | null`

**FR-22** — Access token must be stored in reactive Pinia state only (never `localStorage` or `sessionStorage`).

**FR-23** — Refresh token is backend-controlled via httpOnly cookie; frontend must never read, write, or store it.

**FR-24** — `core/auth/index.ts` must expose a `useAuth()` composable providing:

- `isAuthenticated: ComputedRef<boolean>`
- `currentUser: ComputedRef<AuthUser | null>`
- `logout(): Promise<void>`

**FR-25** — `logout()` must clear the in-memory access token AND call the backend logout endpoint to invalidate the server session.

### 5.6 Error Normalization

**FR-26** — `core/errors/types.ts` must define:

```typescript
interface NormalizedError {
  code: string
  message: string
  httpStatus: number
}
```

> **Sealed for this stage**: The `NormalizedError` shape is intentionally minimal. Optional `fieldErrors?: Record<string, string[]>` (for 422 form validation responses) is deferred to the authentication/form-validation implementation stage. Do not extend this interface in this stage.

**FR-27** — `core/errors/error-normalizer.ts` must export:

- `normalizeError(raw: unknown): NormalizedError`

**FR-28** — `normalizeError` must handle:

- Standard API error responses matching `{ success: false, error: { code, message } }`
- Network errors (no response) — normalized to `{ code: 'NETWORK_ERROR', message: 'Network request failed', httpStatus: 0 }`
- Unexpected shapes (fallback to `{ code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred', httpStatus: -1 }`)

> **Retry behavior**: No automatic retry logic is implemented at the client scaffolding level. Network errors surface as `NETWORK_ERROR` normalized errors. Retry strategies (e.g., exponential backoff) are opt-in and defined per feature in later implementation stages.

**FR-29** — UI components must only consume `NormalizedError` — never raw API response shapes.

### 5.7 Environment Configuration

**FR-30** — `core/config/env.ts` must export a typed `AppConfig` object resolved at module initialization time:

```typescript
interface AppConfig {
  apiBaseUrl: string
  buildEnv: 'development' | 'staging' | 'production'
  debugMode: boolean
}
```

**FR-31** — `core/config/env.ts` must validate that required variables are defined at startup and throw a descriptive error if they are missing.

**FR-32** — No file outside `core/config/env.ts` may reference `import.meta.env` directly.

### 5.8 App Bootstrap

**FR-33** — `main.ts` must initialize in this order:

1. Validate environment config
2. Create Pinia instance
3. Create Vue Router instance
4. Create Vue application (`createApp(App)`)
5. Register Pinia
6. Register Router
7. Mount app

**FR-34** — `App.vue` must contain only `<RouterView />` and global layout wrapping. No business logic.

**FR-35** — App must boot without console errors or TypeScript errors in all three apps.

---

## 6. Non-Functional Requirements

### 6.1 Security

**NFR-01** — Access tokens must not be persisted to any browser storage mechanism (localStorage, sessionStorage, IndexedDB, cookies accessible via JavaScript).

**NFR-02** — The API client must not log Authorization header values.

**NFR-03** — Workspace slug must always be derived from the route context; never from user input or request body.

**NFR-04** — No secrets (API keys, signing keys, DB credentials) may appear in frontend source or build output.

### 6.2 Performance

**NFR-05** — App initial bundle must not include feature modules eagerly — module views must use dynamic imports (`() => import(...)`) for code splitting.

**NFR-06** — Shared `packages/ui-system` components must be tree-shakeable.

**NFR-07** — Heavy components (rich text editors, chart libraries) must be lazy-loaded.

### 6.3 Testability

**NFR-08** — `core/api/client.ts` must be mockable via dependency injection or module mock — no singleton that cannot be swapped in tests.

**NFR-09** — `core/errors/error-normalizer.ts` must be a pure function — given the same input, produces the same output, no side effects.

**NFR-10** — Guards must be testable in isolation: given mock route context and mock auth state, guard returns predictable redirect result.

**NFR-11** — Pinia stores must be testable with `setActivePinia(createPinia())` without needing a mounted Vue component.

**NFR-12** — No global singleton state that survives between test cases.

### 6.4 Maintainability

**NFR-13** — Folder structure must be enforced via ESLint `import/no-restricted-paths` rules (or equivalent) to prevent cross-layer boundary violations.

**NFR-14** — All exported types must be explicitly typed — no `any` in core layer interfaces.

**NFR-15** — No `TODO` or `FIXME` comments in `core/` layer files at stage completion.

---

## 7. Interface Definitions

### 7.1 API Client Interface

```typescript
// core/api/client.ts

interface RequestConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  params?: Record<string, unknown>
  data?: unknown
  idempotencyKey?: string
}

interface ApiResponse<T = unknown> {
  success: true
  data: T
}

function createApiClient(config: AppConfig): ApiClient

interface ApiClient {
  get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>>
  post<T>(
    url: string,
    data: unknown,
    idempotencyKey?: string
  ): Promise<ApiResponse<T>>
  put<T>(url: string, data: unknown): Promise<ApiResponse<T>>
  patch<T>(url: string, data: unknown): Promise<ApiResponse<T>>
  delete<T>(url: string): Promise<ApiResponse<T>>
}
```

### 7.2 Auth Store Interface

```typescript
// core/auth/token-store.ts

interface AuthUser {
  id: string
  email: string
  role: string
  workspaceSlug?: string // backoffice only
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
}
```

### 7.3 Guard Interface

```typescript
// core/guards/*.guard.ts

type GuardResult = true | RouteLocationRaw

interface GuardContext {
  to: RouteLocationNormalized
  from: RouteLocationNormalized
  authStore: AuthStore
}

type Guard = (context: GuardContext) => GuardResult | Promise<GuardResult>
```

### 7.4 Error Types Interface

```typescript
// core/errors/types.ts

interface NormalizedError {
  code: string
  message: string
  httpStatus: number
}

// Standard API error shape from backend
interface ApiErrorResponse {
  success: false
  data: null
  error: {
    code: string
    message: string
  }
}
```

### 7.5 Environment Config Interface

```typescript
// core/config/env.ts

interface AppConfig {
  apiBaseUrl: string
  buildEnv: 'development' | 'staging' | 'production'
  debugMode: boolean
}

function resolveConfig(): AppConfig
```

---

## 8. Per-App Architecture Notes

### 8.1 MMC (apps/mmc/)

- Operates against `master_db` scope only via API
- No workspace-bound routes — WorkspaceGuard is NOT used
- Auth guard ensures only platform-level admin role (`PLATFORM_ADMIN`) is granted access
- RoleGuard validates `PLATFORM_ADMIN` role from token claims
- Existing files must be migrated to canonical structure (see FR-03)

**Current Delta**:

| Current                                    | Target                                             |
| ------------------------------------------ | -------------------------------------------------- |
| `src/api/dashboard-client.ts`              | `src/modules/dashboard/api.ts`                     |
| `src/stores/dashboard-store.ts`            | `src/modules/dashboard/store.ts`                   |
| `src/views/Dashboard.vue`                  | `src/modules/dashboard/views/DashboardView.vue`    |
| `src/views/licenses/LicenseDetailView.vue` | `src/modules/licenses/views/LicenseDetailView.vue` |
| `src/views/licenses/LicenseList.vue`       | `src/modules/licenses/views/LicenseList.vue`       |
| `src/views/licenses/LicenseListView.vue`   | `src/modules/licenses/views/LicenseListView.vue`   |
| `src/components/Dashboard/*.vue` (6 files) | `src/modules/dashboard/components/`                |
| `src/components/licenses/*.vue` (13 files) | `src/modules/licenses/components/`                 |
| `src/components/LicenseDeletionDialog.vue` | `src/modules/licenses/components/`                 |
| `src/components/LicenseDetailPage.vue`     | `src/modules/licenses/components/`                 |
| `src/components/AuditTrailViewer.vue`      | `src/shared/components/` (cross-cutting concern)   |
| `src/components/JobStatusMonitor.vue`      | `src/shared/components/` (cross-cutting concern)   |
| `src/lib/utils.ts`                         | `src/shared/utils/utils.ts`                        |

### 8.2 Backoffice (apps/backoffice/)

- Operates against tenant-scoped APIs
- Routes follow pattern: `/workspace/:slug/backoffice/...`
- WorkspaceGuard is required to validate `workspace_slug` route param against session context
- Not yet scaffolded — full canonical structure created from scratch

### 8.3 Frontoffice (apps/frontoffice/)

- Student runtime — operates in exam context
- Timer is display-only; server time is authoritative
- Attempt state always fetched from API — never computed locally
- Not yet scaffolded — full canonical structure created from scratch
- Guard pipeline: `auth.guard → role.guard` only — no WorkspaceGuard, no AttemptGuard
- WorkspaceGuard is NOT included for Frontoffice in this stage
- AttemptGuard (blocking navigation away from an active attempt) is deferred to the Exam Runtime stage
- Frontoffice routes are workspace-scoped (workspace_slug resolved from route params) but workspace context validation for exam access is handled at the Exam Runtime stage level

---

## 9. Dependencies

### 9.1 Consumed (Upstream)

| Dependency                   | Stage                                         | Nature                                                                  |
| ---------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| Authentication API Endpoints | STAGE_03_AUTHENTICATION_SYSTEM                | Backend login/refresh/logout endpoints that this UI auth skeleton wraps |
| License state fields         | STAGE_04_LICENSE_ENGINE                       | License status fields returned by API — display only in MMC             |
| Provisioning states          | STAGE_05_TENANT_PROVISIONING                  | Provisioning status rendered in MMC                                     |
| Products API                 | STAGE_09_PRODUCTS                             | Module routes and API wrappers in MMC modules                           |
| Licenses API                 | STAGE_10_LICENSES, STAGE_11_LICENSE_LIFECYCLE | Module routes in MMC                                                    |
| Shared UI System             | STAGE_016_SHARED_UI_SYSTEM                    | `packages/ui-system` consumed by all three apps                         |

### 9.2 Produced (Downstream)

This stage produces the scaffolding that all subsequent frontend stages depend on:

| Produced                          | Consumed By                                            |
| --------------------------------- | ------------------------------------------------------ |
| Canonical folder structure        | All future MMC, Backoffice, Frontoffice feature stages |
| `core/api/client.ts`              | All module-level `api.ts` files                        |
| `core/router/index.ts`            | All feature route definitions                          |
| `core/auth/`                      | Login/logout flow implementation stage                 |
| `core/errors/error-normalizer.ts` | All error display components                           |
| `core/config/env.ts`              | All environment-dependent configurations               |

---

## 10. Completion Criteria

This stage is complete when all of the following are true:

| Criterion                                                            | Verified By                    |
| -------------------------------------------------------------------- | ------------------------------ |
| Canonical `src/` folder structure exists in all 3 apps               | Directory audit                |
| `core/api/client.ts` implemented in all 3 apps                       | TypeScript compile             |
| `core/router/index.ts` initialized in all 3 apps                     | App boot test                  |
| Pinia installed and configured in strict mode in all 3 apps          | App boot test                  |
| Auth module skeleton (`core/auth/`) present in all 3 apps            | TypeScript compile             |
| `core/errors/error-normalizer.ts` present in all 3 apps              | TypeScript compile + unit test |
| `core/config/env.ts` present in all 3 apps                           | TypeScript compile             |
| MMC existing files migrated to canonical layout                      | Directory audit + CI           |
| All 3 apps boot without console errors in dev mode                   | Manual verification            |
| `vite build` passes for all 3 apps                                   | CI                             |
| TypeScript strict mode passes with zero errors                       | CI                             |
| ESLint passes with zero violations                                   | CI                             |
| No `TODO` / `FIXME` in `core/` layer files                           | Lint rule / audit              |
| Unit tests exist for: error-normalizer, API client mock, guard logic | CI test run                    |
| No direct `fetch()` / `axios` usage outside `core/api/client.ts`     | Lint rule + audit              |

---

## 11. Test Strategy

### 11.1 Unit Tests Required

| Target                            | Test Coverage Required                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `core/errors/error-normalizer.ts` | Standard API error, network error, unknown shape, success passthrough                     |
| `core/api/client.ts`              | Request interceptor (token attach), 401 refresh trigger, error normalization pass-through |
| `core/guards/auth.guard.ts`       | Authenticated user passes, unauthenticated user redirects                                 |
| `core/guards/role.guard.ts`       | Correct role passes, wrong role redirects to 403                                          |
| `core/guards/workspace.guard.ts`  | Matching slug passes, mismatched slug redirects                                           |
| `core/auth/token-store.ts`        | setAccessToken, clearAccessToken, getAccessToken, isAuthenticated reactive state          |
| `core/config/env.ts`              | Valid config resolves, missing required var throws                                        |

### 11.2 Integration Tests Required

| Scenario                 | Description                                               |
| ------------------------ | --------------------------------------------------------- |
| App boot sequence        | App mounts with all plugins registered, no console errors |
| Guard pipeline execution | Route navigation triggers guards in correct order         |
| Token refresh flow       | 401 response triggers refresh, original request retried   |
| Logout flow              | Memory cleared, backend logout called                     |

### 11.3 Assumptions

- Authentication endpoints (login, refresh, logout) exist per STAGE_03
- `packages/ui-system` is already scaffolded per STAGE_016_SHARED_UI_SYSTEM
- Vite is the build tool for all three apps
- Vitest is the test runner for unit and integration tests

---

## 12. Explicit Non-Goals

This stage explicitly does NOT:

- Implement any login, signup, or password reset UI
- Implement any feature pages, dashboards, or data tables
- Implement real role-based access control logic (that is server-side concern)
- Define real API contracts for business domains (Products, Licenses, Exams)
- Implement theme tokens or white-label customization
- Configure i18n or localization
- Implement exam runtime UI (timers, question rendering)
- Configure CI/CD pipelines (those exist for the backend)
- Modify any backend API, Worker, or database schema
- Implement notification system or toast management
- Implement form validation library integration

---

## 13. Isolation Impact Analysis

| Question                           | Answer                                                     |
| ---------------------------------- | ---------------------------------------------------------- |
| Which database is accessed?        | None — this is a UI-only stage                             |
| How is tenant resolved?            | Via route param (`workspace_slug`) — read-only in frontend |
| Where is connection pool obtained? | N/A                                                        |
| Is resolver middleware used?       | N/A — server-side middleware is not modified               |
| New tables introduced?             | None                                                       |
| Shared tenant data risk?           | None — UI does not access tenant DB                        |

---

## 14. Layer Separation Confirmation

| Rule                                       | Status                                  |
| ------------------------------------------ | --------------------------------------- |
| Frontend contains no business logic        | ✅ Core layer is scaffolding only       |
| API contains no grading logic              | ✅ No backend changes                   |
| Worker contains no HTTP logic              | ✅ Worker not modified                  |
| MMC does not access tenant DB              | ✅ By design contract (AGENTS.md)       |
| No direct DB creation outside provisioning | ✅ No database operations in this stage |

---

## 15. Final Constitutional Compliance Statement

Compliant with Zidney Constitution v1.2.0 — No violations detected.

This stage is UI scaffolding only. It does not touch the backend, does not modify database schemas, does not bypass middleware, does not weaken tenant isolation, and does not introduce business logic in the UI layer. All enforcement authority remains server-side.

---

## 16. Clarifications

### Session 2026-02-28

- Q: Should Frontoffice implement a distinct `AttemptGuard` that blocks navigation away from an active attempt, or is that deferred to the Exam Runtime stage? → A: Deferred to the Exam Runtime stage. Guard pipeline for all apps in this stage is `auth.guard → role.guard` only. No `AttemptGuard` or `WorkspaceGuard` is created for Frontoffice at this stage.
- Q: What happens when the single-flight token refresh itself fails (e.g., expired refresh token)? → A: All queued requests are rejected with normalized `AUTH_REFRESH_FAILED` error (`httpStatus: 401`). Auth store is cleared. App redirects to login route. This is enforced in FR-06.
- Q: Should `NormalizedError` include `fieldErrors` for 422 form validation responses? → A: No — shape is sealed at `{ code, message, httpStatus }` for this stage. `fieldErrors?: Record<string, string[]>` extension is deferred to the authentication/form-validation implementation stage. Noted in FR-26.
- Q: Should the API client implement automatic retry for network errors at the scaffolding level? → A: No automatic retry. Network errors surface as `NETWORK_ERROR` normalized errors (`httpStatus: 0`). Retry strategies are opt-in per feature, defined in later stages. Noted in FR-28.
- Q: Does the MMC delta table fully cover all existing `src/components/` files? → A: No — the original table used a generic rule. Section 8.1 delta table has been expanded with explicit per-file and per-subdirectory mappings covering all 23 component files found in `src/components/Dashboard/`, `src/components/licenses/`, and root-level components.

**Spec status**: All critical ambiguities resolved. No outstanding `[NEEDS CLARIFICATION]` markers remain. Spec is complete and ready for `speckit.plan`.
