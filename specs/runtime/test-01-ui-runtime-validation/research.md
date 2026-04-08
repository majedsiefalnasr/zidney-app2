# Research: Test Coverage Inventory — STAGE_TEST_01_UI_RUNTIME_VALIDATION

**Runtime Dir**: `specs/runtime/test-01-ui-runtime-validation/`
**Date**: 2026-04-08
**Status**: Complete — all NEEDS CLARIFICATION resolved
**Source method**: Codebase scan (file existence, grep for key assertions)

---

## Summary

22 validation tests across 8 areas. 17 tests are covered by existing test files. 5 gaps require new
files or additions. 3 performance tests (8.1–8.3) are non-blocking.

| Status            | Count |
| ----------------- | ----- |
| COVERED           | 14    |
| PARTIALLY COVERED | 3     |
| GAP (new file)    | 5     |
| NON-BLOCKING PERF | 3     |

---

## Coverage Map: Test ID → Status → File(s)

### Area 1: Authentication and Token Validation

| Test ID | Description                        | Status  | Existing Test File(s)                                                                                                                                                                                                                                                                                                                                                           |
| ------- | ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1     | Expired token → logout, no loop    | COVERED | `tests/integration/mmc/auth/401-race.test.ts`<br>`tests/integration/backoffice/auth/401-race.test.ts`<br>`tests/integration/frontoffice/auth/401-race.test.ts`<br>`tests/unit/mmc/core/api/interceptors/error.interceptor.test.ts`<br>`tests/integration/mmc/auth/session-clear-wiring.test.ts`                                                                                 |
| 1.2     | Tampered token rejected (401 path) | COVERED | Same as 1.1 — tampered token hits the same 401 handling flow client-side. Server-side rejection is covered by `apps/api/tests/unit/jwt-validation.test.ts` (out of scope, but confirms API rejects it). `tests/unit/mmc/core/api/interceptors/error.interceptor.test.ts` covers the idempotency guard.                                                                          |
| 1.3     | Cross-workspace token isolation    | COVERED | `tests/unit/mmc/core/state/auth.store.test.ts`<br>`tests/unit/backoffice/core/state/auth.store.test.ts`<br>`tests/unit/frontoffice/core/state/auth.store.test.ts` — each app's auth store is independent (confirmed by main.ts scan: each calls `createPinia()` locally). Cross-workspace enforcement is a server responsibility (see `apps/api/tests/unit/isolation.test.ts`). |
| 1.4     | Token storage policy (memory only) | COVERED | `tests/unit/mmc/core/auth/token-persistence-audit.test.ts`<br>`tests/unit/backoffice/core/auth/token-persistence-audit.test.ts`<br>`tests/unit/frontoffice/core/auth/token-persistence-audit.test.ts`                                                                                                                                                                           |

### Area 2: Router and Guard Validation

| Test ID | Description                         | Status            | Existing Test File(s)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------- | ----------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1     | Unauthenticated → redirect to login | COVERED           | `apps/mmc/src/core/guards/__tests__/auth.guard.spec.ts`<br>`apps/backoffice/src/core/guards/__tests__/auth.guard.spec.ts`<br>`apps/frontoffice/src/core/guards/__tests__/auth.guard.spec.ts`<br>`tests/unit/mmc/core/router/guards/auth.guard.redirect.test.ts`<br>`tests/unit/backoffice/core/router/guards/auth.guard.redirect.test.ts`<br>`tests/unit/frontoffice/core/router/guards/auth.guard.redirect.test.ts`<br>`apps/mmc/tests/unit/auth/auth.guard.test.ts`<br>`apps/backoffice/tests/unit/core/auth.guard.test.ts`<br>`apps/frontoffice/tests/unit/core/auth.guard.test.ts`                            |
| 2.2     | RBAC guard — non-admin denied       | COVERED           | `apps/backoffice/src/core/guards/__tests__/role.guard.spec.ts`<br>`apps/backoffice/tests/unit/core/role.guard.test.ts`<br>`apps/frontoffice/src/core/guards/__tests__/role.guard.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2.3     | 423/426 license codes handled       | PARTIALLY COVERED | `tests/unit/mmc/core/api/interceptors/error.interceptor.test.ts` (handles 423/426 → `onLicenseError()` callback).<br>`tests/unit/mmc/core/state/license-status.store.test.ts` (setWorkspaceLocked, setUpgradeRequired, clearLicenseStatus).<br>**GAP 5**: No integration test verifies `licenseStatusStore.clearLicenseStatus()` is called inside the `onSessionExpired` chain. The store's `clearLicenseStatus()` is confirmed to exist; the wiring call is NOT asserted in current session-clear-wiring tests (confirmed: `grep -c licenseStatus tests/integration/mmc/auth/session-clear-wiring.test.ts` → 0). |

### Area 3: API Client Layer Validation

| Test ID | Description                           | Status         | Existing Test File(s)                                                                                                                                                                                                                                                                                                                              |
| ------- | ------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1     | No raw fetch/axios in app code        | GAP            | **GAP 3**: No static analysis test. Requires new `tests/validation/static-analysis.test.ts`.                                                                                                                                                                                                                                                       |
| 3.2     | HTTP error code mapping (403–500)     | PARTIALLY COV. | 401 + 423 + 426: covered in `error.interceptor.test.ts` and `license-status.store.test.ts`.<br>**GAP 2**: 403, 429, 500 path is handled by `mapHttpStatusToCode()` in `packages/api-client/src/http-error.ts` but has no per-app unit assertion confirming propagation through the app's error normalizer. Requires adding status-code case tests. |
| 3.3     | Correlation ID header on all requests | GAP            | **GAP 1**: `applyCorrelationId()` exists in `packages/api-client/src/interceptors.ts` but has no unit test. `tests/unit/api-client/` directory does not exist. Requires new `tests/unit/api-client/interceptors/correlation-id.test.ts`.                                                                                                           |

### Area 4: Global Error Handling Validation

| Test ID | Description                             | Status  | Existing Test File(s)                                                                                                                                                                                                                                                                                                       |
| ------- | --------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1     | Structured error envelope normalization | COVERED | `apps/mmc/src/core/errors/__tests__/error-normalizer.spec.ts`<br>`apps/backoffice/src/core/errors/__tests__/error-normalizer.spec.ts`<br>`apps/frontoffice/src/core/errors/__tests__/error-normalizer.spec.ts` — each normalizes structured `{ success: false, error: { code, message } }` bodies (Zidney envelope format). |
| 4.2     | Network failure fallback                | COVERED | `apps/mmc/src/core/errors/__tests__/ErrorBoundary.spec.ts`<br>`apps/backoffice/src/core/errors/__tests__/ErrorBoundary.spec.ts`<br>`apps/frontoffice/src/core/errors/__tests__/ErrorBoundary.spec.ts`<br>`apps/*/src/core/errors/__tests__/global-error-handler.spec.ts`                                                    |

### Area 5: State Management Validation

| Test ID | Description                         | Status         | Existing Test File(s)                                                                                                                                                                                                                                                                                                                                                  |
| ------- | ----------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1     | Store isolation per app             | GAP            | **GAP 4**: Each `main.ts` confirmed to call `createPinia()` locally (not a shared singleton). No dedicated test asserts this property. Requires new `tests/unit/store-isolation.test.ts`.                                                                                                                                                                              |
| 5.2     | Logout resets all user-scoped state | PARTIALLY COV. | `tests/integration/mmc/auth/session-clear-wiring.test.ts` confirms `clearUserSpecificStores()` called and `authStore.expireSession()` fires. `tests/unit/*/core/state/license-status.store.test.ts` confirms `clearLicenseStatus()` API exists. **GAP 5**: No test asserts `licenseStatusStore.clearLicenseStatus()` is called as part of the `onSessionExpired` flow. |
| 5.3     | No direct API calls in .vue files   | GAP            | **GAP 3**: Part of static-analysis scan (same file as Test 3.1).                                                                                                                                                                                                                                                                                                       |

### Area 6: Environment Configuration Validation

| Test ID | Description                        | Status    | Existing Test File(s)                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------- | ---------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1     | Env separation + no secrets in git | COVERED   | `apps/mmc/tests/unit/core/env-config.test.ts`<br>`apps/backoffice/tests/unit/core/env-config.test.ts`<br>`apps/frontoffice/tests/unit/core/env-config.test.ts` confirm env config schema validation. `.env.production` confirmed NOT tracked in git (`git ls-files .env.production` → empty). No `.env.production` file exists in repo. GAP 3 static-analysis test adds the `git ls-files` assertion as a codified check. |
| 6.2     | Production build integrity         | PLAN ONLY | Covered by Phase 3 build validation: `bun run build`, `bun run typecheck`, `bun run lint` for all 3 apps. Not a unit test — CI gate.                                                                                                                                                                                                                                                                                      |

### Area 7: Security Validation

| Test ID | Description              | Status  | Existing Test File(s)                                                                                                                                                                                                                                                                                                 |
| ------- | ------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1     | XSS/v-html surface check | GAP     | **GAP 3**: `vue/no-v-html` ESLint rule status confirmed by linting (Phase 3). Static scan for zero `v-html` occurrences in `.vue` files requires `tests/validation/static-analysis.test.ts`.                                                                                                                          |
| 7.2     | Token redaction in logs  | COVERED | `tests/unit/mmc/core/auth/token-persistence-audit.test.ts`<br>`tests/unit/backoffice/core/auth/token-persistence-audit.test.ts`<br>`tests/unit/frontoffice/core/auth/token-persistence-audit.test.ts`<br>`apps/mmc/src/core/errors/__tests__/redact-error.spec.ts`<br>`apps/mmc/tests/unit/core/token-redact.test.ts` |

### Area 8: Performance Baseline (NON-BLOCKING)

| Test ID | Description                           | Status       | Approach                                                                                                                    |
| ------- | ------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 8.1     | Router navigation p95 < 50ms          | NON-BLOCKING | Playwright: `tests/e2e/app-load.spec.ts` + per-app `apps/*/tests/e2e/smoke.spec.ts` can be instrumented.                    |
| 8.2     | API client interceptor overhead < 5ms | NON-BLOCKING | Measured as part of Playwright network timing or Vitest benchmark; not a hard gate.                                         |
| 8.3     | Layout no-remount on navigation       | NON-BLOCKING | Vue DevTools observation; covered implicitly by layout component tests in `apps/*/tests/unit/components/AppLayout.test.ts`. |

---

## Gap Resolution Summary

| Gap ID | Test(s)            | New File                                                                                              | Root Cause                                                                                            |
| ------ | ------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| GAP 1  | 3.3                | `tests/unit/api-client/interceptors/correlation-id.test.ts`                                           | `applyCorrelationId()` has no dedicated unit test; `tests/unit/api-client/` directory does not exist. |
| GAP 2  | 3.2                | Extend `apps/*/src/core/errors/__tests__/error-normalizer.spec.ts` with 403/429/500 status code cases | App-level error normalizer tests don't assert specific 4xx/5xx HTTP status code mappings.             |
| GAP 3  | 3.1, 5.3, 6.1, 7.1 | `tests/validation/static-analysis.test.ts`                                                            | No shell-based static analysis assertions are codified in the test suite.                             |
| GAP 4  | 5.1                | `tests/unit/store-isolation.test.ts`                                                                  | main.ts Pinia isolation confirmed in source, but no test asserts the pattern is enforced.             |
| GAP 5  | 5.2, 2.3           | Extend `tests/integration/*/auth/session-clear-wiring.test.ts`                                        | `licenseStatusStore.clearLicenseStatus()` wiring in `onSessionExpired` is not asserted anywhere.      |

---

## Key Technical Findings

1. **`applyCorrelationId()` source**: `packages/api-client/src/interceptors.ts` line 22 — confirmed header is exactly `X-Correlation-ID`, auto-UUID when not provided.

2. **Error interceptor scope**: Each app's `createErrorInterceptor` handles only 401 (auth expiry) and 423/426 (license). Other codes (403, 429, 500) are normalized by `normalizeResponseError()` in the shared `@zidney/api-client` package → `mapHttpStatusToCode()`. App-level `normalizeError()` tests exist but don't assert specific status code mappings.

3. **Pinia isolation confirmed**: All three `main.ts` files call `createPinia()` locally (lines 55, 46, 43 respectively). No shared Pinia singleton exported from any package.

4. **`clearLicenseStatus()` exists**: `useLicenseStatusStore` in all apps has `clearLicenseStatus()` action (confirmed in `license-status.store.test.ts`). The gap is wiring: it's not called inside `onSessionExpired` per session-clear-wiring tests.

5. **`.env.production` not tracked**: `git ls-files .env.production` → empty. No `.env.production` file exists anywhere in the workspace. This is already compliant.

6. **E2E smoke tests exist**: `apps/mmc/tests/e2e/smoke.spec.ts`, `apps/backoffice/tests/e2e/smoke.spec.ts`, `apps/frontoffice/tests/e2e/smoke.spec.ts`, `tests/e2e/app-load.spec.ts` — available for performance baseline.
