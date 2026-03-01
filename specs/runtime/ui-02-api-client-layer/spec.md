# Feature Specification: API Client Layer

**Feature Branch**: `ui-02-api-client-layer`  
**Created**: 2026-02-28  
**Status**: Draft  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Stage File**: `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_02_API_CLIENT_LAYER.md`  
**Input**: User description: "Establish the canonical HTTP communication layer shared across MMC, Backoffice, and Frontoffice apps"

---

## User Scenarios & Testing

### User Story 1 — Developer Makes a Typed API Call (Priority: P1)

A developer working on any Zidney frontend app (MMC, Backoffice, or Frontoffice) needs to call a backend endpoint. They import from the centralized API client, invoke a typed method, and receive a fully typed response or a normalized error. They never touch `fetch` or `axios` directly.

**Why this priority**: This is the foundational capability. Without a working typed client, no other feature—auth refresh, error normalization, idempotency—can function. Every subsequent user story builds on this one.

**Independent Test**: Can be fully tested by importing the client, calling `client.get<SomeType>("/endpoint")`, and verifying that the response is typed correctly and the raw HTTP layer is abstracted away.

**Acceptance Scenarios**:

1. **Given** a developer imports the API client, **When** they call `client.get<Product[]>("/products")`, **Then** they receive a typed `Product[]` response without accessing raw `Response` or `fetch`.
2. **Given** a developer attempts to import `fetch` or `axios` directly in a feature module, **When** the linter runs, **Then** the import is flagged as a violation.
3. **Given** the client is configured for Backoffice, **When** a request is made, **Then** the base URL resolves to the workspace-scoped API endpoint automatically.
4. **Given** the client is configured for MMC, **When** a request is made, **Then** the base URL resolves to the platform-level API endpoint.

---

### User Story 2 — Authenticated Request with Automatic Token Injection (Priority: P1)

A logged-in user performs any action in any of the three apps. The API client automatically attaches the user's authorization token to outgoing requests without the developer writing token logic in feature modules.

**Why this priority**: Authentication is required for nearly all API calls. Without automatic injection, every feature module would need to manually handle tokens, creating security risks and code duplication.

**Independent Test**: Can be tested by configuring the client with an auth token provider, making a request, and verifying the `Authorization` header is present on the outgoing request.

**Acceptance Scenarios**:

1. **Given** a user is authenticated, **When** any API call is made, **Then** the `Authorization` header is attached with the current token.
2. **Given** a user is not authenticated, **When** an API call is made to a public endpoint, **Then** no `Authorization` header is attached.
3. **Given** a user's token has been refreshed, **When** the next API call is made, **Then** the updated token is used automatically.

---

### User Story 3 — Transparent 401 Refresh and Retry (Priority: P1)

A user is actively working when their access token expires. The API client detects the 401 response, triggers a token refresh, waits for the refresh to complete, and retries the original request—all transparently. The user experiences no interruption.

**Why this priority**: Token expiration during active sessions is a common occurrence. Without transparent refresh, users would be logged out mid-task, degrading trust and experience significantly.

**Independent Test**: Can be tested by simulating a 401 response, verifying a refresh call is triggered, and confirming the original request is retried exactly once with the new token.

**Acceptance Scenarios**:

1. **Given** a request returns 401, **When** the client handles the response, **Then** it triggers the auth refresh flow and retries the original request exactly once.
2. **Given** multiple concurrent requests all receive 401, **When** the refresh is triggered, **Then** only a single refresh request is made (single-flight), and all waiting requests are retried after the refresh resolves.
3. **Given** a request returns 401 and the refresh also fails, **When** the retry is attempted, **Then** the error is propagated to the caller without further retries.
4. **Given** a retried request after refresh also returns 401, **When** the client processes this second 401, **Then** no additional refresh is attempted and the error is returned to the caller.

---

### User Story 4 — Normalized Error Handling (Priority: P2)

A developer receives an error from any API call. Instead of dealing with raw HTTP errors, network failures, or inconsistent error shapes, they always receive a normalized `AppError` object with a predictable structure including code, message, HTTP status, and a network error flag.

**Why this priority**: Consistent error handling across all three apps prevents UI inconsistencies and reduces developer cognitive load. It is the foundation for user-facing error messages.

**Independent Test**: Can be tested by simulating various failure modes (network down, 400, 500, malformed response) and verifying each produces a well-structured `AppError`.

**Acceptance Scenarios**:

1. **Given** the backend returns an error with `{ code, message, httpStatus }`, **When** the client processes the response, **Then** the caller receives an `AppError` with all fields populated.
2. **Given** a network failure occurs (no response), **When** the client handles the failure, **Then** the caller receives an `AppError` where `isNetworkError` is `true`.
3. **Given** the backend returns an unexpected response shape, **When** the client processes it, **Then** the caller receives an `AppError` with a generic error code and the HTTP status preserved.
4. **Given** a request times out, **When** the client handles it, **Then** the caller receives an `AppError` with an appropriate code indicating timeout.

---

### User Story 5 — Rate Limit (429) Surface Handling (Priority: P2)

A user triggers a rate-limited response from the backend. The API client surfaces this as a structured `AppError` with retry-after information so the UI can display an appropriate message. The client does not auto-retry.

**Why this priority**: Rate limiting is a security and stability measure. Surfacing it correctly prevents silent failures and allows the UI to guide users.

**Independent Test**: Can be tested by simulating a 429 response with a `Retry-After` header and verifying the `AppError` includes the retry delay.

**Acceptance Scenarios**:

1. **Given** the backend returns 429, **When** the client handles it, **Then** the caller receives an `AppError` with `httpStatus: 429`.
2. **Given** the backend returns 429 with a `Retry-After` header, **When** the client handles it, **Then** the `AppError` includes the `retryAfter` value (in seconds).
3. **Given** the backend returns 429 without a `Retry-After` header, **When** the client handles it, **Then** the `AppError` still has `httpStatus: 429` and `retryAfter` is undefined.
4. **Given** a 429 is received, **When** the client processes it, **Then** no automatic retry is performed.

---

### User Story 6 — Idempotency Key Support (Priority: P2)

A developer working on a mutation endpoint (e.g., submission, creation) needs to ensure the request is idempotent. They pass an idempotency key to the client, and the client attaches it as a header. The client never generates keys automatically.

**Why this priority**: Idempotency protects against duplicate submissions in critical flows like exam attempts and license creation. The client must support it, but key generation is the caller's responsibility.

**Independent Test**: Can be tested by passing an idempotency key to `client.post` and verifying the `Idempotency-Key` header is present on the outgoing request.

**Acceptance Scenarios**:

1. **Given** a developer calls `client.post` with `{ idempotencyKey: "abc-123" }`, **When** the request is sent, **Then** the `X-Idempotency-Key: abc-123` header is present.
2. **Given** a developer calls `client.post` without an idempotency key, **When** the request is sent, **Then** no `X-Idempotency-Key` header is attached.
3. **Given** a developer provides an idempotency key on a GET request, **When** the request is sent, **Then** the key is ignored (not attached).

---

### User Story 7 — Multi-App Configuration (Priority: P2)

Each Zidney app (MMC, Backoffice, Frontoffice) configures the API client with its own base URL and context. MMC points to the platform API, Backoffice points to a workspace-scoped API, and Frontoffice points to the student runtime API. All apps use the same client abstraction with different configurations.

**Why this priority**: Multi-tenancy and app isolation require each app to target different API bases. Without per-app configuration, workspace scoping breaks.

**Independent Test**: Can be tested by creating client instances with different configurations and verifying each resolves requests to the correct base URL.

**Acceptance Scenarios**:

1. **Given** the client is configured for MMC, **When** `client.get("/products")` is called, **Then** the request targets `{MMC_API_BASE}/products` with no workspace prefix.
2. **Given** the client is configured for Backoffice with workspace slug "acme", **When** `client.get("/exams")` is called, **Then** the request targets `{BACKOFFICE_API_BASE}/exams` with workspace context.
3. **Given** the client is configured for Frontoffice, **When** `client.get("/attempt/status")` is called, **Then** the request targets the student runtime API base.
4. **Given** the app environment changes (staging vs production), **When** the client is initialized, **Then** the base URL is read from environment configuration.

---

### User Story 8 — Request Cancellation Support (Priority: P3)

A user navigates away from a page while a request is in-flight. The pending request is cancelled to prevent stale responses from affecting the UI or triggering side effects in a new view.

**Why this priority**: Request cancellation prevents race conditions and wasted bandwidth, but most flows still function correctly without it. It is a quality-of-life improvement.

**Independent Test**: Can be tested by initiating a request with an `AbortSignal`, aborting it, and verifying the request is cancelled and no response callback fires.

**Acceptance Scenarios**:

1. **Given** a request is initiated with an `AbortSignal`, **When** the signal is aborted before the response arrives, **Then** the request is cancelled and a cancellation-typed `AppError` is returned.
2. **Given** a request completes before the signal is aborted, **When** the response arrives, **Then** the response is returned normally and the signal has no effect.

---

### User Story 9 — Correlation ID Propagation (Priority: P3)

An operator debugging an issue across frontend and backend needs to trace a request end-to-end. The API client optionally attaches a correlation ID to outgoing requests as a header so that backend logs can be correlated with frontend actions.

**Why this priority**: Observability and debugging across the full stack relies on correlation IDs. This is optional per-request, and its absence doesn't block any functional flow.

**Independent Test**: Can be tested by passing a correlation ID to a request and verifying the `X-Correlation-ID` header is present on the outgoing request.

**Acceptance Scenarios**:

1. **Given** a correlation ID is provided in the request config, **When** the request is sent, **Then** the `X-Correlation-ID` header is attached.
2. **Given** no correlation ID is provided, **When** the request is sent, **Then** a UUID is auto-generated and attached as `X-Correlation-ID`.

---

### User Story 10 — Testability via Mocked HTTP Adapter (Priority: P1)

A developer writing tests for a feature module needs to mock API responses without making real HTTP calls. The API client supports dependency injection of the HTTP transport layer, allowing tests to provide a mocked adapter.

**Why this priority**: Testability is a foundational requirement co-equal with the client itself. Without it, no feature module can be tested in isolation.

**Independent Test**: Can be tested by injecting a mock adapter, calling the client, and verifying the mock was invoked with the correct parameters and the response is correctly processed.

**Acceptance Scenarios**:

1. **Given** a mock HTTP adapter is injected into the client, **When** a request is made, **Then** the mock adapter handles the request instead of the real HTTP layer.
2. **Given** a mock adapter returns a 401, **When** the refresh interceptor runs, **Then** the refresh and retry logic executes correctly against the mock.
3. **Given** a mock adapter simulates a network failure, **When** the error normalizer runs, **Then** an `AppError` with `isNetworkError: true` is returned.
4. **Given** a mock adapter is configured, **When** multiple concurrent requests race, **Then** the single-flight refresh behavior can be verified deterministically.

---

### Edge Cases

- What happens when the auth token provider returns `null` or `undefined`? The client must send the request without an `Authorization` header.
- What happens when the refresh endpoint itself is rate-limited (429)? The client must propagate the 429 as an `AppError` without entering a retry loop.
- What happens when a request is retried after refresh but the server returns a different error (e.g., 403)? The client must return that error as-is; no further retry.
- What happens when the backend returns a 200 with an unexpected body shape? The client returns the raw data to the caller; type enforcement is the responsibility of the consuming module's DTO validation.
- What happens when two apps try to use different client instances simultaneously in the same test? Each instance must be independently configurable and isolated.
- What happens when the network is restored after a failure and a queued request fires late? The client relies on `AbortSignal` for cancellation; otherwise, it processes the response normally.
- What happens when a request exceeds the 30-second default timeout? The client aborts the request and returns an `AppError` with a timeout-specific error code.
- What happens when a network error occurs (DNS failure, connection reset)? The client does NOT retry. It returns an `AppError` with `isNetworkError: true` immediately.
- What happens when 50+ concurrent requests all receive 401 simultaneously? All are queued for retry after the single-flight refresh. No queue depth limit is imposed; browser connection limits (~6 per domain) provide natural throttling.
- What happens when a caller sends a non-JSON body (e.g., FormData)? The client does not support non-JSON bodies in this stage. Callers must serialize to JSON.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a single, typed API client abstraction (`client.ts`) that all frontend apps use for HTTP communication.
- **FR-002**: System MUST support typed generic methods: `client.get<T>()`, `client.post<T>()`, `client.patch<T>()`, `client.delete<T>()`.
- **FR-003**: System MUST prohibit `any` types in the client's public API; all request and response types must be explicitly parameterized.
- **FR-004**: System MUST automatically attach the `Authorization` header to requests when an auth token is available.
- **FR-005**: System MUST omit the `Authorization` header when no auth token is available (public/unauthenticated endpoints).
- **FR-006**: System MUST intercept 401 responses and trigger a token refresh flow.
- **FR-007**: System MUST implement single-flight refresh — multiple concurrent 401s trigger only one refresh request.
- **FR-008**: System MUST retry the original request exactly once after a successful token refresh.
- **FR-009**: System MUST NOT retry after a failed refresh or after a second 401 on the retried request.
- **FR-010**: System MUST normalize all errors (HTTP errors, network failures, timeouts, unexpected responses) into an `AppError` structure with: `code`, `message`, `httpStatus`, `isNetworkError`.
- **FR-011**: System MUST surface 429 responses as `AppError` with `retryAfter` metadata (when the `Retry-After` header is present).
- **FR-012**: System MUST NOT auto-retry 429 responses.
- **FR-013**: System MUST support an optional `idempotencyKey` parameter on mutation requests (`POST`, `PATCH`, `DELETE`) that attaches an `X-Idempotency-Key` header.
- **FR-014**: System MUST NOT generate idempotency keys automatically; key generation is the caller's responsibility.
- **FR-015**: System MUST support per-app base URL configuration (MMC: platform API, Backoffice: workspace-scoped API, Frontoffice: student runtime API) resolved from environment configuration.
- **FR-016**: System MUST support request cancellation via standard `AbortSignal`.
- **FR-017**: System MUST support optional `X-Correlation-ID` header attachment on requests.
- **FR-018**: System MUST NOT expose raw `Response` objects, raw HTTP headers, or transport-layer details to callers.
- **FR-019**: System MUST support injection of a mock HTTP adapter for testing, allowing full client behavior (interceptors, error normalization, refresh) to be tested without real HTTP calls.
- **FR-020**: System MUST enforce that no frontend module imports `fetch`, `axios`, or any HTTP library directly — only the centralized client.
- **FR-021**: System MUST organize the client code in `core/api/` with the following structure: `client.ts`, `types.ts`, `interceptors.ts`, `http-error.ts`.
- **FR-022**: Feature modules MUST define their API functions in `modules/<feature>/api.ts` and import exclusively from `core/api/client.ts`.
- **FR-023**: System MUST NOT include any business endpoint implementations — this stage is infrastructure only.
- **FR-024**: System MUST enforce a default request timeout of 30 seconds. The timeout MUST be overridable per-request via `RequestConfig.timeout`.
- **FR-025**: System MUST NOT auto-retry on transient network errors (DNS failure, connection reset, socket timeout). Only 401 responses trigger retry (after refresh). All other failures are surfaced as `AppError` immediately.
- **FR-026**: System MUST support JSON content type (`application/json`) only for request and response bodies. Non-JSON content types (e.g., `multipart/form-data` for file uploads) are out of scope for this stage.
- **FR-027**: System MUST NOT emit internal logs, metrics, or tracing events. The client is pure infrastructure; error reporting is the consuming module's responsibility via the returned `AppError`.
- **FR-028**: System MUST NOT impose an explicit limit on the number of concurrent requests queued during a 401 refresh in-flight. All waiting requests are retried after refresh resolves or fails.

### Key Entities

- **ApiClient**: The singleton HTTP client abstraction responsible for sending typed requests, attaching headers, and routing through interceptors. Configurable per app.
- **AppError**: The normalized error object consumed by all UI code. Contains `code` (string), `message` (string), `httpStatus` (number), `isNetworkError` (boolean), and optional `retryAfter` (number).
- **RequestConfig**: The per-request configuration object supporting optional `idempotencyKey`, `correlationId`, `signal` (AbortSignal), `timeout` (number, in milliseconds, default 30000), and custom headers.
- **HttpAdapter**: The injectable transport interface (real or mocked) responsible for executing the actual HTTP request. Swappable for testing.
- **Interceptor**: A middleware function in the request/response pipeline that can modify requests (e.g., attach auth header) or handle responses (e.g., trigger refresh on 401).

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: All frontend HTTP calls in MMC, Backoffice, and Frontoffice pass through the centralized API client — zero direct `fetch`/`axios` imports exist in feature modules.
- **SC-002**: Developers can add a new API endpoint integration in under 5 minutes by defining a typed function in a feature module's `api.ts` file.
- **SC-003**: Token refresh during active sessions is transparent to users — no visible interruption or forced logout during normal token expiration.
- **SC-004**: All API errors (network, HTTP, timeout) are surfaced to the UI as a consistent `AppError` structure — no unstructured error handling exists in feature modules.
- **SC-005**: 401 refresh race conditions are eliminated — concurrent expired-token requests result in exactly one refresh call.
- **SC-006**: Rate-limit (429) responses are surfaced to the UI layer with retry-after information, enabling user-facing messaging within 1 second of receipt.
- **SC-007**: Feature module tests can mock all API calls without network access — 100% of API client behavior is testable via injected adapters.
- **SC-008**: Each app (MMC, Backoffice, Frontoffice) can be independently configured with its own API base URL and context without code changes to the client core.
- **SC-009**: CI passes with zero TypeScript errors, zero lint violations, and zero `any` types in the API client public surface.
- **SC-010**: No `TODO`, `FIXME`, or placeholder comments remain in the API client layer at stage completion.

---

## Assumptions

- The backend API follows the standard Zidney error contract: `{ success: boolean, data: object | null, error: { code: string, message: string } | null }`.
- Auth token storage and retrieval are handled by an auth module external to the API client; the client receives a token provider function.
- The refresh endpoint is a standard backend route that accepts a refresh token and returns a new access token.
- Environment configuration (base URLs) is provided by each app's `env.ts` module, which is already defined in Stage UI-05 (Env Configuration).
- `AbortController` / `AbortSignal` are available in all target runtime environments (modern browsers).
- The backend returns standard HTTP `Retry-After` header (in seconds) on 429 responses when applicable.
- This stage does not implement WebSocket or Server-Sent Events; HTTP request/response only.
- This stage supports JSON (`application/json`) content type only. File upload and multipart/form-data support are deferred to a dedicated stage.
- The API client does not emit internal logs, metrics, or tracing events. Observability is the consuming module's responsibility.
- The default request timeout is 30 seconds, overridable per-request. This prevents hung requests in UI.
- No automatic retry on network errors. Only 401 triggers retry (after token refresh). Deterministic failure propagation is preferred.

---

## Dependencies

- **Stage UI-05 (Env Configuration)**: Provides per-app environment configuration including API base URLs.
- **Stage UI-00 (Runtime Architecture)**: Defines the overall folder structure (`core/`, `modules/`) and module boundaries.
- **Backend API Error Contract**: The backend must return errors in the standard `{ success, data, error }` shape defined in the Zidney API contract.

---

## Constitutional Compliance

This specification complies with the following Zidney constitutional constraints:

- **No database access from frontend**: The API client communicates exclusively via HTTP to the backend API. No direct database calls.
- **No business rule inference from responses**: The client normalizes transport and error handling only. It does not interpret, enforce, or infer business rules.
- **No license logic in frontend**: License enforcement is handled entirely by backend middleware. The client passes through license-related errors (423, 403) as `AppError` objects.
- **No RBAC inference from JWT**: The client attaches the JWT but does not parse, decode, or extract role information from it.
- **All HTTP traffic through single client abstraction**: Enforced by FR-020 and linting rules.
- **Database-per-tenant preserved**: The client routes to workspace-scoped APIs for Backoffice and student runtime APIs for Frontoffice; tenant resolution is performed by the backend.
- **Server-authoritative time only**: The client does not generate, manipulate, or validate timestamps. All time-related logic is server-side.

---

## Clarifications

### Session 2026-03-01

- Q: Should the API client enforce a default request timeout? If so, what value? → A: Yes, 30-second default, configurable per-request via `RequestConfig.timeout`. Prevents hung requests in UI; safety-first for infrastructure.
- Q: Should the client auto-retry on transient network errors (DNS failure, connection reset, socket timeout)? → A: No auto-retry for network errors. Only 401 triggers retry after refresh. Deterministic failure propagation preferred; avoids masking real failures.
- Q: Should the client support non-JSON content types (e.g., multipart/form-data for file uploads)? → A: JSON-only (`application/json`) for this stage. File upload and multipart/form-data support deferred to a dedicated stage. Keeps HttpAdapter interface simple.
- Q: Should the API client emit structured logs for requests, responses, or errors internally? → A: No internal logging, metrics, or tracing. Client is pure infrastructure. Errors propagated as `AppError`; consuming modules handle observability. Avoids logger dependency in shared UI package.
- Q: Is there a limit on how many concurrent requests can be queued during a 401 refresh in-flight? → A: No explicit limit. All concurrent requests queued and retried after refresh resolves or fails. Browser connection limits (~6 per domain) provide natural throttling.
