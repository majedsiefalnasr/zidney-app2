# @zidney/api-client

## Purpose

Typed HTTP client package for Vue stores and composables. Provides a unified, adapter-based API
client that abstracts `fetch` details and makes it easy to mock HTTP in tests.

---

## Responsibilities

- Provide a typed `ApiClient` with methods for all Zidney API domains
- Handle authentication token injection (JWT bearer header)
- Manage automatic token refresh on 401 responses (with concurrent refresh deduplication)
- Support pluggable adapters (`FetchAdapter` for production, `MockAdapter` for tests)
- Return typed responses with consistent error handling

---

## Dependencies

| Package         | Role                                     |
| --------------- | ---------------------------------------- |
| `@zidney/types` | Shared TypeScript response/request types |

> No framework dependencies — works with any Vue store or plain TypeScript module.

---

## How to Run Tests

```bash
# From repo root
bun run test run --project api-client

# From this directory
bun run test
```

---

## Environment Variables

None — base URL and token are provided by the consuming application at initialization time.

---

## Known Boundaries

- **No direct `fetch` usage** outside the `FetchAdapter` — all HTTP goes through the adapter
  interface
- Does not contain Vue or Pinia code — framework agnostic
- Does not import backend schemas or domain logic
- **Import rule**: may import from `packages/types` only; must not import from `apps/*`

---

## Public API

```typescript
import { createApiClient } from "@zidney/api-client";
import { FetchAdapter } from "@zidney/api-client/adapters";
import type { ApiClient, ApiAdapter, ApiResponse } from "@zidney/api-client";

// Create a client instance (e.g., in a Pinia store)
const client: ApiClient = createApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  adapter: new FetchAdapter(),
  getToken: () => authStore.token,
  onTokenRefresh: async () => authStore.refresh(),
});

// Make typed API calls
const response: ApiResponse<License[]> = await client.licenses.list();
const exam = await client.exams.get(examId);
```

**Exports**:

- `createApiClient` — factory function
- `FetchAdapter` — production HTTP adapter
- `MockAdapter` — test-time adapter with configurable response queue
- `ApiClient`, `ApiAdapter`, `ApiResponse`, `ApiError` — TypeScript types
