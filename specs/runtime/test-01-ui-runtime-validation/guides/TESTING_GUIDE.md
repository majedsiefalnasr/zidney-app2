# Testing Guide — UI Application Runtime Validation (TEST-01)

**Stage:** UI Application Runtime Validation (TEST-01)  
**Phase:** 06_UI_APPLICATION_RUNTIME  
**Stage Directory:** test-01-ui-runtime-validation  
**Generated On:** 2026-04-10

---

## Purpose

This guide explains how to validate all tests introduced or extended in this stage. This is a
VALIDATION-ONLY stage — it adds tests to verify existing runtime behaviour; no production source
code was modified.

---

## Summary of Delivered Behavior

This stage closes 6 test coverage gaps identified in the UI Application Runtime layer:

- **GAP 1:** Correlation ID interceptor now has unit coverage
- **GAP 2:** HTTP error normalizer now covers 403, 423, 426, 429, and 500 status codes in all 3 apps
- **GAP 3:** Static analysis suite verifies no raw `fetch()` calls, no v-html directives, no `.env.production` committed, and no direct `apiClient` imported in `.vue` files
- **GAP 4:** Pinia store isolation verified — each app uses its own `createPinia()` instance
- **GAP 5:** Session-clear wiring verified — `licenseStatusStore` is reset when session expires
- **GAP 6:** Traceability clarified — store isolation tests (GAP 4) inherently cover this requirement

---

## Prerequisites

| Requirement                | Validation Command                                              |
| -------------------------- | --------------------------------------------------------------- |
| Bun installed              | `bun --version` (v1.x)                                          |
| Correct branch checked out | `git branch` → should show `spec/test-01-ui-runtime-validation` |
| Dependencies installed     | `bun install`                                                   |
| No DB or Docker required   | This is a pure test stage                                       |

---

## Files in Scope

New test files:

```text
tests/validation/static-analysis.test.ts
tests/unit/api-client/interceptors/correlation-id.test.ts
tests/unit/store-isolation.test.ts
```

Extended test files:

```text
apps/mmc/src/core/errors/__tests__/error-normalizer.spec.ts
apps/backoffice/src/core/errors/__tests__/error-normalizer.spec.ts
apps/frontoffice/src/core/errors/__tests__/error-normalizer.spec.ts
tests/integration/mmc/auth/session-clear-wiring.test.ts
tests/integration/backoffice/auth/session-clear-wiring.test.ts
tests/integration/frontoffice/auth/session-clear-wiring.test.ts
```

---

## Automated Validation Commands

### Run all tests

```bash
bun test
```

Expected: 280+ tests pass (excluding 1 expected fail in static-analysis.test.ts — see known issues).

### Run only the new test files

```bash
# Static analysis tests
bun test tests/validation/static-analysis.test.ts

# Correlation ID interceptor tests
bun test tests/unit/api-client/interceptors/correlation-id.test.ts

# Store isolation tests
bun test tests/unit/store-isolation.test.ts
```

### Run extended test files

```bash
# Error normalizer (all 3 apps)
bun test apps/mmc/src/core/errors/__tests__/error-normalizer.spec.ts
bun test apps/backoffice/src/core/errors/__tests__/error-normalizer.spec.ts
bun test apps/frontoffice/src/core/errors/__tests__/error-normalizer.spec.ts

# Session clear wiring (all 3 apps)
bun test tests/integration/mmc/auth/session-clear-wiring.test.ts
bun test tests/integration/backoffice/auth/session-clear-wiring.test.ts
bun test tests/integration/frontoffice/auth/session-clear-wiring.test.ts
```

### Run typecheck and lint

```bash
bun run typecheck
bun run lint
```

Both should exit with code 0.

---

## Manual Test Scenarios

### Scenario 1 — Verify Error Normalizer Covers New HTTP Status Codes

**Purpose:** Confirm that `createErrorNormalizer()` correctly maps 5 new HTTP status codes to the
expected Zidney error codes in all 3 apps.

1. Open any of the 3 error-normalizer spec files:
   `apps/{mmc,backoffice,frontoffice}/src/core/errors/__tests__/error-normalizer.spec.ts`
2. Look for the describe block titled `"additional HTTP status code mappings"` or similar.
3. Run the test in isolation:
   ```bash
   bun test apps/mmc/src/core/errors/__tests__/error-normalizer.spec.ts --reporter=verbose
   ```
4. Verify these test descriptions pass:
   - `"maps 403 to PERMISSION_DENIED"`
   - `"maps 423 to LOCKED"`
   - `"maps 426 to UPGRADE_REQUIRED"`
   - `"maps 429 to RATE_LIMITED"`
   - `"maps 500 to SERVER_ERROR"`

**Expected:** 5 new tests pass in each of 3 apps (15 total new passing tests).

**Troubleshooting:** If any fail, check that `packages/api-client/src/http-error.ts` (or equivalent)
has the correct error code constants. The test uses the same adapter interface as the existing tests.

---

### Scenario 2 — Verify Correlation ID Interceptor Attaches Unique IDs

**Purpose:** Confirm the API client interceptor adds a `X-Correlation-ID` header with a unique UUID
on every request.

1. Run the correlation ID test:
   ```bash
   bun test tests/unit/api-client/interceptors/correlation-id.test.ts --reporter=verbose
   ```
2. Verify these tests pass:
   - `"attaches a unique correlation ID header if none present"`
   - `"does not overwrite an existing correlation ID header"`
   - `"each request gets a distinct correlation ID"`

**Expected:** 5 tests pass.

**Troubleshooting:** If the import fails with module not found, check the path
`packages/api-client/src/interceptors` contains the correlationIdInterceptor export.

---

### Scenario 3 — Static Analysis Detects Raw fetch() (Expected Failure)

**Purpose:** Confirm the static analysis test correctly identifies the pre-existing architectural
violation using raw `fetch()` in backoffice production code.

1. Run the static analysis test:
   ```bash
   bun test tests/validation/static-analysis.test.ts --reporter=verbose
   ```
2. Verify:
   - `"no raw HTTP calls in production code"` describe block: 1 test **FAILS** (expected)
   - All other describe blocks PASS (v-html, .env.production, apiClient in .vue)
3. Read the test output — it should list the exact files containing raw `fetch()`:
   - `apps/backoffice/src/pages/roles/RolesListPage.vue`
   - `apps/backoffice/src/pages/roles/RoleDetailPage.vue`
   - `apps/backoffice/src/pages/roles/CreateRolePage.vue`
   - `apps/backoffice/src/composables/usePermission.ts`
   - `apps/backoffice/src/composables/useBackofficeContext.ts`

**Expected:** 3 tests PASS, 1 test FAILS with violation list. This is correct behavior.

**Note:** This test will continue to fail until the PRODUCTION-PATCH stage migrates those files
to `@zidney/api-client`.

---

## Negative Cases

| Scenario                                       | Trigger                                             | Expected Response                    |
| ---------------------------------------------- | --------------------------------------------------- | ------------------------------------ |
| Raw fetch() in production code                 | `static-analysis.test.ts` finds `fetch(` in app src | Test FAILS with file+line list       |
| Pinia store shared across apps                 | Two apps import the same Pinia instance             | `store-isolation.test.ts` FAILS      |
| Correlation ID missing after request           | Interceptor not registered                          | `correlation-id.test.ts` FAILS       |
| Error normalizer missing a status code         | `createErrorNormalizer()` returns wrong code        | `error-normalizer.spec.ts` FAILS     |
| licenseStatusStore not reset on session expiry | `setWorkspaceLocked()` not called                   | `session-clear-wiring.test.ts` FAILS |

---

## Known Issues

| Issue                                    | Severity     | Notes                                                                                         |
| ---------------------------------------- | ------------ | --------------------------------------------------------------------------------------------- |
| `static-analysis.test.ts` — 1 test fails | Expected     | Raw `fetch()` found in backoffice. Requires PRODUCTION-PATCH stage.                           |
| T017 Playwright E2E — not run            | Non-blocking | Dev servers not running during validation. Run `bun run dev:apps` then `bun playwright test`. |
| Tests 8.2/8.3 absent                     | Non-blocking | Interceptor performance and re-render discipline deferred to future PERF stage.               |

---

## Multi-Tenant Isolation Note

This stage has no multi-tenant component (VALIDATION-ONLY). All tests are unit/integration tests
that mock the API client or test composable behavior in isolation.

---

## Follow-up Actions

1. **PRODUCTION-PATCH stage:** Migrate raw `fetch()` calls in:
   - `apps/backoffice/src/pages/roles/RolesListPage.vue`
   - `apps/backoffice/src/pages/roles/RoleDetailPage.vue`
   - `apps/backoffice/src/pages/roles/CreateRolePage.vue`
   - `apps/backoffice/src/composables/usePermission.ts`
   - `apps/backoffice/src/composables/useBackofficeContext.ts`

2. **PRODUCTION-PATCH stage:** Add `clearLicenseStatus()` call in `main.ts` `onSessionExpired`
   handler for `mmc`, `backoffice`, and `frontoffice`.

3. **PERF stage:** Add Tests 8.2 (interceptor overhead p95 < 5ms) and 8.3 (re-render discipline).
