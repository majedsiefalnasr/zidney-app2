# Tasks: API Client Layer

**Input**: Design documents from `specs/runtime/ui-02-api-client-layer/`
**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, contracts/api-client.ts ✅, research.md ✅, quickstart.md ✅

**Tests**: Included — unit tests are explicitly requested (User Story 10, spec SC-007, user request item #9).

**Organization**: Tasks grouped by user story priority (P1 → P2 → P3). User stories with the same priority are ordered by dependency (foundational capabilities first).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US10)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Package Scaffolding)

**Purpose**: Create the `packages/api-client` package with build config, exports, and empty structure.

- [ ] T001 Create package manifest at `packages/api-client/package.json` with name `@zidney/api-client`, `type: "module"`, `main: "src/index.ts"`, zero runtime dependencies, devDeps for `typescript` and `vitest`
- [ ] T002 Create TypeScript configuration at `packages/api-client/tsconfig.json` extending `../../tsconfig.base.json` with strict mode enabled, include `src/**/*.ts`
- [ ] T003 [P] Create Vitest configuration at `packages/api-client/vitest.config.ts` with src alias resolution
- [ ] T004 [P] Create barrel export file at `packages/api-client/src/index.ts` with placeholder exports (types, factory, adapters, error utilities) — will be filled as modules are implemented
- [ ] T005 [P] Create empty source files for planned modules: `packages/api-client/src/types.ts`, `packages/api-client/src/client.ts`, `packages/api-client/src/interceptors.ts`, `packages/api-client/src/http-error.ts`, `packages/api-client/src/adapters/fetch-adapter.ts`, `packages/api-client/src/adapters/mock-adapter.ts`
- [ ] T006 Add `"@zidney/api-client": "workspace:*"` dependency to `apps/mmc/package.json`, `apps/backoffice/package.json`, and `apps/frontoffice/package.json`
- [ ] T007 Run workspace install to link the new package and verify TypeScript resolves `@zidney/api-client` imports

**Checkpoint**: Package scaffolding complete. All files exist, imports resolve, `tsc --noEmit` passes with empty modules.

---

## Phase 2: Foundational (Core Types & Error Codes)

**Purpose**: Define all shared types and error codes that every subsequent module depends on. MUST complete before any user story implementation.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T008 Implement core types in `packages/api-client/src/types.ts`: `AppError`, `RequestConfig`, `ClientResponse<T>`, `AdapterRequest`, `AdapterResponse`, `HttpAdapter` interface, `ClientConfig` — matching contracts/api-client.ts exactly
- [ ] T009 Implement `ErrorCodes` constant object in `packages/api-client/src/http-error.ts` with all 7 known codes: `NETWORK_ERROR`, `REQUEST_TIMEOUT`, `REQUEST_CANCELLED`, `RATE_LIMITED`, `AUTH_REFRESH_FAILED`, `INVALID_RESPONSE`, `UNKNOWN_ERROR`
- [ ] T010 [P] Implement `isAppError` type guard function in `packages/api-client/src/http-error.ts` — checks for `code`, `message`, `httpStatus`, `isNetworkError` fields
- [ ] T011 [P] Implement `createAppError` internal factory function in `packages/api-client/src/http-error.ts` — constructs frozen `AppError` objects with validated fields
- [ ] T012 Update barrel exports in `packages/api-client/src/index.ts` to re-export all types, `ErrorCodes`, `isAppError`, and `createAppError`

**Checkpoint**: Foundation ready — all types compile, `ErrorCodes` is importable, `isAppError` works. User story implementation can now begin.

---

## Phase 3: User Story 10 — Testability via MockAdapter (Priority: P1) 🎯 MVP

**Goal**: Deliver the MockAdapter so all subsequent user stories can be tested without network calls.

**Independent Test**: Inject MockAdapter, enqueue responses, call `execute()`, verify request recording and response dequeuing.

### Tests for User Story 10

- [ ] T013 [P] [US10] Write unit tests in `packages/api-client/tests/adapters/mock-adapter.test.ts`: enqueue/dequeue responses, enqueue network errors, request recording (`getRequests`, `getLastRequest`), `assertRequestCount`, `reset`, empty queue throws, partial response defaults

### Implementation for User Story 10

- [ ] T014 [US10] Implement `MockAdapter` class in `packages/api-client/src/adapters/mock-adapter.ts`: FIFO response queue, request log array, `enqueue(Partial<AdapterResponse>)`, `enqueueError(Error)`, `execute(AdapterRequest)`, `getRequests()`, `getLastRequest()`, `reset()`, `assertRequestCount(n)` — default missing fields (`status: 200`, `ok: true`, `headers: {}`, `body: null`)
- [ ] T015 [US10] Implement `createMockAdapter()` factory function in `packages/api-client/src/adapters/mock-adapter.ts` returning `MockAdapter` instance
- [ ] T016 [US10] Export `MockAdapter` interface and `createMockAdapter` from `packages/api-client/src/index.ts`
- [ ] T017 [US10] Run mock-adapter tests to verify all pass

**Checkpoint**: MockAdapter is complete and tested. All subsequent user story tests can use it.

---

## Phase 4: User Story 1 — Developer Makes a Typed API Call (Priority: P1) 🎯 MVP

**Goal**: Deliver the core `createApiClient` factory and `FetchAdapter` so developers can make typed HTTP calls via `client.get<T>()`, `client.post<T>()`, etc.

**Independent Test**: Create client with MockAdapter, call `client.get<Product[]>("/products")`, verify typed response and correct request URL/method/headers.

### Tests for User Story 1

- [ ] T018 [P] [US1] Write unit tests in `packages/api-client/tests/adapters/fetch-adapter.test.ts`: verify FetchAdapter calls `globalThis.fetch` with correct URL, method, headers, body, signal; verify response flattening (status, headers, body JSON parse, ok flag); verify network error (fetch TypeError) is thrown as-is
- [ ] T019 [P] [US1] Write unit tests in `packages/api-client/tests/client.test.ts` — basic request section: `client.get<T>()` sends GET with correct URL (baseUrl + path), `client.post<T>()` sends POST with JSON body, `client.put<T>()` sends PUT, `client.patch<T>()` sends PATCH, `client.delete<T>()` sends DELETE; verify `ClientResponse<T>` shape returned with `{ success: true, data: T }`

### Implementation for User Story 1

- [ ] T020 [US1] Implement `FetchAdapter` in `packages/api-client/src/adapters/fetch-adapter.ts`: wraps `globalThis.fetch`, constructs `Request` from `AdapterRequest`, flattens `Response` to `AdapterResponse` (lowercase header keys, JSON-parse body, catch parse errors → `body: null`), passes `signal` and `credentials`
- [ ] T021 [US1] Implement `createFetchAdapter()` factory in `packages/api-client/src/adapters/fetch-adapter.ts` — parameterless; `credentials` is applied by `createApiClient` from `ClientConfig.credentials` (default `'include'`) at request time
- [ ] T022 [US1] Implement `createApiClient(config: ClientConfig): ApiClient` factory in `packages/api-client/src/client.ts`: instantiate default `FetchAdapter` if no adapter provided, implement `get<T>`, `post<T>`, `put<T>`, `patch<T>`, `delete<T>` methods that build `AdapterRequest` (prepend `baseUrl`, serialize body via `JSON.stringify`, serialize `params` to query string and append to URL), call adapter `.execute()`, narrow `response.body` via type guard before accessing `.data`, return `{ success: true, data: response.body.data }` for ok responses. MUST apply `Content-Type: application/json` header on POST, PUT, PATCH methods during request building (required for mutations to succeed).
- [ ] T023 [US1] Export `createApiClient` and `createFetchAdapter` from `packages/api-client/src/index.ts`
- [ ] T024 [US1] Run client.test.ts and fetch-adapter.test.ts to verify all pass

**Checkpoint**: Core client works for typed API calls. Developers can `client.get<T>("/path")` and receive typed responses.

---

## Phase 5: User Story 2 — Authenticated Request with Token Injection (Priority: P1)

**Goal**: Automatically attach `Authorization: Bearer <token>` header on requests when an auth token is available; omit it when not.

**Independent Test**: Configure client with `getAccessToken: () => "test-token"`, make request, verify `Authorization` header present. Configure with `() => null`, verify header absent.

### Tests for User Story 2

- [ ] T025 [P] [US2] Write unit tests in `packages/api-client/tests/interceptors.test.ts` — auth interceptor section: token present → `Authorization: Bearer <token>` header attached; token null → no `Authorization` header; token changes between calls → updated token used

### Implementation for User Story 2

- [ ] T026 [US2] Implement auth interceptor logic in `packages/api-client/src/interceptors.ts`: export `applyAuthHeader(headers, getAccessToken)` function that calls `getAccessToken()` and sets `Authorization: Bearer <token>` if non-null
- [ ] T027 [US2] Integrate auth interceptor into `createApiClient` request pipeline in `packages/api-client/src/client.ts` — call `applyAuthHeader` before adapter.execute()
- [ ] T028 [US2] Run interceptors.test.ts auth section to verify all pass

**Checkpoint**: All requests automatically carry auth tokens when available.

---

## Phase 6: User Story 3 — 401 Single-Flight Refresh + Retry (Priority: P1)

**Goal**: On 401 response, trigger token refresh via `onRefreshToken`, retry original request exactly once with new token. Multiple concurrent 401s trigger only one refresh. Failed refresh calls `onAuthFailure`.

**Independent Test**: MockAdapter returns 401 then 200. Verify refresh called once, request retried, response returned. Verify concurrent 401s produce single refresh.

### Tests for User Story 3

- [ ] T029 [P] [US3] Write unit tests in `packages/api-client/tests/client.test.ts` — 401 refresh section: single 401 triggers refresh + retry; retried request uses new token; refresh failure calls `onAuthFailure` and throws `AUTH_REFRESH_FAILED` AppError; double 401 (retry also returns 401) does NOT re-enter refresh loop; concurrent 401s trigger single refresh call; all queued requests retried after refresh; all queued requests rejected if refresh fails

### Implementation for User Story 3

- [ ] T030 [US3] Implement 401 single-flight refresh logic in `packages/api-client/src/client.ts`: detect non-ok response with `status === 401`, use shared `refreshPromise` reference for single-flight, call `config.onRefreshToken()`, on success retry original request once with new token, on failure call `config.onAuthFailure()` and throw `AppError` with code `AUTH_REFRESH_FAILED`; queue concurrent requests during refresh and retry/reject all when refresh resolves/fails; prevent re-entry on second 401 after retry
- [ ] T031 [US3] Run client.test.ts 401 refresh section to verify all pass

**Checkpoint**: 401 refresh is transparent. Users never see token expiration during active sessions.

---

## Phase 7: User Story 4 — Normalized Error Handling (Priority: P2)

**Goal**: All API errors (network, HTTP, timeout, malformed response) normalize to `AppError` with predictable `code`, `message`, `httpStatus`, `isNetworkError` fields.

**Independent Test**: MockAdapter returns various error shapes → all produce well-structured `AppError`. Simulate network error → `isNetworkError: true`.

### Tests for User Story 4

- [ ] T032 [P] [US4] Write unit tests in `packages/api-client/tests/http-error.test.ts`: backend structured error `{ success: false, error: { code, message } }` → AppError with backend code and message; non-JSON response body → `INVALID_RESPONSE` code; network error (adapter throws TypeError) → `NETWORK_ERROR` with `isNetworkError: true` and `httpStatus: 0`; unknown/unexpected error shape → `UNKNOWN_ERROR`; all AppError objects are frozen (immutable)

### Implementation for User Story 4

- [ ] T033 [US4] Implement `normalizeResponseError(response: AdapterResponse): AppError` in `packages/api-client/src/http-error.ts`: extract `code` and `message` from backend error body `{ success: false, error: { code, message } }`, fallback to `UNKNOWN_ERROR` if shape doesn't match; set `httpStatus` from response status; set `isNetworkError: false`
- [ ] T034 [US4] Implement `normalizeNetworkError(error: unknown): AppError` in `packages/api-client/src/http-error.ts`: detect `TypeError` (fetch network failure) → code `NETWORK_ERROR`, `httpStatus: 0`, `isNetworkError: true`; detect `AbortError` naming (handled in US8); fallback → `UNKNOWN_ERROR`
- [ ] T035 [US4] Integrate error normalization into `createApiClient` response pipeline in `packages/api-client/src/client.ts`: wrap adapter.execute() in try/catch, call `normalizeResponseError` for non-ok adapter responses, call `normalizeNetworkError` for thrown errors, throw resulting `AppError`
- [ ] T036 [US4] Run http-error.test.ts and client.test.ts error sections to verify all pass

**Checkpoint**: All errors are AppError. No raw errors leak to callers.

---

## Phase 8: User Story 5 — Rate Limit (429) Surface Handling (Priority: P2)

**Goal**: 429 responses become `AppError` with `code: RATE_LIMITED`, `httpStatus: 429`, and `retryAfter` from `Retry-After` header. No auto-retry.

**Independent Test**: MockAdapter returns 429 with `retry-after: 30` header → AppError has `retryAfter: 30`. Without header → `retryAfter: undefined`.

### Tests for User Story 5

- [ ] T037 [P] [US5] Write unit tests in `packages/api-client/tests/http-error.test.ts` — 429 section: 429 with `Retry-After` header → `retryAfter` parsed as number; 429 without header → `retryAfter` undefined; 429 → `code: 'RATE_LIMITED'`, `httpStatus: 429`, `isNetworkError: false`; 429 → no auto-retry (single request only)

### Implementation for User Story 5

- [ ] T038 [US5] Extend `normalizeResponseError` in `packages/api-client/src/http-error.ts`: when `status === 429`, set `code: ErrorCodes.RATE_LIMITED`, parse `Retry-After` header to number (or `undefined`), set `retryAfter` on AppError
- [ ] T039 [US5] Ensure 401 handler in `packages/api-client/src/client.ts` does NOT intercept 429 (only 401 triggers refresh) — verify test confirms no retry on 429
- [ ] T040 [US5] Run 429 test section to verify all pass

**Checkpoint**: Rate limiting is surfaced with retry-after info. UI can display appropriate messages.

---

## Phase 9: User Story 6 — Idempotency Key Support (Priority: P2)

**Goal**: Callers pass `idempotencyKey` in `RequestConfig`, client attaches `Idempotency-Key` header on mutations only (POST, PUT, PATCH, DELETE). Ignored on GET.

**Independent Test**: Call `client.post("/x", data, { idempotencyKey: "abc" })` → verify `Idempotency-Key: abc` header. Call without key → no header. GET with key → no header.

### Tests for User Story 6

- [ ] T041 [P] [US6] Write unit tests in `packages/api-client/tests/interceptors.test.ts` — idempotency section: POST with key → header present; POST without key → no header; GET with key → header NOT attached; PUT/PATCH/DELETE with key → header present

### Implementation for User Story 6

- [ ] T042 [US6] Implement idempotency interceptor in `packages/api-client/src/interceptors.ts`: export `applyIdempotencyKey(headers, method, idempotencyKey?)` — attach `Idempotency-Key` only on non-GET methods when key is provided
- [ ] T043 [US6] Integrate idempotency interceptor into request pipeline in `packages/api-client/src/client.ts`
- [ ] T044 [US6] Run idempotency test section to verify all pass

**Checkpoint**: Idempotency keys flow through to backend on mutations.

---

## Phase 10: User Story 7 — Multi-App Configuration (Priority: P2)

**Goal**: Each app (MMC, Backoffice, Frontoffice) configures the client with its own `baseUrl`, `getAccessToken`, `onRefreshToken`, `onAuthFailure` via `createApiClient(config)`. Different instances resolve to different API bases.

**Independent Test**: Create two client instances with different `baseUrl` values, make requests, verify each targets the correct base.

### Tests for User Story 7

- [ ] T045 [P] [US7] Write unit tests in `packages/api-client/tests/client.test.ts` — multi-config section: two clients with different baseUrl → requests target correct bases; different `getAccessToken` functions → different auth headers; client instances are isolated (no shared state)

### Implementation for User Story 7

- [ ] T046 [US7] Create MMC wrapper at `apps/mmc/src/core/api/client.ts`: import `createApiClient`, `createFetchAdapter` from `@zidney/api-client`; configure with `appConfig.env.apiBaseUrl`, `useAuthStore().getAccessToken`, refresh via POST to `/auth/refresh`, failure clears auth and navigates to login; export `getApiClient()` lazy singleton
- [ ] T047 [P] [US7] Create Backoffice wrapper at `apps/backoffice/src/core/api/client.ts`: same pattern as MMC, configured with Backoffice env apiBaseUrl and auth store
- [ ] T048 [P] [US7] Create Frontoffice wrapper at `apps/frontoffice/src/core/api/client.ts`: same pattern as MMC, configured with Frontoffice env apiBaseUrl and auth store
- [ ] T049 [US7] Run multi-config tests to verify all pass

**Checkpoint**: All three apps have configured client wrappers targeting correct API bases.

---

## Phase 11: User Story 8 — Request Cancellation Support (Priority: P3)

**Goal**: Callers pass `AbortSignal` via `RequestConfig.signal`. Aborting cancels the request and returns a cancellation-typed `AppError`.

**Independent Test**: Initiate request with `AbortController.signal`, abort before response → `AppError` with `code: REQUEST_CANCELLED`.

### Tests for User Story 8

- [ ] T050 [P] [US8] Write unit tests in `packages/api-client/tests/client.test.ts` — cancellation section: aborted signal → `AppError` with `code: REQUEST_CANCELLED`, `isNetworkError: false`, `httpStatus: 0`; completed request before abort → normal response returned; timeout exceeded → `AppError` with `code: REQUEST_TIMEOUT`, `isNetworkError: true`, `httpStatus: 0`

### Implementation for User Story 8

- [ ] T051 [US8] Implement timeout interceptor in `packages/api-client/src/interceptors.ts`: export `createCombinedSignal(timeout, userSignal?)` — combine `AbortSignal.timeout(ms)` with user signal via `AbortSignal.any()`; handle timeout=0 (no timeout signal)
- [ ] T052 [US8] Extend `normalizeNetworkError` in `packages/api-client/src/http-error.ts`: detect `AbortError` with timeout reason → `REQUEST_TIMEOUT` code, `isNetworkError: true`; detect `AbortError` with user abort → `REQUEST_CANCELLED` code, `isNetworkError: false`
- [ ] T053 [US8] Integrate timeout interceptor into request pipeline in `packages/api-client/src/client.ts` — apply combined signal before adapter.execute(); use `config.defaultTimeout` (fallback 30000) when per-request timeout not specified
- [ ] T054 [US8] Run cancellation/timeout tests to verify all pass

**Checkpoint**: Requests are cancellable and respect timeouts.

---

## Phase 12: User Story 9 — Correlation ID Propagation (Priority: P3)

**Goal**: Every request gets an `X-Correlation-ID` header (auto-generated UUID or caller-provided override).

**Independent Test**: Make request → `X-Correlation-ID` header present with valid UUID. Provide custom correlationId → that value used.

### Tests for User Story 9

- [ ] T055 [P] [US9] Write unit tests in `packages/api-client/tests/interceptors.test.ts` — correlation section: no correlationId provided → `X-Correlation-ID` header auto-generated as UUID; custom correlationId → that value used; each request gets distinct auto-generated ID

### Implementation for User Story 9

- [ ] T056 [US9] Implement correlation interceptor in `packages/api-client/src/interceptors.ts`: export `applyCorrelationId(headers, correlationId?)` — set `X-Correlation-ID` to provided value or `crypto.randomUUID()`
- [ ] T057 [US9] Extract content-type interceptor from client.ts into `packages/api-client/src/interceptors.ts`: export `applyContentType(headers, method)` — set `Content-Type: application/json` on POST, PUT, PATCH methods. Refactors inline logic from T022 into the shared interceptor module for consistency with other interceptors.
- [ ] T058 [US9] Integrate correlation and content-type interceptors into request pipeline in `packages/api-client/src/client.ts` — correct pipeline order: auth → correlation → content-type → idempotency → timeout → execute
- [ ] T059 [US9] Run correlation and content-type tests to verify all pass

**Checkpoint**: Full interceptor pipeline is wired in correct order. All headers propagated.

---

## Phase 13: Migration & Lint Enforcement

**Purpose**: Replace duplicated per-app code with the shared package. Enforce no direct fetch/axios usage.

### Migration

- [ ] T060 Replace `apps/mmc/src/core/api/client.ts` with thin wrapper importing from `@zidney/api-client` (created in T046); update all MMC feature module imports of `ClientResponse`, `ApiClient`, `RequestConfig` to import from `@zidney/api-client` or the new wrapper
- [ ] T061 [P] Delete `apps/mmc/src/core/errors/error-normalizer.ts` and `apps/mmc/src/core/errors/types.ts`; update all MMC imports of `NormalizedError` to use `AppError` from `@zidney/api-client`; update all catch blocks using old `NormalizedError` shape to use `isAppError` guard
- [ ] T062 Replace `apps/backoffice/src/core/api/client.ts` with thin wrapper importing from `@zidney/api-client` (created in T047); update all Backoffice feature module imports
- [ ] T063 [P] Delete `apps/backoffice/src/core/errors/error-normalizer.ts` and `apps/backoffice/src/core/errors/types.ts`; update all Backoffice imports of `NormalizedError` to use `AppError` from `@zidney/api-client`
- [ ] T064 Replace `apps/frontoffice/src/core/api/client.ts` with thin wrapper importing from `@zidney/api-client` (created in T048); update all Frontoffice feature module imports
- [ ] T065 [P] Delete `apps/frontoffice/src/core/errors/error-normalizer.ts` and `apps/frontoffice/src/core/errors/types.ts`; update all Frontoffice imports of `NormalizedError` to use `AppError` from `@zidney/api-client`

### Lint Rule Enforcement

- [ ] T066 Add `no-restricted-imports` rule to `eslint.config.mjs` scoped to `apps/*/src/**/*.{ts,vue}`: ban `axios`, `got`, `ky`, `node-fetch` with message "Use @zidney/api-client instead"
- [ ] T067 Add `no-restricted-globals` rule to `eslint.config.mjs` scoped to `apps/*/src/**/*.{ts,vue}`: ban `fetch` with message "Use @zidney/api-client instead of direct fetch(). Import from core/api/client.ts."
- [ ] T068 Verify ESLint passes across all three apps with zero violations after migration

**Checkpoint**: All duplicated code removed. Lint enforces single client abstraction.

---

## Phase 14: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, documentation, and quality gates.

- [ ] T069 [P] Verify `tsc --noEmit` passes for `packages/api-client` with zero errors and zero `any` types in public API surface
- [ ] T070 [P] Verify all unit tests pass: `packages/api-client/tests/**/*.test.ts` — run full suite
- [ ] T071 Verify interceptor pipeline order matches spec: auth → correlation → content-type → idempotency → timeout → execute → JSON parse → 401 handler → error normalizer → return/throw
- [ ] T072 [P] Verify `packages/api-client/src/index.ts` barrel exports are complete: `createApiClient`, `createFetchAdapter`, `createMockAdapter`, `isAppError`, `ErrorCodes`, all public types (`AppError`, `RequestConfig`, `ClientResponse`, `ClientConfig`, `HttpAdapter`, `AdapterRequest`, `AdapterResponse`, `ApiClient`, `MockAdapter`)
- [ ] T073 [P] Scan for any remaining TODO, FIXME, or placeholder comments in `packages/api-client/src/**` and `apps/*/src/core/api/**` — remove all (SC-010)
- [ ] T074 Run quickstart.md validation: create a throwaway test file that imports from `@zidney/api-client`, configures a client with MockAdapter, exercises get/post/error/401-refresh/429/cancel scenarios from quickstart examples — all must work
- [ ] T075 Run full workspace lint: `eslint apps/ packages/api-client/ --max-warnings=0` — zero errors, zero warnings for the modified files
- [ ] T076 Final review: verify no `fetch`/`axios` direct imports remain in `apps/*/src/**` (excluding `packages/api-client/src/adapters/fetch-adapter.ts`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US10 MockAdapter (Phase 3)**: Depends on Phase 2 — BLOCKS user story testing
- **US1 Typed Calls (Phase 4)**: Depends on Phase 3 (needs MockAdapter for tests)
- **US2 Auth Injection (Phase 5)**: Depends on Phase 4 (extends client)
- **US3 401 Refresh (Phase 6)**: Depends on Phase 5 (needs auth interceptor)
- **US4 Error Normalization (Phase 7)**: Depends on Phase 4 (extends client response pipeline)
- **US5 429 Handling (Phase 8)**: Depends on Phase 7 (extends error normalization)
- **US6 Idempotency (Phase 9)**: Depends on Phase 4 — can run parallel with Phase 5-8
- **US7 Multi-App Config (Phase 10)**: Depends on Phase 5 (needs auth configured)
- **US8 Cancellation (Phase 11)**: Depends on Phase 4 — can run parallel with Phase 5-8
- **US9 Correlation ID (Phase 12)**: Depends on Phase 4 — can run parallel with Phase 5-8
- **Migration (Phase 13)**: Depends on Phases 4-12 (all stories complete)
- **Polish (Phase 14)**: Depends on Phase 13

### User Story Dependencies

- **US10 (P1)**: Foundation only — no other story dependencies. **MUST be first** (provides test infrastructure).
- **US1 (P1)**: Depends on US10 (for tests). Core capability — most stories depend on this.
- **US2 (P1)**: Depends on US1. Extends client request pipeline.
- **US3 (P1)**: Depends on US2. Extends response pipeline with refresh logic.
- **US4 (P2)**: Depends on US1. Extends response pipeline with error normalization.
- **US5 (P2)**: Depends on US4. Extends error normalization for 429.
- **US6 (P2)**: Depends on US1. Independent — different interceptor, no dependency on US2-US5.
- **US7 (P2)**: Depends on US2. Per-app wrappers need auth configured.
- **US8 (P3)**: Depends on US1. Independent — signal/timeout is orthogonal to auth/errors.
- **US9 (P3)**: Depends on US1. Independent — header interceptors are orthogonal.

### Parallel Opportunities (After Phase 4 / US1 Complete)

The following user stories can proceed in parallel since they touch different files and interceptor concerns:

```
After US1 + US2 complete:
┌─── US3 (401 refresh)        → client.ts response handling
├─── US4 (error normalization) → http-error.ts
├─── US6 (idempotency)        → interceptors.ts (different function)
├─── US7 (multi-app config)   → apps/*/src/core/api/client.ts
├─── US8 (cancellation)       → interceptors.ts (timeout fn) + http-error.ts (abort detection)
└─── US9 (correlation ID)     → interceptors.ts (different function)

After US4 complete:
└─── US5 (429 handling)       → extends http-error.ts
```

---

## Implementation Strategy

### MVP First (Phases 1–6: Setup + Foundation + US10 + US1 + US2 + US3)

1. Complete Phase 1: Package scaffolding
2. Complete Phase 2: Core types and error codes
3. Complete Phase 3: MockAdapter (enables all subsequent testing)
4. Complete Phase 4: Core client (typed API calls work)
5. Complete Phase 5: Auth token injection
6. Complete Phase 6: 401 refresh + retry
7. **STOP and VALIDATE**: Client is functional with auth, refresh, and typed calls
8. This covers all P1 user stories — deployable as MVP

### Incremental Delivery

- **MVP (P1)**: US10 → US1 → US2 → US3 = functional client with auth
- **Enhancement (P2)**: US4 → US5 → US6 → US7 = errors, rate limiting, idempotency, per-app wrappers
- **Polish (P3)**: US8 → US9 = cancellation, correlation IDs
- **Migration**: Replace old code, enforce lint rules
- **Final**: Cleanup, validation, quickstart verification

### Single Developer Execution Order

T001 → T002 → T003‖T004‖T005 → T006 → T007 → T008 → T009 → T010‖T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018‖T019 → T020 → T021 → T022 → T023 → T024 → T025 → T026 → T027 → T028 → T029 → T030 → T031 → T032 → T033 → T034 → T035 → T036 → T037 → T038 → T039 → T040 → T041 → T042 → T043 → T044 → T045 → T046 → T047‖T048 → T049 → T050 → T051 → T052 → T053 → T054 → T055 → T056 → T057 → T058 → T059 → T060 → T061‖T062 → T063‖T064 → T065 → T066 → T067 → T068 → T069‖T070 → T071 → T072‖T073 → T074 → T075 → T076

(`‖` = parallel opportunity)

---

## Notes

- [P] tasks = different files, no dependencies on in-progress tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable after its phase completes
- The package has ZERO runtime dependencies — pure TypeScript
- All tests use MockAdapter — no network calls in any test
- Content-type header applied inline in T022 (Phase 4) to ensure mutations work immediately; extracted to interceptor module in T057 (Phase 12) for architectural consistency with other interceptors
- Migration phase (T060–T068) must be done AFTER all package features are complete to avoid partial replacements
- Commit after each phase checkpoint for clean rollback points
