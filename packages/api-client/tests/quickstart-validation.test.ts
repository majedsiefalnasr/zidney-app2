/**
 * T074 — Quickstart validation
 * Verifies all quickstart.md scenarios work as documented.
 */
import { describe, expect, it } from 'vitest'
import { createApiClient, createMockAdapter, ErrorCodes, isAppError } from '../src/index'

describe('quickstart validation', () => {
  function makeClient() {
    let currentToken = 'test-token'
    const mock = createMockAdapter()
    const client = createApiClient({
      baseUrl: 'https://test.api',
      getAccessToken: () => currentToken,
      onRefreshToken: async () => {
        currentToken = 'new-token'
        return currentToken
      },
      onAuthFailure: () => {},
      adapter: mock,
    })
    return { mock, client, getToken: () => currentToken }
  }

  it('fetches products (basic GET)', async () => {
    const { mock, client } = makeClient()

    mock.enqueue({
      status: 200,
      ok: true,
      body: { success: true, data: [{ id: '1', name: 'Test' }] },
      headers: {},
    })

    const result = await client.get<{ id: string; name: string }[]>('/products')
    expect(result.data).toHaveLength(1)

    const req = mock.getLastRequest()!
    expect(req.headers.Authorization).toBe('Bearer test-token')
    expect(req.headers['X-Correlation-ID']).toBeDefined()
  })

  it('creates product with idempotency key (POST)', async () => {
    const { mock, client } = makeClient()

    mock.enqueue({
      status: 201,
      ok: true,
      body: { success: true, data: { id: '2', name: 'New' } },
      headers: {},
    })

    const result = await client.post(
      '/products',
      { name: 'New' },
      {
        idempotencyKey: 'abc-123',
      }
    )
    expect(result.data).toEqual({ id: '2', name: 'New' })

    const req = mock.getLastRequest()!
    expect(req.headers['Idempotency-Key']).toBe('abc-123')
    expect(req.headers['Content-Type']).toBe('application/json')
  })

  it('handles error with isAppError', async () => {
    const { mock, client } = makeClient()

    mock.enqueue({
      status: 400,
      ok: false,
      body: {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Bad input' },
      },
      headers: {},
    })

    try {
      await client.get('/products')
      expect.fail('should have thrown')
    } catch (error) {
      expect(isAppError(error)).toBe(true)
      if (isAppError(error)) {
        expect(error.code).toBe('VALIDATION_ERROR')
        expect(error.message).toBe('Bad input')
      }
    }
  })

  it('handles 401 with transparent refresh', async () => {
    const { mock, client } = makeClient()

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
    // Retry → 200
    mock.enqueue({
      status: 200,
      ok: true,
      body: { success: true, data: { id: '1' } },
      headers: {},
    })

    const result = await client.get<{ id: string }>('/products/1')
    expect(result.data.id).toBe('1')
    mock.assertRequestCount(2)
  })

  it('surfaces 429 with retryAfter', async () => {
    const { mock, client } = makeClient()

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

  it('supports cancellation via AbortController', async () => {
    const { mock, client } = makeClient()

    mock.enqueueError(new DOMException('The operation was aborted.', 'AbortError'))

    const controller = new AbortController()
    controller.abort()

    try {
      await client.get('/products', { signal: controller.signal })
      expect.fail('should have thrown')
    } catch (error) {
      expect(isAppError(error)).toBe(true)
      if (isAppError(error)) {
        expect(error.code).toBe(ErrorCodes.REQUEST_CANCELLED)
        expect(error.isNetworkError).toBe(false)
      }
    }
  })

  it('supports custom timeout', async () => {
    const { mock, client } = makeClient()

    mock.enqueue({
      status: 200,
      ok: true,
      body: { success: true, data: { report: 'done' } },
      headers: {},
    })

    const result = await client.get('/reports/export', { timeout: 60000 })
    expect(result.data).toEqual({ report: 'done' })
  })

  it('includes correlation ID in every request', async () => {
    const { mock, client } = makeClient()

    mock.enqueue({
      status: 200,
      ok: true,
      body: { success: true, data: null },
      headers: {},
    })

    await client.get('/anything')
    const req = mock.getLastRequest()!
    const correlationId = req.headers['X-Correlation-ID'] as string | undefined
    expect(correlationId).toBeDefined()
    expect(typeof correlationId).toBe('string')
    expect(correlationId?.length).toBeGreaterThan(0)
  })

  it('allows custom correlation ID', async () => {
    const { mock, client } = makeClient()

    mock.enqueue({
      status: 200,
      ok: true,
      body: { success: true, data: null },
      headers: {},
    })

    await client.get('/anything', { correlationId: 'my-custom-id' })
    const req = mock.getLastRequest()!
    expect(req.headers['X-Correlation-ID']).toBe('my-custom-id')
  })
})
