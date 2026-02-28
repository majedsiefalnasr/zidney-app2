import type { TokenStore } from '@/core/auth/token-store'
import { useAuthStore } from '@/core/auth/token-store'
import type { AppConfig } from '@/core/config/env'
import { appConfig } from '@/core/config/env'
import { normalizeError } from '@/core/errors/error-normalizer'
import type { NormalizedError } from '@/core/errors/types'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RequestConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  params?: Record<string, unknown>
  data?: unknown
  idempotencyKey?: string
}

export interface ApiResponse<T = unknown> {
  success: true
  data: T
}

export interface ApiClient {
  get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>>
  post<T>(
    url: string,
    data: unknown,
    idempotencyKey?: string
  ): Promise<ApiResponse<T>>
  put<T>(url: string, data: unknown): Promise<ApiResponse<T>>
  patch<T>(url: string, data: unknown): Promise<ApiResponse<T>>
  delete<T>(url: string, data?: unknown): Promise<ApiResponse<T>>
}

type QueueEntry = {
  resolve: (value: unknown) => void
  reject: (reason: NormalizedError) => void
  retry: () => Promise<unknown>
}

// Base fetch options — credentials: 'include' ensures the browser sends
// the httpOnly refresh cookie on cross-origin requests
const BASE_FETCH_OPTIONS: RequestInit = {
  credentials: 'include',
} as const

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createApiClient(
  config: AppConfig,
  tokenStore: TokenStore,
  fetchFn: typeof fetch = fetch
): ApiClient {
  // Single-flight refresh state (per-instance, not module-level)
  let refreshPromise: Promise<void> | null = null
  let requestQueue: QueueEntry[] = []

  function buildHeaders(
    method: string,
    idempotencyKey?: string
  ): Record<string, string> {
    const headers: Record<string, string> = {}

    // authInterceptor — attach Bearer token if present
    const token = tokenStore.getAccessToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // contentTypeInterceptor — POST/PUT/PATCH only
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      headers['Content-Type'] = 'application/json'
    }

    // idempotencyInterceptor
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey
    }

    // correlationInterceptor
    headers['X-Correlation-ID'] = crypto.randomUUID()

    return headers
  }

  function serializeParams(params?: Record<string, unknown>): string {
    if (!params) return ''
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        qs.set(key, String(value))
      }
    }
    const str = qs.toString()
    return str ? `?${str}` : ''
  }

  async function executeRequest<T>(
    reqConfig: RequestConfig
  ): Promise<ApiResponse<T>> {
    const { url, method, params, data, idempotencyKey } = reqConfig
    const fullUrl = `${config.apiBaseUrl}${url}${serializeParams(params)}`
    const headers = buildHeaders(method, idempotencyKey)

    const response = await fetchFn(fullUrl, {
      ...BASE_FETCH_OPTIONS,
      method,
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
    })

    if (!response.ok) {
      let body: unknown
      try {
        body = await response.json()
      } catch {
        body = null
      }
      const normalized = normalizeError({ body, httpStatus: response.status })
      throw normalized
    }

    const json = (await response.json()) as ApiResponse<T>
    return json
  }

  async function withRefreshInterceptor<T>(
    reqConfig: RequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      return await executeRequest<T>(reqConfig)
    } catch (err: unknown) {
      const normalized = err as NormalizedError

      // Only handle 401 for token refresh
      if (normalized.httpStatus !== 401) {
        throw normalized
      }

      // Single-flight: if refresh already in progress, queue this request
      if (refreshPromise !== null) {
        return new Promise<ApiResponse<T>>((resolve, reject) => {
          requestQueue.push({
            resolve: resolve as (value: unknown) => void,
            reject,
            retry: () => executeRequest<T>(reqConfig),
          })
        })
      }

      // Start refresh
      refreshPromise = executeRequest<{ accessToken: string }>({
        url: '/auth/refresh',
        method: 'POST',
        data: {},
      })
        .then((res) => {
          tokenStore.setAccessToken(res.data.accessToken)
          refreshPromise = null
          // Drain queue — retry all queued requests
          const queue = requestQueue
          requestQueue = []
          for (const entry of queue) {
            entry.retry().then(entry.resolve).catch(entry.reject)
          }
        })
        .catch(() => {
          refreshPromise = null
          const failError: NormalizedError = {
            code: 'AUTH_REFRESH_FAILED',
            message: 'Session expired. Please log in again.',
            httpStatus: 401,
          }
          // Reject all queued requests
          const queue = requestQueue
          requestQueue = []
          for (const entry of queue) {
            entry.reject(failError)
          }
          // Clear auth and redirect to login
          tokenStore.clearAccessToken()
          const storeWithRouter = tokenStore as unknown as {
            router?: { push: (path: string) => void }
          }
          storeWithRouter.router?.push('/login')
        })

      // Queue this request to be retried after refresh
      return new Promise<ApiResponse<T>>((resolve, reject) => {
        requestQueue.push({
          resolve: resolve as (value: unknown) => void,
          reject,
          retry: () => executeRequest<T>(reqConfig),
        })
      })
    }
  }

  return {
    get<T>(url: string, params?: Record<string, unknown>) {
      return withRefreshInterceptor<T>({ url, method: 'GET', params })
    },
    post<T>(url: string, data: unknown, idempotencyKey?: string) {
      return withRefreshInterceptor<T>({
        url,
        method: 'POST',
        data,
        idempotencyKey,
      })
    },
    put<T>(url: string, data: unknown) {
      return withRefreshInterceptor<T>({ url, method: 'PUT', data })
    },
    patch<T>(url: string, data: unknown) {
      return withRefreshInterceptor<T>({ url, method: 'PATCH', data })
    },
    delete<T>(url: string, data?: unknown) {
      return withRefreshInterceptor<T>({ url, method: 'DELETE', data })
    },
  }
}

// ─── Lazy singleton getter ────────────────────────────────────────────────────
// Defers useAuthStore() until first call — eliminates Pinia activation race.
// Never called at module evaluation time.

let _apiClient: ApiClient | null = null

export function getApiClient(): ApiClient {
  if (!_apiClient) {
    _apiClient = createApiClient(appConfig, useAuthStore())
  }
  return _apiClient
}
