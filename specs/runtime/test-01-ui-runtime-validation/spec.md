# Validation Specification: STAGE_TEST_01_UI_RUNTIME_VALIDATION

**Feature Branch**: `spec/test-01-ui-runtime-validation`
**Created**: 2026-04-08
**Status**: Draft
**Type**: Validation Stage (NOT a feature stage)
**Phase**: 06_UI_APPLICATION_RUNTIME
**Purpose**: Verify architectural integrity, security, and correctness of the UI Runtime layer before Phase 06 can be marked VALIDATED.

---

## Executive Summary

This validation stage establishes that the Phase 06 UI Application Runtime architecture meets
non-negotiable integrity requirements across all three applications: **MMC**, **Backoffice**, and
**Frontoffice**.

This stage does not implement features. It validates existing implementations across the following
ten closed PRODUCTION READY stages:

| Stage ID    | Name                        | Status           |
| ----------- | --------------------------- | ---------------- |
| STAGE_UI_00 | Runtime Architecture        | PRODUCTION READY |
| STAGE_UI_01 | Auth Module                 | PRODUCTION READY |
| STAGE_UI_02 | API Client Layer            | PRODUCTION READY |
| STAGE_UI_03 | Router and Guards           | PRODUCTION READY |
| STAGE_UI_04 | Global Error Handling       | PRODUCTION READY |
| STAGE_UI_05 | Environment Configuration   | PRODUCTION READY |
| STAGE_UI_06 | State Management            | PRODUCTION READY |
| STAGE_UI_07 | Layout System Integration   | PRODUCTION READY |
| STAGE_UI_08 | Notification and Feedback   | PRODUCTION READY |
| STAGE_UI_09 | Security and Token Handling | PRODUCTION READY |

**Promotion gate**: Phase 06 cannot be marked VALIDATED until this stage passes all criteria.

Failure in any validation area blocks promotion.

---

## Clarifications

### Session 2026-04-08

- Q: Is the correlation ID header name standardized across MMC, Backoffice, and Frontoffice? → A: `X-Correlation-ID` — uniform across all three apps via the shared `@zidney/api-client` package (`applyCorrelationId()` in `packages/api-client/src/interceptors.ts`). The spec's earlier reference to `x-request-id` was incorrect.
- Q: What stores does `clearUserSpecificStores()` currently enumerate? → A: Empty stub in all three apps — no feature stores registered yet. `authStore` and `licenseStatusStore` are reset explicitly before the callback fires. Backoffice additionally owns `useBackofficeWorkspaceStore` (has `$reset()`); Frontoffice additionally owns `useAttemptStore`. Neither is yet registered.
- Q: What testing approach is available for this validation stage? → A: Vitest unit tests — existing `apps/*/src/core/guards/__tests__/*.spec.ts` and `apps/*/src/core/errors/__tests__/*.spec.ts`. Playwright E2E smoke tests — `apps/*/tests/e2e/smoke.spec.ts` per app plus `tests/e2e/app-load.spec.ts`. Areas 1–7, 9 use Vitest; Areas 8, 10 and browser-observable behaviors (XSS, token storage) use Playwright.
- Q: Do STAGE_UI_07 (Layout) and STAGE_UI_08 (Notifications) need dedicated validation areas? → A: No. STAGE_UI_07 Layout is covered implicitly by Area 8 Test 8.3 (layout re-render discipline). STAGE_UI_08 Notifications is covered implicitly by Tests 4.1, 4.2, and 3.2 which verify user-facing messages rendered through the notification system.

---

## Validation Objectives

1. Confirm token lifecycle security across all three apps (memory-only storage, redaction, isolation).
2. Confirm router guards enforce authentication and RBAC without bypassable paths.
3. Confirm the API client is the sole HTTP channel — no raw fetch/axios in app code.
4. Confirm global error handling normalizes to platform contract and never exposes internals.
5. Confirm store isolation across apps and correct reset on logout.
6. Confirm environment configuration correctly separates dev/production and contains no secrets in bundles.
7. Confirm XSS surface is closed (no v-html, input sanitization in place).
8. Confirm token and sensitive field redaction in all log paths.
9. Confirm production build is clean (no console errors, no runtime failures).
10. Confirm router navigation performance meets baseline.

---

## Area 1: Authentication and Token Validation

### Test 1.1: Expired Token Handling (CRITICAL)

**Objective**: Verify that an expired access token causes automatic logout and redirect with no
infinite retry loop.

**Validation Steps**:

1. Obtain a valid session with a short-lived access token.
2. Advance system time or use a token with `exp` in the past.
3. Trigger an authenticated API request.
4. Observe response code: **401 Unauthorized**.
5. Verify the auth store initiates logout (`expireSession()` or equivalent).
6. Verify router redirects to the login route (with `redirect` query param intact).
7. Verify no re-authentication retry loop executes (idempotency guard active — `isHandling401`).
8. Verify user is not shown a raw error message.

**Pass Criteria**:

- ✅ 401 causes logout and redirect within one cycle
- ✅ No re-authentication loop (guard fires once)
- ✅ Auth store state cleared after logout
- ✅ User lands on login route with preserved `redirect` query parameter
- ✅ No token value printed in logs or console

**Fail Criteria**:

- ❌ 401 causes infinite retry
- ❌ User remains on protected route after token expiry
- ❌ Auth store retains stale token after logout
- ❌ Token value appears in browser console or log output

---

### Test 1.2: Tampered Token Handling (CRITICAL)

**Objective**: Verify that a token with a modified payload payload is rejected and triggers logout.

**Validation Steps**:

1. Obtain a valid JWT access token.
2. Decode the token, modify the `sub` or `workspaceId` claim, re-encode (without valid signature).
3. Inject the tampered token into the in-memory token store.
4. Trigger an authenticated API request.
5. Observe server returns **401 Unauthorized**.
6. Verify the error interceptor handles the 401 identically to Test 1.1.

**Pass Criteria**:

- ✅ Server rejects tampered token with 401
- ✅ Client handles 401 correctly (no loop, logout, redirect)
- ✅ No partial data returned before rejection

**Fail Criteria**:

- ❌ Server accepts tampered token
- ❌ Client does not detect or handle 401 from tampered token

---

### Test 1.3: Cross-Workspace Token Isolation (CRITICAL)

**Objective**: Verify that a valid token from Workspace A cannot access Workspace B resources.

**Validation Steps**:

1. Authenticate as a user in Workspace A. Capture their access token.
2. As a separate client session, attempt authenticated requests to Workspace B endpoints using
   Workspace A's token.
3. Verify the API returns **403 Forbidden** or **404 Not Found** (resolver rejection).
4. Verify no Workspace B data appears in the response.
5. Verify the token is not automatically reused in the Workspace B client session.

**Pass Criteria**:

- ✅ Response is 403 or 404 — never 200 with Workspace B data
- ✅ No cross-workspace data leakage in response body
- ✅ Workspace A token is not stored/shared with Workspace B client instance

**Fail Criteria**:

- ❌ API returns 200 with Workspace B data when using Workspace A token
- ❌ Any Workspace B data appears in response under cross-workspace request

---

### Test 1.4: Token Storage Policy Compliance

**Objective**: Confirm tokens are stored exclusively in memory (no localStorage, no
sessionStorage, no cookies).

**Validation Steps**:

1. After login, inspect `localStorage` and `sessionStorage` — must contain no token values.
2. Inspect browser cookies — must contain no Bearer token values.
3. Audit `token-manager.ts` in all three apps for storage writes.
4. Run the `token-persistence-audit` test suite (from STAGE_UI_09 deliverables).
5. Confirm no token is printed to `console.log`, `console.error`, or structured logger.

**Pass Criteria**:

- ✅ `localStorage` and `sessionStorage` contain no access token after login
- ✅ No cookie contains raw token value
- ✅ `token-persistence-audit` tests pass in all three apps
- ✅ `redactSensitiveFields` utility active on all logger paths
- ✅ `looksLikeToken` regex correctly identifies and redacts token-shaped strings

**Fail Criteria**:

- ❌ Any token value found in persistent storage
- ❌ Token printed in any log or console output

---

## Area 2: Router and Guard Validation

### Test 2.1: Route Protection — Unauthenticated Access (CRITICAL)

**Objective**: Confirm that all protected routes reject unauthenticated users and redirect to login.

**Validation Steps**:

1. Clear all auth state (no token in memory, no session).
2. Attempt direct navigation to a protected route (e.g., `/dashboard`, `/settings`, `/exam`).
3. Verify router guard intercepts navigation before the component renders.
4. Verify redirect to the login route occurs.
5. Verify `redirect` query parameter on login URL reflects the originally requested path.

**Pass Criteria**:

- ✅ Protected route not rendered for unauthenticated user
- ✅ Navigation redirected to login with `redirect` param
- ✅ Guard fires before component lifecycle hooks

**Fail Criteria**:

- ❌ Protected component mounts before guard check completes
- ❌ No redirect occurs; user sees blank/broken page
- ❌ `redirect` param missing or incorrect after guard redirect

---

### Test 2.2: Role-Based Guard — Admin Route Access Denial

**Objective**: Confirm that non-admin users cannot access admin-only routes.

**Validation Steps**:

1. Authenticate as a non-admin user (e.g., standard staff or student role).
2. Attempt direct navigation to an admin-only route (e.g., backoffice settings for tenant
   configuration).
3. Verify guard detects insufficient role.
4. Verify redirect or 403 page is shown.
5. Authenticate as admin user and confirm access is granted.

**Pass Criteria**:

- ✅ Non-admin denied access to admin route
- ✅ Admin user can navigate the same route
- ✅ RBAC guard logic reads from auth store (not direct API call at navigation time)

**Fail Criteria**:

- ❌ Non-admin user successfully navigates to admin route
- ❌ Role check occurs after component mounts

---

### Test 2.3: License State Route Handling

**Objective**: Confirm that license-gated routes respond correctly to 423 (SOFT_LOCKED) and 426
(UPGRADE_REQUIRED) status codes.

**Validation Steps**:

1. Simulate an API response of **423 Locked** for a workspace-gated request.
2. Verify the global error interceptor updates `licenseStatusStore` with `SOFT_LOCKED`.
3. Verify the router redirects to (or renders) the correct license-locked screen.
4. Simulate **426 Upgrade Required** and verify `UPGRADE_REQUIRED` state is reflected.
5. Confirm the license status store is cleared on logout.

**Pass Criteria**:

- ✅ 423 triggers `SOFT_LOCKED` state in license store
- ✅ 426 triggers `UPGRADE_REQUIRED` state in license store
- ✅ Router renders the correct interstitial screen for each state
- ✅ License store cleared on logout

**Fail Criteria**:

- ❌ 423 or 426 causes unhandled error or blank screen
- ❌ License store not updated on license status codes
- ❌ License state persists after logout

---

## Area 3: API Client Layer Validation

### Test 3.1: Centralized Client Enforcement — No Raw HTTP Calls (CRITICAL)

**Objective**: Confirm that no application code uses raw `fetch()` or `axios` outside the
centralized API client factory.

**Validation Steps**:

1. Static scan of `apps/mmc/src`, `apps/backoffice/src`, `apps/frontoffice/src` for:
   - `fetch(` (raw fetch calls)
   - `axios.get(`, `axios.post(`, etc. (direct axios usage)
   - `new XMLHttpRequest(` (legacy HTTP)
2. Verify scan yields zero results (excluding the API client factory internals and test mocks).
3. Confirm all HTTP calls originate from the `createApiClient()` factory instance.

**Pass Criteria**:

- ✅ Zero raw `fetch()` / `axios()` calls in app source code (outside API client package)
- ✅ All API interactions go through the centralized API client instance
- ✅ Test mocks are clearly isolated from production code paths

**Fail Criteria**:

- ❌ Any raw `fetch()` or `axios()` call found outside the API client factory

---

### Test 3.2: Global HTTP Error Mapping

**Objective**: Confirm all standard HTTP error codes are normalized by the API client interceptor.

**Validation Steps**:

For each status code, simulate the API returning that code and verify the client-side handling:

| Status Code | Scenario              | Expected Client Behavior                                     |
| ----------- | --------------------- | ------------------------------------------------------------ |
| 401         | Unauthorized          | Auth expiry flow triggered, logout, redirect to login        |
| 403         | Forbidden             | Normalized error with user-facing denial message             |
| 423         | Locked                | `licenseStatusStore` set to `SOFT_LOCKED`                    |
| 426         | Upgrade Required      | `licenseStatusStore` set to `UPGRADE_REQUIRED`               |
| 429         | Rate Limit            | User-facing "too many requests" message, no crash            |
| 500         | Internal Server Error | Generic fallback displayed, error logged with correlation ID |

**Pass Criteria**:

- ✅ Each status code handled as described above
- ✅ No unhandled promise rejections in any scenario
- ✅ User never sees raw HTTP status codes in the UI

**Fail Criteria**:

- ❌ Any status code causes unhandled exception or blank screen
- ❌ Raw status codes or stack traces exposed to user

---

### Test 3.3: Correlation ID Propagation

**Objective**: Confirm that outgoing API requests include a correlation/request ID header for
distributed tracing.

**Validation Steps**:

1. Trigger an API request from each of the three apps.
2. Inspect the outgoing HTTP headers.
3. Verify `X-Correlation-ID` header is present and non-empty.
4. Verify the correlation ID is included in error log entries when a request fails.

**Pass Criteria**:

- ✅ Correlation ID header present on all outgoing requests from all three apps
- ✅ Failed requests log the correlation ID alongside the error

**Fail Criteria**:

- ❌ Requests missing correlation ID header
- ❌ Error log entries missing request correlation reference

> **Resolved (2026-04-08)**: Header name is `X-Correlation-ID` across all three apps. All apps call `createApiClient()` from the shared `@zidney/api-client` package; `applyCorrelationId()` in `packages/api-client/src/interceptors.ts` writes `headers['X-Correlation-ID'] = correlationId ?? crypto.randomUUID()`. There is no per-app variation.

---

## Area 4: Global Error Handling Validation

### Test 4.1: RFC 7807 Error Normalization (CRITICAL)

**Objective**: Confirm API error responses following RFC 7807 ("Problem Details") are correctly
parsed and normalized into user-safe messages.

**Validation Steps**:

1. Return an RFC 7807 response from a mock API endpoint:
   ```json
   {
     "type": "https://errors.zidney.com/validation-error",
     "title": "Validation Failed",
     "status": 422,
     "detail": "The field 'email' is required.",
     "instance": "/api/students"
   }
   ```
2. Verify the app extracts `title` and `detail` but does not expose `type`, `instance`, or any
   internal stack details.
3. Verify the user-facing notification/toast shows a safe, localized message.
4. Verify the original error object is available in the error log (for debugging), but not in any
   rendered DOM element.

**Pass Criteria**:

- ✅ `detail` field rendered as user-facing message
- ✅ `type` and `instance` fields NOT rendered in UI
- ✅ No raw JSON visible to user
- ✅ Full error object logged with correlation ID

**Fail Criteria**:

- ❌ Internal fields (`type`, `instance`, stack trace) rendered in UI
- ❌ Raw JSON dumped to screen on error

---

### Test 4.2: Unknown Error / Network Failure Fallback

**Objective**: Confirm that network failures and non-standard errors display a safe generic fallback
screen.

**Validation Steps**:

1. Simulate a network failure (DNS timeout, connection refused) during an API request.
2. Verify the app does not crash or show a blank white screen.
3. Verify a generic "Something went wrong" (or localized equivalent) fallback is displayed.
4. Simulate an error that returns no body (empty 500 response).
5. Verify the same fallback is displayed.

**Pass Criteria**:

- ✅ Network failures produce a user-facing fallback message
- ✅ App does not crash on unhandled network errors
- ✅ No stack trace visible in fallback screen

**Fail Criteria**:

- ❌ Blank screen on network failure
- ❌ Stack trace visible on fallback screen
- ❌ App crashes (unhandled Vue error boundary event)

---

## Area 5: State Management Validation

### Test 5.1: Store Isolation Across Apps (CRITICAL)

**Objective**: Confirm that each app (MMC, Backoffice, Frontoffice) has its own isolated Pinia store
instance with no shared state between apps.

**Validation Steps**:

1. Inspect Pinia setup in each app's `main.ts`.
2. Verify each app creates its own `pinia` instance (not a singleton exported from a shared package).
3. Verify no store is imported directly between apps.
4. At runtime, confirm that authenticating in MMC does not affect Backoffice auth state (and vice
   versa).

**Pass Criteria**:

- ✅ Each app has its own `createPinia()` instance
- ✅ No shared store singleton imported across apps
- ✅ Auth state in App A does not affect App B at runtime

**Fail Criteria**:

- ❌ Shared Pinia instance across apps
- ❌ Any cross-app store state mutation detected

---

### Test 5.2: Logout State Reset (CRITICAL)

**Objective**: Confirm that all user-specific store state is cleared on logout.

**Validation Steps**:

1. Authenticate and navigate through several pages (loading data into stores).
2. Trigger logout (via UI or programmatic `auth.store.logout()`).
3. Inspect the following stores post-logout:
   - `authStore`: `user` is null, `accessToken` is null
   - `licenseStatusStore`: reset to initial state
   - Any user-specific feature stores (as enumerated by `clearUserSpecificStores()`)
4. Verify no stale data remains in any store.
5. Verify the next login reinitializes stores from fresh API data.

**Pass Criteria**:

- ✅ `authStore.user` is null after logout
- ✅ `licenseStatusStore` reset after logout
- ✅ `clearUserSpecificStores()` callback fires and clears all user-scoped stores
- ✅ No stale data observable after next login

**Fail Criteria**:

- ❌ Any user-scoped data persists after logout
- ❌ Previous user's data briefly visible on re-login

> **Resolved (2026-04-08)**: `clearUserSpecificStores()` is currently an **empty stub** in all three apps — no feature stores are yet registered. Each app's `onSessionExpired` callback explicitly resets `authStore` (via `expireSession()`) and `licenseStatusStore` before calling the stub. Stores that exist but are not yet registered: **Backoffice** — `useBackofficeWorkspaceStore` (has `$reset()`); **Frontoffice** — `useAttemptStore`. Test 5.2 scope: confirm the callback executes (no-op is acceptable), `authStore.user` is null, and `licenseStatusStore` is reset. Feature store coverage grows as future stages land.

---

### Test 5.3: No Business Logic in UI Components

**Objective**: Confirm that Vue component files do not contain direct API calls or business rule
logic; all such logic is delegated to service layer or composables.

**Validation Steps**:

1. Static scan of `*.vue` files in all three apps for:
   - Direct `apiClient.get()` / `apiClient.post()` calls inside `<script setup>`
   - Inline business validation (beyond form validation rules)
2. Confirm that API calls in components are always delegated to a composable, service, or store
   action.

**Pass Criteria**:

- ✅ No direct API client calls in `.vue` component `<script setup>` blocks
- ✅ All data fetching delegated to composables or store actions

**Fail Criteria**:

- ❌ Direct API client instantiation or calls inside component `<script setup>`

---

## Area 6: Environment Configuration Validation

### Test 6.1: Environment Separation

**Objective**: Confirm that dev and production API URLs are different and no secrets are bundled
into the production client build.

**Validation Steps**:

1. Build the app for the `development` environment and capture `VITE_API_BASE_URL` (or equivalent).
2. Build the app for the `production` environment and capture the same variable.
3. Verify the two values differ.
4. Inspect the production bundle output (`dist/`) — confirm no API secrets, private keys, or
   passwords are present as plain text.
5. Confirm `.env.production` is not committed to the repository.

**Pass Criteria**:

- ✅ Dev and production API base URLs differ
- ✅ No private keys, passwords, or API secrets in production bundle
- ✅ `.env.production` not tracked in git

**Fail Criteria**:

- ❌ Same API URL in dev and production
- ❌ Any secret string found in production bundle dist files
- ❌ `.env.production` committed to git history

---

### Test 6.2: Production Build Integrity

**Objective**: Confirm the production build completes successfully with no runtime errors.

**Validation Steps**:

1. Run `bun run build` (or equivalent) for MMC, Backoffice, and Frontoffice in production mode.
2. Verify all three builds exit with code **0**.
3. Serve the production build locally and open in a browser.
4. Verify no errors appear in browser console.
5. Verify TypeScript type check passes (`bun run typecheck`) for all three apps.
6. Verify lint passes (`bun run lint`) for all three apps.

**Pass Criteria**:

- ✅ All three production builds exit 0
- ✅ Browser console shows no errors on initial load
- ✅ TypeScript typecheck exits 0 for all apps
- ✅ Lint exits 0 for all apps

**Fail Criteria**:

- ❌ Any build fails
- ❌ Console errors on production build load
- ❌ Type errors in any app

---

## Area 7: Security Validation

### Test 7.1: XSS Surface Check (CRITICAL)

**Objective**: Confirm that user-controllable input cannot inject executable HTML/JS via the UI.

**Validation Steps**:

1. Identify all text input fields and dynamic content rendering areas in MMC, Backoffice, and
   Frontoffice.
2. Inject a basic XSS payload as input: `<script>alert('xss')</script>` and
   `<img src=x onerror=alert(1)>`.
3. Verify the rendered DOM shows the escaped string (e.g., `&lt;script&gt;`), not an executed script.
4. Confirm ESLint rule `vue/no-v-html` is enforced as `error` across all three apps.
5. Scan all `.vue` files for any `v-html` directive usage — must yield zero results.

**Pass Criteria**:

- ✅ XSS payload rendered as escaped text, not executed
- ✅ `vue/no-v-html` ESLint rule active at error severity in all three apps
- ✅ Zero `v-html` directive usages in all Vue SFCs

**Fail Criteria**:

- ❌ XSS payload executes in browser (script alert fires or `onerror` handler runs)
- ❌ Any `v-html` directive present in production Vue components
- ❌ `vue/no-v-html` rule missing or set below `error` severity

---

### Test 7.2: Logging Redaction

**Objective**: Confirm that tokens, passwords, and other sensitive strings are never logged.

**Validation Steps**:

1. Trigger a login flow and an API error while monitoring all logger output.
2. Verify `redactSensitiveFields()` utility is applied to all structured log calls.
3. Verify `looksLikeToken()` regex correctly identifies and replaces token-shaped strings with
   `[REDACTED]`.
4. Search logger output for common token patterns:
   - JWT format: `eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+`
   - Bearer-prefixed strings
5. Confirm zero matches in log output.

**Pass Criteria**:

- ✅ No JWT or bearer token strings in any log output
- ✅ `redactSensitiveFields` applied at all logger call sites
- ✅ `looksLikeToken` redaction tests passing in all three apps

**Fail Criteria**:

- ❌ Any token, password, or credential appears unredacted in logs

---

## Area 8: Performance Baseline

### Test 8.1: Router Navigation Latency

**Objective**: Confirm client-side route transitions complete within the acceptable latency budget.

**Validation Steps**:

1. Instrument router `beforeEach` and `afterEach` hooks with `performance.now()` timestamps.
2. Measure 10 consecutive navigations between routes in each app.
3. Calculate average and p95 navigation time.
4. Target: **p95 < 50ms** (guard evaluation + component mount, not API data loading time).

**Pass Criteria**:

- ✅ Router navigation p95 < 50ms across all three apps
- ✅ No navigation event causes a > 200ms spike during normal app usage

**Fail Criteria**:

- ❌ p95 navigation time exceeds 50ms
- ❌ Any navigation spike exceeds 200ms without API data fetch as the cause

---

### Test 8.2: API Client Overhead

**Objective**: Confirm the API client interceptor chain does not introduce significant latency
overhead beyond the network round-trip.

**Validation Steps**:

1. Measure raw network request time to API (baseline).
2. Measure API client request time including interceptor chain processing.
3. Calculate overhead: client time minus network time.
4. Verify client interceptor overhead is **< 5ms** on average.

**Pass Criteria**:

- ✅ API client interceptor overhead < 5ms on average

**Fail Criteria**:

- ❌ Interceptor chain adds > 5ms overhead per request at rest

---

### Test 8.3: Core Layout Re-render Discipline

**Objective**: Confirm the core layout and shell components do not trigger unnecessary re-renders.

**Validation Steps**:

1. Using Vue DevTools or a performance profiler, monitor component re-render events during route
   navigation.
2. Verify the shell/layout component does not re-mount on every navigation (only child view swaps).
3. Verify `AuthUser` data properties are not reactive in contexts where they don't need to be.

**Pass Criteria**:

- ✅ Layout component does not re-mount on route navigation
- ✅ No reactive thrashing in auth store during normal navigation

**Fail Criteria**:

- ❌ Layout component full re-mount on every route change
- ❌ Auth store triggers cascading re-renders on navigation

---

## Pass Criteria Summary

This stage is **PASSED** when all of the following are confirmed:

| Criterion                                                  | Area     | Blocking |
| ---------------------------------------------------------- | -------- | -------- |
| Expired token causes logout + redirect, no loop            | Auth     | ✅ Yes   |
| Tampered token rejected, 401 handled correctly             | Auth     | ✅ Yes   |
| Cross-workspace token isolation enforced                   | Auth     | ✅ Yes   |
| Token stored in memory only — no persistent storage writes | Auth     | ✅ Yes   |
| Unauthenticated access to protected routes redirects       | Router   | ✅ Yes   |
| Non-admin users denied admin routes                        | Router   | ✅ Yes   |
| 423 / 426 license codes handled and routed correctly       | Router   | ✅ Yes   |
| No raw fetch/axios calls outside API client factory        | API      | ✅ Yes   |
| All HTTP error codes (401–500) handled without crash       | API      | ✅ Yes   |
| RFC 7807 errors normalized, internals not exposed          | Errors   | ✅ Yes   |
| Network failures show safe fallback                        | Errors   | ✅ Yes   |
| Pinia stores isolated per app                              | State    | ✅ Yes   |
| All user state cleared on logout                           | State    | ✅ Yes   |
| No direct API calls in Vue component script blocks         | State    | No       |
| Dev/production API URL separation confirmed                | Env      | ✅ Yes   |
| No secrets in production bundle                            | Env      | ✅ Yes   |
| Production build exits 0 for all three apps                | Env      | ✅ Yes   |
| XSS payloads escaped, v-html absent, ESLint enforced       | Security | ✅ Yes   |
| Token redaction active in all logger paths                 | Security | ✅ Yes   |
| Router navigation p95 < 50ms                               | Perf     | No       |
| API client interceptor overhead < 5ms                      | Perf     | No       |
| Layout component does not re-mount on navigation           | Perf     | No       |

Any blocking criterion failure prevents Phase 06 promotion to VALIDATED.

---

## Assumptions

1. All ten STAGE_UI_00 through STAGE_UI_09 stages are PRODUCTION READY at the time this validation
   runs.
2. The `token-persistence-audit` test suite from STAGE_UI_09 is runnable via the standard
   `bun run test` command in each app.
3. ESLint is enforced at CI level, so any `vue/no-v-html` violation would already have been
   caught; this validation stage performs a secondary confirmation scan.
4. Performance measurements are taken on a local development machine under normal load, not under
   production traffic. Absolute timings are indicative; the baseline targets are conservative.
5. The `clearUserSpecificStores()` stub is currently **empty** in all three apps as of STAGE_UI_09. No feature stores are yet registered. Backoffice uniquely has `useBackofficeWorkspaceStore` (with `$reset()`); Frontoffice has `useAttemptStore`. Neither is registered in the callback yet. Full enumeration grows as feature stages land.
6. RFC 7807 is the expected error format for all structured API errors in the Zidney API layer.
7. The correlation ID header name is confirmed as `X-Correlation-ID` across all three apps, injected by `applyCorrelationId()` in `packages/api-client/src/interceptors.ts`.

---

## Out of Scope

- Backend API validation (covered by `STAGE_TEST_01_PLATFORM_FOUNDATION`)
- Database integrity checks (not applicable to UI layer)
- Mobile app validation (not in Phase 06)
- CI/CD pipeline validation (covered in infra stages)
- Refresh token strategy (deferred per STAGE_UI_09)
- 2FA flows, OAuth flows (deferred per STAGE_UI_09)
- Full RBAC permission matrix testing (covered in role/permission feature stages)

---

## Needs Clarification

All items resolved via codebase search on 2026-04-08. See `## Clarifications` section above for
full resolutions and `## Assumptions` for updated facts.

---

## Stage Promotion Gate

Upon successful completion of all blocking criteria:

1. Update `STAGE_TEST_01_UI_RUNTIME_VALIDATION.md` status to `VALIDATED`.
2. Update Phase 06 promotion status in `PHASE_6_OVERVIEW.md`.
3. All validation evidence (test run outputs, scan results, build logs) must be archived in
   `specs/runtime/test-01-ui-runtime-validation/reports/`.
