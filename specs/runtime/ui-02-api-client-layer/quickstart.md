# Quickstart: API Client Layer

**Feature**: UI-02 API Client Layer
**Date**: 2026-03-01

---

## What This Stage Delivers

A centralized, typed HTTP client package (`@zidney/api-client`) that replaces the duplicated `core/api/client.ts` in all three frontend apps. After this stage:

- All HTTP calls go through one shared abstraction
- Auth token injection and 401 refresh are handled transparently
- All errors are normalized to `AppError`
- Tests use `MockAdapter` — no network calls needed
- ESLint prevents direct `fetch`/`axios` usage in app code

---

## Package Installation

The package is a workspace dependency. In each app's `package.json`:

```json
{
  "dependencies": {
    "@zidney/api-client": "workspace:*"
  }
}
```

---

## Basic Usage

### 1. Configure the client (once per app)

```typescript
// apps/mmc/src/core/api/client.ts
import { createApiClient, createFetchAdapter } from '@zidney/api-client'
import { appConfig } from '@/core/config/app-config'
import { useAuthStore } from '@/core/auth/token-store'

let _client: ReturnType<typeof createApiClient> | null = null

export function getApiClient() {
  if (!_client) {
    const auth = useAuthStore()
    _client = createApiClient({
      baseUrl: appConfig.env.apiBaseUrl,
      getAccessToken: () => auth.getAccessToken(),
      onRefreshToken: async () => {
        const response = await fetch(
          `${appConfig.env.apiBaseUrl}/auth/refresh`,
          {
            method: 'POST',
            credentials: 'include',
          }
        )
        const data = await response.json()
        auth.setAccessToken(data.data.accessToken)
        return data.data.accessToken
      },
      onAuthFailure: () => {
        auth.clearAccessToken()
        // Navigate to login
      },
      adapter: createFetchAdapter(),
    })
  }
  return _client
}
```

### 2. Use in feature modules

```typescript
// apps/mmc/src/modules/products/api.ts
import { getApiClient } from '@/core/api/client'
import type { Product } from './types'

const client = getApiClient()

export async function fetchProducts() {
  return client.get<Product[]>('/products')
}

export async function createProduct(
  data: CreateProductDTO,
  idempotencyKey: string
) {
  return client.post<Product>('/products', data, { idempotencyKey })
}
```

### 3. Handle errors

```typescript
import { isAppError, ErrorCodes } from '@zidney/api-client'

try {
  const { data } = await fetchProducts()
  // use data (typed as Product[])
} catch (error) {
  if (isAppError(error)) {
    if (error.code === ErrorCodes.RATE_LIMITED) {
      showToast(
        `Rate limited. Retry in ${error.retryAfter ?? 'a few'} seconds.`
      )
    } else if (error.isNetworkError) {
      showToast('Network error. Check your connection.')
    } else {
      showToast(error.message)
    }
  }
}
```

### 4. Cancel requests

```typescript
const controller = new AbortController()

// Start request
const promise = client.get<Product[]>('/products', {
  signal: controller.signal,
})

// Cancel on navigation
onBeforeUnmount(() => controller.abort())
```

### 5. Custom timeout

```typescript
// Override default 30s timeout
const { data } = await client.get<HeavyReport>('/reports/export', {
  timeout: 60000, // 60 seconds
})
```

---

## Testing

```typescript
import { createApiClient, createMockAdapter } from '@zidney/api-client'

const mock = createMockAdapter()
const client = createApiClient({
  baseUrl: 'https://test.api',
  getAccessToken: () => 'test-token',
  onRefreshToken: async () => 'new-token',
  onAuthFailure: () => {},
  adapter: mock,
})

it('fetches products', async () => {
  mock.enqueue({
    status: 200,
    ok: true,
    body: { success: true, data: [{ id: '1', name: 'Test' }] },
    headers: {},
  })

  const result = await client.get<Product[]>('/products')
  expect(result.data).toHaveLength(1)

  const req = mock.getLastRequest()!
  expect(req.headers['Authorization']).toBe('Bearer test-token')
  expect(req.headers['X-Correlation-ID']).toBeDefined()
})

it('handles 401 with transparent refresh', async () => {
  // First call → 401
  mock.enqueue({
    status: 401,
    ok: false,
    body: {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'expired' },
    },
    headers: {},
  })
  // Refresh call succeeds (client internally calls onRefreshToken)
  // Retry → 200
  mock.enqueue({
    status: 200,
    ok: true,
    body: { success: true, data: { id: '1' } },
    headers: {},
  })

  const result = await client.get<Product>('/products/1')
  expect(result.data.id).toBe('1')
  mock.assertRequestCount(2) // original + retry
})

it('surfaces 429 with retryAfter', async () => {
  mock.enqueue({
    status: 429,
    ok: false,
    body: {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests' },
    },
    headers: { 'retry-after': '30' },
  })

  await expect(client.post('/submit', {})).rejects.toMatchObject({
    code: 'RATE_LIMITED',
    httpStatus: 429,
    retryAfter: 30,
    isNetworkError: false,
  })
})
```

---

## Key Constraints (Do NOT Violate)

1. **No direct `fetch`/`axios`** in `apps/*/src/` — ESLint will error
2. **No `any` types** in client public API
3. **No business logic** in the client — it's pure transport
4. **No token parsing** — client attaches JWT, never decodes it
5. **JSON only** — no `FormData`, no blobs, no multipart
6. **No internal logging** — errors propagated as `AppError`, caller handles observability
7. **No auto-retry on network errors** — only 401 triggers retry (after refresh)
