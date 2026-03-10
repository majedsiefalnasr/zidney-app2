# Research: API Client Layer

**Feature**: UI-02 API Client Layer **Date**: 2026-03-01 **Status**: Complete — all unknowns
resolved

---

## R-1: Shared Package Location

**Decision**: `packages/api-client` — new standalone package **Rationale**: HTTP client is
framework-agnostic (no Vue dependency). Existing `packages/ui-system` is tightly coupled to Vue 3 +
shadcn-vue components. Separate package:

- Keeps dependency graph clean (zero deps)
- Can be independently versioned
- Follows existing monorepo convention (`packages/types`, `packages/validation`, `packages/logger`)
- Enables consumption by non-Vue tools if needed later (e.g., CLI scripts)

**Alternatives considered**:

1. `packages/ui-system/src/core/api/` — rejected: pollutes Vue component package with HTTP
   infrastructure
2. Inline in each app's `core/api/` (current state) — rejected: produces identical code duplication
   across 3 apps (confirmed: all three `client.ts` files are identical)

---

## R-2: HttpAdapter Interface Design

**Decision**: Single-method interface `execute(request: AdapterRequest): Promise<AdapterResponse>`

**Rationale**:

- Current approach passes `fetchFn: typeof fetch` as parameter — insufficient for mocking response
  headers (e.g., `Retry-After`), abort behavior, and timeout simulation
- Single method avoids over-abstraction; all HTTP semantics captured in request/response objects
- Adapter owns: URL construction, body serialization, timeout enforcement, signal propagation
- Client owns: interceptor pipeline, error normalization, auth refresh

**AdapterRequest shape**:

```typescript
interface AdapterRequest {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers: Record<string, string>;
  body?: string; // Already JSON.stringify'd
  signal?: AbortSignal;
  timeout: number; // ms, 0 = no timeout
}
```

**AdapterResponse shape**:

```typescript
interface AdapterResponse {
  status: number;
  headers: Record<string, string>; // Flattened from Headers object
  body: unknown; // Already JSON.parsed
  ok: boolean;
}
```

**Alternatives considered**:

1. Multi-method interface (`get()`, `post()`, etc.) — rejected: duplicates client's typed methods;
   adapter is transport-only
2. Wrapping `fetch` Response directly — rejected: leaks browser API; hard to mock in tests
3. Axios-style interceptor chain on adapter — rejected: over-engineering; client handles interceptor
   logic

---

## R-3: Timeout Implementation Strategy

**Decision**: Adapter-level timeout using `AbortController` with `AbortSignal.timeout()` where
available, fallback to manual `setTimeout` + `abort()`

**Rationale**:

- `AbortSignal.timeout(ms)` is available in all modern browsers (Chrome 103+, Firefox 100+, Safari
  16+)
- Fallback ensures compatibility with older test environments
- Both caller-provided `signal` and timeout signal combined via `AbortSignal.any()` (or manual
  combination)
- Default: 30,000ms (30 seconds) per spec FR-024

**Implementation approach**:

```typescript
function createTimeoutSignal(timeout: number, userSignal?: AbortSignal): AbortSignal {
  const signals: AbortSignal[] = [];
  if (timeout > 0) signals.push(AbortSignal.timeout(timeout));
  if (userSignal) signals.push(userSignal);
  return signals.length > 1 ? AbortSignal.any(signals) : signals[0]!;
}
```

**Alternatives considered**:

1. `Promise.race` with timeout — rejected: doesn't abort the actual fetch; wastes resources
2. Manual `setTimeout` only — rejected: `AbortSignal.timeout()` is cleaner and garbage-collects
   automatically

---

## R-4: Error Normalization Pipeline

**Decision**: Transform all error scenarios into `AppError` plain object at the client boundary

**Rationale**: Current `NormalizedError` in `core/errors/types.ts` lacks:

- `isNetworkError: boolean` (spec FR-010)
- `retryAfter?: number` (spec FR-011)
- Timeout vs cancellation distinction
- Network error vs HTTP error distinction

**AppError shape** (superset of current `NormalizedError`):

```typescript
interface AppError {
  code: string;
  message: string;
  httpStatus: number;
  isNetworkError: boolean;
  retryAfter?: number; // seconds, from Retry-After header on 429
}
```

**Error mapping table**: | Scenario | code | httpStatus | isNetworkError | retryAfter |
|----------|------|------------|----------------|------------| | Network failure (DNS, connection
reset) | `NETWORK_ERROR` | 0 | `true` | — | | Request timeout (30s exceeded) | `REQUEST_TIMEOUT` | 0
| `true` | — | | User cancellation (AbortSignal) | `REQUEST_CANCELLED` | 0 | `false` | — | | Backend
structured error `{ success: false, error: { code, message } }` | backend code | HTTP status |
`false` | — | | 429 with Retry-After header | `RATE_LIMITED` | 429 | `false` | parsed value | | 429
without Retry-After | `RATE_LIMITED` | 429 | `false` | `undefined` | | Unexpected response shape |
`UNKNOWN_ERROR` | HTTP status | `false` | — | | JSON parse failure on response | `INVALID_RESPONSE`
| HTTP status | `false` | — | | Auth refresh failure | `AUTH_REFRESH_FAILED` | 401 | `false` | — |

**Alternatives considered**:

1. Class-based `AppError extends Error` — rejected: prototype chain issues in monorepo, breaks
   structured clone
2. Union type with discriminated variants — rejected: over-complex for consumer; single flat object
   with flags is simpler

---

## R-5: 401 Single-Flight Refresh Design

**Decision**: Keep the current proven pattern with queue-based single-flight, but extract it into
the shared `interceptors.ts`

**Current implementation analysis** (identical in all 3 apps):

- ✅ Single-flight via `refreshPromise` reference
- ✅ Queue-based retry (all waiting requests retried after refresh)
- ✅ Failure propagation (all queued requests rejected on refresh failure)
- ⚠️ Hardcoded refresh URL (`/auth/refresh`)
- ⚠️ Direct `tokenStore.setAccessToken()` coupling
- ⚠️ Direct router navigation on failure (`storeWithRouter.router?.push('/login')`)

**Changes needed**:

1. Make refresh function injectable via `ClientConfig.onRefreshToken: () => Promise<string>`
2. Make auth failure callback injectable via `ClientConfig.onAuthFailure: () => void`
3. Keep queue mechanics as-is (proven correct)
4. Add protection: if retried request returns 401 again, do NOT re-enter refresh loop

**Alternatives considered**:

1. Event-based refresh (emit event, let app handle) — rejected: breaks transparent retry requirement
2. Mutex/semaphore library — rejected: over-engineering; simple promise reference sufficient

---

## R-6: Lint Rule for Direct fetch/axios Prevention

**Decision**: Add `no-restricted-imports` and `no-restricted-globals` ESLint rules targeting
`fetch`, `axios`, `got`, `ky`, `node-fetch`

**Implementation**:

```javascript
// In eslint.config.mjs, scoped to apps/*/src/** (not packages/api-client)
{
  files: ['apps/*/src/**/*.ts', 'apps/*/src/**/*.vue'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        { name: 'axios', message: 'Use @zidney/api-client instead' },
        { name: 'got', message: 'Use @zidney/api-client instead' },
        { name: 'ky', message: 'Use @zidney/api-client instead' },
        { name: 'node-fetch', message: 'Use @zidney/api-client instead' },
      ]
    }],
    'no-restricted-globals': ['error', {
      name: 'fetch',
      message: 'Use @zidney/api-client instead of direct fetch(). Import from core/api/client.ts.'
    }]
  }
}
```

**Scope**: Only in `apps/*/src/**` — `packages/api-client/src/adapters/fetch-adapter.ts` is exempted
since it IS the fetch wrapper.

**Alternatives considered**:

1. Custom ESLint plugin — rejected: `no-restricted-imports` + `no-restricted-globals` are built-in
   and sufficient
2. Only documentation enforcement — rejected: not machine-enforceable; violations will slip through

---

## R-7: Per-App Configuration Pattern

**Decision**: Each app creates its `ClientConfig` from existing `env.ts` + auth store

**Configuration shape**:

```typescript
interface ClientConfig {
  baseUrl: string; // From env.ts apiBaseUrl
  defaultTimeout: number; // 30000 (or override)
  getAccessToken: () => string | null; // From auth store
  onRefreshToken: () => Promise<string>; // Calls refresh endpoint
  onAuthFailure: () => void; // Navigate to login
}
```

**Per-app mapping**: | App | baseUrl source | Auth store | |-----|---------------|------------| |
MMC | `appConfig.env.apiBaseUrl` (platform API) | `useAuthStore()` | | Backoffice |
`appConfig.env.apiBaseUrl` (workspace-scoped) | `useAuthStore()` | | Frontoffice |
`appConfig.env.apiBaseUrl` (student runtime) | `useAuthStore()` |

**No env.ts changes needed** — all three apps already have `VITE_API_BASE_URL` and
`createEnvConfig()`.

---

## R-8: MockAdapter Design for Testing

**Decision**: `MockAdapter` class implementing `HttpAdapter` with a response queue

```typescript
class MockAdapter implements HttpAdapter {
  private responses: AdapterResponse[] = [];
  private requests: AdapterRequest[] = [];

  enqueue(response: Partial<AdapterResponse>): void; // Add response to queue
  async execute(request: AdapterRequest): Promise<AdapterResponse>; // Dequeue next response
  getRequests(): AdapterRequest[]; // Inspect sent requests
  reset(): void; // Clear state
}
```

**Rationale**:

- Queue-based: supports multi-request test scenarios (e.g., 401 → refresh → retry)
- Request recording: enables assertion on headers, body, URL construction
- Deterministic: no flaky timing issues
- Lightweight: no dependencies

**Alternatives considered**:

1. `msw` (Mock Service Worker) — rejected: heavy dependency; operates at network level which is more
   than needed for unit tests
2. `vi.fn()` spies — rejected: loses type safety; can't simulate sequential responses cleanly

---

## R-9: Content-Type Scope

**Decision**: JSON-only (`application/json`) for this stage per spec FR-026

**Implications**:

- `Content-Type: application/json` header set on all mutation requests (POST, PUT, PATCH)
- Request body always `JSON.stringify(data)`
- Response body always `response.json()`
- No `multipart/form-data`, no `FormData`, no blob handling
- File upload deferred to dedicated future stage

---

## R-10: Package Dependency Graph

```
packages/api-client  (NEW — zero dependencies)
    ↑
apps/mmc/src/core/api/          → imports @zidney/api-client
apps/backoffice/src/core/api/   → imports @zidney/api-client
apps/frontoffice/src/core/api/  → imports @zidney/api-client
```

No circular dependencies. No framework dependencies. Package is pure TypeScript.
