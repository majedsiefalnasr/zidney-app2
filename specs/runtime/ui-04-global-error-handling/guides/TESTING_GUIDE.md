# Testing Guide — STAGE_UI_04_GLOBAL_ERROR_HANDLING

**Stage:** GLOBAL ERROR HANDLING — Error Boundary & Normalization Layer  
**Branch:** `spec/ui-04-global-error-handling`  
**Audience:** QA Engineers, Reviewing Developers  
**Date:** 2026-04-06

---

## Overview

This stage introduced a unified error handling system across three frontend apps (MMC, Backoffice, Frontoffice). The key deliverables to test are:

1. **`normalizeError()`** — converts any error shape into a consistent `AppError`
2. **`redactError()`** — strips sensitive credentials before logging
3. **`ErrorBoundary.vue`** — catches Vue render errors and shows a fallback UI
4. **`global-error-handler.ts`** — catches unhandled promise rejections and window errors

---

## Running Automated Tests

```bash
# Run all tests for the 3 frontend apps
npx vitest run --project=mmc --project=backoffice --project=frontoffice

# Expected output:
# ✓ 105 test files
# ✓ 894 tests passed
# ✗ 0 failures

# Run only error module tests
npx vitest run --project=backoffice apps/backoffice/src/core/errors
npx vitest run --project=frontoffice apps/frontoffice/src/core/errors
npx vitest run --project=mmc apps/mmc/src/core/errors
```

---

## Manual Test Scenarios

### 1 — ErrorBoundary catches a thrown component error

**Setup:** Open any of the three apps in the browser (MMC, Backoffice, Frontoffice).

**Steps:**

1. Open the browser DevTools console.
2. In the application, trigger a scenario that throws an error inside a Vue component (for example, navigate to a route that loads a component with a broken render).
3. Observe the UI.

**Expected:**

- The app does NOT white-screen (no unhandled crash).
- A fallback UI (error boundary slot) is displayed instead of the broken component.
- The console shows a structured log entry with the normalized `AppError`.
- The error message does NOT contain raw stack traces or internal server details.

---

### 2 — ErrorBoundary reset works

**Steps:**

1. Trigger a component error (as above).
2. Click the "Try Again" / reset button in the fallback UI.

**Expected:**

- `capturedError` is cleared.
- The broken component is unmounted and the UI attempts to re-render cleanly.
- No lingering error state in the UI.

---

### 3 — Global handler catches unhandled promise rejection

**Steps:**

1. In DevTools console, run:
   ```js
   Promise.reject(new Error("Unhandled rejection test"));
   ```
2. Observe the console.

**Expected:**

- The application does NOT crash.
- A structured log entry appears from `global-error-handler` with the normalized error.
- The error is tagged with `code: 'UNKNOWN_ERROR'` (or an appropriate code if recognizable).

---

### 4 — normalizeError handles API error responses

**Steps:**

1. Open DevTools Network tab.
2. Navigate to a page that calls an API endpoint.
3. Block the endpoint (or use DevTools to return a 404 response).
4. Observe the UI error display.

**Expected:**

- The displayed error message is human-readable (e.g., "Not Found" or the server's error message).
- No raw JSON or stack traces visible to the user.
- The `AppError` shape in logs contains `code: 'NOT_FOUND'`, `httpStatus: 404`.

---

### 5 — normalizeError handles network failures

**Steps:**

1. In DevTools Network tab, set throttling to "Offline".
2. Trigger any API call (page load, form submit).
3. Observe the UI and console.

**Expected:**

- UI shows a user-friendly error ("Unable to connect" or similar).
- Console log shows `AppError` with `isNetworkError: true`.
- `code` is `'NETWORK_ERROR'` or similar.

---

### 6 — redactError strips sensitive data

**This is verified automatically by the spec `redact-error.spec.ts`. To manually verify:**

1. Open `apps/backoffice/src/core/errors/__tests__/redact-error.spec.ts`.
2. Review the test "strips Bearer tokens from authorization headers".
3. Run:
   ```bash
   npx vitest run --project=backoffice apps/backoffice/src/core/errors/__tests__/redact-error.spec.ts
   ```
4. All 8 tests should pass.

---

### 7 — Verify no credentials appear in error logs

**Steps:**

1. Call an API with invalid credentials (wrong token).
2. Observe the network error response.
3. Check the console log output from the global error handler.

**Expected:**

- No token values appear in logged error messages.
- The `Authorization` header value is replaced with `[REDACTED]`.

---

## Test File Reference

| Spec File                                                       | What It Tests                                                                |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `apps/*/src/core/errors/__tests__/error-normalizer.spec.ts`     | All 7 normalization branches + AppError passthrough + legacy migration       |
| `apps/*/src/core/errors/__tests__/redact-error.spec.ts`         | Bearer token, password, secret, API key redaction patterns                   |
| `apps/*/src/core/errors/__tests__/global-error-handler.spec.ts` | `addEventListener`, `removeEventListener`, `onError` callback, logger call   |
| `apps/*/src/core/errors/__tests__/ErrorBoundary.spec.ts`        | Error capture, fallback slot, reset, logger integration, router availability |
| `apps/*/tests/unit/core/error-normalizer.test.ts`               | Legacy test — updated for AppError shape                                     |
| `apps/*/tests/integration/app-layout.integration.test.ts`       | Integration test — ErrorBoundary in App.vue layout                           |

---

## Files Changed Reference

For reviewers who want to inspect specific files:

| File                                                                        | Change Type                            |
| --------------------------------------------------------------------------- | -------------------------------------- |
| `packages/api-client/src/http-error.ts`                                     | Modified — AppError foundations added  |
| `packages/api-client/src/index.ts`                                          | Modified — error utilities re-exported |
| `apps/{mmc,backoffice,frontoffice}/src/core/errors/error-normalizer.ts`     | Modified — uses AppError               |
| `apps/{mmc,backoffice,frontoffice}/src/core/errors/ErrorBoundary.vue`       | New — Vue SFC error boundary           |
| `apps/{mmc,backoffice,frontoffice}/src/core/errors/redact-error.ts`         | New — credential redaction             |
| `apps/{mmc,backoffice,frontoffice}/src/core/errors/global-error-handler.ts` | New — window event handling            |
| `apps/{mmc,backoffice,frontoffice}/src/App.vue`                             | Modified — ErrorBoundary wired in      |
| `apps/{mmc,backoffice,frontoffice}/src/main.ts`                             | Modified — providers registered        |
| `apps/{mmc,backoffice,frontoffice}/src/core/errors/types.ts`                | Deleted — NormalizedError removed      |

---

## Known Acceptable Biome Suppressions

`ErrorBoundary.vue` contains `// biome-ignore lint/correctness/noUnusedVariables` comments on lines declaring `router` and `capturedError`. These are required because Biome cannot statically resolve Vue SFC template bindings. Both values are actively used in the component template.
