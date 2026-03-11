import type { AdapterRequest, AdapterResponse, HttpAdapter } from '../types'

/**
 * Production HTTP adapter wrapping native fetch.
 * Credentials default to 'include' (applied at request time).
 */
function createFetchAdapterImpl(): HttpAdapter {
  return {
    async execute(request: AdapterRequest): Promise<AdapterResponse> {
      const fetchOptions: RequestInit = {
        method: request.method,
        headers: request.headers,
        credentials: 'include',
      }

      if (request.body !== undefined) {
        fetchOptions.body = request.body
      }

      if (request.signal !== undefined) {
        fetchOptions.signal = request.signal
      }

      const response = await globalThis.fetch(request.url, fetchOptions)

      // Flatten headers to Record<string, string> with lowercase keys
      const headers: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value
      })

      // Parse JSON body, fallback to null on parse error
      let body: unknown = null
      try {
        body = await response.json()
      } catch {
        body = null
      }

      return {
        status: response.status,
        ok: response.ok,
        headers,
        body,
      }
    },
  }
}

export function createFetchAdapter(): HttpAdapter {
  return createFetchAdapterImpl()
}
