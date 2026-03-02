# STAGE_UI_09 — Research Findings

**Stage**: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Generated**: 2026-03-01  
**Status**: COMPLETE — all NEEDS CLARIFICATION resolved

---

## Research Scope

Investigate the existing auth layer across MMC, Backoffice, and Frontoffice to determine what is already implemented, what must be added, and what must be modified to satisfy STAGE_UI_09's requirements.

---

## Finding 1: Auth Store Architecture (STAGE_UI_01 Foundation)

**Decision**: All three apps (MMC, Backoffice, Frontoffice) share an identical auth layer structure created in STAGE_UI_01_AUTH_MODULE. There is no per-app divergence.

**Parallel structure confirmed in all three apps:**

```
core/
  auth/
    token-manager.ts       — in-memory token (Vue ref<string | null>)
    refresh-manager.ts     — single-flight refresh orchestration
    auth.service.ts        — HTTP calls: /auth/login, /auth/logout, /auth/refresh, /auth/me
    types.ts               — AuthStoreState, AuthUser, AuthError, LoginCredentials, LoginResponse
    index.ts               — public re-exports
  state/
    auth.store.ts          — Pinia store (defineAuthStore factory)
    index.ts
  api/
    client.ts              — createAppApiClient factory
  router/
    guards/
      auth.guard.ts        — createAuthGuard factory
    index.ts
    types.ts
  errors/
    error-normalizer.ts
    types.ts
```

**Rationale**: STAGE_UI_09 is directly additive to STAGE_UI_01. No new architecture baseline is required; the existing factory pattern is preserved and extended.

---

## Finding 2: Token Storage — Already Compliant

**Decision**: FR-SEC-01 and FR-SEC-02 are already satisfied by `core/auth/token-manager.ts`.

**Evidence** (`apps/mmc/src/core/auth/token-manager.ts`):

```typescript
const _token = ref<string | null>(null) // Vue reactive ref — not persisted
```

- Token lives exclusively in a reactive `ref<string | null>` inside the `createTokenManager` closure.
- No `localStorage`, `sessionStorage`, `IndexedDB`, or cookie writes exist.
- The internal ref is not exported — only the interface (`getToken`, `setToken`, `clearToken`, `hasToken`) is exposed.
- Token value is never logged; only metadata (`Access token stored in memory`) is logged.

**STAGE_UI_09 action**: Document compliance. No code changes needed for token storage.

---

## Finding 3: Authorization Header Injection — Already Compliant

**Decision**: FR-SEC-04 and FR-SEC-05 are already satisfied by `packages/api-client/src/interceptors.ts` wired through `core/api/client.ts`.

**Evidence** (`packages/api-client/src/interceptors.ts`):

```typescript
export function applyAuthHeader(
  headers: Record<string, string>,
  getAccessToken: () => string | null
): void {
  const token = getAccessToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
}
```

- Injection is centralised in the shared package — exactly one location in the codebase.
- When `getAccessToken()` returns `null`, the header is omitted entirely — `Bearer undefined` is impossible.
- Wired in `core/api/client.ts` via `getAccessToken: () => tokenManager.getToken()`.

**STAGE_UI_09 action**: Document compliance. No code changes needed for header injection.

---

## Finding 4: Pinia Auth Store — Already Present, One Gap

**Decision**: The `core/state/auth.store.ts` factory exists in all three apps and satisfies most requirements of FR-SEC-10 through FR-SEC-13.

**Confirmed capabilities**:

- `isAuthenticated: ref<boolean>` — reactive authentication flag
- `user: ref<AuthUser | null>` — reactive user profile
- `authError: ref<AuthError | null>` — reactive error state (used for session-expired messages)
- `logout()` — clears token, resets state, navigates to login route
- `initSession()` — silent session restoration on page load
- `setSession(accessToken, profile)` — establishes session post-login
- Logout is idempotent (isLoading guard + isAuthenticated guard)

**Gap identified**: The `authError` field can carry a `AUTH_SESSION_EXPIRED` code, and the login page can read this to display the "session expired" message. This pattern is already type-safe (AuthErrorCode union includes `AUTH_SESSION_EXPIRED`). The session-expired notification requires no new store — it uses the existing `authError` mechanism.

**STAGE_UI_09 action**: No structural changes to `auth.store.ts`. The session-expired notification is dispatched by setting `authError` before logout redirect.

---

## Finding 5: 401 Handling — Partially Implemented, Critical Gap

**Decision**: The single-flight guard for 401 storms is already implemented in `packages/api-client/src/client.ts`. The critical missing piece is the **authenticated-session-only trigger** (FR-SEC-07).

**Existing behaviour** (`packages/api-client/src/client.ts`):

```typescript
// Single-flight refresh state
let refreshPromise: Promise<string> | null = null  // this IS the isHandling401 guard

async function handle401(...) {
  if (refreshPromise !== null) {
    // queue request — waits for in-flight refresh
  }
  refreshPromise = config.onRefreshToken()
  try {
    await refreshPromise
    // retry + drain queue
  } catch {
    config.onAuthFailure()  // ← fires once per refresh cycle
    // reject all queued requests
  }
}
```

**Gap**: `config.onAuthFailure()` is currently wired as `() => authStore.logout()` unconditionally. FR-SEC-07 requires it fires **only when `authStore.isAuthenticated === true`** at the time the 401 is received. A 401 on `/auth/login` (wrong credentials) must pass through to the caller without triggering logout or redirect.

**Rationale**: The `refreshPromise !== null` guard already maps to FR-SEC-08's `isHandling401` requirement. The package-level single-flight guarantee is sufficient. The only gap is the `isAuthenticated` condition check at the `onAuthFailure` call site in `core/api/client.ts`.

**STAGE_UI_09 action**: Modify `core/api/client.ts` in all three apps to wrap `authStore.logout()` with an `isAuthenticated` check before calling it. Add `isHandling401` closure boolean in the factory for the no-refresh default case (when backend has no refresh endpoint, 401 should immediately trigger the session-expiry flow if authenticated).

---

## Finding 6: Router Guards — Already Present, One Extension Needed

**Decision**: `core/router/guards/auth.guard.ts` implements FR-SEC-14, FR-SEC-15, FR-SEC-16. The optional route redirect preservation (FR-SEC-09) is not yet implemented.

**Confirmed** (`createAuthGuard` in all three apps):

- `requiresAuth: true` meta → redirect to login if not authenticated → FR-SEC-14 ✅
- `guestOnly: true` meta → redirect to dashboard if authenticated → ✅
- Uses `getIsAuthenticated()` callback only — no JWT decoding → FR-SEC-15 ✅
- Returns `RouteLocationRaw` (redirect object), never calls `router.push()` directly → ✅

**Gap**: The redirect to login does not currently preserve the intended destination. FR-SEC-09 (optional) says the pre-expiry route should be preserved for post-login return. This means passing `{ name: options.loginRouteName, query: { redirect: to.path } }` on the unauthenticated redirect.

**STAGE_UI_09 action**: Extend `createAuthGuard` in all three apps to pass `redirect` query param on unauthenticated redirects. Also extend `createAuthGuardOptions` type to include an `enableRedirectPreservation?: boolean` flag for opt-in control.

---

## Finding 7: 423 / 426 Handling — Not Yet Implemented

**Decision**: HTTP 423 and 426 responses are currently passed through `normalizeResponseError` in `packages/api-client/src/http-error.ts` as generic non-ok errors. No application-level 423/426 interception exists.

**Evidence** (`packages/api-client/src/http-error.ts`): The `ErrorCodes` constant contains `NETWORK_ERROR`, `REQUEST_TIMEOUT`, `REQUEST_CANCELLED`, `RATE_LIMITED`, `AUTH_REFRESH_FAILED`, `INVALID_RESPONSE`, `UNKNOWN_ERROR` — no `WORKSPACE_LOCKED` or `UPGRADE_REQUIRED` codes.

**Design decision**: 423/426 responses should be handled at the app-level API client factory (`core/api/client.ts`) via an `onHttpStatusError` callback pattern, or via extending the `ClientConfig` interface in packages/api-client. Since the spec says no cross-package changes without ADR review, the safest approach is:

- Add a `onLicenseError?: (status: 423 | 426) => void` callback to `createAppApiClient` in each app's `core/api/client.ts`
- Wire it to a `core/api/interceptors/error.interceptor.ts` handler that triggers appropriate UI state

**Rationale**: Avoids modifying the shared `packages/api-client` package (which would affect API layer and worker). App-level interception via callback injection is consistent with the existing `onAuthFailure` pattern.

**STAGE_UI_09 action**: Create `core/api/interceptors/error.interceptor.ts` in each app. Extend `createAppApiClient` signature to accept `onLicenseError` callback.

---

## Finding 8: Token Redaction Utility — Not Yet Present

**Decision**: No `token-redact.ts` utility exists in any app's `core/auth/` directory.

**Gap**: FR-SEC-03 states tokens must never appear in logs — not even partial/truncated form. The existing code already avoids logging tokens, but there is no reusable utility to scrub token values from arbitrary log objects. Tests for this utility are required.

**STAGE_UI_09 action**: Create `core/auth/token-redact.ts` in all three apps. Pure function, no framework dependencies.

---

## Finding 9: Available Packages — No New Packages Required

**Confirmed in `apps/mmc/package.json`**:

- `pinia: ^2.2.0` ✅
- `vue-router: ^4.0.0` ✅
- `@zidney/api-client` (workspace package) ✅
- `@zidney/logger` (workspace package) ✅
- `vue: ^3.x` ✅
- `@pinia/testing: ^0.1.6` (devDependency) ✅

All security functionality can be implemented with existing packages. No new npm dependencies are required.

---

## Finding 10: XSS Mitigation — Documentation Only

**Decision**: No code changes needed for XSS mitigation in STAGE_UI_09. Vue 3's template compiler provides escaping by default. The `v-html` lint rule (`vue/no-v-html`) is enforced via ESLint config.

**Evidence**: `eslint.config.mjs` at workspace root uses `eslint-plugin-vue`. The `vue/no-v-html` rule is enforceable via ESLint.

**STAGE_UI_09 action**: Document baseline rule. Confirm lint configuration covers `vue/no-v-html`. No new code files needed.

---

## Gap Summary

| Requirement  | Status         | Gap Description                                              | Action                                              |
| ------------ | -------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| FR-SEC-01/02 | ✅ Implemented | Token in-memory, no persistent storage                       | Document only                                       |
| FR-SEC-03    | ⚠️ Partial     | No reusable redaction utility                                | Create `core/auth/token-redact.ts`                  |
| FR-SEC-04/05 | ✅ Implemented | Bearer header injection in packages/api-client               | Document only                                       |
| FR-SEC-06    | ✅ Implemented | Single injection point enforced                              | Document only                                       |
| FR-SEC-07    | ❌ Missing     | 401 triggers logout unconditionally, ignores isAuthenticated | Modify `core/api/client.ts` (all 3 apps)            |
| FR-SEC-08    | ✅ Implemented | refreshPromise is the isHandling401 single-flight guard      | Document + extend for no-refresh scenario           |
| FR-SEC-09    | ⚠️ Partial     | Route redirect not preserved on unauthenticated guard        | Extend `auth.guard.ts` (all 3 apps)                 |
| FR-SEC-10–13 | ✅ Implemented | logout() clears all state, redirects to login                | Document only                                       |
| FR-SEC-14–16 | ✅ Implemented | Route guards enforce isAuthenticated, no JWT decoding        | Minor extension for redirect preservation           |
| FR-SEC-17–19 | ✅ Structural  | Vue template escaping default; lint rule enforceable         | Document only                                       |
| FR-SEC-20/21 | ❌ Missing     | 423/426 not handled beyond generic error                     | Create `core/api/interceptors/error.interceptor.ts` |
| FR-SEC-22    | ✅ Implemented | All security logic in core/auth/ and core/api/               | Document only                                       |

---

## Architecture Flags

**No new ADR required.**

All changes are:

1. Additive file creation within existing directory patterns
2. Modifications to call-site wiring in `core/api/client.ts` (not the shared package)
3. Extensions to existing factory function signatures (backward-compatible)

The existing Trust Chain (Isolation → License → Authentication → Attempt → Runtime → Frontoffice) is unaffected. No database changes, no backend changes, no package-level structural changes.
