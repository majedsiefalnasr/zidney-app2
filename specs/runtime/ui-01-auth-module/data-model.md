# Data Model: STAGE_UI_01_AUTH_MODULE

**Stage**: STAGE_UI_01_AUTH_MODULE  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Generated**: 2026-03-01  
**Location**: `apps/{mmc,backoffice,frontoffice}/src/core/auth/types.ts`

These types are defined identically in each app's `core/auth/types.ts`. They are **not** placed in
`packages/types` because they are UI-layer runtime types (not shared domain contracts) and each app
may eventually specialize `UserRole`.

---

## 1. `UserRole`

```typescript
// core/auth/types.ts
// TODO: Replace with packages/types UserRole once a shared frontend-facing enum
//       is defined. MMC currently uses MMCUserRole from packages/types/master-db.
//       Backoffice and Frontoffice role enums are pending their respective stages.
export type UserRole = string;
```

**Notes**:

- MMC app: import `{ MMCUserRole }` from `@zidney/types` and use as the concrete `UserRole` value in
  login response mapping.
- Backoffice / Frontoffice: use plain `string` until tenant/student role enums are introduced in
  their respective stages.
- The `AuthUser.role` field is typed `UserRole = string` here, keeping strict mode happy while
  allowing any role discriminant value from the backend.

---

## 2. `AuthErrorCode`

```typescript
// core/auth/types.ts
export type AuthErrorCode =
  | "AUTH_REFRESH_FAILED" // refresh endpoint returned non-2xx or network error
  | "AUTH_SESSION_EXPIRED" // 401 received after refresh was already attempted
  | "AUTH_LOGOUT_FAILED" // logout endpoint error (non-fatal; state still cleared)
  | "AUTH_INIT_FAILED" // initSession() silent refresh failed
  | "AUTH_PROFILE_FETCH_FAILED"; // /me endpoint failed after successful token acquisition
```

**Usage**: `AuthError.code` field. Each code maps to a distinct workflow branch in the auth store
and/or API client interceptor.

---

## 3. `AuthError`

```typescript
// core/auth/types.ts
export interface AuthError {
  /** Machine-readable error discriminant from AuthErrorCode union */
  code: AuthErrorCode;
  /** Human-readable message — must NOT contain token values */
  message: string;
}
```

**Invariants**:

- `message` must never contain the access token string.
- Stored in `authStore.authError` and visible to Vue components via computed.
- Cleared by `authStore.clearAuthError()` and on any successful auth operation.

---

## 4. `AuthUser`

```typescript
// core/auth/types.ts
export interface AuthUser {
  /** Backend-assigned UUID for the user */
  id: string;
  /** Primary email address */
  email: string;
  /** Display name — from backend /me response */
  name: string;
  /** Role discriminant — populated from /me response, not JWT payload */
  role: UserRole;
}
```

**Invariants**:

- Populated **only** from a successful `AuthService.fetchProfile()` response.
- Never populated by decoding the JWT access token payload.
- No permissions array, no license data, no workspace-specific fields in this type.
- `workspaceSlug` is NOT part of `AuthUser` — it is derived from the route, not the token.

---

## 5. `AuthStoreState`

```typescript
// core/auth/types.ts
export interface AuthStoreState {
  /** True only after a backend-confirmed session (login or silent refresh) */
  isAuthenticated: boolean;
  /** Populated from /me endpoint; null when not authenticated */
  user: AuthUser | null;
  /** True during in-flight auth operations (initSession, login, logout) */
  isLoading: boolean;
  /** Last auth failure; null after any successful auth operation */
  authError: AuthError | null;
}
```

**State Transitions**:

| Event                    | `isAuthenticated` | `user`    | `isLoading` | `authError`           |
| ------------------------ | ----------------- | --------- | ----------- | --------------------- |
| Initial                  | `false`           | `null`    | `false`     | `null`                |
| `initSession()` starts   | —                 | —         | `true`      | —                     |
| `initSession()` succeeds | `true`            | populated | `false`     | `null`                |
| `initSession()` fails    | `false`           | `null`    | `false`     | `AUTH_INIT_FAILED`    |
| `setSession()`           | `true`            | populated | `false`     | `null`                |
| `logout()` starts        | —                 | —         | `true`      | —                     |
| `logout()` completes     | `false`           | `null`    | `false`     | `null`                |
| Refresh fails            | `false`           | `null`    | `false`     | `AUTH_REFRESH_FAILED` |

---

## 6. `LoginCredentials`

```typescript
// core/auth/types.ts
export interface LoginCredentials {
  /** User email address */
  email: string;
  /** Raw password — passed directly to backend without frontend validation */
  password: string;
}
```

**Notes**:

- No frontend password validation rules applied (spec compliant: no frontend credential validation).
- The backend enforces all password policy rules.

---

## 7. `LoginResponse`

```typescript
// core/auth/types.ts
export interface LoginResponse {
  /** Short-lived access token — stored in TokenManager memory only */
  accessToken: string;
  /** Minimal user profile — same shape as AuthUser */
  user: AuthUser;
}
```

**Notes**:

- The refresh token is **not** in this type — it is delivered exclusively as an httpOnly cookie by
  the backend, never accessible to JavaScript.
- `accessToken` is immediately passed to `tokenManager.setToken()` and must never be passed to any
  logger.

---

## 8. `ITokenManager`

```typescript
// core/auth/token-manager.ts
export interface ITokenManager {
  /** Returns the current in-memory access token or null if not set */
  getToken(): string | null;
  /** Stores the access token in reactive memory — no browser storage side effects */
  setToken(token: string): void;
  /** Destroys the access token from reactive memory */
  clearToken(): void;
  /** Returns true if a token is currently held in memory */
  hasToken(): boolean;
}
```

**Implementation Notes**:

- Backed by a Vue `ref<string | null>(null)` — reactive, but the ref is not exported.
- The token `ref` value is never returned directly; only string/null is returned from `getToken()`.
- `hasToken()` is a pure boolean check; guards use this to decide whether to inject the
  Authorization header.

---

## 9. `IRefreshManager`

```typescript
// core/auth/refresh-manager.ts
export interface IRefreshManager {
  /**
   * Initiates a token refresh or joins an in-flight refresh.
   * Resolves when the new token is available in TokenManager.
   * Rejects when refresh fails — onLogout callback is automatically triggered.
   */
  refresh(): Promise<void>;
  /** Returns true if a refresh request is currently in flight */
  isRefreshing(): boolean;
}

/** Factory signature for creating a RefreshManager instance */
export type RefreshManagerFactory = (
  refreshFn: () => Promise<string>,
  onLogout: () => void,
  tokenManager: ITokenManager,
) => IRefreshManager;
```

**Dependency contract**:

- `refreshFn` — injected by `main.ts`; calls `POST /auth/refresh` via api-client. Returns the new
  `accessToken` string on success, throws on failure.
- `onLogout` — injected by `main.ts`; calls `authStore.logout()`. Zero compile-time dependency on
  Pinia; breaks circular import chain.
- `tokenManager` — injected by `main.ts`; calls `tokenManager.setToken(newToken)` after successful
  refresh. Ensures the new access token is stored before queued requests are retried.

---

## 10. `IAuthService`

```typescript
// core/auth/auth.service.ts
export interface IAuthService {
  /**
   * Sends login credentials to the backend.
   * Returns access token + user profile on success.
   * Throws AuthError on failure.
   */
  login(credentials: LoginCredentials): Promise<LoginResponse>;

  /**
   * Calls the backend logout endpoint.
   * Always resolves — never rejects.
   * Frontend state cleanup must not depend on this call's success.
   */
  logout(): Promise<void>;

  /**
   * Calls POST /auth/refresh.
   * Returns the new access token string on success.
   * Throws on failure (used by refresh-manager's refreshFn).
   */
  refreshToken(): Promise<{ accessToken: string }>;

  /**
   * Fetches the authenticated user's profile from GET /auth/me.
   * Returns typed AuthUser.
   * Throws AuthError with code AUTH_PROFILE_FETCH_FAILED on failure.
   */
  fetchProfile(): Promise<AuthUser>;
}
```

---

## 11. `AuthRouteMeta`

```typescript
// core/router/types.ts  (or declared inside the router index file)
// Extends Vue Router's RouteMeta to add auth-specific fields.
declare module "vue-router" {
  interface RouteMeta {
    /** When true: unauthenticated users are redirected to the login route */
    requiresAuth?: boolean;
    /** When true: authenticated users are redirected to the dashboard route */
    guestOnly?: boolean;
  }
}

// Convenience type alias for use in guards
export interface AuthRouteMeta {
  requiresAuth?: boolean;
  guestOnly?: boolean;
}
```

---

## 12. `AuthGuardOptions`

```typescript
// core/router/guards/auth.guard.ts
export interface AuthGuardOptions {
  /**
   * Name of the login route for this app.
   * MMC: 'mmc-login'
   * Backoffice: 'bo-login'
   * Frontoffice: 'fo-login'
   */
  loginRouteName: string;

  /**
   * Name of the default authenticated landing route.
   * MMC: 'mmc-dashboard'
   * Backoffice: 'bo-dashboard'
   * Frontoffice: 'fo-home'
   */
  dashboardRouteName: string;
}
```

---

## 13. Type Relationships Diagram

```
LoginCredentials ──────────────────────────────────► IAuthService.login()
                                                           │
                                                           ▼
                                                      LoginResponse
                                                      ├── accessToken ──► ITokenManager.setToken()
                                                      └── user ──────────► AuthStoreState.user

AuthStoreState
├── isAuthenticated ─────────────────────────────────► AuthGuardOptions (guard decision)
├── user: AuthUser | null
│       └── role: UserRole (from /me, never from JWT)
├── isLoading: boolean
└── authError: AuthError | null
         └── code: AuthErrorCode

IRefreshManager ◄──── createRefreshManager(refreshFn, onLogout)
├── refreshFn: () => Promise<string>  ◄── IAuthService.refreshToken()
└── onLogout: () => void              ◄── authStore.logout() (injected; no circular import)

ITokenManager ◄───── singleton created in main.ts
└── ref<string | null>(null)  —— never in browser storage
```

---

## 14. File Placement

| Type/Interface                                                                                              | File Location (identical in all three apps) |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `UserRole`, `AuthErrorCode`, `AuthError`, `AuthUser`, `AuthStoreState`, `LoginCredentials`, `LoginResponse` | `core/auth/types.ts`                        |
| `ITokenManager`                                                                                             | `core/auth/token-manager.ts`                |
| `IRefreshManager`, `RefreshManagerFactory`                                                                  | `core/auth/refresh-manager.ts`              |
| `IAuthService`                                                                                              | `core/auth/auth.service.ts`                 |
| `AuthRouteMeta` (module augmentation)                                                                       | `core/router/index.ts`                      |
| `AuthGuardOptions`                                                                                          | `core/router/guards/auth.guard.ts`          |
