# STAGE_UI_02_API_CLIENT_LAYER

## Stage Type

UI Foundation — Centralized API Client Architecture

---

## Stage Status

Status: DRAFT
Risk Level: LOW
Last Updated: 2026-02-28T22:20:00Z

Tasks Generated:

- Total: 76 atomic tasks
- Setup: 12 tasks (package scaffold)
- P1 Stories: 19 tasks (typed client, auth, refresh, testability)
- P2 Stories: 18 tasks (errors, 429, idempotency, multi-app)
- P3 Stories: 10 tasks (cancellation, correlation)
- Migration: 9 tasks (MMC, Backoffice, Frontoffice)
- Lint/Polish: 8 tasks

Deferred Scope:

- Business endpoint implementations
- WebSocket/SSE communication
- File upload / multipart support

Constitutional Compliance:

- Task set compliant — drift analysis required before implementation

Notes:
Atomic task set generated. Drift analysis gate pending.

---

## Purpose

Define the canonical HTTP communication layer shared across:

- MMC
- Backoffice
- Frontoffice

This stage establishes:

- Typed API client abstraction
- Request/response normalization
- Auth token injection
- Automatic refresh retry logic
- Error normalization pipeline
- Idempotency header support
- Rate-limit surface handling

No component may call fetch/axios directly after this stage.

---

## Constitutional Constraints

Frontend API layer must:

- Never call database directly
- Never construct raw SQL
- Never infer business rules from responses
- Never enforce license logic
- Never infer RBAC from JWT payload
- Never bypass centralized client

All HTTP traffic flows through a single client abstraction.

---

## Architectural Design

### Single Entry Point

All HTTP calls must pass through:

```
src/core/api/client.ts
```

No other file may import `fetch`, `axios`, or similar directly.

---

### Client Responsibilities

The client must:

- Attach Authorization header (if authenticated)
- Handle 401 → trigger refresh flow
- Normalize backend error format
- Surface rate-limit information
- Support request cancellation
- Support idempotency keys (optional per request)
- Support typed generics for responses

---

## Folder Structure

```
core/
  api/
    client.ts
    types.ts
    interceptors.ts
    http-error.ts
```

Feature modules may define:

```
modules/<feature>/api.ts
```

But they must import and use `core/api/client.ts`.

---

## Request Lifecycle

1. Module calls API function (e.g., products.api.ts)
2. API function calls client.request<T>()
3. Client attaches:
   - Authorization header
   - Correlation ID (optional)
   - Idempotency-Key (if provided)
4. Request sent
5. Response received
6. Error normalization applied
7. Data returned to caller

No raw Response objects passed upward.

---

## Type-Safe Design

Client must support:

```
client.get<T>(url, config?)
client.post<T>(url, body, config?)
client.patch<T>(...)
client.delete<T>(...)
```

Rules:

- No `any`
- Generic type parameter mandatory
- All API modules define request/response DTOs
- Types must align with backend contracts

---

## 401 + Refresh Strategy

If backend returns 401:

1. Client triggers AuthModule.refresh()
2. Wait for refresh resolution (single-flight)
3. Retry original request once
4. If retry fails → propagate error

No infinite loops.
No more than 1 retry.

---

## Error Normalization

Backend standard error contract assumed:

```
{
  code: string
  message: string
  httpStatus: number
}
```

Client must convert any network or unexpected error into:

```
AppError {
  code: string
  message: string
  httpStatus: number
  isNetworkError: boolean
}
```

UI must consume AppError only.

---

## Rate Limiting Handling

If backend returns 429:

Client must:

- Surface error as AppError
- Expose retryAfter (if header exists)
- Not auto-retry 429
- Allow UI to show appropriate message

No hidden retries.

---

## Idempotency Support

For endpoints requiring idempotency:

Client must support:

```
client.post<T>(url, body, {
  idempotencyKey: string
})
```

Rules:

- Idempotency header added only if provided
- Client does not generate keys automatically
- Caller responsible for key generation

---

## Multi-App Considerations

MMC:

- Platform API base URL
- No workspace prefix

Backoffice:

- Workspace-scoped API base (resolved from subdomain or path)
- WorkspaceGuard must run before API calls

Frontoffice:

- Student runtime API base
- Attempt engine protected by backend only

API client must be configurable per app via env.ts.

---

## Testability Requirements

Must support:

- Mocked HTTP adapter
- Interceptor unit testing
- 401 refresh race simulation
- 429 handling tests
- Network failure simulation
- Typed DTO verification

Client must be injectable for testing.

---

## Explicit Non-Goals

This stage does NOT:

- Define business endpoints
- Implement products API
- Implement license API
- Implement affiliates API
- Implement attempt API
- Implement pagination UI logic

Only infrastructure.

---

## Completion Criteria

Stage considered complete when:

- client.ts implemented
- All HTTP calls in runtime use client
- No direct fetch/axios in codebase
- Error normalization working
- 401 refresh retry tested
- 429 surfaced properly
- Idempotency header supported
- CI passes lint + TypeScript
- No TODO placeholders in API layer

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
