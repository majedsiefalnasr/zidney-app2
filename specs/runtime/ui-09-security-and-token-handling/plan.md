# STAGE_UI_09 — Implementation Plan

**Stage**: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Generated**: 2026-03-01  
**Status**: READY FOR IMPLEMENTATION  
**Depends on**: STAGE_UI_01_AUTH_MODULE (complete in all three apps)

---

## Architecture Flags

**No new ADR required.**

This stage is purely additive and corrective within the existing auth layer. All changes extend existing factories with backward-compatible signatures. No structural changes to `packages/api-client` or any backend component.

---

## Key Design Decisions

| Decision                                                                                          | Rationale                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No `auth.store.ts` restructure — existing `core/state/auth.store.ts` is the store                 | STAGE_UI_01 already implements the canonical store; renaming or moving it would break STAGE_UI_01 imports and bootstrap wiring                                                                                                                   |
| `error.interceptor.ts` placed in `core/api/interceptors/` rather than `core/auth/interceptors.ts` | 401 error handling is an API transport concern, not an auth domain concern; placing it adjacent to `client.ts` reduces cross-directory coupling and makes the wiring obvious. The spec's placement table was aspirational; the plan corrects it. |
| `isHandling401` maps to the existing `refreshPromise !== null` guard in packages/api-client       | The package already implements single-flight protection; the only gap is the `isAuthenticated` condition check at the call site                                                                                                                  |
| 401 `isAuthenticated` check lives in `core/api/client.ts`, not in the shared package              | Avoids modifying the shared package (which is also consumed by API/Worker layer transforms)                                                                                                                                                      |
| 423/426 handling via `onLicenseError` callback in `createAppApiClient`                            | Consistent with existing `onAuthFailure` callback pattern; no package modification needed                                                                                                                                                        |
| Session-expired notification uses `authStore.authError` (code: `AUTH_SESSION_EXPIRED`)            | `authError` is already typed (`AuthErrorCode` union), referenced by login page; no new notification store needed                                                                                                                                 |
| Redirect preservation uses `{ query: { redirect: to.path } }` in auth guard                       | Standard Vue Router pattern; no extra state or store needed                                                                                                                                                                                      |
| Token redaction utility is a pure function with zero runtime imports                              | Enables test-only import without framework setup overhead                                                                                                                                                                                        |
| No new npm packages                                                                               | All requirements satisfiable with pinia, vue-router, @zidney/api-client, @zidney/logger                                                                                                                                                          |

---

## File Structure

### Files to Create

```
apps/mmc/src/core/auth/token-redact.ts                    — NEW (FR-SEC-03)
apps/mmc/src/core/api/interceptors/error.interceptor.ts   — NEW (FR-SEC-07, FR-SEC-20, FR-SEC-21)

apps/backoffice/src/core/auth/token-redact.ts             — NEW (FR-SEC-03)
apps/backoffice/src/core/api/interceptors/error.interceptor.ts — NEW

apps/frontoffice/src/core/auth/token-redact.ts            — NEW (FR-SEC-03)
apps/frontoffice/src/core/api/interceptors/error.interceptor.ts — NEW
```

### Test Files to Create

```
tests/unit/mmc/core/auth/token-redact.test.ts
tests/unit/mmc/core/api/interceptors/error.interceptor.test.ts
tests/unit/mmc/core/router/guards/auth.guard.redirect.test.ts   — extends existing guard tests

tests/unit/backoffice/core/auth/token-redact.test.ts
tests/unit/backoffice/core/api/interceptors/error.interceptor.test.ts
tests/unit/backoffice/core/router/guards/auth.guard.redirect.test.ts

tests/unit/frontoffice/core/auth/token-redact.test.ts
tests/unit/frontoffice/core/api/interceptors/error.interceptor.test.ts
tests/unit/frontoffice/core/router/guards/auth.guard.redirect.test.ts
```

### Files to Modify

```
apps/mmc/src/core/api/client.ts               — extend createAppApiClient signature + isAuthenticated guard
apps/mmc/src/core/auth/index.ts               — export token-redact.ts
apps/mmc/src/core/router/guards/auth.guard.ts — add redirect preservation
apps/mmc/src/core/state/auth.store.ts         — add expireSession() action

apps/backoffice/src/core/api/client.ts        — same
apps/backoffice/src/core/auth/index.ts        — same
apps/backoffice/src/core/router/guards/auth.guard.ts — same
apps/backoffice/src/core/state/auth.store.ts  — add expireSession() action

apps/frontoffice/src/core/api/client.ts       — same
apps/frontoffice/src/core/auth/index.ts       — same
apps/frontoffice/src/core/router/guards/auth.guard.ts — same
apps/frontoffice/src/core/state/auth.store.ts — add expireSession() action
```

### Files Confirmed Unchanged

```
apps/*/src/core/auth/token-manager.ts         — already compliant (FR-SEC-01/02)
apps/*/src/core/auth/refresh-manager.ts       — already compliant (FR-SEC-08 single-flight)
apps/*/src/core/auth/auth.service.ts          — already compliant (FR-SEC-03 no token logging)
packages/api-client/src/interceptors.ts       — already compliant (FR-SEC-04/05)
packages/api-client/src/client.ts             — already compliant (single-flight 401 guard)
```

---

## 1. Auth Store Design

**File**: `apps/*/src/core/state/auth.store.ts` (existing — no structural changes)

### State Shape (existing — confirmed compliant)

```typescript
const isAuthenticated = ref<boolean>(false) // FR-SEC-15: guard checks this only
const user = ref<AuthUser | null>(null)
const isLoading = ref<boolean>(false)
const authError = ref<AuthError | null>(null) // carries AUTH_SESSION_EXPIRED on 401 expiry
```

### Actions (existing — confirmed compliant)

| Action                       | Responsibility                                      | FR           |
| ---------------------------- | --------------------------------------------------- | ------------ |
| `initSession()`              | Silent session restore on page load                 | FR-SEC-10    |
| `setSession(token, profile)` | Establishes session post-login                      | FR-SEC-10    |
| `logout()`                   | Clears token + user + authError, redirects to login | FR-SEC-10–13 |
| `refresh()`                  | Delegates to refresh-manager (single-flight)        | —            |
| `clearAuthError()`           | Clears the authError field                          | —            |

### Session-Expired Notification Pattern

When the `error.interceptor.ts` triggers the session-expiry flow, it sets `authError` on the store with `code: 'AUTH_SESSION_EXPIRED'` **before** calling `logout()`. The login page reads `authStore.authError` and displays the "Session expired — please sign in again" message. This requires no new notification store.

```typescript
// In error.interceptor.ts (called from onAuthFailure wiring):
authStore.authError = {
  code: 'AUTH_SESSION_EXPIRED',
  message: 'Session expired. Please sign in again.',
}
await authStore.logout()
```

The `logout()` action does NOT reset `authError` (it calls `resetState()` which resets `isAuthenticated`, `user`, `authError`). Therefore the interceptor must set `authError` AFTER calling logout, OR `resetState()` must be patched to preserve `AUTH_SESSION_EXPIRED`.

**Resolution**: The interceptor calls a new `expireSession()` action (to be added — see below) that sets `authError` as part of the logout flow:

```typescript
// New action added to auth.store.ts in all 3 apps:
async function expireSession(): Promise<void> {
  // Idempotency: skip if already handling expiry
  if (!isAuthenticated.value) return

  // Clear auth state immediately
  tokenManager.clearToken()
  isAuthenticated.value = false
  user.value = null

  // Navigate to login
  await router.push({ name: loginRouteName })

  // Set session-expired error AFTER navigation so it is not cleared by any
  // navigation-triggered store reaction. Note: expireSession() intentionally
  // does NOT call authService.logout() unlike the user-initiated logout() action.
  // The server already invalidated the session (it returned 401), so no
  // backend call is necessary or safe to make here.
  authError.value = {
    code: 'AUTH_SESSION_EXPIRED',
    message: 'Session expired. Please sign in again.',
  }
  logger.info('Session expired — user redirected to login')
}
```

**Updated file**: `apps/*/src/core/state/auth.store.ts` — add `expireSession()` action and export it.

---

## 2. Token Injection (auth.interceptor.ts)

**File**: `apps/*/src/core/api/interceptors/auth.interceptor.ts`

> **Note**: Authorization header injection is ALREADY handled centrally in `packages/api-client/src/interceptors.ts:applyAuthHeader()`. This file is a **documentation shim** that describes the injection point and re-exports the relevant type for app-level wiring documentation. No business logic here.

```typescript
/**
 * Auth header injection documentation shim for {APP}.
 *
 * The actual Authorization: Bearer <token> injection is performed by
 * packages/api-client/src/interceptors.ts:applyAuthHeader(), called from
 * packages/api-client/src/client.ts:executeRequest() on every outbound request.
 *
 * Wired in core/api/client.ts:
 *   getAccessToken: () => tokenManager.getToken()
 *
 * Rules enforced at the package level:
 * - Token present  → Authorization: Bearer <token>
 * - Token absent   → Authorization header omitted entirely (never "Bearer undefined")
 * - Single location — no component or service may duplicate this logic (FR-SEC-06)
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 */
export const AUTH_INTERCEPTOR_DOCS = {
  location: 'packages/api-client/src/interceptors.ts:applyAuthHeader',
  frs: ['FR-SEC-04', 'FR-SEC-05', 'FR-SEC-06'],
} as const
```

This file enforces the architectural rule that injection is single-location, serves as a discoverable reference, and satisfies the spec's `core/api/interceptors/` directory structure requirement.

---

## 3. 401 Handler (`error.interceptor.ts`)

**File**: `apps/*/src/core/api/interceptors/error.interceptor.ts` (NEW)

### Design

```typescript
/**
 * Error response interceptor for {APP}.
 * Handles authenticated-session-only 401 expiry flow and 423/426 license responses.
 *
 * INVARIANTS:
 * - FR-SEC-07: Session-expiry flow ONLY fires when store.isAuthenticated === true
 * - FR-SEC-08: isHandling401 boolean prevents parallel storm; reset after redirect
 * - FR-SEC-20: 423 → onLicenseError(423) — no retry, no override
 * - FR-SEC-21: 426 → onLicenseError(426) — no retry, no override
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 */
import { createLogger } from '@zidney/logger'

const logger = createLogger('auth:error-interceptor')

export interface ErrorInterceptorOptions {
  /** Returns current isAuthenticated value from auth store */
  getIsAuthenticated: () => boolean
  /** Triggers session-expiry flow: set authError + clear state + redirect to login */
  onSessionExpired: () => Promise<void>
  /** Triggered for 423 (workspace locked) and 426 (upgrade required) responses */
  onLicenseError: (status: 423 | 426) => void
}

export interface IErrorInterceptor {
  /**
   * Call this from the onAuthFailure callback in createAppApiClient.
   * Applies the isAuthenticated guard before triggering session expiry.
   */
  handleAuthFailure(): Promise<void>
  /**
   * Call this when a non-ok HTTP response is received with status 423 or 426.
   */
  handleLicenseError(status: 423 | 426): void
  /**
   * True while a 401 expiry flow is in progress.
   * Prevents concurrent interceptor invocations from re-entering the flow.
   */
  readonly isHandling401: boolean
}

export function createErrorInterceptor(
  options: ErrorInterceptorOptions
): IErrorInterceptor {
  let _isHandling401 = false

  return {
    get isHandling401() {
      return _isHandling401
    },

    async handleAuthFailure(): Promise<void> {
      // FR-SEC-07: only trigger expiry flow for authenticated sessions
      if (!options.getIsAuthenticated()) {
        logger.debug(
          '401 received on unauthenticated request — passing through'
        )
        return
      }

      // FR-SEC-08: idempotency guard — drop storm
      if (_isHandling401) {
        logger.debug('401 expiry flow already in progress — dropping duplicate')
        return
      }

      _isHandling401 = true
      logger.warn('Authenticated session 401 — initiating session expiry flow')

      try {
        await options.onSessionExpired()
      } finally {
        _isHandling401 = false
      }
    },

    handleLicenseError(status: 423 | 426): void {
      logger.warn('License-related HTTP response received', { status })
      options.onLicenseError(status)
    },
  }
}
```

### Wiring in `core/api/client.ts`

The `createAppApiClient` factory is extended:

```typescript
export function createAppApiClient(
  tokenManager: ITokenManager,
  refreshManager: IRefreshManager,
  errorInterceptor: IErrorInterceptor // ← new parameter
): ApiClient {
  return createClient({
    baseUrl: appConfig.env.apiBaseUrl,
    credentials: 'include',
    getAccessToken: () => tokenManager.getToken(),
    onRefreshToken: async (): Promise<string> => {
      /* unchanged */
    },
    onAuthFailure: () => {
      // FR-SEC-07/FR-SEC-08: delegated to error interceptor
      errorInterceptor.handleAuthFailure().catch((err: unknown) => {
        logger.error('Error in auth failure handler', {
          error: err instanceof Error ? err.message : 'unknown',
        })
      })
    },
    adapter: createFetchAdapter(),
  })
}
```

The `IErrorInterceptor` is created in `main.ts` after the auth store is initialized, then passed to `createAppApiClient`. This preserves the existing factory/dependency-injection pattern.

### `main.ts` Wiring Sketch (all 3 apps)

```typescript
// After authStore is created:
const errorInterceptor = createErrorInterceptor({
  getIsAuthenticated: () => authStore.isAuthenticated,
  onSessionExpired: () => authStore.expireSession(),
  onLicenseError: (status) => {
    // Set a license-error flag in a UI state store (details in section 5)
    if (status === 423) uiStore.setWorkspaceLocked()
    if (status === 426) uiStore.setUpgradeRequired()
  },
})

const apiClient = createAppApiClient(
  tokenManager,
  refreshManager,
  errorInterceptor
)
```

---

## 4. Route Guard — Redirect Preservation Extension

**File**: `apps/*/src/core/router/guards/auth.guard.ts` (MODIFY)

### Change

Extend the unauthenticated redirect to preserve the intended route as `?redirect=<path>`:

```typescript
// Before (existing):
return { name: options.loginRouteName }

// After (extended):
return {
  name: options.loginRouteName,
  query: { redirect: to.fullPath },
}
```

Extend `AuthGuardOptions`:

```typescript
export interface AuthGuardOptions {
  loginRouteName: string
  dashboardRouteName: string
  /** When true, preserves the intended route as ?redirect query on unauthenticated access */
  preserveRedirect?: boolean // default: true
}
```

The login page reads `route.query.redirect` after successful authentication and calls `router.push(query.redirect ?? { name: dashboardRouteName })`.

---

## 5. Secure Logout

**File**: `apps/*/src/core/state/auth.store.ts` (existing — confirmed, add `expireSession`)

### Logout Flow (existing — confirmed compliant)

`logout()` in `auth.store.ts` already:

1. Guards against duplicate calls (isLoading guard, isAuthenticated guard) ✅
2. Calls `authService.logout()` fire-and-forget (non-fatal) ✅
3. Calls `tokenManager.clearToken()` ✅
4. Calls `resetState()` (isAuthenticated, user, authError → null/false) ✅
5. Calls `router.push({ name: loginRouteName })` ✅
6. Sets `isLoading = false` after navigation resolves ✅

No changes to the `logout()` action. The `expireSession()` action supplements it for the 401-triggered scenario.

### User-Specific State Clearing

**FR-SEC-11 deferral (explicitly documented):** STAGE_UI_09 cannot enumerate session-bound Pinia stores because no feature stores exist yet — they are created in subsequent feature stages. Per FR-SEC-11, logout must clear all user-specific UI state. The implementation strategy is:

1. Each app's `main.ts` wiring registers a `clearUserSpecificStores()` helper
2. As feature stages add session-bound stores, they are added to this list
3. Both `logout()` and `expireSession()` call this helper

**Known session-bound stores at time of this stage (for initial implementation):**

- `auth.store` (cleared by `resetState()` already)
- Additional stores: per-app task to enumerate once feature stages land

This is **not a deferral of implementation** — it is recognition that the list is currently empty. The wiring must be in place from day one.

```typescript
// In main.ts or a dedicated session utilities file:
function clearUserSpecificStores(): void {
  // Each app enumerates its own session-bound stores here.
  // Feature stages that add session-bound stores MUST add their $reset() call here.
  // dashboardStore.$reset()  <- example
}
```

---

## 6. Sensitive Data Handling — Token Redaction Utility

**File**: `apps/*/src/core/auth/token-redact.ts` (NEW)

### Design

```typescript
/**
 * Token redaction utility.
 * Scrubs access token values from log objects before structured logging.
 *
 * Rules (FR-SEC-03, Constitutional token-opacity):
 * - Tokens must not appear in logs in full, partial, truncated, or hashed form.
 * - The only safe representation is complete omission: "[REDACTED]".
 * - No substring of the token value may survive.
 *
 * Pure function — zero runtime imports — safe to use in any test environment.
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 */

/** Well-known log fields that may contain token values. */
const SENSITIVE_KEYS = new Set([
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'authorization',
  'Authorization',
  'password',
  'credential',
])

const REDACTED = '[REDACTED]' as const

/**
 * Returns a shallow copy of `logObject` with sensitive fields replaced by "[REDACTED]".
 * Does not recurse into nested objects — callers are responsible for flattening.
 */
export function redactSensitiveFields<T extends Record<string, unknown>>(
  logObject: T
): T {
  const result = { ...logObject }
  for (const key of Object.keys(result)) {
    if (SENSITIVE_KEYS.has(key)) {
      result[key as keyof T] = REDACTED as unknown as T[keyof T]
    }
  }
  return result
}

/**
 * Type guard: returns true if the value looks like an access token string
 * (long base64url string). Used in tests to verify no token leaked.
 */
export function looksLikeToken(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return value.length > 20 && /^[A-Za-z0-9\-_=.]+$/.test(value)
}
```

### Export from `core/auth/index.ts` (all 3 apps)

```typescript
export { redactSensitiveFields, looksLikeToken } from './token-redact'
```

---

## 7. XSS Mitigation — Documentation Only

No new code files are required. The following is the enforcement baseline:

| Rule                                      | Enforcement Method                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| No `v-html` without sanitization          | `vue/no-v-html` ESLint rule (already configurable via `eslint-plugin-vue`) |
| No dynamic script injection               | ESLint `no-script-url` + code review                                       |
| No `eval()` / `Function()` with user data | ESLint `no-eval` + `no-new-func`                                           |
| Templates through Vue compiler only       | Architecture constraint — no server-side template injection possible       |

**Action**: Verify `vue/no-v-html` is enabled in `eslint.config.mjs`. If not yet enabled, enable it as a `warn` initially (will be upgraded to `error` once all existing `v-html` usages are audited). No new files needed.

---

## 8. 423/426 License Response Handling

### UI State Store Extension

Each app that already has a Pinia `ui` or `app` state store should add locked/upgrade flags. If no such store exists, a minimal `core/state/license-status.store.ts` is created per app.

```typescript
// core/state/license-status.store.ts (new, if no existing ui store)
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLicenseStatusStore = defineStore('licenseStatus', () => {
  const isWorkspaceLocked = ref(false) // 423
  const isUpgradeRequired = ref(false) // 426

  function setWorkspaceLocked(): void {
    isWorkspaceLocked.value = true
  }
  function setUpgradeRequired(): void {
    isUpgradeRequired.value = true
  }
  function clearLicenseStatus(): void {
    isWorkspaceLocked.value = false
    isUpgradeRequired.value = false
  }

  return {
    isWorkspaceLocked,
    isUpgradeRequired,
    setWorkspaceLocked,
    setUpgradeRequired,
    clearLicenseStatus,
  }
})
```

The root `App.vue` in each app reads these flags and renders the appropriate full-page message (e.g., `WorkspaceLocked.vue`, `UpgradeRequired.vue`). This follows the passive consumer pattern defined in the spec's License & Version Enforcement section.

**Rules enforced**:

- No retry on 423/426 (flags are set, not cleared until re-authentication/page reload)
- No license status cached in persistent storage
- No override attempt

---

## 9. Testing Strategy

### Unit Tests — Auth Store (`expireSession`)

**File**: extends existing `tests/unit/*/core/state/auth.store.test.ts`

| Test case                                   | Assertion                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `expireSession()` when authenticated        | clears token, sets `authError.code === 'AUTH_SESSION_EXPIRED'`, navigates to login |
| `expireSession()` when not authenticated    | no-op, no redirect, no authError set                                               |
| `expireSession()` called twice concurrently | executes once (idempotent)                                                         |

### Unit Tests — Error Interceptor

**File**: `tests/unit/*/core/api/interceptors/error.interceptor.test.ts`

| Test case                                                                      | Assertion                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `handleAuthFailure()` when `isAuthenticated = true`                            | calls `onSessionExpired`                                     |
| `handleAuthFailure()` when `isAuthenticated = false`                           | does NOT call `onSessionExpired`                             |
| `handleAuthFailure()` called twice with `isAuthenticated = true`               | `onSessionExpired` called exactly once (isHandling401 guard) |
| `handleAuthFailure()` `isHandling401` resets after `onSessionExpired` resolves | second call after first completes CAN trigger again          |
| `handleLicenseError(423)`                                                      | calls `onLicenseError` with 423                              |
| `handleLicenseError(426)`                                                      | calls `onLicenseError` with 426                              |

### Unit Tests — Token Redact

**File**: `tests/unit/*/core/auth/token-redact.test.ts`

| Test case                                          | Assertion                               |
| -------------------------------------------------- | --------------------------------------- |
| `redactSensitiveFields({ token: 'abc' })`          | returns `{ token: '[REDACTED]' }`       |
| `redactSensitiveFields({ accessToken: 'eyJ...' })` | returns `{ accessToken: '[REDACTED]' }` |
| `redactSensitiveFields({ safeField: 'value' })`    | returns unchanged object                |
| Known XSS token vectors                            | sensitive fields redacted               |
| `looksLikeToken('eyJhbGciOiJIUzI1...')`            | returns true                            |
| `looksLikeToken('hello')`                          | returns false                           |
| `looksLikeToken(42)`                               | returns false                           |

### Unit Tests — Route Guard Redirect Preservation

**File**: extends existing `tests/unit/*/core/router/guards/auth.guard.test.ts`

| Test case                                             | Assertion                                        |
| ----------------------------------------------------- | ------------------------------------------------ |
| Unauthenticated access to protected route             | redirect includes `query.redirect = to.fullPath` |
| Unauthenticated access with `preserveRedirect: false` | redirect has no query param                      |
| Authenticated access to protected route               | navigation passes through                        |

### Integration Tests — 401 Race Condition

**File**: `tests/integration/*/auth/401-race.test.ts`

| Test case                               | Assertion                                             |
| --------------------------------------- | ----------------------------------------------------- |
| 3 concurrent requests all return 401    | `onSessionExpired` called exactly once                |
| 401 on login endpoint (unauthenticated) | `onSessionExpired` NOT called; error passed to caller |

---

## 10. Idempotency: How `isHandling401` Prevents 401 Storm

The single-flight guarantee operates at two layers:

### Layer 1 — `packages/api-client/src/client.ts` (existing)

```
Request A returns 401 → refreshPromise = onRefreshToken()
Request B returns 401 → refreshPromise !== null → queued in requestQueue
Request C returns 401 → refreshPromise !== null → queued in requestQueue

refresh fails →
  onAuthFailure()   ← called ONCE
  requestQueue drained → all entries rejected with AUTH_REFRESH_FAILED
  refreshPromise = null
```

`onAuthFailure()` is called exactly once per refresh cycle, regardless of how many concurrent 401s arrive.

### Layer 2 — `error.interceptor.ts` `isHandling401` flag (new)

Even if `onAuthFailure` is somehow called twice (e.g., due to timing on no-refresh path), the `_isHandling401` flag inside `createErrorInterceptor` ensures:

```
Call 1: isHandling401 = false → set true → call onSessionExpired()
Call 2: isHandling401 = true  → log debug "duplicate dropped" → return
```

The flag is reset to `false` in the `finally` block after `onSessionExpired()` completes — meaning a completely new session cycle (after re-login) can trigger the flow again if needed.

### Layer 3 — `expireSession()` `isAuthenticated` guard (auth store)

```
isAuthenticated = true  → expiry flow runs
isAuthenticated = false → expireSession() is a no-op (already cleared)
```

All three layers are necessary:

- Layer 1 handles HTTP-level deduplication
- Layer 2 handles interceptor-level deduplication
- Layer 3 handles store-level idempotency for the unauthenticated-request pass-through

---

## No New Packages Required — Confirmation

All implementation uses:

| Package              | Use                                   |
| -------------------- | ------------------------------------- |
| `pinia` ^2.2.0       | auth store, license status store      |
| `vue-router` ^4.0.0  | route guard, navigation               |
| `@zidney/api-client` | API client factory, interceptor types |
| `@zidney/logger`     | structured logging in interceptors    |
| `vue`                | `ref()` in token manager (no change)  |

No additional packages are introduced.

---

## Implementation Order

1. `core/auth/token-redact.ts` + tests (zero dependencies, safe to create first)
2. `core/state/auth.store.ts` — add `expireSession()` action + tests
3. `core/api/interceptors/error.interceptor.ts` + tests
4. `core/api/client.ts` — extend `createAppApiClient` to accept `IErrorInterceptor`
5. `core/router/guards/auth.guard.ts` — add redirect preservation + tests
6. `core/state/license-status.store.ts` — new store per app (if needed)
7. `main.ts` — update wiring for `createErrorInterceptor` + `clearUserSpecificStores`
8. Verify `vue/no-v-html` ESLint rule in `eslint.config.mjs`
9. Run lint + type check across all three apps

Apply to MMC → Backoffice → Frontoffice in sequence.
