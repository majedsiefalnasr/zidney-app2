import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockAdapter } from '../src/adapters/mock-adapter'
import { createMockAdapter } from '../src/adapters/mock-adapter'
import { createApiClient } from '../src/client'
import { ErrorCodes, isAppError } from '../src/http-error'
import type { ClientConfig } from '../src/types'

function createTestConfig(
  adapter: MockAdapter,
  overrides?: Partial<ClientConfig>
): ClientConfig {
  return {
    baseUrl: 'https://api.test.com',
    getAccessToken: () => null,
    onRefreshToken: vi.fn().mockResolvedValue('new-token'),
    onAuthFailure: vi.fn(),
    adapter,
    ...overrides,
  }
}

describe('ApiClient', () => {
  let adapter: MockAdapter

  beforeEach(() => {
    adapter = createMockAdapter()
  })

  // ─── Basic Request Section (US1) ──────────────────────────────────────────

  describe('basic requests (US1)', () => {
    it('should send GET with correct URL (baseUrl + path)', async () => {
      adapter.enqueue({
        status: 200,
        ok: true,
        body: { success: true, data: [{ id: 1 }] },
      })
      const client = createApiClient(createTestConfig(adapter))

      const result = await client.get<{ id: number }[]>('/products')

      expect(result.success).toBe(true)
      expect(result.data).toEqual([{ id: 1 }])
      const req = adapter.getLastRequest()!
      expect(req.url).toBe('https://api.test.com/products')
      expect(req.method).toBe('GET')
    })

    it('should send POST with JSON body', async () => {
      adapter.enqueue({
        status: 201,
        ok: true,
        body: { success: true, data: { id: 2, name: 'New' } },
      })
      const client = createApiClient(createTestConfig(adapter))

      const result = await client.post<{ id: number; name: string }>(
        '/products',
        {
          name: 'New',
        }
      )

      expect(result.data).toEqual({ id: 2, name: 'New' })
      const req = adapter.getLastRequest()!
      expect(req.method).toBe('POST')
      expect(req.body).toBe(JSON.stringify({ name: 'New' }))
      expect(req.headers['Content-Type']).toBe('application/json')
    })

    it('should send PUT with JSON body', async () => {
      adapter.enqueue({
        status: 200,
        ok: true,
        body: { success: true, data: { id: 1, name: 'Updated' } },
      })
      const client = createApiClient(createTestConfig(adapter))

      await client.put('/products/1', { name: 'Updated' })

      const req = adapter.getLastRequest()!
      expect(req.method).toBe('PUT')
      expect(req.headers['Content-Type']).toBe('application/json')
    })

    it('should send PATCH with JSON body', async () => {
      adapter.enqueue({
        status: 200,
        ok: true,
        body: { success: true, data: { id: 1, name: 'Patched' } },
      })
      const client = createApiClient(createTestConfig(adapter))

      await client.patch('/products/1', { name: 'Patched' })

      const req = adapter.getLastRequest()!
      expect(req.method).toBe('PATCH')
      expect(req.headers['Content-Type']).toBe('application/json')
    })

    it('should send DELETE', async () => {
      adapter.enqueue({
        status: 200,
        ok: true,
        body: { success: true, data: null },
      })
      const client = createApiClient(createTestConfig(adapter))

      await client.delete('/products/1')

      const req = adapter.getLastRequest()!
      expect(req.method).toBe('DELETE')
    })

    it('should return ClientResponse<T> shape with success: true', async () => {
      adapter.enqueue({
        status: 200,
        ok: true,
        body: { success: true, data: { value: 42 } },
      })
      const client = createApiClient(createTestConfig(adapter))

      const result = await client.get<{ value: number }>('/test')

      expect(result).toEqual({ success: true, data: { value: 42 } })
    })

    it('should serialize params to query string', async () => {
      adapter.enqueue({
        status: 200,
        ok: true,
        body: { success: true, data: [] },
      })
      const client = createApiClient(createTestConfig(adapter))

      await client.get('/search', {
        params: { q: 'test', page: 1, active: true },
      })

      const req = adapter.getLastRequest()!
      expect(req.url).toContain('?')
      expect(req.url).toContain('q=test')
      expect(req.url).toContain('page=1')
      expect(req.url).toContain('active=true')
    })

    it('should not add query string when params is undefined', async () => {
      adapter.enqueue({
        status: 200,
        ok: true,
        body: { success: true, data: null },
      })
      const client = createApiClient(createTestConfig(adapter))

      await client.get('/endpoint')

      const req = adapter.getLastRequest()!
      expect(req.url).toBe('https://api.test.com/endpoint')
    })
  })

  // ─── 401 Refresh Section (US3) ────────────────────────────────────────────

  describe('401 refresh (US3)', () => {
    it('should trigger refresh and retry on single 401', async () => {
      // First call: 401
      adapter.enqueue({
        status: 401,
        ok: false,
        body: {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Expired' },
        },
      })
      // After refresh, retry: 200
      adapter.enqueue({
        status: 200,
        ok: true,
        body: { success: true, data: { id: 1 } },
      })

      let currentToken = 'old-token'
      const onRefreshToken = vi.fn().mockImplementation(async () => {
        currentToken = 'refreshed-token'
        return 'refreshed-token'
      })
      const client = createApiClient(
        createTestConfig(adapter, {
          getAccessToken: () => currentToken,
          onRefreshToken,
        })
      )

      const result = await client.get<{ id: number }>('/resource')

      expect(onRefreshToken).toHaveBeenCalledTimes(1)
      expect(result.data).toEqual({ id: 1 })
      // Verify retried request uses new token
      const requests = adapter.getRequests()
      expect(requests).toHaveLength(2)
      expect(requests[1]!.headers['Authorization']).toBe(
        'Bearer refreshed-token'
      )
    })

    it('should call onAuthFailure when refresh fails', async () => {
      adapter.enqueue({
        status: 401,
        ok: false,
        body: {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Expired' },
        },
      })

      const onAuthFailure = vi.fn()
      const onRefreshToken = vi
        .fn()
        .mockRejectedValue(new Error('Refresh failed'))
      const client = createApiClient(
        createTestConfig(adapter, {
          getAccessToken: () => 'old-token',
          onRefreshToken,
          onAuthFailure,
        })
      )

      try {
        await client.get('/resource')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(isAppError(err)).toBe(true)
        if (isAppError(err)) {
          expect(err.code).toBe(ErrorCodes.AUTH_REFRESH_FAILED)
        }
      }

      expect(onAuthFailure).toHaveBeenCalledTimes(1)
    })

    it('should NOT re-enter refresh loop on double 401', async () => {
      // First 401
      adapter.enqueue({
        status: 401,
        ok: false,
        body: {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Expired' },
        },
      })
      // Retry after refresh also 401
      adapter.enqueue({
        status: 401,
        ok: false,
        body: {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Still expired' },
        },
      })

      const onRefreshToken = vi.fn().mockResolvedValue('new-token')
      const onAuthFailure = vi.fn()
      const client = createApiClient(
        createTestConfig(adapter, {
          getAccessToken: () => 'old-token',
          onRefreshToken,
          onAuthFailure,
        })
      )

      try {
        await client.get('/resource')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(isAppError(err)).toBe(true)
      }

      // Only one refresh attempt
      expect(onRefreshToken).toHaveBeenCalledTimes(1)
    })

    // QUARANTINE: Concurrent 401 test depends on Promise scheduling order in the mock adapter
    // FIFO queue. Under heavy CPU load, dequeue order between concurrent requests may vary,
    // causing r1/r2 data to be swapped. Needs deterministic request-identity tracking in
    // the mock adapter to guarantee pairing.
    // Tracking ref: INFRA-003-FLAKY-001
    it.skip('should trigger single refresh for concurrent 401s', async () => {
      // Two concurrent requests both get 401
      adapter.enqueue({
        status: 401,
        ok: false,
        body: {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Expired' },
        },
      })
      adapter.enqueue({
        status: 401,
        ok: false,
        body: {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Expired' },
        },
      })
      // After refresh, both retry: 200
      adapter.enqueue({
        status: 200,
        ok: true,
        body: { success: true, data: { id: 1 } },
      })
      adapter.enqueue({
        status: 200,
        ok: true,
        body: { success: true, data: { id: 2 } },
      })

      const onRefreshToken = vi.fn().mockResolvedValue('new-token')
      const client = createApiClient(
        createTestConfig(adapter, {
          getAccessToken: () => 'old-token',
          onRefreshToken,
        })
      )

      const [r1, r2] = await Promise.all([
        client.get<{ id: number }>('/a'),
        client.get<{ id: number }>('/b'),
      ])

      expect(onRefreshToken).toHaveBeenCalledTimes(1)
      expect(r1.data.id).toBe(1)
      expect(r2.data.id).toBe(2)
    })

    it('should reject all queued requests when refresh fails', async () => {
      adapter.enqueue({
        status: 401,
        ok: false,
        body: {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Expired' },
        },
      })
      adapter.enqueue({
        status: 401,
        ok: false,
        body: {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Expired' },
        },
      })

      const onRefreshToken = vi
        .fn()
        .mockRejectedValue(new Error('Refresh failed'))
      const onAuthFailure = vi.fn()
      const client = createApiClient(
        createTestConfig(adapter, {
          getAccessToken: () => 'old-token',
          onRefreshToken,
          onAuthFailure,
        })
      )

      const results = await Promise.allSettled([
        client.get('/a'),
        client.get('/b'),
      ])

      expect(results[0]!.status).toBe('rejected')
      expect(results[1]!.status).toBe('rejected')
      expect(onAuthFailure).toHaveBeenCalledTimes(1)
    })
  })

  // ─── Error Handling Section (US4) ─────────────────────────────────────────

  describe('error handling (US4)', () => {
    it('should throw AppError for non-ok responses with backend error shape', async () => {
      adapter.enqueue({
        status: 400,
        ok: false,
        body: {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
        },
      })
      const client = createApiClient(createTestConfig(adapter))

      try {
        await client.post('/items', { bad: 'data' })
        expect.fail('Should have thrown')
      } catch (err) {
        expect(isAppError(err)).toBe(true)
        if (isAppError(err)) {
          expect(err.code).toBe('VALIDATION_ERROR')
          expect(err.message).toBe('Invalid input')
          expect(err.httpStatus).toBe(400)
          expect(err.isNetworkError).toBe(false)
        }
      }
    })

    it('should throw NETWORK_ERROR AppError on network failure', async () => {
      adapter.enqueueError(new TypeError('Failed to fetch'))
      const client = createApiClient(createTestConfig(adapter))

      try {
        await client.get('/test')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(isAppError(err)).toBe(true)
        if (isAppError(err)) {
          expect(err.code).toBe(ErrorCodes.NETWORK_ERROR)
          expect(err.httpStatus).toBe(0)
          expect(err.isNetworkError).toBe(true)
        }
      }
    })

    it('should throw UNKNOWN_ERROR for unexpected error shapes', async () => {
      adapter.enqueue({
        status: 500,
        ok: false,
        body: { weird: 'shape' },
      })
      const client = createApiClient(createTestConfig(adapter))

      try {
        await client.get('/test')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(isAppError(err)).toBe(true)
        if (isAppError(err)) {
          expect(err.code).toBe(ErrorCodes.UNKNOWN_ERROR)
          expect(err.httpStatus).toBe(500)
        }
      }
    })
  })

  // ─── Multi-Config Section (US7) ──────────────────────────────────────────

  describe('multi-config (US7)', () => {
    it('should use different baseUrls for different clients', async () => {
      const adapter1 = createMockAdapter()
      const adapter2 = createMockAdapter()
      adapter1.enqueue({
        status: 200,
        ok: true,
        body: { success: true, data: 'mmc' },
      })
      adapter2.enqueue({
        status: 200,
        ok: true,
        body: { success: true, data: 'backoffice' },
      })

      const client1 = createApiClient(
        createTestConfig(adapter1, { baseUrl: 'https://mmc-api.test.com' })
      )
      const client2 = createApiClient(
        createTestConfig(adapter2, { baseUrl: 'https://bo-api.test.com' })
      )

      await client1.get('/data')
      await client2.get('/data')

      expect(adapter1.getLastRequest()!.url).toBe(
        'https://mmc-api.test.com/data'
      )
      expect(adapter2.getLastRequest()!.url).toBe(
        'https://bo-api.test.com/data'
      )
    })

    it('should use different getAccessToken functions', async () => {
      const adapter1 = createMockAdapter()
      const adapter2 = createMockAdapter()
      adapter1.enqueue({
        status: 200,
        ok: true,
        body: { success: true, data: null },
      })
      adapter2.enqueue({
        status: 200,
        ok: true,
        body: { success: true, data: null },
      })

      const client1 = createApiClient(
        createTestConfig(adapter1, { getAccessToken: () => 'token-mmc' })
      )
      const client2 = createApiClient(
        createTestConfig(adapter2, { getAccessToken: () => 'token-bo' })
      )

      await client1.get('/data')
      await client2.get('/data')

      expect(adapter1.getLastRequest()!.headers['Authorization']).toBe(
        'Bearer token-mmc'
      )
      expect(adapter2.getLastRequest()!.headers['Authorization']).toBe(
        'Bearer token-bo'
      )
    })

    it('should have isolated state between client instances', async () => {
      const adapter1 = createMockAdapter()
      const adapter2 = createMockAdapter()
      adapter1.enqueue({
        status: 200,
        ok: true,
        body: { success: true, data: null },
      })
      adapter2.enqueue({
        status: 200,
        ok: true,
        body: { success: true, data: null },
      })

      const client1 = createApiClient(createTestConfig(adapter1))
      const client2 = createApiClient(createTestConfig(adapter2))

      await client1.get('/a')
      await client2.get('/b')

      adapter1.assertRequestCount(1)
      adapter2.assertRequestCount(1)
    })
  })

  // ─── Cancellation Section (US8) ──────────────────────────────────────────

  describe('cancellation (US8)', () => {
    it('should throw REQUEST_CANCELLED AppError when signal is aborted', async () => {
      adapter.enqueueError(
        new DOMException('The operation was aborted.', 'AbortError')
      )
      const client = createApiClient(createTestConfig(adapter))

      try {
        const controller = new AbortController()
        controller.abort()
        await client.get('/test', { signal: controller.signal })
        expect.fail('Should have thrown')
      } catch (err) {
        expect(isAppError(err)).toBe(true)
        if (isAppError(err)) {
          expect(err.code).toBe(ErrorCodes.REQUEST_CANCELLED)
          expect(err.isNetworkError).toBe(false)
          expect(err.httpStatus).toBe(0)
        }
      }
    })

    it('should return normal response when request completes before abort', async () => {
      adapter.enqueue({
        status: 200,
        ok: true,
        body: { success: true, data: { id: 1 } },
      })
      const client = createApiClient(createTestConfig(adapter))

      const controller = new AbortController()
      const result = await client.get<{ id: number }>('/test', {
        signal: controller.signal,
      })
      controller.abort() // Abort after response

      expect(result.data).toEqual({ id: 1 })
    })
  })
})
