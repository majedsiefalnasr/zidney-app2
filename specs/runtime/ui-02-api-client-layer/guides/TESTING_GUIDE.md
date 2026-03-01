# Testing Guide — API Client Layer

**Stage:** API Client Layer
**Phase:** 06_UI_APPLICATION_RUNTIME
**Stage Directory:** ui-02-api-client-layer
**Generated On:** 2026-03-01

---

## Purpose

This guide explains how to validate the `@zidney/api-client` package implementation end-to-end — covering automated tests, manual integration verification, and edge case scenarios.

---

## Summary of Delivered Behavior

A new shared `packages/api-client` package replaces per-app HTTP client implementations across MMC, Backoffice, and Frontoffice. It provides a framework-agnostic HTTP client with injectable transport, automatic auth token injection, error normalization, idempotency keys, and correlation ID propagation.

Key outcomes:

- All HTTP requests from any Zidney frontend app go through a single, tested client implementation
- Automatic `Idempotency-Key` headers on all mutation requests (POST/PUT/PATCH/DELETE)
- Automatic `X-Correlation-ID` on every request for distributed tracing
- Single-flight 401 refresh: if a token expires mid-session, one refresh is attempted and all queued requests retry
- Structured `AppError` objects replace raw error objects across all error paths

---

## Prerequisites

| Requirement                | Validation Command / Check                     |
| -------------------------- | ---------------------------------------------- |
| Node.js installed          | `node --version` (v20+)                        |
| Bun installed              | `bun --version` (v1+)                          |
| Dependencies installed     | `bun install` at repo root                     |
| Correct branch checked out | `git branch` includes `ui-02-api-client-layer` |
| TypeScript compiles        | `bun run typecheck`                            |

---

## Files in Scope

```text
packages/api-client/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── types.ts              ← Core types: AppError, ClientResponse, HttpAdapter, ClientConfig
│   ├── index.ts              ← Barrel exports
│   ├── client.ts             ← createApiClient factory, HTTP methods, interceptor pipeline
│   ├── interceptors.ts       ← applyAuth, applyCorrelationId, applyContentType, applyIdempotencyKey
│   ├── http-error.ts         ← normalizeError, isAppError, ErrorCodes
│   └── adapters/
│       ├── fetch-adapter.ts  ← FetchAdapter (production transport)
│       └── mock-adapter.ts   ← MockAdapter (test adapter)
└── tests/
    ├── client.test.ts                  ← 29 tests
    ├── interceptors.test.ts            ← 21 tests
    ├── http-error.test.ts              ← 14 tests
    ├── quickstart-validation.test.ts   ← 9 tests
    └── adapters/
        ├── fetch-adapter.test.ts       ← 9 tests
        └── mock-adapter.test.ts        ← 8 tests

apps/mmc/src/core/api/client.ts              ← Thin wrapper using createApiClient
apps/backoffice/src/core/api/client.ts       ← Thin wrapper using createApiClient
apps/frontoffice/src/core/api/client.ts      ← Thin wrapper using createApiClient
tsconfig.base.json                            ← @zidney/api-client path mapping
eslint.config.mjs                             ← no-restricted-imports/globals rules
```

---

## Automated Validation Commands

```bash
# Run all api-client unit tests (90 tests)
cd packages/api-client && npx vitest run --reporter=verbose

# Type check the package
cd packages/api-client && npx tsc --noEmit

# Lint the package
cd packages/api-client && npx eslint src/ tests/ --max-warnings=0

# Monorepo-wide type check (ensures no regressions)
bun run typecheck
```

Expected outcome: 90 tests pass, 0 type errors, 0 lint errors.

---

## Manual Test Scenarios

### Scenario 1 — Basic GET Request via App Wrapper

**Purpose:** Verify the per-app wrapper correctly delegates to the shared client.

1. Open `apps/backoffice/src/core/api/client.ts` and confirm it imports from `@zidney/api-client`
2. In a Backoffice Vue component, call `apiClient.get('/api/v1/health')` from the browser console or a test page
3. Open browser DevTools → Network tab

Expected:

- Request includes `X-Correlation-ID` header with a UUID value
- Request includes `credentials: include` (visible in request details)
- Response is typed as `ClientResponse<T>` with `success`, `data`, `error` fields

Troubleshooting:

- If `X-Correlation-ID` is missing → check `applyCorrelationId` interceptor in `interceptors.ts`
- If CORS errors appear → verify backend allows the correlation header

### Scenario 2 — Mutation with Idempotency Key

**Purpose:** Verify POST/PUT/PATCH/DELETE requests get automatic `Idempotency-Key` headers.

1. Call `apiClient.post('/api/v1/some-resource', { name: 'test' })` from any app
2. Open browser DevTools → Network → inspect the request headers

Expected:

- `Idempotency-Key` header is present with a UUID value
- `Content-Type` header is `application/json`

Troubleshooting:

- If `Idempotency-Key` is missing → check `applyIdempotencyKey` in `interceptors.ts` and verify method is POST/PUT/PATCH/DELETE
- GET requests should NOT have `Idempotency-Key`

### Scenario 3 — 401 Token Refresh (Edge Case)

**Purpose:** Verify that expired auth tokens trigger a single-flight refresh and queued retry.

1. Using MockAdapter in a test, enqueue a 401 response followed by a 200 response
2. Configure `onRefreshToken` callback in `ClientConfig`
3. Call `apiClient.get('/api/v1/protected-resource')`

Expected:

- First request receives 401
- `onRefreshToken` is called exactly once
- The original request is retried automatically with the new token
- Final result is the 200 response data

---

## Negative Cases

| Scenario                | Trigger                                              | Expected Response                                            |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| Network failure         | Disable network / use MockAdapter with network error | `AppError` with `code: 'NETWORK_ERROR'`                      |
| 404 Not Found           | Request non-existent endpoint                        | `AppError` with `code: 'NOT_FOUND'`, `status: 404`           |
| 429 Rate Limited        | Server returns 429                                   | `AppError` with `code: 'RATE_LIMITED'`, `retryAfter` present |
| Request timeout         | Set `timeout: 1` in config, slow endpoint            | `AppError` with `code: 'TIMEOUT'`                            |
| Malformed JSON response | Server returns invalid JSON                          | `AppError` with `code: 'PARSE_ERROR'`                        |

Error responses follow the `AppError` interface:

```typescript
interface AppError {
  code: string
  message: string
  status?: number
  details?: Record<string, unknown>
  retryAfter?: number
}
```

---

## Multi-Tenant Isolation Verification

This package is a **UI-only HTTP client** — it does not access databases directly. Tenant isolation is enforced by:

1. Each app wrapper configures `baseURL` with the tenant-specific API endpoint
2. Auth interceptor injects tenant-scoped tokens
3. The API backend (not this package) enforces database-per-tenant isolation

To verify:

1. Log in as a user from `workspace-a`, make API calls
2. Log in as a user from `workspace-b`, make the same API calls
3. Confirm each workspace sees only its own data (enforced server-side)

---

## ESLint Enforcement Verification

```bash
# Verify that direct fetch/axios imports are blocked
echo "import axios from 'axios'" > /tmp/test-lint.ts
npx eslint /tmp/test-lint.ts
# Should report: 'axios' import is restricted

# Verify that bare fetch() calls are blocked (in app code)
echo "fetch('/api')" > /tmp/test-fetch.ts
npx eslint /tmp/test-fetch.ts
# Should report: 'fetch' is restricted
```

---

## Sign-Off Checklist

- [ ] All 90 automated tests pass (`npx vitest run`)
- [ ] TypeScript compiles with zero errors (`npx tsc --noEmit`)
- [ ] ESLint passes with zero errors (`npx eslint src/ tests/`)
- [ ] Manual scenario 1 (GET request) passes
- [ ] Manual scenario 2 (mutation with idempotency) passes
- [ ] Negative cases return correct `AppError` structure
- [ ] No `console.log` or stack traces exposed in client code
- [ ] All three app wrappers import from `@zidney/api-client`

---

## References

- `specs/runtime/ui-02-api-client-layer/reports/IMPLEMENT_REPORT.md`
- `specs/runtime/ui-02-api-client-layer/reports/PLAN_REPORT.md`
- `specs/runtime/ui-02-api-client-layer/audits/VALIDATION_REPORT.md`

---

Generated by Zidney Orchestrator Hard Mode v1.2.0.
