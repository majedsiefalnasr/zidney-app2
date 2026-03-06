import type { AdapterRequest, AdapterResponse, HttpAdapter } from '../types'

// ─── MockAdapter Interface ──────────────────────────────────────────────────

export interface MockAdapter extends HttpAdapter {
  enqueue(response: Partial<AdapterResponse>): void
  enqueueError(error: Error): void
  getRequests(): AdapterRequest[]
  getLastRequest(): AdapterRequest | undefined
  reset(): void
  assertRequestCount(count: number): void
}

// ─── Queue Entry ────────────────────────────────────────────────────────────

type QueueEntry = { type: 'response'; value: AdapterResponse } | { type: 'error'; value: Error }

// ─── Factory ────────────────────────────────────────────────────────────────

export function createMockAdapter(): MockAdapter {
  let queue: QueueEntry[] = []
  let requests: AdapterRequest[] = []

  return {
    enqueue(response: Partial<AdapterResponse>): void {
      queue.push({
        type: 'response',
        value: {
          status: response.status ?? 200,
          ok: response.ok ?? true,
          headers: response.headers ?? {},
          body: response.body !== undefined ? response.body : null,
        },
      })
    },

    enqueueError(error: Error): void {
      queue.push({ type: 'error', value: error })
    },

    async execute(request: AdapterRequest): Promise<AdapterResponse> {
      requests.push(request)

      const entry = queue.shift()
      if (!entry) {
        throw new Error('MockAdapter: No responses enqueued. Call enqueue() before execute().')
      }

      if (entry.type === 'error') {
        throw entry.value
      }

      return entry.value
    },

    getRequests(): AdapterRequest[] {
      return [...requests]
    },

    getLastRequest(): AdapterRequest | undefined {
      return requests.length > 0 ? requests[requests.length - 1] : undefined
    },

    reset(): void {
      queue = []
      requests = []
    },

    assertRequestCount(count: number): void {
      if (requests.length !== count) {
        throw new Error(`Expected ${count} requests, but received ${requests.length}`)
      }
    },
  }
}
