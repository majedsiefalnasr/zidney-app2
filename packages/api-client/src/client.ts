import { createFetchAdapter } from './adapters/fetch-adapter'
import {
  createAppError,
  ErrorCodes,
  normalizeNetworkError,
  normalizeResponseError,
} from './http-error'
import {
  applyAuthHeader,
  applyContentType,
  applyCorrelationId,
  applyIdempotencyKey,
  createCombinedSignal,
} from './interceptors'
import type {
  AdapterRequest,
  AdapterResponse,
  ApiClient,
  ClientConfig,
  ClientResponse,
  HttpAdapter,
  RequestConfig,
} from './types'

// ─── Helper: Serialize params to query string ───────────────────────────────

function serializeParams(params?: Record<string, string | number | boolean>): string {
  if (!params) return ''
  const entries = Object.entries(params)
  if (entries.length === 0) return ''
  const qs = new URLSearchParams()
  for (const [key, value] of entries) {
    qs.set(key, String(value))
  }
  const str = qs.toString()
  return str ? `?${str}` : ''
}

// ─── Helper: Check if body has { success, data } shape ──────────────────────

function hasSuccessData(body: unknown): body is { success: true; data: unknown } {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as Record<string, unknown>).success === true &&
    'data' in (body as Record<string, unknown>)
  )
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createApiClient(config: ClientConfig): ApiClient {
  const adapter: HttpAdapter = config.adapter ?? createFetchAdapter()
  const defaultTimeout = config.defaultTimeout ?? 30000

  // Single-flight refresh state
  let refreshPromise: Promise<string> | null = null
  type QueueEntry = {
    resolve: (value: unknown) => void
    reject: (reason: unknown) => void
    retry: () => Promise<unknown>
  }
  let requestQueue: QueueEntry[] = []

  async function executeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    data?: unknown,
    reqConfig?: RequestConfig,
    isRetry?: boolean
  ): Promise<ClientResponse<unknown>> {
    // Build headers
    const headers: Record<string, string> = {}

    // 1. Auth interceptor
    applyAuthHeader(headers, config.getAccessToken)

    // 2. Correlation interceptor
    applyCorrelationId(headers, reqConfig?.correlationId)

    // 3. Content-Type interceptor (mutations only)
    applyContentType(headers, method)

    // 4. Idempotency interceptor (mutations only, when key provided)
    applyIdempotencyKey(headers, method, reqConfig?.idempotencyKey)

    // 5. Merge custom headers (after interceptors)
    if (reqConfig?.headers) {
      for (const [k, v] of Object.entries(reqConfig.headers)) {
        headers[k] = v
      }
    }

    // Build URL
    const fullUrl = `${config.baseUrl}${url}${serializeParams(reqConfig?.params)}`

    // Build body
    const body = data !== undefined ? JSON.stringify(data) : undefined

    // 5. Timeout interceptor — combine signals
    const timeout = reqConfig?.timeout !== undefined ? reqConfig.timeout : defaultTimeout
    const signal = createCombinedSignal(timeout, reqConfig?.signal)

    const adapterRequest: AdapterRequest = {
      url: fullUrl,
      method,
      headers,
      body,
      signal,
    }

    let response: AdapterResponse

    try {
      response = await adapter.execute(adapterRequest)
    } catch (err) {
      throw normalizeNetworkError(err)
    }

    // Handle 401 — single-flight refresh + retry
    if (response.status === 401 && !isRetry) {
      return handle401(method, url, data, reqConfig)
    }

    // Handle non-ok responses
    if (!response.ok) {
      throw normalizeResponseError(response)
    }

    // Success path — extract data from response body
    if (hasSuccessData(response.body)) {
      return { success: true, data: response.body.data }
    }

    // Fallback: return body directly if no { success, data } wrapper
    return { success: true, data: response.body }
  }

  async function handle401(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    data: unknown,
    reqConfig?: RequestConfig
  ): Promise<ClientResponse<unknown>> {
    // If refresh already in progress, queue this request
    if (refreshPromise !== null) {
      return new Promise((resolve, reject) => {
        requestQueue.push({
          resolve: resolve as (value: unknown) => void,
          reject,
          retry: () => executeRequest(method, url, data, reqConfig, true),
        })
      })
    }

    // Start refresh
    refreshPromise = config.onRefreshToken()

    try {
      await refreshPromise
      refreshPromise = null

      // Retry original request
      const result = await executeRequest(method, url, data, reqConfig, true)

      // Drain queue — retry all queued requests
      const queue = requestQueue
      requestQueue = []
      for (const entry of queue) {
        entry.retry().then(entry.resolve).catch(entry.reject)
      }

      return result
    } catch {
      refreshPromise = null
      config.onAuthFailure()

      // Reject all queued requests
      const queue = requestQueue
      requestQueue = []
      const authError = createAppError({
        code: ErrorCodes.AUTH_REFRESH_FAILED,
        message: 'Session expired. Please log in again.',
        httpStatus: 401,
        isNetworkError: false,
      })
      for (const entry of queue) {
        entry.reject(authError)
      }

      throw authError
    }
  }

  return {
    get<T>(url: string, reqConfig?: RequestConfig): Promise<ClientResponse<T>> {
      return executeRequest('GET', url, undefined, reqConfig) as Promise<ClientResponse<T>>
    },

    post<T>(url: string, data: unknown, reqConfig?: RequestConfig): Promise<ClientResponse<T>> {
      return executeRequest('POST', url, data, reqConfig) as Promise<ClientResponse<T>>
    },

    put<T>(url: string, data: unknown, reqConfig?: RequestConfig): Promise<ClientResponse<T>> {
      return executeRequest('PUT', url, data, reqConfig) as Promise<ClientResponse<T>>
    },

    patch<T>(url: string, data: unknown, reqConfig?: RequestConfig): Promise<ClientResponse<T>> {
      return executeRequest('PATCH', url, data, reqConfig) as Promise<ClientResponse<T>>
    },

    delete<T>(url: string, data?: unknown, reqConfig?: RequestConfig): Promise<ClientResponse<T>> {
      return executeRequest('DELETE', url, data, reqConfig) as Promise<ClientResponse<T>>
    },
  }
}
