import { beforeEach, describe, expect, it } from 'vitest'
import type { MockAdapter } from '../../src/adapters/mock-adapter'
import { createMockAdapter } from '../../src/adapters/mock-adapter'
import type { AdapterRequest } from '../../src/types'

describe('MockAdapter', () => {
  let adapter: MockAdapter

  beforeEach(() => {
    adapter = createMockAdapter()
  })

  const makeRequest = (
    overrides?: Partial<AdapterRequest>
  ): AdapterRequest => ({
    url: 'https://api.test.com/endpoint',
    method: 'GET',
    headers: {},
    ...overrides,
  })

  describe('enqueue/dequeue responses', () => {
    it('should return enqueued response in FIFO order', async () => {
      adapter.enqueue({
        status: 200,
        ok: true,
        headers: {},
        body: { data: 'first' },
      })
      adapter.enqueue({
        status: 201,
        ok: true,
        headers: {},
        body: { data: 'second' },
      })

      const first = await adapter.execute(makeRequest())
      const second = await adapter.execute(makeRequest())

      expect(first.body).toEqual({ data: 'first' })
      expect(first.status).toBe(200)
      expect(second.body).toEqual({ data: 'second' })
      expect(second.status).toBe(201)
    })

    it('should apply default values for partial responses', async () => {
      adapter.enqueue({ body: { hello: 'world' } })

      const response = await adapter.execute(makeRequest())

      expect(response.status).toBe(200)
      expect(response.ok).toBe(true)
      expect(response.headers).toEqual({})
      expect(response.body).toEqual({ hello: 'world' })
    })

    it('should apply defaults when enqueuing with no fields', async () => {
      adapter.enqueue({})

      const response = await adapter.execute(makeRequest())

      expect(response.status).toBe(200)
      expect(response.ok).toBe(true)
      expect(response.headers).toEqual({})
      expect(response.body).toBeNull()
    })

    it('should throw when queue is empty', async () => {
      await expect(adapter.execute(makeRequest())).rejects.toThrow(
        'MockAdapter: No responses enqueued'
      )
    })
  })

  describe('enqueueError', () => {
    it('should throw the enqueued error on execute', async () => {
      const networkError = new TypeError('Failed to fetch')
      adapter.enqueueError(networkError)

      await expect(adapter.execute(makeRequest())).rejects.toThrow(
        'Failed to fetch'
      )
    })

    it('should throw errors in FIFO order with responses', async () => {
      adapter.enqueue({ status: 200, ok: true, headers: {}, body: null })
      adapter.enqueueError(new TypeError('Network down'))

      const first = await adapter.execute(makeRequest())
      expect(first.status).toBe(200)

      await expect(adapter.execute(makeRequest())).rejects.toThrow(
        'Network down'
      )
    })
  })

  describe('request recording', () => {
    it('should record all executed requests via getRequests()', async () => {
      adapter.enqueue({ body: null })
      adapter.enqueue({ body: null })

      const req1 = makeRequest({ url: '/one', method: 'GET' })
      const req2 = makeRequest({ url: '/two', method: 'POST', body: '{"a":1}' })

      await adapter.execute(req1)
      await adapter.execute(req2)

      const requests = adapter.getRequests()
      expect(requests).toHaveLength(2)
      expect(requests[0]!.url).toBe('/one')
      expect(requests[1]!.url).toBe('/two')
      expect(requests[1]!.method).toBe('POST')
    })

    it('should return the last request via getLastRequest()', async () => {
      adapter.enqueue({ body: null })
      adapter.enqueue({ body: null })

      await adapter.execute(makeRequest({ url: '/first' }))
      await adapter.execute(makeRequest({ url: '/last' }))

      expect(adapter.getLastRequest()?.url).toBe('/last')
    })

    it('should return undefined for getLastRequest when no requests made', () => {
      expect(adapter.getLastRequest()).toBeUndefined()
    })
  })

  describe('assertRequestCount', () => {
    it('should pass when count matches', async () => {
      adapter.enqueue({ body: null })
      await adapter.execute(makeRequest())

      expect(() => adapter.assertRequestCount(1)).not.toThrow()
    })

    it('should throw when count does not match', () => {
      expect(() => adapter.assertRequestCount(1)).toThrow(
        'Expected 1 requests, but received 0'
      )
    })
  })

  describe('reset', () => {
    it('should clear response queue and request log', async () => {
      adapter.enqueue({ body: null })
      adapter.enqueue({ body: null })
      await adapter.execute(makeRequest())

      adapter.reset()

      expect(adapter.getRequests()).toHaveLength(0)
      expect(adapter.getLastRequest()).toBeUndefined()
      await expect(adapter.execute(makeRequest())).rejects.toThrow(
        'MockAdapter: No responses enqueued'
      )
    })
  })
})
