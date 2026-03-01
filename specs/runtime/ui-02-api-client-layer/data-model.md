# Data Model: API Client Layer

**Feature**: UI-02 API Client Layer
**Date**: 2026-03-01

---

This stage has no database entities. All data structures are in-memory TypeScript types used for HTTP communication.

---

## Entity: AppError

The normalized error object consumed by all UI code.

| Field            | Type                  | Required | Description                                                                             |
| ---------------- | --------------------- | -------- | --------------------------------------------------------------------------------------- |
| `code`           | `string`              | ✅       | Machine-readable error code (e.g., `NETWORK_ERROR`, `RATE_LIMITED`, backend error code) |
| `message`        | `string`              | ✅       | Human-readable error description                                                        |
| `httpStatus`     | `number`              | ✅       | HTTP status code (0 for network/timeout errors)                                         |
| `isNetworkError` | `boolean`             | ✅       | `true` for DNS failure, connection reset, timeout                                       |
| `retryAfter`     | `number \| undefined` | ❌       | Seconds until retry allowed (from `Retry-After` header on 429)                          |

**Validation rules**:

- `code` must be non-empty string
- `httpStatus` must be non-negative integer (0 for non-HTTP errors)
- `retryAfter`, when present, must be a positive number

**State transitions**: None — AppError is immutable once created.

**Relationships**: Created by error normalization pipeline in `http-error.ts`. Consumed by all UI feature modules.

---

## Entity: RequestConfig

Per-request configuration passed by callers to API client methods.

| Field            | Type                                  | Required | Default             | Description                                                      |
| ---------------- | ------------------------------------- | -------- | ------------------- | ---------------------------------------------------------------- |
| `idempotencyKey` | `string \| undefined`                 | ❌       | —                   | Attached as `X-Idempotency-Key` header on mutation requests only |
| `correlationId`  | `string \| undefined`                 | ❌       | auto-generated UUID | Override for `X-Correlation-ID` header                           |
| `signal`         | `AbortSignal \| undefined`            | ❌       | —                   | Caller-provided abort signal for request cancellation            |
| `timeout`        | `number \| undefined`                 | ❌       | `30000`             | Per-request timeout in milliseconds; 0 disables timeout          |
| `headers`        | `Record<string, string> \| undefined` | ❌       | —                   | Additional custom headers (merged after interceptors)            |

**Validation rules**:

- `timeout` must be non-negative integer when provided
- `idempotencyKey` ignored on GET requests (not attached)
- `signal` must be valid `AbortSignal` instance when provided

---

## Entity: ClientConfig

Configuration provided to `createApiClient()` factory by each app.

| Field            | Type                    | Required                   | Description                                                       |
| ---------------- | ----------------------- | -------------------------- | ----------------------------------------------------------------- |
| `baseUrl`        | `string`                | ✅                         | API base URL (from app's `env.ts`)                                |
| `defaultTimeout` | `number`                | ❌ (default: 30000)        | Default timeout in ms for all requests                            |
| `getAccessToken` | `() => string \| null`  | ✅                         | Returns current access token or null if unauthenticated           |
| `onRefreshToken` | `() => Promise<string>` | ✅                         | Performs token refresh; returns new access token                  |
| `onAuthFailure`  | `() => void`            | ✅                         | Called when auth refresh fails (e.g., navigate to login)          |
| `adapter`        | `HttpAdapter`           | ❌ (default: FetchAdapter) | Injectable HTTP transport layer                                   |
| `credentials`    | `RequestCredentials`    | ❌ (default: 'include')    | Fetch credentials mode; 'include' needed for httpOnly cookie auth |

**Validation rules**:

- `baseUrl` must be non-empty string, no trailing slash
- `getAccessToken` must never throw; return null for unauthenticated state
- `onRefreshToken` must throw/reject on refresh failure

---

## Entity: HttpAdapter (Interface)

Injectable transport layer responsible for executing raw HTTP requests.

| Method    | Signature                                               | Description                                     |
| --------- | ------------------------------------------------------- | ----------------------------------------------- |
| `execute` | `(request: AdapterRequest) => Promise<AdapterResponse>` | Execute an HTTP request and return the response |

---

## Entity: AdapterRequest

Input to `HttpAdapter.execute()`.

| Field     | Type                                              | Required | Description                                                        |
| --------- | ------------------------------------------------- | -------- | ------------------------------------------------------------------ |
| `url`     | `string`                                          | ✅       | Full URL (base + path + query string)                              |
| `method`  | `'GET' \| 'POST' \| 'PUT' \| 'PATCH' \| 'DELETE'` | ✅       | HTTP method                                                        |
| `headers` | `Record<string, string>`                          | ✅       | All request headers (auth, content-type, correlation, idempotency) |
| `body`    | `string \| undefined`                             | ❌       | JSON-stringified request body (mutations only)                     |
| `signal`  | `AbortSignal \| undefined`                        | ❌       | Combined timeout + caller abort signal                             |

---

## Entity: AdapterResponse

Output of `HttpAdapter.execute()`.

| Field     | Type                     | Required | Description                                           |
| --------- | ------------------------ | -------- | ----------------------------------------------------- |
| `status`  | `number`                 | ✅       | HTTP status code                                      |
| `headers` | `Record<string, string>` | ✅       | Flattened response headers (lowercase keys)           |
| `body`    | `unknown`                | ✅       | Parsed JSON response body (null if empty/unparseable) |
| `ok`      | `boolean`                | ✅       | `true` if status is 200-299                           |

---

## Entity: ApiResponse\<T\>

Successful response wrapper returned by client methods.

| Field     | Type   | Required | Description                       |
| --------- | ------ | -------- | --------------------------------- |
| `success` | `true` | ✅       | Literal `true` for type narrowing |
| `data`    | `T`    | ✅       | Typed response payload            |

**Relationship**: Aligns with backend `APIResponse<T>` contract from `packages/types/src/api-response.ts`.

---

## Entity: ApiClient (Interface)

Public API surface of the client.

| Method      | Signature                                                                          | Description |
| ----------- | ---------------------------------------------------------------------------------- | ----------- |
| `get<T>`    | `(url: string, config?: RequestConfig) => Promise<ApiResponse<T>>`                 | HTTP GET    |
| `post<T>`   | `(url: string, data: unknown, config?: RequestConfig) => Promise<ApiResponse<T>>`  | HTTP POST   |
| `patch<T>`  | `(url: string, data: unknown, config?: RequestConfig) => Promise<ApiResponse<T>>`  | HTTP PATCH  |
| `put<T>`    | `(url: string, data: unknown, config?: RequestConfig) => Promise<ApiResponse<T>>`  | HTTP PUT    |
| `delete<T>` | `(url: string, data?: unknown, config?: RequestConfig) => Promise<ApiResponse<T>>` | HTTP DELETE |

**Validation rules**:

- No `any` types in public surface (FR-003)
- URL must not include base URL (prepended by client)
- All methods throw `AppError` on failure (never raw errors)

---

## Entity: MockAdapter (Test Utility)

Test implementation of `HttpAdapter`.

| Method               | Signature                                               | Description                                   |
| -------------------- | ------------------------------------------------------- | --------------------------------------------- |
| `enqueue`            | `(response: Partial<AdapterResponse>) => void`          | Add response to FIFO queue                    |
| `enqueueError`       | `(error: Error) => void`                                | Add network error to queue                    |
| `execute`            | `(request: AdapterRequest) => Promise<AdapterResponse>` | Dequeue and return next response              |
| `getRequests`        | `() => AdapterRequest[]`                                | Return all received requests (for assertions) |
| `getLastRequest`     | `() => AdapterRequest \| undefined`                     | Return most recent request                    |
| `reset`              | `() => void`                                            | Clear response queue and request log          |
| `assertRequestCount` | `(count: number) => void`                               | Assert exact number of requests made          |

---

## Interceptor Pipeline (Fixed Order)

```
Request flow:
  1. Auth Interceptor     → attaches Authorization header
  2. Correlation Interceptor → attaches X-Correlation-ID
  3. Content-Type Interceptor → attaches Content-Type: application/json (mutations)
  4. Idempotency Interceptor → attaches X-Idempotency-Key (mutations, if provided)
  5. Timeout Interceptor   → creates combined AbortSignal (timeout + caller signal)
  6. HttpAdapter.execute() → sends request

Response flow:
  1. JSON parse → AdapterResponse
  2. 401 Handler → single-flight refresh + retry
  3. Error Normalizer → AppError (for non-ok responses)
  4. Return ApiResponse<T> or throw AppError
```

---

## Error Code Enumeration

| Code                  | When Used                                            |
| --------------------- | ---------------------------------------------------- |
| `NETWORK_ERROR`       | DNS failure, connection reset, fetch TypeError       |
| `REQUEST_TIMEOUT`     | Timeout exceeded (AbortError from timeout signal)    |
| `REQUEST_CANCELLED`   | Caller-initiated abort (AbortError from user signal) |
| `RATE_LIMITED`        | HTTP 429 response                                    |
| `AUTH_REFRESH_FAILED` | Token refresh failed                                 |
| `INVALID_RESPONSE`    | Response body is not valid JSON                      |
| `UNKNOWN_ERROR`       | Catch-all for unexpected failures                    |
| `*` (backend code)    | Passthrough from backend `error.code` field          |
