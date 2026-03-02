import type { IErrorInterceptor } from '@/core/api/interceptors/error.interceptor'
import type { IRefreshManager } from '@/core/auth/refresh-manager'
import type { ITokenManager } from '@/core/auth/token-manager'
import { appConfig } from '@/core/config/app-config'
import type {
  AdapterRequest,
  AdapterResponse,
  ApiClient,
  HttpAdapter,
} from '@zidney/api-client'
import {
  createApiClient as createClient,
  createFetchAdapter,
} from '@zidney/api-client'
import { createLogger } from '@zidney/logger'

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
  // Advantages: no shared-package modification; behaviour isolated to app;
  // 423/426 are re-thrown after the license callback so callers still receive
  // an AppError (they remain in an error state and the UI shows the locked/
  // upgrade-required overlay served from the license-status store).
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
