import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFetchAdapter } from '../../src/adapters/fetch-adapter'
import type { AdapterRequest } from '../../src/types'

describe('FetchAdapter', () => {
  const adapter = createFetchAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const makeRequest = (overrides?: Partial<AdapterRequest>): AdapterRequest => ({
    url: 'https://api.test.com/data',
    method: 'GET',
    headers: { 'X-Custom': 'value' },
    ...overrides,
  })

  it('should call globalThis.fetch with correct URL and method', async () => {
    const mockResponse = new Response(JSON.stringify({ success: true, data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    await adapter.execute(makeRequest({ url: 'https://api.test.com/products', method: 'GET' }))

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test.com/products',
      expect.objectContaining({
        method: 'GET',
      })
    )
  })

  it('should pass headers to fetch', async () => {
    const mockResponse = new Response('{}', { status: 200 })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    await adapter.execute(
      makeRequest({
        headers: { Authorization: 'Bearer token', 'X-Test': 'yes' },
      })
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: 'Bearer token', 'X-Test': 'yes' },
      })
    )
  })

  it('should pass body to fetch for mutations', async () => {
    const mockResponse = new Response(JSON.stringify({ success: true, data: {} }), {
      status: 201,
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    const body = JSON.stringify({ name: 'Test' })
    await adapter.execute(makeRequest({ method: 'POST', body }))

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body,
      })
    )
  })

  it('should pass signal to fetch', async () => {
    const mockResponse = new Response('{}', { status: 200 })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)
    const controller = new AbortController()

    await adapter.execute(makeRequest({ signal: controller.signal }))

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: controller.signal,
      })
    )
  })

  it('should flatten response status, headers, body, and ok', async () => {
    const responseBody = { success: true, data: { id: 1 } }
    const mockResponse = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': '123' },
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    const result = await adapter.execute(makeRequest())

    expect(result.status).toBe(200)
    expect(result.ok).toBe(true)
    expect(result.body).toEqual(responseBody)
    expect(result.headers['content-type']).toBe('application/json')
    expect(result.headers['x-request-id']).toBe('123')
  })

  it('should set body to null when JSON parse fails', async () => {
    const mockResponse = new Response('not json', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    const result = await adapter.execute(makeRequest())

    expect(result.body).toBeNull()
    expect(result.status).toBe(200)
  })

  it('should return ok: false for non-2xx responses', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Not found' },
      }),
      { status: 404 }
    )
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    const result = await adapter.execute(makeRequest())

    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
  })

  it('should throw TypeError as-is on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(adapter.execute(makeRequest())).rejects.toThrow('Failed to fetch')
  })

  it('should apply credentials: include by default', async () => {
    const mockResponse = new Response('{}', { status: 200 })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    await adapter.execute(makeRequest())

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        credentials: 'include',
      })
    )
  })
})
