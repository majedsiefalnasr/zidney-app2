import type { AdapterRequest, AdapterResponse, ApiClient, HttpAdapter } from '@zidney/api-client'
import { createApiClient as createClient, createFetchAdapter } from '@zidney/api-client'
import { createLogger } from '@zidney/logger'
import type { IErrorInterceptor } from '@/core/api/interceptors/error.interceptor'
import type { IRefreshManager } from '@/core/auth/refresh-manager'
import type { ITokenManager } from '@/core/auth/token-manager'
import type { TokenStore } from '@/core/auth/token-store'
import type { AppConfig } from '@/core/config/app-config'
import { appConfig } from '@/core/config/app-config'

const logger = createLogger('auth:api-client')

// ─── Re-exports for convenience ─────────────────────────────────────────────
export type {
  ApiClient,
  AppError,
  ClientResponse,
  RequestConfig,
} from '@zidney/api-client'

export { ErrorCodes, isAppError } from '@zidney/api-client'

// ─── Factory ─────────────────────────────────────────────────────────────────
/**
 * Creates the application API client with properly wired auth interceptors.
 * Called once in main.ts after tokenManager, refreshManager, and errorInterceptor are ready.
 *
 * @param tokenManager - In-memory access token holder
 * @param refreshManager - Single-flight refresh orchestrator
 * @param errorInterceptor - Handles 401 session expiry, 423/426 license responses (FR-SEC-07/20/21)
 */
export function createAppApiClient(
  tokenManager: ITokenManager,
  refreshManager: IRefreshManager,
  errorInterceptor: IErrorInterceptor
): ApiClient {
  // C1: 423/426 license response detection (FR-SEC-20/21).
  // Wraps the fetch adapter to call handleLicenseError before the response is
  // processed by the client (which will then throw normalizeResponseError).
  const rawAdapter = createFetchAdapter()
  const interceptingAdapter: HttpAdapter = {
    execute: async (request: AdapterRequest): Promise<AdapterResponse> => {
      const response = await rawAdapter.execute(request)
      if (response.status === 423 || response.status === 426) {
        errorInterceptor.handleLicenseError(response.status as 423 | 426)
        // Return the response — client processes it as non-ok and throws AppError
      }
      return response
    },
  }

  return createClient({
    baseUrl: appConfig.env.apiBaseUrl,
    credentials: 'include',
    getAccessToken: () => tokenManager.getToken(),
    onRefreshToken: async (): Promise<string> => {
      await refreshManager.refresh()
      const token = tokenManager.getToken()
      if (!token) {
        logger.error('No token available after refresh')
        throw new Error('No token after refresh')
      }
      return token
    },
    onAuthFailure: () => {
      // FR-SEC-07/FR-SEC-08: delegated to error interceptor
      errorInterceptor.handleAuthFailure().catch((err: unknown) => {
        logger.error('Error in auth failure handler', {
          error: err instanceof Error ? err.message : 'unknown',
        })
        // Fallback hard-redirect if router.push() fails inside expireSession()
        window.location.href = '/'
      })
    },
    adapter: interceptingAdapter,
  })
}

// ─── Simple API Client ────────────────────────────────────────────────────────────────────
export function createApiClient(
  config: AppConfig,
  tokenStore: TokenStore,
  fetchFn: typeof globalThis.fetch = globalThis.fetch
) {
  let refreshPromise: Promise<string> | null = null

  function buildHeaders(idempotencyKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Correlation-ID': Math.random().toString(36).slice(2) + Date.now().toString(36),
    }
    const token = tokenStore.getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
    return headers
  }

  async function doRefresh(): Promise<string> {
    if (!refreshPromise) {
      refreshPromise = fetchFn(`${config.env.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
        .then(async (res) => {
          const body = (await res.json()) as { data?: { accessToken?: string } }
          if (!res.ok || !body?.data?.accessToken) {
            throw { code: 'AUTH_REFRESH_FAILED', httpStatus: res.status }
          }
          tokenStore.setAccessToken(body.data.accessToken)
          return body.data.accessToken
        })
        .finally(() => {
          refreshPromise = null
        })
    }
    return refreshPromise
  }

  async function request(
    method: string,
    path: string,
    body?: unknown,
    idempotencyKey?: string
  ): Promise<unknown> {
    const url = `${config.env.apiBaseUrl}${path}`
    const init: RequestInit = {
      method,
      credentials: 'include',
      headers: buildHeaders(idempotencyKey),
    }
    if (body !== undefined) init.body = JSON.stringify(body)

    const response = await fetchFn(url, init)

    if (response.status === 401) {
      try {
        await doRefresh()
      } catch (err) {
        tokenStore.clearAccessToken()
        tokenStore.router?.push('/login')
        throw err
      }
      const retryInit: RequestInit = { ...init, headers: buildHeaders(idempotencyKey) }
      const retryResponse = await fetchFn(url, retryInit)
      if (!retryResponse.ok) {
        const retryBody = (await retryResponse.json()) as { error?: Record<string, unknown> }
        throw { ...(retryBody.error ?? {}), httpStatus: retryResponse.status }
      }
      const retryBody = (await retryResponse.json()) as { data?: unknown }
      return retryBody.data
    }

    if (!response.ok) {
      const errorBody = (await response.json()) as { error?: Record<string, unknown> }
      throw { ...(errorBody.error ?? {}), httpStatus: response.status }
    }

    const responseBody = (await response.json()) as { data?: unknown }
    return responseBody.data
  }

  return {
    get: (path: string) => request('GET', path),
    post: (path: string, body?: unknown, idempotencyKey?: string) =>
      request('POST', path, body, idempotencyKey),
    put: (path: string, body?: unknown) => request('PUT', path, body),
    patch: (path: string, body?: unknown) => request('PATCH', path, body),
    delete: (path: string) => request('DELETE', path),
  }
}

// ─── Singleton getter ────────────────────────────────────────────────────────────────────

let _apiClientInstance: ReturnType<typeof createApiClient> | null = null

export function setApiClient(client: ReturnType<typeof createApiClient>): void {
  _apiClientInstance = client
}

export function getApiClient(): ReturnType<typeof createApiClient> {
  if (!_apiClientInstance)
    throw new Error('[api] API client not initialized. Call setApiClient first.')
  return _apiClientInstance
}
