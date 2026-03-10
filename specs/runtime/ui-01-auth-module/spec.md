# Specification: STAGE_UI_01_AUTH_MODULE

**Stage**: STAGE_UI_01_AUTH_MODULE  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Stage Type**: UI Foundation — Authentication Runtime Module  
**Stage File**: `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_01_AUTH_MODULE.md`  
**Created**: 2026-03-01  
**Constitutional Alignment**: Zidney Constitution v1.2.0  
**Status**: DRAFT

---

## 1. Feature Overview

This stage implements the frontend authentication runtime engine shared across all three Zidney
frontend applications:

| Application | Directory           | Description                      | Role in Auth                                                  |
| ----------- | ------------------- | -------------------------------- | ------------------------------------------------------------- |
| MMC         | `apps/mmc/`         | Platform Admin Control Panel     | Platform admin tokens — master DB scope, no workspace context |
| Backoffice  | `apps/backoffice/`  | Institutional Tenant Admin Panel | Workspace-scoped tokens — integrates with WorkspaceGuard      |
| Frontoffice | `apps/frontoffice/` | Student Runtime Exam App         | Student tokens — attempt access controlled server-side        |

Authentication in Zidney is **server-authoritative**. The frontend never issues tokens, validates
credentials, decodes JWTs to infer permissions, or trusts client time. The frontend's role is
exclusively:

- Holding the access token in memory for the duration of a session
- Orchestrating the refresh flow on token expiry (detected by 401 response only)
- Triggering logout on failed refresh or explicit user action
- Protecting routes via auth guards that query backend-authoritative session state
- Exposing a typed, testable auth interface to the rest of the application

**This stage does NOT implement login UI pages.** It defines the runtime auth engine behind all
authenticated interactions.

Prior stage `STAGE_UI_00_RUNTIME_ARCHITECTURE` established the canonical `core/` folder structure
and auth module skeleton. This stage fully implements those auth contracts.

---

## 2. Constitutional Compliance Declaration

| Rule                                     | Status       | Notes                                                                                                          |
| ---------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------- |
| No cross-tenant access                   | ✅ Compliant | Frontend reads workspace_slug from route only; auth module never constructs tenant queries                     |
| No middleware bypass                     | ✅ Compliant | No backend middleware involved in this stage                                                                   |
| No grading outside worker                | ✅ Compliant | Grading not in scope                                                                                           |
| No direct DB instantiation               | ✅ Compliant | UI layer has no database access by design                                                                      |
| No weakening of snapshot integrity       | ✅ Compliant | Attempt engine not modified                                                                                    |
| No weakening of transaction boundaries   | ✅ Compliant | No backend transactions involved                                                                               |
| No weakening of version enforcement      | ✅ Compliant | Version enforcement is server-side middleware; frontend consumes API responses only                            |
| No password validation in frontend       | ✅ Compliant | Login credentials are passed directly to backend without frontend validation of password rules                 |
| No token issuance in frontend            | ✅ Compliant | Tokens are issued exclusively by the backend                                                                   |
| No client-time trust                     | ✅ Compliant | Token expiration is detected solely via 401 responses — no `Date.now()` or JWT payload exp field used          |
| No business rule enforcement in frontend | ✅ Compliant | RBAC, license checks, and attempt gating remain server-authoritative                                           |
| No JWT decoding for permissions          | ✅ Compliant | Permission data comes from dedicated backend `/me` endpoint response; JWT payload is never decoded by frontend |
| No insecure secret storage               | ✅ Compliant | Access token is held in Pinia reactive memory only; refresh token is in httpOnly cookie, never touched by JS   |

---

## 3. Scope Definition

### 3.1 In Scope

- Full implementation of `core/state/auth.store.ts` — Pinia auth store with typed state and actions
- Full implementation of `core/auth/token-manager.ts` — in-memory access token holder
- Full implementation of `core/auth/refresh-manager.ts` — single-flight refresh orchestration
- Full implementation of `core/router/guards/auth.guard.ts` — route protection via auth state
- Definition and documentation of the `AuthService` composable interface
  (`core/auth/auth.service.ts`)
- Session model definition: what constitutes an active session from the frontend's perspective
- Token lifecycle definition: acquisition, holding, expiry detection, refresh, and destruction
- Logout mechanics: coordinated teardown of memory state + backend session invalidation
- Error handling contract for auth failures (401, failed refresh, network errors during refresh)
- Test suite targeting: refresh race conditions, concurrent request retry, logout during pending
  request, expired token simulation, failed refresh force-logout

### 3.2 Out of Scope

- Login UI (form, page, layout) — deferred to feature-level stages
- Registration UI
- Password reset UI
- 2FA / MFA UI
- RBAC enforcement (role-based route protection) — that is RoleGuard, a separate guard
- WorkspaceGuard — implemented as a separate guard in the Backoffice stage
- License validation — server-side middleware only
- Attempt engine gating — server-side and feature-level concern
- Any backend API changes
- Token introspection or inspection of JWT payload fields
- Refresh token rotation strategy — backend concern only

---

## 4. Architectural Stories

### AS-01 — Memory-Only Access Token Storage

**As a** security-conscious platform operator,  
**I need** the access token to be held exclusively in reactive Pinia memory,  
**So that** XSS attacks cannot exfiltrate the token from localStorage, sessionStorage, or URL state.

**Acceptance**:

- Access token is stored only in `core/auth/token-manager.ts` reactive state, not in any browser
  storage API
- `localStorage`, `sessionStorage`, `document.cookie`, `indexedDB`, and URL query parameters are
  never written with token data
- On page reload, the session is not automatically restored from browser storage — the refresh
  endpoint is called to re-establish session
- Token value is never emitted to console or error logging systems

---

### AS-02 — Server-Authoritative Session State

**As a** security reviewer,  
**I need** all authentication decisions to originate from backend responses,  
**So that** the frontend cannot be manipulated into treating an invalid session as valid.

**Acceptance**:

- `isAuthenticated` state is set to `true` only after a successful login or successful token refresh
  response from the backend
- Frontend never infers authentication status from the presence of a token in memory alone — it
  reflects the last confirmed server response
- The user profile (`user`) in the auth store is populated only from backend `/me` endpoint
  responses
- No client-side `exp` claim checking is performed; expiry is signaled exclusively by a 401 response

---

### AS-03 — Single-Flight Refresh Orchestration

**As a** developer responsible for concurrent API traffic,  
**I need** the refresh flow to use a single-flight lock,  
**So that** a burst of concurrent 401 responses triggers exactly one refresh request rather than N
refresh requests.

**Acceptance**:

- When a 401 is received and no refresh is in flight, exactly one refresh request is issued
- All concurrent requests that received a 401 while refresh is in flight are queued
- Upon successful refresh, all queued requests are retried with the new access token
- Upon failed refresh, all queued requests are rejected and logout is triggered
- No more than one refresh call exists in flight at any time under concurrent load

---

### AS-04 — Coordinated Logout

**As a** user,  
**I need** logout to completely destroy my session on both the frontend and backend,  
**So that** my session cannot be reused by a subsequent user of the same browser session.

**Acceptance**:

- Logout calls the backend logout endpoint before clearing local state
- Even if the backend logout endpoint fails (network error), frontend state is still cleared
- After logout: access token is cleared from memory, auth store is reset to initial state, user
  object is cleared
- After logout: router redirects to the login route of the current app
- No residual reactive state (loading flags, user data, token) persists after logout completes

---

### AS-05 — Route Protection via Auth Guard

**As a** platform operator,  
**I need** unauthenticated users to be redirected away from protected routes before any view
renders,  
**So that** authenticated content is never briefly visible before a redirect.

**Acceptance**:

- `auth.guard.ts` runs before any protected route renders
- Routes marked `requiresAuth: true` (via route meta) redirect unauthenticated users to the login
  route
- Routes marked `guestOnly: true` (via route meta) redirect authenticated users to the default
  dashboard route
- Guards never decode the JWT payload to determine authentication state — they query the Pinia auth
  store
- Guards return redirect instructions; they never throw exceptions or call `router.push()` directly

---

### AS-06 — Auth Module App-Agnosticism

**As a** platform architect,  
**I need** the auth module to function identically across MMC, Backoffice, and Frontoffice,  
**So that** the authentication runtime is a single maintained codebase rather than three diverging
implementations.

**Acceptance**:

- `core/auth/` directory structure and module contracts are identical across all three apps
- App-specific behavior (workspace scope for Backoffice, student scope for Frontoffice) is injected
  via configuration at bootstrap, not hardcoded in the auth module
- No app-specific `if (app === 'mmc')` branching exists inside `core/auth/`
- All three apps produce identical test coverage for the auth module behaviors

---

### AS-07 — Auth State Observability

**As a** developer building feature modules,  
**I need** auth state to be reactive and accessible through a well-typed Pinia store,  
**So that** any component or composable can respond to authentication state changes without direct
coupling to the token machinery.

**Acceptance**:

- Auth store exposes: `isAuthenticated`, `user`, `isLoading`, `authError`
- All state fields are typed — no `any` in the auth store public interface
- Components use the auth store's exposed getters; they never import `token-manager.ts` directly
- State changes are reactive and propagate immediately via Vue's reactivity system

---

## 5. Functional Requirements

### 5.1 Auth State Store (Pinia)

**FR-01** — The auth store must be located at `core/state/auth.store.ts` in each app.

**FR-02** — The auth store must expose the following typed state:

| Field             | Type                | Description                                                    |
| ----------------- | ------------------- | -------------------------------------------------------------- |
| `isAuthenticated` | `boolean`           | True only after confirmed server-authenticated session         |
| `user`            | `AuthUser \| null`  | Minimal user profile from backend — never decoded from JWT     |
| `isLoading`       | `boolean`           | True during in-flight auth operations (login, refresh, logout) |
| `authError`       | `AuthError \| null` | Last auth error; cleared on successful operation               |

**FR-03** — The `AuthUser` type must contain only: `id`, `email`, `name`, `role` (enum from
backend). No JWT claims. No permissions array.

**FR-04** — The auth store must expose the following actions:

| Action             | Description                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `initSession()`    | Called at app bootstrap — attempts silent refresh to re-establish session without login UI |
| `setSession()`     | Called after successful login — receives access token + user profile from login response   |
| `refresh()`        | Delegates to refresh-manager; returns success/failure without throwing                     |
| `logout()`         | Coordinates backend logout → state reset → router redirect                                 |
| `clearAuthError()` | Clears the `authError` field                                                               |

**FR-05** — The auth store must not contain direct HTTP calls. All network operations must delegate
to the API client or `AuthService`.

**FR-06** — The auth store must not contain permission checks, role comparisons, or license
validations.

**FR-07** — Token value must not be exposed as a store getter. Token access is internal to
`token-manager.ts`.

---

### 5.2 Token Manager

**FR-08** — `core/auth/token-manager.ts` is the sole owner of the in-memory access token.

**FR-09** — The token manager must expose:

| Method / Property | Description                                         |
| ----------------- | --------------------------------------------------- |
| `getToken()`      | Returns the current access token string or `null`   |
| `setToken(token)` | Stores the access token in memory                   |
| `clearToken()`    | Destroys the access token from memory               |
| `hasToken()`      | Returns boolean — whether a token is currently held |

**FR-10** — Token manager must never read from or write to `localStorage`, `sessionStorage`,
`document.cookie`, `indexedDB`, or URL state.

**FR-11** — Token manager must never log the token value via any logging or console mechanism.

**FR-12** — Token manager state is non-persistent: a full page reload destroys the in-memory token.
Session recovery is via `initSession()` → silent refresh flow.

---

### 5.3 Refresh Manager

**FR-13** — `core/auth/refresh-manager.ts` must implement the single-flight refresh strategy.

**FR-14** — Refresh manager behavior:

| Condition                              | Behavior                                                            |
| -------------------------------------- | ------------------------------------------------------------------- |
| No refresh in flight                   | Initiate a new refresh request; store promise in flight lock        |
| Refresh already in flight              | Queue caller; return same promise already in flight                 |
| Refresh succeeds                       | Resolve all queued callers with new token; clear in-flight lock     |
| Refresh fails (any error)              | Reject all queued callers; clear in-flight lock; trigger `logout()` |
| Network error during refresh           | Treated as refresh failure — triggers logout                        |
| Backend returns non-2xx during refresh | Treated as refresh failure — triggers logout                        |

**FR-15** — The refresh request must use the standard API client endpoint (e.g.
`POST /auth/refresh`). The httpOnly cookie is sent automatically by the browser — frontend sends no
explicit refresh token value.

**FR-16** — Refresh manager must not implement retry loops. One attempt only. Failure is final for
that cycle.

**FR-17** — Refresh manager must expose a `refresh()` function returning `Promise<void>` that
resolves on success or rejects on failure.

---

### 5.4 API Client Integration

**FR-18** — The API client (`core/api/client.ts`, established in STAGE_UI_00) must attach the access
token via `Authorization: Bearer <token>` header on every outbound request where `hasToken()`
returns true.

**FR-19** — On receipt of a 401 response, the API client must:

1. Call `refresh-manager.refresh()`
2. If refresh succeeds — retry the original request exactly once with the new token
3. If refresh fails — reject the original request with a normalized auth error

**FR-20** — Retry-after-refresh happens exactly once per original request. A second 401 on the
retried request must not trigger another refresh attempt — it propagates the error to the caller.

**FR-21** — The access token is never logged in request or response interceptors.

---

### 5.5 Auth Guard

**FR-22** — `core/router/guards/auth.guard.ts` must be registered as a `beforeEach` global guard in
each app's router.

**FR-23** — Guard logic:

| Route Meta Field       | Authenticated | Behavior                                         |
| ---------------------- | ------------- | ------------------------------------------------ |
| `requiresAuth: true`   | No            | Redirect to `{ name: 'login' }` for this app     |
| `requiresAuth: true`   | Yes           | Allow navigation                                 |
| `guestOnly: true`      | Yes           | Redirect to `{ name: 'dashboard' }` for this app |
| `guestOnly: true`      | No            | Allow navigation                                 |
| Neither meta field set | Any           | Allow navigation                                 |

**FR-24** — Auth guard must use `authStore.isAuthenticated` to determine auth status. It must not
check token manager directly or decode any JWT.

**FR-25** — Auth guard must return a redirect location object from the navigation guard function. It
must never call `router.push()` or `router.replace()` imperatively inside the guard.

**FR-26** — Auth guard must not throw exceptions. Navigation errors must resolve to a redirect or a
pass.

**FR-27** — The redirect target names (`'login'`, `'dashboard'`) must be configurable per app at
guard registration time to support MMC, Backoffice, and Frontoffice having different route name
conventions.

---

### 5.6 Auth Service Composable

**FR-28** — `core/auth/auth.service.ts` must expose an `AuthService` interface used by the auth
store to perform backend interactions:

| Method               | Description                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| `login(credentials)` | Sends credentials to backend; returns `{ accessToken, user }` on success |
| `logout()`           | Calls backend logout endpoint; resolves regardless of response status    |
| `refreshToken()`     | Calls backend refresh endpoint; returns new access token on success      |
| `fetchProfile()`     | Fetches authenticated user profile from backend `/me` endpoint           |

**FR-29** — `AuthService` must use the API client for all HTTP calls. It must not call `fetch()` or
any HTTP library directly.

**FR-30** — `AuthService.logout()` must resolve (not reject) even if the backend returns an error.
Frontend state cleanup must not depend on backend logout success.

**FR-31** — `AuthService` methods must return typed response objects. No `any` return types
permitted.

---

### 5.7 Session Initialization

**FR-32** — At app bootstrap (in `main.ts`, before `app.mount()`), `authStore.initSession()` must be
called before any route guard runs. See CL-01 in section 16 for the authoritative call-site
decision. The `onMounted` pattern is explicitly excluded due to the timing race it introduces with
Vue Router's initial navigation.

**FR-33** — `initSession()` must call `AuthService.refreshToken()` silently:

| Refresh Result      | Behavior                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Success             | Store access token, fetch user profile, set `isAuthenticated: true`                                                                   |
| Failure (any error) | Set `isAuthenticated: false`, clear any cached state — do not force logout redirect at this point (no previous session to invalidate) |

**FR-34** — During `initSession()`, `isLoading` must be `true`. No route guard resolves until
`initSession()` completes. This prevents a flash of the login page for already-authenticated users.

---

### 5.8 Logout Mechanics

**FR-35** — `authStore.logout()` must execute in this sequence:

1. Set `isLoading: true`
2. Call `AuthService.logout()` (fire and forget — does not block on response)
3. Call `tokenManager.clearToken()`
4. Reset auth store state to initial values
5. Redirect to login route
6. Set `isLoading: false`

**FR-36** — Logout must be idempotent. Calling `logout()` when already logged out must produce no
errors and must not call the backend.

**FR-37** — After logout, all in-memory auth state must be reset: `isAuthenticated: false`,
`user: null`, `authError: null`, `isLoading: false`.

---

### 5.9 Error Handling

**FR-38** — Auth errors must conform to the platform error contract:
`{ code: string, message: string }`.

**FR-39** — Auth-specific error codes:

| Code                        | Trigger                                                               |
| --------------------------- | --------------------------------------------------------------------- |
| `AUTH_REFRESH_FAILED`       | Refresh request returned non-2xx or network error                     |
| `AUTH_SESSION_EXPIRED`      | 401 received and refresh was already attempted (second 401)           |
| `AUTH_LOGOUT_FAILED`        | Backend logout endpoint returned error (non-fatal; state cleared)     |
| `AUTH_INIT_FAILED`          | `initSession()` refresh call failed (user treated as unauthenticated) |
| `AUTH_PROFILE_FETCH_FAILED` | `/me` endpoint returned error after successful token acquisition      |

**FR-40** — Auth errors must be stored in `authStore.authError` and never logged with token values
attached. Error log entries must reference only the error code and a sanitized message.

---

## 6. Non-Functional Requirements

**NFR-01** — The auth module must be implemented in strict TypeScript with no `any` type usage in
public interfaces.

**NFR-02** — The auth module must be app-agnostic. No app-specific identifiers (`'mmc'`,
`'backoffice'`, `'frontoffice'`) are hardcoded inside `core/auth/`.

**NFR-03** — Access token must never appear in:

- Browser localStorage or sessionStorage
- URL query parameters or hash fragments
- `document.cookie` (written by JavaScript)
- Console logs, structured logs, or error payloads
- Network request payloads (only in `Authorization` header)

**NFR-04** — Refresh manager must handle concurrent request bursts without spawning multiple
parallel refresh network calls, regardless of concurrency level.

**NFR-05** — Auth guard execution must not cause perceptible UI flash (unauthenticated content
visible before redirect). `initSession()` must complete before router navigation is unblocked.

**NFR-06** — Auth module must be fully testable in isolation without a running backend. Test doubles
must replace `AuthService` and the API client.

**NFR-07** — ESLint and TypeScript strict mode must pass with zero errors across all three apps'
`core/auth/` implementations.

**NFR-08** — Console output (including `console.log`, `console.warn`, `console.error`) must never
include token values. The structured logger abstraction from the platform logger package must be
used where logging is required.

---

## 7. Interface Definitions

### 7.1 AuthUser

```typescript
interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole; // enum from packages/types
}
```

### 7.2 AuthError

```typescript
interface AuthError {
  code: AuthErrorCode; // 'AUTH_REFRESH_FAILED' | 'AUTH_SESSION_EXPIRED' | ...
  message: string;
}
```

### 7.3 Auth Store State Shape

```typescript
interface AuthStoreState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  authError: AuthError | null;
}
```

### 7.4 AuthService Interface

```typescript
interface IAuthService {
  login(credentials: LoginCredentials): Promise<LoginResponse>;
  logout(): Promise<void>;
  refreshToken(): Promise<{ accessToken: string }>;
  fetchProfile(): Promise<AuthUser>;
}
```

### 7.5 TokenManager Interface

```typescript
interface ITokenManager {
  getToken(): string | null;
  setToken(token: string): void;
  clearToken(): void;
  hasToken(): boolean;
}
```

### 7.6 RefreshManager Interface

```typescript
interface IRefreshManager {
  refresh(): Promise<void>;
  isRefreshing(): boolean;
}
```

### 7.7 Route Meta Extensions

```typescript
// Extends Vue Router's RouteMeta
interface AuthRouteMeta {
  requiresAuth?: boolean;
  guestOnly?: boolean;
}
```

### 7.8 Auth Guard Options

```typescript
interface AuthGuardOptions {
  loginRouteName: string; // e.g. 'login' in MMC, 'tenant-login' in Backoffice
  dashboardRouteName: string; // e.g. 'dashboard' in MMC, 'overview' in Backoffice
}
```

---

## 8. Per-App Behavior Notes

### 8.1 MMC (Platform Admin)

- Tokens are platform-scoped; no workspace context
- Login endpoint: `POST /auth/login` on master API
- No WorkspaceGuard involvement
- Guard redirect targets: `{ name: 'mmc-login' }`, `{ name: 'mmc-dashboard' }`
- `AuthUser.role` will be a platform admin role enum value

### 8.2 Backoffice (Tenant Admin)

- Tokens are workspace-scoped
- Login endpoint: `POST /auth/login` on tenant API (workspace-resolved)
- WorkspaceGuard runs after AuthGuard in the guard pipeline — not implemented in this stage
- Guard redirect targets: `{ name: 'bo-login' }`, `{ name: 'bo-dashboard' }`
- workspace_slug is derived from the route path or subdomain — never from the token payload

### 8.3 Frontoffice (Student)

- Student tokens are exam-runtime scoped
- Login / session initialization connects to the student-facing API
- Attempt gating is server-side; the auth module does not enforce attempt access
- Guard redirect targets: `{ name: 'fo-login' }`, `{ name: 'fo-home' }`
- AttemptGuard (blocking navigation mid-exam) is deferred to the Frontoffice Exam Runtime stage

---

## 9. Dependencies

### 9.1 Consumed

| Dependency                                        | Version / Location                                               | Purpose                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `STAGE_UI_00_RUNTIME_ARCHITECTURE` (complete)     | Internal — same phase                                            | Provides canonical folder structure and API client skeleton |
| `packages/types` — `UserRole`, `LoginCredentials` | Internal monorepo package                                        | Shared type definitions                                     |
| `packages/logger`                                 | Internal monorepo package                                        | Structured logging abstraction (no `console.log`)           |
| Pinia                                             | `^2.x` (from app's package.json)                                 | Reactive state management                                   |
| Vue Router                                        | `^4.x` (from app's package.json)                                 | Routing and navigation guards                               |
| Backend auth endpoints                            | API — `/auth/login`, `/auth/logout`, `/auth/refresh`, `/auth/me` | Auth flow execution                                         |

### 9.2 Produced

| Artifact                      | Location                           | Consumed By                              |
| ----------------------------- | ---------------------------------- | ---------------------------------------- |
| `auth.store.ts` (Pinia store) | `core/state/auth.store.ts`         | All feature modules requiring auth state |
| `token-manager.ts`            | `core/auth/token-manager.ts`       | API client interceptor                   |
| `refresh-manager.ts`          | `core/auth/refresh-manager.ts`     | API client 401 handler                   |
| `auth.service.ts`             | `core/auth/auth.service.ts`        | Auth store actions                       |
| `auth.guard.ts`               | `core/router/guards/auth.guard.ts` | Router initialization (per app)          |

---

## 10. Completion Criteria

This stage is complete when all of the following are verifiable:

| Criterion                                                      | Verification Method                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| Auth store implemented with typed state                        | TypeScript strict mode passes; store type tests pass         |
| Token manager holds token in memory only                       | Unit test confirms no browser storage writes                 |
| Refresh manager implements single-flight lock                  | Concurrency test: N parallel 401s → exactly 1 refresh call   |
| Queued requests retry after successful refresh                 | Integration test: 3 concurrent 401s all succeed post-refresh |
| Failed refresh forces logout                                   | Unit test: refresh failure → store reset → redirect          |
| Logout clears all in-memory state                              | Unit test: post-logout state equals initial state            |
| Auth guard protects requiresAuth routes                        | Navigation test: unauthenticated → redirect to login         |
| Auth guard redirects authenticated users from guestOnly routes | Navigation test: authenticated → redirect to dashboard       |
| No token logged anywhere                                       | ESLint rule / grep: no token in log calls                    |
| `initSession()` prevents login flash                           | Integration test: authenticated reload → no login redirect   |
| All auth module tests pass in all three apps                   | CI: tests green across mmc, backoffice, frontoffice          |
| ESLint passes with zero errors                                 | CI: lint step passes                                         |
| TypeScript strict mode passes                                  | CI: tsc passes                                               |

---

## 11. Test Strategy

### 11.1 Unit Tests (Required)

| Subject              | Test Cases                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `token-manager.ts`   | setToken stores value; getToken returns null before set; clearToken destroys value; no storage writes                                       |
| `auth.store.ts`      | Initial state shape; setSession updates state; logout resets to initial state; authError set on failure                                     |
| `refresh-manager.ts` | Single refresh issued for concurrent 401s; queued callers resolved on success; all callers rejected on failure; logout triggered on failure |
| `auth.guard.ts`      | requiresAuth + unauthenticated → redirect; guestOnly + authenticated → redirect; no meta → pass; no JWT decoding                            |
| `auth.service.ts`    | logout() resolves on backend error; fetchProfile() returns typed AuthUser                                                                   |

### 11.2 Integration Tests (Required)

| Scenario                               | Coverage Goal                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| Concurrent 401 burst                   | Exactly one refresh call; all original requests retried                         |
| Refresh failure mid-burst              | All concurrent requests rejected; logout triggered once                         |
| Session init on authenticated reload   | initSession → silent refresh → user fetched → isAuthenticated true              |
| Session init on unauthenticated reload | initSession → silent refresh fails → isAuthenticated false → no logout redirect |
| Logout during pending request          | Pending request cancelled; store cleared; redirect fires                        |
| Second 401 after retry                 | Not triggering second refresh; propagates error                                 |

### 11.3 Snapshot Tests (Not Required)

No grading or configuration snapshots involved. Not applicable.

### 11.4 Test Infrastructure

- `AuthService` must be mockable via dependency injection or test double factory
- Pinia store must be testable via `setActivePinia(createPinia())` pattern
- Router must be testable via `createMemoryHistory()` — no real browser navigation in tests
- Refresh manager must expose an injectable HTTP factory for test doubles

---

## 12. Explicit Non-Goals

This stage does NOT:

- Design or implement login, registration, password reset, or 2FA UI
- Implement RBAC (role-based route guards) — that is RoleGuard
- Implement WorkspaceGuard (Backoffice-specific)
- Implement AttemptGuard (Frontoffice-specific, deferred)
- Handle license validation — server-side middleware only
- Validate business rules in the frontend
- Implement token rotation or token blacklisting logic — backend concern
- Configure backend auth endpoints or schemas
- Implement refresh token rotation — managed by backend httpOnly cookie strategy
- Perform any JWT payload inspection beyond reading the raw token string for transmission

---

## 13. Isolation Impact Analysis

| Question                               | Answer                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Which database is accessed?            | None — this is a UI-only stage                                                                    |
| How is tenant resolved?                | Workspace slug is derived from the app's route path or subdomain; auth module does not resolve it |
| Where is the connection pool obtained? | Not applicable — UI layer                                                                         |
| Is resolver middleware used?           | Not applicable — UI layer; backend resolver middleware is always already in use for API calls     |
| New tables introduced?                 | None                                                                                              |
| Shared tenant data risk?               | None — auth module is app-local; no cross-app state sharing                                       |

No isolation concerns exist for this stage. All multi-tenancy guarantees remain unaffected.

---

## 14. Layer Separation Confirmation

| Rule                                       | Status                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| Frontend contains no business logic        | ✅ Confirmed — auth module never enforces RBAC, license rules, or attempt gating |
| API contains no grading logic              | ✅ Confirmed — not in scope for this stage                                       |
| Worker contains no HTTP logic              | ✅ Confirmed — not in scope for this stage                                       |
| MMC does not access tenant DB              | ✅ Confirmed — UI layer; MMC auth module has no DB access                        |
| No direct DB creation outside provisioning | ✅ Confirmed — not in scope for this stage                                       |
| `apps/*` do not import from other `apps/*` | ✅ Confirmed — each app's `core/auth/` is self-contained                         |
| `packages/*` do not import from `apps/*`   | ✅ Confirmed — shared types in `packages/types` only; no reverse imports         |
| UI does not import DB schemas              | ✅ Confirmed — no Drizzle or DB-related imports in `core/auth/`                  |

---

## 15. Final Constitutional Compliance Statement

Compliant with Zidney Constitution v1.2.0 — No violations detected.

This stage implements the UI authentication runtime engine in strict conformance with the Zidney
constitutional model:

- Authentication is server-authoritative; no frontend credential validation, token issuance, or JWT
  decoding for permissions.
- Access token is confined to reactive in-memory Pinia state; refresh token is managed exclusively
  by backend httpOnly cookie.
- Token expiry is detected by backend 401 response only; client time is never trusted.
- Single-flight refresh prevents token refresh amplification under concurrent load.
- Logout is coordinated: backend invalidation followed by unconditional frontend state teardown.
- Route guards are declarative and query store state only — they never inspect JWT payloads.
- All multi-tenancy isolation, license enforcement, and attempt engine integrity guarantees are
  unaffected and remain server-side.

---

## 16. Clarifications

### Session 2026-03-01

#### CL-01 — `initSession()` Call Site

**Question:** FR-32/FR-34 states `initSession()` must complete before any route guard runs. Where
should it be called?

**Decision:** In `main.ts` before `app.mount()`, with a `router.beforeEach` guard that awaits a
reactive `sessionInitialized` ref.

**Rationale:** This is the only reliable pattern. Calling `initSession()` in `App.vue` `onMounted`
introduces a timing race — the Vue Router `beforeEach` hook fires during the initial navigation,
which happens before `onMounted` runs. By executing `initSession()` in `main.ts` and gating the
guard pipeline on a `sessionInitialized` boolean ref, the auth state is guaranteed to be resolved
before any route guard evaluates. This prevents the login-flash anti-pattern described in NFR-05.

**Implementation contract:**

```typescript
// main.ts — bootstrap pattern
const authStore = useAuthStore(pinia);
const sessionInitialized = ref(false);

router.beforeEach(async () => {
  if (!sessionInitialized.value) {
    await authStore.initSession();
    sessionInitialized.value = true;
  }
  // delegate to auth.guard.ts logic
});

app.mount("#app");
```

---

#### CL-02 — Circular Dependency Resolution: Auth Store ↔ API Client ↔ Refresh Manager

**Question:** The circular dependency `authStore.logout()` → API client →
`refresh-manager.refresh()` → `authStore.logout()` must be broken. How?

**Decision:** Pass an `onLogout` callback to the refresh-manager at initialization time (factory
injection pattern).

**Rationale:** This is the cleanest and most testable resolution. The refresh manager is created via
a factory function that receives a `onLogout: () => void` callback at bootstrap. This breaks the
module-level circular import by ensuring the refresh manager has zero compile-time dependency on
Pinia or the auth store. In tests, `onLogout` is replaced with a Vitest spy, enabling isolated unit
testing without instantiating Pinia.

**Implementation contract:**

```typescript
// refresh-manager.ts — factory pattern
export function createRefreshManager(
  httpClient: RefreshHttpClient,
  onLogout: () => void
): IRefreshManager { ... }

// main.ts — wired at bootstrap
const refreshManager = createRefreshManager(apiClient, () => authStore.logout())
```

---

#### CL-03 — API Client Interceptor Ownership

**Question:** Do the 401-handling and token-injection interceptors (FR-18–FR-21) already exist from
STAGE_UI_00, or are they created from scratch in this stage?

**Decision:** STAGE_UI_00 provided the API client skeleton (base URL config, axios/fetch wrapper
factory). This stage wires in the actual interceptor implementations: token injection and 401 →
refresh → retry logic.

**Rationale:** Stage 00's scope was folder structure and scaffolding. The interceptor hooks were
left as stubs or empty extension points. This stage fills them in using `token-manager.getToken()`
and `refresh-manager.refresh()`, completing the API client's auth integration contract.

**Implementation scope:**

- Wire request interceptor: inject `Authorization: Bearer <token>` if `tokenManager.hasToken()` is
  true
- Wire response interceptor: on 401, call `refreshManager.refresh()`, retry once, handle second 401
  as terminal
- The API client file (`core/api/client.ts`) is **modified** in all three apps — not created from
  scratch
